/**
 * Web demo of Yaqeen: the same matching and cards as the extension, running in the page.
 * Quran (QuranEnc) and HadeethEnc data are bundled with the site; Dorar is reached through
 * the site's /api/dorar function, which forwards only the hadith text.
 */
import { checkPost, type CheckResult } from "../src/core/checker";
import { HadithIndex } from "../src/core/hadithIndex";
import { QuranIndex } from "../src/core/quranIndex";
import type { Ayah, EncHadith } from "../src/core/types";
import { dorarQuery, dorarResultHtml, parseDorarHtml } from "../src/sources/dorar";
import { t, type Lang } from "../src/shared/i18n";
import { bindCopy, badgeHtml, cardHtml, esc, TYPE } from "../src/ui/card";
import { CHIP_MARK, markSvg } from "../src/ui/logo";
import * as media from "./media";
import type { Progress } from "./media";

const TEXT = {
  ar: {
    title: "يقين",
    eyebrow: "إضافة لمتصفحي Chrome وEdge",
    headline: "تحقّق من الآيات والأحاديث قبل أن تشاركها",
    label: "الصق آية أو حديثًا",
    tagline: "يطابق يقين النص مع المصادر المعتمدة فقط، ويعرض المرجع واللفظ الصحيح وأحكام العلماء كما وردت، دون أي فتوى.",
    tryIt: "جرّب بنفسك",
    placeholder: "الصق آية أو حديثًا للتحقق منه…",
    go: "تحقق",
    feed: "منشورات تجريبية",
    feedNote: "منشورات مكتوبة للعرض، كما تظهر في X وFacebook وTikTok مع الإضافة.",
    check: "فحص المنشور",
    nothing: "لم نجد في النص آية أو حديثًا للتحقق منه.",
    dorarDown: "لم نجد النص في المصادر المحلية، وتعذر الوصول إلى الدرر السنية الآن. حاول مرة أخرى بعد قليل.",
    loading: "جارٍ تحميل بيانات المصادر…",
    loadError: "تعذر تحميل بيانات المصادر.",
    sources: "المصادر: موسوعة القرآن الكريم quranenc.com · موسوعة الأحاديث النبوية hadeethenc.com · الدرر السنية dorar.net",
    demoNote: "نسخة العرض لا تشمل المطابقة بالمعنى، وهي متاحة في الإضافة. قراءة الصور والفيديو تتم داخل متصفحك.",
    other: "English",
    tabs: { try: "جرّب بنفسك", media: "صورة أو فيديو", post: "على منشور", popup: "النافذة المنبثقة", settings: "الإعدادات", types: "أنواع النتائج" },
    mediaTitle: "تحقّق من صورة أو فيديو",
    mediaNote: "ارفع لقطة شاشة أو صورة أو فيديو محفوظًا من TikTok أو X أو Facebook. يقرأ يقين النص المكتوب في الصورة، ويحوّل الكلام في الفيديو إلى نص، ثم يتحقق منه. كل ذلك يتم داخل متصفحك، ولا يُرفع الملف إلى أي خادم.",
    contentLang: "ما لغة المحتوى؟",
    contentLangs: { ar: "العربية", en: "الإنجليزية" },
    pick: "اختر صورة أو فيديو",
    drop: "أو اسحب الملف وأفلته هنا",
    sample: "جرّب صورة نموذجية",
    sampleText: "قال تعالى: يا أيها الذين آمنوا استعينوا بالصبر والدعاء إن الله مع الصابرين",
    steps: { ocr: "قراءة النص في الصورة…", model: "تنزيل نموذج تحويل الكلام إلى نص (مرة واحدة، قرابة 250 ميجابايت)", listen: "الاستماع إلى الكلام في الفيديو…", frames: "قراءة النص الظاهر في الفيديو…" },
    found: "النص الذي وجدناه (يمكنك تصحيحه ثم إعادة التحقق)",
    speech: "الكلام",
    onScreen: "النص على الشاشة",
    recheck: "تحقق من النص",
    noText: "لم نجد نصًا مقروءًا في هذا الملف. جرّب صورة أوضح أو فيديو فيه كلام واضح.",
    mediaError: "تعذرت قراءة هذا الملف. جرّب صورة JPG أو PNG، أو فيديو MP4.",
    details: "تفاصيل تقنية (أرسلها لنا إن استمرت المشكلة)",
    speechError: "لم نتمكن من قراءة هذا الفيديو على هذا الجهاز. تحويل الكلام إلى نص لا يعمل على iPhone وiPad، وإذا لم يظهر نص مكتوب في الفيديو فلن نجد شيئًا. جرّب Chrome أو Edge على جهاز كمبيوتر.",
    asrNote: "تحويل الكلام إلى نص آلي وقد يخطئ، خاصة في التلاوة. راجع النص قبل الاعتماد على النتيجة.",
    tiktokNote: "لفيديو TikTok: احفظ الفيديو على جهازك أولًا ثم ارفعه هنا.",
    postNote: "هكذا تظهر يقين تحت منشور على X: اضغط زر يقين لعرض النتيجة.",
    popupNote: "هذه النافذة تفتح من أيقونة يقين في شريط المتصفح.",
    popupLabel: "الصق آية أو حديثًا للتحقق منه",
    popupFoot: "نعتمد على المصادر المعتمدة فقط · لا نصدر فتاوى",
    settingsNote: "معاينة لصفحة إعدادات الإضافة. الإعدادات هنا للعرض فقط.",
    settingsTitle: "إعدادات يقين",
    data: "بيانات المصادر",
    ayat: "آيات القرآن",
    ahadith: "أحاديث موسوعة الأحاديث النبوية",
    langLabel: "لغة الواجهة",
    langAuto: "حسب المتصفح",
    auto: "فحص المنشورات تلقائيًا أثناء التصفح",
    dorarOpt: "البحث في الدرر السنية عن الأحاديث غير الموجودة محليًا",
    dorarHint: "يُرسل نص الحديث المستخرج فقط إلى dorar.net",
    semOpt: "المطابقة بالمعنى على الجهاز",
    semHint: "يُنزّل نموذج لغوي مرة واحدة، حوالي 280 ميجابايت",
    typesNote: "كل نتيجة تحمل واحدًا من هذه التصنيفات، بلونه.",
    meanings: {
      quran_exact: "الآية مطابقة حرفيًا لنص المصحف، مع اسم السورة ورقم الآية.",
      hadith_authentic: "وُجد لفظ الحديث مطابقًا في المصدر، مع الحكم والمرجع.",
      different_wording: "النص قريب من آية أو حديث لكنه غير مطابق، ويُعرض اللفظ الصحيح من المصدر.",
      weak_or_fabricated: "حكم عليه العلماء بالضعف أو الوضع، مع أسمائهم ومراجعهم.",
      scholars_differed: "اختلفت أحكام العلماء، فيُعرض حكم كل عالم مع مرجعه دون ترجيح.",
      rulings_verbatim: "مصطلح حكم لا تعرفه الأداة، فيُعرض كما ورد في المصدر.",
      not_found: "النص غير موجود في المصادر المعتمدة، وهذا ليس حكمًا عليه.",
    },
  },
  en: {
    title: "Yaqeen",
    eyebrow: "An extension for Chrome and Edge",
    headline: "Check verses and hadith before you share them",
    label: "Paste an ayah or hadith",
    tagline: "Yaqeen matches the text against approved sources only, and shows the reference, the correct wording and the scholars' rulings as stated, with no fatwa.",
    tryIt: "Try it",
    placeholder: "Paste an ayah or hadith to verify…",
    go: "Verify",
    feed: "Sample posts",
    feedNote: "Posts written for this demo, shown as they appear on X, Facebook and TikTok with the extension.",
    check: "Check post",
    nothing: "No ayah or hadith was found in this text to verify.",
    dorarDown: "The text is not in the local sources, and Dorar could not be reached right now. Please try again shortly.",
    loading: "Loading source data…",
    loadError: "Could not load the source data.",
    sources: "Sources: QuranEnc quranenc.com · HadeethEnc hadeethenc.com · Dorar dorar.net",
    demoNote: "This demo leaves out meaning-based matching, which is in the extension. Photos and videos are read inside your browser.",
    other: "العربية",
    tabs: { try: "Try it", media: "Photo or video", post: "On a post", popup: "Popup", settings: "Settings", types: "Result types" },
    mediaTitle: "Check a photo or video",
    mediaNote: "Upload a screenshot, photo, or a video saved from TikTok, X or Facebook. Yaqeen reads the text in the image and turns the speech in the video into text, then checks it. All of this happens in your browser; the file is never uploaded.",
    contentLang: "What language is the content in?",
    contentLangs: { ar: "Arabic", en: "English" },
    pick: "Choose a photo or video",
    drop: "or drag and drop the file here",
    sample: "Try a sample image",
    sampleText: "قال تعالى: يا أيها الذين آمنوا استعينوا بالصبر والدعاء إن الله مع الصابرين",
    steps: { ocr: "Reading the text in the image…", model: "Downloading the speech-to-text model (once, about 250 MB)", listen: "Listening to the speech in the video…", frames: "Reading the text shown in the video…" },
    found: "The text we found (you can correct it and check again)",
    speech: "Speech",
    onScreen: "On-screen text",
    recheck: "Check this text",
    noText: "We found no readable text in this file. Try a clearer image, or a video with clear speech.",
    mediaError: "This file could not be read. Try a JPG or PNG image, or an MP4 video.",
    details: "Technical details (send these to us if the problem continues)",
    speechError: "We could not read this video on this device. Speech-to-text does not run on iPhone or iPad, and if the video shows no written text there is nothing to read. Try Chrome or Edge on a computer.",
    asrNote: "Speech-to-text is automatic and can make mistakes, especially with recitation. Review the text before relying on the result.",
    tiktokNote: "For a TikTok video: save it to your device first, then upload it here.",
    postNote: "This is how Yaqeen appears under a post on X: press the Yaqeen button to see the result.",
    popupNote: "This window opens from the Yaqeen icon in the browser toolbar.",
    popupLabel: "Paste an ayah or hadith to verify",
    popupFoot: "Approved sources only · No rulings issued",
    settingsNote: "A preview of the extension's settings page. Settings here are for display only.",
    settingsTitle: "Yaqeen settings",
    data: "Source data",
    ayat: "Quran ayat",
    ahadith: "HadeethEnc hadith",
    langLabel: "Interface language",
    langAuto: "Follow browser",
    auto: "Check posts automatically while browsing",
    dorarOpt: "Search Dorar for hadith not found locally",
    dorarHint: "Only the extracted hadith text is sent to dorar.net",
    semOpt: "Meaning-based matching on the device",
    semHint: "Downloads a language model once, about 280 MB",
    typesNote: "Every result carries one of these labels, in its colour.",
    meanings: {
      quran_exact: "The verse matches the Mushaf text word for word, with surah and ayah.",
      hadith_authentic: "The hadith wording was found exactly in the source, with its grading and reference.",
      different_wording: "Close to a verse or hadith but not exact; the correct wording from the source is shown.",
      weak_or_fabricated: "Scholars graded it weak or fabricated, shown with their names and references.",
      scholars_differed: "Scholars' rulings differ, so each is shown with its reference, with no preference.",
      rulings_verbatim: "A grading term the tool does not recognise, shown as the source states it.",
      not_found: "Not in the approved sources. This is not a ruling on the text.",
    },
  },
};

