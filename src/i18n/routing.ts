export const locales = ["ua", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ua";

export function isLocale(value: string | undefined): value is Locale {
  return locales.some((locale) => locale === value);
}

export function localeFromPath(path: string): Locale {
  const segment = path.split("/")[1];
  return isLocale(segment) ? segment : defaultLocale;
}

export function localizedPath(locale: Locale, path = "") {
  return `/${locale}${path === "/" ? "" : path}`;
}

export function documentLanguage(locale: Locale) {
  return locale === "ua" ? "uk" : "en";
}

export function preferredLocale(header: string | null): Locale {
  const preferences = (header ?? "")
    .split(",")
    .map((item) => {
      const [tag = "", weight] = item
        .trim()
        .toLowerCase()
        .split(/\s*;\s*/, 2);
      const quality = weight?.startsWith("q=") ? Number(weight.slice(2)) : 1;
      return { language: tag.split("-")[0], quality };
    })
    .filter(({ quality }) => quality > 0 && quality <= 1)
    .sort((a, b) => b.quality - a.quality);
  for (const { language } of preferences) {
    if (language === "en") return "en";
    if (language === "uk" || language === "ua" || language === "*") return "ua";
  }
  return defaultLocale;
}
