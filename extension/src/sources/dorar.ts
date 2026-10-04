/**
 * Dorar hadith encyclopedia (الدرر السنية) - listed in the approved references
 * file as the hadith search API (dorar.net/article/389).
 *
 * Only the extracted hadith text is sent; nothing about the user or the page.
 */
import type { DorarHadith } from "../core/types";

export const DORAR_API = "https://dorar.net/dorar_api.json";
export const DORAR_SEARCH_PAGE = "https://dorar.net/hadith/search";

const MAX_QUERY_WORDS = 12;

const FIELDS: [keyof DorarHadith, string][] = [
  ["narrator", "الراوي"],
  ["scholar", "المحدث"],
  ["book", "المصدر"],
  ["pageOrNumber", "الصفحة أو الرقم"],
  ["ruling", "خلاصة حكم المحدث"],
];

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parses the HTML fragment Dorar returns in `ahadith.result`. */
export function parseDorarHtml(html: string): DorarHadith[] {
  const out: DorarHadith[] = [];
  const blocks = html.split(/<div[^>]*class="hadith"[^>]*>/i).slice(1);
  for (const block of blocks) {
    const [textPart, ...rest] = block.split(/<div[^>]*class="hadith-info"[^>]*>/i);
    const info = stripTags(rest.join(" "));
    const text = stripTags(textPart ?? "").replace(/^\d+\s*-\s*/, "");
    const row: DorarHadith = { text, narrator: "", scholar: "", book: "", pageOrNumber: "", ruling: "" };
    FIELDS.forEach(([key, label], i) => {
      const next = FIELDS.slice(i + 1).map(([, l]) => l);
      const stop = next.length ? `(?=${next.join("|")}\\s*:|$)` : "$";
      const m = info.match(new RegExp(`${label}\\s*:\\s*(.*?)\\s*-?\\s*${stop}`));
      if (m?.[1]) row[key] = m[1].trim().replace(/\s*-$/, "");
    });
    if (row.text) out.push(row);
  }
  return out;
}

export function dorarQuery(text: string): string {
  return text.split(/\s+/).filter(Boolean).slice(0, MAX_QUERY_WORDS).join(" ");
}

export function dorarSearchUrl(text: string): string {
  return `${DORAR_SEARCH_PAGE}?q=${encodeURIComponent(dorarQuery(text))}`;
}

export async function searchDorar(text: string, fetchImpl: typeof fetch = fetch): Promise<DorarHadith[]> {
  const url = `${DORAR_API}?skey=${encodeURIComponent(dorarQuery(text))}`;
  const res = await fetchImpl(url, { credentials: "omit", referrerPolicy: "no-referrer" });
  if (!res.ok) throw new Error(`Dorar ${res.status}`);
  return parseDorarHtml(dorarResultHtml(await res.json()));
}

/** The API returns either `{ahadith: {result: html}}` or `{ahadith: [{th: html}, ...]}`. */
export function dorarResultHtml(json: unknown): string {
  const ah = (json as { ahadith?: unknown })?.ahadith;
  if (Array.isArray(ah)) return ah.map((i: { th?: string }) => i?.th ?? "").join("");
  return (ah as { result?: string } | undefined)?.result ?? "";
}