const SAMPLES = [
  { user: "نور", text: "قال تعالى: ﴿يا أيها الذين آمنوا استعينوا بالصبر والصلاة إن الله مع الصابرين﴾" },
  { user: "سارة", text: "قال تعالى: يا أيها الذين آمنوا استعينوا بالصبر والدعاء إن الله مع الصابرين 🤍" },
  { user: "أحمد", text: "قال رسول الله ﷺ: إنما الأعمال بالنيات وإنما لكل امرئ ما نوى" },
  { user: "ليلى", text: "قال رسول الله ﷺ: من كان يؤمن بالله واليوم الآخر فليقل خيرا أو ليسكت" },
  { user: "خالد", text: "قال رسول الله صلى الله عليه وسلم: اطلبوا العلم ولو بالصين فإن طلب العلم فريضة على كل مسلم" },
  { user: "مريم", text: "صباح الخير يا أصدقاء، الجو اليوم جميل جدا ونتمنى لكم يوما سعيدا ☀️" },
];

let lang: Lang = (() => {
  try {
    const saved = localStorage.getItem("yaqeen-lang");
    if (saved === "ar" || saved === "en") return saved;
  } catch {}
  return navigator.language.toLowerCase().startsWith("ar") ? "ar" : "en";
})();

type View = "try" | "media" | "post" | "popup" | "settings" | "types";
const viewFromHash = (): View =>
  (["try", "media", "post", "popup", "settings", "types"] as const).find((v) => v === location.hash.slice(1)) ?? "try";
