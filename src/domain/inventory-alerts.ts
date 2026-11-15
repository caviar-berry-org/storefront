import type { Stock } from "./managed-catalog.ts";

export const lowInventoryThreshold = 5;

export function inventoryExpiryWindowEnd(today: string) {
  return new Date(Date.parse(today) + 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export function stockOutsideReserve({ quantity, reserved }: Stock) {
  return quantity === null ? null : Math.max(0, quantity - reserved);
}

export function isLowInventory(stock: Stock, enabled: boolean) {
  const available = stockOutsideReserve(stock);
  return enabled && available !== null && available < lowInventoryThreshold;
}
