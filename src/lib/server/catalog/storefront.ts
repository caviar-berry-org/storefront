import "server-only";

import { unstable_cache, updateTag } from "next/cache";
import { cache } from "react";
import { catalogCollections } from "@/lib/catalog-collections";
import { initialGifts } from "@/lib/catalog-fixtures";
import { catalogFor } from "@/lib/catalog";
import {
  giftView,
  productView,
  type CatalogKind,
  type CatalogData,
} from "@/domain/managed-catalog";
import { kyivDate } from "@/domain/inquiry";
import { sortCatalog } from "@/domain/catalog";
import type { Locale } from "@/i18n/routing";
import { firebaseAdminDatabase as catalogDatabase } from "../firestore";

export const managedCatalogEnabled = () =>
  process.env.CATALOG_SOURCE === "firestore";
const tag = (kind: CatalogKind) => `store-catalog-${kind}`;

type PublicRecord<K extends CatalogKind> = {
  id: string;
  rank: number;
  data: CatalogData[K];
};

function publicCollection(kind: CatalogKind) {
  return catalogDatabase().collection(catalogCollections[kind].published);
}

async function queryPublished<K extends CatalogKind>(kind: K) {
  const snapshot = await publicCollection(kind).orderBy("rank").get();
  return snapshot.docs
    .filter(
      (doc) =>
        doc.id !== "checkout-test" ||
        process.env.APP_ENV === "development" ||
        process.env.TEST_PRODUCT_ENABLED === "true",
    )
    .map((doc) => ({ ...doc.data(), id: doc.id }) as PublicRecord<K>);
}

const publicCaviar = unstable_cache(
  () => queryPublished("caviar"),
  [tag("caviar"), "catalog/main"],
  {
    tags: [tag("caviar")],
    revalidate: 300,
  },
);
const publicGifts = unstable_cache(
  () => queryPublished("gift-sets"),
  [tag("gift-sets"), "catalog/main"],
  {
    tags: [tag("gift-sets")],
    revalidate: 300,
  },
);

export const storefrontCaviar = cache(async (locale: Locale) => {
  if (!managedCatalogEnabled()) return sortCatalog(catalogFor(locale));
  return sortCatalog(
    process.env.NODE_ENV === "development"
      ? await queryPublished("caviar")
      : await publicCaviar(),
  ).map(({ data }) =>
    productView(data, locale, kyivDate(), process.env.APP_ENV === "production"),
  );
});

export const storefrontGifts = cache(async (locale: Locale) => {
  const rows = managedCatalogEnabled()
    ? process.env.NODE_ENV === "development"
      ? await queryPublished("gift-sets")
      : await publicGifts()
    : initialGifts();
  return [...rows]
    .sort((a, b) => a.data.priceMinor - b.data.priceMinor || a.rank - b.rank)
    .map(({ id, data }) => giftView(id, data, locale));
});

export async function freshCaviar(locale: Locale = "ua") {
  if (!managedCatalogEnabled()) return catalogFor(locale);
  return (await queryPublished("caviar")).map(({ data }) =>
    productView(data, locale, kyivDate(), process.env.APP_ENV === "production"),
  );
}

/**
 * The public cart check runs on an unauthenticated route, so it reads the
 * tag-cached projection rather than Firestore directly: a repeated call costs no
 * document read, and stock still refreshes the moment the catalogue is saved.
 */
export const cachedCaviarProduct = cache(async (id: string) => {
  if (!managedCatalogEnabled())
    return catalogFor("ua").find((product) => product.id === id);
  const records =
    process.env.NODE_ENV === "development"
      ? await queryPublished("caviar")
      : await publicCaviar();
  const record = records.find((item) => item.id === id);
  return record
    ? productView(
        record.data,
        "ua",
        kyivDate(),
        process.env.APP_ENV === "production",
      )
    : undefined;
});

export async function publishedGiftExists(id: string) {
  if (!managedCatalogEnabled())
    return initialGifts().some((gift) => gift.id === id);
  return (await publicCollection("gift-sets").doc(id).get()).exists;
}

export function refreshCatalog(kind: CatalogKind) {
  updateTag(tag(kind));
}