let view: View = viewFromHash();
addEventListener("hashchange", () => {
  if (viewFromHash() === view) return;
  view = viewFromHash();
  render();
});

const KIND_ORDER = ["quran_exact", "hadith_authentic", "different_wording", "weak_or_fabricated", "scholars_differed", "rulings_verbatim", "not_found"] as const;

let counts = { ayat: 0, hadith: 0 };
let indexes: Promise<{ quran: QuranIndex; hadith: HadithIndex }> | null = null;
function loadIndexes() {
  indexes ??= Promise.all([
    fetch("data/quran.json").then((r) => r.json() as Promise<Ayah[]>),
    fetch("data/hadeethenc.json").then((r) => r.json() as Promise<EncHadith[]>),
  ]).then(([ayat, ahadith]) => {
    counts = { ayat: ayat.length, hadith: ahadith.length };
    return { quran: new QuranIndex(ayat), hadith: new HadithIndex(ahadith) };
  });
  return indexes;
}

async function dorar(text: string) {
  // Same short query the extension sends: Dorar's search fails on long text.
  const res = await fetch(`/api/dorar?q=${encodeURIComponent(dorarQuery(text))}`);
  if (!res.ok) throw new Error(`Dorar ${res.status}`);
  return parseDorarHtml(dorarResultHtml(await res.json()));
}

