import { expect, test } from "@playwright/test";

for (const entry of [
  {
    path: "/ua?static=1#ikra",
    locale: "ua",
    button: "Повідомити, коли з’явиться",
    name: "Ім’я",
    heading: "Дізнатися про наявність",
    emailError: "Вкажіть email, наприклад name@example.com.",
    contacts: "Перейти до контактів",
  },
  {
    path: "/en/products/sterlet",
    locale: "en",
    button: "Notify me when available",
    name: "Name",
    heading: "Get a restock notification",
    emailError: "Enter an email address, for example name@example.com.",
    contacts: "Go to contact options",
  },
]) {
  test(`restock form validates and offers contact options in ${entry.locale}`, async ({
    page,
  }) => {
    await page.goto(entry.path);
    await page.getByRole("button", { name: entry.button }).click();
    const dialog = page.getByRole("dialog", { name: entry.heading });
    const name = dialog.getByLabel(entry.name, { exact: true });
    const email = dialog.getByLabel("Email", { exact: true });
    const submit = dialog.getByRole("button", { name: entry.button });
    await expect(name).toBeFocused();
    await expect(name).toHaveAttribute("required", "");
    await expect(email).toHaveAttribute("type", "email");
    await expect(email).toHaveAttribute("required", "");
    await name.fill("Ан");
    await email.fill("a..b@example.com");
    await dialog.getByRole("checkbox").check();
    await submit.click();
    await expect(email).toBeFocused();
    await expect(dialog.getByText(entry.emailError)).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: entry.contacts }),
    ).toHaveCount(0);

    await email.fill("anna+shop@example.com");
    const failedRequest = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/inquiries") && response.status() === 503,
    );
    await submit.click();
    expect((await failedRequest).request().postDataJSON()).toMatchObject({
      kind: "notify",
      name: "Ан",
      contact: "anna+shop@example.com",
    });
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(email).toHaveValue("anna+shop@example.com");
    await dialog.getByRole("link", { name: entry.contacts }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(
      new RegExp(`/${entry.locale}(?:\\?.*)?#contacts$`),
    );
    await expect(page.locator("#contacts")).toBeInViewport();
  });
}
