import type { Firestore } from "firebase-admin/firestore";
import type { CatalogRecord, Stock } from "../src/domain/managed-catalog.ts";
import { kyivDate } from "../src/domain/inquiry.ts";
import {
  catalogCollections,
  catalogSupport,
} from "../src/lib/catalog-collections.ts";
import { initialCaviar } from "../src/lib/catalog-fixtures.ts";

export async function seedDevInventory(db: Firestore) {
  const { records, published } = catalogCollections.caviar;
  const fixtures = initialCaviar();
  const refs = fixtures.map(({ id }) => db.collection(records).doc(id));
  const today = Date.parse(kyivDate());
  const expiresOn = (days: number) =>
    new Date(today + days * 86_400_000).toISOString().slice(0, 10);

  return db.runTransaction(async (tx) => {
    const snapshots = await tx.getAll(...refs);
    let count = 0;
    for (const [index, fixture] of fixtures.entries()) {
      const snapshot = snapshots[index];
      if (!snapshot?.exists) throw new Error("Import the dev catalogue first.");
      const record = snapshot.data() as CatalogRecord<"caviar">;
      const stock = { ...record.data.stock };
      const changes: [string, Stock][] = [];
      for (const [packIndex, pack] of record.data.copy.ua.variants.entries()) {
        const prior = stock[pack.id];
        const original = fixture.data.stock[pack.id];
        if (
          !prior ||
          !original ||
          prior.quantity !== original.quantity ||
          prior.reserved ||
          prior.batches.length
        )
          continue;
        const quantity = [3, 9, 15][(index + packIndex) % 3]!;
        const next = {
          quantity,
          reserved: 0,
          batches: [
            {
              code: "DEMO-A",
              expiresOn: expiresOn([8, 30, -2][packIndex % 3]!),
              quantity: 2,
            },
            {
              code: "DEMO-B",
              expiresOn: expiresOn(45 + index * 7),
              quantity: quantity - 2,
            },
          ],
        };
        changes.push([pack.id, next]);
        stock[pack.id] = next;
      }
      if (!changes.length) continue;
      const revision = record.revision + 1;
      const data = { ...record.data, stock };
      tx.update(snapshot.ref, { data, revision });
      if (record.published)
        tx.set(db.collection(published).doc(record.id), {
          data,
          rank: record.rank,
        });
      for (const [id, next] of changes) {
        tx.update(db.collection(catalogSupport.inventory).doc(id), {
          stock: next,
          revision,
        });
        count++;
      }
    }
    return count;
  });
}
