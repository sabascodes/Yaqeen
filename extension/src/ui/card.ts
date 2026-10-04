import type { Verdict, VerdictKind } from "../core/types";
import { t, type Lang } from "../shared/i18n";
import { suraName } from "../core/suras";

/** Card colour family per verdict, matching the Figma design types. */
export const TYPE: Record<VerdictKind, string> = {
  quran_exact: "quran",
  hadith_authentic: "hadith",
  different_wording: "wording",
  weak_or_fabricated: "weak",
  scholars_differed: "differed",
  not_found: "notfound",
  rulings_verbatim: "notfound",
};

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const field = (label: string, body: string) =>
  `<div class="field"><span class="field__label">${esc(label)}</span>${body}</div>`;

export function badgeHtml(v: Verdict, lang: Lang): string {
  return `<span class="badge" data-type="${TYPE[v.kind]}"><i class="dot"></i>${esc(t(lang).kinds[v.kind])}</span>`;
}

function quranLabel(v: Verdict, lang: Lang): string {
  const first = v.ayat![0]!;
  const last = v.ayat![v.ayat!.length - 1]!;
  const range = first.aya === last.aya ? `${first.aya}` : `${first.aya}-${last.aya}`;
  return `${suraName(first.sura, lang)} · ${lang === "ar" ? "الآية" : "Ayah"} ${range}`;
}

export function cardHtml(v: Verdict, lang: Lang): string {
  const s = t(lang);
  const differs = v.kind === "different_wording" || v.wordingDiffers;
  let h = `<article class="card" data-type="${TYPE[v.kind]}"><div class="card__head">${badgeHtml(v, lang)}</div>`;
  h += field(s.checked, `<blockquote class="scripture">${esc(v.checkedText)}</blockquote>`);

  if (v.kind === "not_found") {
    h += `<p class="field__value">${esc(s.notFoundBody)}</p>`;
  }
  if (v.sourceText) {
    const label = differs ? s.correctWording : s.sourceText;
    const cls = differs ? "scripture scripture--correct" : "scripture";
    h += field(label, `<blockquote class="${cls}">${esc(v.sourceText)}</blockquote>`);
    if (lang === "en" && v.sourceTranslation) h += `<p class="translation">${esc(v.sourceTranslation)}</p>`;
  }
  if (v.wordingDiffers && v.kind !== "different_wording") h += `<p class="note">${esc(s.wordingNote)}</p>`;
  if (v.rulings?.length) {
    const items = v.rulings
      .map(
        (r) =>
          `<li><b>${esc(r.ruling)}</b><br>` +
          [r.scholar && `${esc(s.scholar)}: ${esc(r.scholar)}`, r.book && `${esc(s.book)}: ${esc(r.book)}`]
            .filter(Boolean)
            .join(" · ") +
          (r.pageOrNumber ? ` · ${esc(s.number)}: ${esc(r.pageOrNumber)}` : "") +
          `</li>`,
      )
      .join("");
    h += field(s.rulings, `<ul class="rulings">${items}</ul>`);
  }
  if (v.references.length) {
    const refs = v.references
      .map((r, i) => (i === 0 && v.ayat?.length ? { ...r, label: quranLabel(v, lang) } : r))
      .map((r) => (r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.label)}</a>` : esc(r.label)))
      .join("<br>");
    h += field(s.references, `<span class="field__value">${refs}</span>`);
  }
  if (v.alsoAt?.length) {
    const where = v.alsoAt.map((a) => `${suraName(a.sura, lang)} ${a.aya}`).join("، ");
    h += field(s.alsoAt, `<span class="field__value">${esc(where)}</span>`);
  }
  if (differs && v.sourceText) {
    h += `<div class="card__actions"><button class="btn btn--primary" type="button" data-copy="${esc(v.sourceText)}" data-done="${esc(s.copied)}">${esc(s.copy)}</button></div>`;
  }
  return h + `<p class="card__foot">${esc(s.disclaimer)}</p></article>`;
}

/** Wires up copy buttons inside a rendered card container. */
export function bindCopy(root: ParentNode): void {
  root.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((b) =>
    b.addEventListener("click", () => {
      void navigator.clipboard.writeText(b.dataset.copy ?? "").then(() => {
        const old = b.textContent;
        b.textContent = b.dataset.done ?? "";
        setTimeout(() => (b.textContent = old), 1500);
      });
    }),
  );
}
