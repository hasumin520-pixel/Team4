// restaurant_map_dummy_data.xlsx(팀 전달본)를 파싱해
// src/data/restaurants.json(식당마스터 166곳) + src/data/visits.json(결제내역 1,139건 집계)을 생성한다.
//
// 엑셀 [안내] 시트 요약: 결제내역은 실제 회계 파일 112건 + 가상 생성 1,027건이며
// 전 건에 식당ID가 직접 매칭되어 있다(랜덤 배정 불필요). 평점은 네이버/카카오/구글 3종(가상 수치).
//
// 개인정보: 임직원 열에 실명이 포함되어 있어(실제 3명 + 가상 7명) 전원 마스킹해 출력한다.
// 전원 마스킹하는 이유 — 일부만 가리면 가려진 쪽이 실존 인물임이 역으로 드러나기 때문.
//
// 좌표: 엑셀에는 거리(m)만 있고 좌표가 없다. 기존 카카오 실측 데이터(restaurants.json 36곳)와
// 이름이 일치하면 실좌표/주소/장소링크를 승계하고, 나머지는 거리 반경 + id 시드 방위각으로
// 근사 배치한다(scripts/geocode.mjs 실행 시 실좌표로 교체 예정).
//
// 입력(1회성, 저장소에 커밋하지 않음 — 실명 포함): 카카오톡 받은 파일의 엑셀
// 출력: src/data/restaurants.json, src/data/visits.json
// 실행: node scripts/build-dummy-data.mjs "<xlsx 경로>"

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { unzipSync, strFromU8 } from "fflate";

const dir = path.dirname(fileURLToPath(import.meta.url));
const XLSX =
  process.argv[2] ??
  "C:\\Users\\Admin\\Documents\\카카오톡 받은 파일\\restaurant_map_dummy_data (1).xlsx";

