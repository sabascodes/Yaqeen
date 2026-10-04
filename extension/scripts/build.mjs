// Builds the unpacked extension into dist/ (load it from chrome://extensions or edge://extensions).
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";

const out = "dist";
const pkgDir = (name) => join("node_modules", name);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: {
    "service-worker": "src/background/service-worker.ts",
    content: "src/content/content.ts",
    offscreen: "src/offscreen/offscreen.ts",
    options: "src/options/options.ts",
    popup: "src/popup/popup.ts",
  },
  outdir: out,
  bundle: true,
  format: "esm",
  target: "chrome116",
  loader: { ".css": "text" },
  minify: process.argv.includes("--minify"),
  logLevel: "info",
});

cpSync("static", out, { recursive: true });
for (const page of ["options/options.html", "popup/popup.html"]) cpSync(join("src", page), join(out, page.split("/")[1]));
cpSync("src/ui/card.css", join(out, "ui.css"));
cpSync("src/offscreen/offscreen.html", join(out, "offscreen.html"));

// On-device OCR engine (LSTM builds only, the mode Yaqeen uses) and language data (Arabic + English), bundled so nothing is fetched at run time.
const vendor = join(out, "vendor");
cpSync(join(pkgDir("tesseract.js"), "dist/worker.min.js"), join(vendor, "tesseract/worker.min.js"));
const core = pkgDir("tesseract.js-core");
mkdirSync(join(vendor, "tesseract-core"), { recursive: true });
for (const f of readdirSync(core)) if (/^tesseract-core.*lstm\.wasm\.js$/.test(f)) cpSync(join(core, f), join(vendor, "tesseract-core", f));
for (const lang of ["ara", "eng"]) {
  cpSync(join(pkgDir(`@tesseract.js-data/${lang}`), "4.0.0_best_int", `${lang}.traineddata.gz`), join(vendor, "tessdata", `${lang}.traineddata.gz`));
}
// ONNX runtime for the embedding model (the build Transformers.js loads in Chrome and Edge).
const ort = join(pkgDir("onnxruntime-web"), "dist");
for (const f of readdirSync(ort)) if (/^ort-wasm-simd-threaded\.asyncify\.(mjs|wasm)$/.test(f)) cpSync(join(ort, f), join(vendor, "ort", f));

console.log("Built extension in", out);
