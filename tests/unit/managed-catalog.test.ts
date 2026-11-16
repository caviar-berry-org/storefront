import assert from "node:assert/strict";
import test from "node:test";
import {
  cartSummary,
  changeQuantity,
  restoreCart,
} from "../../src/domain/cart.ts";
import { formatCaviarLatin } from "../../src/domain/catalog.ts";
import {
  giftView,
  parseMinor,
  productView,
  sellableQuantity,
} from "../../src/domain/managed-catalog.ts";
import { initialCaviar, initialGifts } from "../../src/lib/catalog-fixtures.ts";

test("dev catalogue preserves existing product order, shared pack IDs and gift links", () => {
  const products = initialCaviar();
  assert.deepEqual(
    products.map(({ id }) => id),
    ["premium", "sterlet", "hybrid", "trout"],
  );
  const packs = new Set(
    products.flatMap(({ data }) => {
      assert.deepEqual(data.copy.ua.variants, data.copy.en.variants);
      return data.copy.ua.variants.map(({ id }) => id);
    }),
  );
  assert.equal(packs.size, 11);
  assert.equal(products[0]!.data.nutrition.carbs, 0);
  const gifts = initialGifts();
  assert.ok(
    gifts.every(({ data }) =>
      data.items.every(({ variantIds }) =>
        variantIds.every((id) => packs.has(id)),
      ),
    ),
  );
  assert.equal(
    giftView(gifts[0]!.id, gifts[0]!.data, "ua").price,
    "до 3 000 грн",
  );
  assert.equal(
    giftView(gifts[2]!.id, gifts[2]!.data, "en").price,
    "from 6,000 UAH",
  );
});

test("amounts use exact minor units and stock subtracts reservations while batch dates remain informational", () => {
  assert.equal(parseMinor("900,01"), 90001);
  for (const invalid of ["0", "-1", "1.001", "10x", "1e2"])
    assert.equal(parseMinor(invalid), null);
  const stock = {
    quantity: 14,
    reserved: 3,
    batches: [
      { code: "A", expiresOn: "2026-11-08", quantity: 4 },
      { code: "B", expiresOn: "2026-11-09", quantity: 2 },
    ],
  };
  assert.equal(sellableQuantity(stock, "2026-11-09"), 11);
  const data = initialCaviar()[0]!.data;
  data.stock["premium-50"] = stock;
  data.stock["premium-100"]!.quantity = null;
  delete data.copy.en.variants[1]!.stockQuantity;
  const product = productView(data, "en", "2026-11-09");
  assert.equal(product.variants[0]?.stockQuantity, 11);
  assert.equal(product.variants[1]?.stockQuantity, undefined);
});

test("a hidden catalogue item is retained for removal and blocks checkout", () => {
  const raw = [{ variantId: "premium-50", quantity: 2 }];
  const lines = restoreCart(raw, [], true);
  assert.deepEqual(lines, raw);
  assert.deepEqual(cartSummary(lines, []), {
    subtotalMinor: 0,
    overLimit: false,
    count: 2,
    unavailable: ["premium-50"],
    canCheckout: false,
  });
  assert.deepEqual(changeQuantity(lines, "premium-50", 0, []), []);
});

test("Cloudinary uploads both kinds to their catalogue folders", async (context) => {
  const { catalogAssetId, uploadCatalogImage } =
    await import("../../src/lib/catalog-image-upload.ts");
  const env = {
    APP_ENV: "development",
    CLOUDINARY_CLOUD_NAME: "test-cloud",
    CLOUDINARY_API_KEY: "test-key",
    CLOUDINARY_API_SECRET: "test-secret",
  };
  const requests: { url: string; body: FormData }[] = [];
  context.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      const body = options.body as FormData;
      requests.push({ url, body });
      return Response.json({
        public_id: body.get("public_id"),
        asset_folder: body.get("asset_folder"),
        version: 123,
        format: "jpg",
        width: 1200,
        height: 800,
      });
    },
  );
  const image = await uploadCatalogImage(
    new Blob(["image"], { type: "image/jpeg" }),
    "gift-sets",
    env,
    "a1",
  );
  const publicId = catalogAssetId(image, env);
  assert.equal(publicId, "catalog/a1");
  await uploadCatalogImage(
    new Blob(["image"], { type: "image/jpeg" }),
    "caviar",
    env,
    "a2",
  );
  assert.deepEqual(
    requests.map(({ body }) => body.get("asset_folder")),
    ["caviar-berry-dev/gift-sets", "caviar-berry-dev/storefront"],
  );
  assert.equal(requests[1]?.body.get("public_id"), "catalog/a2");
  assert.ok(requests[1]?.body.get("file") instanceof Blob);
  assert.match(requests[1]!.url, /\/image\/upload$/);
  assert.match(String(requests[1]?.body.get("signature")), /^[a-f0-9]{64}$/);
});

test("premium notes follow the premium flag and zero stock prevents purchase in both locales", () => {
  const data = initialCaviar()[0]!.data;
  data.premium = false;
  data.copy.ua.latinNote = "Note";
  data.copy.en.latinNote = "Note";
  for (const locale of ["ua", "en"] as const) {
    for (const pack of data.copy[locale].variants)
      data.stock[pack.id] = { quantity: 0, reserved: 0, batches: [] };
    const view = productView(data, locale, "2026-11-12", true);
    assert.equal(view.latinNote, undefined);
    assert(view.variants.every((pack) => pack.stockQuantity === 0));
    data.premium = true;
    assert.equal(productView(data, locale, "2026-11-12").latinNote, "Note");
    data.premium = false;
  }
});

test("latin species name reaches the storefront exactly as staff entered it", () => {
  for (const value of [
    "Oncorhynchus mykiss",
    "A.RUTHENUS",
    "HUSO HUSOxA.RUTHENUS",
    "A.BAERII/A.GUELDENSTAEDTII/HUSO HUSOxA.RUTHENUS",
  ]) {
    assert.equal(formatCaviarLatin(value), value);
    assert.equal(formatCaviarLatin(`  ${value}  `), value);
  }
  // An empty field renders nothing; no product may fall back to a hardcoded species.
  assert.equal(formatCaviarLatin(""), "");
});
