import { isEmail, normalizeInquiryPhone } from "./contact.ts";
export const inquiryCategories = [
  "contact",
  "corporate",
  "gifts",
  "restock",
] as const;
export type InquiryCategory = (typeof inquiryCategories)[number];
export const inquiryStatuses = [
  "new",
  "viewed",
  "working",
  "processed",
  "cancelled",
] as const;
export type InquiryStatus = (typeof inquiryStatuses)[number];
export function inquiryCategory(data: {
  kind?: unknown;
  targetId?: unknown;
}): InquiryCategory {
  return data.kind === "notify"
    ? "restock"
    : data.kind === "write"
      ? "contact"
      : data.targetId === "corp"
        ? "corporate"
        : "gifts";
}
export function inquirySearch(value: string) {
  if (!value.trim()) return "";
  return isEmail(value)
    ? value.trim().toLowerCase()
    : normalizeInquiryPhone(value);
}
export type InquiryCursor = { id: string; createdAt: number };
export type InquiryRecord = {
  id: string;
  category: InquiryCategory;
  name: string;
  contact: string;
  subject: string;
  comment: string;
  date: string;
  targetId: string | null;
  variantId: string | null;
  customerId: string | null;
  status: InquiryStatus;
  createdAt: number;
  revision: number;
  mail: string;
};
export type InquiryPage = { rows: InquiryRecord[]; next: InquiryCursor | null };

export function inquiryInventoryHref(
  row: Pick<InquiryRecord, "id" | "category" | "targetId" | "variantId">,
) {
  if (
    !row.targetId ||
    !/^[a-z0-9-]{1,100}$/.test(row.targetId) ||
    !["gifts", "restock"].includes(row.category)
  )
    return null;
  const origin = `fromInquiry=${encodeURIComponent(row.id)}&inquiryCategory=${row.category}`;
  if (row.category === "gifts")
    return `/admin/products/inventory?gift=${encodeURIComponent(row.targetId)}&${origin}`;
  return row.variantId && /^[a-z0-9-]{1,100}$/.test(row.variantId)
    ? `/admin/products/inventory/${row.targetId}/${row.variantId}?${origin}`
    : `/admin/products/inventory?product=${encodeURIComponent(row.targetId)}&${origin}`;
}
