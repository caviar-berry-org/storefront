"use client";
import { FormFeedback } from "@/components/forms/form-feedback";
import { postStorefrontJson } from "@/lib/storefront-request";
import { ui } from "@/components/ui/styles";
import { StorefrontLink } from "./storefront-link";
import { useLocale, useTranslator } from "@/i18n/client";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import { usePathname } from "next/navigation";
import { findVariant } from "@/domain/catalog";
import { formatMoney } from "@/lib/format-money";
import { MAX_QUANTITY, quantityLimit, type CartLine } from "@/domain/cart";
import {
  normalizePromotionCode,
  promotionTotals,
  promotionEligibleSubtotal,
  type Promotion,
} from "@/domain/promotion";
import { localizedPath, type Locale } from "@/i18n/routing";
import { Jar } from "./jar";
import type { CSSProperties } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Quantity } from "./quantity";
import { useStore, type CartChangeError } from "./store-provider";
import { CartFeedback } from "./cart-feedback";

const promoKey = "ucb-promo-code";
function readSavedCode() {
  try {
    return normalizePromotionCode(sessionStorage.getItem(promoKey));
  } catch {
    return null;
  }
}
function saveCode(code: string | null) {
  try {
    if (code) sessionStorage.setItem(promoKey, code);
    else sessionStorage.removeItem(promoKey);
  } catch {
    // The applied promotion remains available in the current tab's React state.
  }
}
async function fetchPromotion(
  code: string,
  locale: Locale,
  signal: AbortSignal,
): Promise<
  | { promotion: Promotion }
  | {
      error:
        "cart.promoRejected" | "cart.promoHeld" | "cart.text1" | "cart.text2";
    }
> {
  try {
    const { response, result: data } = await postStorefrontJson(
      "/api/promotions/validate",
      locale,
      JSON.stringify({ code }),
      { signal, timeout: 10000 },
    );
    if (
      response.ok &&
      data?.code === code &&
      Number.isInteger(data.percent) &&
      data.percent > 0 &&
      data.percent <= 100
    )
      return {
        promotion: {
          code,
          percent: data.percent,
          excludedProductIds: ["trout"],
          ...(Array.isArray(data.productIds) && {
            productIds: data.productIds.filter(
              (id: unknown) => typeof id === "string",
            ),
          }),
        },
      };
    return {
      error:
        data?.code === "INVALID_PROMO"
          ? "cart.promoRejected"
          : data?.code === "PROMO_HELD"
            ? "cart.promoHeld"
            : "cart.text1",
    };
  } catch {
    return { error: "cart.text2" };
  }
}

