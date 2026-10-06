// Reads every test picture in Chromium with the real tesseract.js + Yaqeen preparation. usage: run.mjs OUT.json
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const root = "/tmp/ocr/web/site";
const srv = http.createServer((q, r) => { const p = path.join(root, decodeURIComponent(q.url.split("?")[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": p.endsWith(".js") ? "text/javascript" : p.endsWith(".html") ? "text/html" : "application/octet-stream" }); fs.createReadStream(p).pipe(r); }).listen(8765);
const rows = JSON.parse(fs.readFileSync("/tmp/ocr/test.json"));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const N = 3, out = new Array(rows.length);
await Promise.all([...Array(N)].map(async (_, k) => {
  const page = await browser.newPage(); await page.goto("http://localhost:8765/index.html");
  for (let i = k; i < rows.length; i += N) {
    const r = rows[i];
    out[i] = await page.evaluate(([u, l, f]) => window[f](u, l), ["/test/" + path.basename(r.path), r.lang, process.env.FN || "run"]).catch((e) => ({ text: "", error: String(e) }));
  }
}));
fs.writeFileSync(process.argv[2], JSON.stringify(out)); await browser.close(); srv.close();
