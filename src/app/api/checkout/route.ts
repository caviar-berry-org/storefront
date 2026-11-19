import { deliverMailJobs } from "@/lib/server/mail/jobs";
import { after } from "next/server";
import { cookies } from "next/headers";
import { formatMoney } from "@/lib/format-money";
import { isLocale } from "@/i18n/routing";
import {
  cartSummary,
  quantityLimit,
  MAX_CART_SUBTOTAL_MINOR,
  MAX_QUANTITY,
  type CartLine,
} from "@/domain/cart";
import {
  validateCheckout,
  normalizePhone,
  type CheckoutInput,
} from "@/domain/checkout";
import { findVariant } from "@/domain/catalog";
import { attributionCookie, readAttribution } from "@/domain/attribution";
import { normalizePromotionCode } from "@/domain/promotion";
import { freshCaviar } from "@/lib/server/catalog/storefront";
import {
  createOrder,
  CheckoutFailure,
} from "@/lib/server/checkout/create-order";
import { ensureInvoice } from "@/lib/server/checkout/payment";
import { errorLabel, logCommerce } from "@/lib/server/observability";
import { notify } from "@/lib/server/notify/telegram";
import { ownerTicket } from "@/lib/server/notify/ticket";
import { ownerOrderFields } from "@/lib/server/mail/templates";
import { deliverOrderNotifications } from "@/lib/server/orders/notifications";
import {
  formError,
  formGuard,
  formTranslator,
  isRecord,
  readFormRequest,
} from "@/lib/server/form-request";

/**
 * Generous: a real buyer retries after a declined card or a lost connection,
 * and must never be locked out of their own purchase. The point is to stop a
 * script paying for stock transactions, not to ration a customer.
 */
const budget = { limit: 15, windowMs: 600_000 };

