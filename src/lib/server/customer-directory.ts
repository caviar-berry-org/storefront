import "server-only";

import { FieldPath } from "firebase-admin/firestore";
import {
  customerLookupKey,
  customerPageSize,
  type CustomerActivity,
  type CustomerCursor,
  type CustomerPage,
  type CustomerSummary,
  type CustomerType,
} from "@/domain/customer-directory";
import { firebaseAdminDatabase } from "./firestore";

function customers() {
  return firebaseAdminDatabase().collection("customers");
}

export function isCustomerId(value: unknown): value is string {
  return typeof value === "string" && /^[\w-]{1,120}$/.test(value);
}

function summary(doc: FirebaseFirestore.DocumentSnapshot): CustomerSummary {
  const { id } = doc;
  const {
    name,
    email,
    phone,
    type,
    orderCount,
    sources,
    lastInteractionAt,
    demo,
  } = doc.data() as Omit<CustomerSummary, "id">;
  return {
    id,
    name,
    email,
    phone,
    type,
    orderCount,
    sources,
    lastInteractionAt,
    demo: demo === true,
  };
}

export async function readCustomerPage(
  type: CustomerType | "all" = "all",
  term = "",
  cursor: CustomerCursor | null = null,
): Promise<CustomerPage> {
  const collection = customers();
  const matching =
    type === "all" && !term
      ? collection
      : collection.where(
          "lookupKeys",
          "array-contains",
          customerLookupKey(type, term),
        );
  const ordered = matching
    .orderBy("lastInteractionAt", "desc")
    .orderBy(FieldPath.documentId(), "desc");
  const query = cursor
    ? ordered.startAfter(cursor.lastInteractionAt, cursor.id)
    : ordered;
  const result = await query
    .select(
      "name",
      "email",
      "phone",
      "type",
      "orderCount",
      "sources",
      "lastInteractionAt",
      "demo",
    )
    .limit(customerPageSize + 1)
    .get();
  const rows = result.docs.slice(0, customerPageSize).map(summary);
  const last = rows.at(-1);
  return {
    rows,
    next:
      last && result.size > customerPageSize
        ? { id: last.id, lastInteractionAt: last.lastInteractionAt }
        : null,
  };
}

export type CustomerActivityCursor = {
  id: string;
  occurredAt: number;
  direction: "older" | "newer";
};

const activityPageSize = 10;

export async function readCustomerDetail(
  id: string,
  cursor: CustomerActivityCursor | null = null,
) {
  const ref = customers().doc(id);
  const customer = await ref.get();
  if (!customer.exists) return null;

  const newer = cursor?.direction === "newer";
  const direction = newer ? "asc" : "desc";
  const ordered = ref
    .collection("activity")
    .orderBy("occurredAt", direction)
    .orderBy(FieldPath.documentId(), direction);
  const query = cursor
    ? ordered.startAfter(cursor.occurredAt, cursor.id)
    : ordered;
  const events = await query.limit(activityPageSize + 1).get();
  const docs = events.docs.slice(0, activityPageSize);
  if (newer) docs.reverse();
  const activity: CustomerActivity[] = docs.map((doc) => {
    const { kind, occurredAt, subject, totalMinor, orderLines, orderId, demo } =
      doc.data() as Omit<CustomerActivity, "id">;
    return {
      id: doc.id,
      kind,
      occurredAt,
      subject,
      totalMinor,
      orderLines,
      orderId,
      demo,
    };
  });
  const hasMore = events.size > activityPageSize;
  const first = activity[0];
  const last = activity.at(-1);
  return {
    customer: summary(customer),
    activity,
    newer:
      first && (newer ? hasMore : cursor !== null)
        ? ({
            direction: "newer",
            id: first.id,
            occurredAt: first.occurredAt,
          } as const)
        : null,
    older:
      last && (newer || hasMore)
        ? ({
            direction: "older",
            id: last.id,
            occurredAt: last.occurredAt,
          } as const)
        : null,
  };
}
