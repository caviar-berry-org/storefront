"use server";

import { after } from "next/server";
import { saveTracking } from "@/lib/server/orders/tracking";
import { orderCollection, orderData } from "@/lib/server/orders/storage";
import { monoInvoiceStatus } from "@/lib/server/payments/mono";
import { applyPayment } from "@/lib/server/checkout/payment";
import { reconcileOrder } from "@/lib/server/checkout/payment";
import { deliverOrderNotifications } from "@/lib/server/orders/notifications";
import { revalidatePath } from "next/cache";
import {
  isOrderId,
  isOrderStatus,
  normalizeTrackingNumber,
  orderSearchTerm,
  orderTypes,
  type OrderChange,
  type OrderCursor,
  type OrderFilters,
  type OrderError,
} from "@/domain/orders";
import { changeOrder } from "@/lib/server/orders/update";
import { readOrders } from "@/lib/server/orders/queries";
import { orderFailure } from "@/lib/server/orders/feedback";
import { getStaffSession } from "@/lib/server/staff-session";

export async function queryOrders(
  filters: OrderFilters,
  cursor: OrderCursor | null,
) {
  if (!(await getStaffSession())) return { error: "session" } as const;
  if (
    typeof filters?.search !== "string" ||
    filters.search.length > 254 ||
    orderSearchTerm(filters.search) === null ||
    (filters.type !== "all" && !orderTypes.includes(filters.type)) ||
    (filters.status !== "all" &&
      filters.status !== "active" &&
      !isOrderStatus(filters.status)) ||
    (cursor !== null &&
      (!isOrderId(cursor?.id) ||
        !Number.isSafeInteger(cursor.createdAt) ||
        cursor.createdAt < 0))
  )
    return { error: "invalid" } as const;
  try {
    return await readOrders(filters, cursor);
  } catch (error) {
    return { error: orderFailure("list", error) };
  }
}

export async function updateOrder(
  id: string,
  change: OrderChange,
  revision?: number,
): Promise<{ changed: boolean } | { error: OrderError }> {
  const staff = await getStaffSession();
  if (!staff) return { error: "session" } as const;
  if (
    !isOrderId(id) ||
    (change?.action !== "viewed" &&
      (!Number.isSafeInteger(revision) ||
        (change?.action !== "payment" &&
          !(change?.action === "status" && isOrderStatus(change.status)))))
  )
    return { error: "invalid" } as const;

  const name = typeof staff.name === "string" ? staff.name.trim() : "";
  const result = await changeOrder(
    id,
    { uid: staff.uid, ...(name && { name }) },
    change,
    revision,
  ).catch((error: unknown) => ({ error: orderFailure("update", error) }));
  if ("error" in result) return result;
  if (change.action === "payment" && result.changed)
    after(() => deliverOrderNotifications(id));

  try {
    if (result.activeChanged) revalidatePath("/admin", "layout");
    else if (result.changed) {
      revalidatePath("/admin/orders");
      revalidatePath(`/admin/orders/${id}`);
    }
  } catch (error) {
    orderFailure("refresh", error);
  }
  return { changed: result.changed };
}

export async function saveOrderTracking(
  id: string,
  number: string,
  revision: number,
  notify: boolean,
) {
  const staff = await getStaffSession();
  if (!staff) return { error: "session" } as const;
  if (
    !isOrderId(id) ||
    normalizeTrackingNumber(number) === null ||
    !Number.isSafeInteger(revision) ||
    typeof notify !== "boolean"
  )
    return { error: "invalid" } as const;
  const name = typeof staff.name === "string" ? staff.name.trim() : "";
  try {
    const result = await saveTracking(
      id,
      number,
      revision,
      { uid: staff.uid, ...(name && { name }) },
      notify,
    );
    if (!("error" in result)) {
      if (result.notified) after(() => deliverOrderNotifications(id));
      revalidatePath(`/admin/orders/${id}`);
    }
    return result;
  } catch (error) {
    return { error: orderFailure("update", error) };
  }
}
export async function reconcileStaffOrder(id: string) {
  if (!(await getStaffSession())) return { error: "session" } as const;
  if (!isOrderId(id)) return { error: "invalid" } as const;
  try {
    const order = orderData(await orderCollection().doc(id).get());
    if (!order) return { error: "missing" } as const;
    await reconcileOrder(order);
    after(() => deliverOrderNotifications(id));
    revalidatePath(`/admin/orders/${id}`);
    return { changed: true };
  } catch {
    return { error: "unavailable" } as const;
  }
}
export async function retryOrderNotifications(id: string) {
  if (!(await getStaffSession())) return { error: "session" } as const;
  if (!isOrderId(id)) return { error: "invalid" } as const;
  await deliverOrderNotifications(id);
  revalidatePath(`/admin/orders/${id}`);
  return { changed: true };
}
export async function recoverStaffInvoice(id: string, invoiceId: string) {
  if (!(await getStaffSession())) return { error: "session" } as const;
  if (!/^[a-f\d]{40}$/.test(id) || !/^[\w-]{1,120}$/.test(invoiceId))
    return { error: "invalid" } as const;
  try {
    const status = await monoInvoiceStatus(invoiceId);
    if (status.reference !== id) return { error: "invalid" } as const;
    await applyPayment(status);
    after(() => deliverOrderNotifications(id));
    revalidatePath(`/admin/orders/${id}`);
    return { changed: true };
  } catch {
    return { error: "unavailable" } as const;
  }
}
