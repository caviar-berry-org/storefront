import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderDetail } from "@/components/staff/orders/order-detail";
import { isOrderId } from "@/domain/orders";
import { ordersCopy as copy } from "@/i18n/orders-staff-uk";
import { staffCopy } from "@/i18n/staff-uk";
import { catalogStaff } from "@/lib/server/catalog/access";
import { OrderNotice } from "@/components/staff/orders/order-notice";
import { orderFailure } from "@/lib/server/orders/feedback";
import { readOrder } from "@/lib/server/orders/queries";
import { requireStaffSession } from "@/lib/server/staff-session";

export const metadata: Metadata = {
  title: `${copy.detail} | ${staffCopy.brand}`,
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  await requireStaffSession();
  const { orderId } = await params;
  if (!isOrderId(orderId)) notFound();
  const detail = await readOrder(orderId).catch((error: unknown) => ({
    error: orderFailure("detail", error),
  }));
  if (!detail) notFound();
  if ("error" in detail) return <OrderNotice error={detail.error} />;
  return (
    <OrderDetail
      {...detail}
      canOpenInventory={Boolean(await catalogStaff())}
      mailEnabled={process.env.ORDER_EMAIL_ENABLED === "true"}
    />
  );
}
