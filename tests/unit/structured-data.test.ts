import assert from "node:assert/strict";
import test from "node:test";
import {
  breadcrumbSchema,
  faqSchema,
  giftListSchema,
  productSchema,
  schemaGraph,
} from "../../src/domain/structured-data.ts";
import type { Product } from "../../src/domain/catalog.ts";

const origin = "https://caviar.net.ua";

const product = {
  id: "sterlet",
  slug: "sterlet",
  name: "Ікра стерляді",
  description: "Ніжна ікра стерляді",
  latin: "Acipenser ruthenus",
  servingImage: "/assets/img/serve-premium.jpg",
  lidImage: "/assets/img/prod/lid.webp",
  roeImage: "/assets/img/prod/roe.webp",
  roeTile: 1,
  servingAlt: "",
  gallery: [],
  season: null,
  intro: null,
  taste: "",
  fish: null,
  grain: "",
  ingredients: "",
  storage: "",
  nutrition: "",
  allergen: "",
  pairing: "",
  plate: "",
  englishName: "Sterlet caviar",
  variants: [
    {
      id: "sterlet-50",
      weightGrams: 50,
      priceMinor: 150000,
      available: true,
      stockQuantity: 4,
      image: "/assets/img/prod/50.webp",
      imageIsRepresentative: false,
    },
    {
      id: "sterlet-100",
      weightGrams: 100,
      priceMinor: 280050,
      available: true,
      stockQuantity: 0,
      image: "/assets/img/prod/100.webp",
      imageIsRepresentative: false,
    },
  ],
} as unknown as Product;

test("every pack becomes an offer with its exact price, stock and weight", () => {
  const schema = productSchema({
    origin,
    locale: "ua",
    product,
    path: "/ua/products/sterlet",
  });
  assert.equal(schema["@type"], "Product");
  assert.equal(schema.sku, "sterlet");
  assert.equal(schema.url, `${origin}/ua/products/sterlet`);
  const offers = schema.offers as Record<string, unknown>;
  assert.equal(offers["@type"], "AggregateOffer");
  assert.equal(offers.offerCount, 2);
  // Minor units converted exactly, including a price that is not a round hryvnia.
  assert.equal(offers.lowPrice, "1500.00");
  assert.equal(offers.highPrice, "2800.50");
  const rows = offers.offers as Record<string, unknown>[];
  assert.equal(rows[0]!.price, "1500.00");
  assert.equal(rows[0]!.priceCurrency, "UAH");
  assert.equal(rows[0]!.availability, "https://schema.org/InStock");
  // A pack with zero sellable units must not be advertised as in stock.
  assert.equal(rows[1]!.availability, "https://schema.org/OutOfStock");
  assert.deepEqual(rows[0]!.weight, {
    "@type": "QuantitativeValue",
    value: 50,
    unitCode: "GRM",
  });
  // The published offer forbids returning food of proper quality (§9.1).
  assert.match(
    JSON.stringify(rows[0]!.hasMerchantReturnPolicy),
    /MerchantReturnNotPermitted/,
  );
  // A shipping rate we do not charge is never declared.
  assert.ok(!JSON.stringify(schema).includes("shippingDetails"));
  assert.ok(!JSON.stringify(schema).includes("OfferShippingDetails"));
  // Images are absolute, de-duplicated and rooted at the public origin.
  const images = schema.image as string[];
  assert.equal(new Set(images).size, images.length);
  assert.ok(images.every((url) => url.startsWith(`${origin}/`)));
});

test("a single pack stays a plain offer instead of an aggregate", () => {
  const single = {
    ...product,
    variants: [product.variants[0]!],
  } as unknown as Product;
  const offers = productSchema({
    origin,
    locale: "ua",
    product: single,
    path: "/ua/products/sterlet",
  }).offers as Record<string, unknown>;
  assert.equal(offers["@type"], "Offer");
  assert.equal(offers.price, "1500.00");
});

test("questions, crumbs and gifts describe only what the page really offers", () => {
  const faq = faqSchema([
    ["Яку ікру обрати?", "Для знайомства радимо стерлядь."],
  ]);
  assert.equal(faq["@type"], "FAQPage");
  const questions = faq.mainEntity as Record<string, unknown>[];
  assert.equal(questions[0]!.name, "Яку ікру обрати?");
  assert.equal(
    (questions[0]!.acceptedAnswer as Record<string, unknown>).text,
    "Для знайомства радимо стерлядь.",
  );

  const crumbs = breadcrumbSchema(origin, [
    { name: "Ukrainian Caviar Berry", path: "/ua" },
    { name: "Ікра", path: "/ua#ikra" },
    { name: "Ікра стерляді", path: "/ua/products/sterlet" },
  ]).itemListElement as Record<string, unknown>[];
  assert.deepEqual(
    crumbs.map((item) => item.position),
    [1, 2, 3],
  );
  assert.equal(crumbs[2]!.item, `${origin}/ua/products/sterlet`);

  // Gift sets create a manager request, not a purchase: no price, no offer.
  const gifts = giftListSchema({
    origin,
    path: "/ua#gifts",
    name: "Подарунки",
    gifts: [{ key: "tasting", name: "Дегустаційний набір", image: "/a.webp" }],
  });
  assert.equal(gifts.numberOfItems, 1);
  const serialized = JSON.stringify(gifts);
  assert.ok(!serialized.includes("Offer"));
  assert.ok(!serialized.includes("price"));
});

test("a catalogue description cannot close the script tag it travels in", () => {
  const hostile = {
    ...product,
    description: '</script><img src=x onerror="alert(1)">',
  } as unknown as Product;
  const body = schemaGraph([
    productSchema({
      origin,
      locale: "ua",
      product: hostile,
      path: "/ua/products/sterlet",
    }),
  ]).replace(/</g, "\\u003c");
  assert.ok(!body.includes("</script"));
  assert.ok(!body.includes("<img"));
  // Still valid JSON once the escape is undone, which is how a parser reads it.
  const parsed = JSON.parse(body.replace(/\\u003c/g, "<")) as {
    "@graph": Record<string, unknown>[];
  };
  assert.equal(
    parsed["@graph"][0]!.description,
    '</script><img src=x onerror="alert(1)">',
  );
});
