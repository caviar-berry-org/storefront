import assert from "node:assert/strict";
import test from "node:test";
import { createSign, generateKeyPairSync } from "node:crypto";
import { resolve } from "node:path";
import { serverModule } from "../helpers/server-module.ts";
import { eligibleBranch } from "../../src/domain/delivery.ts";
import { invoiceBasket } from "../../src/domain/payment.ts";
import { validateCheckout } from "../../src/domain/checkout.ts";

const branch = {
  CategoryOfWarehouse: "Branch",
  WarehouseStatus: "Working",
  DenyToSelect: "0",
  TypeOfWarehouse: "841339c7-591a-42e2-8233-7a0a00f0ed6f",
};
test("delivery accepts working branches and rejects lockers and disabled branches", () => {
  assert.ok(eligibleBranch(branch));
  for (const row of [
    { ...branch, CategoryOfWarehouse: "Postomat" },
    { ...branch, TypeOfWarehouse: "f9316480-5f2d-425d-bc2c-ac7cd29decf0" },
    { ...branch, WarehouseStatus: "Closed" },
    { ...branch, DenyToSelect: "1" },
  ])
    assert.equal(eligibleBranch(row), false);
});
test("courier field errors stay on their fields and optional address/comment fields stay optional", () => {
  const input = {
    name: "Test Customer",
    phone: "+1 (202) 555-0123",
    email: "test@example.com",
    city: "Київ",
    address: "Хрещатик",
    delivery: "courier",
    consent: true,
    comment: "",
  };
  const errors = validateCheckout(input);
  assert.ok(errors.street);
  assert.ok(errors.house);
  assert.equal(errors.phone, undefined);
  assert.deepEqual(
    validateCheckout({ ...input, street: "Хрещатик", house: "10А" }),
    {},
  );
  assert.ok(
    validateCheckout({
      ...input,
      street: "Хрещатик",
      house: "10",
      apartment: "x".repeat(21),
    }).apartment,
  );
});
test("invoice basket retains exact minor totals when a discount cannot be divided evenly by quantity", () => {
  const rows = invoiceBasket([
    {
      productId: "premium",
      variantId: "premium-50",
      name: "Premium",
      weightGrams: 50,
      quantity: 3,
      unitPriceMinor: 100,
      discountMinor: 1,
    },
  ]);
  assert.equal(
    rows.reduce((sum, row) => sum + row.total, 0),
    299,
  );
  assert.equal(
    rows.reduce((sum, row) => sum + row.qty, 0),
    3,
  );
  assert.ok(rows.every((row) => row.total === row.sum * row.qty));
});
test("webhook checks raw signature before persistence and exposes no provider/customer data on failure", async () => {
  const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const key = Buffer.from(
    keys.publicKey.export({ type: "spki", format: "pem" }),
  ).toString("base64");
  let persisted = 0;
  let unavailable = false;
  let rejected = false;
  // Node runs test files in strip-only mode, so no parameter properties here.
  class PaymentRejected extends Error {
    reason: string;
    constructor(reason: string) {
      super(reason);
      this.reason = reason;
    }
  }
  const { POST } = serverModule<
    typeof import("../../src/app/api/payments/mono/webhook/route.ts")
  >("src/app/api/payments/mono/webhook/route.ts", {
    "next/server": { after: () => {} },
    [resolve("src/lib/server/payments/mono.ts")]: {
      monoPublicKey: async () => key,
    },
    [resolve("src/lib/server/checkout/payment.ts")]: {
      PaymentRejected,
      applyPayment: async () => {
        if (rejected) throw new PaymentRejected("amount");
        if (unavailable) throw Error("database down");
        persisted++;
        return { id: "a".repeat(40) };
      },
    },
    [resolve("src/lib/server/orders/notifications.ts")]: {
      deliverOrderNotifications: async () => {},
    },
  });
  const body = JSON.stringify({
    invoiceId: "test",
    reference: "a".repeat(40),
    amount: 100,
    ccy: 980,
    status: "success",
    modifiedDate: "2026-11-11T20:00:00Z",
  });
  const signer = createSign("SHA256");
  signer.update(body);
  signer.end();
  const signature = signer.sign(keys.privateKey, "base64");
  const request = (value: string, sign: string) =>
    new Request("https://example.com/api/payments/mono/webhook", {
      method: "POST",
      headers: { "x-sign": sign, "content-type": "application/json" },
      body: value,
    });
  assert.equal((await POST(request(body, "bad"))).status, 401);
  assert.equal(persisted, 0);
  assert.equal((await POST(request(body + " ", signature))).status, 401);
  assert.equal(persisted, 0);
  assert.equal((await POST(request(body, signature))).status, 200);
  assert.equal(persisted, 1);
  // A transient failure must keep the provider retrying.
  unavailable = true;
  const response = await POST(request(body, signature));
  assert.equal(response.status, 503);
  assert.equal(await response.text(), "");
  // A payment that can never match this order is acknowledged instead, because
  // redelivering the same body would fail identically forever.
  unavailable = false;
  rejected = true;
  const refused = await POST(request(body, signature));
  assert.equal(refused.status, 200);
  assert.equal(await refused.text(), "");
  assert.equal(persisted, 1);
  rejected = false;
  assert.equal((await POST(request("x".repeat(33000), signature))).status, 413);
});
test("Nova Poshta HTTP/API failure fails closed and exact validation rejects an injected locker", async (t) => {
  const before = globalThis.fetch;
  const token = process.env.NOVA_POSHTA_API_KEY;
  process.env.NOVA_POSHTA_API_KEY = "test-only";
  t.after(() => {
    globalThis.fetch = before;
    if (token === undefined) delete process.env.NOVA_POSHTA_API_KEY;
    else process.env.NOVA_POSHTA_API_KEY = token;
  });
  const cache = { unstable_cache: (fn: unknown) => fn };
  const { resolveDelivery } = serverModule<
    typeof import("../../src/lib/server/delivery/nova-poshta.ts")
  >("src/lib/server/delivery/nova-poshta.ts", { "next/cache": cache });
  const city = "8d5a980d-391c-11dd-90d9-001a92567626";
  const warehouse = "1ec09d88-e1c2-11e3-8c4a-0050568002cf";
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    return Response.json({
      success: true,
      data:
        body.calledMethod === "getCities"
          ? [{ Ref: city, Description: "Київ" }]
          : [
              {
                ...branch,
                Ref: warehouse,
                CityRef: city,
                Description: "Поштомат",
                CategoryOfWarehouse: "Postomat",
              },
            ],
    });
  };
  assert.equal(
    await resolveDelivery({
      cityRef: city,
      branchRef: warehouse,
      delivery: "branch",
      address: "anything",
    }),
    null,
  );
  globalThis.fetch = async () =>
    Response.json({ success: false, errors: ["invalid key"] });
  await assert.rejects(
    resolveDelivery({
      cityRef: city,
      branchRef: warehouse,
      delivery: "branch",
      address: "1",
    }),
  );
  globalThis.fetch = async () => {
    throw Error("network down");
  };
  await assert.rejects(
    resolveDelivery({
      cityRef: city,
      branchRef: warehouse,
      delivery: "branch",
      address: "1",
    }),
  );
});
