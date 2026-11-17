import { chooseBranch, mockDelivery } from "./delivery-fixture";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await mockDelivery(page);
  await page.route("**/api/promotions/validate", (route) =>
    route.fulfill({
      json: { code: "UCB10", percent: 10, excludedProductIds: ["trout"] },
    }),
  );
  await page.addInitScript(() => {
    sessionStorage.setItem("ucb-loaded", "1");
    sessionStorage.setItem("ucb-pop", "1");
    if (!localStorage.getItem("ucb-cart-v1"))
      localStorage.setItem(
        "ucb-cart-v1",
        JSON.stringify([{ variantId: "hybrid-50", quantity: 1 }]),
      );
  });
});

test("applies and removes a verified promotion across cart, checkout and reload", async ({
  page,
}) => {
  await page.goto("/ua");
  const cartButton = page
    .locator("#hdr")
    .getByRole("button", { name: /Кошик/ });
  const cart = page.locator("#cart");
  await cartButton.click();
  const code = cart.getByRole("textbox", { name: "Промокод" });
  const apply = cart.getByRole("button", { name: "Застосувати промокод" });
  const status = cart.locator("#promo-status");
  await apply.click();
  await expect(status).toHaveText("Введіть промокод.");
  await code.fill(" ucb10 ");
  await apply.click();
  await expect(status).toContainText("UCB10 застосовано: −10%");
  await expect(cart.locator(".grand")).toContainText(/1\s980/);

  await expect(code).toHaveAttribute("readonly", "");
  await expect(apply).toBeDisabled();

  await cart.locator(".cart-foot > button.btn--block").click();
  const checkout = page.locator("#checkout");
  await expect(checkout.locator(".grand")).toContainText(/1\s980/);
  await checkout.getByRole("button", { name: /До кошика/ }).click();
  await expect(code).toHaveValue("UCB10");
  await cart.getByRole("button", { name: "Збільшити кількість" }).click();
  await expect(cart.locator(".grand")).toContainText(/3\s960/);
  await page.reload();
  await cartButton.click();
  await expect(status).toContainText("UCB10 застосовано");
  await expect(cart.locator(".grand")).toContainText(/3\s960/);
  await page.keyboard.press("Escape");
  await expect(cart).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 0) <= 1180)
    await page.locator("#hdr").getByRole("button", { name: "Меню" }).click();
  await page
    .getByRole("group", { name: "Мова" })
    .getByRole("link", { name: "EN" })
    .click();
  await page.locator("#hdr").getByRole("button", { name: /Cart/ }).click();
  await expect(status).toContainText("UCB10 applied");
  await expect(cart.locator(".grand")).toContainText("3,960");
  await cart.getByRole("button", { name: "Clear promotion code" }).click();
  await expect(cart.locator(".grand")).toContainText("4,400");
  await expect(cart.getByRole("textbox", { name: "Promo code" })).toBeFocused();
});

test("English checkout validates delivery, preserves the draft, and handles API failures and redirects", async ({
  page,
}) => {
  await page.goto("/en");
  const cart = page.locator("#cart");
  const checkout = page.locator("#checkout");
  await page.locator("#hdr").getByRole("button", { name: /Cart/ }).click();
  await cart.getByRole("button", { name: "Place order" }).click();
  const submit = checkout.locator("button[type=submit]");
  await submit.click({ force: true });
  await expect(checkout.getByRole("alert")).toHaveText(
    "Complete the required fields and agree to the processing of your data.",
  );
  await expect(checkout.getByLabel("Full name")).toBeFocused();
  await checkout.getByLabel("Full name").fill("Test Shopper");
  await checkout.getByLabel("Phone number").fill("098 111 22 33");
  await checkout
    .getByLabel("Email", { exact: true })
    .fill("shopper@example.com");
  await chooseBranch(checkout);
  await expect(
    checkout.getByRole("radio", { name: "Parcel locker" }),
  ).toHaveCount(0);
  await checkout.getByRole("radio", { name: "Branch", exact: true }).check();

  await checkout.getByRole("radio", { name: "Courier" }).check();
  await checkout.locator("#checkout-street").fill("Test");
  await checkout.getByRole("option", { name: "Test Street" }).click();
  await checkout.locator("#checkout-house").fill("1");
  await checkout.getByRole("radio", { name: "Branch", exact: true }).check();
  await expect(checkout.locator("#checkout-address")).toHaveValue("Branch 1");
  await expect(
    checkout.getByRole("link", { name: "Privacy Policy" }),
  ).toHaveAttribute("href", "/en/privacy");
  await checkout.getByRole("checkbox").check();
  await expect(
    checkout.getByRole("radio", { name: "Pay online by card" }),
  ).toBeChecked();
  await checkout.getByRole("radio", { name: "Bank transfer" }).check();
  await checkout.getByRole("radio", { name: "Company invoice" }).check();
  await checkout.getByRole("button", { name: /Back to cart/ }).click();
  await cart.getByRole("button", { name: "Place order" }).click();
  await expect(checkout.getByLabel("Email", { exact: true })).toHaveValue(
    "shopper@example.com",
  );
  await expect(
    checkout.getByRole("radio", { name: "Branch", exact: true }),
  ).toBeChecked();
  await expect(
    checkout.getByRole("radio", { name: "Company invoice" }),
  ).toBeChecked();
  await expect(checkout.locator(".totals")).toContainText(
    "At Nova Poshta rates.",
  );

  const keys: string[] = [];
  let redirected = false;
  await page.route("**/en/unexpected-payment", async (route) => {
    redirected = true;
    await route.abort();
  });
  await page.route("**/api/checkout", async (route) => {
    const request = route.request();
    keys.push(request.headers()["idempotency-key"] ?? "");
    expect(request.headers()["x-storefront-locale"]).toBe("en");
    expect(request.postDataJSON().contact.delivery).toBe("branch");
    expect(request.postDataJSON().contact.payment).toBe("invoice");
    if (keys.length === 1) {
      await route.fulfill({
        status: 422,
        json: {
          code: "INVALID_CONTACT",
          errors: { email: "Check your email address." },
        },
      });
    } else if (keys.length === 2) {
      await route.fulfill({
        status: 307,
        headers: { location: "/en/unexpected-payment" },
      });
    } else if (keys.length === 3) {
      await route.fulfill({
        status: 500,
        contentType: "text/html",
        body: "<p>Internal error</p>",
      });
    } else {
      await route.fulfill({
        status: 503,
        json: { code: "CHECKOUT_UNAVAILABLE" },
      });
    }
  });
  await submit.click();
  await expect(checkout.getByLabel("Email", { exact: true })).toBeFocused();
  await expect(checkout.getByText("Check your email address.")).toBeVisible();
  await checkout.getByLabel("Email", { exact: true }).fill("retry@example.com");
  await submit.click();
  await expect(checkout.getByRole("alert")).toContainText(
    "We didn’t receive a response",
  );
  expect(redirected).toBe(false);
  await submit.click();
  await expect(checkout.getByRole("alert")).toContainText(
    "We could not complete checkout",
  );
  await submit.click();
  await expect(checkout.getByRole("alert")).toContainText(
    "Checkout is temporarily unavailable",
  );
  expect(keys).toHaveLength(4);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).not.toBe(keys[0]);
  expect(keys[2]).toBe(keys[1]);
  expect(keys[3]).toBe(keys[1]);
  await expect(checkout.getByLabel("Email", { exact: true })).toHaveValue(
    "retry@example.com",
  );
  expect(
    await page.evaluate(() => JSON.stringify([localStorage, sessionStorage])),
  ).not.toContain("@example.com");
  await expect(page).toHaveURL(/\/en$/);
});

