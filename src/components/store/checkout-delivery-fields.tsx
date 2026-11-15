"use client";
import { useLayoutEffect, useRef } from "react";
import type { CheckoutInput, CheckoutErrors } from "@/domain/checkout";
import { ui } from "@/components/ui/styles";
import { FormFeedback } from "@/components/forms/form-feedback";
import { useTranslator } from "@/i18n/client";
import { DeliveryField } from "./delivery-field";
export function CheckoutDeliveryFields({
  data,
  setData,
  errors,
  setErrors,
  updateField,
}: {
  data: CheckoutInput;
  setData: (value: CheckoutInput) => void;
  errors: CheckoutErrors;
  setErrors: (
    value: CheckoutErrors | ((current: CheckoutErrors) => CheckoutErrors),
  ) => void;
  updateField: <K extends keyof CheckoutInput>(
    key: K,
    value: CheckoutInput[K],
  ) => void;
}) {
  const t = useTranslator();
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const frame = outer.current;
    const content = inner.current;
    if (!frame || !content) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const measure = () => {
      const height = content.getBoundingClientRect().height;
      if (
        frame.style.height &&
        Math.abs(parseFloat(frame.style.height) - height) < 1
      )
        return;
      frame.dataset.resizing = "true";
      frame.style.height = `${height}px`;
      clearTimeout(timer);
      timer = setTimeout(() => {
        frame.dataset.resizing = "false";
      }, 280);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = inner.current?.animate(
      [
        { opacity: 0.6, transform: "translateY(4px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 240, easing: "ease-out" },
    );
    return () => animation?.cancel();
  }, [data.delivery]);
  return (
    <>
      <DeliveryField
        kind="cities"
        value={data.city}
        selected={data.cityRef}
        error={errors.city}
        onChange={(value) => {
          setData({
            ...data,
            city: value,
            cityRef: undefined,
            address: "",
            branchRef: undefined,
            street: "",
            streetRef: undefined,
          });
          setErrors((current) => ({
            ...current,
            city: undefined,
            address: undefined,
          }));
        }}
        onSelect={(option) => {
          setData({
            ...data,
            city: option.label,
            cityRef: option.ref,
            address: "",
            branchRef: undefined,
            street: "",
            streetRef: undefined,
          });
          setErrors((current) => ({ ...current, city: undefined }));
        }}
      />
      <div
        ref={outer}
        className="relative transition-[height] duration-[280ms] ease-out data-[resizing=true]:overflow-hidden motion-reduce:transition-none"
      >
        <div ref={inner} className="flow-root">
          {data.delivery === "branch" ? (
            <DeliveryField
              kind="branches"
              cityRef={data.cityRef}
              value={data.address}
              selected={data.branchRef}
              error={errors.address}
              onChange={(value) => {
                setData({ ...data, address: value, branchRef: undefined });
                setErrors((current) => ({ ...current, address: undefined }));
              }}
              onSelect={(option) => {
                setData({
                  ...data,
                  address: option.label,
                  branchRef: option.ref,
                });
                setErrors((current) => ({ ...current, address: undefined }));
              }}
            />
          ) : (
            <>
              <DeliveryField
                kind="streets"
                cityRef={data.cityRef}
                value={data.street ?? ""}
                selected={data.streetRef}
                error={errors.street}
                onChange={(value) => {
                  setData({
                    ...data,
                    street: value,
                    streetRef: undefined,
                    address: value,
                  });
                  setErrors((current) => ({
                    ...current,
                    street: undefined,
                    address: undefined,
                  }));
                }}
                onSelect={(option) => {
                  setData({
                    ...data,
                    street: option.label,
                    streetRef: option.ref,
                    address: option.label,
                  });
                  setErrors((current) => ({
                    ...current,
                    street: undefined,
                    address: undefined,
                  }));
                }}
              />
              <div className="grid grid-cols-2 gap-x-4">
                {(["house", "apartment", "entrance", "floor"] as const).map(
                  (key) => (
                    <div
                      key={key}
                      className={`field ${ui.field}${errors[key] ? " err" : ""}`}
                    >
                      <label htmlFor={`checkout-${key}`}>
                        {t(`delivery.${key}`)}
                      </label>
                      <input
                        id={`checkout-${key}`}
                        className={`in ${ui.in}`}
                        value={data[key] ?? ""}
                        maxLength={20}
                        required={key === "house"}
                        autoComplete={key === "house" ? "address-line2" : "off"}
                        onChange={(event) =>
                          updateField(key, event.target.value)
                        }
                        aria-invalid={Boolean(errors[key])}
                        aria-describedby={`hint-${key}`}
                      />
                      <FormFeedback id={`hint-${key}`} className="hint">
                        {errors[key]}
                      </FormFeedback>
                    </div>
                  ),
                )}
              </div>
              <div className={`field ${ui.field}`}>
                <label htmlFor="checkout-courierComment">
                  {t("delivery.courierComment")}
                </label>
                <textarea
                  id="checkout-courierComment"
                  className={`in ${ui.in}`}
                  maxLength={500}
                  value={data.courierComment ?? ""}
                  onChange={(event) =>
                    updateField("courierComment", event.target.value)
                  }
                  aria-invalid={Boolean(errors.courierComment)}
                  aria-describedby="hint-courierComment"
                />
                <FormFeedback id="hint-courierComment" className="hint">
                  {errors.courierComment}
                </FormFeedback>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
