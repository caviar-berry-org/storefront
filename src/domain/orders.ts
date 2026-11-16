import { customerSearchTerm, type CustomerType } from "./customer-directory.ts";

export const orderTypes = ["online", "iban", "corporate"] as const;
export const orderStatuses = [
  "new",
  "viewed",
  "processing",
  "awaitingPayment",
  "packed",
  "shipped",
  "atBranch",
  "received",
  "dispute",
  "cancelled",
] as const;

export type OrderType = (typeof orderTypes)[number];
export type OrderStatus = (typeof orderStatuses)[number];

export const activeOrderStatuses = [
  "new",
  "viewed",
  "processing",
  "awaitingPayment",
  "packed",
  "dispute",
] as const satisfies readonly OrderStatus[];

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type PaymentMethod = "online" | "iban";

export type OrderSummary = {
  id: string;
  number: string;
  createdAt: number;
  customer: {
    id?: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    type: CustomerType;
  };
  type: OrderType;
  status: OrderStatus;
  /** Projected so the list can mark paid money without opening each order. */
  payment?: { status: PaymentStatus };
  totalMinor: number;
  promotion?: { code: string; percent: number };
  demo?: boolean;
};

/**
 * How a row reads at a glance. Firestore charges per document, not per field,
 * so carrying the payment state into the list costs nothing extra.
 */
export function orderLifecycle(status: OrderStatus) {
  if (status === "cancelled") return "cancelled" as const;
  if (status === "received") return "done" as const;
  return "open" as const;
}

export type OrderLine = {
  productId: string;
  variantId: string;
  name: string;
  weightGrams: number;
  quantity: number;
  unitPriceMinor: number;
  discountMinor?: number;
  batches?: { code: string; expiresOn: string; quantity: number }[];
};

export type Order = OrderSummary & {
  revision: number;
  locale?: "ua" | "en";
  inventoryState?: "reserved" | "consumed" | "released";
  accessHash?: string;
  fingerprint?: string;
  expiresAt?: number;
  mail?: { created?: string; paid?: string; shipment?: string };
  /** First-touch channel; see `src/domain/attribution.ts`. */
  attribution?: import("./attribution.ts").Attribution;
  cancellation?: {
    at: number;
    actor: string;
    refundRequired: boolean;
    trackingRemovalRequired: boolean;
    /** Cancelling kept the stock allocated; staff restore the batch by hand. */
    stockReturnRequired?: boolean;
  };
  lines: OrderLine[];
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor?: number;
  delivery?: {
    method: "branch" | "courier";
    city: string;
    cityRef?: string;
    branchRef?: string;
    street?: string;
    streetRef?: string;
    house?: string;
    apartment?: string;
    entrance?: string;
    floor?: string;
    courierComment?: string;
    destination: string;
    trackingNumber?: string;
    comment?: string;
  };
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    paidAt?: number;
    invoiceId?: string;
    pageUrl?: string;
    appUrl?: string;
    providerStatus?: string;
    modifiedAt?: number;
    invoiceState?: "creating" | "ready" | "unknown";
  };
};

export type OrderEvent = {
  id: string;
  at: number;
  actor: { uid: string; name?: string };
  action: "viewed" | "status" | "payment" | "tracking";
  from: OrderStatus;
  to: OrderStatus;
};

export type OrderFilters = {
  search: string;
  type: OrderType | "all";
  status: OrderStatus | "all" | "active";
};

export const defaultOrderFilters: OrderFilters = {
  search: "",
  type: "all",
  status: "all",
};

const orderNumberKey = (value: string) => `number:${value}`;

/**
 * Lookup keys that make an order findable by its printed number — whole, or by
 * the tail alone, which is what staff read out over the phone.
 */
export function orderNumberLookupTerms(number: string) {
  const normalized = number.trim().toLowerCase();
  return [...new Set([normalized, normalized.split("-").at(-1) ?? ""])]
    .filter((value) => value.length >= 4)
    .map(orderNumberKey);
}

/**
 * Orders are searched by contact or by number. Contact rules go first, so a
 * digits-only query stays a phone search and a number has to carry a letter or
 * a dash — which the printed number always does when pasted whole.
 */
export function orderSearchTerm(value: string) {
  const contact = customerSearchTerm(value);
  if (contact !== null) return contact;
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{3,39}$/.test(normalized)
    ? orderNumberKey(normalized)
    : null;
}

export function orderCollectionPath(environment: string | undefined) {
  if (environment !== "development" && environment !== "production")
    throw new Error("Set APP_ENV before accessing orders.");
  return `orderBooks/${environment}/orders`;
}

