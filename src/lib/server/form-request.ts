import {
  getTranslator,
  type Translator,
  type MessageKey,
} from "../../i18n/index.ts";

import { defaultLocale, isLocale } from "../../i18n/routing.ts";
import { clientAddress, spendRequest } from "./rate-limit.ts";

export function formTranslator(request: Request) {
  const locale = request.headers.get("X-Storefront-Locale") ?? undefined;
  return getTranslator(isLocale(locale) ? locale : defaultLocale);
}

const maxBodyBytes = 32 * 1024;
type RequestFailure = { status: 400 | 413 | 415; message: MessageKey };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function readFormRequest(
  request: Request,
): Promise<{ data: Record<string, unknown> } | RequestFailure> {
  const mediaType = request.headers.get("content-type")?.split(";")[0];
  if (mediaType?.trim().toLowerCase() !== "application/json")
    return { status: 415, message: "forms.invalidFormat" };

  const invalid = { status: 400, message: "forms.invalidRequest" } as const;
  const reader = request.body?.getReader();
  if (!reader) return invalid;

  try {
    let bytes = 0;
    let body = "";
    const decoder = new TextDecoder("utf-8", { fatal: true });
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBodyBytes) {
        await reader.cancel();
        return { status: 413, message: "forms.tooLarge" };
      }
      body += decoder.decode(value, { stream: true });
    }
    const data: unknown = JSON.parse(body + decoder.decode());
    return isRecord(data) ? { data } : invalid;
  } catch {
    return invalid;
  } finally {
    reader.releaseLock();
  }
}

export function formError(
  t: Translator,
  status: number,
  code: string,
  message: MessageKey,
  errors?: Record<string, string>,
) {
  return Response.json(
    { code, message: t(message), ...(errors && { errors }) },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * The two rejections a public form endpoint can make before reading its body:
 * a cross-site request and a client over its budget. Both used to run after
 * `readFormRequest`, which meant a flood still paid to parse every payload.
 *
 * `Origin` is the right header for these routes because they are all POST;
 * browsers omit it on a same-origin GET, so a GET endpoint must read
 * `Sec-Fetch-Site` instead (see `api/delivery`). The honeypot stays at the call
 * site — it is the one guard that genuinely needs the body.
 */
export function formGuard(
  request: Request,
  t: Translator,
  scope: string,
  budget: { limit: number; windowMs: number },
) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return formError(t, 400, "INVALID_REQUEST", "forms.invalidRequest");
  const retryAfter = spendRequest(`${scope}:${clientAddress(request)}`, budget);
  if (retryAfter === null) return null;
  const response = formError(t, 429, "RATE_LIMITED", "newsletter.rateLimited");
  response.headers.set("Retry-After", String(retryAfter));
  return response;
}
