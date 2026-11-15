"use client";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  saveOrderTracking,
  reconcileStaffOrder,
  retryOrderNotifications,
  recoverStaffInvoice,
} from "@/app/(staff)/admin/orders/actions";
import { ordersCopy as copy } from "@/i18n/orders-staff-uk";
import {
  normalizeTrackingNumber,
  trackingNumberLimit,
  type Order,
  type OrderError,
  type TrackingResult,
} from "@/domain/orders";
import { OrderNotice } from "./order-notice";
import { StaffConfirm } from "../staff-confirm";
import { StaffFieldError } from "../staff-feedback";
import { StatusBadge } from "../status-badge";
import catalog from "../catalog/catalog.module.css";
import styles from "./orders.module.css";

export type Operated = Pick<
  Order,
  "id" | "revision" | "status" | "payment" | "delivery" | "mail" | "customer"
>;

type Outcome = { error: OrderError } | TrackingResult | { changed: boolean };

/** One mutation at a time per block, with its own result line. */
function useOperation() {
  const [error, setError] = useState<OrderError | null>(null);
  const [result, setResult] = useState<TrackingResult | "done" | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function run(action: () => Promise<Outcome>, onSuccess?: () => void) {
    if (pending) return;
    setError(null);
    setResult(null);
    start(async () => {
      try {
        const outcome = await action();
        if ("error" in outcome) setError(outcome.error);
        else {
          setResult("check" in outcome ? outcome : "done");
          onSuccess?.();
          router.refresh();
        }
      } catch {
        setError("unavailable");
      }
    });
  }

  const reset = () => {
    setError(null);
    setResult(null);
  };
  return { error, result, pending, run, reset };
}

function Feedback({
  error,
  children,
}: {
  error: OrderError | null;
  children?: ReactNode;
}) {
  return (
    <>
      {children && (
        <p role="status" className={catalog.status}>
          {children}
        </p>
      )}
      {error && <OrderNotice error={error} mutation />}
    </>
  );
}

export function OrderShipment({
  order,
  mailEnabled,
}: {
  order: Operated;
  mailEnabled: boolean;
}) {
  const saved = order.delivery?.trackingNumber ?? "";
  const [number, setNumber] = useState(saved);
  const [notify, setNotify] = useState(false);
  // What the finished save actually asked for; `notify` is cleared on success.
  const [asked, setAsked] = useState(false);
  const [asking, setAsking] = useState(false);
  const { error, result, pending, run, reset } = useOperation();

  const editable = order.status !== "cancelled";
  const canNotify = Boolean(
    mailEnabled && order.payment.status === "paid" && order.customer.email,
  );
  const valid = normalizeTrackingNumber(number) !== null;
  const sending = notify && canNotify && Boolean(number.trim());
  const dirty = number.trim() !== saved || sending;

  function commit() {
    // The opt-in is per save: it must not stay armed for the next one.
    run(
      () => saveOrderTracking(order.id, number, order.revision, notify),
      () => {
        setAsked(sending);
        setNotify(false);
      },
    );
  }

  return (
    <>
      <p className={styles.jump}>
        <a
          href="https://new.novaposhta.ua/"
          target="_blank"
          rel="noopener noreferrer"
        >
          {copy.novaCabinet}
        </a>
      </p>
      {editable && (
        <form
          className={catalog.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (!valid || !dirty) return;
            // Mailing a customer and wiping a saved number both need stating.
            if (sending || !number.trim()) setAsking(true);
            else commit();
          }}
        >
          <label className={catalog.field}>
            {copy.tracking}
            <input
              value={number}
              maxLength={trackingNumberLimit}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!valid}
              aria-describedby="tracking-error"
              onChange={(event) => {
                setNumber(event.target.value);
                reset();
              }}
            />
            <StaffFieldError
              id="tracking-error"
              message={valid ? undefined : copy.trackingInvalid}
            />
          </label>
          <label className={styles.notify}>
            <input
              type="checkbox"
              checked={sending}
              disabled={!canNotify || !number.trim()}
              onChange={(event) => setNotify(event.target.checked)}
            />
            <span>
              {copy.trackingNotify}
              {!canNotify && <small>{copy.trackingNotifyBlocked}</small>}
            </span>
          </label>
          <div className={catalog.controls}>
            <button
              className={catalog.primary}
              disabled={pending || !valid || !dirty}
            >
              {number.trim() ? copy.trackingSave : copy.trackingRemove}
            </button>
          </div>
        </form>
      )}
      <StaffConfirm
        open={asking}
        title={
          sending ? copy.notifyConfirmTitle : copy.removeTrackingConfirmTitle
        }
        body={sending ? copy.notifyConfirmBody : copy.removeTrackingConfirmBody}
        confirmLabel={sending ? copy.notifyConfirmSave : copy.trackingRemove}
        danger={!sending}
        busy={pending}
        onConfirm={() => {
          setAsking(false);
          commit();
        }}
        onDismiss={() => {
          if (!pending) setAsking(false);
        }}
      />
      <Feedback error={error}>
        {result && result !== "done"
          ? [
              result.changed
                ? number.trim()
                  ? copy.trackingSaved
                  : copy.trackingCleared
                : copy.trackingUnchanged,
              result.check === "ok"
                ? copy.trackingVerified
                : result.check === "unverified"
                  ? copy.trackingUnverified
                  : null,
              asked
                ? result.notified
                  ? copy.trackingNotified
                  : copy.trackingNotifySkipped
                : null,
            ]
              .filter(Boolean)
              .join(" ")
          : null}
      </Feedback>
    </>
  );
}

