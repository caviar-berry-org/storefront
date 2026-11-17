import styles from "./status-badge.module.css";
import type { InquiryStatus } from "@/domain/staff-inquiries";
import type { OrderStatus, PaymentStatus } from "@/domain/orders";

/** Visual weight of a status, shared by every staff module. */
export type Tone = "new" | "active" | "transit" | "done" | "problem" | "closed";

const orderTones: Record<OrderStatus, Tone> = {
  new: "new",
  viewed: "active",
  processing: "active",
  awaitingPayment: "active",
  packed: "transit",
  shipped: "transit",
  atBranch: "transit",
  received: "done",
  dispute: "problem",
  cancelled: "closed",
};

const inquiryTones: Record<InquiryStatus, Tone> = {
  new: "new",
  viewed: "active",
  working: "active",
  processed: "done",
  cancelled: "closed",
};

const paymentTones: Record<PaymentStatus, Tone> = {
  pending: "active",
  paid: "done",
  failed: "problem",
  refunded: "closed",
};

/*
 * A promo code's life is a funnel, not an attention scale: the lightest gold is
 * an untouched code, the strongest one is a code that actually converted.
 */
const promoUsageTones: Record<string, Tone> = {
  active: "transit",
  reserved: "active",
  used: "new",
  expired: "closed",
};

/** Mail delivery, shared by order and promotion notifications. */
const mailTones: Record<string, Tone> = {
  pending: "active",
  sending: "active",
  accepted: "done",
  failed: "problem",
  unknown: "problem",
  // Parked on purpose, like a hidden catalogue record: nothing to chase.
  suppressed: "closed",
};

/** A draft still owes work, a hidden record was parked on purpose. */
const catalogTones: Record<string, Tone> = {
  published: "done",
  hidden: "closed",
  draft: "new",
};

export type StatusKind =
  "order" | "inquiry" | "payment" | "catalog" | "promoUsage" | "mail";

const scales: Record<StatusKind, Record<string, Tone>> = {
  order: orderTones,
  inquiry: inquiryTones,
  payment: paymentTones,
  catalog: catalogTones,
  promoUsage: promoUsageTones,
  mail: mailTones,
};

export function statusTone(kind: StatusKind, value: string): Tone {
  return scales[kind][value] ?? "done";
}

/**
 * Either name a status (`kind` + `value`) and let the scale resolve its weight, or
 * pass a `tone` directly for conditions that are not a stored status — a derived
 * warning, for example. Nothing else may invent its own badge colours.
 */
type StatusBadgeProps = {
  children: React.ReactNode;
  className?: string;
} & ({ kind: StatusKind; value: string } | { tone: Tone });

export function StatusBadge(props: StatusBadgeProps) {
  const { children, className } = props;
  const tone =
    "tone" in props ? props.tone : statusTone(props.kind, props.value);
  return (
    <span
      className={`${styles.badge}${className ? ` ${className}` : ""}`}
      data-tone={tone}
    >
      {children}
    </span>
  );
}
