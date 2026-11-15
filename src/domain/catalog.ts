export interface Variant {
  id: string;
  weightGrams: number;
  priceMinor: number;
  available: boolean;
  stockQuantity?: number;
  image: string;
  imageIsRepresentative: boolean;
}

export interface Product {
  seo?: { title?: string; description?: string; image?: string };
  id: string;
  slug: string;
  name: string;
  englishName: string;
  latin: string;
  description: string;
  intro: string | null;
  taste: string;
  tasteAccent?: string;
  latinNote?: string;
  fishLabel?: string;
  fish: string | null;
  grain: string;
  ingredients: string;
  storage: string;
  nutrition: string;
  allergen: string;
  pairing: string;
  plate: string;
  lidImage: string;
  jarImage?: string;
  jarBodyImage?: string;
  roeImage: string;
  roeTile: number;
  servingImage: string;
  detailServingImage?: string;
  detailServingAlt?: string;
  servingAlt: string;
  gallery: { src: string; alt: string }[];
  season: string | null;
  variants: Variant[];
}

export function formatCaviarLatin(value: string, productId?: string) {
  const latin = value
    .trim()
    .replace(/^UA(?:\s*[·:–—-]\s*|\s+)/i, "")
    .replace(/\s*\*+$/, "")
    .split(/\s*×\s*|\s+[xX]\s+|(?<=[A-Za-z])x(?=[A-Z])/)
    .map((part) =>
      part
        .toUpperCase()
        .replace(/\bACIPENSER\s+/g, "A.")
        .replace(/\bONCORHYNCHUS\s+/g, "O."),
    )
    .join("x")
    .replace(/\.\s+/g, ".")
    .replace(/\s*[/·;,]\s*/g, "/");
  return latin || (productId === "trout" ? "SALMO TRUTTA" : "");
}

export function findVariant(products: readonly Product[], variantId: string) {
  for (const product of products) {
    const variant = product.variants.find((item) => item.id === variantId);
    if (variant) return { product, variant };
  }
  return undefined;
}

export function isVariantAvailable(variant: Variant) {
  return (
    variant.available &&
    (variant.stockQuantity === undefined ||
      (Number.isSafeInteger(variant.stockQuantity) &&
        variant.stockQuantity > 0))
  );
}

export const featuredCaviarOrder = [
  "premium",
  "sterlet",
  "hybrid",
  "trout",
] as const;

export function sortCatalog<T extends { id: string }>(
  products: readonly T[],
): T[] {
  const rank = (id: string) => {
    const index = featuredCaviarOrder.findIndex((featured) => featured === id);
    return index === -1 ? featuredCaviarOrder.length : index;
  };
  return [...products].sort((a, b) => rank(a.id) - rank(b.id));
}
