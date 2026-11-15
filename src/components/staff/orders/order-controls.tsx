"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { updateOrder } from "@/app/(staff)/admin/orders/actions";
import {
  availableOrderStatuses,
  canConfirmTransfer,
  isOrderStatus,
  type Order,
  type OrderChange,
  type OrderError,
} from "@/domain/orders";
import { ordersCopy as copy } from "@/i18n/orders-staff-uk";
import { staffCopy } from "@/i18n/staff-uk";
import { AdminLink } from "../admin-link";
import catalog from "../catalog/catalog.module.css";
import styles from "./orders.module.css";
import { StaffIcon } from "../staff-icon";
import { StaffConfirm } from "../staff-confirm";
import { StaffSelect } from "../staff-select";
import { StatusBadge } from "../status-badge";
import { StaffBusy } from "../staff-feedback";
import { OrderNotice } from "./order-notice";

export function OrderControls({
  id,
  type,
  revision,
  status,
  payment,
  delivery,
}: Pick<
  Order,
  "id" | "type" | "revision" | "status" | "payment" | "delivery"
>) {
  const [error, setError] = useState<OrderError | null>(null);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState("");
  const [asking, setAsking] = useState<"cancel" | "payment" | null>(null);
  const lock = useRef(false);
  const router = useRouter();
  const options = availableOrderStatuses({ type, status, payment, delivery });
  const confirmable = canConfirmTransfer({ type, status, payment, delivery });

  function save(change: OrderChange) {
    if (lock.current) return;
    lock.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await updateOrder(id, change, revision);
        if ("error" in result) setError(result.error);
        else {
          setSelected("");
          if (!result.changed) router.refresh();
        }
      } catch {
        setError("unavailable");
      } finally {
        lock.current = false;
      }
    });
  }

  useEffect(() => {
    if (status !== "new") return;
    let mounted = true;
    startTransition(async () => {
      try {
        const result = await updateOrder(id, { action: "viewed" });
        if (!mounted) return;
        if ("error" in result) setError(result.error);
        else if (!result.changed) router.refresh();
      } catch {
        if (mounted) setError("unavailable");
      }
    });
    return () => {
      mounted = false;
    };
  }, [id, status, router]);

  return (
    <>
      {/* The saved status stays visible while the next one is being picked. */}
      <p className={styles.statusCurrent}>
        <span>{copy.currentStatus}</span>
        <StatusBadge kind="order" value={status}>
          {copy.statuses[status]}
        </StatusBadge>
      </p>
      <div className={styles.controls}>
        {options.length > 0 && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!isOrderStatus(selected) || !options.includes(selected))
                return;
              // Cancelling cannot be undone and leaves manual work behind.
              if (selected === "cancelled") setAsking("cancel");
              else save({ action: "status", status: selected });
            }}
          >
            <StaffSelect
              label={copy.next}
              disabled={pending}
              value={
                isOrderStatus(selected) && options.includes(selected)
                  ? selected
                  : ""
              }
              onChange={(event) => setSelected(event.target.value)}
            >
              <option value="">{copy.select}</option>
              {options.map((value) => (
                <option key={value} value={value}>
                  {copy.statuses[value]}
                </option>
              ))}
            </StaffSelect>
            <button
              className={catalog.primary}
              type="submit"
              disabled={
                pending ||
                !isOrderStatus(selected) ||
                !options.includes(selected)
              }
            >
              {copy.save}
            </button>
          </form>
        )}
        {confirmable && (
          // Carries the same green as the paid marks in the list and the tally,
          // rather than a second accent competing with Save beside it.
          <button
            className={`${catalog.primary} ${styles.confirmPayment}`}
            type="button"
            disabled={pending}
            onClick={() => setAsking("payment")}
          >
            <StaffIcon name="money" />
            {copy.confirmPayment}
          </button>
        )}
      </div>
      <StaffConfirm
        open={asking !== null}
        title={
          asking === "cancel" ? copy.cancelConfirmTitle : copy.confirmPayment
        }
        body={
          asking === "cancel" ? copy.cancelConfirmBody : copy.confirmPaymentText
        }
        confirmLabel={
          asking === "cancel" ? copy.cancelConfirmSave : copy.confirmPayment
        }
        danger={asking === "cancel"}
        busy={pending}
        onConfirm={() => {
          const action = asking;
          setAsking(null);
          if (action === "cancel")
            save({ action: "status", status: "cancelled" });
          else if (action === "payment") save({ action: "payment" });
        }}
        onDismiss={() => {
          if (!pending) setAsking(null);
        }}
      />
      {pending && <StaffBusy />}
      {error && (
        <OrderNotice error={error} mutation>
          {error === "session" ? (
            <AdminLink href="/sign-in">{staffCopy.signIn.title}</AdminLink>
          ) : status === "new" ? (
            <button
              type="button"
              className={catalog.button}
              onClick={() => save({ action: "viewed" })}
            >
              {copy.retry}
            </button>
          ) : (
            ["conflict", "unavailable", "technical"].includes(error) && (
              <button
                type="button"
                className={catalog.button}
                disabled={pending}
                onClick={() => {
                  setError(null);
                  startTransition(() => router.refresh());
                }}
              >
                {copy.refresh}
              </button>
            )
          )}
        </OrderNotice>
      )}
    </>
  );
}
