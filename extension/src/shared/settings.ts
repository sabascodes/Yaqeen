export interface Settings {
  /** UI language; "auto" follows the browser. */
  lang: "auto" | "ar" | "en";
  /** Ask Dorar (online) about hadith not found in the local data. */
  dorarOnline: boolean;
  /** Use the on-device embedding model to catch paraphrased quotes. */
  semantic: boolean;
  /** Check posts automatically; when off, only on click. */
  autoCheck: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: "auto",
  dorarOnline: true,
  semantic: true,
  autoCheck: true,
};

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get("settings");
  return { ...DEFAULT_SETTINGS, ...(stored.settings as Partial<Settings> | undefined) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await chrome.storage.sync.set({ settings: next });
  return next;
}

export function resolveLang(lang: Settings["lang"]): "ar" | "en" {
  if (lang !== "auto") return lang;
  const ui = (typeof chrome !== "undefined" && chrome.i18n?.getUILanguage?.()) || navigator.language || "ar";
  return ui.toLowerCase().startsWith("ar") ? "ar" : "en";
}
