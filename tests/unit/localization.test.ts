import assert from "node:assert/strict";
import test from "node:test";
import ua from "../../src/i18n/uk.json" with { type: "json" };
import en from "../../src/i18n/en.json" with { type: "json" };
import products from "../../src/content/products.json" with { type: "json" };
import englishProducts from "../../src/content/products.en.json" with { type: "json" };
import copy from "../../src/content/copy.json" with { type: "json" };
import englishCopy from "../../src/content/storefront.en.json" with { type: "json" };
import posts from "../../src/content/posts.json" with { type: "json" };
import uaMail from "../../src/content/mail/ua.json" with { type: "json" };
import enMail from "../../src/content/mail/en.json" with { type: "json" };
import { getTranslator, type MessageKey } from "../../src/i18n/index.ts";
import { preferredLocale } from "../../src/i18n/routing.ts";
import { validateCheckout } from "../../src/domain/checkout.ts";

test("both storefront dictionaries cover the same non-empty messages and placeholders", () => {
  assert.deepEqual(Object.keys(ua).sort(), Object.keys(en).sort());
  const placeholders = (value: string) =>
    [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
  for (const key of Object.keys(ua) as MessageKey[]) {
    assert.ok(ua[key].trim(), key);
    assert.ok(en[key].trim(), key);
    assert.deepEqual(placeholders(ua[key]), placeholders(en[key]), key);
  }
});

test("English editorial copy covers shared product IDs, images and gift identifiers", () => {
  assert.deepEqual(
    Object.keys(englishProducts).sort(),
    products.map(({ id }) => id).sort(),
  );
  for (const product of products) {
    assert.equal(
      englishProducts[product.id as keyof typeof englishProducts].galleryAlt
        .length,
      product.gallery.length,
    );
  }
  assert.deepEqual(
    englishCopy.sets.map(({ key }) => key),
    copy.sets.map(({ key }) => key),
  );
  for (const [index, set] of copy.sets.entries()) {
    assert.equal(
      englishCopy.sets[index]!.items.length,
      set.items.length,
      set.key,
    );
  }
  assert.deepEqual(
    englishCopy.steps.map(({ n }) => n),
    copy.steps.map(({ n }) => n),
  );
  assert.equal(englishCopy.posts.length, posts.length);
});

test("both mail dictionaries cover the same non-empty messages and placeholders", () => {
  assert.deepEqual(Object.keys(uaMail).sort(), Object.keys(enMail).sort());
  const placeholders = (value: string) =>
    [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
  // Client-approved copy where the two languages deliberately differ: the English
  // button names the discount ("Shop caviar with 10% off"), the Ukrainian one does
  // not ("Обрати ікру зі знижкою"). Both still read correctly at any percentage.
  const divergentPlaceholders = new Set(["mail.promotionCta"]);
  for (const key of Object.keys(uaMail) as (keyof typeof uaMail)[]) {
    const ua = uaMail[key];
    const en = enMail[key];
    if (typeof ua !== "string") {
      // Owner-facing groups stay Ukrainian in both files; only their shape must match.
      assert.deepEqual(Object.keys(ua).sort(), Object.keys(en).sort(), key);
      continue;
    }
    assert.ok(ua.trim(), key);
    assert.ok((en as string).trim(), key);
    if (divergentPlaceholders.has(key)) continue;
    assert.deepEqual(placeholders(ua), placeholders(en as string), key);
  }
});

test("language negotiation respects browser weights and safely defaults to Ukrainian", () => {
  assert.equal(preferredLocale("uk-UA;q=0.8,en-GB;q=0.9"), "en");
  assert.equal(preferredLocale("en;q=0,uk"), "ua");
  assert.equal(preferredLocale("de-DE,fr"), "ua");
  assert.equal(preferredLocale(null), "ua");
  assert.equal(preferredLocale("uk,en;q=0.9"), "ua");
});

test("checkout validation messages follow the active storefront language", () => {
  assert.equal(
    validateCheckout({}, getTranslator("en")).name,
    "Please enter your full name.",
  );
});
