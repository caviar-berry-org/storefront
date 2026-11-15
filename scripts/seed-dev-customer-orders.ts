import { contactLookupTerms } from "../src/domain/customer-directory.ts";
import { orderCollectionPath, type Order } from "../src/domain/orders.ts";
import type { Firestore } from "firebase-admin/firestore";
import type {
  CustomerActivity,
  CustomerSummary,
  OrderLineSnapshot,
} from "../src/domain/customer-directory.ts";
import { kyivDate } from "../src/domain/inquiry.ts";
import type { CatalogRecord } from "../src/domain/managed-catalog.ts";
import { catalogCollections } from "../src/lib/catalog-collections.ts";

export async function seedDevCustomerOrders(db: Firestore) {
  const customer = db.collection("customers").doc("demo-customer-01");
  const ids = ["demo-1", "demo-2", "demo-order-03"];
  const events = ids.map((id) => customer.collection("activity").doc(id));
  const orders = ids.map((_, index) =>
    db
      .collection(orderCollectionPath("development"))
      .doc(`demo-order-01-0${index + 1}`),
  );

  await db.runTransaction(
    async (tx) => {
      const [profile, ...snapshots] = await tx.getAll(
        customer,
        ...events,
        ...orders,
      );
      if (!profile?.exists || profile.get("demo") !== true)
        throw new Error("Seed the demo customers first.");
      const prior = snapshots.slice(0, events.length);
      const savedOrders = snapshots.slice(events.length);
      if (
        savedOrders.some((order) => order.exists && order.get("demo") !== true)
      )
        throw new Error(
          "A reserved demo order ID already belongs to another order.",
        );

      const needsLines = prior.some(
        (event) => !event.get("orderLines")?.length,
      );
      const products = needsLines
        ? await tx.get(
            db
              .collection(catalogCollections.caviar.records)
              .orderBy("rank")
              .limit(12),
          )
        : null;
      const candidates = (products?.docs ?? []).flatMap((doc) => {
        const record = doc.data() as CatalogRecord<"caviar">;
        const product = record.data.copy.ua;
        return product.variants.flatMap((variant) =>
          (record.data.stock[variant.id]?.batches ?? []).map((batch) => ({
            productId: doc.id,
            variantId: variant.id,
            name: product.name,
            weightGrams: variant.weightGrams,
            unitPriceMinor: variant.priceMinor,
            batchCode: batch.code,
            expiresOn: batch.expiresOn,
            stock: batch.quantity,
          })),
        );
      });
      const customerData = profile.data() as CustomerSummary;
      const usedProducts = new Set<string>();

      for (const [index, ref] of events.entries()) {
        const existing = prior[index];
        const saved = existing?.data() as CustomerActivity | undefined;
        const subject = `DEMO-01-0${index + 1}`;
        if (saved && (saved.kind !== "order" || saved.subject !== subject))
          throw new Error(
            "A reserved demo order ID already belongs to another event.",
          );
        if (saved && saved.demo !== true)
          throw new Error(
            "A reserved demo event belongs to a non-demo record.",
          );
        const orderRef = orders[index]!;
        const occurredAt =
          saved?.occurredAt ??
          customerData.lastInteractionAt - index * 86_400_000;
        let lines = saved?.orderLines;
        if (!lines?.length) {
          const purchaseDate = kyivDate(new Date(occurredAt));
          const quantity = index === 1 ? 2 : 1;
          const selected = candidates.find(
            ({ productId, expiresOn, stock }) =>
              !usedProducts.has(productId) &&
              expiresOn >= purchaseDate &&
              stock >= quantity,
          );
          if (!selected)
            throw new Error(
              "Seed demo inventory batches before creating demo orders.",
            );
          const {
            productId,
            variantId,
            name,
            weightGrams,
            unitPriceMinor,
            batchCode,
            expiresOn,
          } = selected;
          lines = [
            {
              productId,
              variantId,
              name,
              weightGrams,
              unitPriceMinor,
              batchCode,
              expiresOn,
              quantity,
            },
          ] satisfies OrderLineSnapshot[];
        }
        for (const { productId } of lines) usedProducts.add(productId);
        const totalMinor = lines.reduce(
          (sum, line) => sum + line.quantity * line.unitPriceMinor,
          0,
        );
        if (saved?.orderId !== orderRef.id || !saved.orderLines?.length) {
          tx.set(ref, {
            kind: "order",
            subject,
            occurredAt,
            demo: true,
            orderId: orderRef.id,
            orderLines: lines,
            totalMinor,
          } satisfies Omit<CustomerActivity, "id">);
        }
        if (!savedOrders[index]?.exists) {
          const { name, email, phone, type } = customerData;
          const contact = { id: customer.id, name, email, phone, type };
          tx.create(orderRef, {
            number: subject,
            createdAt: occurredAt,
            customer: contact,
            type: index === 0 ? "online" : index === 1 ? "iban" : "corporate",
            status:
              index === 0
                ? "new"
                : index === 1
                  ? "awaitingPayment"
                  : "received",
            demo: true,
            revision: 1,
            totalMinor,
            subtotalMinor: totalMinor,
            discountMinor: 0,
            payment:
              index === 1
                ? { method: "iban", status: "pending" }
                : {
                    method: index === 0 ? "online" : "iban",
                    status: "paid",
                    paidAt: occurredAt,
                  },
            delivery: {
              method: "branch",
              city: "Київ",
              destination: "Тестове відділення",
            },
            lines: lines.map(({ batchCode, expiresOn, ...line }) => ({
              ...line,
              ...(index === 2 && {
                batches: [
                  { code: batchCode, expiresOn, quantity: line.quantity },
                ],
              }),
            })),
            lookupKeys: contactLookupTerms(contact),
          } satisfies Omit<Order, "id"> & { lookupKeys: string[] });
        }
      }
      if (customerData.orderCount < events.length)
        tx.update(customer, { orderCount: events.length });
    },
    { maxAttempts: 2 },
  );
}
