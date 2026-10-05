import type { DataStatus } from "../shared/messages";
import { loadSettings, resolveLang, saveSettings, type Settings } from "../shared/settings";
import { esc } from "../ui/card";

const TEXT = {
  ar: {
    title: "إعدادات يقين",
    about:
      "يقين أداة مدعومة بالذكاء الاصطناعي تتحقق من النصوص الدينية في المنشورات بمطابقتها مع مصادر معتمدة فقط، ولا تُصدر فتوى ولا حكمًا من عندها.",
    data: "بيانات المصادر",
    dataBody:
      "لكي تعمل المطابقة على جهازك، نحتاج تنزيل نص المصحف من موسوعة القرآن الكريم (QuranEnc) وأحاديث موسوعة الأحاديث النبوية (HadeethEnc) مرة واحدة.",
    download: "تنزيل البيانات الآن",
    update: "تحديث البيانات",
    quran: "آيات القرآن",
    hadith: "أحاديث موسوعة الأحاديث النبوية",
    syncing: "جارٍ التنزيل",
    lastSync: "آخر تحديث",
    lang: "لغة الواجهة",
    auto: "حسب المتصفح",
    dorar:
      "البحث في الدرر السنية عن الأحاديث غير الموجودة محليًا (يُرسل نص الحديث المستخرج فقط إلى dorar.net)",
    semantic:
      "المطابقة الدلالية على الجهاز لاكتشاف النصوص المنقولة بألفاظ مختلفة (يُنزّل نموذج لغوي مرة واحدة، حوالي 280 ميجابايت)",
    autoCheck: "فحص المنشورات تلقائيًا أثناء التصفح",
    privacy: "الخصوصية",
    privacyItems: [
      "تتم المطابقة مع القرآن والأحاديث المنزّلة على جهازك، ولا يُرسل محتوى تصفحك إلى أي خادم.",
      "استخراج النص من الصور يتم على جهازك، وفقط عندما تضغط زر فحص الصورة.",
      "عند تفعيل الدرر السنية: يُرسل نص الحديث المستخرج فقط، دون رابط الصفحة أو أي بيانات عنك.",
      "لا نجمع أي بيانات شخصية، ولا نحفظ سجلًا لما تتصفحه.",
    ],
    sources: "المصادر المعتمدة",
    sourceItems: [
      "موسوعة القرآن الكريم quranenc.com (نص المصحف وترجمات المعاني)",
      "موسوعة الأحاديث النبوية hadeethenc.com",
      "الموسوعة الحديثية في الدرر السنية dorar.net",
    ],
  },
  en: {
    title: "Yaqeen settings",
    about:
      "Yaqeen is an AI-assisted tool that checks religious text in posts against approved sources only. It never issues a fatwa or a ruling of its own.",
    data: "Source data",
    dataBody:
      "To match on your device, Yaqeen downloads the Quran text from QuranEnc and the hadith of HadeethEnc once.",
    download: "Download data now",
    update: "Update data",
    quran: "Quran ayat",
    hadith: "HadeethEnc hadith",
    syncing: "Downloading",
    lastSync: "Last updated",
    lang: "Interface language",
    auto: "Follow browser",
    dorar: "Search Dorar for hadith not found locally (only the extracted hadith text is sent to dorar.net)",
    semantic: "On-device semantic matching to catch paraphrased quotes (downloads a language model once, about 280 MB)",
    autoCheck: "Check posts automatically while browsing",
    privacy: "Privacy",
    privacyItems: [
      "Matching against the downloaded Quran and hadith happens on your device; your browsing is not sent anywhere.",
      "Reading text from images happens on your device, only when you press the image check button.",
      "With Dorar on, only the extracted hadith text is sent, never the page address or anything about you.",
      "No personal data is collected and no browsing history is kept.",
    ],
    sources: "Approved sources",
    sourceItems: [
      "QuranEnc, quranenc.com (Mushaf text and translations of meanings)",
      "HadeethEnc, hadeethenc.com",
      "Dorar hadith encyclopedia, dorar.net",
    ],
  },
};

const app = document.getElementById("app")!;

async function status(): Promise<DataStatus> {
  return (await chrome.runtime.sendMessage({ type: "status" })) as DataStatus;
}

function check(id: keyof Settings, s: Settings, label: string) {
  return `<label><input type="checkbox" data-key="${id}" ${s[id] ? "checked" : ""}> <span>${esc(label)}</span></label>`;
}

async function render() {
  const s = await loadSettings();
  const lang = resolveLang(s.lang);
  const x = TEXT[lang];
  const st = await status();
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  app.setAttribute("lang", lang);
  const progress = st.progress
    ? `<progress max="${st.progress.total}" value="${st.progress.done}"></progress><span class="muted">${esc(x.syncing)}: ${esc(st.progress.step === "quran" ? x.quran : x.hadith)} ${st.progress.done}/${st.progress.total}</span>`
    : "";
  app.innerHTML = `
    <h1>${esc(x.title)}</h1>
    <section><p>${esc(x.about)}</p></section>
    <section>
      <h2>${esc(x.data)}</h2>
      <p class="muted">${esc(x.dataBody)}</p>
      <p>${esc(x.quran)}: <b>${st.quranAyat}</b> · ${esc(x.hadith)}: <b>${st.hadithCount}</b></p>
      ${st.syncedAt ? `<p class="muted">${esc(x.lastSync)}: ${esc(new Date(st.syncedAt).toLocaleString(lang))}</p>` : ""}
      ${st.error ? `<p class="note">${esc(st.error)}</p>` : ""}
      ${progress}
      <div><button class="btn btn--primary" id="sync" ${st.syncing ? "disabled" : ""}>${esc(st.quranAyat ? x.update : x.download)}</button></div>
    </section>
    <section>
      <label>${esc(x.lang)}
        <select id="lang">
          <option value="auto" ${s.lang === "auto" ? "selected" : ""}>${esc(x.auto)}</option>
          <option value="ar" ${s.lang === "ar" ? "selected" : ""}>العربية</option>
          <option value="en" ${s.lang === "en" ? "selected" : ""}>English</option>
        </select>
      </label>
      ${check("autoCheck", s, x.autoCheck)}
      ${check("dorarOnline", s, x.dorar)}
      ${check("semantic", s, x.semantic)}
    </section>
    <section><h2>${esc(x.privacy)}</h2><ul>${x.privacyItems.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></section>
    <section><h2>${esc(x.sources)}</h2><ul>${x.sourceItems.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></section>`;

  document.getElementById("sync")!.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "sync" });
    void render();
  });
  document.getElementById("lang")!.addEventListener("change", async (e) => {
    await saveSettings({ lang: (e.target as HTMLSelectElement).value as Settings["lang"] });
    void render();
  });
  app.querySelectorAll<HTMLInputElement>("input[data-key]").forEach((el) =>
    el.addEventListener("change", () => saveSettings({ [el.dataset.key!]: el.checked })),
  );
  if (st.syncing) setTimeout(render, 1000);
}

void render();
