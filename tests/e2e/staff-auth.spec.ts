import { expect, test } from "@playwright/test";

test("staff access fails closed without a valid server session", async ({
  request,
}) => {
  for (const path of [
    "/admin",
    "/admin/orders",
    "/admin/orders/demo-order-01-01",
    "/admin/customers",
    "/admin/customers/demo-customer-01",
    "/admin/products/inventory",
    "/admin/products/archive",
    "/admin/settings/team",
    "/admin/unknown",
  ]) {
    const admin = await request.get(path, {
      maxRedirects: 0,
      headers: {
        Cookie: "caviar_dev_session=forged; __Host-caviar_session=forged",
      },
    });
    expect(admin.status(), path).toBe(307);
    expect(admin.headers().location).toBe("/sign-in");
    expect(admin.headers()["cache-control"]).toContain("no-store");
    expect(admin.headers()["x-robots-tag"]).toContain("noindex");
  }

  // Export route handlers answer directly, so they refuse instead of redirecting.
  for (const path of [
    "/admin/orders/export",
    "/admin/customers/export",
    "/admin/promotions/export",
  ]) {
    const download = await request.get(path, {
      maxRedirects: 0,
      headers: {
        Cookie: "caviar_dev_session=forged; __Host-caviar_session=forged",
      },
    });
    expect(download.status(), path).toBe(401);
    expect(download.headers()["content-type"]).not.toContain("spreadsheet");
  }

  const signIn = await request.get("/sign-in");
  expect(signIn.status()).toBe(200);
  expect(signIn.headers()["cache-control"]).toContain("no-store");
  const page = await signIn.text();
  expect(page).toContain("<title>Вхід</title>");
  expect(page).toContain("noindex");

  const session = await request.post("/api/auth/session", {
    headers: { Origin: "https://cross-origin.invalid" },
    data: { idToken: "not-a-token" },
  });
  expect([403, 503]).toContain(session.status());
  expect(session.headers()["set-cookie"]).toBeUndefined();
});
