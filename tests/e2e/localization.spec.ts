import { expect, test } from "@playwright/test";

test("the contact form uses its own translated copy and validation", async ({
  page,
}) => {
  for (const [locale, title, name, message, submit, nameError] of [
    [
      "ua",
      "Написати нам",
      "Ім’я",
      "Повідомлення",
      "Надіслати",
      "Вкажіть ім’я.",
    ],
    ["en", "Write to us", "Name", "Message", "Send", "Please enter your name."],
  ] as const) {
    await page.goto(`/${locale}?static=1#contacts`);
    await page
      .locator("#contacts")
      .getByRole("button", { name: title })
      .click();
    const dialog = page.getByRole("dialog", { name: title });
    await expect(dialog.getByLabel(name, { exact: true })).toBeVisible();
    await expect(
      dialog.getByLabel(message, { exact: true }),
    ).not.toHaveAttribute("placeholder");
    await expect(
      dialog.getByRole("button", { name: submit, exact: true }),
    ).toBeDisabled();
    await dialog.locator('input[name="name"]').fill("a");
    await dialog.locator('input[name="contact"]').fill("bad");
    await dialog.locator('textarea[name="comment"]').fill("?");
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: submit, exact: true }).click();
    await expect(dialog.getByText(nameError, { exact: true })).toBeVisible();
  }
});

test("Premium keeps its Latin footnote and the full delivery copy in both languages", async ({
  page,
}) => {
  for (const copy of [
    {
      locale: "ua",
      name: "Осетрова ікра Premium",
      ingredients: "Склад і зберігання",
      fish: "Види риб у категорії",
      delivery: "Доставка і оплата",
      labels: ["Доставка", "Оплата", "Відправка"],
      branch: "Доставка можлива у відділення або кур’єром «Нової пошти».",
      payments: [
        "банківська картка (Visa, MasterCard)",
        "Apple Pay / Google Pay",
        "безготівковий переказ за реквізитами ФОП (для компаній — рахунок)",
      ],
      dispatch:
        "Відправка — у день підтвердження оплати замовлення або наступного дня.",
    },
    {
      locale: "en",
      name: "Premium sturgeon caviar",
      ingredients: "Ingredients and storage",
      fish: "Fish species in the category",
      delivery: "Delivery & payment",
      labels: ["Delivery", "Payment", "Dispatch"],
      branch: "Delivery to a branch or by Nova Poshta courier.",
      payments: [
        "bank card (Visa, Mastercard)",
        "Apple Pay / Google Pay",
        "bank transfer to the sole proprietor’s account (invoice for companies)",
      ],
      dispatch: "Dispatch — on the day payment is confirmed or the next day.",
    },
  ]) {
    await page.goto(`/${copy.locale}/products/premium`);
    const product = page.locator(".pp");
    await expect(
      product.getByRole("heading", { name: copy.name, exact: true }),
    ).toBeVisible();
    await expect(product.locator(".pp-sticky > p").first()).toHaveText(
      "UA · A. baerii · A. gueldenstaedtii · Huso huso × A. ruthenus*",
    );
    await expect(product.locator(".pp-latin-note")).toHaveText(/^\* /);
    await product.getByRole("button", { name: copy.ingredients }).click();
    await expect(product.locator("dt").first()).toHaveText(copy.fish);
    const delivery = product.locator(".b-acc").filter({
      has: page.getByRole("button", { name: copy.delivery, exact: true }),
    });
    await delivery.getByRole("button").click();
    await expect(delivery.locator(".acc-inner b")).toHaveText(copy.labels);
    await expect(delivery.locator("li")).toHaveText(copy.payments);
    await expect(delivery.locator(".acc-inner")).toContainText(copy.branch);
    await expect(
      delivery.getByText(copy.dispatch, { exact: true }),
    ).toBeVisible();
    await page.goto(`/${copy.locale}/products/trout`);
    await expect(product.locator(".pp-sticky > p").first()).toHaveText(
      copy.locale === "ua" ? "UA · Ікра форелі" : "UA · Trout caviar",
    );
    await expect(product.locator(".pp-latin-note")).toHaveCount(0);
  }
});

test("the root negotiates language and an explicit language URL takes precedence", async ({
  request,
}) => {
  const headers = { "Accept-Language": "en-GB,uk;q=0.7" };
  const response = await request.get("/?ref=test", {
    headers,
    maxRedirects: 0,
  });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toMatch(/\/en\?ref=test$/);
  expect(response.headers().vary).toContain("Accept-Language");
  expect(await (await request.get("/ua", { headers })).text()).toContain(
    '<html lang="uk"',
  );
  expect((await request.get("/en/missing-page")).status()).toBe(404);
  const error = await request.post("/api/checkout", {
    headers: { "X-Storefront-Locale": "en" },
    data: { contact: {}, items: [] },
  });
  expect(error.status()).toBe(422);
  expect(await error.json()).toMatchObject({
    errors: { name: "Please enter your full name." },
  });
});

