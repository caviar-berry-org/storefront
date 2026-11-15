import { expect, test } from "@playwright/test";

test("the splash plays once per session and the hero intro starts after it or on reload", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const time = new Date("2026-11-07T12:00:00Z");
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 1000));
  await page.goto("/ua", { waitUntil: "domcontentloaded" });

  const splash = page.locator("#session-splash");
  const emblem = page.locator("#hdr .header-emblem");
  const title = page.locator(".hb-h1 .w").first();
  const subtitle = page.locator(".hb-sub .w").first();
  const action = page.locator(".hb-text > .b-link");
  await expect(splash).toBeVisible();
  await expect(emblem).toHaveCSS("animation-play-state", "paused");
  await expect(title).toHaveCSS("animation-play-state", "paused");
  await page
    .locator(".hb-roe")
    .evaluate((image: HTMLImageElement) => image.decode());
  await page.clock.runFor(2200);
  await expect(splash).toBeHidden();
  await expect(emblem).toHaveCSS("animation-play-state", "running");
  await expect(title).toHaveCSS("animation-delay", "1.2s");
  await expect(subtitle).toHaveCSS("animation-delay", "1.38s");
  await expect(action).toHaveCSS("animation-delay", "1.65s");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(splash).toBeHidden();
  await expect(title).toHaveCSS("animation-name", "hero-word-in");
  await page
    .locator(".hb-roe")
    .evaluate((image: HTMLImageElement) => image.decode());
  await page.clock.runFor(2000);
  await expect(title).toHaveCSS("animation-play-state", "running");
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(splash).toBeVisible();
});

for (const locale of [
  {
    path: "/ua",
    offerName: /на перше замовлення/,
    cartName: /Кошик/,
    submitName: "Отримати код",
    emailError: "Перевірте адресу електронної пошти.",
    requestError: "Не вдалося надіслати код. Спробуйте ще раз.",
  },
  {
    path: "/en",
    offerName: /on your first order/,
    cartName: /Cart/,
    submitName: "Get the code",
    emailError: "Please check your email address.",
    requestError: "Couldn’t send the code. Try again.",
  },
])
  test(`the ${locale.path} first-order offer waits for its timer and for an open cart to close`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "hardwareConcurrency", { value: 8 });
      sessionStorage.setItem("ucb-loaded", "1");
    });
    await page.clock.install();
    await page.goto(locale.path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/\bjs\b/);
    const delay = (page.viewportSize()?.width ?? 1440) <= 560 ? 25000 : 12000;
    const promo = page.getByRole("dialog", { name: locale.offerName });
    await page.clock.fastForward(delay - 4000);
    await expect(promo).toHaveCount(0);

    await page
      .locator("#hdr")
      .getByRole("button", { name: locale.cartName })
      .click();
    const cart = page.locator("dialog#cart");
    await expect(cart).toBeVisible();
    await page.clock.fastForward(5000);
    await expect(promo).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(cart).toHaveCount(0);
    await page.clock.fastForward(1000);
    await expect(promo).toBeVisible();
    await expect(promo.locator(":scope > [autofocus]")).toBeFocused();
    if (await page.evaluate(() => matchMedia("(pointer: coarse)").matches)) {
      const bodyTop = () =>
        page.evaluate(() => document.body.getBoundingClientRect().top);
      const beforeInput = await bodyTop();
      await promo.locator("input[type=email]").fill("shopper@example.com");
      await page.evaluate(() => window.scrollBy(0, 600));
      expect(await bodyTop()).toBe(beforeInput);
    }
    if (delay === 12000) {
      const stamp = promo.locator(".promo-stamp .stamp svg");
      await expect(stamp).toBeVisible();
      await expect(stamp).toHaveCSS("animation-name", "spin");
    }
    const email = promo.getByRole("textbox");
    const requestCode = promo.getByRole("button", { name: locale.submitName });
    await email.fill("bad-address");
    await requestCode.click();
    const fieldError = promo.getByText(locale.emailError);
    await expect(email).toHaveAccessibleDescription(locale.emailError);
    await expect(email).toBeFocused();
    expect(
      await fieldError.evaluate((error) => {
        const form = error.closest("form")!;
        return Boolean(
          error.compareDocumentPosition(
            form.querySelector('button[type="submit"]')!,
          ) & Node.DOCUMENT_POSITION_FOLLOWING,
        );
      }),
    ).toBe(true);
    await expect
      .poll(async () => {
        const inputBox = (await email.boundingBox())!;
        const errorBox = (await fieldError.boundingBox())!;
        const buttonBox = (await requestCode.boundingBox())!;
        return (
          errorBox.y >= inputBox.y + inputBox.height &&
          errorBox.y + errorBox.height <= buttonBox.y
        );
      })
      .toBe(true);
    let status = 422;
    await page.route("**/api/newsletter", (route) =>
      route.fulfill({ status, json: { code: "INVALID_EMAIL" } }),
    );
    await email.fill("shopper@example.com");
    await requestCode.click();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAccessibleDescription(locale.emailError);
    await expect(fieldError).toHaveCount(1);
    status = 503;
    await email.fill("retry@example.com");
    await requestCode.click();
    await expect(promo.getByText(locale.requestError)).toBeVisible();
    await expect(email).toHaveAttribute("aria-invalid", "false");
    await expect(email).toHaveValue("retry@example.com");
    await expect(fieldError.locator("xpath=..")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await page.keyboard.press("Escape");
    await expect(promo).toHaveCount(0);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/\bjs\b/);
    await page.clock.fastForward(delay + 1000);
    await expect(promo).toHaveCount(0);
  });

