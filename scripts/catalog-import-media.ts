import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Product } from "../src/domain/catalog.ts";
import type {
  CatalogKind,
  CatalogRecord,
} from "../src/domain/managed-catalog.ts";
import { uploadCatalogImage } from "../src/lib/catalog-image-upload.ts";

export async function importCatalogMedia(
  caviar: CatalogRecord<"caviar">[],
  gifts: CatalogRecord<"gift-sets">[],
  env: Record<string, string | undefined>,
) {
  const uploaded = new Map<string, string>();
  async function upload(src: string, kind: CatalogKind = "caviar") {
    if (src.startsWith("https://res.cloudinary.com/")) return src;
    if (!src) return "";
    const existing = uploaded.get(src);
    if (existing) return existing;
    if (
      !/^\/assets\/img\/[\w./-]+\.(png|jpe?g|webp)$/i.test(src) ||
      src.includes("..")
    )
      throw new Error("An import image path is invalid.");
    const bytes = await readFile(`public${src}`);
    const digest = createHash("sha256").update(bytes).digest("hex");
    const format = src.split(".").at(-1)!.toLowerCase();
    const result = await uploadCatalogImage(
      new Blob([Uint8Array.from(bytes)], {
        type: `image/${format === "jpg" ? "jpeg" : format}`,
      }),
      kind,
      env,
      digest,
    );
    uploaded.set(src, result);
    return result;
  }
  async function update(product: Product): Promise<Product> {
    const servingImage = await upload(product.servingImage);
    const detail = product.detailServingImage ?? product.servingImage;
    const gallery = [];
    for (const item of product.gallery)
      gallery.push({ ...item, src: await upload(item.src) });
    const variants = [];
    for (const variant of product.variants)
      variants.push({ ...variant, image: await upload(variant.image) });
    const seo = product.seo?.image
      ? { ...product.seo, image: await upload(product.seo.image) }
      : product.seo;
    return {
      ...product,
      servingImage,
      lidImage: await upload(product.lidImage),
      ...(product.jarImage && { jarImage: await upload(product.jarImage) }),
      ...(product.jarBodyImage && {
        jarBodyImage: await upload(product.jarBodyImage),
      }),
      gallery,
      variants,
      ...(detail !== product.servingImage && {
        detailServingImage: await upload(detail),
      }),
      ...(seo && { seo }),
    };
  }
  for (const record of caviar) {
    record.data.copy = {
      ua: await update(record.data.copy.ua),
      en: await update(record.data.copy.en),
    };
  }
  for (const gift of gifts)
    gift.data.image = await upload(gift.data.image, "gift-sets");
  return uploaded.size;
}
