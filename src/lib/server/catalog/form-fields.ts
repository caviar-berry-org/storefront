import "server-only";

import { parseMinor } from "@/domain/managed-catalog";
import { validCatalogImage } from "./media";

export class CatalogFieldError extends Error {
  constructor(readonly field: string) {
    super(field);
  }
}

export function text(
  form: FormData,
  field: string,
  limit: number,
  required = true,
) {
  const value = form.get(field);
  if (value === null && !required) return "";
  if (
    typeof value !== "string" ||
    value.trim().length > limit ||
    (required && !value.trim())
  )
    throw new CatalogFieldError(field);
  return value.trim();
}

export function image(form: FormData, field: string, required = true) {
  const value = text(form, field, 500, required);
  if ((required || value) && !validCatalogImage(value))
    throw new CatalogFieldError(field);
  return value;
}

export function price(form: FormData, field: string) {
  const value = parseMinor(text(form, field, 10));
  if (value === null) throw new CatalogFieldError(field);
  return value;
}

export function integer(
  form: FormData,
  field: string,
  min: number,
  max: number,
) {
  const value = text(form, field, 8);
  const n = Number(value);
  if (!/^\d+$/.test(value) || n < min || n > max)
    throw new CatalogFieldError(field);
  return n;
}

export function localized(form: FormData, key: string, limit: number) {
  return {
    ua: text(form, `${key}.ua`, limit),
    en: text(form, `${key}.en`, limit),
  };
}
