import type { CheckResult } from "../core/checker";

export type Request =
  | { type: "check"; text: string; manual?: boolean }
  | { type: "ocr"; imageUrl: string }
  | { type: "status" }
  | { type: "sync" };

export interface DataStatus {
  quranAyat: number;
  hadithCount: number;
  syncing: boolean;
  progress?: { step: "quran" | "hadith"; done: number; total: number };
  error?: string;
  syncedAt?: string;
}

export type CheckResponse = { ok: true; result: CheckResult; ocrText?: string } | { ok: false; error: string };

// Messages between the service worker and the offscreen document.
export type OffscreenRequest =
  | { target: "offscreen"; type: "ocr"; dataUrl: string }
  | { target: "offscreen"; type: "embed-sim"; query: string; candidates: string[] };
