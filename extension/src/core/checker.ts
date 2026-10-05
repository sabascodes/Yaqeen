/**
 * Turns a post into verdicts. Every verdict is built from fields of an approved
 * source record; nothing here writes a ruling of its own.
 */
import { containment } from "./align";
import { extractFragments, stripFraming, stripFramingOriginal, type Fragment } from "./detect";
import { classifyRuling, type GradeCategory } from "./grades";
import type { HadithIndex } from "./hadithIndex";
import { skeleton } from "./normalize";
import type { QuranIndex } from "./quranIndex";
import type { DorarHadith, Ruling, Verdict } from "./types";
import { quranEncUrl } from "../sources/quranenc";
import { hadeethEncUrl } from "../sources/hadeethenc";
import { dorarSearchUrl } from "../sources/dorar";
import { suraName } from "./suras";

/** Similarity thresholds; to be calibrated on the evaluation set in eval/. */
export const THRESHOLDS = {
  /** Below this a quote differs by at least a word, so it is shown with the correct wording. */
  quranExact: 0.97,
  quranClose: 0.75,
  /** Hadith sources are in everyday spelling, so an exact quote matches letter for letter. */
  hadithExact: 0.99,
  hadithClose: 0.72,
  /** A Dorar result counts as the same hadith above this. */
  dorarSame: 0.65,
  /** Lexical floor for the semantic fallback to be considered at all. */
  semanticFloor: 0.55,
  /**
   * multilingual-e5-base cosine similarity for a paraphrase. e5 scores sit close together
   * (unrelated ayat are around 0.8), so this is provisional until calibrated on real posts.
   */
  semanticMin: 0.88,
};

export interface CheckDeps {
  quran: QuranIndex | null;
  hadith: HadithIndex | null;
  /** Online Dorar lookup; undefined when the user turned it off. */
  dorar?: (text: string) => Promise<DorarHadith[]>;
  /**
   * Nearest ayat to `text` by meaning (positions in mushaf order, cosine score), from the
   * on-device multilingual-e5-base model and the precomputed ayah embeddings.
   */
  semanticSearch?: (text: string) => Promise<{ index: number; score: number }[]>;
  /** Same for HadeethEnc hadith (positions in the hadith index), from the precomputed hadith embeddings. */
  hadithSemanticSearch?: (text: string) => Promise<{ index: number; score: number }[]>;
  lang?: "ar" | "en";
}

export interface CheckResult {
  /** True when the post looks religious, so "not found" is worth showing. */
  religious: boolean;
  verdicts: Verdict[];
  /** A source could not be reached, so "not found" would be misleading. */
  incomplete?: boolean;
}

async function checkQuran(f: Fragment, deps: CheckDeps): Promise<Verdict | null> {
  if (!deps.quran) return null;
  let hit = deps.quran.search(f.text);
  let sim = hit?.similarity ?? 0;
  // Meaning-based search only where it can matter: a quote framed as Quran, or a near miss.
  if (sim < THRESHOLDS.quranClose && deps.semanticSearch && (f.quranLike || sim >= THRESHOLDS.semanticFloor)) {
    // The model may be unavailable (first download, offline); fall back to the lexical result.
    const near = await deps.semanticSearch(f.text).catch(() => []);
    const again = near.length ? deps.quran.search(f.text, near.map((n) => n.index)) : null;
    if (again && again.similarity >= sim) hit = again;
    if (hit) {
      sim = hit.similarity;
      const cos = Math.max(0, ...near.filter((n) => n.index >= hit!.first && n.index <= hit!.last).map((n) => n.score));
      if (sim >= THRESHOLDS.semanticFloor && cos >= THRESHOLDS.semanticMin) sim = THRESHOLDS.quranClose;
    }
  }
  if (!hit || sim < THRESHOLDS.quranClose) return null;
  const sourceText = hit.ayat.map((a) => a.text).join(" ");
  const first = hit.ayat[0]!;
  const last = hit.ayat[hit.ayat.length - 1]!;
  const range = first.aya === last.aya ? `${first.aya}` : `${first.aya}-${last.aya}`;
  return {
    kind: sim >= THRESHOLDS.quranExact ? "quran_exact" : "different_wording",
    checkedText: f.text,
    sourceText,
    sourceTranslation: hit.ayat.map((a) => a.translation ?? "").join(" ").trim() || undefined,
    ayat: hit.ayat.map(({ sura, aya }) => ({ sura, aya })),
    alsoAt: hit.alsoAt.map(({ sura, aya }) => ({ sura, aya })),
    references: [
      {
        label: `${suraName(first.sura, deps.lang)} ${range}`,
        url: quranEncUrl(first.sura, first.aya),
      },
    ],
    similarity: sim,
    source: "quranenc",
  };
}

