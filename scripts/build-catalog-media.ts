/**
 * Pre-encodes the catalogue card photography that ships with the build.
 *
 *   node scripts/build-catalog-media.ts [--masters <dir>] [--dry-run]
 *
 * These files never change between deploys, so they are encoded once here and
 * served straight from `public/`, past the image optimizer. Measured on
 * `next start` (WebKit, 1440px): a cold optimizer cost a median 139 ms per card
 * image against 10 ms warm, so about 92% of the wait was the transform rather
 * than the bytes. Staff-managed images keep the Cloudinary + `next/image` path.
 *
 * With `--masters`, the lossless mockup exports are used as the source instead
 * of the committed WebP, which is already a lossy generation. Each master is
 * normalised to the committed file's geometry first: the jar is a layered
 * composition, and a disc even a few percent larger would sit wrong under the lid.
 */
import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import sharp, { type Sharp } from "sharp";

const root = process.cwd();
const SOURCE_DIRECTORY = "public/assets/img/catalog";
const OUTPUT_DIRECTORY = "public/assets/img/catalog-set";
const MANIFEST = "src/content/catalog-media.json";

/** Widths cover 1x to 3x of the 25vw a card occupies on a 1920px layout. */
const WIDTHS = [384, 640, 960];

/**
 * WebP only. AVIF was measured at several qualities on the roe: it smooths the
 * grain, losing high-frequency detail WebP keeps at a smaller file (9.07 against
 * 7.81 at 32 KB versus 37 KB). One format also keeps the markup a plain <img>.
 *
 * Quality per kind, each chosen to land at or below today's weight with more
 * detail than today: roe 32 KB/9.07 against 33 KB/5.15, serving photos 16 KB/2.53
 * against 22 KB/2.47. Lids have no master, so they keep today's setting exactly.
 */
function quality(file: string) {
  if (file.includes("-body")) return 76;
  if (file.includes("-card")) return 82;
  return 90;
}

/**
 * Species names differ between the mockup exports and the code, and getting one
 * wrong would put another product's roe on the card. Spelled out on purpose.
 */
const MASTERS: Record<string, string> = {
  "premium-body.webp": "Икринки Premium_1 1.png",
  "hybrid-body.webp": "Икринки Гибирд белуги_1 1.png",
  "trout-body.webp": "Икринки форели_1.png",
  "sterlet-body.webp": "Стерлядь икринки_3 1.png",
  "premium-card.webp": "Фото · каталог · Premium.png",
  "hybrid-card.webp": "Фото · каталог · гібрид білуги.png",
  "trout-card.webp": "Фото · каталог · форель.png",
  "sterlet-card.webp": "Фото · каталог · стерлядь.png",
};

/**
 * The shipped jar body is a ring of tin around the roe. The mockup master is the
 * roe alone, so it is fitted inside that ring: stretching it over the whole disc
 * would swallow the rim, which is what makes the photo read as a jar at all.
 *
 * The rim is found by walking inward along 48 rays until local contrast rises —
 * the tin is flat and dark, the roe is textured. Measured consistently at about
 * 9% of the radius on all four products.
 */
async function roeRadius(input: Buffer) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const cx = info.width / 2;
  const cy = info.height / 2;
  const luma = (x: number, y: number) => {
    const i = (Math.round(y) * info.width + Math.round(x)) * 4;
    if (i < 0 || i + 3 >= data.length || data[i + 3]! <= 8) return null;
    return data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114;
  };
  let outer = 0;
  for (let r = Math.min(cx, cy); r > 0; r--)
    if (luma(cx + r - 1, cy) !== null) {
      outer = r;
      break;
    }
  const found: number[] = [];
  for (let a = 0; a < 48; a++) {
    const angle = (a / 48) * Math.PI * 2;
    for (let r = outer - 2; r > outer * 0.5; r--) {
      const window: number[] = [];
      for (let k = -3; k <= 3; k++) {
        const v = luma(
          cx + Math.cos(angle) * (r + k),
          cy + Math.sin(angle) * (r + k),
        );
        if (v !== null) window.push(v);
      }
      if (window.length < 5) continue;
      const mean = window.reduce((s, v) => s + v, 0) / window.length;
      const sd = Math.sqrt(
        window.reduce((s, v) => s + (v - mean) ** 2, 0) / window.length,
      );
      if (sd > 12) {
        found.push(r);
        break;
      }
    }
  }
  found.sort((a, b) => a - b);
  const inner = found[Math.floor(found.length / 2)];
  if (found.length < 40 || !inner || inner / outer < 0.8 || inner >= outer)
    throw new Error("Rim detection failed; refusing to guess the geometry.");
  return { outer, inner, cx, cy };
}