// --- xlsx 파싱 (fflate로 압축 해제 후 시트 XML 정규식 파싱 — parse-xlsx.mjs와 동일 방식) ---
const zip = unzipSync(readFileSync(XLSX));
const sst = [...strFromU8(zip["xl/sharedStrings.xml"]).matchAll(/<si>(.*?)<\/si>/gs)].map((m) =>
  [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join("")
);
function parseSheet(file) {
  const rows = [];
  for (const rm of strFromU8(zip[`xl/worksheets/${file}`]).matchAll(
    /<row [^>]*r="(\d+)"[^>]*>(.*?)<\/row>/gs
  )) {
    if (rm[1] === "1") continue; // header
    const cells = {};
    for (const cm of rm[2].matchAll(/<c ([^>]*)>(?:.*?<v>([^<]*)<\/v>)?.*?<\/c>|<c ([^>]*)\/>/gs)) {
      const attrs = cm[1] ?? cm[3] ?? "";
      const col = (attrs.match(/r="([A-Z]+)\d+"/) || [])[1];
      if (col && cm[2] !== undefined) cells[col] = /t="s"/.test(attrs) ? sst[Number(cm[2])] : cm[2];
    }
    if (Object.keys(cells).length) rows.push(cells);
  }
  return rows;
}
const master = parseSheet("sheet2.xml"); // 식당마스터
const txRows = parseSheet("sheet3.xml"); // 결제내역

// --- 기존 카카오 실측 좌표 승계용 (이름 정규화 매칭) ---
const prev = JSON.parse(
  readFileSync(path.join(dir, "..", "src", "data", "restaurants.json"), "utf8")
).restaurants;
const norm = (s) => (s ?? "").replace(/\s/g, "").replace(/(본점|광화문점|을지로점|종로점)$/, "");
const prevByName = new Map(prev.map((r) => [norm(r.name), r]));

// --- 음식종류 공백 81곳 보정: 상호 키워드 휴리스틱 (지오코딩 시 카카오 카테고리로 교체 예정) ---
const CUISINE_RULES = [
  ["일식", /스시|초밥|오마카세|이자카야|사케|텐동|라멘|우동|소바|가쯔|카츠|돈부리|규동|참치|장어|야키|일식/],
  ["중식", /짬뽕|짜장|마라|딤섬|훠궈|양꼬치|중화|중식|향$|각$/],
  ["동남아", /쌀국수|포\s|팟타이|분짜|베트남|타이|태국|아시안/],
  ["양식", /파스타|피자|피제리아|스테이크|그릴|버거|비스트로|트라토리아|오스테리아|브라세리|와인|다이닝/],
  ["한식", /곱창|정육|냉면|국밥|설렁탕|설농탕|해장|갈비|구이|한우|삼겹|족발|보쌈|백반|비빔|두부|낙지|추어|삼계|막국수|칼국수|전집|주꾸미|쭈꾸미|생선|횟집|회$|찜|탕$|정식|한정식|명가|옥$|집$/],
];
function guessCuisine(name) {
  for (const [c, re] of CUISINE_RULES) if (re.test(name)) return c;
  return "기타";
}

// --- id 시드 결정적 방위각 (재실행해도 같은 결과) ---
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const PRICE_TIER = { "2-3만원대": 1, "2~3만원대": 1, "4-6만원대": 2, "4~6만원대": 2, "10만원 이상": 3 };
const PURPOSE_MAP = { 점심: "점심", 저녁회식: "저녁 회식", 접대: "접대" };

let inherited = 0;
const restaurants = master.map((c) => {
  const name = c.B;
  const distM = Number(c.G);
  const p = prevByName.get(norm(name));
  let dx, dy;
  if (p) {
    ({ dx, dy } = p);
    inherited++;
  } else {
    const angle = (hashStr(c.A) % 360) * (Math.PI / 180);
    dx = Math.round(distM * Math.cos(angle));
    dy = Math.round(distM * Math.sin(angle));
  }
  const cuisine = c.D && c.D !== "기타" ? c.D : guessCuisine(name);
  return {
    id: c.A,
    name,
    cuisine,
    desc: c.C ?? "",
    priceTier: PRICE_TIER[c.E] ?? 1,
    purposes: (c.H ?? "점심").split(",").map((x) => PURPOSE_MAP[x.trim()] ?? x.trim()),
    distM,
    dx,
    dy,
    kakao: { score: Number(c.L), count: Number(c.M) },
    naver: { score: Number(c.J), count: Number(c.K) },
    google: { score: Number(c.N), count: Number(c.O) },
    naverBooking: false,
    catchtable: false,
    ...(p ? { address: p.address, placeUrl: p.placeUrl } : {}),
  };
});

// --- 결제내역 → 방문 통계 (전 건 식당ID 직접 매칭) ---
// 임직원 실명 마스킹: 이충환 → 이*환 (전원 적용)
const maskName = (n) =>
  n.length >= 2 ? `${n[0]}${"*".repeat(n.length - 2)}${n.slice(-1)}` : n;

let real = 0;
const stats = {};
for (const c of txRows) {
  const rid = c.L;
  if (!rid) continue;
  if (c.N === "실제업로드데이터") real++;
  const date = (c.B ?? "").replaceAll("-", ""); // YYYY-MM-DD → YYYYMMDD
  const amount = Number(c.H);
  const s = (stats[rid] ??= { count: 0, totalAmount: 0, lastDate: "", byAccount: {}, recent: [] });
  s.count++;
  s.totalAmount += amount;
  s.byAccount[c.F] = (s.byAccount[c.F] ?? 0) + 1;
  if (date > s.lastDate) s.lastDate = date;
  s.recent.push({ date, amount, account: c.F, card: `${c.E}_${maskName(c.D ?? "")}` });
}
for (const s of Object.values(stats)) {
  s.recent.sort((a, b) => b.date.localeCompare(a.date));
  s.recent = s.recent.slice(0, 5);
}

// --- 출력 ---
writeFileSync(
  path.join(dir, "..", "src", "data", "restaurants.json"),
  JSON.stringify(
    {
      _comment:
        "restaurant_map_dummy_data.xlsx 식당마스터 166곳. 평점 3종은 시연용 가상 수치. 좌표는 일부만 카카오 실측 승계, 나머지는 거리 기반 근사(geocode.mjs로 교체 예정).",
      restaurants,
    },
    null,
    2
  )
);
writeFileSync(
  path.join(dir, "..", "src", "data", "visits.json"),
  JSON.stringify(
    {
      generatedFrom: `restaurant_map_dummy_data.xlsx 결제내역 ${txRows.length}건 (실제 ${real}건 + 가상 ${txRows.length - real}건, 임직원명 전원 마스킹)`,
      txCount: { excel: real, synth: txRows.length - real },
      stats,
    },
    null,
    2
  )
);

const byCuisine = {};
for (const r of restaurants) byCuisine[r.cuisine] = (byCuisine[r.cuisine] ?? 0) + 1;
console.log(`식당 ${restaurants.length}곳 (실측좌표 승계 ${inherited}곳) / 거래 ${txRows.length}건 → ${Object.keys(stats).length}곳 집계`);
console.log("음식종류:", JSON.stringify(byCuisine));
