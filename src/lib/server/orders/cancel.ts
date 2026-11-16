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
  return db.runTransaction(async (tx) => {
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
    if (restore)
      for (const record of records) {
        if (!record) throw new Error("Cancelled stock missing.");
        for (const line of order.lines.filter(
          (line) => line.productId === record.id,
        )) {
          const stock = record.data.stock[line.variantId];
          if (!stock) throw new Error("Cancelled pack missing.");
          if (order.inventoryState === "reserved")
            record.data.stock[line.variantId] = releaseStock(
              stock,
              line.quantity,
            );
          else {
            if (stock.quantity === null)
              throw new Error("Cancelled stock invalid.");
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
              quantity: stock.quantity + line.quantity,
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
      ...(restore && { inventoryState: "released" }),
      cancellation: {
        at: Date.now(),
        actor: actor.uid,
        refundRequired: order.payment.status === "paid",
        trackingRemovalRequired: Boolean(order.delivery?.trackingNumber),
        stockReturnRequired: cancellationLeavesStockHeld(order),
      },
    });
    tx.create(ref.collection("activity").doc(), {
      at: Date.now(),
      actor,
      action: "status",
      from: order.status,
      to: "cancelled",
    } satisfies Omit<OrderEvent, "id">);
    return { changed: true, activeChanged: true };
  });
}
