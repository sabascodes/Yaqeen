/** Yaqeen mark: an eight-pointed star with a gold ring and a check (brand files in /brand). */
export function markSvg(size: number, opts: { faded?: boolean } = {}): string {
  const fill = opts.faded ? `fill="#FFFFFF" fill-opacity="0.1"` : `fill="#0F5B4A"`;
  return (
    `<svg class="yq-mark" width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" aria-hidden="true">` +
    `<rect x="12" y="12" width="40" height="40" rx="6" ${fill}/>` +
    `<rect x="12" y="12" width="40" height="40" rx="6" ${fill} transform="rotate(45 32 32)"/>` +
    `<circle cx="32" cy="32" r="15.5" stroke="#B8903A" stroke-width="${opts.faded ? 1.5 : 2}"/>` +
    `<path d="M24.5 32.5l5 5 10-11" stroke="#FFFFFF" stroke-width="${opts.faded ? 3 : 4}" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  );
}

/** Small one-colour mark for chips on social media pages; takes the text colour. */
export const CHIP_MARK =
  `<svg class="yq-logo" viewBox="0 0 64 64" fill="none" aria-hidden="true">` +
  `<rect x="12" y="12" width="40" height="40" rx="6" fill="currentColor"/>` +
  `<rect x="12" y="12" width="40" height="40" rx="6" fill="currentColor" transform="rotate(45 32 32)"/>` +
  `<path d="M22 32.5l7 7 13-14" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
