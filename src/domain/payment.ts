import { createVerify } from "node:crypto";

export type MonoStatus =
  | "created"
  | "processing"
  | "hold"
  | "success"
  | "failure"
  | "reversed"
  | "expired";
export type MonoInvoice = {
  invoiceId: string;
  status: MonoStatus;
  amount: number;
  ccy: number;
  reference?: string;
  modifiedDate: string;
  finalAmount?: number;
};
export function validMonoInvoice(value: unknown): value is MonoInvoice {
  if (!value || typeof value !== "object") return false;
  const v = value as MonoInvoice;
  return (
    typeof v.invoiceId === "string" &&
    /^[\w-]{1,120}$/.test(v.invoiceId) &&
    [
      "created",
      "processing",
      "hold",
      "success",
      "failure",
      "reversed",
      "expired",
    ].includes(v.status) &&
    Number.isSafeInteger(v.amount) &&
    v.amount > 0 &&
    v.ccy === 980 &&
    typeof v.modifiedDate === "string" &&
    Number.isFinite(Date.parse(v.modifiedDate))
  );
}
export function verifyMonoSignature(
  body: string,
  signature: string,
  base64Key: string,
) {
  try {
    if (signature.length > 1024 || base64Key.length > 4096) return false;
    const verifier = createVerify("SHA256");
    verifier.update(body);
    verifier.end();
    return verifier.verify(
      Buffer.from(base64Key, "base64").toString("utf8"),
      signature,
      "base64",
    );
  } catch {
    return false;
  }
}
export function paymentTransition(
  current: string,
  currentTime: number,
  next: MonoInvoice,
) {
  const at = Date.parse(next.modifiedDate);
  if (at < currentTime) return null;
  // A successful debit cannot regress on a delayed processing/failure notification.
  if (current === "paid" && next.status !== "reversed") return null;
  if (current === "refunded") return null;
  if (next.status === "success") return "paid" as const;
  if (next.status === "reversed") return "refunded" as const;
  if (["failure", "expired"].includes(next.status)) return "failed" as const;
  return "pending" as const;
}

export function invoiceBasket(
  lines: readonly import("./orders.ts").OrderLine[],
  grams = "г",
) {
  return lines.flatMap((line) => {
    const net = line.quantity * line.unitPriceMinor - (line.discountMinor ?? 0);
    if (!Number.isSafeInteger(net) || net < 0 || line.quantity < 1)
      throw new Error("Invalid invoice line.");
    const sum = Math.floor(net / line.quantity);
    const remainder = net % line.quantity;
    return [
      {
        code: line.variantId,
        name: `${line.name}, ${line.weightGrams} ${grams}`,
        qty: line.quantity - remainder,
        sum,
        total: (line.quantity - remainder) * sum,
      },
      ...(remainder
        ? [
            {
              code: `${line.variantId}-rounding`,
              name: `${line.name}, ${line.weightGrams} ${grams}`,
              qty: remainder,
              sum: sum + 1,
              total: remainder * (sum + 1),
            },
          ]
        : []),
    ].filter((row) => row.qty > 0);
  });
}
