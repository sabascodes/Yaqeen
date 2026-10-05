/**
 * Offscreen document: on-device OCR (Yaqeen's Tesseract models, Arabic and English) and the
 * multilingual embedding model. Images and text never leave the device here.
 */
import { createWorker, type Worker } from "tesseract.js";
import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import type { OffscreenRequest } from "../shared/messages";
import { OCR_PARAMS, readImage, type OcrLang } from "../shared/ocr";

// Same model that produced the ayah embeddings (backend/data/quran_embeddings.npy), as ONNX.
const EMBEDDING_MODEL = "Xenova/multilingual-e5-base";

const ocrWorkers = new Map<OcrLang, Promise<Worker>>();
let embedder: Promise<FeatureExtractionPipeline> | null = null;

function getOcr(lang: OcrLang): Promise<Worker> {
  let w = ocrWorkers.get(lang);
  // One language per worker: an English model mixed in turns decorated Arabic letters into Latin ones.
  w ??= createWorker(lang === "ar" ? "ara" : "eng", 1, {
    workerPath: chrome.runtime.getURL("vendor/tesseract/worker.min.js"),
    corePath: chrome.runtime.getURL("vendor/tesseract-core/"),
    langPath: chrome.runtime.getURL("vendor/tessdata/"),
    workerBlobURL: false,
    gzip: true,
    cacheMethod: "none",
  }).then(async (worker) => (await worker.setParameters(OCR_PARAMS), worker));
  w.catch(() => ocrWorkers.delete(lang));
  ocrWorkers.set(lang, w);
  return w;
}

function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!embedder) {
    env.allowLocalModels = false;
    const wasm = env.backends.onnx.wasm;
    if (wasm) wasm.wasmPaths = chrome.runtime.getURL("vendor/ort/");
    embedder = pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: "q8" }) as Promise<FeatureExtractionPipeline>;
  }
  return embedder;
}

async function ocr(dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const { text } = await readImage(blob, getOcr);
  // Lines in an image are usually one sentence wrapped to fit: check them as one text, so a
  // wrapped half of a hadith is not matched on its own against an unrelated verse.
  return text.replace(/\s*\n\s*/g, " ").trim();
}

/** Unit-length embedding of the post text, comparable with the precomputed ayah embeddings. */
async function embed(text: string): Promise<number[]> {
  const model = await getEmbedder();
  // e5 models expect this prefix on search text.
  const out = await model(`query: ${text}`, { pooling: "mean", normalize: true });
  return (out.tolist() as number[][])[0]!;
}

chrome.runtime.onMessage.addListener((msg: OffscreenRequest | { target?: string }, _sender, sendResponse) => {
  if (msg.target !== "offscreen") return false;
  const m = msg as OffscreenRequest;
  const job = m.type === "ocr" ? ocr(m.dataUrl) : embed(m.text);
  job
    .then((value) => sendResponse({ ok: true, value }))
    .catch((e) => sendResponse({ ok: false, error: String(e) }));
  return true;
});