function validItems(items: unknown): items is CartLine[] {
  if (!Array.isArray(items) || !items.length || items.length > 100)
    return false;
  const variants = new Set<string>();
  for (const line of items) {
    if (
      !isRecord(line) ||
      typeof line.variantId !== "string" ||
      !/^[\w-]{1,100}$/.test(line.variantId) ||
      variants.has(line.variantId) ||
      typeof line.quantity !== "number" ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > MAX_QUANTITY
    )
      return false;
    variants.add(line.variantId);
  }
  return true;
}
export async function POST(request: Request) {
  const t = formTranslator(request);
  const requestedLocale =
    request.headers.get("X-Storefront-Locale") ?? undefined;
  const locale = isLocale(requestedLocale) ? requestedLocale : "ua";
  const refused = formGuard(request, t, "checkout", budget);
  if (refused) return refused;
  const input = await readFormRequest(request);
  if ("status" in input)
    return formError(t, input.status, "INVALID_REQUEST", input.message);
  if (input.data.website !== undefined && input.data.website !== "")
    return formError(t, 400, "INVALID_REQUEST", "forms.invalidRequest");
  const key = request.headers.get("Idempotency-Key");
  if (!key || !/^[a-f0-9-]{36}$/i.test(key))
    return formError(t, 400, "INVALID_REQUEST", "forms.invalidRequest");
  const {
    contact,
    items,
    promoCode,
    expectedSubtotalMinor,
    expectedTotalMinor,
  } = input.data;
  if (!isRecord(contact))
    return formError(t, 400, "INVALID_REQUEST", "forms.invalidRequest");
  const errors = validateCheckout(contact, t);
  if (Object.keys(errors).length)
    return formError(t, 422, "INVALID_CONTACT", "checkout.text1", errors);
  if (
    !validItems(items) ||
    !Number.isSafeInteger(expectedSubtotalMinor) ||
    !Number.isSafeInteger(expectedTotalMinor) ||
    Number(expectedTotalMinor) < 1
  )
    return formError(t, 422, "INVALID_CART", "checkout.invalidCart");
  const code =
    promoCode === undefined ? undefined : normalizePromotionCode(promoCode);
  if (code === null)
    return formError(t, 422, "INVALID_PROMO", "cart.invalidPromo");
  const selected = contact as unknown as CheckoutInput;
  const normalized: CheckoutInput = {
    name: selected.name.trim(),
    phone: normalizePhone(selected.phone)!,
    email: selected.email.trim().toLowerCase(),
    city: selected.city.trim(),
    address: selected.address.trim(),
    delivery: selected.delivery,
    payment: selected.payment ?? "online",
    comment: selected.comment ?? "",
    consent: true,
    ...(typeof selected.cityRef === "string" && { cityRef: selected.cityRef }),
    ...(selected.delivery === "branch" &&
      typeof selected.branchRef === "string" && {
        branchRef: selected.branchRef,
      }),
    ...(selected.delivery === "courier" && {
      street: selected.street ?? "",
      streetRef: selected.streetRef ?? "",
      house: selected.house ?? "",
      apartment: selected.apartment ?? "",
      entrance: selected.entrance ?? "",
      floor: selected.floor ?? "",
      courierComment: selected.courierComment ?? "",
    }),
  };
  const attribution = readAttribution(
    (await cookies()).get(attributionCookie)?.value,
  );
  try {
    const order = await createOrder(
      {
        contact: normalized,
        items,
        locale,
        ...(attribution && { attribution }),
        expectedSubtotalMinor: Number(expectedSubtotalMinor),
        expectedTotalMinor: Number(expectedTotalMinor),
        ...(code && { promoCode: code }),
      },
      key,
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local",
    );
    (await cookies()).set(`ucb-order-${order.id}`, key, {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
      path: "/",
      maxAge: 90 * 86400,
    });
    after(async () => {
      await Promise.allSettled([
        deliverOrderNotifications(order.id),
        deliverMailJobs(),
        // After the transaction: a retry would announce it twice. A card
        // order is announced from `applyPayment`, once the money is there.
        order.payment.method === "online"
          ? Promise.resolve(false)
          : notify(
              "order",
              order.number,
              ownerTicket(ownerOrderFields(order)),
              {
                // Every order is its own news, so nothing is throttled away.
                throttleKey: order.id,
                disclose: true,
              },
            ),
      ]);
    });
    const payable = await ensureInvoice(order);
    return Response.json(
      {
        orderId: order.id,
        returnPath: `/${locale}/order/${order.id}`,
        ...(payable.payment.status === "pending" &&
          payable.payment.pageUrl && { paymentUrl: payable.payment.pageUrl }),
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof CheckoutFailure) {
      if (error.code === "DELIVERY")
        return formError(
          t,
          422,
          "INVALID_CONTACT",
          "checkout.text1",
          normalized.delivery === "courier"
            ? { street: t("delivery.selectStreet") }
            : { address: t("delivery.selectBranch") },
        );
      if (error.code === "PROMO")
        return formError(t, 422, "INVALID_PROMO", "cart.promoRejected");
      if (error.code === "UNPAID") {
        // The shop-wide limit tripping means unpaid orders are piling up: worth
        // a human's attention. One contact over its daily allowance is routine.
        logCommerce(
          error.detail === "outstanding" ? "error" : "warn",
          "checkout.unpaid_refused",
          { locale, payment: normalized.payment, reason: error.detail },
        );
        // One message for both limits, so it never tells a stranger whether an
        // address has placed orders today.
        return formError(t, 422, "INVALID_CONTACT", "checkout.text1", {
          payment: t("checkout.unpaidUnavailable"),
        });
      }
      if (error.code === "LIMIT") {
        logCommerce("warn", "checkout.limited", { locale });
        return formError(t, 429, "RATE_LIMITED", "newsletter.rateLimited");
      }
      if (error.code === "CONFLICT")
        return formError(t, 409, "REQUEST_CONFLICT", "forms.invalidRequest");
      if (error.code === "STOCK") {
        const products = await freshCaviar(locale).catch(() => null);
        if (products) {
          const summary = cartSummary(items, products);
          const matches = items.map((line) =>
            findVariant(products, line.variantId),
          );
          return Response.json(
            {
              code: summary.overLimit ? "CART_LIMIT" : "CART_UNAVAILABLE",
              message: summary.overLimit
                ? t("cart.subtotalLimit", {
                    limit: formatMoney(MAX_CART_SUBTOTAL_MINOR, locale),
                  })
                : t("checkout.changed"),
              snapshot: matches.flatMap((match) =>
                match
                  ? [
                      {
                        id: match.variant.id,
                        limit: quantityLimit(match.variant),
                        priceMinor: match.variant.priceMinor,
                      },
                    ]
                  : [],
              ),
              errors: {},
            },
            { status: 409, headers: { "Cache-Control": "no-store" } },
          );
        }
      }
    }
    logCommerce("error", "checkout.unavailable", {
      locale,
      payment: normalized.payment,
      delivery: normalized.delivery,
      lines: items.length,
      cause:
        error instanceof CheckoutFailure
          ? `CheckoutFailure:${error.code}`
          : errorLabel(error),
    });
    return formError(t, 503, "CHECKOUT_UNAVAILABLE", "checkout.unavailable");
  }
}

export const maxDuration = 60;
