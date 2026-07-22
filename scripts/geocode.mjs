// 카카오 로컬 키워드 검색 API로 식당 실좌표·주소를 조회해 restaurants.json에 반영한다.
// 실행: KAKAO_REST_KEY=<REST API 키> node scripts/geocode.mjs [--apply]
//   --apply 없이 실행하면 조회 결과만 출력(드라이런), --apply 시 파일 갱신.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const KEY = process.env.KAKAO_REST_KEY;
if (!KEY) {
  console.error("KAKAO_REST_KEY 환경변수가 필요합니다");
  process.exit(1);
}
const APPLY = process.argv.includes("--apply");

const dir = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = path.join(dir, "..", "src", "data", "restaurants.json");
const data = JSON.parse(readFileSync(jsonPath, "utf8"));

async function search(query, x, y) {
  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", query);
  if (x) {
    url.searchParams.set("x", x);
    url.searchParams.set("y", y);
    url.searchParams.set("radius", "3000");
    url.searchParams.set("sort", "distance");
  }
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KEY}` } });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()).documents;
}

// 1) 회사(SK서린빌딩) 실좌표
const company = (await search("SK서린빌딩"))[0];
const cx = Number(company.x), cy = Number(company.y);
console.log(`회사: ${company.place_name} / ${company.road_address_name} / lng=${cx}, lat=${cy}\n`);

// 2) 식당별 조회 (음식점 카테고리 + 이름 포함 매칭 우선)
const M_PER_LAT = 111320;
const M_PER_LNG = 111320 * Math.cos((cy * Math.PI) / 180);
// 상호 표기 변형으로 자동 매칭이 실패하는 경우 카카오맵 등록명을 직접 지정
const QUERY_OVERRIDES = {
  R016: "허니즉석떡볶이 광화문본점",
  R019: "풍남원조골뱅이",
  R065: "붓처스컷 광화문점",
};
const norm = (s) => s.replace(/\s/g, "");
// 오매칭 방지: 상호가 겹치는 매칭만 인정하고(음식점/카페 카테고리 한정),
// 회사 기준 2km 초과 결과는 다른 지점으로 간주해 제외한다(더미 데이터 범위 ≤1.6km).
const MAX_DIST = 2000;
const results = [];
for (const r of data.restaurants) {
  const query = QUERY_OVERRIDES[r.id] ?? r.name;
  const docs = await search(query, cx, cy);
  const core = norm(query.split(" ")[0]); // 지점명 제외한 상호
  const nameOk = (d) => {
    const pn = norm(d.place_name);
    return pn.includes(core) || core.includes(pn);
  };
  const eatery = (d) => d.category_group_code === "FD6" || d.category_group_code === "CE7";
  const food = docs.filter(eatery);
  const best = food.find((d) => nameOk(d)) ?? food[0];
  if (!best || !nameOk(best) || Number(best.distance) > MAX_DIST) {
    results.push({ id: r.id, name: r.name, found: null, reason: best ? "매칭 신뢰 불가" : "검색 결과 없음" });
    continue;
  }
  const dx = Math.round((Number(best.x) - cx) * M_PER_LNG);
  const dy = Math.round((Number(best.y) - cy) * M_PER_LAT);
  results.push({
    id: r.id, name: r.name, found: best.place_name,
    address: best.road_address_name || best.address_name,
    distM: Number(best.distance), dx, dy, placeUrl: best.place_url,
    category: best.category_name.split(" > ").pop(),
    group: best.category_group_code,
  });
  await new Promise((s) => setTimeout(s, 120)); // rate limit 배려
}

// 2.5) 서로 다른 식당이 같은 장소로 매칭된 경우 상호가 정확히 일치하는 쪽만 인정
const byPlace = new Map();
for (const r of results) if (r.found) (byPlace.get(r.placeUrl) ?? byPlace.set(r.placeUrl, []).get(r.placeUrl)).push(r);
for (const group of byPlace.values()) {
  if (group.length < 2) continue;
  const exact = group.find((r) => norm(r.found).includes(norm(r.name)));
  for (const r of group) {
    if (r !== exact) Object.assign(r, { found: null, reason: `중복 매칭(${group.map((g) => g.name).join("/")})` });
  }
}

// 3) 결과 출력
for (const r of results) {
  if (!r.found) console.log(`❌ ${r.name}: ${r.reason ?? "검색 결과 없음"}`);
  else console.log(`${r.name} → ${r.found} | ${r.category} | ${r.distM}m | ${r.address}`);
}

// 카카오 카테고리 → 앱 음식종류 매핑 ('기타'로 남은 식당만 보정)
const CATEGORY_CUISINE = [
  ["일식", /일식|초밥|롤|라면|돈까스|우동|일본식|참치/],
  ["중식", /중식|중국|양꼬치|딤섬|마라/],
  ["양식", /양식|이탈리안|스테이크|립|햄버거|피자|멕시칸|브라질|와인/],
  ["동남아", /베트남|태국|동남아|아시안|쌀국수/],
  ["한식", /./], // 그 외 음식점(해장국·설렁탕·육류·회·복어·호프 등)은 한식으로
];
const cuisineOf = (category, group) => {
  if (group === "CE7") return null; // 카페는 '기타' 유지
  for (const [c, re] of CATEGORY_CUISINE) if (re.test(category)) return c;
  return null;
};

// 4) 반영
if (APPLY) {
  for (const r of data.restaurants) {
    const g = results.find((x) => x.id === r.id);
    if (!g?.found) continue;
    r.dx = g.dx;
    r.dy = g.dy;
    r.distM = g.distM;
    r.address = g.address;
    r.placeUrl = g.placeUrl;
    if (r.cuisine === "기타") {
      const c = cuisineOf(g.category, g.group);
      if (c) r.cuisine = c;
    }
  }
  data._comment =
    "식당명·좌표·거리·주소는 카카오 로컬 API 실측(2026-07-22). 평점/리뷰수는 여전히 시연용 가상 값. dx/dy는 SK서린빌딩 기준 상대좌표(m).";
  writeFileSync(jsonPath, JSON.stringify(data, null, 2));
  console.log("\nrestaurants.json 갱신 완료");
}
