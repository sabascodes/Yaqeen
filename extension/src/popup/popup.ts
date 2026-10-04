import type { CheckResponse, DataStatus } from "../shared/messages";
import { loadSettings, resolveLang } from "../shared/settings";
import { t } from "../shared/i18n";
import { bindCopy, cardHtml, esc } from "../ui/card";

const TEXT = {
  ar: { placeholder: "الصق نصًا للتحقق منه…", go: "تحقق", settings: "الإعدادات", foot: "نعتمد على المصادر المعتمدة فقط · لا نصدر فتاوى", nothing: "لم نجد في النص آية أو حديثًا للتحقق منه." },
  en: { placeholder: "Paste a text to verify…", go: "Verify", settings: "Settings", foot: "Approved sources only · No rulings issued", nothing: "No ayah or hadith was found in this text to verify." },
};

async function main() {
  const lang = resolveLang((await loadSettings()).lang);
  const x = TEXT[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.getElementById("app")!.setAttribute("lang", lang);
  document.getElementById("logo")!.textContent = t(lang).yaqeen;
  document.getElementById("settings")!.textContent = x.settings;
  document.getElementById("foot")!.textContent = x.foot;
  document.getElementById("go")!.textContent = x.go;
  (document.getElementById("q") as HTMLTextAreaElement).placeholder = x.placeholder;

  const st = (await chrome.runtime.sendMessage({ type: "status" })) as DataStatus;
  if (!st.quranAyat) {
    const n = document.getElementById("nodata")!;
    n.textContent = t(lang).noData;
    n.hidden = false;
  }

  const out = document.getElementById("out")!;
  document.getElementById("form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = (document.getElementById("q") as HTMLTextAreaElement).value.trim();
    if (!text) return;
    out.innerHTML = `<p class="field__value">${esc(t(lang).checking)}</p>`;
    const res = (await chrome.runtime.sendMessage({ type: "check", text, manual: true })) as CheckResponse;
    if (!res.ok || (res.result.incomplete && !res.result.verdicts.length)) {
      out.innerHTML = `<p class="note">${esc(t(lang).error)}</p>`;
      return;
    }
    const cards = res.result.verdicts.map((v) => cardHtml(v, lang)).join("");
    out.innerHTML = cards || `<p class="field__value">${esc(x.nothing)}</p>`;
    bindCopy(out);
  });
}

void main();
