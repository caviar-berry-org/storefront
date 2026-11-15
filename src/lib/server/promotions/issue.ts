import "server-only";
import { randomBytes } from "node:crypto";
import type { Locale } from "../../../i18n/routing.ts";
import { assertMailRecipient, MailError, sendMail } from "../mail/smtp.ts";
import { promotionMessage } from "../mail/templates.ts";
import {
  campaign,
  emailKey,
  promotionBook,
  promotionDatabase,
  promotionLifetime,
} from "./storage";
import { readPromotionSettings } from "../../../domain/promotion-settings.ts";

export class PromotionDeliveryError extends Error {
  readonly limited: boolean;
  constructor(limited = false) {
    super("Promotion delivery unavailable.");
    this.limited = limited;
  }
}

type Issue = {
  code: string;
  state: "sending" | "accepted" | "failed" | "unknown";
  attempts: number;
  lastAttemptAt: number;
  expiresAt: number | null;
  percent: number;
};

export async function issuePromotion(email: string, locale: Locale) {
  if (process.env.PROMOTION_EMAIL_ENABLED !== "true")
    throw new PromotionDeliveryError();
  // Public issuance is explicit; diagnostic mail still uses the test allowlist.
  const recipient = assertMailRecipient(email, process.env, "promotion");
  const db = promotionDatabase();
  const book = promotionBook();
  const key = emailKey(recipient);
  const issueRef = book.collection("issues").doc(key);
  const now = Date.now();
  const newCode = `UCB-${randomBytes(8).toString("hex").toUpperCase()}`;
  const claim = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(issueRef);
    const settingsDoc = await tx.get(
      book.collection("settings").doc("general"),
    );
    const settings = readPromotionSettings(settingsDoc.data());
    if (!settings.enabled) throw new PromotionDeliveryError();
    const previous = snapshot.exists ? (snapshot.data() as Issue) : null;
    if (previous && previous.expiresAt !== null && previous.expiresAt <= now)
      throw new PromotionDeliveryError();
    if (previous?.state === "accepted")
      return {
        accepted: true,
        code: previous.code,
        expiresAt: previous.expiresAt,
        percent: previous.percent,
      };
    if (previous && previous.state !== "failed")
      throw new PromotionDeliveryError();
    if (
      previous &&
      (previous.attempts >= 3 || now - previous.lastAttemptAt < 60_000)
    )
      throw new PromotionDeliveryError(true);

    // Shared DEV budget is deliberately below the hosting domain's mail quota.
    const bucket = book
      .collection("mailBudgets")
      .doc(String(Math.floor(now / 3_600_000)));
    const budget = await tx.get(bucket);
    const count = Number(budget.get("count") ?? 0);
    if (count >= 20) throw new PromotionDeliveryError(true);
    const code = previous?.code ?? newCode;
    const expiresAt = previous
      ? previous.expiresAt
      : promotionLifetime === null
        ? null
        : now + promotionLifetime;
    const percent = previous?.percent ?? settings.percent;
    if (!previous) {
      tx.create(book.collection("codes").doc(code), {
        emailKey: key,
        percent,
        expiresAt,
        createdAt: now,
        excludedProductIds: [],
        ...(settings.productIds && { productIds: settings.productIds }),
        campaign,
      });
    }
    tx.set(
      issueRef,
      {
        email: recipient,
        locale,
        code,
        expiresAt,
        campaign,
        state: "sending",
        percent,
        attempts: (previous?.attempts ?? 0) + 1,
        lastAttemptAt: now,
        ...(!previous && { createdAt: now }),
      },
      { merge: true },
    );
    tx.set(bucket, { count: count + 1, expiresAt: now + 2 * 3_600_000 });
    return {
      accepted: false,
      code,
      expiresAt,
      percent,
      productIds: settings.productIds,
    };
  });
  if (claim.accepted) return { alreadySent: true };
  // Scope wording follows the admin setting. Naming the products is a nicety, so a
  // catalogue failure must degrade to the generic wording rather than block the code.
  let products: string[] | null = null;
  if (claim.productIds?.length) {
    try {
      const { freshCaviar } = await import("../catalog/storefront");
      const catalogue = await freshCaviar(locale);
      products = claim.productIds
        .map((id) => catalogue.find((item) => item.id === id)?.name)
        .filter((name): name is string => Boolean(name));
    } catch {
      products = null;
    }
  }

  let messageId: string;
  try {
    const result = await sendMail(
      recipient,
      promotionMessage(
        locale,
        claim.code,
        claim.percent,
        claim.expiresAt,
        products,
      ),
      `${campaign}:${key}`,
      { purpose: "promotion" },
    );
    messageId = result.messageId;
  } catch (error) {
    await issueRef.update({
      state:
        error instanceof MailError && !error.uncertain ? "failed" : "unknown",
    });
    throw new PromotionDeliveryError();
  }
  // If this write fails, keep 'sending': an ambiguous delivery must not auto-resend.
  await issueRef.update({
    state: "accepted",
    acceptedAt: Date.now(),
    messageId,
  });
  return { alreadySent: false };
}
