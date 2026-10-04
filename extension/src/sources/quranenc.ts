/**
 * Quran text and approved translation of meanings from QuranEnc (quranenc.com),
 * listed in the approved references file (King Fahd Complex Mushaf text).
 */
import type { Ayah } from "../core/types";

export const QURANENC_API = "https://quranenc.com/api/v1";
/** Approved English translation used for the English UI. */
export const DEFAULT_TRANSLATION = "english_saheeh";
export const SURA_COUNT = 114;

interface QuranEncRow {
  sura: string | number;
  aya: string | number;
  arabic_text: string;
  translation?: string;
}

export function parseSura(json: { result?: QuranEncRow[] }): Ayah[] {
  return (json.result ?? []).map((r) => ({
    sura: Number(r.sura),
    aya: Number(r.aya),
    text: r.arabic_text,
    translation: r.translation,
  }));
}

export async function fetchSura(
  sura: number,
  translation = DEFAULT_TRANSLATION,
  fetchImpl: typeof fetch = fetch,
): Promise<Ayah[]> {
  const res = await fetchImpl(`${QURANENC_API}/translation/sura/${translation}/${sura}`, { credentials: "omit" });
  if (!res.ok) throw new Error(`QuranEnc sura ${sura}: ${res.status}`);
  return parseSura(await res.json());
}

export async function fetchWholeQuran(
  onProgress?: (done: number, total: number) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<Ayah[]> {
  const all: Ayah[] = [];
  for (let s = 1; s <= SURA_COUNT; s++) {
    all.push(...(await fetchSura(s, DEFAULT_TRANSLATION, fetchImpl)));
    onProgress?.(s, SURA_COUNT);
  }
  return all;
}

export function quranEncUrl(sura: number, aya: number): string {
  return `https://quranenc.com/ar/browse/${DEFAULT_TRANSLATION}/${sura}#${aya}`;
}
