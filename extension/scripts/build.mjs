// Builds the unpacked extension into dist/ (load it from chrome://extensions or edge://extensions).
import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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

// Embeddings (multilingual-e5-base, float32, from backend/data) stored as int8 with one scale
// per row: a quarter of the size, same ranking in practice (checked against the float32 file).
function packEmbeddings(npy, dest) {
  const buf = readFileSync(npy);
  const headerLen = buf.readUInt16LE(8);
  const header = buf.toString("latin1", 10, 10 + headerLen);
  const shape = header.match(/'shape':\s*\((\d+),\s*(\d+)\)/);
  if (!header.includes("'<f4'") || header.includes("'fortran_order': True") || !shape) throw new Error(`Unexpected ${npy} format: ${header}`);
  const [rows, dims] = [Number(shape[1]), Number(shape[2])];
  const start = 10 + headerLen;
  const f32 = new Float32Array(buf.buffer.slice(buf.byteOffset + start, buf.byteOffset + start + rows * dims * 4));
  const bin = Buffer.alloc(8 + rows * 4 + rows * dims);
  bin.writeUInt32LE(rows, 0);
  bin.writeUInt32LE(dims, 4);
  for (let r = 0; r < rows; r++) {
    const row = f32.subarray(r * dims, (r + 1) * dims);
    const norm = Math.hypot(...row) || 1;
    let max = 0;
    for (const x of row) max = Math.max(max, Math.abs(x / norm));
    const scale = max / 127 || 1;
    bin.writeFloatLE(scale, 8 + r * 4);
    for (let d = 0; d < dims; d++) bin.writeInt8(Math.round(row[d] / norm / scale), 8 + rows * 4 + r * dims + d);
  }
  mkdirSync(join(out, "data"), { recursive: true });
  writeFileSync(join(out, dest), bin);
  console.log(`${dest}: ${rows} x ${dims}`);
  return rows;
}

const backendData = "../backend/data";
if (existsSync(join(backendData, "quran_embeddings.npy"))) {
  packEmbeddings(join(backendData, "quran_embeddings.npy"), "data/quran-e5.bin");
} else {
  console.warn("backend/data/quran_embeddings.npy not found; Quran semantic search is off in this build.");
}
const hadithIds = join(backendData, "hadith_embeddings_ids.json");
if (existsSync(join(backendData, "hadith_embeddings.npy")) && existsSync(hadithIds)) {
  const rows = packEmbeddings(join(backendData, "hadith_embeddings.npy"), "data/hadith-e5.bin");
  const ids = JSON.parse(readFileSync(hadithIds, "utf8"));
  if (ids.length !== rows) throw new Error(`${hadithIds} has ${ids.length} ids for ${rows} rows`);
  writeFileSync(join(out, "data/hadith-e5-ids.json"), JSON.stringify(ids));
} else {
  console.warn("backend/data/hadith_embeddings.npy not found (run backend/build_hadith.py); hadith semantic search is off in this build.");
}

console.log("Built extension in", out);
