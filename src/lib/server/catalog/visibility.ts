import "server-only";

import { catalogCollections, catalogSupport } from "@/lib/catalog-collections";
import { firebaseAdminDatabase as catalogDatabase } from "../firestore";

import type {
  CatalogKind,
  CatalogRecord,
  CaviarData,
  GiftData,
} from "@/domain/managed-catalog";
import {
  giftPackIds,
  inventoryCollection,
  nextCatalogRank,
  packReferencesCollection,
  productSlug,
  writeCatalogRecord,
  writeInventory,
} from "./projection";
import { CatalogConflict, CatalogLinked } from "./mutation-errors";

export async function writeCatalogVisibility(
  kind: CatalogKind,
  id: string,
  revision: number,
  operation: "hide" | "restore" | "delete",
  staffId: string,
) {
  const db = catalogDatabase();
  const { records, published } = catalogCollections[kind];
  const ref = db.collection(records).doc(id);
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const record = snapshot.data() as CatalogRecord | undefined;
    if (!record || record.revision !== revision) throw new CatalogConflict();
    if (operation === "delete") {
      const historical = await tx.get(
        db.collection(catalogSupport.historicalReferences).doc(`${kind}-${id}`),
      );
      if (historical.exists) throw new CatalogLinked("history");
      if (kind === "gift-sets") {
        const ids = giftPackIds(record.data as GiftData);
        const usage = ids.length
          ? await tx.getAll(
              ...ids.map((key) =>
                db.collection(packReferencesCollection).doc(key),
              ),
            )
          : [];
        for (const doc of usage)
          tx.set(doc.ref, {
            count: Math.max(0, Number(doc.get("count") ?? 0) - 1),
          });
      } else {
        const data = record.data as CaviarData;
        const ids = Object.keys(data.stock);
        const slug = db.collection(catalogSupport.slugs).doc(productSlug(data));
        const [usage, claim] = await Promise.all([
          ids.length
            ? tx.getAll(
                ...ids.map((key) =>
                  db.collection(packReferencesCollection).doc(key),
                ),
              )
            : [],
          tx.get(slug),
        ]);
        if (usage.some((doc) => Number(doc.get("count") ?? 0) > 0))
          throw new CatalogLinked("gift");
        if (Object.values(data.stock).some(({ reserved }) => reserved))
          throw new CatalogLinked("reserved");
        if (Object.values(data.stock).some(({ batches }) => batches.length))
          throw new CatalogLinked("stock");
        for (const key of ids)
          tx.delete(db.collection(inventoryCollection).doc(key));
        // Deletion is already impossible once an order references the product,
        // so nothing public can still point at this slug. Holding the claim
        // would only block reusing the name, with no way for staff to release it.
        if (claim.get("productId") === id) tx.delete(slug);
      }
      tx.delete(ref);
      tx.delete(db.collection(published).doc(id));
    } else {
      const visible = operation === "restore";
      const assignRank = visible && !record.everPublished;
      const next = assignRank ? await nextCatalogRank(tx, db, kind) : null;
      const rank = next ? next.rank : record.rank;
      if (next) tx.set(next.sequence, { rank });
      writeCatalogRecord(tx, db, kind, {
        ...record,
        rank,
        published: visible,
        everPublished: record.everPublished || visible,
        revision: revision + 1,
      });
      if (kind === "caviar" && assignRank)
        writeInventory(tx, db, {
          ...record,
          rank,
          data: record.data as CaviarData,
          revision: revision + 1,
        });
    }
    tx.create(db.collection(catalogSupport.audit).doc(), {
      kind,
      recordId: id,
      staffId: staffId,
      action: operation,
      at: Date.now(),
      revision: revision + 1,
    });
  });
}
