import { queueOwnerMail } from "../mail/jobs";
import { ownerOrderFields } from "../mail/templates";
import { kyivDate } from "@/domain/inquiry";
import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { MonoInvoice } from "@/domain/payment";
import { paymentTransition } from "@/domain/payment";
import { consumeStock, releaseStock } from "@/domain/checkout-stock";
import type { CatalogRecord } from "@/domain/managed-catalog";
import type { Order } from "@/domain/orders";
import { catalogCollections } from "@/lib/catalog-collections";
import { firebaseAdminDatabase } from "../firestore";
import { orderCollection, orderData } from "../orders/storage";
import { writeCatalogRecord, writeInventory } from "../catalog/projection";
import { promotionBook } from "../promotions/storage";
import { createMonoInvoice, monoInvoiceStatus } from "../payments/mono";
import { errorLabel, logCommerce } from "../observability";

/**
 * A payment that can never match this order: the amount, currency or invoice
 * binding is wrong. Retrying cannot help, so the webhook must stop the provider
 * from redelivering it — and the attempt must be logged, because a mismatched
 * amount is a security event, not noise.
 */
export class PaymentRejected extends Error {
  constructor(
    readonly reason:
      | "reference"
      | "method"
      | "amount"
      | "currency"
      | "final-amount"
      | "invoice"
      | "invoice-state",
  ) {
    super(`Payment rejected: ${reason}`);
  }
}

export async function ensureInvoice(order: Order) {
  if (
    order.payment.method !== "online" ||
    order.payment.status !== "pending" ||
    order.inventoryState !== "reserved"
  )
    return order;
  const db = firebaseAdminDatabase();
  const ref = orderCollection(db).doc(order.id);
  const claim = await db.runTransaction(async (tx) => {
    const current = orderData(await tx.get(ref));
    if (
      !current ||
      current.payment.invoiceState ||
      current.payment.status !== "pending"
    )
      return false;
    tx.update(ref, { "payment.invoiceState": "creating" });
    return true;
  });
  if (claim) {
    try {
      const invoice = await createMonoInvoice(
        order,
        `/${order.locale ?? "ua"}/order/${order.id}`,
      );
      await db.runTransaction(async (tx) => {
        const current = orderData(await tx.get(ref));
        if (
          !current ||
          (current.payment.invoiceId &&
            current.payment.invoiceId !== invoice.invoiceId)
        )
          throw new Error("Invoice conflict.");
        tx.update(ref, {
          "payment.invoiceId": invoice.invoiceId,
          "payment.pageUrl": invoice.pageUrl,
          ...(invoice.appUrl && { "payment.appUrl": invoice.appUrl }),
          "payment.invoiceState": "ready",
        });
      });
    } catch (error) {
      // A timeout may have created an invoice: never blindly create a second debit.
      logCommerce("error", "invoice.unknown", {
        order: order.id,
        cause: errorLabel(error),
      });
      await ref.update({ "payment.invoiceState": "unknown" }).catch(() => {});
    }
  }
  return orderData(await ref.get())!;
}
export async function applyPayment(invoice: MonoInvoice) {
  const applied = await applyPaymentTransaction(invoice);
  // Logged outside the transaction, because Firestore retries the callback on
  // contention; a replayed webhook that changes nothing must stay silent.
  if (applied.changed)
    logCommerce(
      applied.order.status === "dispute" ? "error" : "warn",
      applied.order.status === "dispute"
        ? "payment.disputed"
        : "payment.applied",
      {
        order: applied.order.id,
        invoice: applied.order.payment.invoiceId,
        provider: applied.order.payment.providerStatus,
        status: applied.order.payment.status,
        amountMinor: applied.order.totalMinor,
        inventory: applied.order.inventoryState,
      },
    );
  return applied.order;
}