test("a refused unpaid order points the buyer to card payment and keeps the draft", async ({
  page,
}) => {
  await page.goto("/en");
  const cart = page.locator("#cart");
  const checkout = page.locator("#checkout");
  await page.locator("#hdr").getByRole("button", { name: /Cart/ }).click();
  await cart.getByRole("button", { name: "Place order" }).click();
  await checkout.getByLabel("Full name").fill("Test Shopper");
  await checkout.getByLabel("Phone number").fill("098 111 22 33");
  await checkout
    .getByLabel("Email", { exact: true })
    .fill("shopper@example.com");
  await chooseBranch(checkout);
  await checkout.getByRole("checkbox").check();
  await checkout.getByRole("radio", { name: "Bank transfer" }).check();
  // The server's shape for both unpaid-order limits: a field error on payment.
  const refusal =
    "Bank transfer and company invoice are not available for this order right now.";
  const payments: string[] = [];
  await page.route("**/api/checkout", async (route) => {
    payments.push(route.request().postDataJSON().contact.payment);
    await route.fulfill({
      status: 422,
      json: {
        code: "INVALID_CONTACT",
        errors: { payment: `${refusal} Choose online card payment.` },
      },
    });
  });
  await checkout.locator("button[type=submit]").click();
  const card = checkout.getByRole("radio", { name: "Pay online by card" });
  await expect(card).toBeFocused();
  await expect(checkout.locator("#hint-payment")).toContainText(refusal);
  await expect(card).toHaveAttribute("aria-describedby", "hint-payment");
  await card.check();
  // FormFeedback keeps the last text while it collapses, so "cleared" means the
  // wrapper is closed and the radio no longer points at it, not an empty node.
  await expect(
    checkout
      .locator(".form-feedback")
      .filter({ has: page.locator("#hint-payment") }),
  ).toHaveAttribute("data-visible", "false");
  await expect(card).not.toHaveAttribute("aria-describedby", /.+/);
  await expect(checkout.getByLabel("Email", { exact: true })).toHaveValue(
    "shopper@example.com",
  );
  expect(payments).toEqual(["transfer"]);
});

test("undo preserves the line and timeout removes it without touching the other items", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "ucb-cart-v1",
      JSON.stringify([
        { variantId: "hybrid-50", quantity: 1 },
        { variantId: "premium-50", quantity: 1 },
      ]),
    );
  });
  await page.goto("/ua");
  await page.locator("#hdr").getByRole("button", { name: /Кошик/ }).click();
  const cart = page.locator("#cart");
  const rows = cart.locator(".ci");
  const remove = rows
    .first()
    .getByRole("button", { name: /Видалити з кошика/ });
  await remove.click();
  const undo = rows.first().getByRole("button", { name: "Повернути" });
  await expect(undo).toBeFocused();
  await expect(
    cart.getByRole("button", { name: "Оформити замовлення" }),
  ).toBeDisabled();
  await undo.click();
  await expect(rows).toHaveCount(2);
  await expect(remove).toBeFocused();
  await remove.click();
  await expect(rows).toHaveCount(1, { timeout: 7000 });
  await expect(rows.first()).toContainText("Premium");
  await expect(
    cart.getByRole("button", { name: "Оформити замовлення" }),
  ).toBeEnabled();
});
