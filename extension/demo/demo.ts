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

const TEXT = {
  ar: {
    title: "يقين",
    eyebrow: "إضافة لمتصفحي Chrome وEdge",
    headline: "تحقق من الآيات والأحاديث من المصادر المعتمدة",
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
    demoNote: "نسخة العرض لا تشمل المطابقة بالمعنى، وهي متاحة في الإضافة. قراءة الصور تتم داخل متصفحك.",
    picTitle: "تحقّق من صورة",
    picNote: "ارفع لقطة شاشة أو صورة منشور فيها آية أو حديث باللغة العربية. يقرأ يقين النص العربي المكتوب في الصورة، حتى بالخطوط المزخرفة، ثم يتحقق منه. تتم القراءة داخل متصفحك ولا تُرفع الصورة إلى أي خادم.",
    pick: "اختر صورة",
    drop: "أو اسحب الصورة وأفلتها هنا",
    reading: "جارٍ قراءة النص في الصورة… (أول مرة تستغرق وقتًا أطول لتحميل نموذج القراءة)",
    found: "النص الذي وجدناه (راجعه وصحّحه إن لزم، ثم أعد التحقق)",
    recheck: "تحقق من النص",
    ocrNote: "القراءة الآلية للصور قد تخطئ في بعض الحروف، خاصة في الخطوط الشديدة الزخرفة. راجع النص قبل الاعتماد على النتيجة.",
    noText: "لم نجد نصًا مقروءًا في هذه الصورة. جرّب صورة أوضح، أو اكتب النص بنفسك في «جرّب بنفسك».",
    picError: "تعذرت قراءة هذا الملف. جرّب صورة JPG أو PNG.",
    notPicture: "هذه النسخة تقرأ الصور فقط.",
    other: "English",
    tabs: { try: "جرّب بنفسك", picture: "صورة", post: "على منشور", popup: "النافذة المنبثقة", install: "التثبيت", settings: "الإعدادات" },
    install: {
      tab: "التثبيت",
      cta: "أضف يقين إلى المتصفح",
      title: "أضف يقين إلى متصفحك",
      storeBtn: (b: string) => `أضف إلى ${b}`,
      storeNote: "تفتح صفحة يقين في متجر الإضافات، اضغط فيها «إضافة» أو «Get» وسيعمل يقين مباشرة.",
      soon: "سيصبح التثبيت بضغطة واحدة عند نشر يقين في متجر الإضافات. إلى ذلك الحين، ثبّته بالخطوات التالية مرة واحدة فقط (حوالي دقيقتين، دون أي برمجة).",
      download: "تنزيل يقين",
      size: "ملف مضغوط، حوالي 19 ميجابايت",
      steps: [
        ["نزّل الملف", "اضغط زر «تنزيل يقين» بالأعلى، وسيُحفظ الملف yaqeen-extension.zip في مجلد التنزيلات."],
        ["افتح الملف المضغوط", "على Mac: اضغط على الملف مرتين فيظهر بجانبه مجلد yaqeen-extension. على Windows: اضغط عليه بالزر الأيمن ثم «استخراج الكل» (Extract All). لا تحذف هذا المجلد بعد التثبيت."],
        ["افتح صفحة الإضافات", "انسخ هذا العنوان والصقه في شريط العنوان ثم اضغط Enter:"],
        ["فعّل «وضع المطوّر»", "Developer mode: في Edge تجده أسفل القائمة الجانبية، وفي Chrome أعلى الصفحة. هذا يسمح بتثبيت الإضافة من ملف."],
        ["اضغط «تحميل غير المضغوط»", "Load unpacked، ثم اختر مجلد yaqeen-extension الذي استخرجته."],
        ["نزّل بيانات المصادر", "تفتح صفحة إعدادات يقين تلقائيًا: اضغط «تنزيل البيانات الآن» وانتظر حتى يظهر عدد الآيات (6236). بعدها اضغط أيقونة يقين بجانب شريط العنوان، أو افتح X أو Facebook."],
      ],
      copy: "نسخ",
      copied: "تم النسخ",
      other: "يعمل يقين في متصفحي Edge وChrome على الحاسوب (Windows وMac). لا يمكن تثبيت الإضافات على الجوال أو iPad، لكن يمكنك تجربة يقين في هذه الصفحة.",
      pin: "نصيحة: اضغط أيقونة الإضافات (قطعة البازل) ثم الدبوس بجانب يقين ليبقى ظاهرًا بجانب شريط العنوان.",
      mockLoad: "تحميل غير المضغوط",
      mockDev: "وضع المطوّر",
    },
    postNote: "صورة توضيحية لمنشور على X كما يظهر في الهاتف. الزر الوحيد الذي يعمل هو زر يقين تحت المنشور.",
    postBar: "منشور",
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
    typesTitle: "النتائج التي قد تظهر لك",
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
    headline: "Verify Quranic verses and hadiths using trusted sources",
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
    demoNote: "This demo leaves out meaning-based matching, which is in the extension. Pictures are read inside your browser.",
    picTitle: "Check a picture",
    picNote: "Upload a screenshot or a post picture with an ayah or hadith in Arabic. Yaqeen reads the Arabic text in it, decorative fonts included, then checks it. Reading happens in your browser; the picture is never uploaded.",
    pick: "Choose a picture",
    drop: "or drag and drop it here",
    reading: "Reading the text in the picture… (the first time takes longer while the reading model loads)",
    found: "The text we found (review and correct it if needed, then check again)",
    recheck: "Check this text",
    ocrNote: "Automatic reading can get some letters wrong, especially in very decorative fonts. Review the text before relying on the result.",
    noText: "We found no readable text in this picture. Try a clearer one, or type the text yourself under \"Try it\".",
    picError: "This file could not be read. Try a JPG or PNG picture.",
    notPicture: "This demo reads pictures only.",
    other: "العربية",
    tabs: { try: "Try it", picture: "Picture", post: "On a post", popup: "Popup", install: "Install", settings: "Settings" },
    install: {
      tab: "Install",
      cta: "Add Yaqeen to your browser",
      title: "Add Yaqeen to your browser",
      storeBtn: (b: string) => `Add to ${b}`,
      storeNote: "Yaqeen's page in the add-ons store opens; press Get or Add and Yaqeen works right away.",
      soon: "Installing will be one click once Yaqeen is published in the add-ons stores. Until then, install it with these steps, once (about two minutes, no coding).",
      download: "Download Yaqeen",
      size: "Zip file, about 19 MB",
      steps: [
        ["Download the file", "Press Download Yaqeen above. The file yaqeen-extension.zip is saved to your Downloads folder."],
        ["Open the zip file", "On a Mac: double-click it and a yaqeen-extension folder appears next to it. On Windows: right-click it and choose Extract All. Keep this folder after installing."],
        ["Open the extensions page", "Copy this address, paste it in the address bar and press Enter:"],
        ["Turn on Developer mode", "In Edge it is at the bottom of the left menu; in Chrome it is at the top right. It allows installing an extension from a folder."],
        ["Press Load unpacked", "Then choose the yaqeen-extension folder you extracted."],
        ["Download the source data", "Yaqeen's settings page opens by itself: press Download data now and wait until the ayat count (6236) shows. Then press the Yaqeen icon next to the address bar, or open X or Facebook."],
      ],
      copy: "Copy",
      copied: "Copied",
      other: "Yaqeen works in Edge and Chrome on a computer (Windows or Mac). Phones and iPads cannot add extensions, but you can try Yaqeen on this page.",
      pin: "Tip: press the extensions icon (the puzzle piece), then the pin next to Yaqeen, so it stays next to the address bar.",
      mockLoad: "Load unpacked",
      mockDev: "Developer mode",
    },
    postNote: "An illustration of a post on X as it appears on a phone. The only working button is the Yaqeen button under the post.",
    postBar: "Post",
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
    typesTitle: "The results you may see",
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

/**
 * Store listings. Once Yaqeen is published, put each listing's address here and the Install page
 * shows a one-click "Add to Edge / Chrome" button instead of the manual steps.
 */
const STORE: Record<Browser, string> = { edge: "", chrome: "" };
type Browser = "edge" | "chrome";
const BROWSER_NAME: Record<Browser, string> = { edge: "Edge", chrome: "Chrome" };
const browser: Browser | null = (() => {
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|Mobile/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return null;
  if (/Edg\//.test(ua)) return "edge";
  if (/Chrome\//.test(ua) && !/OPR\/|Brave/.test(ua)) return "chrome";
  return null;
})();

type View = "try" | "picture" | "post" | "popup" | "install" | "settings";
const viewFromHash = (): View =>
  (["try", "picture", "post", "popup", "install", "settings"] as const).find((v) => v === location.hash.slice(1)) ?? "try";
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
  const tabs = (["try", "picture", "post", "popup", "install"] as const)
    .map((v) => `<a class="tab" href="#${v}" data-view="${v}" ${v === view ? 'aria-current="page"' : ""}>${esc(x.tabs[v])}</a>`)
    .join("");
  app.innerHTML = `
    <header class="topbar"><div class="wrap">
      <span class="logo">${markSvg(40)}${esc(x.title)}</span>
      <div class="topbar__actions">
        <a class="btn btn--secondary" href="#settings" data-view="settings" ${view === "settings" ? 'aria-current="page"' : ""}>${GEAR}${esc(x.tabs.settings)}</a>
        <button class="btn btn--secondary" id="lang">${esc(x.other)}</button>
      </div>
    </div></header>
    <section class="hero"><div class="wrap">
      <div class="hero__text">
        <p class="eyebrow">${esc(x.eyebrow)}</p>
        <h1>${esc(x.headline)}</h1>
        <p class="tagline">${esc(x.tagline)}</p>
        ${view === "install" ? "" : `<a class="btn btn--install" href="#install" data-view="install">${DOWNLOAD}${esc(x.install.cta)}</a>`}
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
  bindPicture();
  document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((b) =>
    b.addEventListener("click", () => {
      void navigator.clipboard?.writeText(b.dataset.copy!).then(() => (b.textContent = x.install.copied));
    }),
  );
  document.querySelectorAll<HTMLElement>(".post").forEach(bindPost);
  void loadIndexes().then(() => {
    const a = document.getElementById("nAyat"), h = document.getElementById("nHadith");
    if (a) a.textContent = String(counts.ayat);
    if (h) h.textContent = String(counts.hadith);
  });
  if (view === "post") document.querySelector<HTMLButtonElement>(".post .yq-chip")?.click();
}

const GEAR = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`;

const DOWNLOAD = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M4 19h16"/></svg>`;

/** The manual install steps, each with a small drawing of what the person sees. */
function installHtml(x: (typeof TEXT)[Lang]): string {
  const i = x.install;
  const b = browser ?? "edge";
  const store = browser && STORE[browser];
  if (store)
    return `<section class="panel install install--store">
      <h2>${esc(i.title)}</h2>
      <a class="btn btn--primary btn--big" href="${esc(store)}" target="_blank" rel="noopener">${DOWNLOAD}${esc(i.storeBtn(BROWSER_NAME[browser]))}</a>
      <p class="muted">${esc(i.storeNote)}</p>
    </section>`;
  const page = `${b}://extensions`;
  const extPage = (hi: "dev" | "load" | "") => `<div class="mock mock--ext" aria-hidden="true">
      <div class="mock__bar"><span class="mock__url">${page}</span></div>
      <div class="mock__body">
        <span class="mock__dev ${hi === "dev" ? "hi" : ""}">${esc(i.mockDev)} <i class="sw on"></i></span>
        <span class="mock__btn ${hi === "load" ? "hi" : ""}">${esc(i.mockLoad)}</span>
      </div>
    </div>`;
  const art = [
    `<div class="mock mock--file" aria-hidden="true">${DOWNLOAD}<span>yaqeen-extension.zip</span></div>`,
    `<div class="mock mock--file" aria-hidden="true"><span class="folder"></span><span>yaqeen-extension</span></div>`,
    `<div class="mock mock--ext" aria-hidden="true"><div class="mock__bar"><span class="mock__url hi">${page}</span></div></div>`,
    extPage("dev"),
    extPage("load"),
    `<div class="mock mock--ext" aria-hidden="true"><div class="mock__body mock__body--col">${markSvg(28)}<span class="mock__btn hi">${esc(lang === "ar" ? "تنزيل البيانات الآن" : "Download data now")}</span></div></div>`,
  ];
  return `<section class="panel install">
      <h2>${esc(i.title)}</h2>
      ${browser ? "" : `<p class="note">${esc(i.other)}</p>`}
      <p class="muted">${esc(i.soon)}</p>
      <a class="btn btn--primary btn--big" href="yaqeen-extension.zip" download>${DOWNLOAD}${esc(i.download)}</a>
      <p class="muted">${esc(i.size)}</p>
    </section>
    <ol class="steps">${i.steps
      .map(
        ([h, p], n) => `<li class="step panel">
          <span class="step__n">${n + 1}</span>
          <div class="step__text"><h3>${esc(h)}</h3><p>${esc(p)}</p>
            ${n === 2 ? `<p class="copyline"><code dir="ltr">${page}</code><button class="btn btn--secondary btn--small" data-copy="${page}">${esc(i.copy)}</button></p>` : ""}
          </div>
          ${art[n]}
        </li>`,
      )
      .join("")}</ol>
    <p class="muted center">${esc(i.pin)}</p>`;
}

/** Reply, repost, like and share, drawn as thin grey outlines so they read as part of the picture. */
const ICONS = [
  "M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z",
  "M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3",
  "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z",
  "M4 12v8h16v-8M16 6l-4-4-4 4M12 2v14",
].map((d) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="${d}"/></svg>`).join("");

function viewHtml(x: (typeof TEXT)[Lang]): string {
  switch (view) {
    case "picture":
      return `<div class="grid">
        <section class="panel">
          <h2>${esc(x.picTitle)}</h2>
          <p class="muted">${esc(x.picNote)}</p>
          <label class="drop" id="drop">
            <input type="file" id="file" accept="image/*" hidden>
            <span class="btn btn--primary">${esc(x.pick)}</span>
            <span class="muted">${esc(x.drop)}</span>
          </label>
          <div id="preview" class="preview"></div>
        </section>
        <section class="panel" id="mpanel" hidden>
          <p class="muted" id="mstatus"></p>
          <form class="form" id="mform" hidden>
            <label for="mq">${esc(x.found)}</label>
            <textarea id="mq" dir="auto"></textarea>
            <p class="muted">${esc(x.ocrNote)}</p>
            <button class="btn btn--primary" type="submit">${esc(x.recheck)}</button>
          </form>
          <div id="mout" aria-live="polite"></div>
        </section>
      </div>`;
    case "post":
      return `<p class="muted center">${esc(x.postNote)}</p>
        <div class="phone" aria-label="${esc(x.postNote)}">
          <div class="phone__status" aria-hidden="true"><span>9:41</span><span class="phone__notch"></span><span>●●● ▮</span></div>
          <div class="phone__bar" aria-hidden="true"><span>‹</span><b>${esc(x.postBar)}</b><span></span></div>
          <article class="post post--x" data-i="1">
            <div class="post__user"><span class="avatar">${esc(SAMPLES[1]!.user[0])}</span><span class="who"><b>${esc(SAMPLES[1]!.user)}</b><span class="muted">@sara · 2h</span></span></div>
            <p class="post__text" dir="auto">${esc(SAMPLES[1]!.text)}</p>
            <div class="post__yq"><button class="yq-chip post__check">${CHIP_MARK}${esc(t(lang).yaqeen)}</button><div class="post__badges"></div></div>
            <div class="post__cards"></div>
            <div class="post__actions" aria-hidden="true">${ICONS}</div>
          </article>
          <div class="phone__home" aria-hidden="true"></div>
        </div>`;
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
    case "install":
      return installHtml(x);
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
          <div class="legend">
            <h3>${esc(x.typesTitle)}</h3>
            <ul>${KIND_ORDER.map(
              (k) => `<li><span class="badge" data-type="${TYPE[k]}"><i class="dot"></i>${esc(t(lang).kinds[k])}</span><span class="muted">${esc(x.meanings[k])}</span></li>`,
            ).join("")}</ul>
          </div>
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

function bindPicture() {
  const input = document.getElementById("file") as HTMLInputElement | null;
  if (!input) return;
  const drop = document.getElementById("drop")!;
  input.addEventListener("change", () => input.files?.[0] && void handlePicture(input.files[0]));
  drop.addEventListener("dragover", (e) => (e.preventDefault(), drop.classList.add("drop--over")));
  drop.addEventListener("dragleave", () => drop.classList.remove("drop--over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("drop--over");
    const f = e.dataTransfer?.files[0];
    if (f) void handlePicture(f);
  });
}

async function handlePicture(file: File) {
  const x = TEXT[lang];
  const panel = document.getElementById("mpanel")!;
  const status = document.getElementById("mstatus")!;
  const form = document.getElementById("mform")!;
  const box = document.getElementById("mq") as HTMLTextAreaElement;
  const out = document.getElementById("mout")!;
  const preview = document.getElementById("preview")!;
  panel.hidden = false;
  form.hidden = true;
  out.innerHTML = "";
  if (!file.type.startsWith("image/")) {
    preview.innerHTML = "";
    status.textContent = x.notPicture;
    return;
  }
  const url = URL.createObjectURL(file);
  preview.innerHTML = `<img src="${url}" alt="">`;
  status.textContent = x.reading;
  try {
    const { readPicture } = await import("./picture");
    const text = await readPicture(file);
    status.textContent = "";
    if (!text) {
      out.innerHTML = `<p class="note">${esc(x.noText)}</p>`;
      return;
    }
    box.value = text;
    form.hidden = false;
    out.innerHTML = `<p class="field__value">${esc(t(lang).checking)}</p>`;
    // Lines in a picture are usually one quote wrapped to fit, so they are checked as one text.
    out.innerHTML = await check(text.replace(/\s*\n\s*/g, " "), true).then(resultHtml, () => `<p class="note">${esc(t(lang).error)}</p>`);
    bindCopy(out);
  } catch (e) {
    console.error(e);
    status.textContent = "";
    out.innerHTML = `<p class="note">${esc(x.picError)}</p>`;
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