export function Cart() {
  const t = useTranslator();
  const locale = useLocale();
  const {
    lines,
    summary,
    checkingQuantity,
    removals,
    setOverlay,
    promotion,
    products,
    setPromotion,
  } = useStore();
  const [promoInput, setPromoInput] = useState<string>();
  const [promoMessage, setPromoMessage] = useState<
    | "cart.promoRequired"
    | "cart.invalidPromo"
    | "cart.promoRejected"
    | "cart.promoHeld"
    | "cart.text1"
    | "cart.text2"
    | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [restoreReady, setRestoreReady] = useState(false);
  const checking = busy || !restoreReady;
  const invalidPromo =
    promoMessage === "cart.promoRequired" ||
    promoMessage === "cart.invalidPromo" ||
    promoMessage === "cart.promoRejected";
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    const saved = promotion ? null : readSavedCode();
    const result = saved
      ? fetchPromotion(saved, locale, controller.signal)
      : Promise.resolve(null);
    void result.then((value) => {
      if (controller.signal.aborted) return;
      if (value && "promotion" in value) setPromotion(value.promotion);
      if (value && "error" in value) {
        setPromoMessage(value.error);
        setPromoInput(saved ?? "");
        if (value.error === "cart.promoRejected") saveCode(null);
      }
      setRestoreReady(true);
    });
    return () => controller.abort();
  }, [locale, promotion, setPromotion]);

  async function checkPromo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !restoreReady || promotion) return;
    const input = promoInput ?? "";
    const code = normalizePromotionCode(input);
    if (!code) {
      setPromoMessage(
        input.trim() ? "cart.invalidPromo" : "cart.promoRequired",
      );
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setPromoMessage(null);
    const result = await fetchPromotion(code, locale, controller.signal);
    pending.current = null;
    if (controller.signal.aborted) return;
    setBusy(false);
    if ("promotion" in result) {
      saveCode(code);
      setPromotion(result.promotion);
      setPromoInput(code);
    } else {
      setPromoMessage(result.error);
    }
  }
  return (
    <>
      <div
        className={`cart-head p-[22px_24px] [border-bottom:1px_solid_var(--line)]`}
      >
        <h2 className="h3" id="cart-heading" tabIndex={-1}>
          {t("cart.title")}
        </h2>
      </div>
      <div className={`cart-items flex-1 [overflow:auto] p-[0_24px]`}>
        {!lines.length ? (
          <div className={`cart-empty p-[48px_0] text-left`}>
            <p>{t("cart.paragraph1")}</p>
            <StorefrontLink
              className="btn btn--fill"
              section="ikra"
              beforeNavigate={() => setOverlay(null)}
            >
              {t("cart.link1")}
            </StorefrontLink>
          </div>
        ) : (
          lines.map((line) => <CartItem key={line.variantId} line={line} />)
        )}
      </div>
      {lines.length > 0 && (
        <div
          className={`cart-foot p-[20px_24px_24px] [border-top:1px_solid_var(--line)] [background:var(--surface)]`}
        >
          <label className="mb-2 block text-sm" htmlFor="promo">
            {t("cart.text4")}
          </label>
          <form
            className="promo flex gap-[8px]"
            onSubmit={checkPromo}
            noValidate
            aria-busy={checking}
          >
            <div className="relative min-w-0 flex-1">
              <input
                className={`in ${ui.in} pr-12`}
                id="promo"
                name="code"
                maxLength={40}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                readOnly={checking || Boolean(promotion)}
                value={promoInput ?? promotion?.code ?? ""}
                onChange={(event) => {
                  setPromoInput(event.target.value);
                  setPromoMessage(null);
                }}
                aria-invalid={invalidPromo}
                aria-describedby={
                  invalidPromo || promotion ? "promo-status" : undefined
                }
              />
              {(promoInput ?? promotion?.code ?? "").length > 0 && (
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[var(--muted)] hover:text-[var(--ink)]"
                  disabled={checking}
                  aria-label={t("cart.promoClear")}
                  onClick={() => {
                    saveCode(null);
                    setPromotion(null);
                    setPromoInput("");
                    setPromoMessage(null);
                    document.getElementById("promo")?.focus();
                  }}
                >
                  <span aria-hidden="true" className="text-xl">
                    ×
                  </span>
                </button>
              )}
            </div>
            <SubmitButton
              busy={checking}
              disabled={Boolean(promotion)}
              className="btn"
              aria-label={t("cart.promoApply")}
            >
              OK
            </SubmitButton>
          </form>
          <FormFeedback
            id="promo-status"
            wrapperClassName="promo-msg"
            role="status"
          >
            {(promoMessage || promotion) && (
              <>
                {promoMessage && <p className="err">{t(promoMessage)}</p>}
                {promotion && (
                  <p className="ok">
                    {t(
                      promotionEligibleSubtotal(lines, products, promotion) > 0
                        ? "cart.promoApplied"
                        : "cart.promoNoEligible",
                      {
                        code: promotion.code,
                        percent: promotion.percent,
                      },
                    )}
                  </p>
                )}
              </>
            )}
          </FormFeedback>
          <CartTotals />
          {summary.overLimit && (
            <p role="status" className="cart-line-feedback">
              <CartFeedback
                error={{ kind: "subtotal" }}
                onClose={() => setOverlay(null)}
              />
            </p>
          )}
          <button
            className="btn btn--fill btn--block"
            style={
              checkingQuantity && summary.canCheckout
                ? { opacity: 1 }
                : undefined
            }
            disabled={
              !summary.canCheckout ||
              checking ||
              checkingQuantity ||
              Object.keys(removals).length > 0
            }
            onClick={() => setOverlay({ type: "checkout" })}
          >
            {t("cart.checkout")}
          </button>
        </div>
      )}
    </>
  );
}
function CartItem({ line }: { line: CartLine }) {
  const pathname = usePathname();
  const t = useTranslator();
  const locale = useLocale();
  const {
    products,
    removals,
    scheduleRemoval,
    undoRemoval,
    setQuantity,
    setOverlay,
    checkingQuantity,
  } = useStore();
  const id = line.variantId;
  const removal = removals[id];
  const [error, setError] = useState<CartChangeError | null>(null);
  const match = findVariant(products, id);
  const productHref = match
    ? localizedPath(locale, `/products/${match.product.slug}`)
    : "";
  const limit = match ? quantityLimit(match.variant) : 0;
  const row = useRef<HTMLDivElement>(null);
  const remove = useRef<HTMLButtonElement>(null);
  const undo = useRef<HTMLButtonElement>(null);
  const moveFocus = useRef(false);

  function requestRemoval() {
    moveFocus.current = true;
    setError(null);
    scheduleRemoval(id);
  }

  function openProduct(event: MouseEvent<HTMLAnchorElement>) {
    if (
      pathname !== productHref ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    setOverlay(null);
  }

  useEffect(() => {
    if (removal?.exiting && row.current?.contains(document.activeElement))
      document.getElementById("cart-heading")?.focus({ preventScroll: true });
    else if (moveFocus.current)
      (removal ? undo.current : remove.current)?.focus({ preventScroll: true });
    moveFocus.current = false;
  }, [removal]);

  return (
    <div
      className="cart-row"
      ref={row}
      data-exiting={removal?.exiting || undefined}
    >
      <div className="cart-row-inner">
        <article
          className="ci"
          style={{ "--plate": match?.product.plate } as CSSProperties}
          data-pending={Boolean(removal) || undefined}
        >
          <div className="ci-content" inert={Boolean(removal)}>
            {match && (
              <a
                className="mini"
                href={productHref}
                onClick={openProduct}
                aria-label={match.product.name}
                tabIndex={-1}
              >
                <Jar product={match.product} sizes="52px" />
              </a>
            )}
            <div className="ci-heading" data-unavailable={!match || undefined}>
              {match ? (
                <h3>
                  <a
                    href={productHref}
                    onClick={openProduct}
                    className="ci-product-link"
                  >
                    {match.product.name}
                  </a>
                </h3>
              ) : (
                <p role="status">{t("cart.paragraph3")}</p>
              )}
              <button
                ref={remove}
                className="ci-remove"
                type="button"
                aria-label={
                  match
                    ? t("cart.removeLine", {
                        name: match.product.name,
                        weight: match.variant.weightGrams,
                      })
                    : t("cart.removeUnavailable")
                }
                onClick={requestRemoval}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="m3 3 10 10M13 3 3 13" />
                </svg>
              </button>
            </div>
            {match && (
              <>
                <div>
                  <p className="muted">
                    {match.variant.weightGrams}
                    {t("cart.paragraph2")}
                    {formatMoney(match.variant.priceMinor, locale)}
                  </p>
                  <Quantity
                    value={line.quantity}
                    min={0}
                    max={limit}
                    className="mt-2"
                    busy={checkingQuantity}
                    feedback={
                      (error ||
                        (line.quantity >= limit && limit < MAX_QUANTITY)) && (
                        <span
                          className={
                            error && error.kind !== "stock"
                              ? "cart-line-feedback"
                              : undefined
                          }
                        >
                          <CartFeedback
                            error={error ?? { kind: "stock", limit }}
                            onClose={() => setOverlay(null)}
                          />
                        </span>
                      )
                    }
                    onChange={async (quantity, manual) => {
                      if (quantity === 0) requestRemoval();
                      else
                        setError(
                          await setQuantity(id, quantity, { fitStock: manual }),
                        );
                    }}
                    label={t("cart.text3", {
                      value1: match.product.name,
                      value2: match.variant.weightGrams,
                    })}
                    rangeMessage={
                      limit
                        ? t("cart.quantityLimit", { value1: limit })
                        : t("cart.paragraph3")
                    }
                  />
                </div>
                <p className="ci-sum">
                  <AnimatedAmount
                    amount={match.variant.priceMinor * line.quantity}
                    locale={locale}
                  />
                </p>
              </>
            )}
          </div>
          {removal && (
            <div className="ci-undo" inert={removal.exiting}>
              <span className="sr" role="status">
                {t("cart.removalPending")}
              </span>
              <RemovalCountdown deadline={removal.deadline} />
              <button
                ref={undo}
                type="button"
                onClick={() => {
                  moveFocus.current = true;
                  undoRemoval(id);
                }}
              >
                {t("cart.undo")}
              </button>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

function RemovalCountdown({ deadline }: { deadline: number }) {
  const t = useTranslator();
  const [seconds, setSeconds] = useState(() =>
    Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
  );
  useEffect(() => {
    const timer = setInterval(
      () => setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))),
      100,
    );
    return () => clearInterval(timer);
  }, [deadline]);
  return <span aria-hidden="true">{t("cart.countdown", { seconds })}</span>;
}

export function CartTotals() {
  const t = useTranslator();
  const locale = useLocale();
  const { summary, promotion, lines, products } = useStore();
  const { discountMinor, totalMinor } = promotionTotals(
    summary.subtotalMinor,
    promotion,
    promotionEligibleSubtotal(lines, products, promotion),
  );
  return (
    <div className={`totals grid gap-[6px] text-[17px]`}>
      <div>
        <span>{t("cart.text5")}</span>
        <span>
          <AnimatedAmount amount={summary.subtotalMinor} locale={locale} />
        </span>
      </div>
      {discountMinor > 0 && (
        <div>
          <span>{t("cart.discount")}</span>
          <span>
            −<AnimatedAmount amount={discountMinor} locale={locale} />
          </span>
        </div>
      )}
      <div>
        <span>{t("delivery.text2")}</span>
        <small>{t("cart.text6")}</small>
      </div>
      <div className="grand">
        <span>{t("cart.text7")}</span>
        <span>
          <AnimatedAmount amount={totalMinor} locale={locale} />
        </span>
      </div>
    </div>
  );
}

function AnimatedAmount({
  amount,
  locale,
}: {
  amount: number;
  locale: Locale;
}) {
  return (
    <span
      key={amount}
      className="inline-block tabular-nums motion-safe:animate-[cart-value-in_220ms_ease-out]"
    >
      {formatMoney(amount, locale)}
    </span>
  );
}
