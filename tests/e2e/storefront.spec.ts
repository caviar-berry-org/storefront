import { chooseBranch, mockDelivery } from "./delivery-fixture";
import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await mockDelivery(page);
  await page.addInitScript(() => sessionStorage.setItem("ucb-pop", "1"));
});

test("mobile history stays visible after toggling and long form and legal copy fit", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile disclosure and sizing");
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/ua");
  const history = page.locator(".hist2-txt");
  await history.scrollIntoViewIfNeeded();
  await expect(history).toHaveCSS("opacity", "1");
  const more = page.locator(".hist-more");
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await expect(history).toHaveCSS("mask-image", "none");
  await expect(history).toHaveCSS("opacity", "1");
  expect(
    await history.evaluate((el) => el.scrollHeight - el.clientHeight),
  ).toBeLessThanOrEqual(1);
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await expect(history).toHaveCSS("opacity", "1");

  await page.locator("#corp button").click();
  const dialog = page.getByRole("dialog");
  const panel = dialog.locator(".panel");
  await expect(panel).toBeVisible();
  expect(await panel.evaluate((el) => el.scrollWidth)).toBe(393);
  await expect(dialog.locator('button[type="submit"]')).toHaveCSS(
    "white-space",
    "normal",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  await page.goto("/ua/privacy");
  const heading = page.getByRole("heading", { level: 1 });
  expect(await heading.evaluate((el) => el.scrollWidth)).toBeLessThanOrEqual(
    393 - 48,
  );
});

test("header, background, typography and catalogue remain usable at each viewport", async ({
  page,
}) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydrat|server.rendered html/i.test(message.text())
    )
      hydrationErrors.push(message.text());
  });
  await page.goto("/ua");
  await expect(page.locator("html")).toHaveClass(/\bjs\b/);
  await page.goto("/ua#ikra");
  await page.reload();
  await expect(page.locator("#hdr")).toBeVisible();
  const cards = page.locator(".col-card");
  await expect(cards).toHaveCount(4);
  await expect(
    cards.getByRole("heading", { name: "Осетрова ікра Premium", exact: true }),
  ).toHaveCount(1);
  await expect(
    cards.filter({ hasText: "Осетрова ікра Premium" }).locator(".tc-lat"),
  ).toHaveText("A. baerii · A. gueldenstaedtii · Huso huso × A. ruthenus*");
  await expect(cards.last()).toContainText("Немає в наявності");
  await page.locator("#ikra").scrollIntoViewIfNeeded();
  await expect(page.locator("#hdr")).toHaveClass(/show-logo/);
  await expect(cards.first().locator("h3")).toHaveCSS(
    "text-transform",
    "uppercase",
  );
  const media = cards.first().locator(".cc-media");
  await media.scrollIntoViewIfNeeded();
  await expect(media).toHaveClass(/\bb-in\b/);
  expect(hydrationErrors).toEqual([]);
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(242, 242, 242)",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("gift request matches form flow, validates and retains data on a service failure", async ({
  page,
}) => {
  await page.goto("/ua");
  await page
    .locator("#gifts")
    .getByRole("button", { name: "Обрати набір" })
    .last()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading")).toContainText("Преміум");
  await expect(
    dialog.getByRole("button", { name: "Обрати набір" }),
  ).toBeDisabled();
  await dialog.locator("input[name=name]").fill("Тестова Покупчиня");
  await dialog.locator("input[name=contact]").fill("+380981112233");
  await dialog.getByRole("checkbox").check();
  let requests = 0;
  await page.route("**/api/inquiries", async (route) => {
    requests++;
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({ status: 503, json: {} });
  });
  await dialog.getByRole("button", { name: "Обрати набір" }).dblclick();
  await expect(dialog.getByRole("alert")).toContainText(
    "Не вдалося надіслати заявку",
  );
  expect(requests).toBe(1);
  await expect(dialog.locator("input[name=name]")).toHaveValue(
    "Тестова Покупчиня",
  );
  const stored = await page.evaluate(() => JSON.stringify(localStorage));
  expect(stored).not.toContain("Покупчиня");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("cart persists quantities, supports removal and reports checkout errors without data loss", async ({
  page,
}) => {
  await page.goto("/ua/products/hybrid");
  await page
    .getByRole("button", { name: "Додати до кошика", exact: true })
    .dblclick();
  await expect(
    page.getByRole("button", { name: "Успішно додано до кошика" }),
  ).toBeVisible();
  await page.locator("#hdr").getByRole("button", { name: /Кошик/ }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.locator(".ci")).toHaveCount(1);
  const quantity = dialog.locator(".qty input");
  await expect(quantity).toHaveValue("1");
  await quantity.fill("0");
  await quantity.press("Enter");
  const undo = dialog.getByRole("button", { name: "Повернути" });
  await expect(undo).toBeFocused();
  await undo.click();
  await expect(quantity).toHaveValue("1");
  await quantity.fill("abc");
  await quantity.press("Enter");
  await expect(quantity).toHaveValue("1");
  await expect(quantity).toHaveAttribute("aria-invalid", "true");
  await dialog.locator(".cart-foot > button").click();
  dialog = page.getByRole("dialog");
  await dialog.locator("#checkout-name").fill("Тестова Покупчиня");
  await dialog.locator("#checkout-phone").fill("+380981112233");
  await dialog.locator("#checkout-email").fill("test@example.com");
  await dialog.getByRole("button", { name: /До кошика/ }).click();
  await page.getByRole("dialog").locator(".cart-foot > button").click();
  await expect(page.locator("#checkout-email")).toHaveValue("test@example.com");
  await chooseBranch(dialog);
  await dialog.getByRole("checkbox").check();
  await dialog.locator("button[type=submit]").click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.locator("#checkout-email")).toHaveValue(
    "test@example.com",
  );
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "test@example.com",
  );
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: /Кошик/ }).first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Зменшити кількість" })
    .click();
  await expect(page.getByRole("button", { name: "Повернути" })).toBeFocused();
  await expect(page.getByRole("dialog").locator(".ci")).toHaveCount(0, {
    timeout: 7000,
  });
});

