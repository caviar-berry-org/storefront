import { queueRestockMail, deliverMailJobs } from "@/lib/server/mail/jobs";
import { timingSafeEqual } from "node:crypto";
import { orderCollection, orderData } from "@/lib/server/orders/storage";
import { reconcileOrder } from "@/lib/server/checkout/payment";
import { deliverCustomerNotifications } from "@/lib/server/orders/notifications";
import { firebaseAdminDatabase } from "@/lib/server/firestore";
import { errorLabel, logCommerce } from "@/lib/server/observability";
import { smtpTransport, type MailTransport } from "@/lib/server/mail/smtp";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (
    !secret ||
    secret.length < 32 ||
    !authorization ||
    authorization.length !== secret.length + 7 ||
    !timingSafeEqual(
      Buffer.from(authorization),
      Buffer.from(`Bearer ${secret}`),
    )
  )
    return new Response(null, { status: 401 });
  let checked = 0,
    unavailable = 0,
    mailed = 0;
  try {
    // "unknown" is included deliberately: asking the provider for an invoice
    // status is a read, so it resolves the ambiguous case without ever creating
    // a second debit. Orders with no invoice id at all still need a human, and
    // the admin has a form for exactly that.
    const pending = await orderCollection()
      .where("payment.method", "==", "online")
      .where("payment.status", "==", "pending")
      .where("payment.invoiceState", "in", ["ready", "unknown"])
      .limit(10)
      .get();
    for (const doc of pending.docs) {
      const order = orderData(doc)!;
      if (!order.payment.invoiceId) continue;
      try {
        await reconcileOrder(order);
        checked++;
      } catch (error) {
        unavailable++;
        logCommerce("warn", "reconcile.unavailable", {
          order: order.id,
          cause: errorLabel(error),
        });
      }
    }
    // Retried by mail state, not by recency: a shipment letter queued for an
    // order placed weeks ago must still go out if the request-time attempt died.
    // "sending" is excluded on purpose — that outcome is ambiguous and must not
    // be resent automatically.
    const stalled = await firebaseAdminDatabase()
      .collectionGroup("notifications")
      .where("state", "in", ["pending", "failed"])
      .limit(40)
      .get();
    const orders = [
      ...new Set(
        stalled.docs
          .map((doc) => doc.ref.parent.parent?.id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    mailed = orders.length;
    // One pooled connection for the whole batch, four orders at a time, and the
    // shared job queue drained once at the end rather than once per order.
    if (orders.length) {
      let shared: MailTransport | undefined;
      let unpoolable = false;
      try {
        for (let i = 0; i < orders.length; i += 4)
          await Promise.allSettled(
            orders.slice(i, i + 4).map((id) => {
              if (!shared && !unpoolable)
                try {
                  shared = smtpTransport(process.env, true);
                } catch {
                  // Fall back to one connection per letter, so a configuration
                  // fault is still classified by sendMail as it was before.
                  unpoolable = true;
                }
              return deliverCustomerNotifications(id, shared);
            }),
          );
      } finally {
        shared?.close();
      }
    }
    await queueRestockMail();
    await deliverMailJobs();
    return Response.json(
      { checked, unavailable, mailed },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logCommerce("error", "reconcile.unavailable", {
      cause: errorLabel(error),
    });
    return Response.json(
      { code: "RECONCILIATION_UNAVAILABLE" },
      { status: 503 },
    );
  }
}
