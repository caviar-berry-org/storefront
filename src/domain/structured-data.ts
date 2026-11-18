import type { Product } from "./catalog.ts";
import { isVariantAvailable } from "./catalog.ts";

/**
 * Builders for the schema.org graph. Pure on purpose: every fact comes in as an
 * argument, so the markup can be asserted in a test without a database, a
 * request or React.
 *
 * Scope note: this markup exists for search engines' rich results. It is *not*
 * how AI assistants read the catalogue — they were measured missing data that
 * lived only here — so nothing may be stated here that the page does not also
 * say in visible text.
 */
export type Schema = Record<string, unknown>;

const absolute = (origin: string, path: string) => new URL(path, origin).href;

export function organizationSchema(input: {
  origin: string;
  name: string;
  description: string;
  logo: string;
  email: string;
  phones: readonly string[];
  social: readonly string[];
}): Schema {
  return {
    "@type": "Organization",
    "@id": `${input.origin}/#organization`,
    name: input.name,
    description: input.description,
    url: `${input.origin}/`,
    logo: absolute(input.origin, input.logo),
    email: input.email,
    ...(input.phones.length && { telephone: [...input.phones] }),
    ...(input.social.length && { sameAs: [...input.social] }),
    contactPoint: input.phones.map((telephone) => ({
      "@type": "ContactPoint",
      contactType: "sales",
      telephone,
      email: input.email,
      areaServed: "UA",
      availableLanguage: ["uk", "en"],
    })),
    address: { "@type": "PostalAddress", addressCountry: "UA" },
  };
}

export function websiteSchema(input: {
  origin: string;
  locale: "ua" | "en";
  path: string;
  name: string;
  description: string;
}): Schema {
  return {
    "@type": "WebSite",
    "@id": `${input.origin}/#website`,
    name: input.name,
    description: input.description,
    url: absolute(input.origin, input.path),
    inLanguage: input.locale === "ua" ? "uk-UA" : "en-GB",
    publisher: { "@id": `${input.origin}/#organization` },
  };
}

/**
 * Food of proper quality is not returnable under the published offer (§9.1), so
 * that is what the markup says. Shipping is deliberately absent: the carrier is
 * paid by the recipient, and a rate we do not charge must not be declared.
 */
function returnPolicy(): Schema {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "UA",
    returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
  };
}

export function productSchema(input: {
  origin: string;
  locale: "ua" | "en";
  product: Product;
  path: string;
}): Schema {
  const { origin, product } = input;
  const url = absolute(origin, input.path);
  const images = [
    ...new Set(
      [
        product.seo?.image,
        product.servingImage,
        product.lidImage,
        ...product.variants.map((variant) => variant.image),
      ].filter((value): value is string => Boolean(value)),
    ),
  ].map((image) => absolute(origin, image));
  const offers = product.variants.map((variant) => ({
    "@type": "Offer",
    sku: variant.id,
    url,
    price: (variant.priceMinor / 100).toFixed(2),
    priceCurrency: "UAH",
    availability: isVariantAvailable(variant)
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock",
    itemCondition: "https://schema.org/NewCondition",
    weight: {
      "@type": "QuantitativeValue",
      value: variant.weightGrams,
      unitCode: "GRM",
    },
    seller: { "@id": `${origin}/#organization` },
    hasMerchantReturnPolicy: returnPolicy(),
  }));
  const prices = product.variants.map((variant) => variant.priceMinor);
  return {
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.name,
    description: product.seo?.description?.trim() || product.description,
    sku: product.id,
    url,
    ...(images.length && { image: images }),
    brand: { "@type": "Brand", name: "Ukrainian Caviar Berry" },
    category: "Food > Fish & Seafood > Caviar",
    ...(product.latin && {
      additionalProperty: [
        {
          "@type": "PropertyValue",
          name: input.locale === "ua" ? "Вид" : "Species",
          value: product.latin,
        },
      ],
    }),
    offers:
      offers.length > 1
        ? {
            "@type": "AggregateOffer",
            priceCurrency: "UAH",
            offerCount: offers.length,
            lowPrice: (Math.min(...prices) / 100).toFixed(2),
            highPrice: (Math.max(...prices) / 100).toFixed(2),
            offers,
          }
        : offers[0],
  };
}

export function faqSchema(
  pairs: readonly (readonly [string, string])[],
): Schema {
  return {
    "@type": "FAQPage",
    mainEntity: pairs.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

export function breadcrumbSchema(
  origin: string,
  trail: readonly { name: string; path: string }[],
): Schema {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absolute(origin, item.path),
    })),
  };
}

/**
 * Gift sets are requested through a manager rather than bought, so they carry no
 * `Offer`: declaring one would promise a checkout that does not exist.
 */
export function giftListSchema(input: {
  origin: string;
  path: string;
  name: string;
  gifts: readonly { key: string; name: string; image?: string }[];
}): Schema {
  return {
    "@type": "ItemList",
    name: input.name,
    url: absolute(input.origin, input.path),
    numberOfItems: input.gifts.length,
    // Listed, not sold: a manager assembles each set after a request, so there
    // is no price and no stock to offer. Calling them `Product` made Google
    // demand `offers` and mark all nine entries invalid — and it was right to,
    // because a product snippet promises something you can buy.
    itemListElement: input.gifts.map((gift, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: gift.name,
      ...(gift.image && { image: absolute(input.origin, gift.image) }),
    })),
  };
}

export function articleSchema(input: {
  origin: string;
  locale: "ua" | "en";
  path: string;
  headline: string;
  description: string;
  image?: string;
}): Schema {
  const url = absolute(input.origin, input.path);
  return {
    "@type": "Article",
    "@id": `${url}#article`,
    headline: input.headline,
    description: input.description,
    url,
    inLanguage: input.locale === "ua" ? "uk-UA" : "en-GB",
    ...(input.image && { image: absolute(input.origin, input.image) }),
    publisher: { "@id": `${input.origin}/#organization` },
    isPartOf: { "@id": `${input.origin}/#website` },
  };
}

/** One script per page: a single graph is cheaper to parse and easier to audit. */
export function schemaGraph(items: readonly Schema[]) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": items,
  });
}
