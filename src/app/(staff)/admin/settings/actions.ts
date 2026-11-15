"use server";

import { revalidatePath } from "next/cache";
import {
  canManageTeam,
  isStaffRole,
  staffEmail,
  type StaffRole,
  type StaffTeamError,
} from "@/domain/staff-team";
import { getStaffSession } from "@/lib/server/staff-session";
import {
  changeStaffRole,
  inviteStaff,
  permanentStaff,
  removeStaff,
  staffExists,
} from "@/lib/server/staff-team";

type Result = { ok: true } | { error: StaffTeamError };

async function manager() {
  const session = await getStaffSession();
  if (!session || !canManageTeam(session.role)) return null;
  return { role: session.role, email: staffEmail(session.email) };
}

export async function inviteStaffMember(
  input: string,
  role: string,
): Promise<Result> {
  const staff = await manager();
  if (!staff) return { error: "denied" };
  const email = staffEmail(input);
  if (!email || !isStaffRole(role)) return { error: "invalid" };
  if (permanentStaff().includes(email)) return { error: "duplicate" };
  try {
    if (await staffExists(email)) return { error: "duplicate" };
    await inviteStaff(email, role, staff.email ?? staff.role);
  } catch {
    return { error: "unavailable" };
  }
  revalidatePath("/admin/settings/team");
  return { ok: true };
}

export async function updateStaffRole(
  input: string,
  role: string,
): Promise<Result> {
  const staff = await manager();
  if (!staff) return { error: "denied" };
  const email = staffEmail(input);
  if (!email || !isStaffRole(role)) return { error: "invalid" };
  // A permanent superadmin is granted by the environment, not by this list.
  if (permanentStaff().includes(email)) return { error: "permanent" };
  if (email === staff.email) return { error: "self" };
  try {
    if (!(await staffExists(email))) return { error: "missing" };
    await changeStaffRole(email, role as StaffRole);
  } catch {
    return { error: "unavailable" };
  }
  revalidatePath("/admin/settings/team");
  return { ok: true };
}

export async function revokeStaffMember(input: string): Promise<Result> {
  const staff = await manager();
  if (!staff) return { error: "denied" };
  const email = staffEmail(input);
  if (!email) return { error: "invalid" };
  if (permanentStaff().includes(email)) return { error: "permanent" };
  // Removing yourself would lock the panel against its own operator.
  if (email === staff.email) return { error: "self" };
  try {
    if (!(await staffExists(email))) return { error: "missing" };
    await removeStaff(email);
  } catch {
    return { error: "unavailable" };
  }
  revalidatePath("/admin/settings/team");
  return { ok: true };
}
