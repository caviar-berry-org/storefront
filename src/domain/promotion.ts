import type { CartLine } from "./cart.ts";
import { findVariant, type Product } from "./catalog.ts";
/**
 * Stamped on every issued code and checked when one is redeemed, so codes from
 * one campaign can never be spent against another.
 *
 * Renaming it invalidates every code already issued under the old name —
 * `validatePromotion` compares this value — so it can only change before real
 * customers hold codes. It also feeds the mail deduplication key.
 *
 * Lives here rather than beside the Firestore helpers because tests need it and
 * must not restate it: the previous value said "dev" and travelled into
 * production documents unnoticed, duplicated as a literal in three test files.
 */
export const promotionCampaign = "first-order-v1";

export interface Promotion {
  code: string;
  percent: number;
  productIds?: string[];
  excludedProductIds?: string[];
}

export function normalizePromotionCode(value: unknown) {
  if (typeof value !== "string" || value.length > 40) return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9_-]{1,40}$/.test(code) ? code : null;
}

export function promotionTotals(
  subtotalMinor: number,
  promotion: Promotion | null,
  eligibleMinor = subtotalMinor,
) {
  const discountMinor = Math.round(
    (Math.min(subtotalMinor, Math.max(0, eligibleMinor)) *
      (promotion?.percent ?? 0)) /
      100,
  );
  return { discountMinor, totalMinor: subtotalMinor - discountMinor };
}

export function promotionEligibleSubtotal(
  lines: readonly CartLine[],
  products: readonly Product[],
  promotion: Promotion | null,
) {
  return lines.reduce((sum, line) => {
    const match = findVariant(products, line.variantId);
    if (
      !match ||
      (promotion?.excludedProductIds ?? ["trout"]).includes(match.product.id) ||
      (promotion?.productIds &&
        !promotion.productIds.includes(match.product.id))
    )
      return sum;
    return sum + line.quantity * match.variant.priceMinor;
  }, 0);
}
/**
 * When another order's hold on this code runs out, or `null` if nothing holds
 * it against `orderId`.
 *
 * An online order reserves its code until the order's own `expiresAt`, which is
 * the mono invoice's fifteen minutes plus a grace. Past that the invoice can no
 * longer be paid, so the hold has nothing left to protect: a buyer who closed
 * the payment page gets their code back instead of losing it for good.
 *
 * A hold with no deadline keeps blocking. This guards money, so the unknown
 * case fails closed: a writer that ever forgets the deadline must not silently
 * hand the same discount to two orders. Staff free such a code by cancelling
 * the order that holds it, which releases it explicitly.
 */
export function promotionHeldUntil(
  data: Record<string, unknown> | undefined,
  now: number,
  orderId?: string,
): number | null {
  if (!data?.reservedBy || data.reservedBy === orderId) return null;
  const until = data.reservedUntil;
  if (typeof until !== "number") return Number.MAX_SAFE_INTEGER;
  return until > now ? until : null;
}

export function promotionUsable(
  data: Record<string, unknown> | undefined,
  now: number,
  orderId?: string,
) {
  return Boolean(
    data &&
    typeof data.expiresAt === "number" &&
    data.expiresAt > now &&
    Number.isSafeInteger(data.percent) &&
    Number(data.percent) >= 1 &&
    Number(data.percent) <= 99 &&
    !data.consumedBy &&
    promotionHeldUntil(data, now, orderId) === null,
  );
}
