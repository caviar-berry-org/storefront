import "server-only";

import { randomUUID } from "node:crypto";
import type { Variant } from "@/domain/catalog";
import type { CaviarData } from "@/domain/managed-catalog";
import { CatalogFieldError, image, integer, price, text } from "./form-fields";

export function caviarPacks(
  form: FormData,
  count: number,
  previous?: CaviarData,
) {
  const stock: CaviarData["stock"] = {};
  const weights = new Set<number>();
  const variants = Array.from({ length: count }, (_, index): Variant => {
    const key = `pack.${index}`;
    const packId = text(form, `${key}.id`, 100, false);
    const oldPack = previous?.copy.ua.variants.find(
      (pack) => pack.id === packId,
    );
    if (packId && (!oldPack || stock[packId]))
      throw new CatalogFieldError(`${key}.weight`);
    const weightGrams = integer(form, `${key}.weight`, 1, 100000);
    if (weights.has(weightGrams)) throw new CatalogFieldError(`${key}.weight`);
    weights.add(weightGrams);
    const newId = oldPack?.id ?? randomUUID();
    const available = oldPack?.available ?? true;
    const priorStock = previous?.stock[newId];
    if (
      oldPack &&
      oldPack.weightGrams !== weightGrams &&
      (priorStock?.reserved || priorStock?.batches.length)
    )
      throw new CatalogFieldError(`${key}.weight`);
    stock[newId] = priorStock ?? { quantity: 0, reserved: 0, batches: [] };
    return {
      id: newId,
      weightGrams,
      priceMinor: price(form, `${key}.price`),
      image: image(form, `${key}.image`),
      imageIsRepresentative: form.get(`${key}.representative`) === "on",
      available,
    };
  });
  if (
    previous?.copy.ua.variants.some(
      (pack) =>
        !stock[pack.id] &&
        (previous.stock[pack.id]?.reserved ||
          previous.stock[pack.id]?.batches.length),
    )
  )
    throw new CatalogFieldError("packCount");

  return { variants, stock };
}
