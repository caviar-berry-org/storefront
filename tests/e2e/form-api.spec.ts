import { expect, test } from "@playwright/test";
const origin = new URL(
  process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100",
).origin;
const headers = {
  Origin: origin,
  "Idempotency-Key": "00000000-0000-4000-8000-000000000001",
};
test("public APIs reject forged fields and fail closed with integrations disabled", async ({
  request,
}) => {
  const contact = {
    name: "Test Customer",
    phone: "+44 20 7946 0958",
    email: "test@example.com",
    city: "Kyiv",
    address: "Branch 1",
    delivery: "branch",
    payment: "online",
    comment: "",
    consent: true,
  };
  const checkout = {
    contact,
    items: [{ variantId: "hybrid-50", quantity: 1 }],
    expectedSubtotalMinor: 220000,
    expectedTotalMinor: 220000,
  };
  const disabled = await request.post("/api/checkout", {
    headers,
    data: checkout,
  });
  expect(disabled.status()).toBe(503);
  expect(await disabled.json()).toMatchObject({ code: "CHECKOUT_UNAVAILABLE" });
  const invalid = await request.post("/api/checkout", {
    headers,
    data: { ...checkout, contact: { ...contact, email: [], consent: "true" } },
  });
  expect(invalid.status()).toBe(422);
  expect(await invalid.json()).toMatchObject({
    errors: { email: expect.any(String), consent: expect.any(String) },
  });
  for (const items of [
    [],
    [...checkout.items, ...checkout.items],
    [{ variantId: "hybrid-50", quantity: 1.5 }],
    [{ variantId: "hybrid-50", quantity: 100 }],
  ]) {
    const response = await request.post("/api/checkout", {
      headers,
      data: { ...checkout, items },
    });
    expect(response.status()).toBe(422);
    expect(await response.json()).toMatchObject({ code: "INVALID_CART" });
  }
  expect(
    (
      await request.post("/api/checkout", {
        headers: { ...headers, Origin: "https://other.example" },
        data: checkout,
      })
    ).status(),
  ).toBe(400);
  for (const code of ["ucb10", "FIRST", " "]) {
    const response = await request.post("/api/promotions/validate", {
      headers,
      data: { code },
    });
    expect(response.status()).toBe(422);
    expect(response.headers()["cache-control"]).toBe("no-store");
  }
  expect(
    (
      await request.post("/api/newsletter", {
        headers,
        data: { email: "broken" },
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await request.post("/api/newsletter", {
        headers,
        data: { email: contact.email },
      })
    ).status(),
  ).toBe(503);
  expect(
    (
      await request.post("/api/newsletter", {
        headers: { "Content-Type": "application/json" },
        data: "{",
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/newsletter", { data: "email=test@example.com" })
    ).status(),
  ).toBe(415);
  expect(
    (
      await request.post("/api/newsletter", {
        data: { email: "x".repeat(32768) },
      })
    ).status(),
  ).toBe(413);
  expect((await request.get("/api/internal/reconcile")).status()).toBe(401);
  expect((await request.get(`/api/orders/${"a".repeat(40)}`)).status()).toBe(
    404,
  );
});
