import uaMail from "../../../content/mail/ua.json" with { type: "json" };
import enMail from "../../../content/mail/en.json" with { type: "json" };
import { getTranslator } from "../../../i18n/index.ts";
import { documentLanguage, type Locale } from "../../../i18n/routing.ts";
import { escapeHtml, renderLayout, type Block } from "./layout.ts";
import { contacts, primaryPhone } from "../../../content/contacts.ts";
import { paymentDetails } from "../../../content/payment-details.ts";
import type { MailMessage } from "./smtp.ts";
import { isCarrierTrackingNumber } from "../../../domain/orders.ts";

export { escapeHtml };

export function render(
  locale: Locale,
  subject: string,
  blocks: Block[],
  preheader?: string,
  options: { banner?: boolean; heading?: string } = {},
): MailMessage {
  const t = mailTranslator(locale);
  const built = renderLayout(locale, subject, blocks, {
    visit: t("mail.visit"),
    preheader: preheader ?? subject,
    bannerAlt: t("mail.bannerAlt"),
    slogan: t("mail.slogan"),
    brand: t("brand.name"),
    banner: options.banner,
    // The sender name already reads "Caviar Berry"; drop the suffix inside the body.
    heading: options.heading ?? subject.replace(/\s+—\s+Caviar Berry$/, ""),
  });
  return {
    subject: built.subject,
    text: built.text,
    html: built.html,
    ...(built.attachments.length && { attachments: built.attachments }),
  };
}

export function testMessage(locale: Locale) {
  const t = mailTranslator(locale);
  return render(locale, t("mail.testSubject"), [
    { k: "lead", v: t("mail.testBody") },
  ]);
}

export function promotionMessage(
  locale: Locale,
  code: string,
  percent: number,
  expiresAt: number | null,
  products?: string[] | null,
) {
  const t = mailTranslator(locale);
  const base = (process.env.SITE_URL ?? "https://caviar.net.ua").replace(
    /\/$/,
    "",
  );
  const scope =
    products && products.length
      ? t("mail.promotionScopeSome", { products: products.join(", ") })
      : t("mail.promotionScopeAll");
  // Conditions the admin panel controls (scope, expiry, delivery) sit together as
  // fine print below the call to action, so the approved copy reads uninterrupted.
  const conditions = [
    scope,
    ...(expiresAt === null
      ? []
      : [
          t("mail.promotionExpires", {
            // The Ukrainian long format ends in "р." — keep the sentence's own period.
            date: new Intl.DateTimeFormat(documentLanguage(locale), {
              dateStyle: "long",
              timeZone: "Europe/Kyiv",
            })
              .format(expiresAt)
              .replace(/\.$/, ""),
          }),
        ]),
    t("mail.promotionDelivery"),
  ];
  return render(
    locale,
    t("mail.promotionSubject", { percent }),
    [
      { k: "lead", v: t("mail.promotionLead", { percent }) },
      { k: "p", v: t("mail.promotionOccasion") },
      { k: "code", label: t("mail.promotionCodeLabel"), value: code },
      { k: "p", v: t("mail.promotionUse", { percent }) },
      {
        k: "button",
        href: `${base}/${locale}#ikra`,
        label: t("mail.promotionCta", { percent }),
      },
      ...conditions.map((v) => ({ k: "note", v }) as Block),
      { k: "signoff", v: t("mail.signOff"), team: t("mail.team") },
    ],
    t("mail.promotionLead", { percent }),
    { heading: t("mail.promotionHeading") },
  );
}

