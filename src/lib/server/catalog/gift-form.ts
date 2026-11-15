import "server-only";

import {
  giftItemLimit,
  giftItemNameLimit,
  isGiftPriceBoundary,
  validCatalogId,
  type GiftData,
} from "@/domain/managed-catalog";
import type { Locale } from "@/i18n/routing";
import {
  CatalogFieldError,
  image,
  integer,
  localized,
  price,
  text,
} from "./form-fields";

export function giftInput(form: FormData, previous?: GiftData): GiftData {
  const legacy = {
    ua: previous?.items.map((item) => item.ua) ?? [],
    en: previous?.items.map((item) => item.en) ?? [],
  };
  function itemName(key: string, locale: Locale) {
    const field = `${key}.${locale}`;
    const value = text(form, field, 200);
    if (value.length <= giftItemNameLimit) return value;

    const unchanged = legacy[locale].indexOf(value);
    if (unchanged < 0) throw new CatalogFieldError(field);
    legacy[locale].splice(unchanged, 1);
    return value;
  }
  const count = integer(form, "itemCount", 1, giftItemLimit);
  const boundary = text(form, "boundary", 5);
  if (!isGiftPriceBoundary(boundary)) throw new CatalogFieldError("boundary");
  return {
    name: localized(form, "name", 90),
    alt: localized(form, "alt", 180),
    boundary,
    priceMinor: price(form, "price"),
    image: image(form, "image"),
    items: Array.from({ length: count }, (_, index) => {
      const key = `items.${index}`;
      const ids = form.getAll(`${key}.variantIds`);
      if (ids.length > 6 || !ids.every(validCatalogId))
        throw new CatalogFieldError(`${key}.variantIds`);
      return {
        ua: itemName(key, "ua"),
        en: itemName(key, "en"),
        variantIds: [...new Set(ids)],
      };
    }),
  };
}
