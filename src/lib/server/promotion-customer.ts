import "server-only";
import { createHash } from "node:crypto";
import { firebaseAdminDatabase } from "./firestore";
import {
  customerLookupKey,
  customerLookupKeys,
  type CustomerSummary,
} from "@/domain/customer-directory";

export async function recordPromotionCustomer(email: string) {
  const db = firebaseAdminDatabase();
  const key = createHash("sha256").update(`email:${email}`).digest("hex");
  const eventId = `promotion-${key}`;
  await db.runTransaction(async (tx) => {
    const matches = await tx.get(
      db
        .collection("customers")
        .where(
          "lookupKeys",
          "array-contains",
          customerLookupKey("all", `email:${email}`),
        )
        .limit(1),
    );
    const ref = matches.docs[0]?.ref ?? db.collection("customers").doc(key);
    const previous = matches.docs[0] ?? (await tx.get(ref));
    const event = ref.collection("activity").doc(eventId);
    if ((await tx.get(event)).exists) return;
    const before = previous.data() as Omit<CustomerSummary, "id"> | undefined;
    const now = Date.now();
    const customer: CustomerSummary = {
      id: ref.id,
      name: before?.name ?? null,
      phone: before?.phone ?? null,
      email,
      type: before?.type ?? "retail",
      orderCount: before?.orderCount ?? 0,
      sources: [...new Set([...(before?.sources ?? []), "promotion" as const])],
      lastInteractionAt: now,
    };
    const { id: _, ...data } = customer;
    void _;
    tx.set(
      ref,
      { ...data, lookupKeys: customerLookupKeys(customer) },
      { merge: true },
    );
    tx.create(event, {
      kind: "promotion",
      occurredAt: now,
      subject: "Промокод на перше замовлення",
      marketingConsent: false,
    });
  });
}
