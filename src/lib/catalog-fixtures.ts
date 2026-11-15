import type { Product } from "../domain/catalog.ts";
import { sortCatalog } from "../domain/catalog.ts";
import type {
  CaviarData,
  CatalogRecord,
  GiftData,
} from "../domain/managed-catalog.ts";
import copy from "../content/copy.json" with { type: "json" };
import storefrontEn from "../content/storefront.en.json" with { type: "json" };
import images from "../content/images.json" with { type: "json" };
import caviarUa from "../content/products.json" with { type: "json" };
import caviarEn from "../content/products.en.json" with { type: "json" };

const giftIds = ["introduction", "tasting", "premium"];
const links = [
  [["sterlet-50"], ["trout-100"]],
  [["sterlet-50"], ["hybrid-50"], ["premium-50"]],
  [["premium-100"], ["hybrid-100"]],
];

export function initialGifts(): CatalogRecord<"gift-sets">[] {
  return copy.sets.map((gift, index) => {
    const en = storefrontEn.sets[index]!;
    const data: GiftData = {
      name: { ua: gift.name, en: en.name },
      label: { ua: gift.key, en: en.label },
      alt: { ua: gift.cap, en: en.cap },
      image: images[gift.cap as keyof typeof images],
      boundary: index === 2 ? "from" : "upTo",
      priceMinor: index === 0 ? 300000 : 600000,
      items: gift.items.map((ua, row) => ({
        ua,
        en: en.items[row]!,
        variantIds: links[index]?.[row] ?? [],
      })),
    };
    return {
      id: giftIds[index]!,
      data,
      published: true,
      everPublished: true,
      rank: index + 1,
      revision: 1,
    };
  });
}

export function initialCaviar(): CatalogRecord<"caviar">[] {
  return sortCatalog(caviarUa).map((ua: Product, index) => {
    const { galleryAlt, ...en } = caviarEn[ua.id as keyof typeof caviarEn];
    const data: CaviarData = {
      copy: {
        ua,
        en: {
          ...ua,
          ...en,
          gallery: ua.gallery.map((image, row) => ({
            ...image,
            alt: galleryAlt[row]!,
          })),
        },
      },
      nutrition: {
        calories: nutrient(ua.nutrition, /([\d,.]+)\s*ккал/i) ?? 0,
        protein: nutrient(ua.nutrition, /білки\s*—\s*([\d,.]+)/i) ?? 0,
        fat: nutrient(ua.nutrition, /жири\s*—\s*([\d,.]+)/i) ?? 0,
        carbs: nutrient(ua.nutrition, /вуглеводи\s*—\s*([\d,.]+)/i) ?? 0,
        ...optionalNutrient(
          "saturatedFat",
          ua.nutrition,
          /НЖК\s*—\s*([\d,.]+)/i,
        ),
        ...optionalNutrient("kj", ua.nutrition, /([\d,.]+)\s*кДж/i),
      },
      premium: ua.id === "premium",
      stock: Object.fromEntries(
        ua.variants.map((pack) => [
          pack.id,
          {
            quantity: pack.stockQuantity ?? null,
            reserved: 0,
            batches: [],
          },
        ]),
      ),
    };
    return {
      id: ua.id,
      data,
      published: true,
      everPublished: true,
      rank: index + 1,
      revision: 1,
    };
  });
}

function nutrient(text: string, expression: RegExp) {
  const value = expression.exec(text)?.[1];
  return value === undefined ? undefined : Number(value.replace(",", "."));
}

function optionalNutrient(
  key: "saturatedFat" | "kj",
  text: string,
  expression: RegExp,
) {
  const value = nutrient(text, expression);
  return value === undefined ? {} : { [key]: value };
}
