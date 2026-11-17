import "server-only";

import { after } from "next/server";
import { notify } from "./notify/telegram";

/**
 * Critical commerce events, logged as one greppable line each. The vocabulary is
 * closed on purpose: these are the moments where money, stock or a customer
 * message can be lost, and each one must be findable in the platform log.
 */
export type CommerceEvent =
  | "checkout.unavailable"
  | "checkout.limited"
  | "checkout.unpaid_refused"
  | "cancel.stock_held"
  | "invoice.unknown"
  | "payment.applied"
  | "payment.rejected"
  | "payment.unavailable"
  | "payment.disputed"
  | "webhook.unsigned"
  | "mail.unaccepted"
  | "mail.suppressed"
  | "reconcile.unavailable";

const textLimit = 200;

/**
 * Call sites must never pass a name or an address. This catches the two shapes
 * that slip in by accident anyway — an email and a phone number — while leaving
 * hexadecimal ids and invoice references readable.
 */
export function logSafeValue(value: unknown): string | number | boolean | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return null;
  const text = String(value).trim().slice(0, textLimit);
  if (!text) return null;
  if (text.includes("@")) return "[redacted]";
  if (/^[+(]?\d?[\d\s()-]{8,}$/.test(text)) return "[redacted]";
  return text;
}

/**
 * Warnings worth waking a human for. Everything at `error` level already is;
 * these mean someone is probing the shop rather than buying from it. A contact
 * over its own daily allowance is routine and stays quiet.
 */
const alertedWarnings = new Set<CommerceEvent>(["checkout.limited"]);

/**
 * Hands the alert to `after` so it runs once the response is out. Nesting is
 * supported, so a call from inside another `after` (mail jobs, reconciliation)
 * is fine. Outside a request — scripts and tests — there is no scheduler, and
 * an unconfigured sink returns before touching the network.
 */
function alertOperator(event: CommerceEvent, fields: Record<string, unknown>) {
  const work = () => notify("error", event, fields);
  try {
    after(work);
  } catch {
    void work();
  }
}

export function logCommerce(
  level: "error" | "warn",
  event: CommerceEvent,
  fields: Record<string, unknown> = {},
) {
  const safe = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, logSafeValue(value)]),
  );
  const line = `[commerce] ${JSON.stringify({ event, ...safe })}`;
  if (level === "error") console.error(line);
  else console.warn(line);
  // The log is the record; the chat is only the nudge to come and read it.
  if (level === "error" || alertedWarnings.has(event))
    alertOperator(event, safe);
}

/**
 * Firestore answers `FAILED_PRECONDITION` when a composite index is missing or
 * still building. It is the one failure a developer can fix in a minute, and the
 * message carries the console URL that creates it — so it must never be
 * flattened into a generic "unavailable".
 */
export function indexRequired(error: unknown) {
  if (!(error instanceof Error)) return false;
  const code = "code" in error ? error.code : null;
  return (
    [9, "FAILED_PRECONDITION", "failed-precondition"].includes(
      (code ?? "") as never,
    ) && /requires an index|index.*(building|not ready)/i.test(error.message)
  );
}

/** Error codes and messages never reach the customer, so keep them out of the response. */
export function errorLabel(error: unknown) {
  if (error instanceof Error) {
    const code = "code" in error ? error.code : undefined;
    return typeof code === "string" || typeof code === "number"
      ? `${error.name}:${code}`
      : error.name;
  }
  return typeof error;
}
