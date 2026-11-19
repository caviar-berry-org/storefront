import "server-only";
import { queueOwnerMail } from "./mail/jobs";
import { createHash } from "node:crypto";
import type { Attribution } from "@/domain/attribution";
import { firebaseAdminDatabase } from "./firestore";
import {
  customerLookupKeys,
  customerLookupKey,
  type CustomerSummary,
} from "@/domain/customer-directory";
import { isEmail, normalizeInquiryPhone } from "@/domain/contact";
import type { InquiryInput, InquiryKind } from "@/domain/inquiry";

export class InquiryLimit extends Error {}
export class InquiryConflict extends Error {}
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export async function saveInquiry(
  input: InquiryInput & {
    kind: InquiryKind;
    subject: string;
    targetId?: string;
    variantId?: string;
    locale?: "ua" | "en";
  },
  requestId: string,
  address: string,
  attribution?: Attribution,
) {
  const db = firebaseAdminDatabase();
  const now = Date.now();
  const email = isEmail(input.contact)
    ? input.contact.trim().toLowerCase()
    : null;
  const phone = email ? null : normalizeInquiryPhone(input.contact);
  const contact = email ?? phone!;
  const fingerprint = digest(JSON.stringify(input));
  const inquiry = db.collection("inquiries").doc(requestId);
  const limit = db
    .collection("inquiryLimits")
    .doc(digest(`${address}:${Math.floor(now / 3600000)}`));
  const customerId = digest(`${email ? "email" : "phone"}:${contact}`);
  const lookup = customerLookupKey(
    "all",
    email ? `email:${email}` : `phone:${phone!.replace(/\D/g, "")}`,
  );
  // One record for the staff email and the chat ticket; built outside the
  // transaction, which can be retried.
  const ownerFields = {
    id: requestId,
    createdAt: new Date(now).toLocaleString("uk-UA", {
      timeZone: "Europe/Kyiv",
    }),
    name: input.name,
    contact,
    subject: input.subject,
    targetId: input.targetId ?? "",
    variantId: input.variantId ?? "",
    date: input.date,
    comment: input.comment,
    locale: input.locale ?? "ua",
  };
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(inquiry);
    if (existing.exists) {
      if (existing.get("fingerprint") !== fingerprint)
        throw new InquiryConflict();
      return;
    }
    const budget = await tx.get(limit);
    if (Number(budget.get("count") ?? 0) >= 20) throw new InquiryLimit();
    const matches = await tx.get(
      db
        .collection("customers")
        .where("lookupKeys", "array-contains", lookup)
        .limit(1),
    );
    const customer =
      matches.docs[0]?.ref ?? db.collection("customers").doc(customerId);
    const previous = matches.docs[0] ?? (await tx.get(customer));
    const before = previous.data() as Omit<CustomerSummary, "id"> | undefined;
    const kind: "restock" | "corporate" | "contact" =
      input.kind === "notify"
        ? "restock"
        : input.targetId === "corp"
          ? "corporate"
          : "contact";
    const summary: CustomerSummary = {
      id: customer.id,
      name: before?.name ?? input.name.trim(),
      email: before?.email ?? email,
      phone: before?.phone ?? phone,
      type:
        before?.type ?? (input.targetId === "corp" ? "corporate" : "retail"),
      orderCount: before?.orderCount ?? 0,
      sources: [...new Set([...(before?.sources ?? []), kind])],
      lastInteractionAt: now,
    };
    const { id: _, ...data } = summary;
    void _;
    tx.set(
      customer,
      { ...data, lookupKeys: customerLookupKeys(summary) },
      { merge: true },
    );
    tx.create(customer.collection("activity").doc(requestId), {
      kind,
      occurredAt: now,
      subject: input.subject,
    });
    if (input.kind !== "notify")
      queueOwnerMail(
        tx,
        db,
        requestId,
        input.kind === "gift"
          ? input.targetId === "corp"
            ? "corporate"
            : "gift"
          : "write",
        ownerFields,
        new URL(
          `/admin/inquiries/${input.kind === "write" ? "contact" : input.targetId === "corp" ? "corporate" : "gifts"}/${requestId}`,
          process.env.SITE_URL ?? "https://caviar.net.ua",
        ).href,
      );
    tx.create(inquiry, {
      ...input,
      // Rides along on a write we already make, so the channel costs nothing.
      ...(attribution && { attribution }),
      name: input.name.trim(),
      contact,
      customerId: customer.id,
      fingerprint,
      status: "new",
      createdAt: now,
      privacyConsent: { accepted: true, at: now },
      marketingConsent: false,
    });
    tx.set(limit, {
      count: Number(budget.get("count") ?? 0) + 1,
      expiresAt: now + 7200000,
    });
  });
  return ownerFields;
}
