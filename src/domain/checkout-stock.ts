import {
  sellableQuantity,
  unbatchedQuantity,
  type Stock,
} from "./managed-catalog.ts";

export function reserveStock(
  stock: Stock,
  quantity: number,
  today: string,
): Stock {
  const available = sellableQuantity(stock, today);
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    available === undefined ||
    available < quantity
  )
    throw new Error("Stock unavailable.");
  return { ...stock, reserved: stock.reserved + quantity };
}
export function releaseStock(stock: Stock, quantity: number): Stock {
  if (stock.reserved < quantity) throw new Error("Reservation mismatch.");
  return { ...stock, reserved: stock.reserved - quantity };
}
export function consumeStock(
  stock: Stock,
  quantity: number,
  _today: string,
): Stock {
  void _today;
  if (
    stock.quantity === null ||
    stock.quantity < quantity ||
    stock.reserved < quantity
  )
    throw new Error("Stock mismatch.");
  let remaining = quantity;
  const batches = [...stock.batches]
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn))
    .map((batch) => {
      const take = Math.min(batch.quantity, remaining);
      remaining -= take;
      return { ...batch, quantity: batch.quantity - take };
    })
    .filter((batch) => batch.quantity > 0);
  if (remaining > unbatchedQuantity(stock))
    throw new Error("Stock batch mismatch.");
  return {
    quantity: stock.quantity - quantity,
    reserved: stock.reserved - quantity,
    batches,
  };
}
