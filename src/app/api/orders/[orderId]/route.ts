export const maxDuration = 60;
import { cookies } from "next/headers";
import { after } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { orderCollection, orderData } from "@/lib/server/orders/storage";
import { digest } from "@/lib/server/checkout/create-order";
import { reconcileOrder, ensureInvoice } from "@/lib/server/checkout/payment";
import { deliverOrderNotifications } from "@/lib/server/orders/notifications";
import { firebaseAdminDatabase } from "@/lib/server/firestore";

type Context = { params: Promise<{ orderId: string }> };
async function handle(request: Request, context: Context, sync: boolean) {
  const { orderId } = await context.params;
  const failure = (status: number) =>
    Response.json(
      { code: "ORDER_UNAVAILABLE" },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  if (!/^[a-f\d]{40}$/.test(orderId)) return failure(404);
  if (sync && request.headers.get("origin") !== new URL(request.url).origin)
    return failure(403);
  const key = (await cookies()).get(`ucb-order-${orderId}`)?.value;
  if (!key || key.length > 100) return failure(404);
  try {
    const ref = orderCollection().doc(orderId);
    let order = orderData(await ref.get());
    if (
      !order?.accessHash ||
      !/^[a-f\d]{64}$/.test(order.accessHash) ||
      !timingSafeEqual(
        Buffer.from(order.accessHash, "hex"),
        Buffer.from(digest(key), "hex"),
      )
    )
      return failure(404);
    let syncUnavailable = false;
    if (sync) {
      const claim = await firebaseAdminDatabase().runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        if (Date.now() - Number(doc.get("lastCheckedAt") ?? 0) < 15000)
          return false;
        tx.update(ref, { lastCheckedAt: Date.now() });
        return true;
      });
      if (claim) {
        try {
          order = await ensureInvoice(order);
          order = await reconcileOrder(order);
        } catch {
          syncUnavailable = true;
        }
      }
      after(() => deliverOrderNotifications(orderId));
    }
    return Response.json(
      {
        id: order.id,
        number: order.number,
        status: order.status,
        payment: order.payment.status,
        method: order.payment.method,
        totalMinor: order.totalMinor,
        discountMinor: order.discountMinor,
        lines: order.lines,
        delivery: order.delivery,
        pageUrl:
          order.payment.status === "pending"
            ? order.payment.pageUrl
            : undefined,
        appUrl:
          order.payment.status === "pending" ? order.payment.appUrl : undefined,
        invoiceState: order.payment.invoiceState,
        syncUnavailable,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  } catch {
    return failure(503);
  }
}
export const GET = (request: Request, context: Context) =>
  handle(request, context, false);
export const POST = (request: Request, context: Context) =>
  handle(request, context, true);
