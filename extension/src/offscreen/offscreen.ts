/**
 * Offscreen document: on-device OCR (Tesseract, Arabic + English) and the
 * multilingual embedding model. Images and text never leave the device here.
 */
import { createWorker, type Worker } from "tesseract.js";
import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import type { OffscreenRequest } from "../shared/messages";

// Same model that produced the ayah embeddings (backend/data/quran_embeddings.npy), as ONNX.
const EMBEDDING_MODEL = "Xenova/multilingual-e5-base";

let ocrWorker: Promise<Worker> | null = null;
let embedder: Promise<FeatureExtractionPipeline> | null = null;

function getOcr(): Promise<Worker> {
  ocrWorker ??= createWorker(["ara", "eng"], 1, {
    workerPath: chrome.runtime.getURL("vendor/tesseract/worker.min.js"),
    corePath: chrome.runtime.getURL("vendor/tesseract-core/"),
    langPath: chrome.runtime.getURL("vendor/tessdata/"),
    workerBlobURL: false,
    gzip: true,
    cacheMethod: "none",
  });
  return ocrWorker;
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
  const worker = await getOcr();
  const { data } = await worker.recognize(dataUrl);
  // Lines in an image are usually one sentence wrapped to fit: check them as one text, so a
  // wrapped half of a hadith is not matched on its own against an unrelated verse.
  return data.text.replace(/\s*\n\s*/g, " ").trim();
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
