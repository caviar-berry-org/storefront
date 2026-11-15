import { chooseBranch, mockDelivery } from "./delivery-fixture";
import { expect, test, type Locator } from "@playwright/test";

async function expectPanelFits(panel: Locator) {
  await expect(panel).toBeVisible();
  expect(
    await panel.evaluate(
      (element) => element.scrollWidth - element.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
}

test.beforeEach(async ({ page }) => {
  await mockDelivery(page);
  await page.addInitScript(() => {
    sessionStorage.setItem("ucb-loaded", "1");
    sessionStorage.setItem("ucb-pop", "1");
    if (localStorage.getItem("ucb-cart-v1") === null)
      localStorage.setItem(
        "ucb-cart-v1",
        JSON.stringify([{ variantId: "hybrid-50", quantity: 1 }]),
      );
  });
});

test("touch menu and product dialogs keep focus away from their controls on entry", async ({
  page,
}) => {
  test.skip(
    !(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)),
    "Touch scrolling and focus.",
  );
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/ua#about");
  const portrait = page.locator("#about .bs-media img");
  await portrait.evaluate((image) =>
    image.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  await expect(portrait).toHaveAttribute("data-photo-ready", "");
  const frame = page.locator("#about .bs-media").first();
  await expect(frame).toHaveCSS(
    "clip-path",
    /^(none|inset\(0(?:px|%)(?: 0(?:px|%))*\))$/,
  );
  expect((await frame.boundingBox())!.height).toBeGreaterThan(400);

  const before = await page.evaluate(() => window.scrollY);
  await page.locator("#hdr").getByRole("button", { name: "Меню" }).click();
  const menu = page.locator(".mobile-menu");
  await expect(menu.locator(":scope > [autofocus]")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(menu.getByRole("button", { name: "Закрити" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  expect(
    Math.abs((await page.evaluate(() => window.scrollY)) - before),
  ).toBeLessThan(2);

  await page.locator(".cc-foot a[href$='/premium']").click();
  const product = page.locator("#pmodal");
  await expect(product.locator(":scope > [autofocus]")).toBeFocused();
  await product.getByRole("button", { name: /Кошик/ }).click();
  await page.locator("#cart .cart-foot > button.btn--block").click();
  const checkout = page.locator("#checkout");
  await expect(checkout.locator(":scope > [autofocus]")).toBeFocused();
  await checkout.locator(".checkout-back").click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#cart")).toHaveCount(0);
  await expect(product).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/\block\b/);
  await page.keyboard.press("Escape");
  await expect(product).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveClass(/\block\b/);
});

test("wide layout and active dialogs survive phone and tablet orientation changes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 3840, height: 1200 });
  await page.goto("/en");
  for (const selector of ["#hdr > nav", ".hb-bottom", "#history .b-wrap"]) {
    const bounds = await page.locator(selector).first().boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeLessThanOrEqual(1920);
    expect(Math.abs(bounds!.x + bounds!.width / 2 - 1920)).toBeLessThan(12);
  }

  await page.setViewportSize({ width: 320, height: 640 });
  await page.getByRole("button", { name: "Contact us", exact: true }).click();
  await expect(page.locator(".floating-contact-menu")).toBeVisible();
  await page
    .locator("#hdr")
    .getByRole("button", { name: "Menu", exact: true })
    .click();
  await expect(page.locator(".floating-contact-menu")).toBeHidden();
  await page.setViewportSize({ width: 844, height: 390 });
  const menu = page.locator("dialog.mobile-menu");
  await expectPanelFits(menu.locator(".panel"));
  await menu.getByRole("button", { name: /cart/i }).click();
  const cart = page.locator("#cart");
  await expectPanelFits(cart.locator(".panel"));
  await cart.getByRole("button", { name: "Place order" }).click();
  const checkout = page.locator("#checkout");
  await checkout.getByLabel("Full name").fill("Test Shopper");
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 320, height: 640 },
  ]) {
    await page.setViewportSize(viewport);
    await expectPanelFits(checkout.locator(".panel"));
    const actions = await checkout.locator(".checkout-actions").boundingBox();
    const content = await checkout.locator(".panel").boundingBox();
    expect(actions!.y + actions!.height).toBeLessThanOrEqual(content!.y + 1);
    await expect(checkout.getByLabel("Full name")).toHaveValue("Test Shopper");
    await expect(
      checkout.getByRole("button", { name: "Place order" }),
    ).toBeEnabled();
  }
  await checkout.getByRole("button", { name: "Close", exact: true }).click();
  await expect(checkout).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveClass(/\block\b/);
});

test("requests can retry after offline and server failure without newer abort helpers", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    for (const method of ["any", "timeout"])
      Object.defineProperty(AbortSignal, method, {
        configurable: true,
        value: undefined,
      });
  });
  await page.goto("/en");
  await page.locator("#hdr").getByRole("button", { name: /cart/i }).click();
  await page
    .locator("#cart")
    .getByRole("button", { name: "Place order" })
    .click();
  const checkout = page.locator("#checkout");
  await checkout.getByLabel("Full name").fill("Test Shopper");
  await checkout.getByLabel("Phone").fill("+380981112233");
  await checkout
    .getByLabel("Email", { exact: true })
    .fill("shopper@example.com");
  await chooseBranch(checkout);
  await checkout.getByRole("checkbox").check();
  const submit = checkout.locator("button[type=submit]");
  await context.setOffline(true);
  await submit.click();
  await expect(checkout.getByRole("alert")).toContainText(
    "We didn’t receive a response.",
  );
  await expect(submit).toBeEnabled();
  await context.setOffline(false);
  await submit.click();
  await expect(checkout.getByRole("alert")).toContainText(
    "Checkout is temporarily unavailable.",
  );
  await expect(checkout.getByLabel("Email", { exact: true })).toHaveValue(
    "shopper@example.com",
  );
});

