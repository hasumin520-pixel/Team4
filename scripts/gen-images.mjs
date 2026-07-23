// AI 게이트웨이(gpt-image-2)로 음식종류별 카드 썸네일 6종 + OG 대표 이미지를 생성한다.
// 원본(1024px PNG)은 스크래치에 두고, 리포에는 축소본만 커밋한다(scripts/downscale-images.mjs).
//
// 실행: node scripts/gen-images.mjs [--force]
//   GATEWAY_API_KEY는 .env.local에서 읽음. 이미 생성된 파일은 건너뜀(재과금 방지) — 다시 만들려면 --force.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..");
const FORCE = process.argv.includes("--force");
const OUT = path.join(root, "scripts", "img-src"); // 원본 보관(리포 제외 — .gitignore의 scripts/data-src와 같은 성격이라 아래서 추가)
mkdirSync(OUT, { recursive: true });

// .env.local에서 키 로드
const env = Object.fromEntries(
  readFileSync(path.join(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);
const KEY = process.env.GATEWAY_API_KEY || env.GATEWAY_API_KEY;
if (!KEY) {
  console.error("GATEWAY_API_KEY가 없습니다 (.env.local 확인)");
  process.exit(1);
}

// 공통 스타일 — 앱 크림 톤(#fffdf8)과 어울리는 플랫 일러스트, 글자 금지
const STYLE =
  "flat vector illustration, soft warm cream background, pastel peach and orange accents, " +
  "minimal clean composition, appetizing, gentle shadows, no text, no letters, no watermark";

const JOBS = [
  { file: "hansik.png", size: "1024x1024", prompt: `Korean meal spread: grilled short ribs, rice, soup and colorful side dishes on a round table, top-down view, ${STYLE}` },
  { file: "ilsik.png", size: "1024x1024", prompt: `Japanese sushi and sashimi set on a wooden board with chopsticks and green tea, top-down view, ${STYLE}` },
  { file: "jungsik.png", size: "1024x1024", prompt: `Chinese dishes: steaming dim sum in bamboo basket and noodles, top-down view, ${STYLE}` },
  { file: "yangsik.png", size: "1024x1024", prompt: `Western dinner: steak on a plate with wine glass and pasta, top-down view, ${STYLE}` },
  { file: "asian.png", size: "1024x1024", prompt: `Southeast Asian food: Vietnamese pho noodle soup with herbs and lime, and fresh spring rolls, top-down view, ${STYLE}` },
  { file: "etc.png", size: "1024x1024", prompt: `Cozy cafe set: coffee latte, sandwich and dessert on a small table, top-down view, ${STYLE}` },
  { file: "og.png", size: "1536x1024", prompt: `Wide warm dining table scene with diverse Korean and international dishes shared by colleagues, inviting team dinner atmosphere, top-down view, ${STYLE}` },
];

for (const job of JOBS) {
  const out = path.join(OUT, job.file);
  if (!FORCE && existsSync(out)) {
    console.log(`skip (이미 있음): ${job.file}`);
    continue;
  }
  console.log(`생성 중: ${job.file} ...`);
  const res = await fetch("https://gw.letsur.ai/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-2", prompt: job.prompt, size: job.size, quality: "medium", n: 1 }),
  });
  if (!res.ok) {
    console.error(`  실패 ${res.status}: ${(await res.text()).slice(0, 300)}`);
    continue;
  }
  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    console.error(`  응답에 b64_json 없음: ${JSON.stringify(data).slice(0, 200)}`);
    continue;
  }
  writeFileSync(out, Buffer.from(b64, "base64"));
  console.log(`  저장: ${out} (${Math.round(Buffer.from(b64, "base64").length / 1024)}KB)`);
}
console.log("\n완료 — 다음 단계: node scripts/downscale-images.mjs (리포용 축소본 생성)");
