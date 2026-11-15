/**
 * Builds the fixed storefront hero and split-section photos into art-directed,
 * pre-encoded AVIF/WebP ladders plus `src/content/editorial-media.json`.
 *
 * These photos are served straight from `public/assets`, bypassing the Next.js
 * image optimizer: a second lossy pass over an already lossy master visibly
 * flattens caviar grain, and the optimizer emits WebP only. Encoding once here
 * keeps the texture and adds AVIF.
 *
 *   node scripts/build-editorial-media.ts --sources <dir> [--only <name>] [--dry-run]
 *
 * Sources are the photographer's originals and are not kept in the repository;
 * the generated derivatives are. Re-run only when a source photo changes.
 */
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp, { type Sharp } from "sharp";

/** Normalised crop rectangle over the source frame. */
interface Crop {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Variant {
  /** Art-direction key; `base` is the fallback rendered by `<img>`. */
  key: string;
  /** `<source media>`; omitted on the base variant. */
  media?: string;
  /** `<source sizes>` for this breakpoint. */
  sizes: string;
  crop: Crop;
  /** Output aspect ratio (width / height). */
  aspect: number;
  widths: number[];
}

interface Recipe {
  name: string;
  source: string;
  /** Variant order matters: the browser picks the first matching `<source>`. */
  variants: Variant[];
}

const FULL: Crop = { left: 0, top: 0, width: 1, height: 1 };

/** Split sections render a 6-of-12 column panel, capped at the 1920px shell. */
const SPLIT_SIZES =
  "(min-width: 1920px) 936px, (min-width: 641px) 48vw, calc(100vw - 32px)";
const SPLIT_WIDTHS = [480, 720, 960, 1200, 1600, 1920];
/** Only the 561-640px band renders the landscape 4/3 panel. */
const SPLIT_WIDE_MEDIA = "(min-width: 561px) and (max-width: 640px)";
const SPLIT_WIDE_WIDTHS = [640, 1280];

const RECIPES: Recipe[] = [
  {
    name: "hero",
    source: "hero 2.jpg",
    variants: [
      {
        key: "base",
        sizes: "100vw",
        crop: FULL,
        aspect: 3 / 2,
        widths: [1280, 1600, 1920, 2560, 3200],
      },
    ],
  },
  {
    name: "corp-gift",
    source: "Корпоративним клієнтам.jpg",
    // The gift box, both hands and the labelled jar sit inside x 0.17-0.68.
    variants: [
      {
        key: "wide",
        media: SPLIT_WIDE_MEDIA,
        sizes: "calc(100vw - 32px)",
        crop: { left: 0, top: 0, width: 0.89, height: 1 },
        aspect: 4 / 3,
        widths: SPLIT_WIDE_WIDTHS,
      },
      {
        key: "base",
        sizes: SPLIT_SIZES,
        crop: { left: 0.175, top: 0, width: 0.501, height: 1 },
        aspect: 3 / 4,
        widths: SPLIT_WIDTHS,
      },
    ],
  },
  {
    name: "about-taste",
    source: "Якість, яку відчуваєш на смак.jpg",
    // Face sits at y 0.20-0.40 and the held jar ends at y 0.70.
    variants: [
      {
        key: "wide",
        media: SPLIT_WIDE_MEDIA,
        sizes: "calc(100vw - 32px)",
        crop: { left: 0, top: 0.21, width: 1, height: 0.5 },
        aspect: 4 / 3,
        widths: SPLIT_WIDE_WIDTHS,
      },
      {
        key: "base",
        sizes: SPLIT_SIZES,
        crop: { left: 0, top: 0.026, width: 1, height: 0.89 },
        aspect: 3 / 4,
        widths: SPLIT_WIDTHS,
      },
    ],
  },
];

/**
 * Calibrated against the originals: this unsharp mask restores the
 * high-frequency energy that downsampling and the encoder remove, landing
 * within a few percent of the source's own grain detail without ringing.
 */
const UNSHARP = { sigma: 0.6, m1: 0.5, m2: 0.12 } as const;
const ENCODERS = [
  {
    extension: "avif",
    type: "image/avif",
    apply: (image: Sharp) =>
      image.avif({ quality: 68, effort: 6, chromaSubsampling: "4:2:0" }),
  },
  {
    extension: "webp",
    type: "image/webp",
    apply: (image: Sharp) =>
      image.webp({ quality: 82, effort: 6, smartSubsample: true }),
  },
] as const;

const OUTPUT_DIRECTORY = "public/assets/img/editorial-set";
const MANIFEST = "src/content/editorial-media.json";

function parseArguments() {
  const args = process.argv.slice(2);
  const read = (flag: string) => {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
  };
  return {
    sources: read("--sources") ?? process.env.EDITORIAL_SOURCES ?? "",
    only: read("--only"),
    dryRun: args.includes("--dry-run"),
  };
}

function pixelCrop(crop: Crop, width: number, height: number) {
  const left = Math.round(crop.left * width);
  const top = Math.round(crop.top * height);
  return {
    left,
    top,
    width: Math.min(Math.round(crop.width * width), width - left),
    height: Math.min(Math.round(crop.height * height), height - top),
  };
}

async function buildVariant(
  recipe: Recipe,
  variant: Variant,
  sourcePath: string,
  dryRun: boolean,
) {
  const metadata = await sharp(sourcePath).metadata();
  const region = pixelCrop(variant.crop, metadata.width, metadata.height);
  // Centre the requested aspect inside the crop so the subject keeps its margins.
  const cropAspect = region.width / region.height;
  if (cropAspect > variant.aspect) {
    const width = Math.round(region.height * variant.aspect);
    region.left += Math.round((region.width - width) / 2);
    region.width = width;
  } else {
    const height = Math.round(region.width / variant.aspect);
    region.top += Math.round((region.height - height) / 2);
    region.height = height;
  }

  const sources: Record<string, string> = {};
  let intrinsic = { width: 0, height: 0 };
  for (const encoder of ENCODERS) {
    const entries: string[] = [];
    for (const width of variant.widths) {
      if (width > region.width) continue;
      const height = Math.round(width / variant.aspect);
      const buffer = await encoder
        .apply(
          sharp(sourcePath)
            .rotate()
            .extract(region)
            .resize(width, height, { kernel: "lanczos3" })
            .toColorspace("srgb")
            .sharpen(UNSHARP),
        )
        .toBuffer();
      // The digest makes every URL immutable, so the files can be cached for a
      // year and a re-encode never serves a stale photo from a browser cache.
      const digest = createHash("sha256")
        .update(buffer)
        .digest("hex")
        .slice(0, 8);
      const file = `${recipe.name}-${variant.key}-${width}.${digest}.${encoder.extension}`;
      if (!dryRun) await writeFile(path.join(OUTPUT_DIRECTORY, file), buffer);
      entries.push(`/assets/img/editorial-set/${file} ${width}w`);
      intrinsic = { width, height };
    }
    if (!entries.length)
      throw new Error(`${recipe.name}/${variant.key}: source is too small`);
    sources[encoder.type] = entries.join(", ");
  }
  return {
    ...(variant.media ? { media: variant.media } : {}),
    sizes: variant.sizes,
    width: intrinsic.width,
    height: intrinsic.height,
    sources,
  };
}

async function main() {
  const { sources, only, dryRun } = parseArguments();
  if (!sources)
    throw new Error("Pass --sources <dir> with the original photographs.");
  const recipes = RECIPES.filter((recipe) => !only || recipe.name === only);
  if (!recipes.length) throw new Error(`Unknown recipe: ${only}`);

  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  const manifest: Record<string, unknown> = existsSync(MANIFEST)
    ? JSON.parse(await readFile(MANIFEST, "utf8"))
    : {};

  for (const recipe of recipes) {
    const sourcePath = path.join(sources, recipe.source);
    if (!existsSync(sourcePath))
      throw new Error(`Missing source: ${sourcePath}`);
    // Digested names never collide, so drop this recipe's previous output
    // rather than leaving orphaned rungs behind.
    if (!dryRun)
      for (const file of await readdir(OUTPUT_DIRECTORY))
        if (file.startsWith(`${recipe.name}-`))
          await rm(path.join(OUTPUT_DIRECTORY, file), { force: true });

    const variants = [];
    for (const variant of recipe.variants)
      variants.push(await buildVariant(recipe, variant, sourcePath, dryRun));
    const base = variants.at(-1)!;
    manifest[recipe.name] = {
      variants,
      width: base.width,
      height: base.height,
      fallback: base.sources["image/webp"]!.split(" ")[0],
    };
    console.log(`${recipe.name}: ${variants.length} variant(s)`);
  }

  if (!dryRun)
    await writeFile(
      MANIFEST,
      `${JSON.stringify(Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`,
    );
}

await main();
