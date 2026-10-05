/** Shared by the extension and the demo: an image made easier for Tesseract to read. */

/**
 * The image enlarged, in grey, with its contrast stretched. Social media images are small and
 * colourful with decorated fonts; this reads them far more reliably than the raw picture.
 */
export async function prepareForOcr(img: Blob | HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const src = img instanceof HTMLCanvasElement ? img : await createImageBitmap(img);
  // Only small images are enlarged; enlarging an already clear picture made Tesseract skip lines.
  const scale = src.width < 1000 ? Math.min(3, 1800 / src.width) : 1;
  const c = document.createElement("canvas");
  c.width = Math.round(src.width * scale);
  c.height = Math.round(src.height * scale);
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, c.width, c.height);
  const px = g.getImageData(0, 0, c.width, c.height);
  const d = px.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const y = Math.round(0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!);
    d[i] = y;
    hist[y]!++;
  }
  // Stretch between the darkest and lightest 1% so faint or coloured letters become dark.
  const cut = (d.length / 4) * 0.01;
  let lo = 0, hi = 255;
  for (let n = 0; lo < 255 && (n += hist[lo]!) < cut; lo++);
  for (let n = 0; hi > 0 && (n += hist[hi]!) < cut; hi--);
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i]! - lo) * 255) / span));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  g.putImageData(px, 0, 0);
  return c;
}
