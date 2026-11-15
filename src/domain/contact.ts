export function isEmail(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
  );
}

export const MAX_PHONE_LENGTH = 40;

function phoneDigits(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > MAX_PHONE_LENGTH ||
    !/^\+?[\d\s().-]+$/.test(value.trim())
  )
    return null;
  return value.replace(/\D/g, "");
}

export function normalizeUkrainianPhone(value: unknown) {
  const digits = phoneDigits(value);
  if (!digits) return null;
  if (
    typeof value === "string" &&
    value.trim().startsWith("+") &&
    !digits.startsWith("380")
  )
    return null;
  const national = digits.replace(/^(?:00)?380(?=[1-9]\d{8}$)/, "");
  const number = national.replace(/^0(?=[1-9]\d{8}$)/, "");
  return /^[1-9]\d{8}$/.test(number) ? `+380${number}` : null;
}

export function normalizeInquiryPhone(value: unknown) {
  const digits = phoneDigits(value);
  if (!digits || typeof value !== "string") return null;
  const international =
    value.trim().startsWith("+") || value.trim().startsWith("00");
  const number = international ? digits.replace(/^00/, "") : digits;
  if (!/^\d{7,15}$/.test(number)) return null;
  // A local number does not identify its country reliably.
  return international ? `+${number}` : number;
}
