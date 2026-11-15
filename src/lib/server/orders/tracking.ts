import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { orderCollection, orderData } from "./storage";
import { firebaseAdminDatabase } from "../firestore";
import { verifyTracking } from "../delivery/nova-poshta";
import {
  isCarrierTrackingNumber,
  normalizeTrackingNumber,
  type OrderError,
  type TrackingCheck,
  type TrackingResult,
} from "@/domain/orders";

/**
 * Stores a free-form tracking number. Fulfilment is manual, so the only hard
 * rules are: a cancelled order cannot gain one, and the customer email goes out
 * only when staff explicitly ask for it and the money is already in.
 */
export async function saveTracking(
  id: string,
  input: string,
  revision: number,
  actor: { uid: string; name?: string },
  notify: boolean,
): Promise<TrackingResult | { error: OrderError }> {
  const number = normalizeTrackingNumber(input);
  if (number === null) return { error: "invalid" };
  const db = firebaseAdminDatabase();
  const ref = orderCollection(db).doc(id);
  const order = orderData(await ref.get());
  if (!order) return { error: "missing" };
  if (order.revision !== revision) return { error: "conflict" };
  if (number && (!order.delivery || order.status === "cancelled"))
    return { error: "invalid" };

  // Advisory only: an unreachable carrier or an unknown waybill must not stop
  // staff from recording what they actually created.
  let check: TrackingCheck = "skipped";
  let carrier: { statusCode: string; checkedAt: number } | null = null;
  if (number && isCarrierTrackingNumber(number)) {
    try {
      carrier = await verifyTracking(number.replace(/[\s-]/g, ""));
      check = "ok";
    } catch {
      check = "unverified";
    }
  }

  const sendMail = Boolean(
    notify &&
    process.env.ORDER_EMAIL_ENABLED === "true" &&
    number &&
    order.customer.email &&
    order.payment.status === "paid" &&
    order.status !== "cancelled",
  );

  return db.runTransaction(async (tx) => {
    const current = orderData(await tx.get(ref));
    if (!current || current.revision !== revision) return { error: "conflict" };
    const same = (current.delivery?.trackingNumber ?? "") === number;
    const notification = number
      ? ref.collection("notifications").doc(`shipment-${number}`)
      : null;
    const queued = notification ? (await tx.get(notification)).exists : true;
    if (same && (!sendMail || queued))
      return { changed: false, check, notified: false };

    tx.update(ref, {
      ...(number
        ? {
            "delivery.trackingNumber": number,
            ...(carrier
              ? {
                  "delivery.trackingCheckedAt": carrier.checkedAt,
                  "delivery.trackingStatus": carrier.statusCode,
                }
              : {
                  "delivery.trackingCheckedAt": FieldValue.delete(),
                  "delivery.trackingStatus": FieldValue.delete(),
                }),
          }
        : {
            "delivery.trackingNumber": FieldValue.delete(),
            "delivery.trackingCheckedAt": FieldValue.delete(),
            "delivery.trackingStatus": FieldValue.delete(),
          }),
      revision: revision + 1,
      ...(sendMail && !queued && { "mail.shipment": "pending" }),
    });
    tx.create(ref.collection("activity").doc(), {
      at: Date.now(),
      actor,
      action: "tracking",
      from: current.status,
      to: current.status,
    });
    if (notification && sendMail && !queued)
      tx.create(notification, { state: "pending", at: Date.now(), number });
    return { changed: true, check, notified: sendMail && !queued };
  });
}