test("the cart panel slides in and out without scrolling its container", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("ucb-loaded", "1");
    sessionStorage.setItem("ucb-pop", "1");
  });
  await page.goto("/ua");
  await expect(page.locator("html")).toHaveClass(/\bjs\b/);
  const cartButton = page
    .locator("#hdr")
    .getByRole("button", { name: /Кошик/ });
  const movement = await cartButton.evaluate(async (button) => {
    (button as HTMLButtonElement).click();
    const samples: number[] = [];
    let maxScrollLeft = 0;
    const end = performance.now() + 550;
    while (performance.now() < end) {
      await new Promise(requestAnimationFrame);
      const cart = document.querySelector("dialog#cart");
      const panel = cart?.querySelector(".panel");
      if (!cart || !panel) continue;
      samples.push(panel.getBoundingClientRect().left);
      maxScrollLeft = Math.max(maxScrollLeft, cart.scrollLeft);
    }
    return { samples, maxScrollLeft };
  });
  expect(movement.maxScrollLeft).toBe(0);
  expect(movement.samples.length).toBeGreaterThan(2);
  expect(movement.samples[0]! - movement.samples.at(-1)!).toBeGreaterThan(50);

  const cart = page.locator("dialog#cart");
  await page.keyboard.press("Escape");
  const exit = await cart.evaluate(async (dialog) => {
    const panel = dialog.querySelector(".panel")!;
    const positions = [panel.getBoundingClientRect().left];
    while (dialog.isConnected) {
      await new Promise(requestAnimationFrame);
      if (dialog.isConnected)
        positions.push(panel.getBoundingClientRect().left);
    }
    return positions;
  });
  expect(exit.at(-1)! - exit[0]!).toBeGreaterThan(50);
  await expect(cart).toHaveCount(0);
});

test("reduced motion skips the splash and the drawer animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/ua", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#session-splash")).toBeHidden();
  await expect(page.locator("html")).toHaveClass(/\bjs\b/);
  await expect(page.locator("#hdr .header-emblem")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(page.locator(".hb-h1 .w").first()).toHaveCSS(
    "transform",
    "none",
  );

  await page.locator("#hdr").getByRole("button", { name: /Кошик/ }).click();
  const cart = page.locator("dialog#cart");
  await expect(cart.locator(".panel")).toHaveCSS("animation-name", "none");
  await page.keyboard.press("Escape");
  await expect(cart).toHaveCount(0);
});

test("the logo leads to the catalogue from the home and product pages", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("ucb-loaded", "1");
    sessionStorage.setItem("ucb-pop", "1");
  });
  const logo = page.locator("#hdr .header-logo");
  const catalogue = page.locator("#ikra h2");

  for (const path of ["/ua", "/ua/products/hybrid"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/\bjs\b/);
    await logo.click();
    await expect(page).toHaveURL(/ua#ikra$/);
    await expect(catalogue).toBeInViewport();
  }

  await page
    .locator("#about")
    .evaluate((section) =>
      section.scrollIntoView({ behavior: "instant", block: "start" }),
    );
  await expect(catalogue).not.toBeInViewport();
  await logo.click();
  await expect(catalogue).toBeInViewport();

  await page.locator('#ikra .cc-foot a[href="/ua/products/hybrid"]').click();
  await page.locator("#pmodal .header-logo").click();
  await expect(page.locator("#pmodal")).toHaveCount(0);
  await expect(page).toHaveURL(/ua#ikra$/);
  await expect(catalogue).toBeInViewport();
});

