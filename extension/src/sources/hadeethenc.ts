/**
 * HadeethEnc (موسوعة الأحاديث النبوية, hadeethenc.com) - listed in the approved
 * references file. Contains authentic hadith only, each with grade and attribution.
 * Downloaded once and matched locally on the device.
 */
import type { EncHadith } from "../core/types";

export const HADEETHENC_API = "https://hadeethenc.com/api/v1";

interface Category {
  id: string;
}
interface ListPage {
  data: { id: string }[];
  meta: { current_page: string | number; last_page: string | number };
}
interface OneHadith {
  id: string;
  hadeeth: string;
  attribution: string;
  grade: string;
}

async function getJson<T>(url: string, fetchImpl: typeof fetch): Promise<T> {
  const res = await fetchImpl(url, { credentials: "omit" });
  if (!res.ok) throw new Error(`HadeethEnc ${res.status}: ${url}`);
  return (await res.json()) as T;
}

export function parseOne(json: OneHadith, translation?: string): EncHadith {
  return {
    id: String(json.id),
    text: json.hadeeth,
    grade: json.grade,
    attribution: json.attribution,
    translation,
  };
}

export async function listAllIds(fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const cats = await getJson<Category[]>(`${HADEETHENC_API}/categories/list/?language=ar`, fetchImpl);
  const ids = new Set<string>();
  for (const cat of cats) {
    let page = 1;
    let last = 1;
    do {
      const p = await getJson<ListPage>(
        `${HADEETHENC_API}/hadeeths/list/?language=ar&category_id=${cat.id}&page=${page}&per_page=100`,
        fetchImpl,
      );
      p.data.forEach((h) => ids.add(String(h.id)));
      last = Number(p.meta.last_page);
      page++;
    } while (page <= last);
  }
  return [...ids];
}

export async function fetchHadith(id: string, fetchImpl: typeof fetch = fetch): Promise<EncHadith> {
  const ar = await getJson<OneHadith>(`${HADEETHENC_API}/hadeeths/one/?language=ar&id=${id}`, fetchImpl);
  let translation: string | undefined;
  try {
    const en = await getJson<OneHadith>(`${HADEETHENC_API}/hadeeths/one/?language=en&id=${id}`, fetchImpl);
    translation = en.hadeeth;
  } catch {
    // English is optional; the Arabic record is what the verdict relies on.
  }
  return parseOne(ar, translation);
}

/**
 * Downloads every hadith not already in `have`. `onBatch` receives the records downloaded so
 * far (every `batchSize`), so an interrupted download can resume. A record that still fails
 * after one retry is skipped and counted, instead of failing the whole download.
 */
export async function fetchAllHadith(
  opts: {
    have?: EncHadith[];
    onProgress?: (done: number, total: number) => void;
    onBatch?: (items: EncHadith[]) => Promise<void>;
    batchSize?: number;
    concurrency?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<{ items: EncHadith[]; failed: number }> {
  const { onProgress, onBatch, batchSize = 100, concurrency = 4, fetchImpl = fetch } = opts;
  const ids = await listAllIds(fetchImpl);
  const wanted = new Set(ids);
  const out = (opts.have ?? []).filter((h) => wanted.has(String(h.id)));
  const done = new Set(out.map((h) => String(h.id)));
  const todo = ids.filter((id) => !done.has(id));
  let failed = 0;
  let next = 0;
  let sinceBatch = 0;
  onProgress?.(out.length, ids.length);
  const worker = async () => {
    while (next < todo.length) {
      const id = todo[next++]!;
      const h = await fetchHadith(id, fetchImpl).catch(() => fetchHadith(id, fetchImpl)).catch(() => null);
      if (h) out.push(h);
      else failed++;
      onProgress?.(out.length + failed, ids.length);
      if (onBatch && ++sinceBatch >= batchSize) {
        sinceBatch = 0;
        await onBatch(out.slice());
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { items: out, failed };
}

export function hadeethEncUrl(id: string, lang: "ar" | "en" = "ar"): string {
  return `https://hadeethenc.com/${lang}/browse/hadith/${id}`;
}
