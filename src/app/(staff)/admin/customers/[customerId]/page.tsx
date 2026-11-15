import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  CustomerBadges,
  CustomerDate,
} from "@/components/staff/customers/customer-fields";
import styles from "@/components/staff/customers/customers.module.css";
import { AdminLink } from "@/components/staff/admin-link";
import { CatalogGroup } from "@/components/staff/catalog/catalog-group";
import { adminPath } from "@/components/staff/navigation";
import { StaffFact, StaffFacts } from "@/components/staff/staff-facts";
import { StaffRecord } from "@/components/staff/staff-record";
import { isOrderId } from "@/domain/orders";
import { staffCopy } from "@/i18n/staff-uk";
import {
  isCustomerId,
  readCustomerDetail,
  type CustomerActivityCursor,
} from "@/lib/server/customer-directory";
import { requireStaffSession } from "@/lib/server/staff-session";

const copy = staffCopy.customerDirectory;
const orderTotal = new Intl.NumberFormat("uk-UA", {
  style: "currency",
  currency: "UAH",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const metadata: Metadata = {
  title: `${copy.profile} | ${staffCopy.brand}`,
};

function historyHref(path: string, cursor: CustomerActivityCursor) {
  const query = new URLSearchParams({
    direction: cursor.direction,
    event: cursor.id,
    at: String(cursor.occurredAt),
  });
  return `${path}?${query}#customer-history`;
}

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ direction?: string; event?: string; at?: string }>;
}) {
  await requireStaffSession();
  const { customerId } = await params;
  if (!isCustomerId(customerId)) notFound();
  const path = adminPath(`customers/${customerId}`);
  const { direction, event, at } = await searchParams;
  const occurredAt = Number(at);
  const cursor =
    (direction === "older" || direction === "newer") &&
    typeof event === "string" &&
    event.length > 0 &&
    !event.includes("/") &&
    typeof at === "string" &&
    /^\d+$/.test(at) &&
    Number.isSafeInteger(occurredAt)
      ? ({ direction, id: event, occurredAt } as const)
      : null;
  const detail = await readCustomerDetail(customerId, cursor);
  if (!detail) notFound();

  const { customer, activity, newer, older } = detail;
  if (cursor && !activity.length) redirect(`${path}#customer-history`);
  return (
    <StaffRecord
      title={customer.name || copy.profile}
      back={{ href: adminPath("customers"), label: copy.back }}
      badges={<CustomerBadges customer={customer} />}
    >
      <div className={styles.recordStack}>
        <CatalogGroup title={copy.contacts}>
          <StaffFacts>
            <StaffFact
              label={copy.phone}
              weight="strong"
              copy={customer.phone ?? undefined}
            >
              {customer.phone || copy.noValue}
            </StaffFact>
            <StaffFact
              label="Email"
              weight="normal"
              copy={customer.email ?? undefined}
            >
              {customer.email || copy.noValue}
            </StaffFact>
            <StaffFact label={copy.orders} weight="strong">
              {customer.orderCount || copy.noOrders}
            </StaffFact>
            <StaffFact label={copy.segments} weight="dim">
              {copy.types[customer.type]}
            </StaffFact>
            <StaffFact label={copy.lastInteraction} weight="dim">
              <CustomerDate value={customer.lastInteractionAt} />
            </StaffFact>
          </StaffFacts>
        </CatalogGroup>

        <section id="customer-history">
          <CatalogGroup title={copy.history} collapsible initiallyOpen>
            {activity.length ? (
              <ul className={styles.history}>
                {activity.map((event) => (
                  <li key={event.id}>
                    <div className={styles.eventKind}>
                      <strong>{copy.kinds[event.kind]}</strong>
                      {event.subject && (
                        <span>
                          {event.kind === "order" &&
                          isOrderId(event.orderId) ? (
                            <AdminLink
                              href={adminPath(`orders/${event.orderId}`)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {event.subject}
                            </AdminLink>
                          ) : (
                            event.subject
                          )}
                        </span>
                      )}
                    </div>
                    <div className={styles.eventMeta}>
                      {event.kind === "order" &&
                        event.totalMinor !== undefined &&
                        Number.isSafeInteger(event.totalMinor) &&
                        event.totalMinor >= 0 && (
                          <strong>
                            {orderTotal.format(event.totalMinor / 100)}
                          </strong>
                        )}
                      <CustomerDate value={event.occurredAt} />
                    </div>
                    {event.kind === "order" &&
                      Boolean(event.orderLines?.length) && (
                        <details className={styles.orderDetails}>
                          <summary>{copy.orderDetails}</summary>
                          <dl>
                            {event.orderLines?.map((line, index) => (
                              <div key={index}>
                                <dt>
                                  {line.name} · {line.weightGrams}{" "}
                                  {copy.orderWeight}
                                </dt>
                                <dd>
                                  {line.quantity} {copy.orderUnit} ×{" "}
                                  {orderTotal.format(line.unitPriceMinor / 100)}
                                  {" = "}
                                  <strong>
                                    {orderTotal.format(
                                      (line.quantity * line.unitPriceMinor) /
                                        100,
                                    )}
                                  </strong>
                                </dd>
                                <dd className={styles.muted}>
                                  {copy.orderBatch} {line.batchCode} ·{" "}
                                  {copy.orderExpiry}{" "}
                                  <time dateTime={line.expiresOn}>
                                    {line.expiresOn
                                      .split("-")
                                      .reverse()
                                      .join(".")}
                                  </time>
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.muted}>{copy.historyEmpty}</p>
            )}
            {(newer || older) && (
              <nav
                className={styles.historyPages}
                aria-label={copy.historyPagination}
              >
                {newer && (
                  <>
                    <AdminLink href={`${path}#customer-history`}>
                      {copy.historyLatest}
                    </AdminLink>
                    <AdminLink href={historyHref(path, newer)}>
                      {copy.historyNewer}
                    </AdminLink>
                  </>
                )}
                {older && (
                  <AdminLink href={historyHref(path, older)}>
                    {copy.historyOlder}
                  </AdminLink>
                )}
              </nav>
            )}
          </CatalogGroup>
        </section>
      </div>
    </StaffRecord>
  );
}