for (const locale of ["ua", "en"] as const)
  test(`${locale}: header links align section headings from an intercepted product on every viewport`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("ucb-loaded", "1");
      sessionStorage.setItem("ucb-pop", "1");
    });
    await page.goto(`/${locale}#ikra`);
    const mobileNav = (page.viewportSize()?.width ?? 0) <= 1180;
    const product = page.locator("#pmodal");
    for (const id of [
      "ikra",
      "about",
      "gifts",
      ...(mobileNav ? ["corp"] : []),
      "quality",
      "delivery",
      "faq",
      "blog",
      "contacts",
    ]) {
      await page
        .locator(`#ikra .cc-foot a[href="/${locale}/products/hybrid"]`)
        .click();
      await expect(product).toBeVisible();
      let navigation = product.locator(".store-header");
      if (mobileNav) {
        await navigation
          .getByRole("button", { name: locale === "ua" ? "Меню" : "Menu" })
          .click();
        navigation = page.locator("dialog.mobile-menu");
      }
      await navigation.locator(`a[href="/${locale}#${id}"]`).first().click();
      await expect(page).toHaveURL(new RegExp(`/${locale}#${id}$`));
      await expect(page.locator("dialog[open]")).toHaveCount(0);
      await expect
        .poll(() =>
          page
            .locator(`#${id} h2`)
            .first()
            .evaluate((heading) => {
              const header = document.getElementById("hdr")!;
              return Math.abs(
                heading.getBoundingClientRect().top -
                  header.getBoundingClientRect().bottom -
                  8,
              );
            }),
        )
        .toBeLessThanOrEqual(2);
    }
  });

test("backdrop gestures do not dismiss from a drag or activate the page beneath", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("ucb-loaded", "1");
    sessionStorage.setItem("ucb-pop", "1");
  });
  await page.goto("/ua");
  await page.locator("#hdr").getByRole("button", { name: /Кошик/ }).click();
  const cart = page.locator("dialog#cart");
  const panel = cart.locator(".panel");
  await expect(panel).toBeVisible();
  await panel.evaluate(async (element) => {
    await Promise.allSettled(
      element.getAnimations().map((animation) => animation.finished),
    );
  });
  const box = (await panel.boundingBox())!;
  if (box.x > 10) {
    await page.mouse.move(box.x + 10, 100);
    await page.mouse.down();
    await page.mouse.move(5, 100);
    await page.mouse.up();
    await expect(cart).toBeVisible();

    await page.mouse.click(5, 100);
    await expect(cart).toHaveCount(0);
  } else {
    await page.keyboard.press("Escape");
    await expect(cart).toHaveCount(0);
  }
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page).toHaveURL(/\/ua$/);
});

test("the hero uses the vector emblem and seasonal dates match the prototype", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", { value: 8 });
    sessionStorage.setItem("ucb-loaded", "1");
  });
  await page.goto("/ua");
  const emblem = page.locator("#hdr .header-emblem");
  await expect(emblem).toHaveAttribute("src", "/assets/img/logo-emblem.svg");
  await expect
    .poll(() =>
      emblem.evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      emblem.evaluate((image: HTMLImageElement) => image.offsetHeight),
    )
    .toBeGreaterThan(100);
  await expect(emblem).toHaveCSS("transform", "none");
  await page.evaluate(() =>
    window.scrollTo({ top: innerHeight * 0.26, behavior: "instant" }),
  );
  await expect
    .poll(() =>
      emblem.evaluate((image) => {
        const title = document.querySelector(".hb-text")!;
        return (
          title.getBoundingClientRect().top -
          image.getBoundingClientRect().bottom
        );
      }),
    )
    .toBeGreaterThan(0);
  await page.locator("#hdr .header-logo").click();
  await expect(page.locator("#ikra h2")).toBeInViewport();
  await expect(emblem).toHaveCSS(
    "height",
    (page.viewportSize()?.width ?? 0) <= 640 ? "36px" : "54px",
  );
  await expect(
    page.locator("#ikra").getByText("жовтень – березень", { exact: true }),
  ).toHaveCSS("text-decoration-style", "dotted");
  await page.goto("/ua/products/trout");
  await expect(
    page.locator("main").getByText("жовтень – березень", { exact: true }),
  ).toHaveCSS("text-decoration-style", "dotted");
});

