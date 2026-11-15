import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderStatusView } from "@/components/store/order-status";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  if (!/^[a-f\d]{40}$/.test(orderId)) notFound();
  return <OrderStatusView id={orderId} />;
}