async function applyPaymentTransaction(invoice: MonoInvoice) {
  if (!invoice.reference || !/^[a-f\d]{40}$/.test(invoice.reference))
    throw new PaymentRejected("reference");
  const db = firebaseAdminDatabase();
  const ref = orderCollection(db).doc(invoice.reference);
  return db.runTransaction(async (tx) => {
    const order = orderData(await tx.get(ref));
    // A missing order is treated as transient, never rejected: the provider must
    // keep redelivering rather than drop a payment we failed to read.
    if (!order) throw new Error("Order unavailable.");
    if (order.payment.method !== "online") throw new PaymentRejected("method");
    if (invoice.ccy !== 980) throw new PaymentRejected("currency");
    if (order.totalMinor !== invoice.amount)
      throw new PaymentRejected("amount");
    if (
      order.payment.invoiceId &&
      order.payment.invoiceId !== invoice.invoiceId
    )
      throw new PaymentRejected("invoice");
    if (
      !order.payment.invoiceId &&
      !["creating", "unknown"].includes(order.payment.invoiceState ?? "")
    )
      throw new PaymentRejected("invoice-state");
    if (
      invoice.status === "success" &&
      invoice.finalAmount !== undefined &&
      invoice.finalAmount !== order.totalMinor
    )
      throw new PaymentRejected("final-amount");
    const next = paymentTransition(
      order.payment.status,
      order.payment.modifiedAt ?? 0,
      invoice,
    );
    if (!next) return { order, changed: false };
    const changesInventory =
      order.inventoryState === "reserved" &&
      (next === "paid" || next === "failed" || next === "refunded");
    const ids = [...new Set(order.lines.map((line) => line.productId))];
    const records = changesInventory
      ? (
          await tx.getAll(
            ...ids.map((id) =>
              db.collection(catalogCollections.caviar.records).doc(id),
            ),
          )
        ).map((snap) => snap.data() as CatalogRecord<"caviar"> | undefined)
      : [];
    const promoRef = order.promotion
      ? promotionBook().collection("codes").doc(order.promotion.code)
      : null;
    const promo = promoRef ? await tx.get(promoRef) : null;
    const eventId = `mono-${invoice.invoiceId}-${Date.parse(invoice.modifiedDate)}-${invoice.status}`;
    const eventRef = ref.collection("activity").doc(eventId);
    if ((await tx.get(eventRef)).exists) return { order, changed: false };
    const paidMail =
      next === "paid"
        ? await tx.get(ref.collection("notifications").doc("paid"))
        : null;
    let inventoryIssue = false;
    const nextLines = structuredClone(order.lines);
    if (changesInventory) {
      try {
        for (const record of records) {
          if (!record) throw new Error("Reserved product missing.");
          for (const line of nextLines.filter(
            (line) => line.productId === record.id,
          )) {
            const stock = record.data.stock[line.variantId];
            if (!stock) throw new Error("Reserved stock missing.");
            const nextStock =
              next === "paid"
                ? consumeStock(stock, line.quantity, kyivDate())
                : releaseStock(stock, line.quantity);
            if (next === "paid")
              line.batches = stock.batches.flatMap((batch) => {
                const left =
                  nextStock.batches.find(
                    (b) =>
                      b.code === batch.code && b.expiresOn === batch.expiresOn,
                  )?.quantity ?? 0;
                return batch.quantity > left
                  ? [{ ...batch, quantity: batch.quantity - left }]
                  : [];
              });
            record.data.stock[line.variantId] = nextStock;
          }
        }
      } catch (error) {
        if (next !== "paid") throw error;
        inventoryIssue = true;
      }
      if (!inventoryIssue)
        for (const record of records) {
          record!.revision++;
          writeCatalogRecord(tx, db, "caviar", record!);
          writeInventory(tx, db, record!);
        }
    }
    // A late success after released stock requires staff attention, never a false failure.
    const latePayment =
      next === "paid" &&
      (order.inventoryState === "released" || inventoryIssue);
    const now = Date.now();
    const payment = {
      ...order.payment,
      invoiceId: invoice.invoiceId,
      invoiceState: (order.payment.pageUrl
        ? "ready"
        : (order.payment.invoiceState ?? "ready")) as
        "ready" | "creating" | "unknown",
      status: next,
      providerStatus: invoice.status,
      modifiedAt: Date.parse(invoice.modifiedDate),
      ...(next === "paid" && { paidAt: now }),
    };
    const updated: Order = {
      ...order,
      payment,
      lines: inventoryIssue ? order.lines : nextLines,
      revision: order.revision + 1,
      ...(changesInventory &&
        !inventoryIssue && {
          inventoryState:
            next === "paid" ? ("consumed" as const) : ("released" as const),
        }),
      ...((latePayment || next === "refunded") && {
        status: "dispute" as const,
      }),
    };
    if (next === "paid" && !paidMail?.exists)
      queueOwnerMail(
        tx,
        db,
        `${order.id}-paid`,
        "order",
        ownerOrderFields(updated),
        new URL(
          `/admin/orders/${order.id}`,
          process.env.SITE_URL ?? "https://caviar.net.ua",
        ).href,
        true,
      );
    tx.update(ref, {
      payment: updated.payment,
      lines: updated.lines,
      inventoryState: updated.inventoryState,
      status: updated.status,
      revision: updated.revision,
      ...(next === "paid" && !paidMail?.exists && { "mail.paid": "pending" }),
    });
    if (
      promoRef &&
      promo?.get("reservedBy") === order.id &&
      ["paid", "failed", "refunded"].includes(next)
    )
      tx.update(
        promoRef,
        next === "paid"
          ? {
              consumedBy: order.id,
              consumedAt: now,
              reservedBy: FieldValue.delete(),
              reservedUntil: FieldValue.delete(),
            }
          : next === "failed" || next === "refunded"
            ? {
                reservedBy: FieldValue.delete(),
                reservedUntil: FieldValue.delete(),
              }
            : {},
      );
    tx.create(eventRef, {
      at: now,
      actor: { uid: "mono-webhook" },
      action: "payment",
      from: order.status,
      to: updated.status,
    });
    if (next === "paid" && !paidMail?.exists)
      tx.create(ref.collection("notifications").doc("paid"), {
        state: "pending",
        at: now,
      });
    return { order: updated, changed: true };
  });
}
export async function reconcileOrder(order: Order) {
  if (
    order.payment.method !== "online" ||
    !order.payment.invoiceId ||
    order.payment.status === "refunded"
  )
    return order;
  const invoice = await monoInvoiceStatus(order.payment.invoiceId);
  if (invoice.reference !== order.id)
    throw new Error("Invoice reference mismatch.");
  return applyPayment(invoice);
}
