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
│   ├── main.py          الخدمة /verify (القرآن أولًا ثم الحديث)
│   ├── quran.py         مطابقة القرآن (حرفية + دلالية اختيارية)
│   ├── fetch_quran.py   تنزيل نص المصحف من QuranEnc مرة واحدة
│   ├── data/            quran.json (بعد التنزيل) و quran_embeddings.npy
│   ├── hadith.py        البحث في الدرر السنية والتصنيف
│   ├── test_*.py        اختبارات تعمل دون إنترنت
│   ├── requirements.txt / requirements-dev.txt / requirements-semantic.txt
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
4. لربط القرآن، مرة واحدة (بعد تفعيل البيئة `.venv`):
   ```
   python fetch_quran.py
   ```
   ثم أعد تشغيل الخدمة. تأكد من http://127.0.0.1:8000 أن `quran_ayat` = 6236.
5. (اختياري) المطابقة الدلالية بملف `data/quran_embeddings.npy` (أنشأه النموذج `intfloat/multilingual-e5-base`):
   ```
   pip install -r requirements-semantic.txt
   ```
   أول تشغيل بعدها ينزّل النموذج (حوالي 1.1GB) مرة واحدة. تأكد من http://127.0.0.1:8000 أن `semantic` = true.
6. لربط موسوعة الأحاديث النبوية (مطابقة حرفية وبالمعنى)، مرة واحدة بعد الخطوة 5:
   ```
   python build_hadith.py
   ```
   ينزّل الأحاديث إلى `data/hadeethenc.json` وينشئ تمثيلاتها بالنموذج نفسه في `data/hadith_embeddings.npy`. ثم أعد تشغيل الخدمة، وتأكد أن `hadeethenc_hadith` أكبر من صفر و`hadith_semantic` = true. بعدها `npm run build` في `extension` يضمّن التمثيلات في الإضافة.
7. جرّب الخدمة: http://127.0.0.1:8000/docs ← POST /verify ← Try it out
   ```
   {"text": "إنما الأعمال بالنيات"}
   ```
8. افتح `web/popup.html` واكتب نصًا في خانة التحقق وسترى البطاقة.

## ملاحظات
- بيانات `samples` في `web/cards.js` أمثلة تجريبية للعرض فقط.
- خدمة Python تتحقق من القرآن (من QuranEnc)، ثم من موسوعة الأحاديث النبوية محليًا، ثم من الدرر السنية.
- المطابقة بالمعنى لا تكفي وحدها: يُشترط معها تشابه حرفي لا يقل عن 0.55، ونتيجتها دائمًا "ورد بلفظ مختلف" مع اللفظ الصحيح. حد التشابه الدلالي 0.88 مبدئي.
- ملف التمثيلات `data/quran_embeddings.npy` (6236 × 768 بترتيب المصحف) أنشأه `intfloat/multilingual-e5-base`، ويُستخدم مع النموذج نفسه في الخدمة والإضافة؛ بدون مكتبات المطابقة الدلالية تعمل المطابقة الحرفية وحدها.
- أسماء التصنيفات وألفاظ الأحكام موحّدة بين `backend/hadith.py` و`web/cards.js` والإضافة؛ أي تعديل عليها يكون في المواضع الثلاثة.
- قيّد `allow_origins` في `backend/main.py` قبل أي نشر.
- أظهر اسم «الدرر السنية» مصدرًا للأحكام، وراسلهم بالإذن قبل أي استخدام موسّع.
