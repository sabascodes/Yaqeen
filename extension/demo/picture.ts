/**
 * Reading the Arabic text in an uploaded picture, in the visitor's browser with Yaqeen's
 * Tesseract model. Nothing is uploaded; the text then goes through the same checks as pasted text.
 */
import type { Worker } from "tesseract.js";
import { OCR_PARAMS, readImage } from "../src/shared/ocr";

let worker: Promise<Worker> | null = null;
function getWorker(): Promise<Worker> {
  // tesseract.js is CommonJS, so a dynamic import may wrap it in `default`.
  worker ??= import("tesseract.js")
    .then((m) =>
      ((m as unknown as { default?: typeof m }).default ?? m).createWorker("ara", 1, {
        workerPath: new URL("vendor/tesseract/worker.min.js", location.href).href,
        corePath: new URL("vendor/tesseract-core/", location.href).href,
        langPath: new URL("vendor/tessdata/", location.href).href,
        workerBlobURL: false,
        gzip: true,
        // The model is Yaqeen's own: never use a copy of the standard one cached by another site.
        cachePath: "yaqeen-ocr-v1",
      }),
    )
    .then(async (w) => (await w.setParameters(OCR_PARAMS), w));
  worker.catch(() => (worker = null));
  return worker;
}

/** Arabic text in the picture. */
export function readPicture(file: Blob): Promise<string> {
  return readImage(file, getWorker);
}