async function fitRoe(master: Buffer, shipped: Buffer) {
  const { inner, cx, cy } = await roeRadius(shipped);
  const size = Math.round(inner * 2);
  const disc = await sharp(master)
    .resize(size, size, { fit: "cover" })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
        ),
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();
  return sharp(shipped)
    .composite([
      {
        input: disc,
        left: Math.round(cx - inner),
        top: Math.round(cy - inner),
      },
    ])
    .png()
    .toBuffer();
}

/**
 * Serving photos have no rim, so the master replaces the frame outright — but
 * only when it carries the same crop. A different aspect means a different
 * framing, and `cover` would silently re-crop the approved photo.
 */
async function fitCard(master: Buffer, shipped: Buffer) {
  const target = await sharp(shipped).metadata();
  const source = await sharp(master).metadata();
  const ratio =
    source.width! / source.height! / (target.width! / target.height!);
  if (Math.abs(ratio - 1) > 0.01) return null;
  return sharp(master)
    .resize(target.width!, target.height!, { fit: "cover" })
    .png()
    .toBuffer();
}

function parseArguments() {
  const args = process.argv.slice(2);
  const index = args.indexOf("--masters");
  return {
    masters: index >= 0 ? args[index + 1] : undefined,
    dryRun: args.includes("--dry-run"),
  };
}

async function build() {
  const { masters, dryRun } = parseArguments();
  const sourceDirectory = path.join(root, SOURCE_DIRECTORY);
  const files = (await readdir(sourceDirectory))
    .filter((file) => /\.(webp|jpe?g|png)$/i.test(file))
    .sort();
  if (!files.length) throw new Error(`No images in ${SOURCE_DIRECTORY}.`);

  const outputDirectory = path.join(root, OUTPUT_DIRECTORY);
  if (!dryRun) {
    await rm(outputDirectory, { recursive: true, force: true });
    await mkdir(outputDirectory, { recursive: true });
  }

  const manifest: Record<string, unknown> = {};
  let bytes = 0;

  for (const file of files) {
    const shipped = await readFile(path.join(sourceDirectory, file));
    let source = shipped;
    let origin = "репо";

    const masterName = masters ? MASTERS[file] : undefined;
    if (masterName) {
      const masterPath = path.join(masters!, masterName);
      try {
        await access(masterPath);
        const master = await readFile(masterPath);
        const fitted = file.includes("-body")
          ? await fitRoe(master, shipped)
          : await fitCard(master, shipped);
        if (fitted) {
          source = fitted;
          origin = "майстер";
        } else {
          console.warn(
            `  ! ${file}: кадрування майстра не збігається — лишаю файл репозиторію`,
          );
        }
      } catch {
        console.warn(
          `  ! майстра не знайдено: ${masterName} — беру файл репозиторію`,
        );
      }
    }

    const meta = await sharp(source).metadata();
    const name = file.replace(/\.[^.]+$/, "");
    const q = quality(file);
    const entries: string[] = [];

    for (const width of WIDTHS) {
      if (meta.width && width > meta.width) continue;
      const data = await sharp(source)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: q, effort: 6, smartSubsample: true })
        .toBuffer();
      const digest = createHash("sha256")
        .update(data)
        .digest("hex")
        .slice(0, 8);
      const output = `${name}-${width}.${digest}.webp`;
      if (!dryRun)
        await writeFile(path.join(outputDirectory, output), data as Uint8Array);
      bytes += data.length;
      entries.push(`/assets/img/catalog-set/${output} ${width}w`);
    }
    if (!entries.length) throw new Error(`No ladder produced for ${file}.`);

    manifest[`/assets/img/catalog/${file}`] = {
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      srcSet: entries.join(", "),
      fallback: entries[0]!.split(" ")[0],
    };
    console.log(
      `${file.padEnd(20)} ${origin.padEnd(8)} q${q} ${meta.width}x${meta.height}`,
    );
  }

  if (!dryRun)
    await writeFile(
      path.join(root, MANIFEST),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
  console.log(
    `\n${files.length} джерел → ${(bytes / 1024).toFixed(0)} KB у ${OUTPUT_DIRECTORY}.`,
  );
  if (dryRun) console.log("Dry run: нічого не записано.");
}

await build();
