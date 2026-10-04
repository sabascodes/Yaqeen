/**
 * Finds the parts of a post that may be religious text, before any matching.
 * Quran matching runs locally on every Arabic fragment; hadith lookups that
 * leave the device run only on fragments that look like a hadith.
 */
import { arabicLength, normalizeArabic } from "./normalize";

export interface Fragment {
  text: string;
  /** Fragment is introduced or framed like a hadith. */
  hadithLike: boolean;
  /** Fragment is framed like a Quran quote (﴿ ﴾ or "قال تعالى"). */
  quranLike: boolean;
}

const HADITH_MARKERS = [
  "قال رسول الله",
  "قال النبي",
  "عن النبي",
  "عن رسول الله",
  "ان رسول الله",
  "ان النبي",
  "صلي الله عليه وسلم",
  "عليه الصلاه والسلام",
  "حديث",
  "قال صلي الله",
  "رواه البخاري",
  "رواه مسلم",
  "متفق عليه",
  "رواه",
];
const QURAN_MARKERS = ["قال تعالي", "قال الله تعالي", "قوله تعالي", "بسم الله الرحمن الرحيم", "صدق الله العظيم"];

// Phrases that introduce a quote; removed so the quote itself is matched.
const LEAD_INS = [
  /^.*?(قال|يقول) (رسول الله|النبي)( صلي الله عليه وسلم)?/,
  /^.*?(قال|يقول) (الله )?تعالي/,
  /^.*?عن (رسول الله|النبي)( صلي الله عليه وسلم)?( انه)?( قال)?/,
];
const TAILS = [/(صدق الله العظيم|رواه .*|متفق عليه.*|اخرجه .*)$/];

const MIN_LETTERS = 12;

export function looksArabic(text: string): boolean {
  return arabicLength(text) >= MIN_LETTERS;
}

function hasAny(text: string, markers: string[]): boolean {
  const n = normalizeArabic(text);
  return markers.some((m) => n.includes(m));
}

/** Text between ﴿ ﴾, Arabic or Latin quotes. */
function quoted(text: string): string[] {
  const out: string[] = [];
  const re = /﴿([^﴾]+)﴾|«([^»]+)»|“([^”]+)”|"([^"]+)"/g;
  for (const m of text.matchAll(re)) {
    const inner = m[1] ?? m[2] ?? m[3] ?? m[4];
    if (inner) out.push(inner);
  }
  return out;
}

/** Removes lead-ins such as "قال رسول الله ﷺ:" and tails such as "رواه البخاري". */
export function stripFraming(text: string): string {
  let n = normalizeArabic(text);
  for (const re of LEAD_INS) n = n.replace(re, "");
  for (const re of TAILS) n = n.replace(re, "");
  return n.trim();
}

/**
 * Same as stripFraming, but returns the post's own wording (original spelling and
 * punctuation) so an online search receives the text as the user wrote it.
 */
export function stripFramingOriginal(text: string): string {
  const core = stripFraming(text).split(" ").filter(Boolean);
  if (!core.length) return "";
  const words = text.replace(/\uFDFA/g, " ").split(/\s+/).filter(Boolean);
  const norm = words.map((w) => normalizeArabic(w));
  const first = core[0]!;
  const last = core[core.length - 1]!;
  let start = norm.findIndex((w, i) => w === first && (core.length < 2 || norm.slice(i + 1).find(Boolean) === core[1]));
  if (start < 0) start = 0;
  let end = -1;
  for (let i = norm.length - 1; i >= start; i--) if (norm[i] === last) { end = i; break; }
  if (end < 0) end = words.length - 1;
  return words.slice(start, end + 1).join(" ").replace(/^[«"“﴿(\[]+|[»"”﴾)\].،:]+$/g, "").trim();
}

export function extractFragments(postText: string): Fragment[] {
  const text = postText.replace(/ﷺ/g, " صلى الله عليه وسلم ");
  const postHadith = hasAny(text, HADITH_MARKERS);
  const postQuran = hasAny(text, QURAN_MARKERS) || text.includes("﴿");

  const pieces = new Set<string>();
  const quotes = new Set(quoted(text));
  for (const q of quotes) pieces.add(q);
  // Paragraphs, then the whole post (a quote can span several lines).
  for (const p of text.split(/\n+/)) pieces.add(p);
  pieces.add(text);

  const out: Fragment[] = [];
  const seen = new Set<string>();
  for (const piece of pieces) {
    if (!looksArabic(piece)) continue;
    const key = normalizeArabic(piece);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      text: piece.trim(),
      // Only quotes and pieces that carry a hadith marker themselves may go to an online lookup,
      // so unrelated lines of the post (greetings, hashtags) never leave the device.
      hadithLike: postHadith && (quotes.has(piece) || hasAny(piece, HADITH_MARKERS)),
      quranLike: postQuran || piece.includes("﴿"),
    });
  }
  return out;
}
