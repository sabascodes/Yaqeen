/** Shared by the extension and the demo: an image made easier for Tesseract to read. */

/** Height, in pixels, that tall letters (alef, lam, l, k) are scaled to: Tesseract reads this size best. */
const LETTER_HEIGHT = 30;

/**
 * The image in grey with its contrast stretched, dark text on a light background, and scaled
 * so its letters are the size Tesseract reads best. Social media images are colourful, often
 * light text on dark, and their letters can be tiny or huge; measured on 294 Arabic test
 * pictures this finds the right source far more often than the raw picture.
 */
export async function prepareForOcr(img: Blob | HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const src = img instanceof HTMLCanvasElement ? img : await createImageBitmap(img);
  const w = src.width, h = src.height;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(src, 0, 0);
  const px = g.getImageData(0, 0, w, h).data;
  const grey = new Uint8ClampedArray(w * h);
  const hist = new Uint32Array(256);
  for (let i = 0, p = 0; p < grey.length; i += 4, p++) {
    const y = Math.round(0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!);
    grey[p] = y;
    hist[y]!++;
  }
  // Stretch between the darkest and lightest 1% so faint or coloured letters become dark.
  const cut = grey.length * 0.01;
  let lo = 0, hi = 255;
  for (let n = 0; lo < 255 && (n += hist[lo]!) < cut; lo++);
  for (let n = 0; hi > 0 && (n += hist[hi]!) < cut; hi--);
  const span = Math.max(1, hi - lo);
  for (let p = 0; p < grey.length; p++) grey[p] = ((grey[p]! - lo) * 255) / span;
  // Light text on a dark or coloured background is turned into dark text on light.
  if (median(borderPixels(grey, w, h)) < 128) for (let p = 0; p < grey.length; p++) grey[p] = 255 - grey[p]!;

  const letters = letterHeight(grey, w, h, otsu(grey));
  const scale = letters ? Math.min(4, Math.max(0.25, LETTER_HEIGHT / letters)) : 1;

  const out = new ImageData(w, h);
  for (let p = 0, i = 0; p < grey.length; p++, i += 4) {
    out.data[i] = out.data[i + 1] = out.data[i + 2] = grey[p]!;
    out.data[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  const pad = 20;
  const r = document.createElement("canvas");
  r.width = Math.max(1, Math.round(w * scale)) + 2 * pad;
  r.height = Math.max(1, Math.round(h * scale)) + 2 * pad;
  const rg = r.getContext("2d")!;
  rg.fillStyle = "#fff";
  rg.fillRect(0, 0, r.width, r.height);
  rg.imageSmoothingQuality = "high";
  rg.drawImage(c, pad, pad, r.width - 2 * pad, r.height - 2 * pad);
  return r;
}

function borderPixels(grey: Uint8ClampedArray, w: number, h: number): number[] {
  const out: number[] = [];
  for (let x = 0; x < w; x++) for (const y of [0, 1, 2, 3, h - 4, h - 3, h - 2, h - 1]) if (y >= 0 && y < h) out.push(grey[y * w + x]!);
  for (let y = 0; y < h; y++) for (const x of [0, 1, 2, 3, w - 4, w - 3, w - 2, w - 1]) if (x >= 0 && x < w) out.push(grey[y * w + x]!);
  return out;
}

function median(v: number[]): number {
  if (!v.length) return 255;
  const s = [...v].sort((a, b) => a - b);
  return s[s.length >> 1]!;
}

/** The grey level that best separates letters from background (Otsu's method). */
function otsu(grey: Uint8ClampedArray): number {
  const hist = new Float64Array(256);
  for (const v of grey) hist[v]!++;
  const total = grey.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i]!;
  let sumB = 0, wB = 0, best = 0, t = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]!;
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i]!;
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) (best = between), (t = i);
  }
  return t;
}

/**
 * Height of the tall letters: the 90th percentile height of letter-sized dark blobs. Frames,
 * lines and specks are left out. 0 when the image has too few letters to tell.
 */
function letterHeight(grey: Uint8ClampedArray, w: number, h: number, t: number): number {
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const heights: number[] = [];
  for (let start = 0; start < grey.length; start++) {
    if (seen[start] || grey[start]! > t) continue;
    let top = 0, n = 0, minX = w, maxX = 0, minY = h, maxY = 0;
    stack[top++] = start;
    seen[start] = 1;
    while (top) {
      const p = stack[--top]!;
      const x = p % w, y = (p - x) / w;
      n++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (!seen[q] && grey[q]! <= t) (seen[q] = 1), (stack[top++] = q);
        }
    }
    const bh = maxY - minY + 1, bw = maxX - minX + 1;
    if (n >= 15 && bh < 0.4 * h && bw < 0.5 * w) heights.push(bh);
  }
  if (heights.length < 5) return 0;
  heights.sort((a, b) => a - b);
  return heights[Math.floor(0.9 * (heights.length - 1))]!;
}
