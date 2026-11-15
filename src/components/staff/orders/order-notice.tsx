import type { ReactNode } from "react";
import type { OrderError } from "@/domain/orders";
import { ordersCopy as copy } from "@/i18n/orders-staff-uk";
import { StaffNotice } from "../staff-feedback";

export function OrderNotice({
  error,
  mutation = false,
  children,
}: {
  error: OrderError;
  mutation?: boolean;
  children?: ReactNode;
}) {
  const guidance =
    error === "unavailable"
      ? "retry"
      : error === "indexRequired" || error === "technical"
        ? "technical"
        : undefined;
  const message =
    mutation && (error === "unavailable" || error === "technical")
      ? copy.updateFailed
      : copy[error];
  return (
    <StaffNotice message={message} guidance={guidance}>
      {children}
    </StaffNotice>
  );
}