export function orderMessage(
  order: import("../../../domain/orders.ts").Order,
  kind: "created" | "paid" | "shipment",
) {
  const locale = order.locale ?? "ua";
  const t = mailTranslator(locale);
  const money = (minor: number) =>
    new Intl.NumberFormat(locale === "ua" ? "uk-UA" : "en-GB", {
      style: "currency",
      currency: "UAH",
    })
      .format(minor / 100)
      .replaceAll(" ", " ");
  const date = new Intl.DateTimeFormat(documentLanguage(locale), {
    dateStyle: "long",
    timeZone: "Europe/Kyiv",
  }).format(order.createdAt);

  const status = t(
    kind === "shipment"
      ? "order.prepared"
      : kind === "paid"
        ? "order.paid"
        : order.payment.method === "online"
          ? "order.pending"
          : "order.created",
  );
  // Only an invoice or a transfer order ever gets a "created" letter: an online
  // order stays silent until the payment is verified.
  const invoice = order.type === "corporate";
  const transfer = order.payment.method !== "online" && !invoice;
  const method = t(
    order.payment.method === "online"
      ? "mail.paymentOnline"
      : invoice
        ? "mail.paymentInvoice"
        : "mail.paymentTransfer",
  );
  const paymentStatus = t(
    (
      {
        pending: "mail.paymentStatusPending",
        paid: "mail.paymentStatusPaid",
        failed: "mail.paymentStatusFailed",
        refunded: "mail.paymentStatusRefunded",
      } as const
    )[order.payment.status] ?? "mail.paymentStatusPending",
  );

  const facts: [string, string][] = [
    [t("mail.orderNumberLabel"), `${order.number} · ${date}`],
    [
      t("mail.paymentLabel"),
      `${method} — ${t("mail.paymentStatusLabel")}: ${paymentStatus}`,
    ],
    ...(order.delivery
      ? ([
          [
            t("mail.deliveryLabel"),
            `${t("mail.carrier")} · ${t(order.delivery.method === "branch" ? "mail.deliveryBranch" : "mail.deliveryCourier")}`,
          ],
          [
            t("mail.addressLabel"),
            `${order.delivery.city}, ${order.delivery.destination}`,
          ],
        ] as [string, string][])
      : []),
  ];

  const contact: [string, string][] = [
    ...(order.customer.name
      ? ([[t("mail.nameLabel"), order.customer.name]] as [string, string][])
      : []),
    ...(order.customer.phone
      ? ([[t("mail.phoneLabel"), order.customer.phone]] as [string, string][])
      : []),
    ...(order.customer.email
      ? ([[t("mail.emailLabel"), order.customer.email]] as [string, string][])
      : []),
  ];

  // The bank details are only in the Ukrainian transfer letter: the client asked
  // for one English letter covering both payment methods, so an English transfer
  // customer is told a manager will be in touch instead.
  const bankBlocks: Block[] =
    kind === "created" && transfer && locale === "ua"
      ? [
          {
            k: "facts",
            // Order follows the client's final list, so a payer reads the
            // letter in the same sequence their banking form asks for it.
            items: [
              [t("mail.bankCompany"), paymentDetails.recipient],
              [t("mail.bankIban"), paymentDetails.iban],
              [t("mail.bankTaxCode"), paymentDetails.taxCode],
              [t("mail.bankName"), paymentDetails.bank],
              [t("mail.bankMfo"), paymentDetails.bankMfo],
              [t("mail.bankCode"), paymentDetails.bankCode],
            ],
          },
          {
            k: "p",
            v: t("mail.paymentPurpose", { number: order.number }),
            accent: order.number,
          },
          { k: "p", v: t("mail.transferManager") },
        ]
      : [];

  return render(
    locale,
    t(
      kind === "shipment"
        ? "order.mailShipmentSubject"
        : kind === "paid"
          ? "order.mailPaidSubject"
          : "order.mailSubject",
      { number: order.number },
    ),
    [
      {
        k: "lead",
        v: t("order.mailGreeting"),
        // The brand name is the one phrase the client wants picked out in gold.
        accent: "Ukrainian Caviar Berry",
      },
      {
        k: "p",
        v:
          kind !== "created"
            ? status
            : t(invoice ? "mail.orderIntroInvoice" : "mail.orderIntroTransfer"),
      },
      { k: "facts", items: facts },
      {
        k: "table",
        head: [
          t("mail.tableName"),
          t("mail.tableQuantity"),
          t("mail.tableAmount"),
        ],
        rows: order.lines.map(
          (line) =>
            [
              `${line.name}, ${line.weightGrams} ${t("common.grams")}`,
              `${line.quantity} × ${money(line.unitPriceMinor)}`,
              money(line.unitPriceMinor * line.quantity),
            ] as [string, string, string],
        ),
        totals: [
          [t("cart.subtotal"), money(order.subtotalMinor), false],
          ...(order.promotion
            ? ([[t("cart.promoLabel"), order.promotion.code, false]] as [
                string,
                string,
                boolean,
              ][])
            : []),
          ...(order.discountMinor
            ? ([
                [t("order.discount"), `−${money(order.discountMinor)}`, false],
              ] as [string, string, boolean][])
            : []),
          [t("cart.total"), money(order.totalMinor), true],
        ],
      },
      ...(contact.length
        ? ([{ k: "facts", items: contact }] as Block[])
        : ([] as Block[])),
      ...bankBlocks,
      ...(kind === "shipment" && order.delivery?.trackingNumber
        ? ([
            {
              k: "p",
              v: t("order.tracking", {
                number: order.delivery.trackingNumber,
              }),
            },
            // Staff may record a free-form parcel mark; only a real waybill can
            // be looked up, so the button appears only for one.
            ...(isCarrierTrackingNumber(order.delivery.trackingNumber)
              ? [
                  {
                    k: "button" as const,
                    href: `https://novaposhta.ua/tracking/?cargo_number=${encodeURIComponent(order.delivery.trackingNumber.replace(/[\s-]/g, ""))}`,
                    label: t("mail.trackCta"),
                  },
                ]
              : []),
          ] as Block[])
        : ([] as Block[])),
      {
        k: "note",
        v: t("mail.orderQuestions", {
          email: contacts.email,
          phone: primaryPhone.display,
        }),
      },
      { k: "signoff", v: t("mail.signOff"), team: t("mail.team") },
    ],
    `${t("mail.orderNumberLabel")} ${order.number} · ${money(order.totalMinor)}`,
    {
      // A long order number set in the display face swamped the heading; the
      // number still opens the body and stays in the inbox subject.
      heading: t(
        kind === "shipment"
          ? "order.mailShipmentHeading"
          : kind === "paid"
            ? "order.mailPaidHeading"
            : "order.mailHeading",
      ),
    },
  );
}

