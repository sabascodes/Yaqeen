import { containment, locate, ngrams } from "./align";
import { skeleton } from "./normalize";
import type { Ayah } from "./types";

const GRAM = 4;
const MIN_QUERY = 12; // skeleton letters (~4 words): shorter fragments are too ambiguous
const MIN_AYAH_IN_FRAGMENT = 10;
const MAX_CANDIDATES = 15;

export interface QuranHit {
  similarity: number;
  /** Ayat covered by the matched span (one or more consecutive ayat). */
  ayat: Ayah[];
  /** Other places with an equally good match (repeated ayat such as in Ar-Rahman). */
  alsoAt: Ayah[];
}

export class QuranIndex {
  private readonly ayat: Ayah[];
  private readonly skeletons: string[];
  private readonly offsets: number[]; // start of each ayah in `corpus`
  private readonly corpus: string;
  private readonly grams = new Map<string, number[]>();

  constructor(ayat: Ayah[]) {
    this.ayat = ayat;
    this.skeletons = ayat.map((a) => skeleton(a.text));
    this.offsets = [];
    let pos = 0;
    for (const s of this.skeletons) {
      this.offsets.push(pos);
      pos += s.length;
    }
    this.corpus = this.skeletons.join("");
    this.skeletons.forEach((s, idx) => {
      for (const g of ngrams(s, GRAM)) {
        let list = this.grams.get(g);
        if (!list) this.grams.set(g, (list = []));
        list.push(idx);
      }
    });
  }

  get size(): number {
    return this.ayat.length;
  }

  /** Best match for a fragment of a post, or null when nothing is close. */
  search(fragment: string): QuranHit | null {
    const q = skeleton(fragment);
    if (q.length < MIN_QUERY) return null;

    const hits = new Map<number, number>();
    for (const g of ngrams(q, GRAM)) {
      for (const idx of this.grams.get(g) ?? []) hits.set(idx, (hits.get(idx) ?? 0) + 1);
    }
    const candidates = [...hits.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CANDIDATES)
      .map(([idx]) => idx);

    const scored: { similarity: number; first: number; last: number }[] = [];
    for (const c of candidates) {
      // (1) The fragment is (part of) the Quran text: align it inside a window of nearby ayat.
      const lo = Math.max(0, c - 2);
      const hi = Math.min(this.ayat.length - 1, c + 3);
      const winStart = this.offsets[lo]!;
      const winEnd = this.offsets[hi]! + this.skeletons[hi]!.length;
      const loc = locate(q, this.corpus.slice(winStart, winEnd));
      const span = this.coveredAyat(winStart + loc.start, winStart + loc.end, lo, hi);
      if (span) scored.push({ similarity: 1 - loc.distance / q.length, ...span });

      // (2) The fragment contains a whole ayah plus other words around it.
      const s = this.skeletons[c]!;
      if (s.length >= MIN_AYAH_IN_FRAGMENT) {
        scored.push(this.extend(q, c, containment(s, q)));
      }
    }
    if (!scored.length) return null;

    scored.sort((a, b) => b.similarity - a.similarity || a.first - b.first);
    const best = scored[0]!;
    const seen = new Set<number>([best.first]);
    const alsoAt: Ayah[] = [];
    for (const s of scored.slice(1)) {
      if (best.similarity - s.similarity > 0.005 || seen.has(s.first)) continue;
      if (s.first >= best.first && s.first <= best.last) continue;
      seen.add(s.first);
      alsoAt.push(this.ayat[s.first]!);
    }
    return {
      similarity: Math.max(0, best.similarity),
      ayat: this.ayat.slice(best.first, best.last + 1),
      alsoAt,
    };
  }

  /** Grows a whole-ayah match to the neighbouring ayat the fragment also quotes. */
  private extend(q: string, c: number, sim: number) {
    let first = c;
    let last = c;
    if (sim < 0.9) return { similarity: sim, first, last };
    const sura = this.ayat[c]!.sura;
    let current = sim;
    // Accept a neighbour only if the fragment quotes it as faithfully as what is matched so far.
    const grow = (from: number, to: number) => {
      if (this.ayat[from]!.sura !== sura || this.ayat[to]!.sura !== sura) return false;
      const s = containment(this.skeletons.slice(from, to + 1).join(""), q);
      if (s < current - 0.02) return false;
      current = s;
      return true;
    };
    for (;;) {
      if (last + 1 < this.ayat.length && grow(first, last + 1)) last++;
      else if (first > 0 && grow(first - 1, last)) first--;
      else break;
    }
    return { similarity: current, first, last };
  }

  private coveredAyat(start: number, end: number, lo: number, hi: number) {
    let first = -1;
    let last = -1;
    for (let i = lo; i <= hi; i++) {
      const aStart = this.offsets[i]!;
      const aEnd = aStart + this.skeletons[i]!.length;
      const overlap = Math.min(end, aEnd) - Math.max(start, aStart);
      // Ignore a neighbour touched by only a few letters at the edge of the match.
      if (overlap >= Math.min(5, Math.ceil((aEnd - aStart) / 2))) {
        if (first < 0) first = i;
        last = i;
      }
    }
    return first < 0 ? null : { first, last };
  }
}