async function check(text: string, manual: boolean): Promise<CheckResult> {
  const { quran, hadith } = await loadIndexes();
  return checkPost(text, { quran, hadith, dorar, lang }, manual);
}

function resultHtml(r: CheckResult): string {
  if (r.incomplete && !r.verdicts.length) return `<p class="note">${esc(TEXT[lang].dorarDown)}</p>`;
  return r.verdicts.map((v) => cardHtml(v, lang)).join("") || `<p class="field__value">${esc(TEXT[lang].nothing)}</p>`;
}

function render() {
  const x = TEXT[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  const app = document.getElementById("app")!;
  app.setAttribute("lang", lang);
  const tabs = (Object.keys(x.tabs) as View[])
    .map((v) => `<a class="tab" href="#${v}" data-view="${v}" ${v === view ? 'aria-current="page"' : ""}>${esc(x.tabs[v])}</a>`)
    .join("");
  app.innerHTML = `
    <header class="topbar"><div class="wrap">
      <span class="logo">${markSvg(40)}${esc(x.title)}</span>
      <button class="btn btn--secondary" id="lang">${esc(x.other)}</button>
    </div></header>
    <section class="hero"><div class="wrap">
      <div class="hero__text">
        <p class="eyebrow">${esc(x.eyebrow)}</p>
        <h1>${esc(x.headline)}</h1>
        <p class="tagline">${esc(x.tagline)}</p>
      </div>
      ${markSvg(180, { faded: true })}
    </div></section>
    <nav class="tabs"><div class="wrap">${tabs}</div></nav>
    <p id="status" class="muted wrap" hidden></p>
    <main class="wrap view">${viewHtml(x)}</main>
    <footer class="footer"><div class="wrap">
      <p class="muted">${esc(x.sources)}</p>
      <p class="muted">${esc(x.demoNote)}</p>
      <p class="muted">${esc(t(lang).disclaimer)}</p>
    </div></footer>`;

  document.querySelectorAll<HTMLAnchorElement>("a[data-view]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      view = a.dataset.view as View;
      history.replaceState(null, "", `#${view}`);
      render();
    }),
  );
  document.getElementById("lang")!.addEventListener("click", () => {
    lang = lang === "ar" ? "en" : "ar";
    try {
      localStorage.setItem("yaqeen-lang", lang);
    } catch {}
    render();
  });

  const status = document.getElementById("status")!;
  if (!indexesReady) {
    status.hidden = false;
    status.textContent = x.loading;
    loadIndexes().then(
      () => ((indexesReady = true), (status.hidden = true)),
      () => (status.textContent = x.loadError),
    );
  }

  document.querySelector(".tab[aria-current]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  bindForm("form", "q", "out");
  bindForm("pform", "pq", "pout");
  bindForm("mform", "mq", "mout");
  bindMedia();
  document.querySelectorAll<HTMLElement>(".post").forEach(bindPost);
  void loadIndexes().then(() => {
    const a = document.getElementById("nAyat"), h = document.getElementById("nHadith");
    if (a) a.textContent = String(counts.ayat);
    if (h) h.textContent = String(counts.hadith);
  });
  if (view === "post") document.querySelector<HTMLButtonElement>(".post .yq-chip")?.click();
}

