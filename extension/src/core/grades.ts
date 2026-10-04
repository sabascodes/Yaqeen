/**
 * Maps a scholar's ruling text (as published by Dorar / HadeethEnc) to a category.
 *
 * This table only reads the scholar's own words; it never judges a hadith itself.
 * Anything not listed is "unclassified" and is shown verbatim without a category.
 * Saba approved this table on 2026-10-04; a scholarly review is still due before release.
 */
import { normalizeArabic } from "./normalize";

export type GradeCategory = "authentic" | "weak" | "fabricated" | "unclassified";

// Checked in order; the first list with a matching phrase wins.
// Negative phrases come first so "لا يصح" is not read as "صحيح".
const FABRICATED = ["موضوع", "مكذوب", "كذب", "باطل", "لا اصل له", "لا اصل لها", "ليس له اصل", "لا يصح", "لا يثبت"];
const WEAK = ["ليس بصحيح", "غير صحيح", "ليس بثابت", "ضعيف", "منكر", "شاذ", "واه", "معلول", "مضطرب", "مرسل", "منقطع", "معضل", "ضعفه", "ضعيفه", "اسناده ضعيف"];
const AUTHENTIC = ["صحيح", "حسن", "متفق عليه", "ثابت", "اسناده صحيح", "اسناده حسن", "رجاله ثقات", "اورده في صحيحه", "جيد", "قوي"];

function hasPhrase(text: string, phrase: string): boolean {
  return new RegExp(`(^|\\s)${phrase}(\\s|$)`).test(text);
}

export function classifyRuling(ruling: string): GradeCategory {
  const t = normalizeArabic(ruling);
  if (!t) return "unclassified";
  if (FABRICATED.some((p) => hasPhrase(t, normalizeArabic(p)))) return "fabricated";
  if (WEAK.some((p) => hasPhrase(t, normalizeArabic(p)))) return "weak";
  if (AUTHENTIC.some((p) => hasPhrase(t, normalizeArabic(p)))) return "authentic";
  // Words that start with a listed term, e.g. "صحيحة" or "حسنه".
  if (/(^|\s)(صحيح|حسن)\S*/.test(t)) return "authentic";
  return "unclassified";
}
