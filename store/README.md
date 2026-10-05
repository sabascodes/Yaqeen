# Publishing Yaqeen in the add-ons stores

Once Yaqeen is in the stores, people install it with one click and get updates automatically.
Everything below is ready to copy into the store forms.

## The package

`yaqeen-extension.zip` is built with the real data every time the demo site deploys:
https://yaqeen-demo.netlify.app/yaqeen-extension.zip (the same file the site's Install page offers).
Upload that zip to both stores. No Colab run is needed.

Privacy policy URL: https://yaqeen-demo.netlify.app/privacy

## What only Saba can do

1. **Edge Add-ons (free)**: sign up at https://partner.microsoft.com/dashboard/microsoftedge/overview
   with a Microsoft account, as an Individual. Then "Create new extension", upload the zip and fill in
   the fields below.
2. **Chrome Web Store ($5 once)**: sign up at https://chrome.google.com/webstore/devconsole with a
   Google account, pay the fee, then "New item", upload the zip and fill in the fields below.
   Chrome also asks to verify the contact email.
3. Review takes from a few days to a few weeks. When each listing is live, send its address and it
   goes into `STORE` in `extension/demo/demo.ts`; the site's Install page then shows one
   "Add to Edge" / "Add to Chrome" button instead of the manual steps.

Note: the demo site has to stay up while the listings use its privacy policy URL. If the site is
taken down after 27 October, the privacy policy needs another home first (for example GitHub Pages).

## Listing fields

**Name**: يقين Yaqeen

**Category**: Productivity (Edge) / Tools (Chrome)

**Languages**: Arabic (default), English

**Short description** (Arabic, 132 characters at most):
تحقق من الآيات والأحاديث في المنشورات بمطابقتها مع المصادر المعتمدة فقط، مع المرجع واللفظ الصحيح، دون أي فتوى.

**Short description** (English):
Checks Quran verses and hadith in social media posts against approved sources only, with the source and correct wording. No fatwa.

**Full description** (Arabic):

> يقين إضافة تتحقق من الآيات القرآنية والأحاديث النبوية التي تظهر في منشورات X وFacebook وTikTok، بمطابقتها مع المصادر المعتمدة فقط:
> • نص المصحف من موسوعة القرآن الكريم (quranenc.com)
> • موسوعة الأحاديث النبوية (hadeethenc.com)
> • الموسوعة الحديثية في الدرر السنية (dorar.net)
>
> تظهر النتيجة بجانب المنشور: آية مطابقة مع اسم السورة ورقم الآية، أو حديث صحيح مع الحكم والمرجع، أو نص ورد بلفظ مختلف مع اللفظ الصحيح، أو حديث ضعيف أو موضوع مع أحكام العلماء ومراجعهم، أو اختلاف العلماء مع حكم كل عالم دون ترجيح، أو «لم يُعثر على المصدر».
> يقرأ يقين النص العربي في الصور أيضًا، على جهازك.
>
> يقين أداة تعمل بالذكاء الاصطناعي، لا تصدر فتاوى ولا أحكامًا من عندها، ولا تبحث خارج المصادر المعتمدة.
> المطابقة تتم على جهازك. لا يُرسل إلا نص الحديث غير الموجود محليًا إلى الدرر السنية، ويمكن إيقاف ذلك من الإعدادات.

**Full description** (English):

> Yaqeen checks Quran verses and hadith that appear in posts on X, Facebook and TikTok, by matching them against approved sources only:
> • The Mushaf text from QuranEnc (quranenc.com)
> • The HadeethEnc hadith encyclopedia (hadeethenc.com)
> • The Dorar hadith encyclopedia (dorar.net)
>
> The result shows next to the post: an exact verse with its surah and ayah, an authentic hadith with its grading and reference, a quote with different wording together with the correct wording, a weak or fabricated hadith with the scholars' rulings and references, differing scholars with each ruling and no preference, or "source not found".
> Yaqeen also reads Arabic text in pictures, on your device.
>
> Yaqeen is an AI-assisted tool. It never issues a fatwa or a ruling of its own, and never searches outside the approved sources.
> Matching happens on your device. Only the text of a hadith that is not found locally is sent to Dorar, and this can be turned off in settings.

**Screenshots** (1280×800): `screenshots/ar-*.png` for the Arabic listing, `screenshots/en-*.png` for the English one.

**Icon**: `extension/static/icons/128.png`. Edge also asks for a 300×300 logo: `/mnt/project-files/yaqeen/brand/icon-512.png` resized.

## Privacy and permission answers (Chrome "Privacy practices" tab, Edge "Properties")

**Single purpose**: Check Quran verses and hadith in web pages and social media posts against approved Islamic sources and show the source and correct wording.

**Data collected**: none. Tick nothing on the data-type list, and confirm the three statements
(not sold, not used for unrelated purposes, not used for credit decisions).

**Remote code**: No. All code is in the package; downloaded files are data (source text and an embedding model's weights).

| Permission | Why |
|---|---|
| `storage` | Keeps the settings and the downloaded Quran and hadith data on the device. |
| `offscreen` | Runs on-device text reading from pictures (OCR) and the on-device matching model. |
| quranenc.com, hadeethenc.com | Downloads the Quran text and hadith once, when the user presses Download data. |
| dorar.net | Looks up a hadith not found locally, sending only its text, when the Dorar option is on. |
| huggingface.co, hf.co | Downloads the on-device matching model once, when that option is on. |
| pbs.twimg.com, fbcdn.net, tiktokcdn.com, ibyteimg.com | Loads a post's picture so its Arabic text can be read on the device. |
| Content script on x.com, twitter.com, facebook.com, tiktok.com | Finds verses and hadith in posts and shows Yaqeen's result next to them. |

**Notes for reviewers** (Edge "Notes for certification"):
After installing, the settings page opens: press "Download data now" (تنزيل البيانات الآن). Then
open the toolbar popup and paste: إنما الأعمال بالنيات وإنما لكل امرئ ما نوى
No account or sign-in is needed.