function viewHtml(x: (typeof TEXT)[Lang]): string {
  switch (view) {
    case "media":
      return `<div class="grid">
        <section class="panel">
          <h2>${esc(x.mediaTitle)}</h2>
          <p class="muted">${esc(x.mediaNote)}</p>
          <fieldset class="seg">
            <legend>${esc(x.contentLang)}</legend>
            ${(["ar", "en"] as const).map((l) => `<label><input type="radio" name="clang" value="${l}"${l === contentLang ? " checked" : ""}><span>${esc(x.contentLangs[l])}</span></label>`).join("")}
          </fieldset>
          <label class="drop" id="drop">
            <input type="file" id="file" accept="image/*,video/*,audio/*" hidden>
            <span class="btn btn--primary">${esc(x.pick)}</span>
            <span class="muted">${esc(x.drop)}</span>
          </label>
          <button class="btn btn--secondary" id="sample" type="button">${esc(x.sample)}</button>
          <p class="muted">${esc(x.tiktokNote)}</p>
          <div id="preview" class="preview"></div>
        </section>
        <section class="panel" id="mpanel" hidden>
          <ol class="steps" id="steps"></ol>
          <form class="form" id="mform" hidden>
            <label for="mq">${esc(x.found)}</label>
            <textarea id="mq" dir="auto"></textarea>
            <p class="muted" id="asrnote" hidden>${esc(x.asrNote)}</p>
            <button class="btn btn--primary" type="submit">${esc(x.recheck)}</button>
          </form>
          <div id="mout" aria-live="polite"></div>
        </section>
      </div>`;
    case "post":
      return `<p class="muted">${esc(x.postNote)}</p>
        <article class="post post--x" data-i="1">
          <div class="post__user"><span class="avatar">${esc(SAMPLES[1]!.user[0])}</span><span class="who"><b>${esc(SAMPLES[1]!.user)}</b><span class="muted">@sara · 2h</span></span></div>
          <p class="post__text" dir="auto">${esc(SAMPLES[1]!.text)}</p>
          <div class="post__yq"><button class="yq-chip post__check">${CHIP_MARK}${esc(t(lang).yaqeen)}</button><div class="post__badges"></div></div>
          <div class="post__cards"></div>
          <div class="post__actions muted"><span>💬</span><span>🔁</span><span>♡</span><span>↗</span></div>
        </article>`;
    case "popup":
      return `<p class="muted">${esc(x.popupNote)}</p>
        <div class="browser">
          <div class="browser__bar"><span class="browser__dots"><i></i><i></i><i></i></span><span class="browser__url">x.com</span><span class="browser__icon">${markSvg(22)}</span></div>
          <div class="popup">
            <div class="popup__head"><span class="logo logo--sm">${markSvg(36)}${esc(x.title)}</span><a href="#settings" class="popup__link" data-view="settings">${esc(x.tabs.settings)}</a></div>
            <form class="form" id="pform"><label for="pq">${esc(x.popupLabel)}</label><textarea id="pq" placeholder="${esc(x.placeholder)}"></textarea><button class="btn btn--primary" type="submit">${esc(x.go)}</button></form>
            <div id="pout" aria-live="polite"></div>
            <p class="muted foot">${esc(x.popupFoot)}</p>
          </div>
        </div>`;
    case "settings": {
      const toggle = (label: string, hint?: string) =>
        `<label class="toggle"><span>${esc(label)}${hint ? `<br><small class="muted">${esc(hint)}</small>` : ""}</span><input type="checkbox" checked></label>`;
      return `<p class="muted">${esc(x.settingsNote)}</p>
        <div class="settings">
          <header class="settings__head">${markSvg(44)}<h2>${esc(x.settingsTitle)}</h2></header>
          <section class="panel">
            <h3>${esc(x.data)}</h3>
            <div class="stats"><div class="stat stat--quran"><span>${esc(x.ayat)}</span><b id="nAyat">…</b></div><div class="stat stat--hadith"><span>${esc(x.ahadith)}</span><b id="nHadith">…</b></div></div>
          </section>
          <section class="panel">
            <label class="toggle"><span>${esc(x.langLabel)}</span><select><option>العربية</option><option>English</option><option>${esc(x.langAuto)}</option></select></label>
            ${toggle(x.auto)}${toggle(x.dorarOpt, x.dorarHint)}${toggle(x.semOpt, x.semHint)}
          </section>
        </div>`;
    }
    case "types":
      return `<p class="muted">${esc(x.typesNote)}</p>
        <div class="types">${KIND_ORDER.map(
          (k) => `<div class="type card" data-type="${TYPE[k]}"><span class="badge" data-type="${TYPE[k]}"><i class="dot"></i>${esc(t(lang).kinds[k])}</span><p>${esc(x.meanings[k])}</p></div>`,
        ).join("")}</div>`;
    default:
      return `<div class="grid">
        <section class="panel">
          <h2>${esc(x.tryIt)}</h2>
          <form class="form" id="form">
            <label for="q">${esc(x.label)}</label>
            <textarea id="q" placeholder="${esc(x.placeholder)}"></textarea>
            <button class="btn btn--primary" type="submit">${esc(x.go)}</button>
          </form>
          <div id="out" aria-live="polite"></div>
        </section>
        <div class="col">
          <h2>${esc(x.feed)}</h2>
          <p class="muted">${esc(x.feedNote)}</p>
          ${SAMPLES.map(
            (p, i) => `
            <article class="post" data-i="${i}">
              <div class="post__user"><span class="avatar">${esc(p.user[0])}</span><b>${esc(p.user)}</b></div>
              <p class="post__text" dir="auto">${esc(p.text)}</p>
              <div class="post__yq"><button class="btn post__check">${esc(x.check)}</button><div class="post__badges"></div></div>
              <div class="post__cards"></div>
            </article>`,
          ).join("")}
        </div>
      </div>`;
  }
}