export function mailTranslator(locale: Locale) {
  const dictionary = locale === "en" ? enMail : uaMail;
  const fallback = getTranslator(locale);
  return (
    key: Parameters<typeof fallback>[0] | keyof typeof uaMail,
    values: Record<string, string | number> = {},
  ) => {
    const value = (dictionary as Record<string, unknown>)[key];
    return typeof value === "string"
      ? value.replace(/\{(\w+)\}/g, (match, name: string) =>
          values[name] === undefined ? match : String(values[name]),
        )
      : fallback(key as Parameters<typeof fallback>[0], values);
  };
}

/**
 * Availability mail is deliberately generic: the trigger stays per pack, but the
 * customer-facing copy announces the restocked range instead of naming one jar.
 */
export function restockMessage(locale: Locale, name: string, url: string) {
  const t = mailTranslator(locale);
  return render(
    locale,
    t("restock.subject"),
    [
      { k: "lead", v: t("restock.greeting", { name }) },
      { k: "p", v: t("restock.body") },
      { k: "p", v: t("restock.occasion") },
      { k: "button", href: url, label: t("mail.shopCta") },
      { k: "note", v: t("restock.note") },
      { k: "signoff", v: t("restock.signOff"), team: t("mail.team") },
    ],
    t("restock.body"),
  );
}

/**
 * Staff notification: facts and a link, nothing else. It carries no artwork — internal
 * mail goes out on every single submission, so the bytes are not worth spending.
 */
export function ownerMessage(
  type: keyof (typeof uaMail)["owner.types"],
  fields: Record<string, string>,
  url: string,
) {
  const labels = uaMail["owner.fields"];
  return render(
    "ua",
    uaMail["owner.subject"].replace("{type}", uaMail["owner.types"][type]),
    [
      {
        k: "facts",
        items: Object.entries(fields)
          .filter(
            ([key, value]) =>
              value && !["id", "targetId", "variantId", "locale"].includes(key),
          )
          .map(
            ([key, value]) =>
              [labels[key as keyof typeof labels] ?? key, value] as [
                string,
                string,
              ],
          ),
      },
      { k: "link", href: url, label: uaMail["owner.cta"] },
    ],
    undefined,
    { banner: false },
  );
}

export function ownerOrderFields(
  order: import("../../../domain/orders.ts").Order,
): Record<string, string> {
  const d = uaMail;
  return {
    id: order.id,
    number: order.number,
    createdAt: new Date(order.createdAt).toLocaleString("uk-UA", {
      timeZone: "Europe/Kyiv",
    }),
    name: order.customer.name ?? "",
    email: order.customer.email ?? "",
    phone: order.customer.phone ?? "",
    lines: order.lines
      .map(
        (line) =>
          `${line.name}, ${line.weightGrams} г × ${line.quantity}: ${line.unitPriceMinor / 100} грн/шт. = ${(line.unitPriceMinor * line.quantity) / 100} грн`,
      )
      .join("\n"),
    total: `${order.totalMinor / 100} грн`,
    discount: `${order.discountMinor / 100} грн`,
    subtotal: `${order.subtotalMinor / 100} грн`,
    promotion: order.promotion?.code ?? "",
    payment:
      order.payment.method === "online"
        ? d["owner.paymentMethods"].online
        : order.type === "corporate"
          ? d["owner.paymentMethods"].invoice
          : d["owner.paymentMethods"].transfer,
    paymentStatus:
      d["owner.paymentStates"][
        order.payment.status as keyof (typeof d)["owner.paymentStates"]
      ] ?? order.payment.status,
    delivery: order.delivery
      ? Object.entries(d["owner.deliveryFields"])
          .map(([key, label]) => {
            const value = order.delivery![key as keyof typeof order.delivery];
            return value ? `${label}: ${value}` : "";
          })
          .filter(Boolean)
          .join("\n")
      : "",
    locale: order.locale ?? "ua",
  };
}
