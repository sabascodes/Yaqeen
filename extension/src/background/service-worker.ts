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
  status.failed = undefined;
  // The browser stops an idle service worker after about 30 seconds; calling an extension
  // API regularly keeps it running for the length of the download.
  const keepAlive = setInterval(() => void chrome.runtime.getPlatformInfo(), 20_000);
  try {
    await store.set("syncPending", true);
    // A download that was interrupted (browser closed) resumes: the Quran is kept if complete,
    // and hadith already downloaded are not fetched again.
    const partial = (await store.get<EncHadith[]>("hadeethencPartial")) ?? [];
    const storedAyat = partial.length ? await store.get<Ayah[]>("quran") : undefined;
    let ayat = storedAyat?.length === 6236 ? storedAyat : undefined;
    if (!ayat) {
      ayat = await fetchWholeQuran((done, total) => (status.progress = { step: "quran", done, total }));
      await store.set("quran", ayat);
    }
    quran = new QuranIndex(ayat);
    status.quranAyat = quran.size;

    const { items, failed } = await fetchAllHadith({
      have: partial,
      onProgress: (done, total) => (status.progress = { step: "hadith", done, total }),
      onBatch: (so) => store.set("hadeethencPartial", so),
    });
    await store.set("hadeethenc", items);
    await store.set("hadeethencPartial", []);
    hadith = new HadithIndex(items);
    status.hadithCount = hadith.size;
    status.failed = failed || undefined;

    status.syncedAt = new Date().toISOString();
    await store.set("syncedAt", status.syncedAt);
    await store.set("syncPending", false);
  } catch (e) {
    status.error = String(e);
    await store.set("syncPending", false);
  } finally {
    clearInterval(keepAlive);
    status.syncing = false;
    status.progress = undefined;
  }
}

// Resume a download that was interrupted when the browser or the service worker stopped.
void store.get<boolean>("syncPending").then((pending) => {
  if (pending) void sync();
});

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

// ---------- Semantic search (ayat and HadeethEnc hadith) ----------

/**
 * Embeddings from multilingual-e5-base, shipped with the extension as int8 rows (built from
 * backend/data/quran_embeddings.npy and hadith_embeddings.npy). Layout: rows u32, dims u32,
 * one f32 scale per row, then rows*dims i8 values. Quran rows are in mushaf order; hadith
 * rows follow data/hadith-e5-ids.json.
 */
interface Vectors {
  rows: number;
  dims: number;
  scales: Float32Array;
  data: Int8Array;
}
type Near = { index: number; score: number }[];
const vectorFiles = new Map<string, Promise<Vectors | null>>();

function loadVectors(file: string): Promise<Vectors | null> {
  let v = vectorFiles.get(file);
  if (!v) {
    v = fetch(chrome.runtime.getURL(file))
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((buf) => {
        if (!buf) return null;
        const [rows, dims] = new Uint32Array(buf, 0, 2) as unknown as [number, number];
        return { rows, dims, scales: new Float32Array(buf, 8, rows), data: new Int8Array(buf, 8 + rows * 4, rows * dims) };
      })
      .catch(() => null);
    vectorFiles.set(file, v);
  }
  return v;
}

let hadithRowIds: Promise<string[] | null> | null = null;
function loadHadithRowIds(): Promise<string[] | null> {
  hadithRowIds ??= fetch(chrome.runtime.getURL("data/hadith-e5-ids.json"))
    .then((r) => (r.ok ? (r.json() as Promise<string[]>) : null))
    .catch(() => null);
  return hadithRowIds;
}

/** Rows most similar to the text; `position` maps a row to the local index (-1 to skip it). */
async function nearest(v: Vectors, text: string, position: (row: number) => number, k = 10): Promise<Near> {
  const q = await offscreen<number[]>({ target: "offscreen", type: "embed", text });
  if (q.length !== v.dims) return [];
  const top: Near = [];
  for (let r = 0; r < v.rows; r++) {
    let dot = 0;
    const off = r * v.dims;
    for (let d = 0; d < v.dims; d++) dot += v.data[off + d]! * q[d]!;
    const score = dot * v.scales[r]!;
    if (top.length < k || score > top[top.length - 1]!.score) {
      const index = position(r);
      if (index < 0) continue;
      top.push({ index, score });
      top.sort((a, b) => b.score - a.score);
      if (top.length > k) top.pop();
    }
  }
  return top;
}

async function quranSemanticSearch(text: string): Promise<Near> {
  const v = await loadVectors("data/quran-e5.bin");
  // Only usable when the rows line up with the downloaded mushaf text.
  if (!v || !quran || v.rows !== quran.size) return [];
  return nearest(v, text, (r) => r);
}

async function hadithSemanticSearch(text: string): Promise<Near> {
  const [v, ids] = await Promise.all([loadVectors("data/hadith-e5.bin"), loadHadithRowIds()]);
  if (!v || !ids || ids.length !== v.rows || !hadith) return [];
  // Matched by HadeethEnc id, since the downloaded set can differ from the one embedded.
  const index = hadith;
  return nearest(v, text, (r) => index.positionOf(ids[r]!));
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
    semanticSearch: settings.semantic && quran ? quranSemanticSearch : undefined,
    hadithSemanticSearch: settings.semantic && hadith ? hadithSemanticSearch : undefined,
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