/** The language of the uploaded content; it decides which reading model is used. */
let contentLang: media.ContentLang = "ar";

function bindMedia() {
  const input = document.getElementById("file") as HTMLInputElement | null;
  if (!input) return;
  document.querySelectorAll<HTMLInputElement>('input[name="clang"]').forEach((r) =>
    r.addEventListener("change", () => (contentLang = r.value as media.ContentLang)),
  );
  const drop = document.getElementById("drop")!;
  input.addEventListener("change", () => input.files?.[0] && void handleFile(input.files[0]));
  drop.addEventListener("dragover", (e) => (e.preventDefault(), drop.classList.add("drop--over")));
  drop.addEventListener("dragleave", () => drop.classList.remove("drop--over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("drop--over");
    const f = e.dataTransfer?.files[0];
    if (f) void handleFile(f);
  });
  document.getElementById("sample")!.addEventListener("click", () => void sampleImage().then(handleFile));
}

/** A post-style image with a misquoted verse, drawn here so the demo needs no outside picture. */
async function sampleImage(): Promise<File> {
  await document.fonts.load("600 34px Cairo");
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 600;
  const g = c.getContext("2d")!;
  g.fillStyle = "#FFFFFF";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#0F1419";
  g.direction = "rtl";
  g.textAlign = "right";
  g.font = "600 40px Cairo, sans-serif";
  const words = TEXT[lang].sampleText.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width > 940 && line) (lines.push(line), (line = w));
    else line = next;
  }
  lines.push(line);
  lines.forEach((l, i) => g.fillText(l, 1020, 200 + i * 80));
  const blob = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), "image/png"));
  return new File([blob], "sample.png", { type: "image/png" });
}

/** The run's technical log, folded away, for when something goes wrong. */
function details(): string {
  return `<details class="diag"><summary>${esc(TEXT[lang].details)}</summary><pre dir="ltr">${esc(media.diag.join("\n"))}</pre></details>`;
}

