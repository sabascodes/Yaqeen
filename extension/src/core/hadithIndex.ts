import { containment, ngrams } from "./align";
import { skeleton } from "./normalize";
import type { EncHadith } from "./types";

const GRAM = 4;
const MIN_QUERY = 12;
const MAX_CANDIDATES = 10;

export interface HadithHit {
  similarity: number;
  hadith: EncHadith;
  /** Position of the hadith in the index. */
  index: number;
}

/** Local index over HadeethEnc hadith, matched on device. */
export class HadithIndex {
  private readonly items: EncHadith[];
  private readonly skeletons: string[];
  private readonly grams = new Map<string, number[]>();
  private readonly byId = new Map<string, number>();

  constructor(items: EncHadith[]) {
    this.items = items;
    this.skeletons = items.map((h) => skeleton(h.text));
    items.forEach((h, idx) => this.byId.set(String(h.id), idx));
    this.skeletons.forEach((s, idx) => {
      for (const g of ngrams(s, GRAM)) {
        let list = this.grams.get(g);
        if (!list) this.grams.set(g, (list = []));
        list.push(idx);
      }
    });
  }

  get size(): number {
    return this.items.length;
  }

  /** Position of a HadeethEnc id in this index, or -1 when it was not downloaded. */
  positionOf(id: string): number {
    return this.byId.get(String(id)) ?? -1;
  }

  /** Similarity of the fragment to the hadith at `index` (e.g. one found by the semantic search). */
  at(fragment: string, index: number): HadithHit | null {
    const item = this.items[index];
    if (!item) return null;
    return { similarity: containment(skeleton(fragment), this.skeletons[index]!), hadith: item, index };
  }

  search(fragment: string): HadithHit | null {
    const q = skeleton(fragment);
    if (q.length < MIN_QUERY) return null;
    const hits = new Map<number, number>();
    for (const g of ngrams(q, GRAM)) {
      for (const idx of this.grams.get(g) ?? []) hits.set(idx, (hits.get(idx) ?? 0) + 1);
    }
    let best: HadithHit | null = null;
    const candidates = [...hits.entries()]
      .filter(([, n]) => n >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CANDIDATES);
    for (const [idx] of candidates) {
      // A post usually quotes the matn only, without the chain the source text starts with.
      const sim = containment(q, this.skeletons[idx]!);
      if (!best || sim > best.similarity) best = { similarity: sim, hadith: this.items[idx]!, index: idx };
    }
    return best;
  }
}
