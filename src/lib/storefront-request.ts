import type { Locale } from "@/i18n/routing";

export async function postStorefrontJson(
  path: string,
  locale: Locale,
  body: string,
  options: { timeout: number; signal?: AbortSignal; idempotencyKey?: string },
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, options.timeout);
  try {
    const response = await fetch(path, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        "X-Storefront-Locale": locale,
        ...(options.idempotencyKey && {
          "Idempotency-Key": options.idempotencyKey,
        }),
      },
      body,
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (controller.signal.aborted) throw controller.signal.reason;
    return { response, result };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
