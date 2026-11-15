import "server-only";

/**
 * Critical commerce events, logged as one greppable line each. The vocabulary is
 * closed on purpose: these are the moments where money, stock or a customer
 * message can be lost, and each one must be findable in the platform log.
 */
export type CommerceEvent =
  | "checkout.unavailable"
  | "checkout.limited"
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

export function logCommerce(
  level: "error" | "warn",
  event: CommerceEvent,
  fields: Record<string, unknown> = {},
) {
  const line = `[commerce] ${JSON.stringify({
    event,
    ...Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, logSafeValue(value)]),
    ),
  })}`;
  if (level === "error") console.error(line);
  else console.warn(line);
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
