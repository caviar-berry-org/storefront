"use client";
import { contacts } from "@/content/contacts";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslator } from "@/i18n/client";
import { useStore } from "./store-provider";
import { formatMoney } from "@/lib/format-money";
import type { OrderLine, PaymentStatus } from "@/domain/orders";
import { StorefrontLink } from "./storefront-link";
import { Arrow } from "@/components/ui/arrow";
import { ui } from "@/components/ui/styles";

/** One row per channel, so phones wrap cleanly and every entry is tappable. */
const contactRows = [
  { href: `mailto:${contacts.email}`, label: contacts.email },
  ...contacts.phones.map((phone) => ({
    href: `tel:${phone.tel}`,
    label: phone.display,
  })),
];

type Receipt = {
  id: string;
  number: string;
  status: string;
  payment: PaymentStatus;
  method: "online" | "iban";
  totalMinor: number;
  discountMinor: number;
  lines: OrderLine[];
  pageUrl?: string;
  appUrl?: string;
  invoiceState?: string;
  syncUnavailable?: boolean;
  delivery?: { city: string; destination: string; trackingNumber?: string };
};
export function OrderStatusView({ id }: { id: string }) {
  const t = useTranslator();
  const locale = useLocale();
  const { completeOrder, setOverlay } = useStore();
  const [order, setOrder] = useState<Receipt | null>(null);
  const [error, setError] = useState<"private" | "unavailable" | null>(null);
  // Polling is bounded, so the page must offer a way back instead of looking
  // live while it has quietly stopped asking.
  const [attempt, setAttempt] = useState(0);
  const [stalled, setStalled] = useState(false);
  const complete = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const load = async () => {
      try {
        const response = await fetch(`/api/orders/${id}`, {
          // A manual refresh asks the provider again; the first automatic load
          // only reads what we already know.
          method: attempts === 0 && attempt === 0 ? "GET" : "POST",
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          setError(response.status === 404 ? "private" : "unavailable");
          return;
        }
        const data: Receipt = await response.json();
        if (controller.signal.aborted) return;
        setOrder(data);
        setError(data.syncUnavailable ? "unavailable" : null);
        if (data.method === "online" && data.payment === "pending") {
          if (attempts++ < 20)
            timer = setTimeout(load, attempts === 1 ? 1000 : 15000);
          else setStalled(true);
        }
      } catch {
        if (!controller.signal.aborted) setError("unavailable");
      }
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [id, attempt]);
  useEffect(() => {
    if (
      order &&
      !complete.current &&
      !["dispute", "cancelled"].includes(order.status) &&
      (order.method === "iban" || order.payment === "paid")
    ) {
      complete.current = true;
      completeOrder(id, order.lines);
    }
  }, [order, id, completeOrder]);
  const heading =
    order?.status === "cancelled"
      ? "order.cancelled"
      : order?.status === "dispute"
        ? "order.review"
        : order?.payment === "paid"
          ? "order.paid"
          : order?.payment === "failed"
            ? "order.failed"
            : order?.method === "iban"
              ? "order.created"
              : "order.pending";
  return (
    <section className="mx-auto min-h-[80svh] max-w-3xl px-5 pt-36 pb-16">
      <p className="mb-3 text-sm uppercase tracking-widest">
        {t("order.heading")}
      </p>
      <h1 className="h2 mb-6" aria-live="polite">
        {order ? t(heading) : t("order.loading")}
      </h1>
      {order ? (
        <>
          <p className="mb-4">{t("order.number", { number: order.number })}</p>
          {/*
            Only the transfer path has something to add here — a manager gets in
            touch. An online order's own heading already says where it stands,
            and the ambiguous invoice has its own notice further down, so
            "saved, do not order again" was telling a paying customer off for
            nothing.
          */}
          {order.method === "iban" && (
            <p className="mb-6">{t("order.transfer")}</p>
          )}
          <ul className="divide-y divide-black/10 border-y border-black/10">
            {order.lines.map((line) => (
              <li
                key={line.variantId}
                className="flex justify-between gap-4 py-4"
              >
                <span>
                  {line.name}, {line.weightGrams} {t("common.grams")} ×{" "}
                  {line.quantity}
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatMoney(line.quantity * line.unitPriceMinor, locale)}
                </span>
              </li>
            ))}
          </ul>
          {order.discountMinor > 0 && (
            <p className="mt-4">
              {t("order.discount")}: −{formatMoney(order.discountMinor, locale)}
            </p>
          )}
          <p className="mt-4 text-xl">
            {t("cart.total")}: {formatMoney(order.totalMinor, locale)}
          </p>
          {order.delivery && (
            <p className="mt-5">
              {order.delivery.city}, {order.delivery.destination}
            </p>
          )}
          <p className="mt-3 text-sm text-black/60">
            {t("order.deliveryNote")}
          </p>
          {order.payment === "pending" && order.method === "online" && (
            <div className="mt-8 space-y-4">
              {order.pageUrl ? (
                <>
                  <a
                    href={order.pageUrl}
                    className="btn inline-flex min-h-12 items-center justify-center px-7"
                  >
                    {t("payment.pay")}
                  </a>
                  <p className="text-sm text-black/65">
                    {t("payment.options")}
                  </p>
                  {order.appUrl && (
                    <a
                      href={order.appUrl}
                      className="inline-block min-h-11 underline underline-offset-4"
                    >
                      {t("payment.mono")}
                    </a>
                  )}
                </>
              ) : (
                <p role="status">{t("order.invoiceUnknown")}</p>
              )}
            </div>
          )}
        </>
      ) : null}
      {error && (
        <p role="alert" className="mt-5 text-red-800">
          {t(error === "private" ? "order.private" : "order.unavailable")}
        </p>
      )}
      {error !== "private" && (stalled || error === "unavailable") && (
        <button
          type="button"
          className="mt-3 min-h-11 underline underline-offset-4"
          onClick={() => {
            setStalled(false);
            setError(null);
            setAttempt((value) => value + 1);
          }}
        >
          {t("order.retry")}
        </button>
      )}
      {order?.payment === "failed" && (
        <button
          type="button"
          className="mt-5 min-h-11 underline"
          onClick={() => setOverlay({ type: "cart" })}
        >
          {t("order.backToCart")}
        </button>
      )}
      <div className="mt-7 text-sm">
        <p>{t("order.questions")}</p>
        <ul className="mt-1 grid gap-0.5">
          {contactRows.map(({ href, label }) => (
            <li key={href}>
              <a
                className="inline-flex min-h-11 items-center underline underline-offset-4"
                href={href}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-4">
        <StorefrontLink className={`b-link ${ui.bLink}`} section="top">
          {t("order.home")}
          <Arrow />
        </StorefrontLink>
        <StorefrontLink className={`b-link ${ui.bLink}`} section="ikra">
          {t("about.link1")}
          <Arrow />
        </StorefrontLink>
      </div>
    </section>
  );
}
