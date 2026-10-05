/**
 * Reading the text in a picture, on the device, shared by the extension and the demo.
 * Yaqeen's own Tesseract models are used: Tesseract's Arabic and English models fine-tuned on
 * Quran, hadith and translation text drawn in plain and decorative fonts, as social media pictures
 * show them (see ocr-training/ at the repository root).
 */
import type { PSM, Worker, WorkerParams } from "tesseract.js";
import { prepareForOcr } from "./ocrImage";

export type OcrLang = "ar" | "en";
export type WorkerFor = (lang: OcrLang) => Promise<Worker>;

/** Tesseract settings Yaqeen reads with: one block of text, which is how posts lay out a quote. */
export const OCR_PARAMS: Partial<WorkerParams> = {
  tessedit_pageseg_mode: "6" as unknown as PSM, // PSM.SINGLE_BLOCK, without loading tesseract.js here
  preserve_interword_spaces: "1",
};

export interface OcrResult {
  text: string;
  lang: OcrLang;
  confidence: number;
}

const LETTERS: Record<OcrLang, RegExp> = { ar: /[\u0621-\u064A]/g, en: /[A-Za-z]/g };

/** Lines with fewer than three letters of the language are leftovers of borders and decorations. */
export function tidy(text: string, lang: OcrLang): string {
  return text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => (l.match(LETTERS[lang]) ?? []).length >= 3)
    .join("\n");
}

/**
 * Text read from a picture. It is read in `first` (Arabic unless the user said otherwise); if
 * that reads poorly the other language is tried too and the clearer reading is kept, so an
 * English picture still comes out as English.
 * Lines are kept apart; callers join them when they check the text as one quote.
 */
export async function readImage(img: Blob | HTMLCanvasElement, workerFor: WorkerFor, first: OcrLang = "ar"): Promise<OcrResult> {
  const canvas = await prepareForOcr(img);
  const read = async (lang: OcrLang): Promise<OcrResult> => {
    const { data } = await (await workerFor(lang)).recognize(canvas);
    const text = tidy(data.text, lang);
    return { text, lang, confidence: text ? data.confidence : 0 };
  };
  let best = await read(first);
  if (best.confidence < 70) {
    const other = await read(first === "ar" ? "en" : "ar");
    if (other.text && other.confidence > best.confidence + 10) best = other;
  }
  return best;
}
