import { isEmail, normalizeInquiryPhone } from "./contact.ts";
export type InquiryKind = "gift" | "write" | "notify";
export interface InquiryInput {
  name: string;
  contact: string;
  date: string;
  comment: string;
  consent: boolean;
}
export type InquiryErrors = Partial<
  Record<
    keyof InquiryInput,
    | "name"
    | "notifyName"
    | "writeName"
    | "phone"
    | "email"
    | "contact"
    | "comment"
    | "message"
    | "consent"
    | "date"
    | "dateFormat"
  >
>;
export function validateInquiry(
  data: Partial<Record<keyof InquiryInput, unknown>>,
  kind: InquiryKind,
  today: string,
): InquiryErrors {
  const errors: InquiryErrors = {};
  if (
    typeof data.name !== "string" ||
    data.name.trim().length < 2 ||
    data.name.length > 160
  )
    errors.name =
      kind === "notify"
        ? "notifyName"
        : kind === "write"
          ? "writeName"
          : "name";
  if (kind === "notify") {
    if (!isNotificationEmail(data.contact)) errors.contact = "email";
  } else if (
    !normalizeInquiryPhone(data.contact) &&
    (kind === "gift" || !isEmail(data.contact))
  ) {
    errors.contact = kind === "gift" ? "phone" : "contact";
  }
  const comment = data.comment === undefined ? "" : data.comment;
  if (typeof comment !== "string" || comment.length > 1000)
    errors.comment = "comment";
  else if (kind === "write" && comment.trim().length < 3)
    errors.comment = "message";
  const date = data.date === undefined ? "" : data.date;
  if (
    typeof date !== "string" ||
    (date !== "" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date))
  )
    errors.date = "dateFormat";
  else if (date !== "" && date <= today) errors.date = "date";
  if (data.consent !== true) errors.consent = "consent";
  return errors;
}

function isNotificationEmail(value: unknown): boolean {
  if (typeof value !== "string" || !isEmail(value)) return false;
  const [local, domain] = value.trim().split("@") as [string, string];
  return (
    local.length <= 64 &&
    /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/i.test(local) &&
    !local.startsWith(".") &&
    !local.endsWith(".") &&
    !local.includes("..") &&
    domain
      .split(".")
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
  );
}

export function kyivDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function nextCalendarDate(day: string) {
  const date = new Date(day);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
