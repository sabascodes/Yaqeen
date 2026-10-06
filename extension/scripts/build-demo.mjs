// Builds the web demo into demo-dist/ (deployed to Netlify, see ../netlify.toml).
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { zipSync } from "fflate";

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
cpSync("demo/privacy.html", join(out, "privacy.html"));
cpSync("demo/favicon.png", join(out, "favicon.png"));

// In-browser OCR: the Tesseract engine and Yaqeen's Arabic model, served by the site itself.
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
// The extension itself, built with the same real data and zipped, so people can install it from
// the site's Install page without running the Colab notebook. The same zip is the store package.
execFileSync(process.execPath, ["scripts/build.mjs", "--minify"], { stdio: "inherit" });
const files = {};
(function add(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) add(p);
    else files[relative("dist", p).split("\\").join("/")] = readFileSync(p);
  }
})("dist");
writeFileSync(join(out, "yaqeen-extension.zip"), zipSync(files, { level: 9 }));
console.log("Zipped the extension to", join(out, "yaqeen-extension.zip"));
console.log("Built demo in", out);
