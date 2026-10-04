/**
 * Offscreen document: on-device OCR (Tesseract, Arabic + English) and the
 * multilingual embedding model. Images and text never leave the device here.
 */
import { createWorker, type Worker } from "tesseract.js";
import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import type { OffscreenRequest } from "../shared/messages";

const EMBEDDING_MODEL = "Xenova/multilingual-e5-small";

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
  return data.text;
}

/** Cosine similarity of the query to each candidate (vectors are normalized). */
async function embedSim(query: string, candidates: string[]): Promise<number[]> {
  const model = await getEmbedder();
  // e5 models expect these prefixes.
  const out = await model([`query: ${query}`, ...candidates.map((c) => `passage: ${c}`)], {
    pooling: "mean",
    normalize: true,
  });
  const vectors = out.tolist() as number[][];
  const q = vectors[0]!;
  return vectors.slice(1).map((v) => v.reduce((s, x, i) => s + x * q[i]!, 0));
}

chrome.runtime.onMessage.addListener((msg: OffscreenRequest | { target?: string }, _sender, sendResponse) => {
  if (msg.target !== "offscreen") return false;
  const m = msg as OffscreenRequest;
  const job = m.type === "ocr" ? ocr(m.dataUrl) : embedSim(m.query, m.candidates);
  job
    .then((value) => sendResponse({ ok: true, value }))
    .catch((e) => sendResponse({ ok: false, error: String(e) }));
  return true;
});
