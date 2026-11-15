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

const wordmark = (title: string, tagline: string) => `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shade" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#17140f" stop-opacity="0.82"/>
      <stop offset="0.55" stop-color="#17140f" stop-opacity="0.3"/>
      <stop offset="1" stop-color="#17140f" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${height * 0.42}" width="${width}" height="${height * 0.58}" fill="url(#shade)"/>
  <text x="72" y="${height - 118}" fill="#f4efe3"
        font-family="Georgia, 'Times New Roman', serif" font-size="62" letter-spacing="1.5">${title}</text>
  <text x="74" y="${height - 70}" fill="#d9c08a"
        font-family="Helvetica, Arial, sans-serif" font-size="23" letter-spacing="5.6">${tagline}</text>
</svg>`;

const previews = [
  {
    locale: "ua",
    title: "Ukrainian Caviar Berry",
    tagline: "ІКРА ВЛАСНОГО ВИРОБНИЦТВА",
  },
  {
    locale: "en",
    title: "Ukrainian Caviar Berry",
    tagline: "CAVIAR FROM OUR OWN FARM",
  },
];

async function main() {
  await mkdir(outputDir, { recursive: true });
  // One decode of the master, reused for both locales.
  const frame = await sharp(source)
    .resize(width, height, { fit: "cover", position: "centre" })
    .toBuffer();

  for (const { locale, title, tagline } of previews) {
    const file = path.join(outputDir, `preview-${locale}.jpg`);
    const image = await sharp(frame)
      .composite([
        { input: Buffer.from(wordmark(title, tagline)), top: 0, left: 0 },
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
