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
import { CatalogFieldError } from "./form-fields";
import { caviarInput } from "./caviar-form";
import { giftInput } from "./gift-form";
import { CatalogConflict, CatalogLinked } from "./mutation-errors";

export async function saveCatalogRecord(
  kind: CatalogKind,
  id: string | null,
  recordId: string,
  revision: number,
  form: FormData,
  staffId: string,
) {
  const db = catalogDatabase();
  const source = db.collection(catalogCollections[kind].records).doc(recordId);
  const published = form.get("published") === "on";
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(source);
    const previous = snapshot.data() as CatalogRecord | undefined;
    if ((previous?.revision ?? 0) !== revision || (id && !previous))
      throw new CatalogConflict();
    const data =
      kind === "gift-sets"
        ? giftInput(form, previous?.data as GiftData | undefined)
        : caviarInput(form, recordId, previous?.data as CaviarData | undefined);
    const assignRank = !previous || (published && !previous.everPublished);
    const next = assignRank ? await nextCatalogRank(tx, db, kind) : null;
    const rank = next ? next.rank : previous!.rank;
    const record = {
      id: recordId,
      data,
      rank,
      published,
      everPublished: previous?.everPublished || published,
      revision: revision + 1,
    };
    if (kind === "gift-sets") {
      const before = giftPackIds(previous?.data as GiftData | undefined);
      const after = giftPackIds(data as GiftData);
      const changes = [...new Set([...before, ...after])].filter(
        (key) => before.includes(key) !== after.includes(key),
      );
      const refs = changes.map((key) =>
        db.collection(packReferencesCollection).doc(key),
      );
      const inventory = changes
        .filter((key) => after.includes(key))
        .map((key) => db.collection(inventoryCollection).doc(key));
      const linked = refs.length ? await tx.getAll(...refs, ...inventory) : [];
      if (linked.slice(refs.length).some((pack) => !pack.exists))
        throw new CatalogLinked();
      linked.slice(0, refs.length).forEach((count, index) => {
        const key = changes[index]!;
        tx.set(count.ref, {
          count: Math.max(
            0,
            Number(count.get("count") ?? 0) + (after.includes(key) ? 1 : -1),
          ),
        });
      });
    } else {
      const caviar = data as CaviarData;
      const old = previous?.data as CaviarData | undefined;
      const removed =
        old?.copy.ua.variants
          .filter((pack) => !caviar.stock[pack.id])
          .map((pack) => pack.id) ?? [];
      const changed =
        old?.copy.ua.variants
          .filter((pack) => {
            const next = caviar.copy.ua.variants.find(
              ({ id }) => id === pack.id,
            );
            return !next || next.weightGrams !== pack.weightGrams;
          })
          .map(({ id }) => id) ?? [];
      const slug = db.collection(catalogSupport.slugs).doc(productSlug(caviar));
      const [claims, usage, history] = await Promise.all([
        previous ? null : tx.get(slug),
        changed.length
          ? tx.getAll(
              ...changed.map((key) =>
                db.collection(packReferencesCollection).doc(key),
              ),
            )
          : [],
        changed.length
          ? tx.getAll(
              ...changed.map((key) =>
                db
                  .collection(catalogSupport.historicalReferences)
                  .doc(`pack-${key}`),
              ),
            )
          : [],
      ]);
      if (history.some((doc) => doc.exists)) throw new CatalogLinked("history");
      if (claims?.exists) throw new CatalogFieldError("slug");
      if (usage.some((doc) => Number(doc.get("count") ?? 0) > 0))
        throw new CatalogLinked("gift");
      if (!previous) tx.create(slug, { productId: recordId });
      writeInventory(tx, db, { ...record, data: caviar }, removed);
    }
    if (next) tx.set(next.sequence, { rank });
    writeCatalogRecord(tx, db, kind, record);
    tx.create(db.collection(catalogSupport.audit).doc(), {
      kind,
      recordId,
      staffId: staffId,
      action: "save",
      published,
      at: Date.now(),
      revision: revision + 1,
    });
  });
}
