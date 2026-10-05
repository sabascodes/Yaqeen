/**
 * Background service worker: holds the local indexes, runs checks, and talks to
 * the approved sources. The only network calls are to the sources in the
 * approved references file (and the embedding model download).
 */
import { checkPost, type CheckResult } from "../core/checker";
import { HadithIndex } from "../core/hadithIndex";
import { QuranIndex } from "../core/quranIndex";
import type { Ayah, EncHadith } from "../core/types";
import { searchDorar } from "../sources/dorar";
import { fetchAllHadith } from "../sources/hadeethenc";
import { fetchWholeQuran } from "../sources/quranenc";
import type { CheckResponse, DataStatus, OffscreenRequest, Request } from "../shared/messages";
import { loadSettings, resolveLang } from "../shared/settings";
import * as store from "../shared/store";

let quran: QuranIndex | null = null;
let hadith: HadithIndex | null = null;
let loading: Promise<void> | null = null;
const status: DataStatus = { quranAyat: 0, hadithCount: 0, syncing: false };

async function loadIndexes(): Promise<void> {
  if (quran || hadith) return;
  loading ??= (async () => {
    const [ayat, ahadith, syncedAt] = await Promise.all([
      store.get<Ayah[]>("quran"),
      store.get<EncHadith[]>("hadeethenc"),
      store.get<string>("syncedAt"),
    ]);
    if (ayat?.length) quran = new QuranIndex(ayat);
    if (ahadith?.length) hadith = new HadithIndex(ahadith);
    status.quranAyat = quran?.size ?? 0;
    status.hadithCount = hadith?.size ?? 0;
    status.syncedAt = syncedAt;
  })().finally(() => (loading = null));
  return loading;
}

async function sync(): Promise<void> {
  if (status.syncing) return;
  status.syncing = true;
  status.error = undefined;
  try {
    const ayat = await fetchWholeQuran((done, total) => (status.progress = { step: "quran", done, total }));
    await store.set("quran", ayat);
    quran = new QuranIndex(ayat);
    status.quranAyat = quran.size;

    const ahadith = await fetchAllHadith((done, total) => (status.progress = { step: "hadith", done, total }));
    await store.set("hadeethenc", ahadith);
    hadith = new HadithIndex(ahadith);
    status.hadithCount = hadith.size;

    status.syncedAt = new Date().toISOString();
    await store.set("syncedAt", status.syncedAt);
  } catch (e) {
    status.error = String(e);
  } finally {
    status.syncing = false;
    status.progress = undefined;
  }
}

// ---------- Offscreen document (OCR + embeddings run there: they need DOM/WASM workers) ----------

const OFFSCREEN_URL = "offscreen.html";

async function ensureOffscreen(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  if (contexts.length) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: [chrome.offscreen.Reason.WORKERS, chrome.offscreen.Reason.BLOBS],
    justification: "Runs on-device OCR and the text embedding model.",
  });
}

async function offscreen<T>(msg: OffscreenRequest): Promise<T> {
  await ensureOffscreen();
  const res = (await chrome.runtime.sendMessage(msg)) as { ok: boolean; value?: T; error?: string };
  if (!res?.ok) throw new Error(res?.error ?? "offscreen failed");
  return res.value as T;
}

async function imageToDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error(`image ${res.status}`);
  const blob = await res.blob();
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${blob.type || "image/png"};base64,${btoa(bin)}`;
}

// ---------- Semantic search over all ayat ----------

/**
 * Ayah embeddings from multilingual-e5-base, shipped with the extension as int8 rows
 * (built from backend/data/quran_embeddings.npy). Layout: rows u32, dims u32,
 * one f32 scale per row, then rows*dims i8 values. Rows are in mushaf order.
 */
interface AyahVectors {
  rows: number;
  dims: number;
  scales: Float32Array;
  data: Int8Array;
}
let vectors: Promise<AyahVectors | null> | null = null;

function loadVectors(): Promise<AyahVectors | null> {
  vectors ??= fetch(chrome.runtime.getURL("data/quran-e5.bin"))
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((buf) => {
      if (!buf) return null;
      const [rows, dims] = new Uint32Array(buf, 0, 2) as unknown as [number, number];
      return {
        rows,
        dims,
        scales: new Float32Array(buf, 8, rows),
        data: new Int8Array(buf, 8 + rows * 4, rows * dims),
      };
    })
    .catch(() => null);
  return vectors;
}

async function semanticSearch(text: string, k = 10): Promise<{ index: number; score: number }[]> {
  const v = await loadVectors();
  // Only usable when the rows line up with the downloaded mushaf text.
  if (!v || !quran || v.rows !== quran.size) return [];
  const q = await offscreen<number[]>({ target: "offscreen", type: "embed", text });
  if (q.length !== v.dims) return [];
  const top: { index: number; score: number }[] = [];
  for (let r = 0; r < v.rows; r++) {
    let dot = 0;
    const off = r * v.dims;
    for (let d = 0; d < v.dims; d++) dot += v.data[off + d]! * q[d]!;
    const score = dot * v.scales[r]!;
    if (top.length < k || score > top[top.length - 1]!.score) {
      top.push({ index: r, score });
      top.sort((a, b) => b.score - a.score);
      if (top.length > k) top.pop();
    }
  }
  return top;
}

// ---------- Checks ----------

const cache = new Map<string, CheckResult>();
const CACHE_MAX = 500;

async function check(text: string, manual = false): Promise<CheckResult> {
  const key = `${manual ? 1 : 0}:${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  await loadIndexes();
  const settings = await loadSettings();
  const result = await checkPost(text, {
    quran,
    hadith,
    lang: resolveLang(settings.lang),
    dorar: settings.dorarOnline ? (q) => searchDorar(q) : undefined,
    semanticSearch: settings.semantic && quran ? semanticSearch : undefined,
  }, manual);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}

chrome.runtime.onMessage.addListener((msg: Request | OffscreenRequest, _sender, sendResponse) => {
  if ("target" in msg) return false; // meant for the offscreen document
  (async () => {
    switch (msg.type) {
      case "check":
        return { ok: true, result: await check(msg.text, msg.manual) } satisfies CheckResponse;
      case "ocr": {
        const dataUrl = await imageToDataUrl(msg.imageUrl);
        const text = await offscreen<string>({ target: "offscreen", type: "ocr", dataUrl });
        return { ok: true, result: await check(text, true), ocrText: text } satisfies CheckResponse;
      }
      case "status":
        await loadIndexes();
        return status;
      case "sync":
        void sync();
        return status;
    }
  })()
    .then(sendResponse)
    .catch((e) => sendResponse({ ok: false, error: String(e) } satisfies CheckResponse));
  return true;
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    // The first download needs the user's go-ahead on the settings page (privacy notice is there).
    await chrome.runtime.openOptionsPage();
  }
});
