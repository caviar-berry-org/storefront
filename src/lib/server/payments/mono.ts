import { getTranslator } from "@/i18n/index";
import "server-only";
import type { Order } from "@/domain/orders";
import { invoiceBasket, validMonoInvoice } from "@/domain/payment";

export function commerceOrigin() {
  const url = new URL(process.env.SITE_URL ?? "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("Public HTTPS SITE_URL required.");
  return url.origin;
}
function token() {
  if (
    !["development", "production"].includes(process.env.APP_ENV ?? "") ||
    (process.env.APP_ENV === "development" &&
      process.env.FIREBASE_PROJECT_ID !== "caviar-berry-dev") ||
    (process.env.APP_ENV === "production" &&
      (process.env.FIREBASE_PROJECT_ID === "caviar-berry-dev" ||
        (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production")))
  )
    throw new Error("Payment environment mismatch.");
  const mode = process.env.MONO_MODE;
  if (!process.env.MONO_TOKEN || (mode !== "test" && mode !== "live"))
    throw new Error("Mono is not configured.");
  if (
    mode === "live" &&
    process.env.APP_ENV !== "production" &&
    process.env.ALLOW_LIVE_PAYMENTS_IN_DEVELOPMENT !== "true"
  )
    throw new Error("Live payment preview is disabled.");
  if (mode === "test" && process.env.APP_ENV === "production")
    throw new Error("Test token cannot serve production.");
  return process.env.MONO_TOKEN.trim();
}
export function assertMonoReady() {
  token();
  commerceOrigin();
}
async function mono(path: string, body?: unknown) {
  const response = await fetch(`https://api.monobank.ua/api/merchant/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "X-Token": token(), "Content-Type": "application/json" },
    ...(body !== undefined && { body: JSON.stringify(body) }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Mono request unavailable.");
  return response.json();
}
export async function createMonoInvoice(order: Order, returnPath: string) {
  const origin = commerceOrigin();
  const t = getTranslator(order.locale ?? "ua");
  const basketOrder = invoiceBasket(order.lines, t("common.grams"));
  const money = (n: number) =>
    new Intl.NumberFormat(order.locale === "en" ? "en-GB" : "uk-UA", {
      style: "currency",
      currency: "UAH",
    }).format(n / 100);
  if (
    basketOrder.reduce((sum, line) => sum + line.total, 0) !== order.totalMinor
  )
    throw new Error("Invoice total mismatch.");
  const result = await mono("invoice/create", {
    amount: order.totalMinor,
    ccy: 980,
    paymentType: "debit",
    validity: 900,
    withAppUrl: true,
    merchantPaymInfo: {
      reference: order.id,
      destination: `Caviar Berry ${order.number}${order.discountMinor ? " · " + t("payment.invoiceDiscount", { subtotal: money(order.subtotalMinor), discount: money(order.discountMinor), total: money(order.totalMinor) }) : ""}`,
      basketOrder: basketOrder.map((row) => ({ ...row, unit: "шт." })),
    },
    redirectUrl: `${origin}${returnPath}`,
    webHookUrl: `${origin}/api/payments/mono/webhook`,
  });
  if (
    typeof result.invoiceId !== "string" ||
    !/^[\w-]{1,120}$/.test(result.invoiceId) ||
    typeof result.pageUrl !== "string"
  )
    throw new Error("Invalid Mono response.");
  const url = new URL(result.pageUrl);
  if (
    url.protocol !== "https:" ||
    !["pay.monobank.ua", "pay.mbnk.biz"].includes(url.hostname)
  )
    throw new Error("Invalid payment URL.");
  return {
    invoiceId: result.invoiceId as string,
    pageUrl: result.pageUrl as string,
    ...(typeof result.appUrl === "string" &&
      result.appUrl.startsWith("monobank://") && {
        appUrl: result.appUrl as string,
      }),
  };
}
export async function monoInvoiceStatus(invoiceId: string) {
  const result: unknown = await mono(
    `invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`,
  );
  if (!validMonoInvoice(result)) throw new Error("Invalid payment status.");
  return result;
}
let publicKey: { value: string; at: number } | undefined;
const keyLifetime = 3600000;
// A forged signature asks for a refresh. Without this floor, a flood of forged
// webhooks becomes a flood of requests against our own provider rate limit.
const refreshInterval = 60000;

export async function monoPublicKey(refresh = false) {
  const age = publicKey ? Date.now() - publicKey.at : Infinity;
  if (publicKey && age < (refresh ? refreshInterval : keyLifetime))
    return publicKey.value;
  const data = await mono("pubkey");
  if (typeof data.key !== "string") throw new Error("Mono key unavailable.");
  publicKey = { value: data.key, at: Date.now() };
  return data.key as string;
}
export async function invalidateMonoInvoice(invoiceId: string) {
  const response = await fetch(
    "https://api.monobank.ua/api/merchant/invoice/remove",
    {
      method: "POST",
      headers: { "X-Token": token(), "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) throw new Error("Invoice invalidation unavailable.");
  return monoInvoiceStatus(invoiceId);
}
