/**
 * Reading the Arabic text in a picture, on the device, shared by the extension and the demo.
 * Pictures are read in Arabic only: the approved sources are Arabic, so English text in a picture
 * could not be checked anyway. The model comes from extension/ocr-models/ (see ocr-training/ at
 * the repository root).
 */
import type { PSM, Worker, WorkerParams } from "tesseract.js";
import { prepareForOcr } from "./ocrImage";

/** Tesseract settings Yaqeen reads with: one block of text, which is how posts lay out a quote. */
export const OCR_PARAMS: Partial<WorkerParams> = {
  tessedit_pageseg_mode: "6" as unknown as PSM, // PSM.SINGLE_BLOCK, without loading tesseract.js here
  preserve_interword_spaces: "1",
};

/** Lines with fewer than three Arabic letters are leftovers of borders, decorations or Latin text. */
export function tidy(text: string): string {
  return text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => (l.match(/[ء-ي]/g) ?? []).length >= 3)
    .join("\n");
}

/**
 * Arabic text read from a picture, one line per line of the picture; callers join the lines
 * when they check the text as one quote.
 */
export async function readImage(img: Blob | HTMLCanvasElement, worker: () => Promise<Worker>): Promise<string> {
  const { data } = await (await worker()).recognize(await prepareForOcr(img));
  return tidy(data.text);
}
