# Yaqeen OCR models

Yaqeen reads the text in pictures on the user's device with Tesseract (tesseract.js). The
standard Arabic and English models misread the decorative fonts and coloured backgrounds common in
social media pictures, so Yaqeen ships its own models in `extension/ocr-models/`: Tesseract's
`tessdata_best` Arabic and English models, fine-tuned on Quran, hadith and Quran-translation text
drawn in plain and decorative fonts the way posts show them.

OCR only extracts text. Matching still uses only the approved sources (QuranEnc, HadeethEnc,
Dorar), and the user can always correct the text that was read before it is checked.

## What the scripts do

| Step | Script | Output |
| --- | --- | --- |
| Fonts | `fetch_fonts.sh` | 51 Arabic and 30 English Google Fonts families (OFL / Apache) |
| Test set | `make_test.py` | 414 post-style pictures (6 per Arabic family, 4 per English family), from a slice of the texts training never sees |
| Training lines | `build_lines.sh` (`make_lines.py`) | 30,000 Arabic and 12,000 English single-line images with labels |
| Fine-tuning | `train.sh ara 12000`, `train.sh eng 6000` | `ft/<lang>/<lang>_ft_int.traineddata` |
| Scoring | `evaluate.py NAME ara.traineddata eng.traineddata v3` (with `PSM=6 TARGET=30`) | accuracy per group |
| In the browser | `browser_run.mjs` | the same test read by tesseract.js in Chromium, with the extension's own `src/shared/ocr.ts` |

Twelve Arabic and seven English font families are held out of training, so the scores on them
show how the models handle fonts they have never seen.

Arabic labels are the letters without harakat (the model learns to ignore tashkeel, which matching
ignores too), and the Arabic comma is labelled as `,` because the base model has no `،`.

## Running it

Needs `tesseract-ocr` 5 with its training tools (`apt install tesseract-ocr`), Python 3 with
`pillow` (with libraqm), `numpy`, `opencv-python-headless`, `fonttools`, `rapidfuzz`, and the
`tessdata_best` `ara`/`eng` models in `$OCR_WORK/tdbest/` (default `OCR_WORK=/tmp/ocr`). The data
comes from `backend/data/quran.json` and `backend/data/hadeethenc.json`.

```sh
./fetch_fonts.sh
python3 make_test.py
./build_lines.sh
./train.sh ara 12000 & ./train.sh eng 6000 & wait
gzip -c $OCR_WORK/ft/ara/ara_ft_int.traineddata > ../extension/ocr-models/ara.traineddata.gz
gzip -c $OCR_WORK/ft/eng/eng_ft_int.traineddata > ../extension/ocr-models/eng.traineddata.gz
```