test("the floating contact opens Telegram and phone choices", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("ucb-loaded", "1");
    sessionStorage.setItem("ucb-pop", "1");
  });
  await page.goto("/ua");
  const widget = page.locator(".floating-contact");
  const contact = widget.getByRole("button", { name: "Зв’язатися з нами" });
  const telegram = widget.getByRole("link", { name: "Telegram" });
  const phone = widget.getByRole("link", {
    name: "Зателефонувати",
    exact: true,
  });
  await expect(contact).toHaveAttribute("aria-expanded", "false");
  await contact.click();
  await expect(contact).toHaveAttribute("aria-expanded", "true");
  await expect(telegram).toHaveAttribute("href", "https://t.me/+380981944248");
  await expect(phone).toHaveAttribute("href", "tel:+380981944248");
  await expect(widget.locator(".floating-contact-menu")).toHaveCSS(
    "border-right",
    "1px dotted rgb(169, 165, 159)",
  );
  await expect(telegram).toHaveCSS("text-decoration-line", "none");
  await expect(phone).toHaveCSS("text-decoration-line", "none");
  await expect(phone).toHaveCSS("border-top", "1px dotted rgb(169, 165, 159)");
  await expect(phone).toHaveCSS("border-right-width", "0px");
  await contact.focus();
  await page.keyboard.press("Tab");
  await expect(telegram).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(contact).toBeFocused();
  await expect(telegram).toBeHidden();
  await contact.click();
  await page.mouse.click(8, 150);
  await expect(contact).toHaveAttribute("aria-expanded", "false");
});

test("English legal review pages stay on the English storefront", async ({
  page,
}) => {
  for (const [path, title] of [
    ["/en/privacy", "Privacy Policy"],
    ["/en/terms", "Terms of Use"],
  ]) {
    await page.goto(path!);
    const main = page.locator("main");
    await expect(main).toHaveAttribute("lang", "en");
    await expect(
      main.getByRole("heading", { name: title, level: 1 }),
    ).toBeVisible();
    await expect(
      main.getByRole("link", { name: "Back to the storefront" }),
    ).toHaveAttribute("href", "/en");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  }
});

test("the 404 countdown can return to an English legal page", async ({
  page,
}) => {
  await page.addInitScript(() => sessionStorage.setItem("ucb-loaded", "1"));
  await page.goto("/en/terms");
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("ucb-last-page")))
    .toBe("/en/terms");

  await page.clock.install();
  await page.goto("/en/missing-page");
  await expect(page.locator("html")).toHaveClass(/\bjs\b/);
  await page.clock.runFor(13000);
  await expect(page).toHaveURL(/\/en\/terms$/);
});

test("an unknown locale returns a 404 with a pausable countdown to the homepage", async ({
  page,
}) => {
  await page.clock.install();
  const response = await page.goto("/uk/");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Ця сторінка загубилася" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Залишитися тут" }).click();
  await page.clock.runFor(13000);
  await expect(page).toHaveURL(/\/uk$/);
  await page.getByRole("button", { name: "Продовжити відлік" }).click();
  await page.clock.runFor(13000);
  await expect(page).toHaveURL(/\/ua$/);
});

test("article and empty-cart links close their dialog and return to the catalogue", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("ucb-loaded", "1");
    sessionStorage.setItem("ucb-pop", "1");
  });
  await page.goto("/ua#ikra");
  const missingAnchors = await page
    .locator('a[href^="#"], a[href^="/ua#"]')
    .evaluateAll((links) =>
      links.flatMap((link) => {
        const hash = (link as HTMLAnchorElement).hash;
        return hash && !document.getElementById(hash.slice(1)) ? [hash] : [];
      }),
    );
  expect(missingAnchors).toEqual([]);

  await page.locator("#blog .blogb-item").first().click();
  await page.locator('#article a[href="/ua#ikra"]').click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.locator("#ikra h2")).toBeInViewport();

  await page.locator('#ikra .cc-foot a[href="/ua/products/hybrid"]').click();
  await page.locator("#pmodal").getByRole("button", { name: /Кошик/ }).click();
  await expect(page.locator("#cart")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#cart")).toHaveCount(0);
  await expect(page.locator("#pmodal")).toBeVisible();
  await page.locator("#pmodal").getByRole("button", { name: /Кошик/ }).click();
  await page.locator('#cart a[href="/ua#ikra"]').click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page).toHaveURL(/\/ua#ikra$/);
  await expect(page.locator("#ikra h2")).toBeInViewport();
});

test("footer promo validation fades in without moving the email field", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/ua?static=1");
  const footer = page.locator(".fb-join");
  const input = footer.getByRole("textbox");
  const submit = footer.getByRole("button", { name: "Отримати код" });
  await input.scrollIntoViewIfNeeded();
  const initial = await input.boundingBox();
  await submit.click();
  const message = footer.getByRole("status");
  await expect(message).toContainText("Вкажіть адресу електронної пошти.");
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(message).toHaveCSS("transition-property", "grid-template-rows");
  await expect
    .poll(async () => Math.abs((await input.boundingBox())!.y - initial!.y))
    .toBeLessThan(2);

  await input.fill("bad-address");
  await expect(input).toHaveAttribute("aria-invalid", "false");
  await submit.click();
  await expect(message).toContainText("Перевірте адресу електронної пошти.");
});
