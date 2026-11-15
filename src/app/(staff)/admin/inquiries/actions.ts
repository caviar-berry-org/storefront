"use server";
import { revalidatePath } from "next/cache";
import { getStaffSession } from "@/lib/server/staff-session";
import {
  inquiryCategories,
  inquiryStatuses,
  inquirySearch,
  type InquiryCategory,
  type InquiryStatus,
  type InquiryCursor,
} from "@/domain/staff-inquiries";
import { readInquiries, changeInquiry } from "@/lib/server/inquiries/queries";
export async function queryInquiries(
  category: InquiryCategory,
  search: string,
  status: string,
  cursor: InquiryCursor | null,
) {
  if (!(await getStaffSession())) return { error: "unavailable" } as const;
  if (
    !inquiryCategories.includes(category) ||
    typeof search !== "string" ||
    search.length > 254 ||
    inquirySearch(search) === null ||
    (category === "restock" && search.trim() && !search.includes("@")) ||
    (status !== "all" && !inquiryStatuses.includes(status as InquiryStatus)) ||
    (cursor &&
      (!/^[a-z0-9-]{36}$/i.test(cursor.id) ||
        !Number.isSafeInteger(cursor.createdAt) ||
        cursor.createdAt < 0))
  )
    return { error: "invalid" } as const;
  try {
    return await readInquiries(category, search, status, cursor);
  } catch {
    return { error: "unavailable" } as const;
  }
}
export async function updateInquiry(
  id: string,
  status: InquiryStatus | "open",
  revision: number,
) {
  const staff = await getStaffSession();
  if (!staff) return { error: "unavailable" } as const;
  if (
    !/^[a-z0-9-]{36}$/i.test(id) ||
    !Number.isSafeInteger(revision) ||
    (status !== "open" && !inquiryStatuses.includes(status))
  )
    return { error: "invalid" } as const;
  try {
    const result = await changeInquiry(id, status, revision, staff.uid);
    revalidatePath("/admin", "layout");
    return result;
  } catch {
    return { error: "unavailable" } as const;
  }
}

export async function getInquiryCounts() {
  if (!(await getStaffSession())) return null;
  return (await import("@/lib/server/inquiries/queries"))
    .inquiryCounts()
    .catch(() => null);
}
