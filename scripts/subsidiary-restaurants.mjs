// 국내 자회사 사무소 주변 실존 식당을 카카오 로컬 API로 수집해
// src/data/domesticRestaurants.json을 생성한다. (해외 overseasRestaurants.json과 동일 스키마)
// 실행: node scripts/subsidiary-restaurants.mjs [--apply]  (KAKAO_REST_KEY는 .env.local 폴백)
// 평점은 카카오 API가 제공하지 않아 0(리뷰 없음)으로 두고, 카드에는 실거리·카테고리를 표시한다.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..");

let KEY = process.env.KAKAO_REST_KEY;
if (!KEY) {
  try {
    const env = readFileSync(path.join(root, ".env.local"), "utf8");
    KEY = env.match(/^KAKAO_REST_KEY=(.+)$/m)?.[1]?.trim();
  } catch {}
}
if (!KEY) {
  console.error("KAKAO_REST_KEY 환경변수(.env.local 가능)가 필요합니다");
  process.exit(1);
}
const APPLY = process.argv.includes("--apply");

const officesJson = JSON.parse(
  readFileSync(path.join(root, "src", "data", "offices.json"), "utf8").replace(/^﻿/, "")
);
const TARGETS = (officesJson.offices ?? officesJson).filter(
  (o) => o.country === "대한민국" && o.category !== "본사"
);

async function kakao(endpoint, params) {
  const url = new URL(`https://dapi.kakao.com/v2/local/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KEY}` } });
  if (!res.ok) throw new Error(`${endpoint} ${res.status} ${await res.text()}`);
  return (await res.json()).documents;
}

// 사무소 좌표: 주소 검색 → 실패 시 키워드 검색 폴백
async function locateOffice(o) {
  const byAddr = await kakao("search/address.json", { query: o.address });
  if (byAddr[0]) return { x: Number(byAddr[0].x), y: Number(byAddr[0].y), how: "주소" };
  const byKw = await kakao("search/keyword.json", { query: `${o.city} ${o.name.replace(/[㈜()]/g, " ").trim()}` });
  if (byKw[0]) return { x: Number(byKw[0].x), y: Number(byKw[0].y), how: "키워드" };
  return null;
}

// 카테고리 경로 → 앱 cuisine 매핑
function cuisineOf(categoryName) {
  if (/일식|초밥|참치|돈까스|우동|회|횟집/.test(categoryName)) return "일식";
  if (/중식|중국/.test(categoryName)) return "중식";
  if (/양식|이탈리안|피자|파스타|스테이크|햄버거|멕시칸/.test(categoryName)) return "양식";
  if (/아시아음식|베트남|태국|인도/.test(categoryName)) return "동남아";
  if (/한식|국밥|찌개|한정식|육류|고기|곱창|족발|보쌈|삼계탕|냉면|국수|해물|생선|조개|낙지|추어/.test(categoryName)) return "한식";
  return "기타";
}

function tierOf(categoryName) {
  if (/한정식|일식집|소고기|한우|장어|복어|참치|스테이크/.test(categoryName)) return 2;
  if (/뷔페|요리주점/.test(categoryName)) return 2;
  return 1;
}

function purposesOf(categoryName, tier) {
  const p = ["점심"];
  if (/육류|고기|곱창|족발|횟집|회|해물|요리주점|치킨/.test(categoryName) || tier >= 2) p.push("저녁 회식");
  if (/한정식|일식집|한우|장어|복어/.test(categoryName)) p.push("접대");
  return p;
}

const QUERIES = ["맛집", "한정식", "고기집", "횟집", "일식", "중식당", "국밥", "파스타"];
const M_PER_LAT = 111320;

const out = {};
for (const o of TARGETS) {
  const loc = await locateOffice(o);
  if (!loc) {
    console.log(`✗ ${o.name}: 사무소 좌표 실패 — 건너뜀 (더미 유지)`);
    continue;
  }
  const mPerLng = M_PER_LAT * Math.cos(((loc.y) * Math.PI) / 180);

  // 반경을 넓혀가며 수집 (산단·발전소 인근 대비)
  let picked = [];
  for (const radius of [1500, 3000, 5000]) {
    const seen = new Map();
    for (const q of QUERIES) {
      const docs = await kakao("search/keyword.json", {
        query: q,
        x: loc.x,
        y: loc.y,
        radius,
        sort: "accuracy",
        size: 10,
      });
      for (const d of docs) {
        if (d.category_group_code !== "FD6") continue;
        if (/카페|커피|디저트|베이커리|치킨|패스트푸드|간식/.test(d.category_name)) continue;
        if (!seen.has(d.id)) seen.set(d.id, d);
      }
    }
    // 음식종류 다양성: 같은 cuisine 최대 3곳, 가까운 순
    const all = [...seen.values()].sort((a, b) => Number(a.distance) - Number(b.distance));
    const byCuisine = {};
    picked = [];
    for (const d of all) {
      const c = cuisineOf(d.category_name);
      byCuisine[c] = byCuisine[c] ?? 0;
      if (byCuisine[c] >= 3) continue;
      byCuisine[c]++;
      picked.push(d);
      if (picked.length >= 8) break;
    }
    if (picked.length >= 5) break;
  }

  const slug = o.name.replace(/[^a-zA-Z0-9가-힣]/g, "").toLowerCase().slice(0, 12) || "office";
  const restaurants = picked.map((d, i) => {
    const dx = Math.round((Number(d.x) - loc.x) * mPerLng);
    const dy = Math.round((Number(d.y) - loc.y) * M_PER_LAT);
    const distM = Number(d.distance) || Math.round(Math.hypot(dx, dy));
    const catTail = d.category_name.split(">").pop().trim();
    const cuisine = cuisineOf(d.category_name);
    const tier = tierOf(d.category_name);
    return {
      id: `dom-${slug}-${i}`,
      name: d.place_name,
      cuisine,
      desc: `${catTail} · 사무소 인근 실측`,
      priceTier: tier,
      purposes: purposesOf(d.category_name, tier),
      distM,
      dx,
      dy,
      kakao: { score: 0, count: 0 },
      naver: { score: 0, count: 0 },
      google: { score: 0, count: 0 },
      naverBooking: false,
      catchtable: false,
      address: d.road_address_name || d.address_name,
      placeUrl: d.place_url,
      loc: o.name,
      features: {
        premium: tier >= 2,
        room: tier >= 2,
        quiet: false,
        group: true,
        english: false,
        halal: false,
        parking: false,
      },
      isNew: false,
    };
  });

  out[o.name] = { officeLat: loc.y, officeLng: loc.x, restaurants };
  console.log(
    `✓ ${o.name} (${loc.how}): ${restaurants.length}곳, ${Math.min(...restaurants.map((r) => r.distM))}~${Math.max(...restaurants.map((r) => r.distM))}m`
  );
}

if (APPLY) {
  const p = path.join(root, "src", "data", "domesticRestaurants.json");
  writeFileSync(
    p,
    JSON.stringify({ updated: "2026-07-23", source: "카카오 로컬 API 실측", offices: out }, null, 2) + "\n"
  );
  console.log(`\n저장: ${p} (사무소 ${Object.keys(out).length}곳)`);
}
