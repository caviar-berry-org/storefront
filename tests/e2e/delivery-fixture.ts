import type { Locator, Page } from "@playwright/test";
export async function mockDelivery(page: Page) {
  await page.route("**/api/delivery?**", (route) => {
    const kind = new URL(route.request().url()).searchParams.get("kind");
    return route.fulfill({
      json: {
        options: [
          {
            ref:
              kind === "cities"
                ? "8d5a980d-391c-11dd-90d9-001a92567626"
                : kind === "streets"
                  ? "0f0d85b0-4143-11dd-9198-001d60451983"
                  : "1ec09d88-e1c2-11e3-8c4a-0050568002cf",
            label:
              kind === "cities"
                ? "Kyiv"
                : kind === "streets"
                  ? "Test Street"
                  : "Branch 1",
          },
        ],
      },
    });
  });
}
export async function chooseBranch(checkout: Locator) {
  await checkout.locator("#checkout-city").fill("Ky");
  await checkout.getByRole("option", { name: "Kyiv", exact: true }).click();
  await checkout.locator("#checkout-address").fill("1");
  await checkout.getByRole("option", { name: "Branch 1", exact: true }).click();
}