async function handleFile(file: File) {
  const x = TEXT[lang];
  const panel = document.getElementById("mpanel")!;
  const steps = document.getElementById("steps")!;
  const form = document.getElementById("mform")!;
  const box = document.getElementById("mq") as HTMLTextAreaElement;
  const out = document.getElementById("mout")!;
  const preview = document.getElementById("preview")!;
  const url = URL.createObjectURL(file);
  const isImage = file.type.startsWith("image/");
  preview.innerHTML = isImage ? `<img src="${url}" alt="">` : file.type.startsWith("video/") ? `<video src="${url}" controls muted playsinline></video>` : `<audio src="${url}" controls></audio>`;
  panel.hidden = false;
  form.hidden = true;
  out.innerHTML = "";
  steps.innerHTML = "";
  const shown = new Map<string, HTMLLIElement>();
  const step: Progress = (k, pct) => {
    let li = shown.get(k);
    if (!li) {
      shown.forEach((el) => el.classList.add("done"));
      li = document.createElement("li");
      shown.set(k, li);
      steps.append(li);
    }
    li.textContent = x.steps[k] + (pct != null && k === "model" ? ` ${pct}%` : "");
  };
  try {
    media.diag.length = 0;
    media.diag.push(`content language: ${contentLang}`, `file: ${file.type || "unknown type"}, ${(file.size / 1e6).toFixed(1)} MB`, `browser: ${navigator.userAgent.match(/(Edg|Chrome|Firefox|Version)\/[\d.]+/g)?.join(" ") ?? navigator.userAgent}`, `threads: ${crossOriginIsolated ? navigator.hardwareConcurrency : 1}`);
    let text = "";
    let speechFailed = false;
    if (isImage) {
      step("ocr");
      text = await media.readImage(file, contentLang);
    } else {
      // The text shown in the video is read first: it is quick and needs no download, so a
      // result appears even when the speech model cannot run on this device.
      const screen = file.type.startsWith("video/") ? await media.readFrames(file, contentLang, step) : "";
      // Either part can fail on its own (no audio track, model download blocked); keep what works.
      const speech = media.canListen().ok
        ? await media.listen(file, contentLang, step).catch((e) => (console.error(e), media.diag.push(`speech: failed (${e})`), (speechFailed = true), ""))
        : ((media.diag.push(`speech: not attempted (${media.canListen().why})`), (speechFailed = !screen)), "");
      text = [screen, speech].filter(Boolean).join("\n");
      document.getElementById("asrnote")!.hidden = !speech;
    }
    shown.forEach((el) => el.classList.add("done"));
    if (!text) {
      out.innerHTML = `<p class="note">${esc(speechFailed ? x.speechError : x.noText)}</p>${details()}`;
      return;
    }
    box.value = text;
    form.hidden = false;
    out.innerHTML = `<p class="field__value">${esc(t(lang).checking)}</p>`;
    out.innerHTML = (await check(text, true).then(resultHtml, () => `<p class="note">${esc(t(lang).error)}</p>`)) + details();
    bindCopy(out);
  } catch (e) {
    console.error(e);
    media.diag.push(`error: ${e}`);
    shown.forEach((el) => el.classList.add("done"));
    out.innerHTML = `<p class="note">${esc(x.mediaError)}</p>${details()}`;
  }
}

function bindForm(formId: string, inputId: string, outId: string) {
  const form = document.getElementById(formId);
  if (!form) return;
  const out = document.getElementById(outId)!;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = (document.getElementById(inputId) as HTMLTextAreaElement).value.trim();
    if (!text) return;
    out.innerHTML = `<p class="field__value">${esc(t(lang).checking)}</p>`;
    out.innerHTML = await check(text, true).then(resultHtml, () => `<p class="note">${esc(t(lang).error)}</p>`);
    bindCopy(out);
  });
}

function bindPost(post: HTMLElement) {
  const btn = post.querySelector<HTMLButtonElement>(".post__check")!;
  btn.addEventListener("click", async () => {
    const cards = post.querySelector<HTMLElement>(".post__cards")!;
    const badges = post.querySelector<HTMLElement>(".post__badges")!;
    if (cards.innerHTML) {
      cards.innerHTML = "";
      return;
    }
    btn.disabled = true;
    badges.textContent = t(lang).checking;
    const r = await check(SAMPLES[Number(post.dataset.i)]!.text, false).catch(() => null);
    btn.disabled = false;
    badges.innerHTML = r ? r.verdicts.map((v) => badgeHtml(v, lang)).join(" ") : "";
    cards.innerHTML = r ? resultHtml(r) : `<p class="note">${esc(t(lang).error)}</p>`;
    if (r && !r.religious) cards.innerHTML = `<p class="field__value">${esc(TEXT[lang].nothing)}</p>`;
    bindCopy(cards);
  });
}

let indexesReady = false;
render();
