/** One ayah as delivered by the approved Quran source. `text` is never altered. */
export interface Ayah {
  sura: number;
  aya: number;
  text: string;
  /** Approved English translation of the meaning, when available. */
  translation?: string;
}

/** An authentic hadith from HadeethEnc (hadeethenc.com). */
export interface EncHadith {
  id: string;
  text: string;
  /** e.g. "صحيح", "حسن" as published by HadeethEnc. */
  grade: string;
  /** e.g. "متفق عليه", "رواه مسلم" as published by HadeethEnc. */
  attribution: string;
  translation?: string;
}

/** One result row from the Dorar hadith encyclopedia (dorar.net). */
export interface DorarHadith {
  text: string;
  narrator: string;
  /** المحدث: the scholar who issued the ruling. */
  scholar: string;
  /** المصدر: the book the ruling comes from. */
  book: string;
  /** الصفحة أو الرقم */
  pageOrNumber: string;
  /** خلاصة حكم المحدث, verbatim. */
  ruling: string;
}

export type VerdictKind =
  | "quran_exact" // مطابق لنص المصحف
  | "hadith_authentic" // حديث ثابت
  | "different_wording" // ورد بلفظ مختلف
  | "weak_or_fabricated" // ضعيف أو موضوع
  | "scholars_differed" // اختلف العلماء في الحكم عليه
  | "not_found" // لم نعثر على المصدر
  // Found in Dorar but no ruling matched the known terms: rulings shown verbatim.
  // Pending Saba's confirmation (see README, open questions).
  | "rulings_verbatim";

export interface Reference {
  /** Human readable source, e.g. "صحيح البخاري، رقم 1". */
  label: string;
  url?: string;
}

export interface Ruling {
  scholar: string;
  ruling: string;
  book: string;
  pageOrNumber: string;
}

export interface Verdict {
  kind: VerdictKind;
  /** The text found in the post that was checked. */
  checkedText: string;
  /** The correct wording from the approved source, for display and sharing. */
  sourceText?: string;
  sourceTranslation?: string;
  /** Quran location(s). */
  ayat?: { sura: number; aya: number }[];
  /** How many other places in the Quran match equally well (repeated phrases). */
  alsoAt?: { sura: number; aya: number }[];
  /** Scholars' rulings, verbatim, for hadith verdicts. */
  rulings?: Ruling[];
  references: Reference[];
  /** For a hadith: whether the wording also differs from the source. */
  wordingDiffers?: boolean;
  similarity?: number;
  /** Which approved source produced this verdict. */
  source: "quranenc" | "hadeethenc" | "dorar" | "none";
}
