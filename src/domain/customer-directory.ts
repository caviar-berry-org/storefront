import { isEmail } from "./contact.ts";

export const customerTypes = ["retail", "corporate"] as const;
export const customerActivityKinds = [
  "order",
  "promotion",
  "corporate",
  "restock",
  "contact",
] as const;

export type CustomerType = (typeof customerTypes)[number];
export type CustomerActivityKind = (typeof customerActivityKinds)[number];
export type CustomerSummary = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  type: CustomerType;
  orderCount: number;
  sources: Exclude<CustomerActivityKind, "order">[];
  lastInteractionAt: number;
  demo?: boolean;
};

export type OrderLineSnapshot = {
  productId: string;
  variantId: string;
  name: string;
  weightGrams: number;
  quantity: number;
  unitPriceMinor: number;
  batchCode: string;
  expiresOn: string;
};

export type CustomerActivity = {
  id: string;
  kind: CustomerActivityKind;
  occurredAt: number;
  subject: string | null;
  totalMinor?: number;
  orderLines?: OrderLineSnapshot[];
  orderId?: string;
  demo?: boolean;
};

export type CustomerFilters = { search: string; types: CustomerType[] };
export type CustomerCursor = Pick<CustomerSummary, "id" | "lastInteractionAt">;
export type CustomerQueryError =
  "invalid" | "unavailable" | "session" | "indexRequired";

export type CustomerPage = {
  rows: CustomerSummary[];
  next: CustomerCursor | null;
};

export const customerPageSize = 20;

const emailKey = (email: string) => `email:${email.trim().toLowerCase()}`;

function phoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  return /^380\d{9}$/.test(digits) ? digits.slice(2) : digits;
}

export function customerSearchTerm(value: string) {
  const search = value.trim();
  if (!search) return "";
  if (isEmail(search)) return emailKey(search);
  if (!/^[\d+() .-]{4,40}$/.test(search)) return null;
  const digits = phoneDigits(search);
  return digits.length >= 4 && digits.length <= 15 ? `phone:${digits}` : null;
}

export function customerLookupKey(type: CustomerType | "all", term: string) {
  return `${type}:${term}`;
}

export function contactLookupTerms(
  customer: Pick<CustomerSummary, "email" | "phone">,
) {
  const terms = new Set<string>();
  if (customer.email && isEmail(customer.email))
    terms.add(emailKey(customer.email));
  if (customer.phone) {
    const stored = customer.phone.replace(/\D/g, "");
    const local = phoneDigits(stored);
    const international = /^0\d{9}$/.test(local) ? `38${local}` : stored;
    for (const digits of new Set([local, international])) {
      if (digits.length > 15) continue;
      for (let start = 0; start <= digits.length - 4; start++) {
        for (let end = start + 4; end <= digits.length; end++) {
          terms.add(`phone:${digits.slice(start, end)}`);
        }
      }
    }
  }
  return [...terms];
}

export function customerLookupKeys(
  customer: Pick<CustomerSummary, "type" | "email" | "phone">,
) {
  return ["", ...contactLookupTerms(customer)].flatMap((term) => [
    customerLookupKey("all", term),
    customerLookupKey(customer.type, term),
  ]);
}
