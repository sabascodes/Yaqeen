/**
 * Reading text out of uploaded photos and videos, all in the visitor's browser:
 * Tesseract for text in images and video frames, and Whisper for speech, in the language the
 * visitor picks (Arabic or English).
 * Nothing is uploaded; the extracted text then goes through the same checks as pasted text.
 */
import type { Worker } from "tesseract.js";
import { prepareForOcr } from "../src/shared/ocrImage";
import type { AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

/** What happened during the last run, shown under "Technical details" to help find problems. */
export const diag: string[] = [];
const note = (m: string) => diag.push(m);

export type Progress = (step: "ocr" | "model" | "listen" | "frames", pct?: number) => void;

// Multilingual Whisper, quantized; downloaded once from Hugging Face and cached by the browser.
const SPEECH_MODEL = "Xenova/whisper-small";
const MAX_SECONDS = 90;
const FRAME_COUNT = 6;

/** The language of the content being read, chosen by the visitor. */
export type ContentLang = "ar" | "en";

const ocrWorkers = new Map<ContentLang, Promise<Worker>>();
function getOcr(contentLang: ContentLang): Promise<Worker> {
  let w = ocrWorkers.get(contentLang);
  // tesseract.js is CommonJS, so a dynamic import may wrap it in `default`.
  // One language per worker: mixing Arabic and English models made Latin letters appear in Arabic text.
  w ??= import("tesseract.js").then((m) =>
    ((m as unknown as { default?: typeof m }).default ?? m).createWorker(contentLang === "ar" ? "ara" : "eng", 1, {
      workerPath: new URL("vendor/tesseract/worker.min.js", location.href).href,
      corePath: new URL("vendor/tesseract-core/", location.href).href,
      langPath: new URL("vendor/tessdata/", location.href).href,
      workerBlobURL: false,
      gzip: true,
    }),
  );
  w.catch(() => ocrWorkers.delete(contentLang));
  ocrWorkers.set(contentLang, w);
  return w;
}

/** The language the last image was actually read in (it can differ from the one picked). */
export let readAs: ContentLang = "ar";

/**
 * Text read from an image (a file, or a canvas holding a video frame). Lines in an image are
 * usually one sentence wrapped to fit, so they are joined; otherwise a wrapped half of a hadith
 * could be checked on its own and match an unrelated verse.
 * If the picked language reads poorly, the other one is tried, so an English picture read
 * with Arabic picked does not come out as nonsense.
 */
export async function readImage(img: Blob | HTMLCanvasElement, contentLang: ContentLang): Promise<string> {
  const canvas = await prepareForOcr(img);
  note(`image: read at ${canvas.width}x${canvas.height}`);
  const read = async (l: ContentLang) => {
    const { data } = await (await getOcr(l)).recognize(canvas);
    return { lang: l, text: tidy(data.text, l).replace(/\n/g, " "), confidence: data.confidence };
  };
  let best = await read(contentLang);
  if (best.confidence < 60) {
    const other = await read(contentLang === "ar" ? "en" : "ar");
    note(`reading: ${best.lang} ${Math.round(best.confidence)}%, ${other.lang} ${Math.round(other.confidence)}%`);
    if (other.text && other.confidence > best.confidence + 10) best = other;
  }
  readAs = best.lang;
  return best.text;
}

let asr: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
function getAsr(onProgress: Progress): Promise<AutomaticSpeechRecognitionPipeline> {
  asr ??= import("@huggingface/transformers").then(({ env, pipeline }) => {
    env.allowLocalModels = false;
    const wasm = env.backends.onnx.wasm;
    if (wasm) wasm.wasmPaths = new URL("vendor/ort/", location.href).href;
    const seen = new Map<string, [number, number]>();
    return pipeline("automatic-speech-recognition", SPEECH_MODEL, {
      dtype: "q8",
      progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status !== "progress" || !p.file || !p.total) return;
        seen.set(p.file, [p.loaded ?? 0, p.total]);
        let loaded = 0, total = 0;
        for (const [l, t] of seen.values()) (loaded += l), (total += t);
        onProgress("model", Math.round((loaded / total) * 100));
      },
    }) as Promise<AutomaticSpeechRecognitionPipeline>;
  });
  asr.catch(() => (asr = null));
  return asr;
}

/** Mono 16 kHz samples of the first MAX_SECONDS of a video or audio file. */
export async function audioSamples(file: Blob): Promise<Float32Array | null> {
  const ctx = new AudioContext({ sampleRate: 16000 });
  try {
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    note(`audio: ${buf.duration.toFixed(1)} s, ${buf.numberOfChannels} channel(s)`);
    const len = Math.min(buf.length, MAX_SECONDS * 16000);
    const out = new Float32Array(len);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < len; i++) out[i]! += ch[i]! / buf.numberOfChannels;
    }
    return out;
  } catch (e) {
    note(`audio: could not decode (${e})`);
    return null; // no audio track, or a format the browser cannot decode
  } finally {
    void ctx.close();
  }
}

