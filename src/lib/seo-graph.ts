import { getTranslator } from "@/i18n";
import type { Locale } from "@/i18n/routing";
import { localizedPath } from "@/i18n/routing";
import { contacts } from "@/content/contacts";
import type { Product } from "@/domain/catalog";
import type { GiftView } from "@/domain/managed-catalog";
import {
  breadcrumbSchema,
  faqSchema,
  giftListSchema,
  organizationSchema,
  productSchema,
  websiteSchema,
  type Schema,
} from "@/domain/structured-data";
import { site } from "./metadata";

/** Questions and answers as the FAQ section renders them: text{n+1} answers paragraph{n}. */
const faqCount = 8;

export function identityGraph(locale: Locale, path = ""): Schema[] {
  const t = getTranslator(locale);
  const origin = site.url.origin;
  return [
    organizationSchema({
      origin,
      name: "Ukrainian Caviar Berry",
      description: t("layout.description1"),
      logo: "/assets/img/social/preview-ua.jpg",
      email: contacts.email,
      phones: contacts.phones.map((phone) => phone.tel),
      social: Object.values(contacts.social),
    }),
    websiteSchema({
      origin,
      locale,
      path: localizedPath(locale, path),
      name: "Ukrainian Caviar Berry",
      description: t("layout.description1"),
    }),
  ];
}

export function homeGraph(
  locale: Locale,
  gifts: readonly GiftView[],
): Schema[] {
  const t = getTranslator(locale);
  const origin = site.url.origin;
  const pairs = Array.from({ length: faqCount }, (_, index) => {
    const question = t(`faq.text${index + 2}` as "faq.text2");
    const answer = t(`faq.paragraph${index + 1}` as "faq.paragraph1");
    return [question, answer] as const;
  }).filter(([question, answer]) => Boolean(question && answer));
  return [
    ...identityGraph(locale),
    ...(pairs.length ? [faqSchema(pairs)] : []),
    ...(gifts.length
      ? [
          giftListSchema({
            origin,
            path: `${localizedPath(locale, "")}#gifts`,
            name: t("header.text3"),
            gifts: gifts.map((gift) => ({
              key: gift.key,
              name: gift.name,
              ...(gift.image && { image: gift.image }),
            })),
          }),
        ]
      : []),
  ];
}

export function productGraph(locale: Locale, product: Product): Schema[] {
  const t = getTranslator(locale);
  const origin = site.url.origin;
  const path = localizedPath(locale, `/products/${product.slug}`);
  return [
    ...identityGraph(locale, `/products/${product.slug}`),
    productSchema({ origin, locale, product, path }),
    breadcrumbSchema(origin, [
      { name: t("layout.default1"), path: localizedPath(locale, "") },
      {
        name: t("catalog.heading1"),
        path: `${localizedPath(locale, "")}#ikra`,
      },
      { name: product.name, path },
    ]),
  ];
}
