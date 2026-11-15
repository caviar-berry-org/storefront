import "server-only";

import type { Transaction } from "firebase-admin/firestore";
import type {
  CatalogKind,
  CatalogRecord,
  CaviarData,
  GiftData,
} from "@/domain/managed-catalog";
import {
  catalogCollections,
  catalogRecordArchived,
  catalogSupport,
} from "@/lib/catalog-collections";
import { firebaseAdminDatabase as catalogDatabase } from "../firestore";

export const inventoryCollection = catalogSupport.inventory;
export const packReferencesCollection = catalogSupport.packReferences;

export function writeCatalogRecord(
  tx: Transaction,
  db: ReturnType<typeof catalogDatabase>,
  kind: "caviar" | "gift-sets",
  record: CatalogRecord,
) {
  const { records, published } = catalogCollections[kind];
  tx.set(db.collection(records).doc(record.id), {
    ...record,
    archived: catalogRecordArchived(record),
  });
  const view = db.collection(published).doc(record.id);
  if (record.published) {
    tx.set(view, { rank: record.rank, data: record.data });
  } else {
    tx.delete(view);
  }
}

export function writeInventory(
  tx: Transaction,
  db: ReturnType<typeof catalogDatabase>,
  record: CatalogRecord<"caviar">,
  removed: string[] = [],
) {
  const collection = db.collection(inventoryCollection);
  for (const pack of record.data.copy.ua.variants) {
    tx.set(collection.doc(pack.id), {
      id: pack.id,
      productId: record.id,
      name: record.data.copy.ua.name,
      weightGrams: pack.weightGrams,
      enabled: pack.available,
      stock: record.data.stock[pack.id],
      revision: record.revision,
      rank: record.rank,
    });
  }
  for (const id of removed) tx.delete(collection.doc(id));
}

export function giftPackIds(gift?: GiftData) {
  return [...new Set(gift?.items.flatMap((item) => item.variantIds) ?? [])];
}

export function productSlug(data: CaviarData) {
  return data.copy.ua.slug;
}

/**
 * The next display rank for a card entering the storefront.
 *
 * Derived from both the stored counter and the highest rank actually in use,
 * because the counter is a separate document and any write that bypasses it —
 * a seed, a migration, an edit in the console — leaves it behind. When that
 * happens a freshly created product is handed a rank below an existing one and
 * does not appear last, which is exactly the defect this guards against.
 *
 * Must be called before the transaction's first write.
 */
export async function nextCatalogRank(
  tx: Transaction,
  db: FirebaseFirestore.Firestore,
  kind: CatalogKind,
) {
  const sequence = db.collection(catalogSupport.settings).doc(kind);
  const [stored, highest] = await Promise.all([
    tx.get(sequence),
    tx.get(
      db
        .collection(catalogCollections[kind].records)
        .orderBy("rank", "desc")
        .limit(1),
    ),
  ]);
  const used = Number(highest.docs[0]?.get("rank"));
  const counter = Number(stored.get("rank"));
  const rank =
    Math.max(
      100,
      Number.isFinite(counter) ? counter : 0,
      Number.isFinite(used) ? used : 0,
    ) + 1;
  return { sequence, rank };
}
