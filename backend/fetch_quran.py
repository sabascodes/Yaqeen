"""fetch_quran.py — ينزّل نص المصحف من موسوعة القرآن الكريم (QuranEnc) إلى data/quran.json.
يُشغَّل مرة واحدة: python fetch_quran.py"""
import json

import requests

from quran import QURAN_JSON

API = "https://quranenc.com/api/v1/translation/sura/english_saheeh/{}"


def main():
    ayat = []
    for sura in range(1, 115):
        r = requests.get(API.format(sura), timeout=30)
        r.raise_for_status()
        for row in r.json()["result"]:
            ayat.append({"sura": int(row["sura"]), "aya": int(row["aya"]), "text": row["arabic_text"],
                         "translation": row.get("translation", "")})
        print(f"\rسورة {sura}/114", end="", flush=True)
    if len(ayat) != 6236:
        raise SystemExit(f"\nعدد الآيات {len(ayat)} وليس 6236، لم يُحفظ الملف.")
    QURAN_JSON.parent.mkdir(exist_ok=True)
    QURAN_JSON.write_text(json.dumps(ayat, ensure_ascii=False), encoding="utf-8")
    print(f"\nحُفظت {len(ayat)} آية في {QURAN_JSON}")


if __name__ == "__main__":
    main()