export function OrderPaymentSync({ order }: { order: Operated }) {
  const [invoice, setInvoice] = useState("");
  const [asking, setAsking] = useState<"sync" | "recover" | null>(null);
  const { error, result, pending, run, reset } = useOperation();
  const recoverable = !order.payment.invoiceId && order.payment.invoiceState;

  return (
    <>
      <div className={catalog.controls}>
        <button
          type="button"
          className={catalog.button}
          disabled={pending}
          onClick={() => setAsking("sync")}
        >
          {copy.syncPayment}
        </button>
      </div>
      {recoverable && (
        <form
          className={catalog.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (invoice) setAsking("recover");
          }}
        >
          <label className={catalog.field}>
            {copy.recoverInvoice}
            <input
              value={invoice}
              maxLength={120}
              pattern="[\w-]+"
              autoComplete="off"
              required
              onChange={(event) => {
                setInvoice(event.target.value.trim());
                reset();
              }}
            />
          </label>
          <div className={catalog.controls}>
            <button disabled={pending || !invoice} className={catalog.button}>
              {copy.recoverSave}
            </button>
          </div>
        </form>
      )}
      <StaffConfirm
        open={asking !== null}
        title={
          asking === "recover"
            ? copy.recoverConfirmTitle
            : copy.syncConfirmTitle
        }
        body={
          asking === "recover" ? copy.recoverConfirmBody : copy.syncConfirmBody
        }
        confirmLabel={
          asking === "recover" ? copy.recoverSave : copy.syncConfirmSave
        }
        busy={pending}
        onConfirm={() => {
          const action = asking;
          setAsking(null);
          if (action === "recover")
            run(() => recoverStaffInvoice(order.id, invoice));
          else if (action === "sync") run(() => reconcileStaffOrder(order.id));
        }}
        onDismiss={() => {
          if (!pending) setAsking(null);
        }}
      />
      <Feedback error={error}>
        {result === "done" ? copy.paymentSynced : null}
      </Feedback>
    </>
  );
}

export function OrderMail({ order }: { order: Operated }) {
  const [asking, setAsking] = useState(false);
  const { error, result, pending, run } = useOperation();

  return (
    <>
      <dl className={styles.mailStates}>
        {(
          [
            ["created", copy.mailCreated],
            ["paid", copy.mailPaid],
            ["shipment", copy.mailShipment],
          ] as const
        ).map(([kind, label]) => (
          <div key={kind}>
            <dt>{label}</dt>
            <dd>
              {order.mail?.[kind] &&
              copy.mailStates[
                order.mail[kind] as keyof typeof copy.mailStates
              ] ? (
                <StatusBadge kind="mail" value={order.mail[kind]!}>
                  {
                    copy.mailStates[
                      order.mail[kind] as keyof typeof copy.mailStates
                    ]
                  }
                </StatusBadge>
              ) : (
                copy.none
              )}
            </dd>
          </div>
        ))}
      </dl>
      <div className={catalog.controls}>
        <button
          type="button"
          className={catalog.button}
          disabled={pending}
          onClick={() => setAsking(true)}
        >
          {copy.retryNotifications}
        </button>
      </div>
      <StaffConfirm
        open={asking}
        title={copy.retryConfirmTitle}
        body={copy.retryConfirmBody}
        confirmLabel={copy.retryConfirmSave}
        busy={pending}
        onConfirm={() => {
          setAsking(false);
          run(() => retryOrderNotifications(order.id));
        }}
        onDismiss={() => {
          if (!pending) setAsking(false);
        }}
      />
      <Feedback error={error}>
        {result === "done" ? copy.mailRetried : null}
      </Feedback>
    </>
  );
}
