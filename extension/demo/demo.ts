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
    demoNote: "نسخة العرض لا تشمل المطابقة بالمعنى، وهي متاحة في الإضافة.",
    other: "English",
    tabs: { try: "جرّب بنفسك", post: "على منشور", popup: "النافذة المنبثقة", settings: "الإعدادات" },
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
    demoNote: "This demo leaves out meaning-based matching, which is in the extension.",
    other: "العربية",
    tabs: { try: "Try it", post: "On a post", popup: "Popup", settings: "Settings" },
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

type View = "try" | "post" | "popup" | "settings";
const viewFromHash = (): View =>
  (["try", "post", "popup", "settings"] as const).find((v) => v === location.hash.slice(1)) ?? "try";
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
  const tabs = (["try", "post", "popup"] as const)
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
  document.querySelectorAll<HTMLElement>(".post").forEach(bindPost);
  void loadIndexes().then(() => {
    const a = document.getElementById("nAyat"), h = document.getElementById("nHadith");
    if (a) a.textContent = String(counts.ayat);
    if (h) h.textContent = String(counts.hadith);
  });
  if (view === "post") document.querySelector<HTMLButtonElement>(".post .yq-chip")?.click();
}

const GEAR = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`;

/** Reply, repost, like and share, drawn as thin grey outlines so they read as part of the picture. */
const ICONS = [
  "M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z",
  "M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3",
  "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z",
  "M4 12v8h16v-8M16 6l-4-4-4 4M12 2v14",
].map((d) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="${d}"/></svg>`).join("");

function viewHtml(x: (typeof TEXT)[Lang]): string {
  switch (view) {
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
