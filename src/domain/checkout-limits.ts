/**
 * Bank-transfer and company-invoice orders consume stock and mail the buyer the
 * moment they are accepted, with no payment behind them. These limits bound what
 * an unpaid order can cost the shop instead of trying to tell bots from people:
 * a script that rotates addresses and solves any challenge still runs into them.
 *
 * Card payments are untouched. They only reserve stock until the invoice expires
 * and send nothing before a verified payment, so they are the fallback offered
 * whenever these limits refuse an order.
 *
 * The numbers are placeholders for the client to confirm; staff free capacity by
 * marking an order paid or cancelling it, so a legitimate backlog clears itself.
 */
export const unpaidLimits = {
  /** Unpaid orders still holding stock across the whole shop. */
  outstandingOrders: 15,
  /** Their combined value, in kopiyky (300 000 UAH). */
  outstandingMinor: 30_000_000,
  /** Unpaid orders one email or one phone may place per Kyiv calendar day. */
  perContactDaily: 3,
} as const;

export type UnpaidOutstanding = { orders: number; totalMinor: number };

/** Sums unpaid orders that still hold stock; a cancelled one holds nothing. */
export function unpaidOutstanding(
  rows: readonly { status?: unknown; totalMinor?: unknown }[],
): UnpaidOutstanding {
  return rows.reduce<UnpaidOutstanding>(
    (sum, row) =>
      row.status === "cancelled"
        ? sum
        : {
            orders: sum.orders + 1,
            totalMinor: sum.totalMinor + (Number(row.totalMinor) || 0),
          },
    { orders: 0, totalMinor: 0 },
  );
}

/** Whether one more unpaid order of `totalMinor` still fits under the limits. */
export function unpaidCapacity(
  outstanding: UnpaidOutstanding,
  totalMinor: number,
) {
  return (
    outstanding.orders + 1 <= unpaidLimits.outstandingOrders &&
    outstanding.totalMinor + totalMinor <= unpaidLimits.outstandingMinor
  );
}

/**
 * One mailbox, however it is spelled: case, a `+tag` and, for Gmail, dots and
 * the googlemail alias all reach the same inbox. Used only to count orders,
 * never stored or used to send mail.
 */
export function contactIdentity(email: string) {
  const address = email.trim().toLowerCase();
  const at = address.lastIndexOf("@");
  if (at < 1) return address;
  const domain = address.slice(at + 1);
  const host = domain === "googlemail.com" ? "gmail.com" : domain;
  let name = address.slice(0, at).split("+")[0]!;
  if (host === "gmail.com") name = name.replaceAll(".", "");
  return `${name || address.slice(0, at)}@${host}`;
}