test("manual cart quantities fit the latest stock limit", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "ucb-cart-v1",
      JSON.stringify([{ variantId: "trout-100", quantity: 11 }]),
    );
  });
  await page.route("**/api/cart/variant", (route) =>
    route.fulfill({ json: { limit: 15, priceMinor: 70000 } }),
  );
  await page.goto("/ua/products/trout");
  await page.locator("#hdr").getByRole("button", { name: /Кошик/ }).click();
  const cart = page.locator("#cart");
  const quantity = cart.locator(".ci .qty input");
  await expect(quantity).toHaveValue("11");
  await quantity.fill("30");
  await quantity.press("Enter");
  await expect(quantity).toHaveValue("15");
  await expect(quantity).toHaveAttribute("aria-invalid", "false");
  await expect(
    cart.getByText("Для цього фасування доступно до замовлення 15 шт."),
  ).toHaveCount(1);
});

test("404 return can be cancelled and keyboard focus stays inside a modal", async ({
  page,
}) => {
  await page.goto("/ua/missing-page");
  await page.locator(".return-countdown button").click();
  await expect(page.locator(".return-countdown")).toContainText("зупинено");
  await page.goto("/ua");
  await page.getByRole("button", { name: /Кошик/ }).first().click();
  for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
  expect(
    await page.evaluate(
      () => document.activeElement?.closest("dialog") !== null,
    ),
  ).toBe(true);
});

test("article image stays pinned while its text scrolls inside the modal", async ({
  page,
}) => {
  test.skip(
    (page.viewportSize()?.width ?? 0) <= 640,
    "Mobile uses the original vertical article layout.",
  );
  await page.goto("/ua");
  await page.locator("#blog .blogb-item").first().click();
  const panel = page.locator("#article > .panel");
  const media = panel.locator("[data-article-media]");
  const copy = panel.locator("[data-article-copy]");
  await expect(media).toBeVisible();
  // Wait for the opening transition, then compare geometry before and after scrolling.
  await panel.evaluate(async (el) => {
    await Promise.all(
      el.getAnimations().map((animation) => animation.finished),
    );
  });
  const imageBefore = (await media.boundingBox())!;
  const copyBefore = (await copy.boundingBox())!;
  expect(
    Math.abs(
      imageBefore.height - (await panel.evaluate((el) => el.clientHeight)),
    ),
  ).toBeLessThan(2);
  await panel.evaluate((el) => {
    el.scrollTop = 250;
  });
  await expect
    .poll(() => panel.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(50);
  const imageAfter = (await media.boundingBox())!;
  const copyAfter = (await copy.boundingBox())!;
  expect(Math.abs(imageAfter.y - imageBefore.y)).toBeLessThan(2);
  expect(copyAfter.y).toBeLessThan(copyBefore.y - 50);
  await expect(
    panel.getByRole("button", { name: "Закрити", exact: true }),
  ).toBeInViewport();
});

test("all storefront section headings finish their scroll reveal", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", { value: 8 });
    sessionStorage.setItem("ucb-loaded", "1");
  });
  for (const locale of ["ua", "en"]) {
    await page.goto(`/${locale}#ikra`);
    await expect(page.locator("html")).toHaveClass(/\bjs\b/);
    await expect(page.locator("html")).not.toHaveClass(/\brm\b/);
    const headings = page.locator("h2[data-split]");
    for (const heading of await headings.all()) {
      await heading.evaluate((element) =>
        element.scrollIntoView({ block: "center", behavior: "instant" }),
      );
      await expect(heading).toHaveClass(/\bb-in\b/);
    }
    await expect
      .poll(() =>
        headings
          .locator(".w")
          .evaluateAll((words) =>
            words.every((word) => getComputedStyle(word).transform === "none"),
          ),
      )
      .toBe(true);
  }
});

