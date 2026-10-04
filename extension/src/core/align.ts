/**
 * Approximate substring matching (Sellers' algorithm): finds the substring of
 * `text` with the smallest edit distance to `pattern`.
 */

export interface Location {
  distance: number;
  start: number; // inclusive, index in text
  end: number; // exclusive, index in text
}

function bestEnd(pattern: string, text: string): { distance: number; end: number } {
  const m = pattern.length;
  let prev = new Int32Array(m + 1);
  let cur = new Int32Array(m + 1);
  for (let i = 0; i <= m; i++) prev[i] = i;
  let best = prev[m]!;
  let bestEndIdx = 0;
  for (let j = 1; j <= text.length; j++) {
    cur[0] = 0; // a match may start anywhere in text
    const tc = text.charCodeAt(j - 1);
    for (let i = 1; i <= m; i++) {
      const cost = pattern.charCodeAt(i - 1) === tc ? 0 : 1;
      const sub = prev[i - 1]! + cost;
      const del = prev[i]! + 1;
      const ins = cur[i - 1]! + 1;
      cur[i] = sub < del ? (sub < ins ? sub : ins) : del < ins ? del : ins;
    }
    if (cur[m]! < best) {
      best = cur[m]!;
      bestEndIdx = j;
    }
    [prev, cur] = [cur, prev];
  }
  return { distance: best, end: bestEndIdx };
}

const reverse = (s: string) => Array.from(s).reverse().join("");

export function locate(pattern: string, text: string): Location {
  if (!pattern) return { distance: 0, start: 0, end: 0 };
  const { distance, end } = bestEnd(pattern, text);
  // Run backwards from the best end to recover where the match starts.
  const back = bestEnd(reverse(pattern), reverse(text.slice(0, end)));
  return { distance, start: end - back.end, end };
}

/** 1 = pattern appears verbatim inside text, 0 = nothing in common. */
export function containment(pattern: string, text: string): number {
  if (!pattern.length) return 0;
  return Math.max(0, 1 - locate(pattern, text).distance / pattern.length);
}

/** Symmetric similarity of two whole strings (normalized Levenshtein). */
export function similarity(a: string, b: string): number {
  const longer = Math.max(a.length, b.length);
  if (!longer) return 1;
  const m = a.length;
  let prev = new Int32Array(m + 1);
  let cur = new Int32Array(m + 1);
  for (let i = 0; i <= m; i++) prev[i] = i;
  for (let j = 1; j <= b.length; j++) {
    cur[0] = j;
    const bc = b.charCodeAt(j - 1);
    for (let i = 1; i <= m; i++) {
      const cost = a.charCodeAt(i - 1) === bc ? 0 : 1;
      cur[i] = Math.min(prev[i - 1]! + cost, prev[i]! + 1, cur[i - 1]! + 1);
    }
    [prev, cur] = [cur, prev];
  }
  return 1 - prev[m]! / longer;
}

/** Character n-grams, used for fast candidate retrieval before alignment. */
export function ngrams(s: string, n = 4): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + n <= s.length; i++) out.add(s.slice(i, i + n));
  return out;
}
