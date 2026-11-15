/**
 * Renders every transactional email to a PNG for client review.
 *
 *   node scripts/preview-mail.ts [--only=promo-ua] [--width=600]
 *
 * Nothing is sent: the message is built exactly as it would be posted to SMTP,
 * then the CID attachments are swapped for data: URIs so a browser can show the
 * same artwork a mail client assembles from the attachment parts.
 *
 * Output lands in `.local/mail-preview/` (gitignored) — previews are review
 * material, not build artefacts. Pass `--share` to also write a folder of
 * named screenshots to the Desktop, ready to forward to the client.
 */
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import type { Order } from "../src/domain/orders.ts";
import type { MailMessage } from "../src/lib/server/mail/smtp.ts";
import {
  orderMessage,
  ownerMessage,
  promotionMessage,
  restockMessage,
} from "../src/lib/server/mail/templates.ts";

const root = process.cwd();
const outDir = path.join(root, ".local/mail-preview");
const only = process.argv
  .find((arg) => arg.startsWith("--only="))
  ?.split("=")[1];
const share = process.argv.includes("--share");

/** Names the client reads, in the order she reviews them. */
const shareNames: Record<string, string> = {
  "promo-ua": "01 Промокод — UA",
  "promo-en": "01 Промокод — EN",
  "order-invoice-ua": "02 Замовлення, рахунок для компанії — UA",
  "order-invoice-en": "02 Замовлення, рахунок для компанії — EN",
  "order-transfer-ua": "03 Замовлення, оплата за реквізитами ФОП — UA",
  "order-transfer-en": "03 Замовлення, оплата за реквізитами ФОП — EN",
  "paid-ua": "04 Оплату отримано — UA",
  "paid-en": "04 Оплату отримано — EN",
  "shipment-ua": "05 Готове до відправлення — UA",
  "shipment-en": "05 Готове до відправлення — EN",
  "restock-ua": "06 Знову в наявності — UA",
  "restock-en": "06 Знову в наявності — EN",
  "owner-order": "07 Лист працівникам — UA",
};

type Kind = "online" | "iban" | "corporate";

const sampleOrder = (
  locale: "ua" | "en",
  kind: Kind = "online",
  withTracking = false,
): Order =>
  ({
    id: "preview",
    number: "CB-20261114-7F3A21C4",
    createdAt: Date.now(),
    customer: {
      name: locale === "ua" ? "Ольга Юрковська" : "Olga Yurkovska",
      email: "preview@example.com",
      phone: "+380671234567",
      type: "person",
    },
    type: kind,
    status: "new",
    revision: 1,
    locale,
    lines: [
      {
        id: "l1",
        variantId: "trout-100",
        name: locale === "ua" ? "Ікра форелі" : "Trout caviar",
        weightGrams: 100,
        quantity: 2,
        unitPriceMinor: 70000,
      },
      {
        id: "l2",
        variantId: "sterlet-50",
        name: locale === "ua" ? "Ікра стерляді" : "Sterlet caviar",
        weightGrams: 50,
        quantity: 1,
        unitPriceMinor: 150000,
      },
    ],
    subtotalMinor: 290000,
    discountMinor: 40000,
    totalMinor: 250000,
    promotion: { code: "UCB-PREVIEW", percent: 10 },
    delivery: {
      method: "branch",
      city: locale === "ua" ? "Київ" : "Kyiv",
      destination:
        locale === "ua"
          ? "Відділення №12, вул. Хрещатик 1"
          : "Branch no. 12, Khreshchatyk St 1",
      ...(withTracking && { trackingNumber: "20450000000001" }),
    },
    payment: {
      method: kind === "online" ? "online" : "iban",
      status: "pending",
    },
  }) as unknown as Order;

const templates: Record<string, () => MailMessage> = {
  "promo-ua": () =>
    promotionMessage("ua", "UCB-PREVIEW", 10, Date.now() + 90 * 86400000),
  "promo-en": () =>
    promotionMessage("en", "UCB-PREVIEW", 10, Date.now() + 90 * 86400000),
  // The two Ukrainian variants the client specified, and the single English
  // letter that covers both payment methods.
  "order-invoice-ua": () =>
    orderMessage(sampleOrder("ua", "corporate"), "created"),
  "order-transfer-ua": () => orderMessage(sampleOrder("ua", "iban"), "created"),
  "order-invoice-en": () =>
    orderMessage(sampleOrder("en", "corporate"), "created"),
  "order-transfer-en": () => orderMessage(sampleOrder("en", "iban"), "created"),
  "paid-ua": () => orderMessage(sampleOrder("ua"), "paid"),
  "paid-en": () => orderMessage(sampleOrder("en"), "paid"),
  "shipment-ua": () =>
    orderMessage(sampleOrder("ua", "online", true), "shipment"),
  "shipment-en": () =>
    orderMessage(sampleOrder("en", "online", true), "shipment"),
  "restock-ua": () =>
    restockMessage("ua", "Ольга", "https://caviar.net.ua/ua#ikra"),
  "restock-en": () =>
    restockMessage("en", "Anna", "https://caviar.net.ua/en#ikra"),
  "owner-order": () =>
    ownerMessage(
      "order",
      {
        number: "CB-20261114-7F3A21C4",
        name: "Ольга Юрковська",
        email: "preview@example.com",
        phone: "+380671234567",
        total: "2500 грн",
      },
      "https://caviar.net.ua/admin/orders/preview",
    ),
};

/** Mail clients resolve cid: from the attachment parts; a browser needs data:. */
function inlineAttachments(message: MailMessage) {
  let html = message.html;
  for (const attachment of message.attachments ?? [])
    html = html.replaceAll(
      `cid:${attachment.cid}`,
      `data:${attachment.contentType};base64,${attachment.base64}`,
    );
  return html;
}

const shareDir = path.join(
  process.env.HOME ?? root,
  "Desktop",
  "Caviar Berry — листи",
);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
if (share) {
  await rm(shareDir, { recursive: true, force: true });
  await mkdir(path.join(shareDir, "ПК"), { recursive: true });
  await mkdir(path.join(shareDir, "Мобільні"), { recursive: true });
}

const browser = await chromium.launch();
const entries = Object.entries(templates).filter(
  ([name]) => !only || name === only,
);

for (const [name, build] of entries) {
  const message = build();
  const html = inlineAttachments(message);
  await writeFile(path.join(outDir, `${name}.html`), html, "utf8");
  await writeFile(path.join(outDir, `${name}.txt`), message.text, "utf8");

  for (const [label, width] of [
    ["desktop", 760],
    ["mobile", 390],
  ] as const) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      deviceScaleFactor: 2,
    });
    await page.setContent(html, { waitUntil: "load" });
    await page.screenshot({
      path: path.join(outDir, `${name}-${label}.png`),
      fullPage: true,
    });
    if (share && shareNames[name])
      await page.screenshot({
        path: path.join(
          shareDir,
          label === "desktop" ? "ПК" : "Мобільні",
          `${shareNames[name]}.png`,
        ),
        fullPage: true,
      });
    await page.close();
  }
  console.log(`${name}: subject "${message.subject}"`);
}

await browser.close();
console.log(
  `\n${entries.length} letters → ${path.relative(root, outDir)} (HTML, plain text, desktop + mobile PNG).`,
);
if (share) console.log(`Shareable screenshots → ${shareDir}`);
