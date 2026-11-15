import "server-only";
import { FieldPath } from "firebase-admin/firestore";
import { cache } from "react";
import { firebaseAdminDatabase } from "../firestore";
import {
  inquiryCategory,
  inquirySearch,
  type InquiryCategory,
  type InquiryCursor,
  type InquiryPage,
  type InquiryRecord,
  type InquiryStatus,
} from "@/domain/staff-inquiries";
export const inquiries = () => firebaseAdminDatabase().collection("inquiries");
export function inquiryRecord(
  doc: FirebaseFirestore.DocumentSnapshot,
): InquiryRecord | null {
  const d = doc.data();
  if (!d) return null;
  return {
    id: doc.id,
    category: inquiryCategory(d),
    name: String(d.name ?? ""),
    contact: String(d.contact ?? ""),
    subject: String(d.subject ?? ""),
    comment: String(d.comment ?? ""),
    date: String(d.date ?? ""),
    targetId: typeof d.targetId === "string" ? d.targetId : null,
    variantId: typeof d.variantId === "string" ? d.variantId : null,
    customerId: typeof d.customerId === "string" ? d.customerId : null,
    status: d.status ?? "new",
    createdAt: Number(d.createdAt),
    revision: Number(d.revision ?? 0),
    mail: String(d.mailState ?? "waiting"),
  };
}
export async function readInquiries(
  category: InquiryCategory,
  search = "",
  status = "all",
  cursor: InquiryCursor | null = null,
): Promise<InquiryPage> {
  const term = inquirySearch(search);
  if (term === null) throw new Error("Invalid search");
  let q: FirebaseFirestore.Query = inquiries().where(
    "kind",
    "==",
    category === "restock"
      ? "notify"
      : category === "contact"
        ? "write"
        : "gift",
  );
  if (category === "corporate") q = q.where("targetId", "==", "corp");
  if (term) q = q.where("contact", "==", term);
  if (category !== "restock" && status !== "all")
    q = q.where("status", "==", status);
  q = q.orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc");
  if (cursor) q = q.startAfter(cursor.createdAt, cursor.id);
  const rows: InquiryRecord[] = [];
  // Legacy gift records share their kind with corporate requests. Scan until a full page is found.
  while (rows.length < 11) {
    const batch = await q.limit(11).get();
    for (const doc of batch.docs) {
      const row = inquiryRecord(doc)!;
      if (row.category === category) rows.push(row);
      if (rows.length === 11) break;
    }
    if (rows.length === 11 || batch.size < 11) break;
    q = q.startAfter(batch.docs.at(-1)!);
  }
  const last = rows[9];
  return {
    rows: rows.slice(0, 10),
    next:
      rows.length > 10 && last
        ? { id: last.id, createdAt: last.createdAt }
        : null,
  };
}
export const inquiryCounts = cache(async () => {
  const base = inquiries().where("status", "in", ["new", "viewed", "working"]);
  const [write, gift, corp] = await Promise.all([
    base.where("kind", "==", "write").count().get(),
    base.where("kind", "==", "gift").count().get(),
    base
      .where("kind", "==", "gift")
      .where("targetId", "==", "corp")
      .count()
      .get(),
  ]);
  return {
    contact: write.data().count,
    corporate: corp.data().count,
    gifts: gift.data().count - corp.data().count,
    restock: 0,
  };
});
export async function changeInquiry(
  id: string,
  status: InquiryStatus | "open",
  revision: number,
  actor: string,
) {
  const db = firebaseAdminDatabase();
  const ref = inquiries().doc(id);
  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const row = inquiryRecord(doc);
    if (!row || row.category === "restock")
      return { error: "invalid" } as const;
    if (status === "open" && row.status !== "new")
      return { status: row.status, revision: row.revision };
    if (status !== "open" && row.revision !== revision)
      return { error: "conflict" } as const;
    const next = status === "open" ? "viewed" : status;
    if (next === "new") return { error: "invalid" } as const;
    if (row.status === next) return { status: next, revision: row.revision };
    tx.update(ref, {
      status: next,
      revision: row.revision + 1,
      updatedAt: Date.now(),
    });
    tx.create(ref.collection("activity").doc(), {
      at: Date.now(),
      actor,
      before: row.status,
      after: next,
    });
    return { status: next, revision: row.revision + 1 };
  });
}
