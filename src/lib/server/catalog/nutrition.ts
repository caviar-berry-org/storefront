import "server-only";

import type { Nutrition } from "@/domain/managed-catalog";
import type { Locale } from "@/i18n/routing";
import { CatalogFieldError, text } from "./form-fields";

const nutritionKeys = [
  "calories",
  "protein",
  "fat",
  "carbs",
  "saturatedFat",
  "kj",
] as const;
export function nutritionInput(form: FormData) {
  const entries = nutritionKeys.flatMap((key, index) => {
    const field = `nutrition.${key}`;
    const raw = text(form, field, 12, index < 4);
    if (!raw) return [];
    if (!/^\d{1,5}([.,]\d{1,3})?$/.test(raw))
      throw new CatalogFieldError(field);
    const value = Number(raw.replace(",", "."));
    if (
      ["protein", "fat", "carbs", "saturatedFat"].includes(key) &&
      value > 100
    )
      throw new CatalogFieldError(field);
    return [[key, value]];
  });
  return Object.fromEntries(entries) as unknown as Nutrition;
}

export function nutritionText(n: Nutrition, locale: Locale) {
  const fmt = new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-US", {
    maximumFractionDigits: 3,
  });
  const value = (input: number) => fmt.format(input);
  const energy = locale === "ua" ? "ккал" : "kcal";
  const unit = locale === "ua" ? "г" : "g";
  const labels =
    locale === "ua"
      ? ["білки", "жири", "НЖК", "вуглеводи"]
      : ["protein", "fat", "saturated fat", "carbohydrates"];
  const saturated =
    n.saturatedFat === undefined
      ? ""
      : ` (${labels[2]} — ${value(n.saturatedFat)} ${unit})`;
  const kj =
    n.kj === undefined
      ? ""
      : ` / ${value(n.kj)} ${locale === "ua" ? "кДж" : "kJ"}`;
  return `${value(n.calories)} ${energy}${kj}; ${labels[0]} — ${value(n.protein)} ${unit}; ${labels[1]} — ${value(n.fat)} ${unit}${saturated}; ${labels[3]} — ${value(n.carbs)} ${unit}.`;
}
