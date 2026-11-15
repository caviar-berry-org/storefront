import { ownerOrderFields } from "../mail/templates";
import { queueOwnerMail } from "../mail/jobs";
import { assertMonoReady } from "../payments/mono";
import "server-only";
import { createHash } from "node:crypto";
import type { CheckoutInput } from "@/domain/checkout";
import type { CartLine } from "@/domain/cart";
import { cartSummary, quantityLimit } from "@/domain/cart";
import { findVariant, type Product } from "@/domain/catalog";
import { productView, type CatalogRecord } from "@/domain/managed-catalog";
import { reserveStock, consumeStock } from "@/domain/checkout-stock";
import {
  promotionEligibleSubtotal,
  promotionTotals,
  promotionUsable,
  type Promotion,
} from "@/domain/promotion";
import {
  contactLookupTerms,
  customerLookupKey,
  customerLookupKeys,
  type CustomerSummary,
} from "@/domain/customer-directory";
import { kyivDate } from "@/domain/inquiry";
import { orderNumberLookupTerms, type Order } from "@/domain/orders";
import type { Attribution } from "@/domain/attribution";
import type { Locale } from "@/i18n/routing";
import { catalogCollections, catalogSupport } from "@/lib/catalog-collections";
import { firebaseAdminDatabase } from "../firestore";
import { orderCollection, orderData } from "../orders/storage";
import { freshCaviar } from "../catalog/storefront";
import { writeCatalogRecord, writeInventory } from "../catalog/projection";
import { resolveDelivery } from "../delivery/nova-poshta";
import { promotionBook, campaign } from "../promotions/storage";

