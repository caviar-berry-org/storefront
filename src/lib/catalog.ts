import type { Locale } from "@/i18n/routing";
import data from "@/content/products.json";
import english from "@/content/products.en.json";
import type { Product } from "@/domain/catalog";

// Availability, prices and variant IDs are shared across the preview catalogue.
export const products: Product[] = data;
const englishProducts: Product[] = products.map((product) => {
  const { galleryAlt, ...copy } = english[product.id as keyof typeof english];
  return {
    ...product,
    ...copy,
    seo: product.seo?.image ? { image: product.seo.image } : undefined,
    gallery: product.gallery.map((image, index) => ({
      ...image,
      alt: galleryAlt[index]!,
    })),
  };
});

export const catalogFor = (locale: Locale) =>
  locale === "en" ? englishProducts : products;
