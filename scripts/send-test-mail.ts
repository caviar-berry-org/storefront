import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import { sendMail, testRecipients } from "../src/lib/server/mail/smtp.ts";
import {
  orderMessage,
  promotionMessage,
  restockMessage,
  testMessage,
} from "../src/lib/server/mail/templates.ts";
import type { Order } from "../src/domain/orders.ts";

// Preview-only order used to review the layout; never written to Firestore.
const sampleOrder = (locale: "ua" | "en"): Order =>
  ({
    id: "preview",
    number: "87777",
    createdAt: Date.now(),
    customer: {
      name: locale === "ua" ? "Ольга Юрковська" : "Olga Yurkovska",
      email: "preview@example.com",
      phone: "+380671234567",
      type: "person",
    },
    type: "retail",
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
    },
    payment: { method: "online", status: "pending" },
  }) as unknown as Order;

const templates = {
  check: () => testMessage("ua"),
  "order-ua": () => orderMessage(sampleOrder("ua"), "created"),
  "order-en": () => orderMessage(sampleOrder("en"), "created"),
  "paid-ua": () => orderMessage(sampleOrder("ua"), "paid"),
  "promo-ua": () =>
    promotionMessage("ua", "UCB-PREVIEW", 10, Date.now() + 90 * 86400000),
  "promo-en": () =>
    promotionMessage("en", "UCB-PREVIEW", 10, Date.now() + 90 * 86400000),
  "restock-ua": () =>
    restockMessage("ua", "Ольга", "https://caviar.net.ua/ua#ikra"),
  "restock-en": () =>
    restockMessage("en", "Anna", "https://caviar.net.ua/en#ikra"),
};

try {
  const requested = process.argv[2] ?? "check";
  if (process.argv.length > 3 || !(requested in templates)) throw new Error();
  nextEnv.loadEnvConfig(process.cwd(), true, {
    info() {},
    error() {
      throw new Error();
    },
  });
  // One invocation sends exactly one message, even if several addresses are allowed.
  await sendMail(
    testRecipients()[0]!,
    templates[requested as keyof typeof templates](),
    `test:${randomUUID()}`,
  );
  console.log(
    `One TEST email (${requested}) accepted by SMTP. Inbox delivery is not yet confirmed.`,
  );
} catch {
  console.error(
    `TEST email failed. Usage: npm run mail:test -- [${Object.keys(templates).join("|")}]. Check local mail configuration and SMTP access; no automatic retry.`,
  );
  process.exitCode = 1;
}