/**
 * Whether speech-to-text can run here. The model is about 250 MB and needs WebAssembly memory
 * that iPhone and iPad browsers do not give a web page, so it is not attempted there.
 */
export function canListen(): { ok: boolean; why?: string } {
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (iOS) return { ok: false, why: "iPhone or iPad" };
  if (typeof WebAssembly === "undefined") return { ok: false, why: "no WebAssembly" };
  return { ok: true };
}

/** Speech in the file, as text. Empty when there is no usable audio. */
export async function listen(file: Blob, contentLang: ContentLang, onProgress: Progress): Promise<string> {
  const can = canListen();
  if (!can.ok) {
    note(`speech: not attempted (${can.why})`);
    return "";
  }
  const samples = await audioSamples(file);
  if (!samples || !samples.some((x) => Math.abs(x) > 0.01)) {
    if (samples) note("audio: silent");
    return "";
  }
  const model = await getAsr(onProgress);
  note("speech model: loaded");
  onProgress("listen");
  const out = await model(samples, { language: contentLang === "ar" ? "arabic" : "english", task: "transcribe", chunk_length_s: 30, stride_length_s: 5 });
  const raw = (Array.isArray(out) ? out[0] : out)?.text ?? "";
  note(`speech: ${raw.length} characters`);
  return tidy(raw, contentLang);
}

/** Resolves when `el` fires `event`, rejects on an error or after `ms`. */
function once(el: HTMLMediaElement, event: string, ms: number): Promise<void> {
  return new Promise((ok, fail) => {
    const done = (f: () => void) => {
      clearTimeout(timer);
      el.removeEventListener(event, onEvent);
      el.removeEventListener("error", onError);
      f();
    };
    const onEvent = () => done(ok);
    const onError = () => done(() => fail(new Error(`the browser could not play this video (${el.error?.message || el.error?.code || "unknown"})`)));
    const timer = setTimeout(() => done(() => fail(new Error(`timed out waiting for ${event}`))), ms);
    el.addEventListener(event, onEvent);
    el.addEventListener("error", onError);
  });
}

/** Text shown on screen in a video, read from frames spread across it. */
export async function readFrames(file: Blob, contentLang: ContentLang, onProgress: Progress): Promise<string> {
  const video = document.createElement("video");
  // iPhone and iPad only load a video's frames when it is muted, inline and has been played once.
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.preload = "auto";
  video.src = URL.createObjectURL(file);
  try {
    const loaded = once(video, "loadeddata", 20000);
    video.load();
    await video.play().then(() => video.pause(), () => undefined);
    await loaded;
    const duration = Math.min(Number.isFinite(video.duration) ? video.duration : 0, MAX_SECONDS);
    note(`video: ${video.videoWidth}x${video.videoHeight}, ${(video.duration || 0).toFixed(1)} s`);
    if (!video.videoWidth) return "";
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1280 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const lines: string[] = [];
    // A video whose length is unknown is read from its first frame only.
    const count = duration ? FRAME_COUNT : 1;
    for (let i = 0; i < count; i++) {
      onProgress("frames", Math.round((i / count) * 100));
      if (duration) {
        const seeked = once(video, "seeked", 10000);
        video.currentTime = (duration * (i + 0.5)) / count;
        if (!(await seeked.then(() => true, (e) => (note(`video frame ${i + 1}: ${e.message}`), false)))) continue;
      }
      canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
      const line = await readImage(canvas, contentLang);
      if (isNewLine(line, lines)) lines.push(line);
    }
    note(`on-screen text: ${lines.length} part(s)`);
    return lines.join("\n");
  } catch (e) {
    note(`video frames: failed (${e instanceof Error ? e.message : e})`);
    return "";
  } finally {
    URL.revokeObjectURL(video.src);
  }
}

/** Keeps lines with some words in the chosen language, dropping OCR noise. */
function tidy(text: string, contentLang: ContentLang): string {
  const letter = contentLang === "ar" ? /[ء-ي]/g : /[A-Za-z]/g;
  return text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => (l.match(letter) ?? []).length >= 3)
    .join("\n");
}

/** A caption usually stays on screen for several frames; keep it once (compared on its letters only). */
function isNewLine(line: string, have: string[]): boolean {
  const letters = (l: string) => (/[\u0621-\u064A]/.test(l) ? l.replace(/[^\u0621-\u064A]/g, "") : l.replace(/[^a-zA-Z]/g, ""));
  const key = letters(line);
  if (key.length < 3) return false;
  return !have.some((h) => {
    const k = letters(h);
    return k.includes(key) || key.includes(k);
  });
}
