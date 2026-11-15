export const maxDuration = 60;
import { after } from "next/server";
import { validMonoInvoice, verifyMonoSignature } from "@/domain/payment";
import { monoPublicKey } from "@/lib/server/payments/mono";
import { applyPayment, PaymentRejected } from "@/lib/server/checkout/payment";
import { errorLabel, logCommerce } from "@/lib/server/observability";
import { deliverOrderNotifications } from "@/lib/server/orders/notifications";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const signature = request.headers.get("x-sign");
  if (
    !signature ||
    signature.length > 1024 ||
    Number(request.headers.get("content-length")) > 32768
  )
    return new Response(null, { status: 400 });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.length;
      if (length > 32768) {
        await reader.cancel();
        return new Response(null, { status: 413 });
      }
      chunks.push(chunk.value);
    }
    const body = Buffer.concat(chunks).toString("utf8");
    let valid = verifyMonoSignature(body, signature, await monoPublicKey());
    if (!valid)
      valid = verifyMonoSignature(body, signature, await monoPublicKey(true));
    if (!valid) {
      logCommerce("error", "webhook.unsigned", { bytes: length });
      return new Response(null, { status: 401 });
    }
    const data: unknown = JSON.parse(body);
    if (!validMonoInvoice(data)) {
      logCommerce("error", "webhook.unsigned", {
        bytes: length,
        reason: "shape",
      });
      return new Response(null, { status: 400 });
    }
    const order = await applyPayment(data);
    after(() => deliverOrderNotifications(order.id));
    return new Response(null, { status: 200 });
  } catch (error) {
    // A rejected payment can never match this order, so acknowledge it: another
    // delivery of the same body would fail identically. Everything else is
    // treated as transient so the provider keeps trying.
    if (error instanceof PaymentRejected) {
      logCommerce("error", "payment.rejected", { reason: error.reason });
      return new Response(null, { status: 200 });
    }
    logCommerce("warn", "payment.unavailable", { cause: errorLabel(error) });
    return new Response(null, { status: 503 });
  } finally {
    reader.releaseLock();
  }
}
