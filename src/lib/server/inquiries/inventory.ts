import "server-only";
import { readCatalogRecord } from "../catalog/queries";
import { firebaseAdminDatabase } from "../firestore";
import { catalogSupport } from "@/lib/catalog-collections";
import type { InventoryRow } from "@/domain/managed-catalog";
export async function inquiryInventory(product?: string, gift?: string) {
  if (product) {
    const record = await readCatalogRecord("caviar", product);
    if (!record) return null;
    return {
      rows: record.data.copy.ua.variants.map((pack) => ({
        id: pack.id,
        productId: product,
        revision: record.revision,
        name: record.data.copy.ua.name,
        weightGrams: pack.weightGrams,
        enabled: pack.available,
        stock: record.data.stock[pack.id] ?? {
          quantity: null,
          reserved: 0,
          batches: [],
        },
      })),
      next: null,
    };
  }
  if (gift) {
    const record = await readCatalogRecord("gift-sets", gift);
    if (!record) return null;
    const ids = [
      ...new Set(record.data.items.flatMap((item) => item.variantIds)),
    ];
    if (!ids.length) return { rows: [], next: null };
    const db = firebaseAdminDatabase();
    const docs = await db.getAll(
      ...ids.map((id) => db.collection(catalogSupport.inventory).doc(id)),
    );
    return {
      rows: docs.filter((d) => d.exists).map((d) => d.data() as InventoryRow),
      next: null,
    };
  }
  return null;
}
