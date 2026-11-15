import type { Metadata } from "next";
import { localizedPath, type Locale } from "@/i18n/routing";
import { siteEnvironment } from "./environment";
export const site = siteEnvironment(process.env);

/** Pre-encoded 1.91:1 link preview per locale; see scripts/build-social-preview.ts. */
const preview = {
  ua: "/assets/img/social/preview-ua.jpg",
  en: "/assets/img/social/preview-en.jpg",
} as const;

/** Open Graph wants a full language tag, not a bare code. */
const openGraphLocale = { ua: "uk_UA", en: "en_GB" } as const;

export function socialPreview(locale: Locale) {
  return {
    url: preview[locale],
    width: 1200,
    height: 630,
    type: "image/jpeg",
  };
}

export function pageMetadata(
  locale: Locale,
  title: string,
  description: string,
  path: string,
  image?: string,
): Metadata {
  const canonical = localizedPath(locale, path);
  // Dimensions are declared only for our own preview: a product photo comes from
  // the catalogue at an unknown size, and a wrong width is worse than none.
  const images = image
    ? [{ url: image, alt: title }]
    : [{ ...socialPreview(locale), alt: title }];
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        uk: localizedPath("ua", path),
        en: localizedPath("en", path),
        "x-default": localizedPath("ua", path),
      },
    },
    openGraph: {
      type: "website",
      locale: openGraphLocale[locale],
      alternateLocale: openGraphLocale[locale === "ua" ? "en" : "ua"],
      siteName: "Ukrainian Caviar Berry",
      title,
      description,
      url: canonical,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.map(({ url }) => url),
    },
  };
}
