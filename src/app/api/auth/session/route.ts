import { NextResponse } from "next/server";
import { isRecord, readFormRequest } from "@/lib/server/form-request";
import {
  createStaffSession,
  sessionDuration,
  staffSettings,
} from "@/lib/server/staff-session";

const deniedCodes = new Set([
  "auth/argument-error",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/invalid-id-token",
  "auth/user-disabled",
  "auth/user-not-found",
]);

function reply(status: number) {
  return new NextResponse(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function failed(status: number, reason: string) {
  if (process.env.NODE_ENV === "development")
    console.warn(`[staff-auth] Session creation failed: ${reason}`);
  return reply(status);
}

export async function POST(request: Request) {
  const settings = staffSettings();
  if (!settings) return failed(503, "configuration");
  if (request.headers.get("origin") !== settings.origin)
    return failed(403, "origin-mismatch");

  const input = await readFormRequest(request);
  if ("status" in input) return reply(input.status);

  const token = input.data.idToken;
  if (typeof token !== "string" || !token.trim() || token.length > 12000)
    return reply(400);

  try {
    const result = await createStaffSession(token, settings);
    if ("denied" in result) return failed(403, result.denied);
    const response = reply(204);
    response.cookies.set(settings.cookieName, result.session, {
      ...settings.cookieOptions,
      maxAge: sessionDuration / 1000,
    });
    return response;
  } catch (error) {
    const code = isRecord(error) ? error.code : undefined;
    return typeof code === "string" && deniedCodes.has(code)
      ? failed(403, code)
      : failed(503, "firebase-unavailable");
  }
}
