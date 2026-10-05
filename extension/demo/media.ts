/**
 * Reading text out of uploaded photos and videos, all in the visitor's browser:
 * Tesseract (Arabic + English) for text in images and video frames, and Whisper for speech.
 * Nothing is uploaded; the extracted text then goes through the same checks as pasted text.
 */
import type { Worker } from "tesseract.js";
import type { AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

/** What happened during the last run, shown under "Technical details" to help find problems. */
export const diag: string[] = [];
const note = (m: string) => diag.push(m);

export type Progress = (step: "ocr" | "model" | "listen" | "frames", pct?: number) => void;

// Multilingual Whisper, quantized; downloaded once from Hugging Face and cached by the browser.
const SPEECH_MODEL = "Xenova/whisper-small";
const MAX_SECONDS = 90;
const FRAME_COUNT = 6;

let ocrWorker: Promise<Worker> | null = null;
function getOcr(): Promise<Worker> {
  // tesseract.js is CommonJS, so a dynamic import may wrap it in `default`.
  ocrWorker ??= import("tesseract.js").then((m) =>
    ((m as unknown as { default?: typeof m }).default ?? m).createWorker(["ara", "eng"], 1, {
      workerPath: new URL("vendor/tesseract/worker.min.js", location.href).href,
      corePath: new URL("vendor/tesseract-core/", location.href).href,
      langPath: new URL("vendor/tessdata/", location.href).href,
      workerBlobURL: false,
      gzip: true,
    }),
  );
  return ocrWorker;
}

/**
 * Text read from an image (a file, or a canvas holding a video frame). Lines in an image are
 * usually one sentence wrapped to fit, so they are joined; otherwise a wrapped half of a hadith
 * could be checked on its own and match an unrelated verse.
 */
export async function readImage(img: Blob | HTMLCanvasElement): Promise<string> {
  const worker = await getOcr();
  const { data } = await worker.recognize(img);
  return tidy(data.text).replace(/\n/g, " ");
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

/** Arabic speech in the file, as text. Empty when there is no usable audio. */
export async function listen(file: Blob, onProgress: Progress): Promise<string> {
  const samples = await audioSamples(file);
  if (!samples || !samples.some((x) => Math.abs(x) > 0.01)) {
    if (samples) note("audio: silent");
    return "";
  }
  const model = await getAsr(onProgress);
  note("speech model: loaded");
  onProgress("listen");
  const out = await model(samples, { language: "arabic", task: "transcribe", chunk_length_s: 30, stride_length_s: 5 });
  const raw = (Array.isArray(out) ? out[0] : out)?.text ?? "";
  note(`speech: ${raw.length} characters`);
  return tidy(raw);
}

/** Text shown on screen in a video, read from frames spread across it. */
export async function readFrames(file: Blob, onProgress: Progress): Promise<string> {
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  video.src = URL.createObjectURL(file);
  try {
    await new Promise((ok, fail) => ((video.onloadeddata = ok), (video.onerror = fail)));
    const duration = Math.min(video.duration || 0, MAX_SECONDS);
    note(`video: ${video.videoWidth}x${video.videoHeight}, ${(video.duration || 0).toFixed(1)} s`);
    if (!duration || !video.videoWidth) return "";
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1280 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const lines: string[] = [];
    for (let i = 0; i < FRAME_COUNT; i++) {
      onProgress("frames", Math.round((i / FRAME_COUNT) * 100));
      video.currentTime = (duration * (i + 0.5)) / FRAME_COUNT;
      await new Promise((ok) => (video.onseeked = ok));
      canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
      for (const line of (await readImage(canvas)).split("\n")) if (isNewLine(line, lines)) lines.push(line);
    }
    note(`on-screen text: ${lines.length} line(s)`);
    return lines.join("\n");
  } catch (e) {
    note(`video frames: failed (${e instanceof Event ? "the browser could not play this video" : e})`);
    return "";
  } finally {
    URL.revokeObjectURL(video.src);
  }
}

/** Keeps lines with some Arabic or Latin words, dropping OCR noise. */
function tidy(text: string): string {
  return text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => (l.match(/[ء-ي]|[A-Za-z]/g) ?? []).length >= 3)
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