export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export class CheckoutFailure extends Error {
  constructor(
    readonly code:
      "STOCK" | "PROMO" | "DELIVERY" | "CONFLICT" | "LIMIT" | "DISABLED",
  ) {
    super(code);
  }
}
export type OrderInput = {
  contact: CheckoutInput;
  items: CartLine[];
  promoCode?: string;
  locale: Locale;
  expectedSubtotalMinor: number;
  expectedTotalMinor: number;
  /** First-touch channel, read from the visitor's cookie by the route. */
  attribution?: Attribution;
};
export async function createOrder(
  input: OrderInput,
  key: string,
  address: string,
) {
  const db = firebaseAdminDatabase();
  const id = digest(`checkout:${key}`).slice(0, 40);
  const ref = orderCollection(db).doc(id);
  const { attribution, ...identity } = input;
  // The channel is deliberately outside the fingerprint: the same cart retried
  // after a different landing page is the same order, not a conflicting one.
  void attribution;
  const fingerprint = digest(JSON.stringify(identity));
  const before = orderData(await ref.get());
  if (before) {
    if (before.fingerprint !== fingerprint)
      throw new CheckoutFailure("CONFLICT");
    return before;
  }
  if (
    process.env.CHECKOUT_ENABLED !== "true" ||
    process.env.CATALOG_SOURCE !== "firestore"
  )
    throw new CheckoutFailure("DISABLED");
  if (input.contact.payment === "online") assertMonoReady();
  const delivery = await resolveDelivery(input.contact);
  if (!delivery) throw new CheckoutFailure("DELIVERY");
  const publicProducts = await freshCaviar(input.locale);
  const productIds = [
    ...new Set(
      input.items.map(
        (line) => findVariant(publicProducts, line.variantId)?.product.id,
      ),
    ),
  ];
  if (productIds.some((id) => !id)) throw new CheckoutFailure("STOCK");
  const refs = productIds.map((id) =>
    db.collection(catalogCollections.caviar.records).doc(id!),
  );
  const promoRef = input.promoCode
    ? promotionBook().collection("codes").doc(input.promoCode)
    : null;
  const now = Date.now();
  const budgetRef = db
    .collection(`checkoutLimits`)
    .doc(digest(`${address}:${Math.floor(now / 3600000)}`));
  const email = input.contact.email.trim().toLowerCase();
  return db.runTransaction(async (tx) => {
    const existing = orderData(await tx.get(ref));
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new CheckoutFailure("CONFLICT");
      return existing;
    }
    const records = (await tx.getAll(...refs)).map(
      (snap) => snap.data() as CatalogRecord<"caviar"> | undefined,
    );
    if (
      records.some(
        (record) =>
          !record?.published ||
          (record.id === "checkout-test" &&
            process.env.APP_ENV === "production" &&
            process.env.TEST_PRODUCT_ENABLED !== "true"),
      )
    )
      throw new CheckoutFailure("STOCK");
    const currentRecords = records as CatalogRecord<"caviar">[];
    const products: Product[] = currentRecords.map((record) =>
      productView(record.data, input.locale, kyivDate(), true),
    );
    const summary = cartSummary(input.items, products);
    if (!summary.canCheckout) throw new CheckoutFailure("STOCK");
    const promo = promoRef ? (await tx.get(promoRef)).data() : undefined;
    if (
      promoRef &&
      (!promotionUsable(promo, now) || promo?.campaign !== campaign)
    )
      throw new CheckoutFailure("PROMO");
    const promotion: Promotion | null = promo
      ? {
          code: input.promoCode!,
          percent: Number(promo.percent),
          excludedProductIds: Array.isArray(promo.excludedProductIds)
            ? promo.excludedProductIds
            : ["trout"],
          ...(Array.isArray(promo.productIds) && {
            productIds: promo.productIds,
          }),
        }
      : null;
    const eligible = promotionEligibleSubtotal(
      input.items,
      products,
      promotion,
    );
    const totals = promotionTotals(summary.subtotalMinor, promotion, eligible);
    if (
      summary.subtotalMinor !== input.expectedSubtotalMinor ||
      totals.totalMinor !== input.expectedTotalMinor ||
      totals.totalMinor < 1
    )
      throw new CheckoutFailure("STOCK");
    const budget = await tx.get(budgetRef);
    if (Number(budget.get("count") ?? 0) >= 10)
      throw new CheckoutFailure("LIMIT");
    const matches = await tx.get(
      db
        .collection("customers")
        .where(
          "lookupKeys",
          "array-contains",
          customerLookupKey("all", `email:${email}`),
        )
        .limit(1),
    );
    const customerRef =
      matches.docs[0]?.ref ??
      db.collection("customers").doc(digest(`email:${email}`));
    const previous = matches.docs[0] ?? (await tx.get(customerRef));
    const customerBefore = previous.data() as CustomerSummary | undefined;
    const customer: CustomerSummary = {
      id: customerRef.id,
      name: customerBefore?.name ?? input.contact.name.trim(),
      email: customerBefore?.email ?? email,
      phone: customerBefore?.phone ?? input.contact.phone,
      type:
        customerBefore?.type ??
        (input.contact.payment === "invoice" ? "corporate" : "retail"),
      orderCount: (customerBefore?.orderCount ?? 0) + 1,
      sources: customerBefore?.sources ?? [],
      lastInteractionAt: now,
    };
    const online = input.contact.payment === "online";
    const order: Order = {
      id,
      number: `CB-${new Date(now).toISOString().slice(0, 10).replaceAll("-", "")}-${id.slice(0, 8).toUpperCase()}`,
      createdAt: now,
      revision: 1,
      locale: input.locale,
      customer: {
        id: customerRef.id,
        name: input.contact.name.trim(),
        email,
        phone: input.contact.phone,
        type: customer.type,
      },
      type: online
        ? "online"
        : input.contact.payment === "invoice"
          ? "corporate"
          : "iban",
      status: "new",
      payment: { method: online ? "online" : "iban", status: "pending" },
      inventoryState: online ? "reserved" : "consumed",
      mail: online ? {} : { created: "pending" },
      accessHash: digest(key),
      fingerprint,
      expiresAt: now + 20 * 60000,
      subtotalMinor: summary.subtotalMinor,
      ...totals,
      ...(promotion &&
        totals.discountMinor > 0 && {
          promotion: { code: promotion.code, percent: promotion.percent },
        }),
      lines: input.items.map((line) => {
        const match = findVariant(products, line.variantId)!;
        return {
          ...line,
          productId: match.product.id,
          name: match.product.name,
          weightGrams: match.variant.weightGrams,
          unitPriceMinor: match.variant.priceMinor,
        };
      }),
      delivery: {
        method: input.contact.delivery,
        ...delivery,
        ...(input.contact.delivery === "courier" &&
          input.contact.courierComment?.trim() && {
            courierComment: input.contact.courierComment.trim(),
          }),
        ...(input.contact.comment.trim() && {
          comment: input.contact.comment.trim(),
        }),
      },
    };
    let eligibleBefore = 0;
    if (order.promotion)
      for (const line of order.lines) {
        if (
          (promotion?.excludedProductIds ?? ["trout"]).includes(
            line.productId,
          ) ||
          (promotion?.productIds &&
            !promotion.productIds.includes(line.productId))
        )
          continue;
        const gross = line.quantity * line.unitPriceMinor;
        line.discountMinor =
          Math.round(
            ((eligibleBefore + gross) * order.promotion.percent) / 100,
          ) - Math.round((eligibleBefore * order.promotion.percent) / 100);
        eligibleBefore += gross;
      }
    for (const record of currentRecords) {
      for (const line of order.lines.filter(
        (line) => line.productId === record.id,
      )) {
        const stock = record.data.stock[line.variantId];
        if (
          !stock ||
          line.quantity >
            quantityLimit(findVariant(products, line.variantId)!.variant)
        )
          throw new CheckoutFailure("STOCK");
        const reserved = reserveStock(stock, line.quantity, kyivDate());
        const after = online
          ? reserved
          : consumeStock(reserved, line.quantity, kyivDate());
        if (!online)
          line.batches = stock.batches.flatMap((batch) => {
            const left =
              after.batches.find(
                (b) => b.code === batch.code && b.expiresOn === batch.expiresOn,
              )?.quantity ?? 0;
            return batch.quantity > left
              ? [{ ...batch, quantity: batch.quantity - left }]
              : [];
          });
        record.data.stock[line.variantId] = after;
        tx.set(
          db
            .collection(catalogSupport.historicalReferences)
            .doc(`pack-${line.variantId}`),
          { orders: true },
          { merge: true },
        );
      }
      record.revision++;
      writeCatalogRecord(tx, db, "caviar", record);
      writeInventory(tx, db, record);
      tx.set(
        db
          .collection(catalogSupport.historicalReferences)
          .doc(`caviar-${record.id}`),
        { orders: true },
        { merge: true },
      );
    }
    if (promoRef && totals.discountMinor > 0)
      tx.update(
        promoRef,
        online
          ? // Held only as long as the invoice can still be paid; past that the
            // buyer gets the code back rather than losing it to an abandoned page.
            { reservedBy: id, reservedUntil: now + 20 * 60000 }
          : { consumedBy: id, consumedAt: now },
      );
    if (!online)
      queueOwnerMail(
        tx,
        db,
        id,
        "order",
        ownerOrderFields(order),
        new URL(
          `/admin/orders/${id}`,
          process.env.SITE_URL ?? "https://caviar.net.ua",
        ).href,
      );
    tx.create(ref, {
      ...order,
      // Costs no extra write: the channel rides along on the order itself.
      ...(input.attribution && { attribution: input.attribution }),
      lookupKeys: [
        ...contactLookupTerms(order.customer),
        ...orderNumberLookupTerms(order.number),
      ],
      privacyConsent: { at: now, accepted: true },
      marketingConsent: false,
    });
    tx.set(
      customerRef,
      { ...customer, lookupKeys: customerLookupKeys(customer) },
      { merge: true },
    );
    tx.create(customerRef.collection("activity").doc(id), {
      kind: "order",
      occurredAt: now,
      subject: order.number,
      totalMinor: order.totalMinor,
      orderId: id,
    });
    tx.create(ref.collection("activity").doc("created"), {
      at: now,
      actor: { uid: "storefront" },
      action: "status",
      from: "new",
      to: "new",
    });
    tx.set(budgetRef, {
      count: Number(budget.get("count") ?? 0) + 1,
      expiresAt: now + 7200000,
    });
    if (!online)
      tx.create(ref.collection("notifications").doc("created"), {
        state: "pending",
        at: now,
      });
    return order;
  });
}