async function checkHadeethEnc(f: Fragment, deps: CheckDeps): Promise<Verdict | null> {
  if (!deps.hadith) return null;
  const matn = stripFraming(f.text);
  let hit = deps.hadith.search(matn);
  let sim = hit?.similarity ?? 0;
  // Meaning-based search only for text framed as a hadith; the result is never "authentic".
  if (sim < THRESHOLDS.hadithClose && f.hadithLike && deps.hadithSemanticSearch) {
    const near = await deps.hadithSemanticSearch(stripFramingOriginal(f.text)).catch(() => []);
    for (const n of near) {
      if (n.score < THRESHOLDS.semanticMin) continue;
      const candidate = deps.hadith.at(matn, n.index);
      if (candidate && candidate.similarity >= THRESHOLDS.semanticFloor) {
        hit = candidate;
        sim = THRESHOLDS.hadithClose;
        break;
      }
    }
  }
  if (!hit || sim < THRESHOLDS.hadithClose) return null;
  const h = hit.hadith;
  const differs = sim < THRESHOLDS.hadithExact;
  return {
    kind: differs ? "different_wording" : "hadith_authentic",
    checkedText: f.text,
    sourceText: h.text,
    sourceTranslation: h.translation,
    // HadeethEnc publishes the grade and the collection, not the name of a grading scholar.
    rulings: [{ scholar: "", ruling: h.grade, book: h.attribution, pageOrNumber: "" }],
    references: [{ label: `موسوعة الأحاديث النبوية - ${h.attribution}`, url: hadeethEncUrl(h.id, deps.lang) }],
    wordingDiffers: differs,
    similarity: sim,
    source: "hadeethenc",
  };
}

/** Similarity of the quoted text to a Dorar result, either one containing the other. */
function dorarSimilarity(query: string, result: string): number {
  const q = skeleton(query);
  const r = skeleton(result);
  if (!q || !r) return 0;
  return q.length <= r.length ? containment(q, r) : containment(r, q);
}

export function verdictFromRulings(categories: GradeCategory[]): Verdict["kind"] {
  const known = new Set(categories.filter((c) => c !== "unclassified"));
  if (!known.size) return "rulings_verbatim";
  if (known.size === 1 && known.has("authentic")) return "hadith_authentic";
  if (!known.has("authentic")) return "weak_or_fabricated";
  return "scholars_differed";
}

async function checkDorar(f: Fragment, deps: CheckDeps): Promise<Verdict | null> {
  if (!deps.dorar) return null;
  const query = stripFraming(f.text);
  const results = await deps.dorar(stripFramingOriginal(f.text));
  const same = results
    .map((r) => ({ r, sim: dorarSimilarity(query, r.text) }))
    .filter((x) => x.sim >= THRESHOLDS.dorarSame)
    .sort((a, b) => b.sim - a.sim);
  if (!same.length) return null;

  const rulings: Ruling[] = [];
  const seen = new Set<string>();
  for (const { r } of same) {
    const key = `${r.scholar}|${r.ruling}|${r.book}`;
    if (seen.has(key) || !r.ruling) continue;
    seen.add(key);
    rulings.push({ scholar: r.scholar, ruling: r.ruling, book: r.book, pageOrNumber: r.pageOrNumber });
  }
  if (!rulings.length) return null;

  const best = same[0]!;
  const differs = best.sim < THRESHOLDS.hadithExact;
  let kind = verdictFromRulings(rulings.map((r) => classifyRuling(r.ruling)));
  if (kind === "hadith_authentic" && differs) kind = "different_wording";
  return {
    kind,
    checkedText: f.text,
    sourceText: best.r.text,
    rulings,
    references: [{ label: "الدرر السنية - الموسوعة الحديثية", url: dorarSearchUrl(stripFramingOriginal(f.text)) }],
    wordingDiffers: differs,
    similarity: best.sim,
    source: "dorar",
  };
}

/**
 * `manual`: the user pasted this text to be checked on purpose, so it is treated as
 * religious text (a hadith lookup is allowed and "not found" is reported).
 */
export async function checkPost(text: string, deps: CheckDeps, manual = false): Promise<CheckResult> {
  const fragments = extractFragments(text);
  if (manual) fragments.forEach((f) => (f.hadithLike = true));
  const religious = manual || fragments.some((f) => f.hadithLike || f.quranLike);
  const verdicts: Verdict[] = [];
  const covered: string[] = [];
  let incomplete = false;
  const asked: string[] = []; // fragments already sent online

  // Smaller fragments (quotes, lines) first, so the whole post is only checked for what is left.
  fragments.sort((a, b) => a.text.length - b.text.length);
  for (const f of fragments) {
    const sk = skeleton(f.text);
    let rest = sk;
    for (const c of covered) rest = rest.replace(c, "");
    if (rest !== sk && rest.length < 12) continue; // nothing new beyond what was already matched

    let v = await checkQuran(f, deps);
    if (!v) v = await checkHadeethEnc(f, deps);
    // A larger fragment that contains one already sent would only repeat the same lookup.
    if (!v && f.hadithLike && !asked.some((a) => sk.includes(a))) {
      asked.push(sk);
      v = await checkDorar(f, deps).catch(() => {
        incomplete = true;
        return null;
      });
    }
    if (!v) continue;

    const dup = verdicts.some(
      (o) => o.sourceText === v!.sourceText || (o.ayat && v!.ayat && o.ayat[0]?.sura === v!.ayat[0]?.sura && o.ayat[0]?.aya === v!.ayat[0]?.aya),
    );
    if (!dup) verdicts.push(v);
    covered.push(sk);
  }

  if (!verdicts.length && religious && !incomplete) {
    const main = fragments[fragments.length - 1];
    verdicts.push({ kind: "not_found", checkedText: main?.text ?? text, references: [], source: "none" });
  }
  return { religious, verdicts, incomplete: incomplete || undefined };
}
