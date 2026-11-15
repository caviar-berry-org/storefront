import "server-only";
import { orderCollection } from "../orders/storage";
import { createHash } from "node:crypto";
import { firebaseAdminDatabase } from "../firestore";
import {
  mailbox,
  MailError,
  sendMail,
  smtpTransport,
  type MailTransport,
} from "./smtp";
import { logCommerce } from "../observability";
import { ownerMessage, restockMessage } from "./templates";
import type { Locale } from "@/i18n/routing";
export function ownerRecipients() {
  const values = (process.env.OWNER_NOTIFICATION_EMAILS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  return [
    ...new Set(
      values.map((v) => mailbox(v)).filter((v): v is string => Boolean(v)),
    ),
  ];
}
export function queueOwnerMail(
  tx: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  sourceId: string,
  type: "gift" | "corporate" | "write" | "order",
  fields: Record<string, string>,
  url: string,
  paid = false,
) {
  for (const to of ownerRecipients()) {
    const id = `owner-${sourceId}-${createHash("sha256").update(to).digest("hex")}`;
    tx.create(db.collection("mailJobs").doc(id), {
      purpose: "owner",
      paid,
      to,
      type,
      fields,
      url,
      state: "pending",
      nextAttemptAt: Date.now(),
      attempts: 0,
      createdAt: Date.now(),
    });
  }
}
export async function deliverMailJobs() {
  const db = firebaseAdminDatabase();
  const purposes = [
    ...(process.env.OWNER_EMAIL_ENABLED === "true" ? ["owner"] : []),
    ...(process.env.RESTOCK_EMAIL_ENABLED === "true" ? ["restock"] : []),
  ];
  if (!purposes.length) return;
  const started = Date.now();
  // Opened lazily, and optional: if a pooled transport cannot be created the run
  // falls back to one connection per letter, so a configuration fault still
  // surfaces from sendMail and is classified exactly as it was before.
  let shared: MailTransport | undefined;
  let unpoolable = false;
  const pooled = () => {
    if (!shared && !unpoolable)
      try {
        shared = smtpTransport(process.env, true);
      } catch {
        unpoolable = true;
      }
    return shared;
  };
  try {
    await drainMailJobs(db, purposes, started, pooled);
  } finally {
    shared?.close();
  }
}

async function drainMailJobs(
  db: FirebaseFirestore.Firestore,
  purposes: string[],
  started: number,
  pooled: () => MailTransport | undefined,
) {
  while (Date.now() - started < 45000) {
    const jobs = await db
      .collection("mailJobs")
      .where("purpose", "in", purposes)
      .where("state", "in", ["pending", "failed"])
      .where("nextAttemptAt", "<=", Date.now())
      .orderBy("nextAttemptAt")
      .limit(20)
      .get();
    if (!jobs.size) break;
    let claimed = 0;
    async function deliver(snapshot: FirebaseFirestore.QueryDocumentSnapshot) {
      const ref = snapshot.ref;
      // Firestore retries a transaction callback on contention, so it must stay
      // free of side effects: the outcome is reported back and counted outside.
      const result = await db.runTransaction(
        async (
          tx,
        ): Promise<
          { job: FirebaseFirestore.DocumentData } | { suppressed: true } | null
        > => {
          const d = (await tx.get(ref)).data();
          if (
            !d ||
            !["pending", "failed"].includes(d.state) ||
            d.nextAttemptAt > Date.now() ||
            d.attempts >= 3
          )
            return null;
          if (d.purpose === "owner" && d.type === "order") {
            const order = (
              await tx.get(orderCollection(db).doc(d.fields.id))
            ).data();
            if (
              !order ||
              (order.payment.method === "online" &&
                (!d.paid || order.payment.status !== "paid"))
            ) {
              tx.update(ref, { state: "suppressed" });
              return { suppressed: true };
            }
          }
          tx.update(ref, {
            state: "sending",
            attempts: d.attempts + 1,
            lastAttemptAt: Date.now(),
          });
          if (d.inquiryId)
            tx.update(db.collection("inquiries").doc(d.inquiryId), {
              mailState: "sending",
            });
          return { job: d };
        },
      );
      if (!result) return;
      claimed++;
      if ("suppressed" in result) {
        logCommerce("warn", "mail.suppressed", { job: ref.id });
        return;
      }
      const job = result.job;
      let state = "accepted";
      try {
        const message =
          job.purpose === "owner"
            ? ownerMessage(job.type, job.fields, job.url)
            : restockMessage(job.locale, job.name, job.url);
        const transport = pooled();
        await sendMail(job.to, message, ref.id, {
          purpose: job.purpose,
          ...(transport && { transport }),
        });
      } catch (error) {
        state =
          error instanceof MailError && !error.uncertain ? "failed" : "unknown";
      }
      // A failed persistence write after SMTP acceptance leaves 'sending'; never automatically resend it.
      const finalState =
        state === "failed" && job.attempts + 1 >= 3 ? "exhausted" : state;
      if (finalState !== "accepted")
        logCommerce(
          finalState === "unknown" ? "error" : "warn",
          "mail.unaccepted",
          {
            job: ref.id,
            purpose: job.purpose,
            state: finalState,
            attempts: job.attempts + 1,
          },
        );
      const batch = db.batch();
      batch.update(ref, {
        state: finalState,
        nextAttemptAt: Date.now() + 60000,
      });
      if (job.inquiryId)
        batch.update(db.collection("inquiries").doc(job.inquiryId), {
          mailState: finalState,
        });
      await batch.commit();
    }
    for (
      let i = 0;
      i < jobs.docs.length && Date.now() - started < 45000;
      i += 4
    )
      await Promise.allSettled(jobs.docs.slice(i, i + 4).map(deliver));
    if (!claimed) break;
  }
}
export async function queueRestockMail() {
  if (process.env.RESTOCK_EMAIL_ENABLED !== "true") return;
  const db = firebaseAdminDatabase();
  const { freshCaviar } = await import("../catalog/storefront");
  const { isVariantAvailable } = await import("@/domain/catalog");
  const products = await freshCaviar();
  let query: FirebaseFirestore.Query = db
    .collection("inquiries")
    .where("kind", "==", "notify")
    .where("status", "==", "new")
    .orderBy("createdAt");
  while (true) {
    const batch = await query.limit(100).get();
    for (const snapshot of batch.docs) {
      const initial = snapshot.data();
      if (initial.test === true) continue;
      const product = products.find((p) => p.id === initial.targetId);
      if (!product) continue;
      const variant = product.variants.find((v) => v.id === initial.variantId);
      if (
        initial.variantId
          ? !variant || !isVariantAvailable(variant)
          : !product.variants.some(isVariantAvailable)
      )
        continue;
      await db.runTransaction(async (tx) => {
        const d = (await tx.get(snapshot.ref)).data();
        if (!d || d.status !== "new") return;
        const locale: Locale = d.locale === "en" ? "en" : "ua";
        const url = new URL(
          `/${locale}/products/${encodeURIComponent(product.slug)}`,
          process.env.SITE_URL ?? "https://caviar.net.ua",
        ).href;
        // The letter greets the customer and links to the product page; it names
        // no position, so nothing here needs the localised catalogue.
        tx.create(db.collection("mailJobs").doc(`restock-${snapshot.id}`), {
          purpose: "restock",
          inquiryId: snapshot.id,
          to: d.contact,
          name: d.name,
          locale,
          url,
          state: "pending",
          nextAttemptAt: Date.now(),
          attempts: 0,
          createdAt: Date.now(),
        });
        tx.update(snapshot.ref, { status: "processed", mailState: "pending" });
      });
    }
    if (batch.size < 100) break;
    query = query.startAfter(batch.docs.at(-1)!);
  }
}