test("hero actions retain the reference underline and keyboard focus", async ({
  page,
}) => {
  await page.goto("/ua");
  await expect(page.locator("#session-splash")).toBeHidden();
  const links = page.locator(".hb .b-link");
  await expect(links).toHaveCount(2);
  for (const link of await links.all()) {
    await expect(link).toHaveCSS("border-bottom-width", "1px");
    await expect(link).toHaveCSS("border-bottom-style", "solid");
    await link.focus();
    await expect(link).toBeFocused();
  }
  await links.first().click();
  await expect(page).toHaveURL(/ua#ikra$/);
});

test("cart remains usable when storage reads work but writes fail", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "ucb-cart-v1",
      JSON.stringify([{ variantId: "hybrid-50", quantity: 1 }]),
    );
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "ucb-cart-v1")
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  await page.goto("/ua/products/hybrid");
  await page
    .getByRole("button", { name: "Додати до кошика", exact: true })
    .click();
  await page.getByRole("button", { name: /Кошик/ }).first().click();
  const quantity = page.getByRole("dialog").locator(".qty input");
  await expect(quantity).toHaveValue("2");
  await quantity.fill("0");
  await quantity.press("Enter");
  await expect(page.getByRole("dialog").locator(".ci")).toHaveCount(0);
});

test("variant photos update and Escape closes only the full-screen gallery", async ({
  page,
}) => {
  await page.goto("/ua");
  await page.locator(".cc-foot a[href='/ua/products/premium']").click();
  const product = page.locator("#pmodal");
  await product.locator(".b-packs label").nth(1).click();
  const photo = product.locator(".pp-pack");
  await expect(photo.locator(".photo-stack img")).toHaveCount(1);
  await expect(photo.locator(".photo-stack img")).toHaveAttribute(
    "src",
    /prem-100/,
  );

  const serving = product.locator(".pp-photo").nth(1);
  if ((page.viewportSize()?.width ?? 0) > 640) {
    const thumbnails = product.locator(".pp-th");
    await thumbnails.nth(1).click();
    await expect(serving).toBeVisible();
    const frame = (await serving.boundingBox())!;
    expect(Math.abs(frame.height - (frame.width * 1066) / 1600)).toBeLessThan(
      1,
    );
    await expect(serving.locator("img")).toHaveCSS("object-fit", "cover");
    await expect(thumbnails.nth(1).locator("img")).toHaveCSS(
      "object-fit",
      "contain",
    );
    await thumbnails.first().click();
  } else {
    const packFrame = (await photo.boundingBox())!;
    const servingFrame = (await serving.boundingBox())!;
    expect(Math.abs(packFrame.height - servingFrame.height)).toBeLessThan(1);
  }

  await photo.click();
  const zoom = page.locator("dialog.photo-lightbox");
  await page.addStyleTag({
    content: `.zoom-stage .photo-enter, .zoom-stage .photo-replace {
      animation-play-state: paused !important;
    }`,
  });
  await zoom.locator(".zoom-next").click();
  await expect(zoom.locator(".zoom-count")).toHaveText(/^2 \/ /);
  await expect(zoom.locator(".photo-stack img")).toHaveCount(1);
  await expect(zoom.locator(".photo-stack img")).toHaveAttribute(
    "src",
    /prem-food2/,
  );
  await page.keyboard.press("Escape");
  await expect(zoom).toHaveCount(0);
  await expect(
    product.getByRole("button", { name: "Додати до кошика" }),
  ).toBeVisible();
});

test("mobile cards and expanded copy stay visible without waiting for scroll reveal", async ({
  page,
}) => {
  test.skip((page.viewportSize()?.width ?? 0) > 640, "Mobile disclosure.");
  await page.goto("/ua");
  await expect(page.locator("html")).toHaveClass(/\bjs\b/);

  for (const strip of [".collage", ".sets-b", ".blogb"]) {
    await expect(
      page.locator(strip).locator(":scope > .b-rv").last(),
    ).toHaveCSS("opacity", "1");
  }

  const item = page.locator("#about .ls-item").first();
  const button = item.getByRole("button");
  const copy = item.locator(".about-copy");
  await expect(copy.locator("p")).toBeHidden();
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(copy.locator("p")).toBeVisible();
  await expect(item).toHaveCSS("opacity", "1");
  await expect
    .poll(() => copy.evaluate((element) => element.clientHeight))
    .toBeGreaterThan(30);
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(copy.locator("p")).toBeHidden();
});

test("footer legal links open the store's own Ukrainian pages", async ({
  page,
}) => {
  for (const [name, path] of [
    ["Політика конфіденційності", "/ua/privacy"],
    ["Умови користування", "/ua/terms"],
  ]) {
    await page.goto("/ua");
    await page
      .locator("footer")
      .getByRole("link", { name, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(path + "$"));
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "uk");
    await expect(
      page.getByRole("link", { name: "sale@caviar.net.ua" }),
    ).toHaveAttribute("href", "mailto:sale@caviar.net.ua");
  }
});
