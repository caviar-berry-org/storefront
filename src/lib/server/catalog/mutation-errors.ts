import "server-only";

import { CatalogFieldError } from "./form-fields";

export type CatalogMutationResult =
  | { id: string }
  | {
      error:
        | "denied"
        | "conflict"
        | "linked"
        | "linkedHistory"
        | "linkedGift"
        | "linkedReserved"
        | "linkedStock"
        | "unavailable"
        | "invalid";
      field?: string;
    };

export class CatalogConflict extends Error {}

/**
 * A record that something else still depends on. The reason is carried because
 * the four causes need four different answers from staff: history can never be
 * deleted, a gift set has to release the pack first, a reservation has to end,
 * and stock simply has to be written off — or the record hidden instead.
 */
export class CatalogLinked extends Error {
  constructor(readonly reason?: "history" | "gift" | "reserved" | "stock") {
    super(`Catalog record linked: ${reason ?? "unknown"}`);
  }
}

const linkedErrors = {
  history: "linkedHistory",
  gift: "linkedGift",
  reserved: "linkedReserved",
  stock: "linkedStock",
} as const;

export function knownCatalogError(
  error: unknown,
): CatalogMutationResult | null {
  if (error instanceof CatalogFieldError)
    return { error: "invalid", field: error.field };
  if (error instanceof CatalogConflict) return { error: "conflict" };
  if (error instanceof CatalogLinked)
    return { error: error.reason ? linkedErrors[error.reason] : "linked" };
  return null;
}
