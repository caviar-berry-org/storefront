import type { MetadataRoute } from "next";
import { journal } from "@/content/journal";
import { localizedPath, locales } from "@/i18n/routing";
import { site } from "@/lib/metadata";
import { storefrontCaviar } from "@/lib/server/catalog/storefront";

type Entry = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
  images?: string[];
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!site.production) return [];
  // The catalogue query already excludes unpublished, archived and the test
  // product, so nothing hidden can reach the sitemap through it.
  const products = await storefrontCaviar("ua");
  const entries: Entry[] = [
    { path: "", changeFrequency: "weekly", priority: 1 },
    ...products.map((product) => ({
      path: `/products/${product.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.9,
      images: [product.seo?.image, product.servingImage].filter(
        (image): image is string => Boolean(image),
      ),
    })),
    ...journal.map((article) => ({
      path: `/journal/${article.slug}`,
      changeFrequency: "yearly" as const,
      priority: 0.5,
      images: [article.image],
    })),
    { path: "/offer", changeFrequency: "yearly", priority: 0.3 },
  ];
  // One timestamp per build: the storefront is statically generated, so a build
  // is exactly when its pages last changed.
  const lastModified = new Date();

  return entries.flatMap((entry) => {
    const uk = new URL(localizedPath("ua", entry.path), site.url).href;
    const en = new URL(localizedPath("en", entry.path), site.url).href;
    return locales.map((locale) => ({
      url: locale === "ua" ? uk : en,
      lastModified,
      changeFrequency: entry.changeFrequency,
      priority: entry.priority,
      alternates: { languages: { uk, en, "x-default": uk } },
      ...(entry.images?.length && {
        images: entry.images.map((image) => new URL(image, site.url).href),
      }),
    }));
  });
}
