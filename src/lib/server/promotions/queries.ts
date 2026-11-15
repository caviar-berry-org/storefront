import "server-only";
import { FieldPath } from "firebase-admin/firestore";
import { promotionBook } from "./storage";
import { promotionHeldUntil } from "@/domain/promotion";
export async function readPromotionIssues(cursor: {
  before?: string;
  id?: string;
  search?: string;
}) {
  const before = Number(cursor.before);
  let query = promotionBook()
    .collection("issues")
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc");
  const search = (cursor.search ?? " ").trim().toLowerCase();
  if (search) query = query.where("email", "==", search);
  if (
    cursor.before &&
    Number.isSafeInteger(before) &&
    before > 0 &&
    cursor.id &&
    /^[a-f\d]{64}$/.test(cursor.id)
  )
    query = query.startAfter(before, cursor.id);
  const snapshot = await query
    .select("email", "code", "state", "createdAt", "expiresAt", "percent")
    .limit(21)
    .get();
  const docs = snapshot.docs.slice(0, 20);
  const last = docs.at(-1);
  const codes = docs.length
    ? await promotionBook().firestore.getAll(
        ...docs.map((doc) =>
          promotionBook().collection("codes").doc(doc.get("code")),
        ),
      )
    : [];
  const now = Date.now();
  const date = (value: unknown) =>
    typeof value === "number"
      ? new Intl.DateTimeFormat("uk-UA", {
          dateStyle: "medium",
          timeZone: "Europe/Kyiv",
        }).format(value)
      : "—";
  return {
    search,
    rows: docs.map((doc, index) => ({
      id: doc.id,
      email: String(doc.get("email")),
      code: String(doc.get("code")),
      percent: Number(doc.get("percent")),
      created: date(doc.get("createdAt")),
      expires: date(doc.get("expiresAt")),
      state: String(doc.get("state")),
      usage: codes[index]?.get("consumedBy")
        ? ("used" as const)
        : // A hold only counts while the invoice behind it can still be paid;
          // past that the code is free again and staff should see it that way.
          promotionHeldUntil(codes[index]?.data(), now) !== null
          ? ("reserved" as const)
          : doc.get("expiresAt") < now
            ? ("expired" as const)
            : ("active" as const),
    })),
    next:
      snapshot.size > 20 && last
        ? { before: Number(last.get("createdAt")), id: last.id }
        : null,
  };
}
