import "server-only";

import {
  batchTotal,
  unbatchedQuantity,
  type Stock,
} from "@/domain/managed-catalog";
import { CatalogFieldError, integer, text } from "./form-fields";

export function stockInput(form: FormData, previous: Stock): Stock {
  const count = integer(form, "batchCount", 0, 30);
  const batches = Array.from({ length: count }, (_, index) => {
    const key = `batch.${index}`;
    const code = text(form, `${key}.code`, 80);
    const expiresOn = text(form, `${key}.expiresOn`, 10);
    const expiry = new Date(`${expiresOn}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) ||
      Number.isNaN(expiry.getTime()) ||
      expiry.toISOString().slice(0, 10) !== expiresOn
    )
      throw new CatalogFieldError(`${key}.expiresOn`);
    return {
      code,
      expiresOn,
      quantity: integer(form, `${key}.quantity`, 0, 1000000),
    };
  }).filter((batch) => batch.quantity > 0);
  if (
    new Set(batches.map(({ code }) => code.toLowerCase())).size !==
    batches.length
  )
    throw new CatalogFieldError("batchCount");
  const unbatched =
    form.get("assignUnbatched") === "on" ? 0 : unbatchedQuantity(previous);
  const quantity = batchTotal(batches) + unbatched;
  if (quantity < previous.reserved || quantity > 1000000)
    throw new CatalogFieldError("quantity");
  return { quantity, reserved: previous.reserved, batches };
}
