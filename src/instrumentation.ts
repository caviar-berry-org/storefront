import type { Instrumentation } from "next";

/**
 * A POST whose body is not what its content type claims. Scanners probing for
 * PHP upload holes send `multipart/form-data` with no boundary; Next fails to
 * decode it as a Server Action payload before any of our code runs. Nothing is
 * broken and nothing is reachable, so it is noise that would bury a real crash.
 * Our own forms cannot produce it — the browser always writes the boundary.
 * The platform log still keeps every one of them.
 */
function unreadableBody(error: unknown) {
  if (!(error instanceof Error)) return false;
  if (/^Failed to parse body as (FormData|URLSearchParams)/.test(error.message))
    return true;
  return error.cause instanceof Error && /boundary/i.test(error.cause.message);
}

/**
 * Unhandled server errors. `logCommerce` covers the failures we predicted and
 * gave names to; this covers the ones we did not, which are exactly the ones
 * worth being told about.
 *
 * Only the path and the message travel: a stack frame can carry whatever a
 * customer typed into the form that crashed, and the chat is not the place for
 * it. The full trace stays in the platform log.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (unreadableBody(error)) return;
  // Imported lazily so the Edge runtime never pulls the server-only sink, and a
  // broken import can never take down error reporting itself.
  try {
    const { notify } = await import("./lib/server/notify/telegram");
    const message = error instanceof Error ? error.message : String(error);
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest: unknown }).digest)
        : undefined;
    await notify(
      "crash",
      context.routePath || request.path,
      {
        Запит: `${request.method} ${request.path.split("?")[0]}`,
        Де: context.routeType,
        Помилка: message,
        ...(digest && { Відбиток: digest }),
      },
      // One looping route must not post on every request; the digest groups
      // identical React errors, the path groups the rest.
      { throttleKey: digest ?? context.routePath ?? request.path },
    );
  } catch {
    /* Reporting a crash must never cause one. */
  }
};
