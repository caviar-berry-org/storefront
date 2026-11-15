import {
  findVariant,
  isVariantAvailable,
  type Product,
  type Variant,
} from "./catalog.ts";

export interface CartLine {
  variantId: string;
  quantity: number;
}
export const MAX_QUANTITY = 99;
export const MAX_CART_SUBTOTAL_MINOR = 10_000_000;
export const CART_KEY = "ucb-cart-v1";

export function quantityLimit(variant: Variant) {
  return isVariantAvailable(variant)
    ? Math.min(MAX_QUANTITY, variant.stockQuantity ?? MAX_QUANTITY)
    : 0;
}

export function restoreCart(
  value: unknown,
  products: readonly Product[],
  preserveUnknown = false,
): CartLine[] {
  if (!Array.isArray(value)) return [];
  const quantities = new Map<string, number>();
  for (const item of value.slice(0, 100)) {
    if (!item || typeof item !== "object" || typeof item.variantId !== "string")
      continue;
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) continue;
    if (
      !/^[\w-]{1,100}$/.test(item.variantId) ||
      (!preserveUnknown && !findVariant(products, item.variantId))
    )
      continue;
    quantities.set(
      item.variantId,
      Math.min(
        MAX_QUANTITY,
        (quantities.get(item.variantId) ?? 0) + item.quantity,
      ),
    );
  }
  return [...quantities].map(([variantId, quantity]) => ({
    variantId,
    quantity,
  }));
}

export function changeQuantity(
  lines: readonly CartLine[],
  variantId: string,
  quantity: number,
  products: readonly Product[],
): CartLine[] {
  if (quantity === 0)
    return lines.filter((line) => line.variantId !== variantId);
  const found = findVariant(products, variantId);
  if (
    !found ||
    !Number.isSafeInteger(quantity) ||
    quantity < 0 ||
    quantity > MAX_QUANTITY
  )
    return [...lines];
  const previous = lines.find((line) => line.variantId === variantId);
  if (
    quantity > quantityLimit(found.variant) &&
    (!previous || quantity >= previous.quantity)
  )
    return [...lines];
  const next = previous
    ? lines.map((line) =>
        line.variantId === variantId ? { variantId, quantity } : line,
      )
    : [...lines, { variantId, quantity }];
  return quantity > (previous?.quantity ?? 0) &&
    cartSummary(next, products).overLimit
    ? [...lines]
    : next;
}

export function cartSummary(
  lines: readonly CartLine[],
  products: readonly Product[],
) {
  let subtotalMinor = 0;
  let count = 0;
  const unavailable: string[] = [];
  for (const line of lines) {
    const match = findVariant(products, line.variantId);
    if (!match || line.quantity > quantityLimit(match.variant))
      unavailable.push(line.variantId);
    count += line.quantity;
    if (!match) continue;
    subtotalMinor += match.variant.priceMinor * line.quantity;
  }
  const overLimit = subtotalMinor > MAX_CART_SUBTOTAL_MINOR;
  return {
    subtotalMinor,
    overLimit,
    count,
    unavailable,
    canCheckout: count > 0 && unavailable.length === 0 && !overLimit,
  };
}
