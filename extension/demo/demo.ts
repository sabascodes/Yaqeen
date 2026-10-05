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
import { bindCopy, badgeHtml, cardHtml, esc } from "../src/ui/card";
import { markSvg } from "../src/ui/logo";

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
    demoNote: "نسخة العرض لا تشمل المطابقة بالمعنى ولا قراءة الصور، وهما متاحتان في الإضافة.",
    other: "English",
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
    demoNote: "This demo leaves out meaning-based matching and reading images; both are in the extension.",
    other: "العربية",
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

let indexes: Promise<{ quran: QuranIndex; hadith: HadithIndex }> | null = null;
function loadIndexes() {
  indexes ??= Promise.all([
    fetch("data/quran.json").then((r) => r.json() as Promise<Ayah[]>),
    fetch("data/hadeethenc.json").then((r) => r.json() as Promise<EncHadith[]>),
  ]).then(([ayat, ahadith]) => ({ quran: new QuranIndex(ayat), hadith: new HadithIndex(ahadith) }));
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
    <main class="wrap grid">
      <section class="panel">
        <h2>${esc(x.tryIt)}</h2>
        <p id="status" class="muted" hidden></p>
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
          (s, i) => `
          <article class="post" data-i="${i}">
            <div class="post__user"><span class="avatar">${esc(s.user[0])}</span><b>${esc(s.user)}</b></div>
            <p class="post__text" dir="auto">${esc(s.text)}</p>
            <div class="post__yq"><button class="btn post__check">${esc(x.check)}</button><div class="post__badges"></div></div>
            <div class="post__cards"></div>
          </article>`,
        ).join("")}
      </div>
    </main>
    <footer class="footer"><div class="wrap">
      <p class="muted">${esc(x.sources)}</p>
      <p class="muted">${esc(x.demoNote)}</p>
      <p class="muted">${esc(t(lang).disclaimer)}</p>
    </div></footer>`;

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

  const out = document.getElementById("out")!;
  document.getElementById("form")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = (document.getElementById("q") as HTMLTextAreaElement).value.trim();
    if (!text) return;
    out.innerHTML = `<p class="field__value">${esc(t(lang).checking)}</p>`;
    out.innerHTML = await check(text, true).then(resultHtml, () => `<p class="note">${esc(t(lang).error)}</p>`);
    bindCopy(out);
  });

  document.querySelectorAll<HTMLElement>(".post").forEach((post) => {
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
  });
}

let indexesReady = false;
render();
