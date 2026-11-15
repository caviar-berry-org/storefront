import "server-only";

import type { OrderError } from "@/domain/orders";
import { indexRequired } from "../observability";

export function orderFailure(
  operation: "list" | "detail" | "count" | "update" | "refresh",
  error: unknown,
): OrderError {
  const raw = error instanceof Error && "code" in error ? error.code : null;
  const code =
    typeof raw === "number" ||
    (typeof raw === "string" && /^[a-z][a-z0-9_-]{0,47}$/i.test(raw))
      ? raw
      : null;
  const missingIndex = indexRequired(error);
  console.error("[orders]", { operation, code, missingIndex });
  if (missingIndex) return "indexRequired";
  if (
    [
      4,
      8,
      14,
      "deadline-exceeded",
      "resource-exhausted",
      "unavailable",
      "DEADLINE_EXCEEDED",
      "RESOURCE_EXHAUSTED",
      "UNAVAILABLE",
      "ENOTFOUND",
      "ECONNRESET",
      "ETIMEDOUT",
    ].includes(code ?? "")
  )
    return "unavailable";
  return "technical";
}
