import { describe, expect, it } from "vitest";
import { normalizeArabic, skeleton } from "../src/core/normalize";
import { QuranIndex } from "../src/core/quranIndex";
import { HadithIndex } from "../src/core/hadithIndex";
import { checkPost, verdictFromRulings, type CheckDeps } from "../src/core/checker";
import { classifyRuling } from "../src/core/grades";
import { dorarResultHtml, parseDorarHtml } from "../src/sources/dorar";
import { suraName } from "../src/core/suras";
import { extractFragments, stripFramingOriginal } from "../src/core/detect";
import { AYAT, ENC, dorarHtml } from "./fixtures";

const quran = new QuranIndex(AYAT);
const hadith = new HadithIndex(ENC);
const deps = (extra: Partial<CheckDeps> = {}): CheckDeps => ({ quran, hadith, ...extra });

describe("normalization", () => {
  it("makes Uthmani and everyday spelling comparable", () => {
    expect(skeleton("يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُواْ")).toBe(skeleton("يا أيها الذين آمنوا"));
    expect(skeleton("ٱلۡكِتَٰبُ")).toBe(skeleton("الكتاب"));
    expect(skeleton("بِٱلصَّبۡرِ وَٱلصَّلَوٰةِ")).toBe(skeleton("بالصبر والصلاة"));
    expect(skeleton("إِبۡرَٰهِـۧمَ")).toBe(skeleton("إبراهيم"));
    expect(skeleton("ٱلسَّمَٰوَٰتِ")).toBe(skeleton("السماوات"));
    expect(skeleton("ٱلۡحَيَوٰةِ")).toBe(skeleton("الحياة"));
    expect(normalizeArabic("ﷺ")).toBe("صلي الله عليه وسلم");
  });
});

describe("Quran matching", () => {
  it("matches an exact quote with surah and ayah", async () => {
    const r = await checkPost("قال تعالى: ﴿يا أيها الذين آمنوا استعينوا بالصبر والصلاة إن الله مع الصابرين﴾", deps());
    expect(r.verdicts).toHaveLength(1);
    expect(r.verdicts[0]!.kind).toBe("quran_exact");
    expect(r.verdicts[0]!.ayat).toEqual([{ sura: 2, aya: 153 }]);
    expect(r.verdicts[0]!.references[0]!.label).toBe("سورة البقرة 153");
  });

  it("flags a misquoted ayah and shows the correct wording", async () => {
    const r = await checkPost("قال تعالى: يا أيها الذين آمنوا استعينوا بالصبر والدعاء إن الله مع المؤمنين", deps());
    expect(r.verdicts[0]!.kind).toBe("different_wording");
    expect(r.verdicts[0]!.sourceText).toBe(AYAT[7]!.text);
  });

  it("matches part of an ayah", async () => {
    const r = await checkPost("إياك نعبد وإياك نستعين", deps());
    expect(r.verdicts[0]!.kind).toBe("quran_exact");
    expect(r.verdicts[0]!.ayat).toEqual([{ sura: 1, aya: 5 }]);
  });

  it("matches a quote spanning consecutive ayat", async () => {
    const r = await checkPost("قل هو الله أحد الله الصمد لم يلد ولم يولد", deps());
    expect(r.verdicts[0]!.kind).toBe("quran_exact");
    expect(r.verdicts[0]!.ayat).toEqual([
      { sura: 112, aya: 1 },
      { sura: 112, aya: 2 },
      { sura: 112, aya: 3 },
    ]);
  });

  it("finds an ayah inside a longer post", async () => {
    const r = await checkPost(
      "تذكير جميل لكل من يمر بضيق اليوم: إن الإنسان لفي خسر إلا الذين آمنوا وعملوا الصالحات وتواصوا بالحق وتواصوا بالصبر. شاركوها",
      deps(),
    );
    const v = r.verdicts.find((x) => x.kind === "quran_exact");
    expect(v?.ayat?.map((a) => a.aya)).toEqual([2, 3]);
  });

  it("reports other places of a repeated ayah", async () => {
    const r = await checkPost("فبأي آلاء ربكما تكذبان", deps());
    expect(r.verdicts[0]!.kind).toBe("quran_exact");
    expect(r.verdicts[0]!.alsoAt?.length).toBe(1);
  });

  it("ignores ordinary text", async () => {
    const r = await checkPost("صباح الخير يا أصدقاء، الجو اليوم جميل جدا ونتمنى لكم يوما سعيدا", deps());
    expect(r.religious).toBe(false);
    expect(r.verdicts).toHaveLength(0);
  });
});

