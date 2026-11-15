"use client";
import { promotionEligibleSubtotal, promotionTotals } from "@/domain/promotion";
import { CheckoutDeliveryFields } from "./checkout-delivery-fields";
import { readPhoneInput } from "@/components/forms/phone-input";
import { MAX_PHONE_LENGTH } from "@/domain/contact";
import { FormFeedback } from "@/components/forms/form-feedback";
import { fitCommentHeight } from "@/components/forms/fit-comment-height";
import { postStorefrontJson } from "@/lib/storefront-request";
import { ui } from "@/components/ui/styles";
import { useLocale, useTranslator } from "@/i18n/client";
import { localizedPath } from "@/i18n/routing";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  deliveryMethods,
  normalizePhone,
  paymentMethods,
  validateCheckout,
  type CheckoutErrors,
  type CheckoutInput,
} from "@/domain/checkout";
import { findVariant } from "@/domain/catalog";
import { formatMoney } from "@/lib/format-money";
import { SubmitButton } from "@/components/ui/submit-button";
import { CartFeedback } from "./cart-feedback";
import { CartTotals } from "./cart";
import { useStore } from "./store-provider";
const fields = [
  {
    key: "name",
    label: "checkout.label1",
    autoComplete: "name",
    maxLength: 160,
  },
  {
    key: "phone",
    label: "checkout.label2",
    autoComplete: "tel",
    type: "tel",
    maxLength: MAX_PHONE_LENGTH,
  },
  {
    key: "email",
    label: "checkout.email",
    autoComplete: "email",
    type: "email",
    maxLength: 254,
  },
] as const;
const deliveryLabels = {
  branch: "checkout.text6",
  courier: "checkout.text7",
} as const;
const paymentLabels = {
  online: "checkout.onlineCard",
  transfer: "checkout.bankTransfer",
  invoice: "checkout.companyInvoice",
} as const;
const errorMessages = {
  INVALID_CART: "checkout.invalidCart",
  CART_UNAVAILABLE: "checkout.text2",
  INVALID_PROMO: "checkout.promoInvalid",
  PROMOTIONS_UNAVAILABLE: "checkout.promoUnavailable",
  CHECKOUT_UNAVAILABLE: "checkout.unavailable",
} as const;
type FieldName = keyof CheckoutInput;
const fieldNames: FieldName[] = [
  "name",
  "phone",
  "email",
  "city",
  "delivery",
  "address",
  "street",
  "house",
  "apartment",
  "entrance",
  "floor",
  "courierComment",
  "payment",
  "comment",
  "consent",
];