test("language switching preserves the section and localizes the catalogue, cart and errors", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("ucb-loaded", "1");
    sessionStorage.setItem("ucb-pop", "1");
  });
  await page.goto("/ua#ikra");
  if ((page.viewportSize()?.width ?? 0) <= 1180) {
    await page.locator("#hdr").getByRole("button", { name: "Меню" }).click();
  }
  await page
    .getByRole("group", { name: "Мова" })
    .getByRole("link", { name: "EN" })
    .click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: "Choose your caviar" }),
  ).toBeVisible();
  await page.goto("/en/products/hybrid");
  await expect(
    page.getByRole("heading", { name: "Beluga hybrid caviar" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(
    page.getByRole("button", { name: "Successfully added to cart" }),
  ).toBeVisible();
  await page.locator("#hdr").getByRole("button", { name: /Cart/ }).click();
  await expect(
    page.getByRole("dialog").getByText("Beluga hybrid caviar", { exact: true }),
  ).toBeVisible();
  await page.goto("/en/unknown-page");
  await expect(
    page.getByRole("heading", { name: "This page got lost" }),
  ).toBeVisible();
});

test("changing language stays with the visible content and each quality step loads its photo", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("ucb-loaded", "1");
    sessionStorage.setItem("ucb-pop", "1");
  });
  await page.goto("/ua?ref=test#ikra");
  await expect(page.locator("html")).toHaveClass(/\bjs\b/);
  const trace = page.locator("#trace-b");
  const heading = trace.locator("h2");
  const originalTop = await heading.evaluate(async (el) => {
    await document.fonts.ready;
    window.scrollBy({
      top: el.getBoundingClientRect().top - 78,
      behavior: "instant",
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return el.getBoundingClientRect().top;
  });
  if ((page.viewportSize()?.width ?? 0) <= 1180)
    await page.locator("#hdr").getByRole("button", { name: "Меню" }).click();
  await page
    .getByRole("group", { name: "Мова" })
    .getByRole("link", { name: "EN" })
    .click();
  await expect(page).toHaveURL(/\/en\?ref=test$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(heading).toContainText("Quality you");
  await trace.evaluate((section) => {
    section.style.marginTop = "32px";
  });
  await expect
    .poll(async () => {
      const currentTop = await heading.evaluate(
        (el) => el.getBoundingClientRect().top,
      );
      return Math.abs(currentTop - originalTop);
    })
    .toBeLessThan(8);

  const names = ["step-01", "step-02", "step-03", "step-04", "step-05"];
  const buttons = trace.locator(".tr-acc").getByRole("button");
  for (const [index, name] of names.entries()) {
    const button = buttons.nth(index);
    if ((await button.getAttribute("aria-expanded")) === "false")
      await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    const photo = trace.locator(".tr-frame.on img");
    await expect(photo).toHaveAttribute("src", new RegExp(name));
    await expect
      .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  }
});

test("language switching keeps the position inside product details", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    sessionStorage.setItem("ucb-loaded", "1");
    sessionStorage.setItem("ucb-pop", "1");
  });
  await page.goto("/ua#ikra");
  await page.locator('#ikra .cc-foot a[href="/ua/products/hybrid"]').click();
  const product = page.locator("#pmodal");
  await expect(product).toBeVisible();
  const narrow = (page.viewportSize()?.width ?? 0) <= 640;
  const mobileNav = (page.viewportSize()?.width ?? 0) <= 1180;
  const selector = narrow ? "h1" : ".pp-photo:nth-child(2)";
  const originalTop = await product.locator(selector).evaluate(async (el) => {
    await document.fonts.ready;
    const panel = el.closest(".panel")!;
    panel.scrollBy({
      top: el.getBoundingClientRect().top - 28,
      behavior: "instant",
    });
    return el.getBoundingClientRect().top;
  });
  if (mobileNav) await product.getByRole("button", { name: "Меню" }).click();
  const languageGroup = mobileNav
    ? page.locator("dialog.mobile-menu")
    : product;
  await languageGroup.getByRole("link", { name: "EN", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/products\/hybrid$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(product.getByRole("button", { name: "Close" })).toBeVisible();
  await expect(page.locator(".product-back")).toHaveCount(0);
  const content = product.locator(".panel");
  await expect(
    content.getByRole("heading", { name: "Beluga hybrid caviar" }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      Math.abs(
        (await content
          .locator(selector)
          .evaluate((el) => el.getBoundingClientRect().top)) - originalTop,
      ),
    )
    .toBeLessThan(12);

  await expect(content.locator("dl")).toContainText("fish and fish products.");
  if (mobileNav) await product.getByRole("button", { name: "Menu" }).click();
  await languageGroup.getByRole("link", { name: "UA", exact: true }).click();
  await expect(page).toHaveURL(/\/ua\/products\/hybrid$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "uk");
  await expect(
    content.getByRole("heading", { name: "Ікра гібрида білуги" }),
  ).toBeVisible();
  await expect(content.locator("dl")).toContainText(
    "риба та продукти її переробки.",
  );
  await expect(content.locator("dl")).not.toContainText(
    "fish and fish products.",
  );
  await expect(page.locator(".product-back")).toHaveCount(0);
  await product.getByRole("button", { name: "Закрити" }).click();
  await expect(page).toHaveURL(/\/ua#ikra$/);
  await expect(product).toHaveCount(0);
  await expect(page.locator("#ikra")).toBeInViewport();

  await page.goto("/en/products/hybrid");
  await expect(page.locator(".product-back")).toBeVisible();
  if (mobileNav)
    await page.locator("#hdr").getByRole("button", { name: "Menu" }).click();
  const directLanguageGroup = mobileNav
    ? page.locator("dialog.mobile-menu")
    : page.locator("#hdr");
  await directLanguageGroup
    .getByRole("link", { name: "UA", exact: true })
    .click();
  await expect(page).toHaveURL(/\/ua\/products\/hybrid$/);
  await expect(page.getByRole("link", { name: "← До каталогу" })).toBeVisible();
  await expect(product).toHaveCount(0);
});
