# يقين (Yaqeen)

> **الإضافة:** إضافة المتصفح (Chrome وEdge) لفحص منشورات X وFacebook وTikTok موجودة في مجلد [`extension/`](extension/README.md)، وتعمل على الجهاز دون الحاجة لتشغيل الخدمة أدناه.
>
> **خطوات الاختبار:** كل طرق اختبار المشروع بنفسك في [TESTING.md](TESTING.md).

```
yaqeen/
├── web/          الواجهات (index.html الصفحة الرئيسية، popup.html نافذة الإضافة)
│   ├── index.html
│   ├── popup.html
│   ├── styles.css
│   └── cards.js
├── backend/      خدمة التحقق (Python)
│   ├── main.py          الخدمة /verify
│   ├── hadith.py        البحث في الدرر السنية والتصنيف
│   ├── test_hadith.py   اختبارات تعمل دون إنترنت
│   ├── requirements.txt / requirements-dev.txt
│   └── run.bat / run.sh تشغيل بنقرة
└── extension/    إضافة المتصفح (TypeScript)
```

## تشغيل الواجهات (بدون تثبيت أي شيء)
افتح `web/index.html` في المتصفح بنقرتين. في VS Code يمكنك تثبيت إضافة **Live Server**
وتضغط بالزر الأيمن على الملف ثم **Open with Live Server**.

## تشغيل الخدمة (للتحقق من الأحاديث)
1. ثبّت Python من python.org (فعّل **Add to PATH**).
2. في VS Code: Terminal ← New Terminal، ثم:
   ```
   cd backend
   ```
3. ويندوز: شغّل `run.bat`  ·  ماك/لينكس: `./run.sh`
   (يثبّت المكتبات ويشغّل الخدمة على http://127.0.0.1:8000)
4. جرّب الخدمة: http://127.0.0.1:8000/docs ← POST /verify ← Try it out
   ```
   {"text": "إنما الأعمال بالنيات"}
   ```
5. افتح `web/popup.html` واكتب نصًا في خانة التحقق وسترى البطاقة.

## ملاحظات
- بيانات `samples` في `web/cards.js` أمثلة تجريبية للعرض فقط.
- خدمة Python تتحقق من الأحاديث فقط؛ مطابقة القرآن موجودة في الإضافة (`extension/`).
- أسماء التصنيفات وألفاظ الأحكام موحّدة بين `backend/hadith.py` و`web/cards.js` والإضافة؛ أي تعديل عليها يكون في المواضع الثلاثة.
- قيّد `allow_origins` في `backend/main.py` قبل أي نشر.
- أظهر اسم «الدرر السنية» مصدرًا للأحكام، وراسلهم بالإذن قبل أي استخدام موسّع.