describe("hadith", () => {
  it("treats a one-word change as different wording", async () => {
    const r = await checkPost("قال رسول الله ﷺ: إنما الأعمال بالنية وإنما لكل امرئ ما نوى", deps());
    expect(r.verdicts[0]!.kind).toBe("different_wording");
  });

  it("matches an authentic hadith from HadeethEnc locally", async () => {
    const dorar = vi.fn();
    const r = await checkPost("قال رسول الله ﷺ: إنما الأعمال بالنيات وإنما لكل امرئ ما نوى", deps({ dorar }));
    expect(r.verdicts[0]!.kind).toBe("hadith_authentic");
    expect(r.verdicts[0]!.rulings?.[0]).toMatchObject({ ruling: "صحيح", book: "متفق عليه" });
    expect(dorar).not.toHaveBeenCalled();
  });

  it("flags different wording of an authentic hadith", async () => {
    const r = await checkPost("قال النبي ﷺ: من كان يؤمن بالله واليوم الآخر فليقل كلاما طيبا أو ليسكت", deps());
    expect(r.verdicts[0]!.kind).toBe("different_wording");
    expect(r.verdicts[0]!.wordingDiffers).toBe(true);
  });

  // Scholar and book names in these Dorar fixtures are placeholders, not real references.
  const weak = "اطلبوا العلم ولو بالصين فإن طلب العلم فريضة على كل مسلم";
  it("reports a weak or fabricated hadith with the scholar and reference", async () => {
    const dorar = vi.fn(async () =>
      parseDorarHtml(
        dorarHtml([
          { text: weak, scholar: "العالم أ", book: "كتاب أ", num: "1", ruling: "[موضوع]" },
          { text: weak, scholar: "العالم ب", book: "كتاب ب", num: "2", ruling: "باطل" },
        ]),
      ),
    );
    const r = await checkPost(`قال رسول الله صلى الله عليه وسلم: ${weak}`, deps({ dorar }));
    expect(r.verdicts[0]!.kind).toBe("weak_or_fabricated");
    expect(r.verdicts[0]!.rulings).toHaveLength(2);
    expect(r.verdicts[0]!.rulings?.[0]).toMatchObject({ scholar: "العالم أ", book: "كتاب أ" });
    // Only the hadith text leaves the device, without the "قال رسول الله" framing.
    expect(dorar).toHaveBeenCalledWith(weak);
  });

  it("shows every ruling when scholars differ", async () => {
    const t = "من قال لا إله إلا الله مخلصا دخل الجنة يوم القيامة";
    const dorar = vi.fn(async () =>
      parseDorarHtml(
        dorarHtml([
          { text: t, scholar: "العالم أ", book: "كتاب أ", num: "1", ruling: "صحيح" },
          { text: t, scholar: "العالم ب", book: "كتاب ب", num: "2", ruling: "إسناده ضعيف" },
        ]),
      ),
    );
    const r = await checkPost(`عن النبي ﷺ قال: ${t}`, deps({ dorar }));
    expect(r.verdicts[0]!.kind).toBe("scholars_differed");
    expect(r.verdicts[0]!.rulings?.map((x) => x.scholar)).toEqual(["العالم أ", "العالم ب"]);
  });

  it("says not found when the approved sources have nothing", async () => {
    const dorar = vi.fn(async () => []);
    const r = await checkPost("قال رسول الله ﷺ: نص مختلق لا وجود له في أي مصدر من المصادر", deps({ dorar }));
    expect(r.verdicts).toEqual([expect.objectContaining({ kind: "not_found", source: "none" })]);
  });

  it("does not contact Dorar for text that does not look like a hadith", async () => {
    const dorar = vi.fn(async () => []);
    await checkPost("هذه جملة عادية طويلة بما يكفي لتمر على الفحص المحلي فقط", deps({ dorar }));
    expect(dorar).not.toHaveBeenCalled();
  });
});