export function Checkout() {
  const t = useTranslator();
  const locale = useLocale();
  const {
    lines,
    summary,
    promotion,
    products,
    checkoutDraft: data,
    setCheckoutDraft: setData,
    setCheckoutDelivery,
    setOverlay,
    applyCartSnapshot,
  } = useStore();
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [message, setMessage] = useState("");
  const [stockErrors, setStockErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [validationTarget, setValidationTarget] = useState<{
    field: FieldName;
  } | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const requestError = useRef<HTMLDivElement>(null);
  const pending = useRef<AbortController | null>(null);
  const attempt = useRef<{ body: string; id: string } | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    if (!busy && validationTarget)
      form.current
        ?.querySelector<HTMLElement>(`#checkout-${validationTarget.field}`)
        ?.focus();
  }, [busy, validationTarget]);
  useEffect(() => {
    if (!busy && message && !summary.overLimit && !validationTarget)
      requestError.current?.focus();
  }, [busy, message, summary.overLimit, validationTarget]);

  function showValidation(validation: CheckoutErrors) {
    setErrors(validation);
    const field = fieldNames.find((name) => validation[name]);
    if (field) setValidationTarget({ field });
  }

  function updateField<K extends FieldName>(field: K, value: CheckoutInput[K]) {
    setData({ ...data, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: undefined });
    setMessage("");
  }

  function validateOnBlur(field: FieldName) {
    if (typeof data[field] !== "string" || !data[field].trim()) return;
    const error = validateCheckout(data, t)[field];
    setErrors((current) => ({ ...current, [field]: error }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !summary.canCheckout) return;
    setMessage("");
    setStockErrors([]);
    const validation = validateCheckout(data, t);
    if (!data.cityRef) validation.city = t("delivery.selectCity");
    if (data.delivery === "courier" && !data.streetRef)
      validation.street = t("delivery.selectStreet");
    if (data.delivery === "branch" && !data.branchRef)
      validation.address = t("delivery.selectBranch");
    if (Object.keys(validation).length) {
      if (!filled) setMessage(t("checkout.completeFields"));
      showValidation(validation);
      return;
    }
    setErrors({});
    setValidationTarget(null);
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    try {
      const body = JSON.stringify({
        contact: { ...data, phone: normalizePhone(data.phone) },
        items: lines,
        expectedSubtotalMinor: summary.subtotalMinor,
        expectedTotalMinor: promotionTotals(
          summary.subtotalMinor,
          promotion,
          promotionEligibleSubtotal(lines, products, promotion),
        ).totalMinor,
        ...(promotion && { promoCode: promotion.code }),
      });
      if (attempt.current?.body !== body)
        attempt.current = { body, id: crypto.randomUUID() };
      const { response, result } = await postStorefrontJson(
        "/api/checkout",
        locale,
        body,
        {
          signal: controller.signal,
          timeout: 15000,
          idempotencyKey: attempt.current.id,
        },
      );
      if (controller.signal.aborted) return;
      if (response.status === 422 && result?.code === "INVALID_CONTACT") {
        const fieldErrors: CheckoutErrors = {};
        for (const field of fieldNames) {
          if (typeof result.errors?.[field] === "string")
            fieldErrors[field] = result.errors[field];
        }
        if (Object.keys(fieldErrors).length) {
          showValidation(fieldErrors);
          return;
        }
      }
      if (
        response.ok &&
        typeof result?.returnPath === "string" &&
        /^\/(ua|en)\/order\/[a-f\d]{40}$/.test(result.returnPath)
      ) {
        if (typeof result.paymentUrl === "string") {
          const target = new URL(result.paymentUrl);
          if (
            target.protocol === "https:" &&
            ["pay.monobank.ua", "pay.mbnk.biz"].includes(target.hostname)
          ) {
            window.location.assign(target.href);
            return;
          }
        }
        window.location.assign(result.returnPath);
        return;
      }
      const code = result?.code;
      if (
        response.status === 409 &&
        (code === "CART_UNAVAILABLE" || code === "CART_LIMIT")
      ) {
        applyCartSnapshot(result.snapshot);
        if (code === "CART_UNAVAILABLE") {
          setStockErrors(
            lines.flatMap(({ variantId }) =>
              typeof result.errors?.[variantId] === "string"
                ? [result.errors[variantId]]
                : [],
            ),
          );
        }
        setMessage(
          typeof result.message === "string"
            ? result.message
            : t("checkout.text2"),
        );
        return;
      }
      setMessage(
        t(
          !response.ok &&
            typeof code === "string" &&
            Object.hasOwn(errorMessages, code)
            ? errorMessages[code as keyof typeof errorMessages]
            : "checkout.text3",
        ),
      );
    } catch {
      if (!controller.signal.aborted) setMessage(t("checkout.text4"));
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  const filled = Boolean(
    data.name.trim() &&
    data.phone.trim() &&
    data.email.trim() &&
    data.cityRef &&
    (data.delivery === "branch"
      ? data.branchRef
      : data.streetRef && data.house?.trim()) &&
    data.consent,
  );
  return (
    <div className="co">
      <div>
        <h2 id="checkout-title" className="h2 mb-7">
          {t("checkout.heading1")}
        </h2>
        <form ref={form} onSubmit={submit} noValidate aria-busy={busy}>
          <fieldset disabled={busy} className="checkout-fields">
            {fields.map((field) => (
              <div
                className={`field ${ui.field}${errors[field.key] ? " err" : ""}`}
                key={field.key}
              >
                <label htmlFor={`checkout-${field.key}`}>
                  {t(field.label)}
                </label>
                <input
                  id={`checkout-${field.key}`}
                  className={`in ${ui.in}`}
                  type={"type" in field ? field.type : "text"}
                  autoComplete={field.autoComplete}
                  placeholder={
                    field.key === "phone"
                      ? t("checkout.phonePlaceholder")
                      : undefined
                  }
                  inputMode={field.key === "phone" ? "tel" : undefined}
                  maxLength={field.maxLength}
                  value={data[field.key]}
                  onChange={(event) =>
                    updateField(
                      field.key,
                      field.key === "phone"
                        ? readPhoneInput(event.currentTarget)
                        : event.currentTarget.value,
                    )
                  }
                  onBlur={() => validateOnBlur(field.key)}
                  required
                  aria-invalid={Boolean(errors[field.key])}
                  aria-describedby={
                    errors[field.key] ? `hint-${field.key}` : undefined
                  }
                />
                <FormFeedback id={`hint-${field.key}`} className="hint">
                  {errors[field.key]}
                </FormFeedback>
              </div>
            ))}
            <fieldset className="field">
              <legend>{t("checkout.text5")}</legend>
              <p className="mb-3 text-sm text-black/60">
                {t("delivery.provider")}
              </p>
              <div className="choice flex flex-wrap gap-2">
                {deliveryMethods.map((type) => (
                  <label key={type}>
                    <input
                      type="radio"
                      id={type === "branch" ? "checkout-delivery" : undefined}
                      name="delivery"
                      value={type}
                      checked={data.delivery === type}
                      aria-describedby={
                        errors.delivery ? "hint-delivery" : undefined
                      }
                      onChange={() => {
                        setCheckoutDelivery(type);
                        setErrors({
                          ...errors,
                          delivery: undefined,
                          address: undefined,
                          street: undefined,
                          house: undefined,
                          apartment: undefined,
                          floor: undefined,
                          entrance: undefined,
                          courierComment: undefined,
                        });
                        setMessage("");
                      }}
                    />
                    <span className={ui.draftUnderline}>
                      {t(deliveryLabels[type])}
                    </span>
                  </label>
                ))}
              </div>
              <FormFeedback id="hint-delivery" className="hint">
                {errors.delivery}
              </FormFeedback>
            </fieldset>
            <CheckoutDeliveryFields
              data={data}
              setData={setData}
              errors={errors}
              setErrors={setErrors}
              updateField={updateField}
            />
            <fieldset className="field">
              <legend>{t("checkout.text8")}</legend>
              <div className="choice checkout-payment-options">
                {paymentMethods.map((method) => (
                  <label key={method}>
                    <input
                      type="radio"
                      id={method === "online" ? "checkout-payment" : undefined}
                      name="payment"
                      value={method}
                      checked={(data.payment ?? "online") === method}
                      onChange={() => updateField("payment", method)}
                      aria-describedby={
                        errors.payment ? "hint-payment" : undefined
                      }
                    />
                    <span className={ui.draftUnderline}>
                      {t(paymentLabels[method])}
                    </span>
                  </label>
                ))}
              </div>
              <FormFeedback id="hint-payment" className="hint">
                {errors.payment}
              </FormFeedback>
            </fieldset>
            <div className={`field ${ui.field}`}>
              <label htmlFor="checkout-comment">{t("checkout.text9")}</label>
              <textarea
                id="checkout-comment"
                aria-invalid={Boolean(errors.comment)}
                aria-describedby={errors.comment ? "hint-comment" : undefined}
                className={`in ${ui.in}`}
                maxLength={1000}
                value={data.comment}
                onChange={(event) => updateField("comment", event.target.value)}
                onInput={(event) => fitCommentHeight(event.currentTarget)}
              />
              <FormFeedback id="hint-comment" className="hint">
                {errors.comment}
              </FormFeedback>
            </div>
            <div className="field">
              <label className="checkout-consent check flex items-start gap-[10px]">
                <input
                  id="checkout-consent"
                  type="checkbox"
                  checked={data.consent}
                  onChange={(event) =>
                    updateField("consent", event.target.checked)
                  }
                  aria-invalid={Boolean(errors.consent)}
                  aria-describedby={errors.consent ? "hint-consent" : undefined}
                  required
                />
                <span className={ui.draftUnderline}>
                  {t("checkout.text10")}
                  <a
                    href={localizedPath(locale, "/offer#privacy")}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("forms.privacyLink")}
                  </a>
                  .
                </span>
              </label>
              <FormFeedback id="hint-consent" className="hint">
                {errors.consent}
              </FormFeedback>
            </div>
          </fieldset>
          <FormFeedback
            className="form-err checkout-feedback"
            ref={requestError}
            tabIndex={-1}
            role="alert"
          >
            {message && !summary.overLimit && (
              <>
                <p>{message}</p>
                {stockErrors.length > 0 && (
                  <ul className="mt-2 list-disc pl-5">
                    {stockErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </FormFeedback>
          {!summary.canCheckout && (
            <p className="form-err" role="status">
              {summary.overLimit ? (
                <CartFeedback
                  error={{ kind: "subtotal" }}
                  onClose={() => setOverlay(null)}
                />
              ) : (
                !message &&
                t(lines.length ? "checkout.text2" : "cart.paragraph1")
              )}
            </p>
          )}
          <SubmitButton
            busy={busy}
            disabled={!summary.canCheckout}
            aria-disabled={!filled || !summary.canCheckout}
            className="btn btn--fill aria-disabled:!border-[#a6a6a6] aria-disabled:!bg-[#a6a6a6] aria-disabled:!text-white"
          >
            {t(
              data.payment === "online"
                ? "checkout.submitOnline"
                : "checkout.submit",
            )}
          </SubmitButton>
        </form>
      </div>
      <aside className="co-sum">
        <p className="eyebrow mb-3">{t("cart.title")}</p>
        {lines.map((line) => {
          const match = findVariant(products, line.variantId);
          return match ? (
            <div className="summary-line" key={line.variantId}>
              <span>
                {match.product.name}, {match.variant.weightGrams}
                {t("checkout.text11")}
                {line.quantity}
              </span>
              <span>
                {formatMoney(match.variant.priceMinor * line.quantity, locale)}
              </span>
            </div>
          ) : null;
        })}
        <CartTotals />
      </aside>
    </div>
  );
}
