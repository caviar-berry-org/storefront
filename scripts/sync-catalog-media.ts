import type { Firestore } from "firebase-admin/firestore";
import type { CatalogRecord } from "../src/domain/managed-catalog.ts";
import { catalogCollections } from "../src/lib/catalog-collections.ts";
import { initialCaviar, initialGifts } from "../src/lib/catalog-fixtures.ts";
import { importCatalogMedia } from "./catalog-import-media.ts";

export async function syncCatalogMedia(
  db: Firestore,
  env: Record<string, string | undefined>,
) {
  const caviarRefs = initialCaviar().map(({ id }) =>
    db.collection(catalogCollections.caviar.records).doc(id),
  );
  const giftRefs = initialGifts().map(({ id }) =>
    db.collection(catalogCollections["gift-sets"].records).doc(id),
  );
  const [initialProducts, initialSets] = await Promise.all([
    db.getAll(...caviarRefs),
    db.getAll(...giftRefs),
  ]);
  const caviar = initialProducts.flatMap((doc) =>
    doc.exists ? [doc.data() as CatalogRecord<"caviar">] : [],
  );
  const gifts = initialSets.flatMap((doc) =>
    doc.exists ? [doc.data() as CatalogRecord<"gift-sets">] : [],
  );
  const count = await importCatalogMedia(caviar, gifts, env);
  if (!count) return 0;
  const entries = [
    ...caviar.map((record) => ({ record, ...catalogCollections.caviar })),
    ...gifts.map((record) => ({ record, ...catalogCollections["gift-sets"] })),
  ].map((entry) => ({
    ...entry,
    ref: db.collection(entry.records).doc(entry.record.id),
  }));
  await db.runTransaction(async (tx) => {
    const snapshots = await tx.getAll(...entries.map(({ ref }) => ref));
    if (
      snapshots.some(
        (doc, index) => doc.get("revision") !== entries[index]?.record.revision,
      )
    )
      throw new Error(
        "A catalogue item changed during media sync. Run the command again.",
      );
    entries.forEach(({ record, ref, published }, index) => {
      const previous = snapshots[index]!.data();
      if (JSON.stringify(previous?.data) === JSON.stringify(record.data))
        return;
      tx.update(ref, { data: record.data, revision: record.revision + 1 });
      if (record.published)
        tx.update(db.collection(published).doc(record.id), {
          data: record.data,
        });
    });
  });
  return count;
}
