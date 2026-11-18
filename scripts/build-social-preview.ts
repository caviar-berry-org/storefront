/**
 * Builds the 1200×630 link preview shown when someone shares the site in a
 * messenger, plus the 180×180 Apple touch icon.
 *
 *   node scripts/build-social-preview.ts [--dry-run]
 *
 * These are static files served straight from `public/`, never through the image
 * optimizer: a preview is fetched by scrapers that do not accept our optimizer's
 * URLs, and a pre-encoded file costs no transformation quota. Re-run only when
 * the source photograph or the wordmark changes; the output is committed.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "public/assets/img/serve-premium.jpg");
const outputDir = path.join(root, "public/assets/img/social");
const dryRun = process.argv.includes("--dry-run");

/** Open Graph renders at 1.91:1; anything else is cropped by the client. */
const width = 1200;
const height = 630;

/**
 * The emblem sits centred at the top, the way the header carries it over the
 * hero on a desktop; the line underneath is the promise, in white. The site
 * name is deliberately absent — every scraper prints it next to the image from
 * `og:site_name` and the title, so putting it in the picture only repeats it.
 */
const caption = (lines: readonly string[]) => `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shade" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#17140f" stop-opacity="0.86"/>
      <stop offset="0.55" stop-color="#17140f" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#17140f" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="crown" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#17140f" stop-opacity="0.74"/>
      <stop offset="1" stop-color="#17140f" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height * 0.42}" fill="url(#crown)"/>
  <rect x="0" y="${height * 0.42}" width="${width}" height="${height * 0.58}" fill="url(#shade)"/>
${lines
  .map(
    (line, index) =>
      `  <text x="${textLeft}" y="${height - 128 + index * 62}" fill="#ffffff"
        font-family="Georgia, 'Times New Roman', serif" font-size="52" letter-spacing="0.5">${line}</text>`,
  )
  .join("\n")}
</svg>`;

/**
 * The oyster and the roe own the right half of the frame from about x=560, and
 * they are the reason anyone looks twice. The caption therefore stays in the
 * lower left, over bare slate, and breaks into two short lines rather than
 * running across the shell.
 */
const textLeft = 72;

/** Scaled from the 114x87 emblem the header uses, kept at that exact ratio. */
const emblemWidth = 232;
const emblemHeight = Math.round((emblemWidth * 87) / 114);

const previews = [
  { locale: "ua", lines: ["Смакуйте життя.", "Почніть з ікри"] },
  { locale: "en", lines: ["Savour life.", "Start with caviar."] },
];

async function main() {
  await mkdir(outputDir, { recursive: true });
  // One decode of the master, reused for both locales.
  const frame = await sharp(source)
    .resize(width, height, { fit: "cover", position: "centre" })
    .toBuffer();

  const emblem = await sharp(
    path.join(root, "public/assets/img/logo-emblem.svg"),
  )
    .resize(emblemWidth, emblemHeight, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  /**
   * The gold sits over crushed ice, which is the one bright thing in the frame
   * and exactly where the wordmark lost its edges. A blurred black copy of the
   * emblem underneath separates it from whatever it lands on, without the hard
   * rectangle a plain backing plate would show.
   */
  const emblemShadow = await sharp(emblem)
    .linear(0, 0)
    .blur(14)
    .png()
    .toBuffer();

  for (const { locale, lines } of previews) {
    const file = path.join(outputDir, `preview-${locale}.jpg`);
    const image = await sharp(frame)
      .composite([
        { input: Buffer.from(caption(lines)), top: 0, left: 0 },
        {
          input: emblemShadow,
          top: 60,
          left: Math.round((width - emblemWidth) / 2),
        },
        {
          input: emblem,
          top: 54,
          left: Math.round((width - emblemWidth) / 2),
        },
      ])
      // Quality 82 keeps the gradient clean; scrapers cap previews around 1 MB.
      .jpeg({ quality: 82, chromaSubsampling: "4:4:4", mozjpeg: true })
      .toBuffer();
    console.log(
      `preview-${locale}.jpg  ${width}×${height}  ${Math.round(image.length / 1024)} KB`,
    );
    if (!dryRun) await writeFile(file, image);
  }

  const apple = await sharp(path.join(root, "src/app/icon.png"))
    .resize(180, 180, { fit: "contain", background: "#fbfaf7" })
    .flatten({ background: "#fbfaf7" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  console.log(`apple-icon.png  180×180  ${Math.round(apple.length / 1024)} KB`);
  if (!dryRun)
    await writeFile(path.join(root, "src/app/apple-icon.png"), apple);
}

await main();
