import type { Locale } from "../i18n/routing.ts";
import type { Product } from "./catalog.ts";

export const catalogPageSize = 10;
export const giftItemLimit = 6;
export const giftItemNameLimit = 30;
export const packLimit = 6;
export const catalogImageLimit = 3 * 1024 * 1024;
export const catalogImageTypes = ["image/jpeg", "image/png", "image/webp"];
export const catalogKinds = ["gift-sets", "caviar"] as const;
export type CatalogKind = (typeof catalogKinds)[number];

export type GiftItem = Record<Locale, string> & { variantIds: string[] };
export type GiftPriceBoundary = "from" | "upTo" | "fixed";

export function isGiftPriceBoundary(
  value: unknown,
): value is GiftPriceBoundary {
  return value === "from" || value === "upTo" || value === "fixed";
}

export interface GiftData {
  name: Record<Locale, string>;
  alt: Record<Locale, string>;
  label?: Record<Locale, string>;
  image: string;
  priceMinor: number;
  boundary: GiftPriceBoundary;
  items: GiftItem[];
}

export interface GiftView {
  key: string;
  name: string;
  label: string;
  cap: string;
  image: string;
  price: string;
  items: string[];
}

export interface Nutrition {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  saturatedFat?: number;
  kj?: number;
}

export interface Stock {
  quantity: number | null;
  reserved: number;
  batches: { code: string; expiresOn: string; quantity: number }[];
}

export function batchTotal(
  batches: Pick<Stock["batches"][number], "quantity">[],
) {
  return batches.reduce((sum, batch) => sum + batch.quantity, 0);
}

export function unbatchedQuantity(stock: Stock) {
  return Math.max(0, (stock.quantity ?? 0) - batchTotal(stock.batches));
}

export interface CaviarData {
  copy: Record<Locale, Product>;
  nutrition: Nutrition;
  premium: boolean;
  stock: Record<string, Stock>;
}

export type CatalogData = { "gift-sets": GiftData; caviar: CaviarData };
export type CatalogRecord<K extends CatalogKind = CatalogKind> = {
  id: string;
  data: CatalogData[K];
  published: boolean;
  everPublished: boolean;
  rank: number;
  revision: number;
};

export type CatalogCursor = { rank: number; id: string };
export type CatalogListEntry = Pick<
  CatalogRecord,
  "id" | "published" | "everPublished" | "rank" | "revision"
> & {
  title: string;
  image: string;
  alt: string;
  subtitle: string;
};
export type CatalogPage = {
  rows: CatalogListEntry[];
  next: CatalogCursor | null;
};

export const validCatalogId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,99}$/.test(value);

export function parseMinor(value: string) {
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(value.trim())) return null;
  const [major, fraction = ""] = value.trim().split(/[.,]/);
  const minor = Number(major) * 100 + Number(fraction.padEnd(2, "0"));
  return minor > 0 ? minor : null;
}

export function giftView(id: string, gift: GiftData, locale: Locale): GiftView {
  const number = new Intl.NumberFormat(locale === "en" ? "en-US" : "uk-UA", {
    minimumFractionDigits: gift.priceMinor % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  })
    .format(gift.priceMinor / 100)
    .replaceAll("\u00a0", " ");
  const prefix =
    gift.boundary === "from"
      ? locale === "en"
        ? "from "
        : "від "
      : gift.boundary === "fixed"
        ? ""
        : locale === "en"
          ? "up to "
          : "до ";
  return {
    key: id,
    name: gift.name[locale],
    label:
      gift.label?.[locale] || gift.name[locale].replace(/^[«“]|[»”]$/g, ""),
    cap: gift.alt[locale],
    image: gift.image,
    price: `${prefix}${number} ${locale === "en" ? "UAH" : "грн"}`,
    items: gift.items.map((item) => item[locale]),
  };
}

export function sellableQuantity(stock: Stock, _today: string) {
  void _today;
  if (stock.quantity === null) return undefined;
  return Math.max(0, stock.quantity - stock.reserved);
}

export function productView(
  caviar: CaviarData,
  locale: Locale,
  today: string,
  requireStock = false,
): Product {
  const product = caviar.copy[locale];
  return {
    ...product,
    latinNote: caviar.premium ? product.latinNote : undefined,
    variants: product.variants.map((pack) => {
      const stock = caviar.stock[pack.id];
      const quantity = stock ? sellableQuantity(stock, today) : undefined;
      if (quantity === undefined && !requireStock) return pack;
      return { ...pack, stockQuantity: quantity ?? 0 };
    }),
  };
}

export type InventoryRow = {
  id: string;
  revision: number;
  productId: string;
  name: string;
  weightGrams: number;
  enabled: boolean;
  stock: Stock;
};
