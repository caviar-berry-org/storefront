import { getTranslator } from "@/i18n";
import type { Locale } from "@/i18n/routing";

export const formatMoney = (minor: number, locale: Locale) =>
  `${new Intl.NumberFormat(locale === "en" ? "en-US" : "uk-UA", { minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(minor / 100)} ${getTranslator(locale)("common.currency")}`;
