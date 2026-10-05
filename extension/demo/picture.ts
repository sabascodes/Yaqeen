/**
 * Reading the text in an uploaded picture, in the visitor's browser with Yaqeen's own Arabic and
 * English Tesseract models. Nothing is uploaded; the text then goes through the same checks as
 * pasted text.
 */
import type { Worker } from "tesseract.js";
import { OCR_PARAMS, readImage, type OcrLang, type OcrResult } from "../src/shared/ocr";

const workers = new Map<OcrLang, Promise<Worker>>();
function workerFor(lang: OcrLang): Promise<Worker> {
  let w = workers.get(lang);
  // tesseract.js is CommonJS, so a dynamic import may wrap it in `default`.
  w ??= import("tesseract.js")
    .then((m) =>
      ((m as unknown as { default?: typeof m }).default ?? m).createWorker(lang === "ar" ? "ara" : "eng", 1, {
        workerPath: new URL("vendor/tesseract/worker.min.js", location.href).href,
        corePath: new URL("vendor/tesseract-core/", location.href).href,
        langPath: new URL("vendor/tessdata/", location.href).href,
        workerBlobURL: false,
        gzip: true,
        // The models are Yaqeen's own: never use a copy of the standard ones cached by another site.
        cachePath: "yaqeen-ocr-v1",
      }),
    )
    .then(async (worker) => (await worker.setParameters(OCR_PARAMS), worker));
  w.catch(() => workers.delete(lang));
  workers.set(lang, w);
  return w;
}

/** Text in the picture, read first in the language the visitor picked. */
export function readPicture(file: Blob, contentLang: OcrLang): Promise<OcrResult> {
  return readImage(file, workerFor, contentLang);
}
