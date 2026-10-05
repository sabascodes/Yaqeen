/**
 * Content script: finds posts on X, Facebook and TikTok, asks the service worker
 * to check them, and shows the verdict next to the post in a shadow root so the
 * site's styles cannot interfere.
 */
import { CHIP_MARK } from "../ui/logo";
import css from "../ui/card.css";
import { bindCopy, badgeHtml, cardHtml, esc } from "../ui/card";
import { currentPlatform, type Platform } from "./platforms";
import type { CheckResponse } from "../shared/messages";
import { loadSettings, resolveLang, type Settings } from "../shared/settings";
import { t, type Lang } from "../shared/i18n";
import { looksArabic } from "../core/detect";

const DONE = "data-yaqeen";
let lang: Lang = "ar";
let settings: Settings;

function send(msg: unknown): Promise<CheckResponse> {
  return chrome.runtime.sendMessage(msg) as Promise<CheckResponse>;
}

const LOGO = CHIP_MARK;

/** Creates the widget container right after the post's text. */
function mount(anchor: Element): ShadowRoot {
  const host = document.createElement("div");
  host.className = "yaqeen-host";
  anchor.insertAdjacentElement("afterend", host);
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${css}</style><div class="yq yq-host" lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}"><div class="yq-row"></div><div class="yq-cards"></div></div>`;
  // Clicks inside the widget must not open the post.
  host.addEventListener("click", (e) => e.stopPropagation());
  return root;
}

function render(root: ShadowRoot, res: CheckResponse, extraLabel?: string) {
  const row = root.querySelector(".yq-row")!;
  const cards = root.querySelector(".yq-cards")!;
  row.querySelectorAll(".yq-verdict, .yq-msg").forEach((n) => n.remove());
  if (!res.ok || (res.result.incomplete && !res.result.verdicts.length)) {
    row.insertAdjacentHTML("beforeend", `<span class="yq-msg yq-chip">${esc(t(lang).error)}</span>`);
    return;
  }
  if (!res.ok) return;
  res.result.verdicts.forEach((v, i) => {
    const b = document.createElement("span");
    b.className = "yq-verdict";
    b.innerHTML = badgeHtml(v, lang);
    b.addEventListener("click", () => {
      const open = cards.getAttribute("data-open") === String(i);
      cards.innerHTML = open ? "" : (extraLabel ?? "") + cardHtml(v, lang);
      cards.setAttribute("data-open", open ? "" : String(i));
      bindCopy(cards);
    });
    row.prepend(b);
  });
}

async function checkText(post: Element, platform: Platform) {
  const textEl = platform.textElement(post);
  const text = (textEl as HTMLElement | null)?.innerText?.trim() ?? "";
  const images = platform.images(post);
  if (!looksArabic(text) && !images.length) return;

  const root = mount(textEl ?? post);
  const row = root.querySelector(".yq-row")!;

  if (images.length) {
    const btn = document.createElement("button");
    btn.className = "yq-chip";
    btn.innerHTML = `${LOGO}${esc(t(lang).checkImage)}`;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.innerHTML = `${LOGO}${esc(t(lang).checking)}`;
      const res = await send({ type: "ocr", imageUrl: images[0]!.currentSrc || images[0]!.src }).catch(
        (e): CheckResponse => ({ ok: false, error: String(e) }),
      );
      btn.remove();
      const label =
        res.ok && res.ocrText
          ? `<div class="field"><span class="field__label">${esc(t(lang).ocrResult)}</span><span class="field__value">${esc(res.ocrText)}</span></div>`
          : undefined;
      render(root, res, label);
    });
    row.append(btn);
  }

  if (looksArabic(text) && settings.autoCheck) {
    const res = await send({ type: "check", text }).catch((e): CheckResponse => ({ ok: false, error: String(e) }));
    render(root, res);
  } else if (looksArabic(text)) {
    const btn = document.createElement("button");
    btn.className = "yq-chip";
    btn.innerHTML = `${LOGO}${esc(t(lang).yaqeen)}`;
    btn.addEventListener("click", async () => {
      btn.remove();
      render(root, await send({ type: "check", text }));
    });
    row.append(btn);
  }
  if (!row.childElementCount) root.host.remove();
}

function scan(platform: Platform) {
  for (const post of platform.posts(document)) {
    if (post.hasAttribute(DONE)) continue;
    // Only posts that are on (or near) the screen, to keep browsing light.
    const r = post.getBoundingClientRect();
    if (r.bottom < -500 || r.top > innerHeight + 1000) continue;
    post.setAttribute(DONE, "");
    void checkText(post, platform);
  }
}

async function main() {
  const platform = currentPlatform();
  if (!platform) return;
  settings = await loadSettings();
  lang = resolveLang(settings.lang);
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      scan(platform);
    }, 400);
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  addEventListener("scroll", schedule, { passive: true });
  scan(platform);
}

void main();
