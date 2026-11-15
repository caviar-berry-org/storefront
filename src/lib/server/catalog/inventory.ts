import "server-only";

import { catalogCollections, catalogSupport } from "@/lib/catalog-collections";
import { firebaseAdminDatabase as catalogDatabase } from "../firestore";

import type { CatalogRecord, Stock } from "@/domain/managed-catalog";
import { inventoryCollection, writeCatalogRecord } from "./projection";
import { CatalogConflict } from "./mutation-errors";

export async function writeStock(
  id: string,
  packId: string,
  revision: number,
  updateStock: (previous: Stock) => Stock,
  staffId: string,
) {
  const db = catalogDatabase();
  const ref = db.collection(catalogCollections.caviar.records).doc(id);
  await db.runTransaction(async (tx) => {
    const record = (await tx.get(ref)).data() as
      CatalogRecord<"caviar"> | undefined;
    if (!record || record.revision !== revision || !record.data.stock[packId])
      throw new CatalogConflict();
    const stock = updateStock(record.data.stock[packId]);
    const next = {
      ...record,
      revision: revision + 1,
      data: {
        ...record.data,
        copy: {
          ua: {
            ...record.data.copy.ua,
            variants: record.data.copy.ua.variants.map((pack) =>
              pack.id === packId ? { ...pack, available: true } : pack,
            ),
          },
          en: {
            ...record.data.copy.en,
            variants: record.data.copy.en.variants.map((pack) =>
              pack.id === packId ? { ...pack, available: true } : pack,
            ),
          },
        },
        stock: { ...record.data.stock, [packId]: stock },
      },
    };
    writeCatalogRecord(tx, db, "caviar", next);
    tx.update(db.collection(inventoryCollection).doc(packId), {
      stock,
      enabled: true,
      revision: next.revision,
    });
    tx.create(db.collection(catalogSupport.audit).doc(), {
      kind: "caviar",
      recordId: id,
      packId,
      staffId: staffId,
      action: "stock",
      at: Date.now(),
      before: record.data.stock[packId].quantity,
      after: stock.quantity,
    });
  });
}
