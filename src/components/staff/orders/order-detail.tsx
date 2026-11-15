import { isOrderId, type Order, type OrderEvent } from "@/domain/orders";
import { ordersCopy as copy } from "@/i18n/orders-staff-uk";
import { staffCopy } from "@/i18n/staff-uk";
import { formatMoney } from "@/lib/format-money";
import { AdminLink } from "../admin-link";
import { CatalogGroup } from "../catalog/catalog-group";
import { CustomerDate } from "../customers/customer-fields";
import { OrderControls } from "./order-controls";
import { OrderItems } from "./order-items";
import { OrderBadges } from "./order-table";
import { OrderMail, OrderPaymentSync, OrderShipment } from "./order-operations";
import { StaffCopyButton } from "../staff-copy";
import { StaffFact, StaffFacts } from "../staff-facts";
import { StaffRecord } from "../staff-record";
import { StatusBadge } from "../status-badge";
import styles from "./orders.module.css";

/** One pasteable block for the carrier cabinet: who, where, which phone. */
function shippingLabel(order: Order) {
  const { customer, delivery } = order;
  return [
    customer.name,
    customer.phone,
    delivery && `${delivery.city}, ${delivery.destination}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function OrderDetail({
  order,
  events,
  canOpenInventory,
  mailEnabled,
}: {
  order: Order;
  events: OrderEvent[];
  canOpenInventory: boolean;
  mailEnabled: boolean;
}) {
  const { customer, delivery, payment, cancellation } = order;
  const address = delivery && `${delivery.city}, ${delivery.destination}`;
  const label = shippingLabel(order);
  const operated = {
    id: order.id,
    revision: order.revision,
    status: order.status,
    payment,
    customer,
    ...(delivery && { delivery }),
    ...(order.mail && { mail: order.mail }),
  };

  return (
    <StaffRecord
      title={order.number}
      back={{ href: "/admin/orders", label: copy.back }}
      badges={<OrderBadges order={order} />}
    >
      <div className={styles.detailStack}>
        <CatalogGroup title={copy.handling} help={copy.handlingHelp}>
          <OrderControls
            id={order.id}
            type={order.type}
            revision={order.revision}
            status={order.status}
            payment={payment}
            delivery={delivery}
            key={order.id}
          />
        </CatalogGroup>

        {cancellation &&
          (cancellation.refundRequired ||
            cancellation.trackingRemovalRequired) && (
            <CatalogGroup title={copy.cancellation}>
              <ul className={styles.followUps}>
                {cancellation.refundRequired && <li>{copy.refundRequired}</li>}
                {cancellation.trackingRemovalRequired && (
                  <li>{copy.trackingRemovalRequired}</li>
                )}
              </ul>
            </CatalogGroup>
          )}

        <CatalogGroup title={copy.summary}>
          <StaffFacts>
            <StaffFact
              label={copy.amountDue}
              weight="lead"
              copy={String(order.totalMinor / 100)}
            >
              {formatMoney(order.totalMinor, "ua")}
            </StaffFact>
            <StaffFact label={copy.payment} weight="strong">
              <StatusBadge kind="payment" value={payment.status}>
                {copy.paymentStates[payment.status]}
              </StatusBadge>
              <span className={styles.subValue}>
                {copy.methods[payment.method]}
              </span>
            </StaffFact>
            <StaffFact label={copy.date} weight="dim">
              <CustomerDate value={order.createdAt} />
            </StaffFact>
            {payment.paidAt !== undefined && (
              <StaffFact label={copy.paidAt} weight="dim">
                <CustomerDate value={payment.paidAt} />
              </StaffFact>
            )}
            {order.promotion && (
              <StaffFact
                label={copy.promo}
                weight="dim"
                copy={order.promotion.code}
              >
                {order.promotion.code} · {order.promotion.percent}%
              </StaffFact>
            )}
            {payment.invoiceId && (
              <StaffFact
                label={copy.invoice}
                weight="dim"
                copy={payment.invoiceId}
              >
                {payment.invoiceId}
              </StaffFact>
            )}
            {cancellation && (
              <StaffFact label={copy.cancelledAt} weight="dim">
                <CustomerDate value={cancellation.at} />
              </StaffFact>
            )}
          </StaffFacts>
        </CatalogGroup>

        <CatalogGroup title={copy.recipient}>
          <StaffFacts>
            <StaffFact
              label={copy.recipientName}
              weight="strong"
              copy={customer.name ?? undefined}
            >
              {customer.name || copy.none}
            </StaffFact>
            <StaffFact
              label={copy.phone}
              weight="strong"
              copy={customer.phone ?? undefined}
            >
              {customer.phone || copy.none}
            </StaffFact>
            <StaffFact
              label="Email"
              weight="normal"
              copy={customer.email ?? undefined}
            >
              {customer.email || copy.none}
            </StaffFact>
            {address ? (
              <StaffFact
                label={copy.address}
                weight="strong"
                copy={address}
                wide
              >
                {address}
              </StaffFact>
            ) : (
              <StaffFact label={copy.address} weight="dim" wide>
                {copy.noDelivery}
              </StaffFact>
            )}
            {delivery && (
              <StaffFact label={copy.method} weight="dim">
                {copy[delivery.method]}
              </StaffFact>
            )}
            {delivery?.trackingNumber && (
              <StaffFact
                label={copy.tracking}
                weight="strong"
                copy={delivery.trackingNumber}
              >
                {delivery.trackingNumber}
              </StaffFact>
            )}
            <StaffFact label={copy.segment} weight="dim">
              {staffCopy.customerDirectory.types[customer.type]}
            </StaffFact>
            {delivery?.courierComment && (
              <StaffFact label={copy.courierComment} weight="normal" wide>
                {delivery.courierComment}
              </StaffFact>
            )}
            {delivery?.comment && (
              <StaffFact label={copy.comment} weight="normal" wide>
                {delivery.comment}
              </StaffFact>
            )}
          </StaffFacts>
          <div className={styles.jumps}>
            {label && (
              <StaffCopyButton
                value={label}
                label={copy.shippingLabel}
                variant="action"
              />
            )}
            {isOrderId(customer.id) && (
              <AdminLink
                href={`/admin/customers/${customer.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {copy.openCustomer}
              </AdminLink>
            )}
          </div>
        </CatalogGroup>

        <CatalogGroup title={copy.items} collapsible initiallyOpen>
          <OrderItems order={order} canOpenInventory={canOpenInventory} />
        </CatalogGroup>

        {delivery && (
          <CatalogGroup
            title={copy.shipmentTitle}
            help={copy.trackingHelp}
            collapsible
          >
            <OrderShipment order={operated} mailEnabled={mailEnabled} />
          </CatalogGroup>
        )}

        {payment.method === "online" && (
          <CatalogGroup
            title={copy.paymentSync}
            help={copy.paymentSyncHelp}
            collapsible
          >
            <OrderPaymentSync order={operated} />
          </CatalogGroup>
        )}

        <CatalogGroup title={copy.mailTitle} help={copy.mailHelp} collapsible>
          <OrderMail order={operated} />
        </CatalogGroup>

        <CatalogGroup title={copy.history} help={copy.historyHelp} collapsible>
          {events.length ? (
            <ul className={styles.events}>
              {events.map((event) => (
                // Every cell is rendered so the four columns stay aligned.
                <li key={event.id}>
                  <strong>{copy.actions[event.action]}</strong>
                  <span>
                    {event.from !== event.to
                      ? `${copy.statuses[event.from]} → ${copy.statuses[event.to]}`
                      : ""}
                  </span>
                  <span>{event.actor.name || event.actor.uid}</span>
                  <CustomerDate value={event.at} />
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>{copy.historyEmpty}</p>
          )}
        </CatalogGroup>
      </div>
    </StaffRecord>
  );
}
