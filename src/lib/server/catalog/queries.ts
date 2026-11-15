import "server-only";

import { FieldPath } from "firebase-admin/firestore";
import { catalogCollections } from "@/lib/catalog-collections";
import {
  catalogPageSize,
  giftView,
  type CatalogCursor,
  type CatalogKind,
  type CatalogPage,
  type CatalogListEntry,
  type InventoryRow,
  type CatalogRecord,
  type CatalogData,
} from "@/domain/managed-catalog";
import { firebaseAdminDatabase as catalogDatabase } from "../firestore";

export async function readCatalogPage(
  kind: CatalogKind,
  cursor: CatalogCursor | null = null,
  archived = false,
): Promise<CatalogPage> {
  const source = catalogDatabase().collection(catalogCollections[kind].records);
  const ordered = source
    .where("archived", "==", archived)
    .orderBy("rank")
    .orderBy(FieldPath.documentId());
  const query = cursor ? ordered.startAfter(cursor.rank, cursor.id) : ordered;
  const selected =
    kind === "caviar"
      ? [
          "data.copy.ua.name",
          "data.copy.ua.servingImage",
          "data.copy.ua.servingAlt",
          "data.copy.ua.variants",
        ]
      : [
          "data.name",
          "data.alt",
          "data.image",
          "data.boundary",
          "data.priceMinor",
          "data.items",
        ];
  const result = await query
    .select("rank", "revision", "published", "everPublished", ...selected)
    .limit(catalogPageSize + 1)
    .get();
  const rows: CatalogListEntry[] = result.docs
    .slice(0, catalogPageSize)
    .map((doc) => {
      const record = doc.data() as CatalogRecord;
      const common = {
        id: doc.id,
        rank: record.rank,
        revision: record.revision,
        published: record.published,
        everPublished: record.everPublished,
      };
      if (kind === "gift-sets") {
        const gift = giftView(
          doc.id,
          record.data as CatalogData["gift-sets"],
          "ua",
        );
        return {
          ...common,
          title: gift.name,
          image: gift.image,
          alt: gift.cap,
          subtitle: gift.price,
        };
      }
      const product = (record.data as CatalogData["caviar"]).copy.ua;
      return {
        ...common,
        title: product.name,
        image: product.servingImage,
        alt: product.servingAlt,
        subtitle: product.variants
          .map(({ weightGrams }) => `${weightGrams} г`)
          .join(" · "),
      };
    });
  const last = rows.at(-1);
  return {
    rows,
    next:
      last && result.size > catalogPageSize
        ? { rank: last.rank, id: last.id }
        : null,
  };
}

export async function readCatalogRecord<K extends CatalogKind>(
  kind: K,
  id: string,
) {
  const doc = await catalogDatabase()
    .collection(catalogCollections[kind].records)
    .doc(id)
    .get();
  return doc.exists ? (doc.data() as CatalogRecord<K>) : null;
}

export async function readCatalogPackChoices() {
  const rows = await catalogDatabase()
    .collection(catalogCollections.caviar.records)
    .select("data.copy.ua.name", "data.copy.ua.variants")
    .get();
  return rows.docs.flatMap((doc) => {
    const product = doc.get(
      "data.copy.ua",
    ) as CatalogData["caviar"]["copy"]["ua"];
    return product.variants.map((pack) => ({
      id: pack.id,
      label: `${product.name} · ${pack.weightGrams} г`,
    }));
  });
}

export async function readInventoryPage(cursor: CatalogCursor | null = null) {
  const ordered = catalogDatabase()
    .collection(catalogCollections.caviar.records)
    .select(
      "rank",
      "revision",
      "data.copy.ua.name",
      "data.copy.ua.variants",
      "data.stock",
    )
    .orderBy("rank")
    .orderBy(FieldPath.documentId());
  const query = cursor ? ordered.startAfter(cursor.rank, cursor.id) : ordered;
  const result = await query.limit(catalogPageSize + 1).get();
  const products = result.docs.slice(0, catalogPageSize);
  const rows = products.flatMap((doc): InventoryRow[] => {
    const { data, revision } = doc.data() as CatalogRecord<"caviar">;
    const { name, variants } = data.copy.ua;
    return variants.map((pack) => ({
      id: pack.id,
      productId: doc.id,
      revision,
      name,
      weightGrams: pack.weightGrams,
      enabled: pack.available,
      stock: data.stock[pack.id] ?? {
        quantity: null,
        reserved: 0,
        batches: [],
      },
    }));
  });
  const last = products.at(-1);
  return {
    rows,
    next:
      last && result.size > catalogPageSize
        ? { rank: last.get("rank") as number, id: last.id }
        : null,
  };
}