export const orderPageSize = 10;
export type OrderCursor = Pick<OrderSummary, "id" | "createdAt">;
export type OrderPage = { rows: OrderSummary[]; next: OrderCursor | null };
export type OrderError =
  | "invalid"
  | "unavailable"
  | "technical"
  | "session"
  | "indexRequired"
  | "conflict"
  | "missing";

export const isOrderId = (value: unknown): value is string =>
  typeof value === "string" && /^[\w-]{1,120}$/.test(value);

export const trackingNumberLimit = 40;
// Letters, digits, spaces and dashes only: the number becomes part of a
// Firestore notification document id, where "/" would split the path.
const trackingPattern = new RegExp(
  `^[\\p{L}\\d][\\p{L}\\d -]{0,${trackingNumberLimit - 1}}$`,
  "u",
);

/** Trimmed tracking number, "" to clear it, or null when the value is unusable. */
export function normalizeTrackingNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trackingPattern.test(trimmed) ? trimmed : null;
}

/** What the carrier lookup could tell us. It never blocks the save. */
export type TrackingCheck = "ok" | "unverified" | "skipped";

export type TrackingResult = {
  changed: boolean;
  check: TrackingCheck;
  /** True when this save enqueued the shipment email. */
  notified: boolean;
};

/** A Nova Poshta express waybill. Only these can be checked against the carrier. */
export const isCarrierTrackingNumber = (value: string) =>
  /^\d{14}$/.test(value.replace(/[\s-]/g, ""));

/**
 * Cancelling gives stock back only while the money has not arrived. Once an
 * order is paid the jar may already be on its way, so the inventory decision
 * becomes a human one — the same rule the admin states before it cancels, which
 * is why both sides read it from here instead of restating it.
 */
export function cancellationReleasesStock(
  order: Pick<Order, "payment" | "inventoryState">,
) {
  const unpaid =
    order.payment.status !== "paid" && order.payment.status !== "refunded";
  return (
    unpaid &&
    (order.inventoryState === "reserved" || order.inventoryState === "consumed")
  );
}

/** The order holds stock that cancelling will not return on its own. */
export function cancellationLeavesStockHeld(
  order: Pick<Order, "payment" | "inventoryState">,
) {
  return (
    !cancellationReleasesStock(order) &&
    (order.inventoryState === "reserved" || order.inventoryState === "consumed")
  );
}

export const isOrderStatus = (value: unknown): value is OrderStatus =>
  orderStatuses.some((status) => status === value);

type OrderState = Pick<Order, "type" | "status" | "payment" | "delivery">;
export type OrderChange =
  | { action: "viewed" }
  | { action: "status"; status: OrderStatus }
  | { action: "payment" };

export function canConfirmTransfer({ type, status, payment }: OrderState) {
  return (
    type !== "online" &&
    payment.method === "iban" &&
    payment.status === "pending" &&
    (status === "viewed" ||
      status === "processing" ||
      status === "awaitingPayment")
  );
}

// Tracking numbers never gate a transition: staff may run fulfilment entirely by
// hand, skip packing and still close the order. Payment remains the only gate.
export function availableOrderStatuses({
  type,
  status,
  payment,
  delivery,
}: OrderState): OrderStatus[] {
  switch (status) {
    case "viewed":
    case "processing": {
      const next: OrderStatus[] = [];
      if (status === "viewed") next.push("processing");
      if (canConfirmTransfer({ type, status, payment, delivery }))
        next.push("awaitingPayment");
      if (status === "processing" && payment.status === "paid")
        next.push("packed", "shipped");
      next.push("cancelled");
      return next;
    }
    case "awaitingPayment":
      return ["cancelled"];
    case "packed":
      return payment.status === "paid"
        ? ["shipped", "processing", "cancelled"]
        : ["processing"];
    case "shipped":
      return delivery?.method === "branch"
        ? ["atBranch", "received"]
        : ["received"];
    case "atBranch":
      return ["received"];
    case "received":
      return ["dispute"];
    case "dispute":
      return ["received"];
    default:
      return [];
  }
}

export function applyOrderChange(
  order: OrderState,
  change: OrderChange,
  at: number,
): Pick<Order, "status" | "payment"> | null {
  const { status, payment } = order;
  if (change.action === "viewed")
    return status === "new" ? { status: "viewed", payment } : null;
  if (change.action === "status")
    return availableOrderStatuses(order).includes(change.status)
      ? { status: change.status, payment }
      : null;
  if (!canConfirmTransfer(order)) return null;
  return {
    status: status === "awaitingPayment" ? "processing" : status,
    payment: { ...payment, status: "paid", paidAt: at },
  };
}