for (const mode of ["data saving", "in-app browser"] as const) {
  test(`${mode} keeps decorative videos on posters`, async ({ page }) => {
    const videos: string[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith(".mp4")) videos.push(request.url());
    });
    await page.addInitScript((scenario) => {
      if (scenario === "data saving") {
        Object.defineProperty(navigator, "connection", {
          value: Object.assign(new EventTarget(), { saveData: true }),
        });
      } else {
        Object.defineProperty(navigator, "userAgent", {
          value:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram",
        });
      }
    }, mode);
    await page.goto("/en");
    await expect(page.locator("html")).toHaveClass(/\bjs\b/);
    if (mode === "data saving")
      await expect(page.locator(".hb-media")).toHaveCSS("position", "absolute");
    await page.locator("#history video").scrollIntoViewIfNeeded();
    await expect(page.locator("#history video")).toHaveAttribute(
      "poster",
      /farm-aerial-poster/,
    );
    await expect(page.locator("#history video")).toHaveAttribute(
      "playsinline",
      "",
    );
    expect(
      await page
        .locator("video")
        .evaluateAll((elements) =>
          elements.every((video) => !video.hasAttribute("src")),
        ),
    ).toBe(true);
    expect(videos).toEqual([]);
  });
}

test("lightbox remains usable when the next image fails and closes before product details", async ({
  page,
}) => {
  await page.route(/\/_next\/image\?.*bel-3\.jpg/, (route) => route.abort());
  await page.goto("/en#ikra");
  await page.locator('#ikra .cc-foot a[href="/en/products/hybrid"]').click();
  const product = page.locator("#pmodal");
  await expect(
    product.getByRole("link", { name: /Back to the catalogue/i }),
  ).toHaveCount(0);
  await product.locator(".pp-photo").first().click();
  const lightbox = page.locator("dialog.photo-lightbox");
  await expect(lightbox).toBeVisible();
  const firstPhoto = lightbox.locator(".photo-stack img");
  await expect
    .poll(() =>
      firstPhoto.evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await lightbox.getByRole("button", { name: "Next photo" }).click();
  await expect(
    lightbox
      .getByRole("status")
      .filter({ hasText: "This photo is temporarily unavailable." }),
  ).toBeVisible();
  await expect
    .poll(() =>
      firstPhoto.first().evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.keyboard.press("Escape");
  await expect(lightbox).toHaveCount(0);
  await expect(product).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(product).toHaveCount(0);
  await page.goto("/en/products/hybrid");
  await expect(
    page.getByRole("link", { name: /Back to the catalogue/i }),
  ).toBeVisible();
});