describe("rulings", () => {
  it.each([
    ["[صحيح]", "authentic"],
    ["إسناده حسن", "authentic"],
    ["ضعيف جدا", "weak"],
    ["إسناده ضعيف", "weak"],
    ["[موضوع]", "fabricated"],
    ["لا أصل له", "fabricated"],
    ["لا يصح", "fabricated"],
    ["ليس بصحيح", "weak"],
    ["أخرجه في سننه وسكت عنه", "unclassified"],
  ])("%s -> %s", (ruling, cat) => expect(classifyRuling(ruling)).toBe(cat));

  it("never picks a side", () => {
    expect(verdictFromRulings(["authentic", "weak"])).toBe("scholars_differed");
    expect(verdictFromRulings(["weak", "fabricated"])).toBe("weak_or_fabricated");
    expect(verdictFromRulings(["unclassified"])).toBe("rulings_verbatim");
    expect(verdictFromRulings(["authentic", "unclassified"])).toBe("hadith_authentic");
  });
});

describe("sources", () => {
  it("parses Dorar results", () => {
    const [row] = parseDorarHtml(
      dorarHtml([{ text: "إنما الأعمال بالنيات", scholar: "البخاري", book: "صحيح البخاري", num: "1", ruling: "[صحيح]" }]),
    );
    expect(row).toEqual({
      text: "إنما الأعمال بالنيات",
      narrator: "أبو هريرة",
      scholar: "البخاري",
      book: "صحيح البخاري",
      pageOrNumber: "1",
      ruling: "[صحيح]",
    });
  });

  it("reads both Dorar response shapes", () => {
    expect(dorarResultHtml({ ahadith: { result: "<a>" } })).toBe("<a>");
    expect(dorarResultHtml({ ahadith: [{ th: "<a>" }, { th: "<b>" }] })).toBe("<a><b>");
  });

  it("has all 114 surah names", () => {
    expect(suraName(114)).toBe("سورة الناس");
    expect(suraName(114, "en")).toBe("Surah An-Nas");
  });

  it("keeps the post's own wording for online search", () => {
    expect(stripFramingOriginal("قال رسول الله ﷺ: «إنما الأعمالُ بالنيات» رواه البخاري")).toBe("إنما الأعمالُ بالنيات");
  });

  it("splits a post into quotes and lines", () => {
    const f = extractFragments("قال تعالى ﴿إياك نعبد وإياك نستعين﴾\nسطر آخر فيه كلام عادي طويل");
    expect(f.map((x) => x.text)).toContain("إياك نعبد وإياك نستعين");
    expect(f.every((x) => x.quranLike)).toBe(true);
  });
});

describe("manual checks", () => {
  it("looks up pasted text without hadith framing and reports not found", async () => {
    const dorar = vi.fn(async () => []);
    const r = await checkPost("نص ملصوق بدون أي إشارة إلى أنه حديث", deps({ dorar }), true);
    expect(dorar).toHaveBeenCalled();
    expect(r.verdicts[0]!.kind).toBe("not_found");
  });
});

