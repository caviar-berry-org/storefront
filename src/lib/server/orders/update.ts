import { cancelOrder } from "./cancel";
import "server-only";

import {
  activeOrderStatuses,
  applyOrderChange,
  type OrderChange,
  type OrderError,
  type OrderEvent,
  type OrderSummary,
} from "@/domain/orders";
import { firebaseAdminDatabase } from "../firestore";
import { orderCollection, orderData } from "./storage";

const activeStatuses = new Set<OrderSummary["status"]>(activeOrderStatuses);

export async function changeOrder(
  id: string,
  actor: { uid: string; name?: string },
  change: OrderChange,
  revision?: number,
): Promise<
  { changed: boolean; activeChanged?: boolean } | { error: OrderError }
> {
  if (change.action === "status" && change.status === "cancelled")
    return cancelOrder(id, revision, actor);
  const db = firebaseAdminDatabase();
  const ref = orderCollection(db).doc(id);
  const event = ref.collection("activity").doc();
  const at = Date.now();

  return db.runTransaction(async (tx) => {
    const order = orderData(await tx.get(ref));
    if (!order) return { error: "missing" };
    if (change.action !== "viewed" && order.revision !== revision)
      return { error: "conflict" };
    const next = applyOrderChange(order, change, at);
    if (!next)
      return change.action === "viewed"
        ? { changed: false }
        : { error: "invalid" };
    tx.update(ref, { ...next, revision: order.revision + 1 });
    if (change.action === "payment" && order.customer.email) {
      tx.update(ref, { "mail.paid": "pending" });
      tx.set(
        ref.collection("notifications").doc("paid"),
        { state: "pending", at },
        { merge: true },
      );
    }
    tx.create(event, {
      at,
      actor,
      action: change.action,
      from: order.status,
      to: next.status,
    } satisfies Omit<OrderEvent, "id">);
    return {
      changed: true,
      activeChanged:
        activeStatuses.has(order.status) !== activeStatuses.has(next.status),
    };
  });
}
