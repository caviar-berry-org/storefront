import "server-only";

import { managesCatalog } from "@/domain/staff-team";
import { getStaffSession } from "../staff-session";

export async function catalogStaff() {
  const staff = await getStaffSession();
  if (!staff || !managesCatalog(staff.role)) return null;
  return staff;
}