describe("semantic search", () => {
  const paraphrase = "يا أيها المؤمنون اطلبوا العون بالصبر وبالصلاة فالله مع الصابرين";
  const at = (sura: number, aya: number) => AYAT.findIndex((a) => a.sura === sura && a.aya === aya);

  it("finds a paraphrased ayah through the embedding search", async () => {
    const semanticSearch = vi.fn(async () => [{ index: at(2, 153), score: 0.93 }]);
    const r = await checkPost(`قال تعالى: ${paraphrase}`, deps({ semanticSearch }));
    expect(semanticSearch).toHaveBeenCalled();
    expect(r.verdicts[0]).toMatchObject({ kind: "different_wording", ayat: [{ sura: 2, aya: 153 }] });
  });

  it("does not accept a semantic hit below the threshold", async () => {
    const semanticSearch = vi.fn(async () => [{ index: at(2, 153), score: 0.8 }]);
    const r = await checkPost(`قال تعالى: ${paraphrase}`, deps({ semanticSearch }));
    expect(r.verdicts[0]!.kind).toBe("not_found");
  });

  it("does not accept a semantic hit with too little wording in common", async () => {
    const semanticSearch = vi.fn(async () => [{ index: at(2, 153), score: 0.99 }]);
    const r = await checkPost("قال تعالى: إن الإنسان خلق في أحسن تقويم وجعل له سمعا وبصرا", deps({ semanticSearch }));
    expect(r.verdicts.every((v) => v.ayat?.[0]?.aya !== 153)).toBe(true);
  });

  it("keeps working when the model is unavailable", async () => {
    const semanticSearch = vi.fn(async () => {
      throw new Error("offline");
    });
    const r = await checkPost(`قال تعالى: ${paraphrase}`, deps({ semanticSearch }));
    expect(r.verdicts[0]!.kind).toBe("not_found");
  });
});

describe("hadith semantic search", () => {
  const paraphrase = "قال رسول الله ﷺ: من آمن بالله وبيوم القيامة فلا يتكلم إلا بالخير وإلا فليسكت";

  it("finds a paraphrased HadeethEnc hadith and gives the correct wording, never 'authentic'", async () => {
    const hadithSemanticSearch = vi.fn(async () => [{ index: 1, score: 0.92 }]);
    const r = await checkPost(paraphrase, deps({ hadithSemanticSearch }));
    expect(hadithSemanticSearch).toHaveBeenCalled();
    expect(r.verdicts[0]).toMatchObject({ kind: "different_wording", source: "hadeethenc", sourceText: ENC[1]!.text });
  });

  it("does not accept a semantic hit below the threshold", async () => {
    const hadithSemanticSearch = vi.fn(async () => [{ index: 1, score: 0.85 }]);
    const r = await checkPost(paraphrase, deps({ hadithSemanticSearch }));
    expect(r.verdicts.some((v) => v.source === "hadeethenc")).toBe(false);
  });

  it("does not accept meaning alone without wording in common", async () => {
    const hadithSemanticSearch = vi.fn(async () => [{ index: 1, score: 0.99 }]);
    const r = await checkPost("قال رسول الله ﷺ: أحسنوا إلى جيرانكم وأكرموا ضيوفكم دائما", deps({ hadithSemanticSearch }));
    expect(r.verdicts.some((v) => v.source === "hadeethenc")).toBe(false);
  });

  it("is not used for posts that do not look like a hadith", async () => {
    const hadithSemanticSearch = vi.fn(async () => [{ index: 1, score: 0.99 }]);
    await checkPost("من كان عنده وقت فليقرأ هذا الكتاب الجميل أو ليتركه", deps({ hadithSemanticSearch }));
    expect(hadithSemanticSearch).not.toHaveBeenCalled();
  });
});

describe("source errors", () => {
  it("never reports 'not found' when Dorar could not be reached", async () => {
    const dorar = vi.fn(async () => {
      throw new Error("network");
    });
    const r = await checkPost("قال رسول الله ﷺ: نص لم نتمكن من التحقق منه بسبب انقطاع الاتصال", deps({ dorar }));
    expect(r.verdicts).toHaveLength(0);
    expect(r.incomplete).toBe(true);
  });
});

describe("online lookups", () => {
  it("only sends the hadith part of a multi-line post", async () => {
    const dorar = vi.fn(async () => []);
    await checkPost("صباح الخير لكل المتابعين الكرام في هذا اليوم\nقال رسول الله ﷺ: نص حديث للتجربة غير موجود محليا", deps({ dorar }));
    expect(dorar).toHaveBeenCalledTimes(1);
    expect(dorar).toHaveBeenCalledWith("نص حديث للتجربة غير موجود محليا");
  });
});
