import { test } from "node:test";
import assert from "node:assert/strict";
import products from "../../src/content/products.json" with { type: "json" };
import {
  restoreCart,
  changeQuantity,
  cartSummary,
  MAX_QUANTITY,
} from "../../src/domain/cart.ts";
import { isVariantAvailable, sortCatalog } from "../../src/domain/catalog.ts";

test("restores only known quantities; ignores stored prices and personal fields", () => {
  assert.deepEqual(
    restoreCart(
      [
        {
          variantId: "hybrid-50",
          quantity: 2,
          price: 1,
          email: "private@example.com",
        },
        { variantId: "unknown", quantity: 3 },
        { variantId: "premium-50", quantity: -1 },
        { variantId: "trout-100", quantity: 1.5 },
      ],
      products,
    ),
    [{ variantId: "hybrid-50", quantity: 2 }],
  );
});
test("merges duplicates and caps quantity without trusting storage", () => {
  assert.deepEqual(
    restoreCart(
      [
        { variantId: "hybrid-50", quantity: 90 },
        { variantId: "hybrid-50", quantity: 90 },
      ],
      products,
    ),
    [{ variantId: "hybrid-50", quantity: MAX_QUANTITY }],
  );
  assert.deepEqual(restoreCart({ items: [] }, products), []);
});
test("adding, changing and removing preserves the previous cart", () => {
  const cart = Object.freeze([{ variantId: "hybrid-50", quantity: 1 }]);
  const changed = changeQuantity(cart, "hybrid-50", 3, products);
  assert.equal(cart[0]!.quantity, 1);
  assert.equal(cartSummary(changed, products).subtotalMinor, 660000);
  assert.deepEqual(changeQuantity(changed, "hybrid-50", 0, products), []);
  for (const invalid of [-1, NaN, Infinity, 1.1, 100])
    assert.deepEqual(
      changeQuantity(cart, "hybrid-50", invalid, products),
      cart,
    );
});
test("unavailable products cannot be added, stale unavailable lines block checkout", () => {
  assert.deepEqual(changeQuantity([], "sterlet-50", 1, products), []);
  const stale = restoreCart(
    [{ variantId: "sterlet-50", quantity: 1 }],
    products,
  );
  assert.equal(cartSummary(stale, products).canCheckout, false);
  assert.deepEqual(cartSummary(stale, products).unavailable, ["sterlet-50"]);
  assert.equal(cartSummary([], products).canCheckout, false);
});
test("keeps the featured order even when sold out and appends new products without mutation", () => {
  const before = products.map((p) => p.id);
  assert.deepEqual(
    sortCatalog([
      { ...products[0]!, id: "new-first" },
      ...products.map((product) =>
        product.id === "hybrid" ? { ...product, variants: [] } : product,
      ),
      { ...products[0]!, id: "new-second" },
    ]).map((p) => p.id),
    ["premium", "sterlet", "hybrid", "trout", "new-first", "new-second"],
  );
  assert.deepEqual(
    products.map((p) => p.id),
    before,
  );
});

test("known stock limits additions and blocks checkout after stock drops", () => {
  const limited = products.map((product) => ({
    ...product,
    variants: product.variants.map((variant) =>
      variant.id === "hybrid-50" ? { ...variant, stockQuantity: 2 } : variant,
    ),
  }));
  const saved = [{ variantId: "hybrid-50", quantity: 3 }];
  assert.deepEqual(changeQuantity([], "hybrid-50", 3, limited), []);
  assert.equal(cartSummary(saved, limited).canCheckout, false);
  assert.equal(
    cartSummary(changeQuantity(saved, "hybrid-50", 2, limited), limited)
      .canCheckout,
    true,
  );
});

test("one sold-out size does not take the product out of stock", () => {
  const hybrid = products.find(({ id }) => id === "hybrid")!;
  const partial = {
    ...hybrid,
    variants: hybrid.variants.map((variant) =>
      variant.id === "hybrid-50" ? { ...variant, stockQuantity: 0 } : variant,
    ),
  };
  assert.equal(partial.variants.find(isVariantAvailable)?.id, "hybrid-100");
  assert.deepEqual(changeQuantity([], "hybrid-50", 1, [partial]), []);
  assert.deepEqual(changeQuantity([], "hybrid-100", 1, [partial]), [
    { variantId: "hybrid-100", quantity: 1 },
  ]);
});

test("applies the inclusive cart limit in minor units and lets legacy carts shrink", () => {
  const hybrid = products.find(({ id }) => id === "hybrid")!;
  const [pack] = hybrid.variants;
  const catalogue = [
    {
      ...hybrid,
      variants: [{ ...pack!, priceMinor: 5_000_000, stockQuantity: 10 }],
    },
  ];
  const id = pack!.id;
  const atLimit = [{ variantId: id, quantity: 2 }];
  assert.deepEqual(changeQuantity([], id, 2, catalogue), atLimit);
  assert.deepEqual(changeQuantity(atLimit, id, 3, catalogue), atLimit);
  assert.equal(cartSummary(atLimit, catalogue).canCheckout, true);
  catalogue[0]!.variants[0]!.priceMinor += 1;
  assert.equal(cartSummary(atLimit, catalogue).overLimit, true);
  assert.equal(cartSummary(atLimit, catalogue).canCheckout, false);
  assert.deepEqual(changeQuantity(atLimit, id, 1, catalogue), [
    { variantId: id, quantity: 1 },
  ]);
});
