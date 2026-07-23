// gen-images.mjs가 만든 원본(scripts/img-src, 1024px+)을 리포용으로 축소한다.
// sharp 등 의존성 없이 헤드리스 Chrome 캔버스로 변환.
//   썸네일 6종 → public/img/cuisine/<이름>.webp (256px)
//   og.png     → public/og.jpg (1200x630 중앙 크롭)
// 실행: node scripts/downscale-images.mjs

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..");
const SRC = path.join(dir, "img-src");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--remote-debugging-port=9225",
  "--user-data-dir=" + process.env.TEMP + "/moim-img-cdp", "about:blank",
]);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((res) => { pending.set(++id, res); ws.send(JSON.stringify({ id, method, params })); });

// 캔버스 변환: cover 크롭 + 리사이즈 후 dataURL 반환
const convert = async (b64png, w, h, mime, q) => {
  const expr = `(async () => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = "data:image/png;base64,${b64png}"; });
    const c = document.createElement("canvas"); c.width = ${w}; c.height = ${h};
    const ctx = c.getContext("2d");
    const scale = Math.max(${w} / img.width, ${h} / img.height);
    const sw = ${w} / scale, sh = ${h} / scale;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, ${w}, ${h});
    return c.toDataURL("${mime}", ${q});
  })()`;
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  const url = r.result?.result?.value;
  if (!url?.startsWith("data:")) throw new Error("변환 실패: " + JSON.stringify(r.result?.exceptionDetails?.text ?? r).slice(0, 200));
  return Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
};

try {
  let target;
  for (let i = 0; i < 30; i++) {
    await wait(500);
    try {
      const list = await (await fetch("http://127.0.0.1:9225/json")).json();
      target = list.find((t) => t.type === "page");
      if (target) break;
    } catch {}
  }
  if (!target) throw new Error("Chrome CDP 연결 실패");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };

  mkdirSync(path.join(root, "public", "img", "cuisine"), { recursive: true });
  for (const f of readdirSync(SRC).filter((f) => f.endsWith(".png"))) {
    const b64 = readFileSync(path.join(SRC, f)).toString("base64");
    if (f === "og.png") {
      const out = path.join(root, "public", "og.jpg");
      writeFileSync(out, await convert(b64, 1200, 630, "image/jpeg", 0.85));
      console.log(`og.jpg 1200x630 (${Math.round(readFileSync(out).length / 1024)}KB)`);
    } else {
      const out = path.join(root, "public", "img", "cuisine", f.replace(".png", ".webp"));
      writeFileSync(out, await convert(b64, 256, 256, "image/webp", 0.85));
      console.log(`${path.basename(out)} 256px (${Math.round(readFileSync(out).length / 1024)}KB)`);
    }
  }
} finally {
  chrome.kill();
}
