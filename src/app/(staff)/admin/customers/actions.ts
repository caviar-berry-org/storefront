"use server";

import {
  customerSearchTerm,
  customerTypes,
  type CustomerCursor,
  type CustomerFilters,
  type CustomerPage,
  type CustomerQueryError,
} from "@/domain/customer-directory";
import {
  isCustomerId,
  readCustomerPage,
} from "@/lib/server/customer-directory";
import { getStaffSession } from "@/lib/server/staff-session";

export async function queryCustomers(
  filters: CustomerFilters,
  cursor: CustomerCursor | null,
): Promise<CustomerPage | { error: CustomerQueryError }> {
  if (!(await getStaffSession())) return { error: "session" };

  if (
    typeof filters?.search !== "string" ||
    filters.search.length > 254 ||
    !Array.isArray(filters.types) ||
    filters.types.length > customerTypes.length ||
    !filters.types.every((type) => customerTypes.includes(type)) ||
    (cursor !== null &&
      (!isCustomerId(cursor?.id) ||
        !Number.isSafeInteger(cursor.lastInteractionAt)))
  ) {
    return { error: "invalid" };
  }

  const term = customerSearchTerm(filters.search);
  if (term === null) return { error: "invalid" };
  const types = new Set(filters.types);
  const type = types.size === 1 ? (filters.types[0] ?? "all") : "all";

  try {
    return await readCustomerPage(type, term, cursor);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      [9, "FAILED_PRECONDITION", "failed-precondition"].includes(
        error.code as string | number,
      ) &&
      /requires an index|index.*(building|not ready)/i.test(error.message)
    ) {
      return { error: "indexRequired" };
    }
    return { error: "unavailable" };
  }
}
