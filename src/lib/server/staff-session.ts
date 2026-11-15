import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { StaffRole } from "@/domain/staff-team";
import { permanentStaff, staffRoleFor } from "./staff-team";

/**
 * A working day was too short: staff were re-authenticating daily, and the mail
 * "open in admin" links always landed on the dashboard after that re-login.
 * A week is safe here because every request re-checks the cookie against Firebase
 * with `checkRevoked`, so signing out or disabling an account ends the session at
 * once — the cookie's own lifetime is not the only control. Firebase caps this at
 * 14 days. Keep it in sync with the `maxAge` set in /api/auth/session.
 */
export const sessionDuration = 7 * 24 * 60 * 60 * 1000;
const freshSignIn = 5 * 60;
const localClockSkew = 30;

export function staffSettings() {
  const url = URL.parse(process.env.SITE_URL ?? "");
  const secure = url?.protocol === "https:";
  const local =
    url?.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    !url ||
    url.href !== `${url.origin}/` ||
    (!secure &&
      (!local || process.env.APP_ENV === "production" || process.env.VERCEL))
  )
    return null;

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const apiKey = process.env.FIREBASE_WEB_API_KEY?.trim();
  const authDomain = process.env.FIREBASE_AUTH_DOMAIN?.trim();
  // The env list only bootstraps superadmins; the full team lives in Firestore.
  if (
    !projectId ||
    !apiKey ||
    !authDomain ||
    !permanentStaff().length ||
    !process.env.FIREBASE_CLIENT_EMAIL?.trim() ||
    !process.env.FIREBASE_PRIVATE_KEY?.trim()
  )
    return null;

  return {
    origin: url.origin,
    web: { projectId, apiKey, authDomain },
    cookieName: secure ? "__Host-caviar_session" : "caviar_dev_session",
    cookieOptions: {
      httpOnly: true,
      sameSite: "strict" as const,
      secure,
      path: "/",
    },
  };
}

type StaffSettings = NonNullable<ReturnType<typeof staffSettings>>;
export type StaffSession = DecodedIdToken & { role: StaffRole };

async function staffAuth() {
  // Load the SDK inside the request so an initialization failure reaches its error boundary.
  const [{ getAuth }, { firebaseAdminApp }] = await Promise.all([
    import("firebase-admin/auth"),
    import("./firebase-admin"),
  ]);
  return getAuth(firebaseAdminApp());
}

/**
 * Google is the only identity provider, so the account itself is the credential.
 * The role comes from the team list rather than a custom claim: a claim would
 * stay stale in an already-issued session cookie, while a removal here takes
 * effect on the next request.
 */
async function staffAccess(
  claims: DecodedIdToken,
): Promise<StaffSession | null> {
  if (
    claims.firebase?.sign_in_provider !== "google.com" ||
    claims.email_verified !== true
  )
    return null;
  const role = await staffRoleFor(claims.email);
  return role ? { ...claims, role } : null;
}

export async function createStaffSession(
  token: string,
  settings: StaffSettings,
): Promise<{ denied: string } | { session: string }> {
  const auth = await staffAuth();
  const claims = await auth.verifyIdToken(token, true);
  const age = Math.floor(Date.now() / 1000) - claims.auth_time;
  if (!(await staffAccess(claims))) return { denied: "account-not-allowed" };
  // Local HTTP may run on a clock slightly behind Firebase.
  const clockSkew = settings.cookieOptions.secure ? 0 : localClockSkew;
  if (age < -clockSkew) return { denied: `auth-time-in-future (${-age}s)` };
  if (!Number.isFinite(age) || age > freshSignIn)
    return { denied: "sign-in-not-recent" };
  return {
    session: await auth.createSessionCookie(token, {
      expiresIn: sessionDuration,
    }),
  };
}

export const getStaffSession = cache(async () => {
  const settings = staffSettings();
  if (!settings) return null;
  const value = (await cookies()).get(settings.cookieName)?.value;
  if (!value) return null;

  const auth = await staffAuth();
  try {
    return await staffAccess(await auth.verifySessionCookie(value, true));
  } catch {
    return null;
  }
});

export async function requireStaffSession() {
  const session = await getStaffSession();
  if (!session) redirect("/sign-in");
  return session;
}
