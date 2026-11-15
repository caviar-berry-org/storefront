/** Staff roles, in descending order of authority. */
export const staffRoles = ["superadmin", "admin", "manager"] as const;
export type StaffRole = (typeof staffRoles)[number];

export const isStaffRole = (value: unknown): value is StaffRole =>
  staffRoles.some((role) => role === value);

/**
 * Catalogue and promotions are closed to managers. Both the server gate and the
 * sidebar read this, so a hidden section and a refused page can never disagree.
 */
export const managesCatalog = (role: StaffRole) => role !== "manager";

export type StaffMember = {
  /** Lower-cased Google account address; also the document id. */
  email: string;
  role: StaffRole;
  /** Name and avatar come from the Google account, once the person signs in. */
  name?: string;
  avatar?: string;
  invitedAt?: number;
  invitedBy?: string;
  lastSignInAt?: number;
  /** Granted by `ADMIN_ALLOWED_EMAILS`; cannot be edited from the panel. */
  permanent?: boolean;
  /** The signed-in member reading the list. */
  self?: boolean;
  /** The person has not signed in yet, so Google data is unknown. */
  pending?: boolean;
};

export type StaffTeamError =
  | "invalid"
  | "duplicate"
  | "permanent"
  | "self"
  | "denied"
  | "missing"
  | "unavailable";

/**
 * Google sign-in is the only way in, so an invite is just an address on the
 * allowlist. Kept deliberately strict: this value becomes a Firestore
 * document id and decides who can open the panel.
 */
export function staffEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 &&
    /^[a-z\d][a-z\d._%+-]*@[a-z\d][a-z\d.-]*\.[a-z]{2,}$/.test(email) &&
    !email.includes("..")
    ? email
    : null;
}

/**
 * Scoped by environment like the order book: a development invite must never
 * grant access to production, even if the two ever shared one project.
 */
export function staffTeamPath(environment: string | undefined) {
  if (environment !== "development" && environment !== "production")
    throw new Error("Set APP_ENV before reading the staff team.");
  return `staffTeams/${environment}/members`;
}

/** Only a superadmin changes who has access. */
export function canManageTeam(role: StaffRole) {
  return role === "superadmin";
}

export function sortStaff(members: readonly StaffMember[]) {
  const rank = (member: StaffMember) => staffRoles.indexOf(member.role);
  return [...members].sort(
    (a, b) => rank(a) - rank(b) || a.email.localeCompare(b.email),
  );
}
