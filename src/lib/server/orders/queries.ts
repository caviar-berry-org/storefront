import "server-only";

import { FieldPath } from "firebase-admin/firestore";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import {
  activeOrderStatuses,
  orderPageSize,
  orderSearchTerm,
  type OrderCursor,
  type OrderEvent,
  type OrderFilters,
  type OrderPage,
  type OrderSummary,
} from "@/domain/orders";
import { groupOrderCounts } from "@/domain/order-metrics";
import { orderFailure } from "./feedback";
import { orderCollection, orderData } from "./storage";

const summaryFields = [
  "number",
  "createdAt",
  "customer",
  "type",
  "status",
  "payment.status",
  "totalMinor",
  "promotion",
];

function activeOrders(query: FirebaseFirestore.Query) {
  return query.where("status", "in", activeOrderStatuses);
}

export const readActiveOrderCount = cache(async () => {
  try {
    const result = await activeOrders(orderCollection()).count().get();
    return result.data().count;
  } catch (error) {
    orderFailure("count", error);
    return null;
  }
});

/**
 * The tally above the list. Aggregation queries, not a page scan: Firestore
 * bills a count per thousand documents, so five of these cost about one read.
 * Cached for a minute like the dashboard figures — the header carries the
 * timestamp so staff know the numbers are a snapshot, not a live counter.
 */
export const readOrderCounts = unstable_cache(
  async () => {
    try {
      const orders = orderCollection();
      const of = (status: string) =>
        orders.where("status", "==", status).count().get();
      const [all, fresh, done, cancelled, disputed] = await Promise.all([
        orders.count().get(),
        of("new"),
        of("received"),
        of("cancelled"),
        of("dispute"),
      ]);
      const total = all.data().count;
      // Grouped in the domain, so this strip and the dashboard chart divide
      // the order book the same way. `open` is still counted by subtraction:
      // a status added later lands there rather than vanishing from the tally.
      return {
        total,
        ...groupOrderCounts(total, {
          new: fresh.data().count,
          received: done.data().count,
          cancelled: cancelled.data().count,
          dispute: disputed.data().count,
        }),
        at: Date.now(),
      };
    } catch (error) {
      orderFailure("count", error);
      return null;
    }
  },
  ["order-counts"],
  { revalidate: 60 },
);

export async function readOrders(
  filters: OrderFilters,
  cursor: OrderCursor | null,
): Promise<OrderPage> {
  let query: FirebaseFirestore.Query = orderCollection();
  const term = orderSearchTerm(filters.search);
  if (term === null) throw new Error("Invalid order search.");
  if (term) query = query.where("lookupKeys", "array-contains", term);
  if (filters.type !== "all") query = query.where("type", "==", filters.type);
  if (filters.status === "active") query = activeOrders(query);
  else if (filters.status !== "all")
    query = query.where("status", "==", filters.status);
  query = query
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc");
  if (cursor) query = query.startAfter(cursor.createdAt, cursor.id);
  const snapshot = await query
    .select(...summaryFields)
    .limit(orderPageSize + 1)
    .get();
  const rows = snapshot.docs
    .slice(0, orderPageSize)
    .map((doc) => ({ ...doc.data(), id: doc.id }) as OrderSummary);
  const last = rows.at(-1);
  return {
    rows,
    next:
      last && snapshot.size > orderPageSize
        ? { id: last.id, createdAt: last.createdAt }
        : null,
  };
}

export async function readOrder(id: string) {
  const ref = orderCollection().doc(id);
  const order = orderData(await ref.get());
  if (!order) return null;
  const events = await ref
    .collection("activity")
    .orderBy("at", "desc")
    .orderBy(FieldPath.documentId(), "desc")
    .limit(10)
    .get();
  return {
    order,
    events: events.docs.map(
      (doc) => ({ ...doc.data(), id: doc.id }) as OrderEvent,
    ),
  };
}
