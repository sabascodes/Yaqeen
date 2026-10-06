# Credits and Licenses

[بالعربية: المصادر المعتمدة](docs/SOURCES.ar.md) · [التوثيق التقني](docs/TECHNICAL.ar.md)

Sources, models and libraries used by Yaqeen, with their owners and their actually
published terms. Where no terms are published, this is stated as such and must be
confirmed with the owner before release. This file does not state a license for
Yaqeen itself.

## Reference data (approved sources only)

| Source | Owner | URL | Published terms |
|---|---|---|---|
| Quran text (6236 ayat, bundled on device) | King Fahd Glorious Quran Printing Complex (KFGQPC) | https://qurancomplex.gov.sa | Terms not published for programmatic reuse of the Mushaf text; permission to confirm. |
| Quran text / translations of meanings delivery (QuranEnc) | Noble Quran Encyclopedia, Islamic Content in Languages Association | https://quranenc.com — API: https://quranenc.com/en/home/api | Conditions published on the API page, not a named license: no modification, addition or deletion; clear attribution to the publisher and to QuranEnc.com; state the version number when republishing; keep the transcript information inside the document; notify QuranEnc.com of any note on the translation; update to the latest issued version; no inappropriate advertising shown with the content. |
| Hadith encyclopedia (3574 hadith, bundled on device) | Prophetic Hadith Encyclopedia (HadeethEnc), Islamic Content in Languages Association | https://hadeethenc.com — API: https://hadeethenc.com/api-docs | Same republication conditions as QuranEnc (no modification, attribution to HadeethEnc.com, version number, keep transcript information, notify of notes, update to latest version, no inappropriate advertising). No named license; terms for bundling the corpus inside an installed extension are not published — permission to confirm. |
| Hadith gradings (online query, only when nothing matches locally) | Dorar Al-Saniyyah Foundation (Al-Mawsu'a al-Hadithiyya) | https://dorar.net — https://dorar.net/hadith | Site states only "All rights reserved to Dorar Al-Saniyyah Foundation". No API terms of use published at a stable URL; terms not published, permission to confirm. |

## Models

| Component | Owner | URL | License |
|---|---|---|---|
| intfloat/multilingual-e5-base (embeddings) | intfloat (Microsoft Research) | https://huggingface.co/intfloat/multilingual-e5-base | MIT (stated in the model card metadata). |
| ONNX runtime for that model in the browser | Hugging Face — the `@huggingface/transformers` package (see dependencies) | https://github.com/huggingface/transformers.js | Apache-2.0. The model weights it loads remain under the MIT terms above. |
| Fine-tuned Arabic OCR model for Tesseract.js | Derived from Tesseract `ara` traineddata, tesseract-ocr project | https://github.com/tesseract-ocr/tessdata | Base traineddata: Apache-2.0. The fine-tuned weights are Yaqeen's own work on that base; Apache-2.0 notices must be carried. |

## Dependencies

Every package in the manifests. Each license was read from the npm registry or PyPI
metadata for the package itself, not inferred.

### extension/package.json — dependencies

| Package | Version | License |
|---|---|---|
| @huggingface/transformers | ^4.3.0 | Apache-2.0 |
| @tesseract.js-data/ara | ^1.0.0 | MIT |
| @tesseract.js-data/eng | ^1.0.0 | MIT |
| tesseract.js | ^7.0.0 | Apache-2.0 |

`@tesseract.js-data/eng` is still a declared dependency although English OCR was
removed from the product; it should be dropped from the manifest or kept credited.

### extension/package.json — devDependencies

| Package | Version | License |
|---|---|---|
| @types/chrome | ^0.1.0 | MIT (DefinitelyTyped) |
| esbuild | ^0.28.2 | MIT |
| fake-indexeddb | ^6.2.5 | Apache-2.0 |
| fflate | ^0.8.3 | MIT |
| typescript | ^5.9.3 | Apache-2.0 |
| vitest | ^5.0.3 | MIT |

### backend — requirements.txt

| Package | License |
|---|---|
| fastapi | MIT |
| uvicorn | BSD-3-Clause |
| requests | Apache-2.0 |
| beautifulsoup4 | MIT |
| rapidfuzz | MIT |

### backend — requirements-dev.txt

| Package | License |
|---|---|
| pytest | MIT |
| numpy | BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0 (bundled components) |
| httpx | BSD-3-Clause |

### backend — requirements-semantic.txt

| Package | License |
|---|---|
| numpy | as above |
| sentence-transformers | Apache-2.0 |

## Services

| Component | Owner | URL | Terms |
|---|---|---|---|
| Netlify (demo hosting) | Netlify, Inc. | https://www.netlify.com/legal/terms-of-use/ | Commercial terms of service, not an open-source license; use of the demo is governed by Netlify's Terms of Use and Acceptable Use Policy. |

## To confirm before release

- King Fahd Complex: written permission for redistributing the Mushaf text in the extension.
- HadeethEnc / QuranEnc: permission to bundle the corpus on the user's device, beyond
  the republication conditions on their pages.
- Dorar Al-Saniyyah: permission to query the hadith API from the extension.
