/**
 * Arabic text normalization used for matching only.
 * What users see is always the original text from the source, never this form.
 */

// Harakat, Quranic annotation marks, small letters, pause marks, superscript alef.
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿ]/g;
const TATWEEL = /ـ/g;
const ALEF_FORMS = /[آأإٱٲٳٵ]/g; // آ أ إ ٱ ...
const NON_ARABIC = /[^ء-ي\s]/g;

/** Light normalization: keeps word boundaries, unifies letter variants. */
export function normalizeArabic(input: string): string {
  return input
    .replace(/ﷺ/g, " صلى الله عليه وسلم ") // ﷺ ligature
    // Uthmani spellings that everyday writing spells with other letters:
    // A bare waw carrying a superscript alef is read as alef (ٱلصَّلَوٰة → الصلاة, ٱلزَّكَوٰة → الزكاة);
    // a waw with its own vowel is a real waw (ٱلسَّمَٰوَٰتِ → السماوات).
    .replace(/\u0648\u0670/g, "ا")
    .replace(/\u06E7/g, "ي") // small high yeh: إِبۡرَٰهِـۧمَ → إبراهيم
    .replace(DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(ALEF_FORMS, "ا")
    .replace(/ى/g, "ي") // ى
    .replace(/ة/g, "ه") // ة
    .replace(/ؤ/g, "و") // ؤ
    .replace(/ئ/g, "ي") // ئ
    .replace(/ء/g, "") // ء
    .replace(NON_ARABIC, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Spelling-independent skeleton for comparing Uthmani script with everyday spelling.
 * Uthmani omits many alefs (ٱلۡكِتَٰبُ vs الكتاب) and joins some words (يَٰٓأَيُّهَا),
 * so the skeleton drops every alef and all spaces.
 */
export function skeleton(input: string): string {
  return normalizeArabic(input).replace(/[ا\s]/g, "");
}

/** Number of Arabic letters, used to ignore fragments too short to judge. */
export function arabicLength(input: string): number {
  return skeleton(input).length;
}

export function countArabicWords(input: string): number {
  const n = normalizeArabic(input);
  return n ? n.split(" ").length : 0;
}
