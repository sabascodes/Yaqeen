/**
 * Where posts live on each supported platform. Selectors follow the sites'
 * current markup and may need updating when the sites change.
 */
export interface Platform {
  name: "x" | "facebook" | "tiktok";
  matches(host: string): boolean;
  /** Elements that each hold one post (or comment) to check. */
  posts(root: ParentNode): Element[];
  /** The element holding the post's text; the badge goes right after it. */
  textElement(post: Element): Element | null;
  images(post: Element): HTMLImageElement[];
}

const all = (root: ParentNode, sel: string) => Array.from(root.querySelectorAll(sel));
const first = (root: Element, sels: string[]) => {
  for (const s of sels) {
    const el = root.querySelector(s);
    if (el) return el;
  }
  return null;
};
const bigImages = (imgs: Element[]) =>
  (imgs as HTMLImageElement[]).filter((img) => (img.naturalWidth || img.width) >= 200);

export const PLATFORMS: Platform[] = [
  {
    name: "x",
    matches: (h) => /(^|\.)(x|twitter)\.com$/.test(h),
    posts: (root) => all(root, 'article[data-testid="tweet"]'),
    textElement: (post) => first(post, ['[data-testid="tweetText"]']),
    images: (post) => bigImages(all(post, '[data-testid="tweetPhoto"] img')),
  },
  {
    name: "facebook",
    matches: (h) => /(^|\.)facebook\.com$/.test(h),
    posts: (root) => all(root, 'div[role="article"]'),
    textElement: (post) =>
      first(post, ['[data-ad-preview="message"]', '[data-ad-comet-preview="message"]', 'div[dir="auto"]']),
    images: (post) => bigImages(all(post, 'img[src*="fbcdn"]')),
  },
  {
    name: "tiktok",
    matches: (h) => /(^|\.)tiktok\.com$/.test(h),
    // Video captions and comments; video frames are not read.
    posts: (root) =>
      all(
        root,
        [
          '[data-e2e="recommend-list-item-container"]',
          '[data-e2e="browse-video"]',
          '[data-e2e="search_top-item"]',
          '[data-e2e="comment-level-1"]',
          '[data-e2e="comment-level-2"]',
        ].join(","),
      ),
    textElement: (post) =>
      post.matches('[data-e2e^="comment-level"]')
        ? post
        : first(post, ['[data-e2e="video-desc"]', '[data-e2e="browse-video-desc"]', '[data-e2e="search-card-desc"]']),
    images: (post) => bigImages(all(post, '[data-e2e="photo-mode"] img, .swiper-slide img')),
  },
];

export function currentPlatform(host = location.hostname): Platform | undefined {
  return PLATFORMS.find((p) => p.matches(host));
}
