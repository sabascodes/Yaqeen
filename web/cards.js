/* =====================================================================
   cards.js — يرسم بطاقة النتيجة من كائن نتيجة بهذا الشكل:
   {
     type: 'quran' | 'hadith' | 'wording' | 'weak' | 'differed' | 'verbatim' | 'notfound',
     detected: 'النص المكتشف',
     source: 'المرجع',            // اختياري
     ruling: 'حكم العلماء',       // اختياري
     correct: 'اللفظ الصحيح',     // اختياري
     note: 'ملاحظة',              // اختياري
     confidence: 'high' | 'medium' | 'low',
     url: 'رابط المصدر'           // اختياري
   }
   هذا هو نفس الكائن card الذي تُرجعه خدمة /verify في backend/main.py.
   ===================================================================== */
const YQ = {
  text: {
    ar: {
      lbl: { quran: 'مطابق لنص المصحف', hadith: 'حديث ثابت', wording: 'ورد بلفظ مختلف', weak: 'ضعيف أو موضوع', differed: 'اختلف العلماء في الحكم عليه', verbatim: 'أحكام العلماء كما وردت في المصدر', notfound: 'لم نعثر على المصدر' },
      det: 'النص المكتشف', src: 'المصدر', rul: 'حكم العلماء', cor: 'اللفظ الصحيح للمشاركة',
      copy: 'نسخ اللفظ الصحيح', copied: 'تم النسخ', view: 'عرض المصدر',
      foot: 'نتيجة آلية من أداة يقين المدعومة بالذكاء الاصطناعي، مبنية على المصادر المعتمدة فقط، وليست فتوى ولا حكمًا من الأداة.',
      conf: { high: 'دقة المطابقة: عالية', medium: 'دقة المطابقة: متوسطة', low: 'دقة المطابقة: منخفضة' }
    },
    en: {
      lbl: { quran: 'Matches the Quran text', hadith: 'Authentic hadith', wording: 'Reported with different wording', weak: 'Weak or fabricated', differed: 'Scholars differed in grading it', verbatim: "Scholars' rulings as stated in the source", notfound: 'Source not found' },
      det: 'Detected text', src: 'Source', rul: "Scholars' ruling", cor: 'Correct wording to share',
      copy: 'Copy correct wording', copied: 'Copied', view: 'View source',
      foot: 'Automated result from Yaqeen, an AI-assisted tool, based only on approved sources. It is not a fatwa or a ruling by the tool.',
      conf: { high: 'Match confidence: High', medium: 'Match confidence: Medium', low: 'Match confidence: Low' }
    }
  },
  /* أمثلة تجريبية للعرض فقط — استبدلها ببيانات من مصادرك المعتمدة */
  samples: {
    quran:   { detected: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', source: { ar: 'سورة الشرح · الآية 6', en: 'Surah Ash-Sharh · Verse 6 (94:6)' }, confidence: 'high' },
    hadith:  { detected: 'إنما الأعمال بالنيات', source: { ar: 'صحيح البخاري · حديث رقم 1', en: 'Sahih al-Bukhari · Hadith no. 1' }, ruling: { ar: 'متفق عليه · البخاري ومسلم', en: 'Agreed upon · al-Bukhari and Muslim' }, confidence: 'high' },
    wording: { detected: 'إنما الأعمال بالنية', source: { ar: 'صحيح البخاري · حديث رقم 1', en: 'Sahih al-Bukhari · Hadith no. 1' }, correct: 'إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى', confidence: 'high' },
    weak:    { detected: 'اطلبوا العلم ولو في الصين', source: { ar: 'سلسلة الأحاديث الضعيفة · رقم 416', en: "Silsilat al-Ahadith al-Da'ifa · no. 416" }, ruling: { ar: 'ضعيف جدًا · الألباني', en: 'Very weak · Al-Albani' }, confidence: 'high' },
    differed:{ detected: 'مثال توضيحي لنص اختلف العلماء في الحكم عليه', ruling: { ar: 'العالم الأول: صحيح | العالم الثاني: إسناده ضعيف (مثال)', en: 'First scholar: sahih | Second scholar: weak chain (example)' }, confidence: 'medium' },
    notfound:{ detected: 'من قال هذا الذكر مئة مرة غُفرت ذنوبه كلها', note: { ar: 'لم نعثر على هذا النص في المصادر المعتمدة لدينا.', en: 'We could not find this text in our approved sources.' }, confidence: 'low' }
  }
};

YQ.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* يحوّل مثالًا تجريبيًا إلى كائن نتيجة بلغة محددة */
YQ.sample = (type, lang) => {
  const s = YQ.samples[type], pick = v => (v && typeof v === 'object') ? v[lang] : v;
  return { type, detected: s.detected, source: pick(s.source), ruling: pick(s.ruling), correct: s.correct, note: pick(s.note), confidence: s.confidence };
};

/* يرجع HTML للبطاقة */
YQ.card = (r, lang) => {
  const t = YQ.text[lang], e = YQ.esc;
  const field = (label, body) => `<div class="field"><span class="field__label">${e(label)}</span>${body}</div>`;
  let h = `<article class="card" data-type="${r.type}">`;
  h += `<div class="card__head"><span class="badge"><i class="dot"></i>${e(t.lbl[r.type])}</span><span class="conf">${e(t.conf[r.confidence || 'low'])}</span></div>`;
  h += field(t.det, `<blockquote class="scripture">${e(r.detected)}</blockquote>`);
  if (r.source)  h += field(t.src, `<span class="field__value">${e(r.source)}</span>`);
  if (r.ruling)  h += field(t.rul, `<span class="field__value field__value--ruling">${e(r.ruling)}</span>`);
  if (r.correct) h += field(t.cor, `<blockquote class="scripture scripture--correct">${e(r.correct)}</blockquote>`);
  if (r.note && r.type === 'notfound') h += `<p class="field__value">${e(r.note)}</p>`;
  if (r.note && r.type === 'verbatim') h += `<p class="field__value">${e(r.note)}</p>`;
  if (r.type !== 'notfound' && (r.correct || r.url)) {
    h += '<div class="card__actions">';
    if (r.correct) h += `<button class="btn btn--primary" type="button" data-copy="${e(r.correct)}" data-done="${e(t.copied)}">${e(t.copy)}</button>`;
    if (r.url) h += `<a class="btn btn--secondary" href="${e(r.url)}" target="_blank" rel="noopener">${e(t.view)}</a>`;
    h += '</div>';
  }
  return h + `<p class="card__foot">${e(t.foot)}</p></article>`;
};

/* زر النسخ */
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-copy]'); if (!b) return;
  navigator.clipboard.writeText(b.dataset.copy).then(() => {
    const old = b.textContent; b.textContent = b.dataset.done;
    setTimeout(() => { b.textContent = old; }, 1500);
  });
});
