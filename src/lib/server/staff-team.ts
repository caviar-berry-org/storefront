import "server-only";

import { unstable_cache, updateTag } from "next/cache";
import { cache } from "react";
import {
  isStaffRole,
  sortStaff,
  staffEmail,
  staffTeamPath,
  type StaffMember,
  type StaffRole,
} from "@/domain/staff-team";
import { firebaseAdminDatabase } from "./firestore";

const teamTag = "staff-team";

function team() {
  return firebaseAdminDatabase().collection(staffTeamPath(process.env.APP_ENV));
}

/** Bootstrap superadmins. They exist before any database write and cannot be removed here. */
export function permanentStaff(): string[] {
  return [
    ...new Set(
      (process.env.ADMIN_ALLOWED_EMAILS ?? "")
        .split(",")
        .map((value) => staffEmail(value))
        .filter((value): value is string => value !== null),
    ),
  ];
}

type Invited = { role: StaffRole; invitedAt?: number; invitedBy?: string };

/**
 * Cached by tag rather than by time: an address added or removed here takes
 * effect on the next request, without a Firestore read on every page view.
 */
const invitedStaff = unstable_cache(
  async (): Promise<Record<string, Invited>> => {
    const snapshot = await team()
      .select("role", "invitedAt", "invitedBy")
      .get();
    return Object.fromEntries(
      snapshot.docs.map((doc) => [
        doc.id,
        {
          role: isStaffRole(doc.get("role")) ? doc.get("role") : "manager",
          ...(typeof doc.get("invitedAt") === "number" && {
            invitedAt: doc.get("invitedAt") as number,
          }),
          ...(typeof doc.get("invitedBy") === "string" && {
            invitedBy: doc.get("invitedBy") as string,
          }),
        },
      ]),
    );
  },
  [teamTag],
  { tags: [teamTag], revalidate: 3600 },
);

/** Null when the database is unreachable: access then falls back to the env allowlist. */
const safeInvitedStaff = cache(async () => {
  try {
    return await invitedStaff();
  } catch (error) {
    console.error("[staff-team] read failed", error);
    return null;
  }
});

/** The role an address holds, or null when it has no access at all. */
export async function staffRoleFor(email: string | undefined | null) {
  const address = staffEmail(email);
  if (!address) return null;
  if (permanentStaff().includes(address)) return "superadmin" as const;
  const invited = await safeInvitedStaff();
  return invited?.[address]?.role ?? null;
}

export async function readStaffTeam(
  currentEmail: string | null,
): Promise<StaffMember[]> {
  const invited = (await invitedStaff()) ?? {};
  const permanent = permanentStaff();
  const addresses = [...new Set([...permanent, ...Object.keys(invited)])];
  const accounts = await googleAccounts(addresses);
  return sortStaff(
    addresses.map((email) => {
      const account = accounts.get(email);
      const record = invited[email];
      return {
        email,
        role: permanent.includes(email) ? "superadmin" : record!.role,
        ...(account?.name && { name: account.name }),
        ...(account?.avatar && { avatar: account.avatar }),
        ...(account?.lastSignInAt && { lastSignInAt: account.lastSignInAt }),
        ...(record?.invitedAt && { invitedAt: record.invitedAt }),
        ...(record?.invitedBy && { invitedBy: record.invitedBy }),
        ...(permanent.includes(email) && { permanent: true }),
        ...(email === currentEmail && { self: true }),
        ...(!account && { pending: true }),
      };
    }),
  );
}

/** Name and photo belong to the Google account, so they are read, never stored. */
async function googleAccounts(addresses: readonly string[]) {
  const found = new Map<
    string,
    { name?: string; avatar?: string; lastSignInAt?: number }
  >();
  if (!addresses.length) return found;
  try {
    const { getAuth } = await import("firebase-admin/auth");
    const { firebaseAdminApp } = await import("./firebase-admin");
    const auth = getAuth(firebaseAdminApp());
    // getUsers accepts at most 100 identifiers per call.
    const result = await auth.getUsers(
      addresses.slice(0, 100).map((email) => ({ email })),
    );
    for (const user of result.users) {
      const email = staffEmail(user.email);
      if (!email) continue;
      const signedIn = Date.parse(user.metadata.lastSignInTime ?? "");
      found.set(email, {
        ...(user.displayName && { name: user.displayName }),
        ...(user.photoURL?.startsWith("https://") && { avatar: user.photoURL }),
        ...(Number.isFinite(signedIn) && { lastSignInAt: signedIn }),
      });
    }
  } catch (error) {
    // A listing failure must not hide who has access.
    console.error("[staff-team] accounts unavailable", error);
  }
  return found;
}

export async function inviteStaff(
  email: string,
  role: StaffRole,
  invitedBy: string,
) {
  await team()
    .doc(email)
    .create({ role, invitedAt: Date.now(), invitedBy, email });
  updateTag(teamTag);
}

export async function changeStaffRole(email: string, role: StaffRole) {
  await team().doc(email).update({ role });
  updateTag(teamTag);
}

export async function removeStaff(email: string) {
  await team().doc(email).delete();
  updateTag(teamTag);
}

export async function staffExists(email: string) {
  return (await team().doc(email).get()).exists;
}
