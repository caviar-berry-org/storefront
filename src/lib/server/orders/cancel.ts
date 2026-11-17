import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { OrderError, OrderEvent } from "@/domain/orders";
import {
  availableOrderStatuses,
  cancellationLeavesStockHeld,
  cancellationReleasesStock,
} from "@/domain/orders";
import type { CatalogRecord } from "@/domain/managed-catalog";
import { releaseStock } from "@/domain/checkout-stock";
import { catalogCollections } from "@/lib/catalog-collections";
import { firebaseAdminDatabase } from "../firestore";
import { orderCollection, orderData } from "./storage";
import { invalidateMonoInvoice } from "../payments/mono";
import { applyPayment } from "../checkout/payment";
import { writeCatalogRecord, writeInventory } from "../catalog/projection";
import { promotionBook } from "../promotions/storage";
import { logCommerce } from "../observability";
export async function cancelOrder(
  id: string,
  revision: number | undefined,
  actor: { uid: string; name?: string },
): Promise<
  { changed: boolean; activeChanged?: boolean } | { error: OrderError }
> {
  const db = firebaseAdminDatabase();
  const ref = orderCollection(db).doc(id);
  const before = orderData(await ref.get());
  if (!before || before.revision !== revision) return { error: "conflict" };
  if (!availableOrderStatuses(before).includes("cancelled"))
    return { error: "invalid" };
  if (
    before.payment.method === "online" &&
    before.payment.status === "pending"
  ) {
    if (!before.payment.invoiceId) return { error: "unavailable" };
    const status = await invalidateMonoInvoice(before.payment.invoiceId);
    if (status.reference !== id) return { error: "technical" };
    await applyPayment(status);
    if (!["failure", "expired", "reversed"].includes(status.status))
      return { error: "conflict" };
  }
  const outcome = await db.runTransaction(
    async (
      tx,
    ): Promise<
      | { changed: boolean; activeChanged: boolean; stockHeld: boolean }
      | { error: OrderError }
    > => {
      const order = orderData(await tx.get(ref));
      if (!order || !availableOrderStatuses(order).includes("cancelled"))
        return { error: "conflict" };
      const restore = cancellationReleasesStock(order);
      const ids = [...new Set(order.lines.map((line) => line.productId))];
      const records = restore
        ? (
            await tx.getAll(
              ...ids.map((productId) =>
                db.collection(catalogCollections.caviar.records).doc(productId),
              ),
            )
          ).map((doc) => doc.data() as CatalogRecord<"caviar"> | undefined)
        : [];
      const promoRef = order.promotion
        ? promotionBook().collection("codes").doc(order.promotion.code)
        : null;
      const promo = promoRef ? await tx.get(promoRef) : null;
      /**
       * Whether every line can actually be put back. A catalogue record deleted
       * outside the app (console, seed, migration) used to throw here, which left
       * the order impossible to cancel at all: it held stock and an unpaid-limit
       * slot forever and staff only saw "technical error". Cancelling and saying
       * the stock was not returned is the honest outcome.
       *
       * All-or-nothing on purpose: `stockReturnRequired` is one flag, and a
       * half-returned order would not tell staff which packs they still owe.
       */
      const restorable =
        restore &&
        records.every(
          (record) =>
            record &&
            order.lines
              .filter((line) => line.productId === record.id)
              .every((line) => {
                const stock = record.data.stock[line.variantId];
                return (
                  stock &&
                  (order.inventoryState === "reserved" ||
                    stock.quantity !== null)
                );
              }),
        );
      if (restorable)
        for (const record of records) {
          if (!record) continue;
          for (const line of order.lines.filter(
            (line) => line.productId === record.id,
          )) {
            const stock = record.data.stock[line.variantId]!;
            if (order.inventoryState === "reserved")
              record.data.stock[line.variantId] = releaseStock(
                stock,
                line.quantity,
              );
            else {
              const batches = [...stock.batches];
              for (const used of line.batches ?? []) {
                const batch = batches.find(
                  (b) => b.code === used.code && b.expiresOn === used.expiresOn,
                );
                if (batch) batch.quantity += used.quantity;
                else batches.push({ ...used });
              }
              record.data.stock[line.variantId] = {
                ...stock,
                quantity: stock.quantity! + line.quantity,
                batches,
              };
            }
          }
          record.revision++;
          writeCatalogRecord(tx, db, "caviar", record);
          writeInventory(tx, db, record);
        }
      if (promoRef && promo?.get("reservedBy") === id)
        tx.update(promoRef, {
          reservedBy: FieldValue.delete(),
          reservedUntil: FieldValue.delete(),
        });
      // Offline codes remain consumed after an accepted order, even if later cancelled.
      tx.update(ref, {
        status: "cancelled",
        revision: order.revision + 1,
        ...(restorable && { inventoryState: "released" }),
        cancellation: {
          at: Date.now(),
          actor: actor.uid,
          refundRequired: order.payment.status === "paid",
          trackingRemovalRequired: Boolean(order.delivery?.trackingNumber),
          stockReturnRequired: restore
            ? !restorable
            : cancellationLeavesStockHeld(order),
        },
      });
      tx.create(ref.collection("activity").doc(), {
        at: Date.now(),
        actor,
        action: "status",
        from: order.status,
        to: "cancelled",
      } satisfies Omit<OrderEvent, "id">);
      return {
        changed: true,
        activeChanged: true,
        stockHeld: restore && !restorable,
      };
    },
  );
  // Outside the transaction: Firestore retries the body, and a stock loss must
  // be counted once. Out-of-band catalogue damage is otherwise invisible until
  // someone opens the order.
  if ("stockHeld" in outcome && outcome.stockHeld)
    logCommerce("error", "cancel.stock_held", { order: id });
  return outcome;
}
