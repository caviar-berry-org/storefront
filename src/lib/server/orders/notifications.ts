import { deliverMailJobs } from "../mail/jobs";
import "server-only";
import { orderCollection, orderData } from "./storage";
import { firebaseAdminDatabase } from "../firestore";
import { MailError, sendMail, type MailTransport } from "../mail/smtp";
import { orderMessage } from "../mail/templates";
import { errorLabel, logCommerce } from "../observability";
export async function deliverOrderNotifications(id: string) {
  await Promise.allSettled([
    deliverMailJobs(),
    deliverCustomerNotifications(id),
  ]);
}
export async function deliverCustomerNotifications(
  id: string,
  transport?: MailTransport,
) {
  if (process.env.ORDER_EMAIL_ENABLED !== "true") return;
  const db = firebaseAdminDatabase();
  const ref = orderCollection(db).doc(id);
  const initial = orderData(await ref.get());
  const entries = [
    "created",
    "paid",
    ...(initial?.delivery?.trackingNumber
      ? [`shipment-${initial.delivery.trackingNumber}`]
      : []),
  ];
  for (const entry of entries) {
    const kind = entry.startsWith("shipment-")
      ? "shipment"
      : (entry as "created" | "paid");
    const notification = ref.collection("notifications").doc(entry);
    try {
      const order = await db.runTransaction(async (tx) => {
        const data = await tx.get(notification);
        const order = orderData(await tx.get(ref));
        if (
          !order?.customer.email ||
          (order.payment.method === "online" &&
            (order.payment.status !== "paid" || kind === "created")) ||
          (kind === "paid" &&
            (order.payment.method !== "online" ||
              order.payment.status !== "paid")) ||
          (kind === "shipment" &&
            (["cancelled", "dispute"].includes(order.status) ||
              order.payment.status !== "paid" ||
              order.delivery?.trackingNumber !== entry.slice(9))) ||
          !data.exists ||
          !["pending", "failed"].includes(data.get("state")) ||
          Number(data.get("attempts") ?? 0) >= 3 ||
          Date.now() - Number(data.get("lastAttemptAt") ?? 0) < 60000
        )
          return null;
        tx.update(notification, {
          state: "sending",
          lastAttemptAt: Date.now(),
          attempts: Number(data.get("attempts") ?? 0) + 1,
        });
        tx.update(ref, { [`mail.${kind}`]: "sending" });
        return order;
      });
      if (!order) continue;
      try {
        await sendMail(
          order.customer.email!,
          orderMessage(order, kind),
          `order:${id}:${entry}`,
          { purpose: "order", ...(transport && { transport }) },
        );
        await db.runTransaction(async (tx) => {
          tx.update(notification, {
            state: "accepted",
            acceptedAt: Date.now(),
          });
          tx.update(ref, { [`mail.${kind}`]: "accepted" });
        });
      } catch (error) {
        const state =
          error instanceof MailError && !error.uncertain ? "failed" : "unknown";
        logCommerce(state === "unknown" ? "error" : "warn", "mail.unaccepted", {
          order: id,
          kind,
          state,
          cause: errorLabel(error),
        });
        await notification.update({ state });
        await ref.update({ [`mail.${kind}`]: state });
      }
    } catch {
      /* The durable notification remains visible for reconciliation. */
    }
  }
}
