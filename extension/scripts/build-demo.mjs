// Builds the web demo into demo-dist/ (deployed to Netlify, see ../netlify.toml).
import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const out = "demo-dist";
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "data"), { recursive: true });

await build({
  entryPoints: { demo: "demo/demo.ts" },
  outdir: out,
  bundle: true,
  splitting: true,
  chunkNames: "chunks/[name]-[hash]",
  format: "esm",
  target: "es2022",
  minify: true,
  logLevel: "info",
});
cpSync("demo/index.html", join(out, "index.html"));
cpSync("demo/favicon.png", join(out, "favicon.png"));

// In-browser OCR: the Tesseract engine and Yaqeen's Arabic and English models, served by the site itself.
const pkgDir = (name) => join("node_modules", name);
const vendor = join(out, "vendor");
cpSync(join(pkgDir("tesseract.js"), "dist/worker.min.js"), join(vendor, "tesseract/worker.min.js"));
mkdirSync(join(vendor, "tesseract-core"), { recursive: true });
for (const f of readdirSync(pkgDir("tesseract.js-core"))) if (/^tesseract-core.*lstm\.wasm\.js$/.test(f)) cpSync(join(pkgDir("tesseract.js-core"), f), join(vendor, "tesseract-core", f));
cpSync("ocr-models", join(vendor, "tessdata"), { recursive: true });
cpSync("src/ui/card.css", join(out, "ui.css"));
for (const f of ["quran.json", "hadeethenc.json"]) {
  // Source data from backend/data (made by fetch_quran.py and build_hadith.py).
  const src = join("..", "backend", "data", f);
  if (!existsSync(src)) throw new Error(`${src} is missing; run fetch_quran.py and build_hadith.py first.`);
  cpSync(src, join(out, "data", f));
}
console.log("Built demo in", out);
