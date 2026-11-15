"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslator } from "@/i18n/client";
import type { DeliveryOption } from "@/domain/delivery";
import { ui } from "@/components/ui/styles";
import { FormFeedback } from "@/components/forms/form-feedback";
export function DeliveryField({
  kind,
  cityRef,
  value,
  selected,
  onChange,
  onSelect,
  error,
}: {
  kind: "cities" | "branches" | "streets";
  cityRef?: string;
  value: string;
  selected?: string;
  onChange: (value: string) => void;
  onSelect: (option: DeliveryOption) => void;
  error?: string;
}) {
  const t = useTranslator();
  const id =
    kind === "cities" ? "city" : kind === "streets" ? "street" : "address";
  const listId = useId();
  const [options, setOptions] = useState<DeliveryOption[]>([]);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [active, setActive] = useState(-1);
  const field = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (
      !open ||
      selected ||
      (kind !== "branches" && value.trim().length < 2) ||
      (kind !== "cities" && !cityRef)
    )
      return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState("loading");
      setActive(-1);
      try {
        const query = new URLSearchParams({
          kind,
          q: value,
          ...(cityRef && { city: cityRef }),
        });
        const response = await fetch(`/api/delivery?${query}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.options)) throw new Error();
        if (!controller.signal.aborted) {
          setOptions(data.options);
          setState("done");
        }
      } catch {
        if (!controller.signal.aborted) {
          setOptions([]);
          setState("error");
        }
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, selected, kind, cityRef, value]);
  const choose = (option: DeliveryOption) => {
    onSelect(option);
    setOpen(false);
    setOptions([]);
    setActive(-1);
  };
  return (
    <div
      ref={field}
      className={`field relative ${ui.field}${error ? " err" : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <label htmlFor={`checkout-${id}`}>
        {t(
          kind === "cities"
            ? "checkout.label3"
            : kind === "streets"
              ? "delivery.street"
              : "checkout.addressBranch",
        )}
      </label>
      <input
        id={`checkout-${id}`}
        className={`in ${ui.in}`}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && !selected}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={`hint-${id}`}
        autoComplete="off"
        value={value}
        maxLength={120}
        disabled={kind !== "cities" && !cityRef}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setOptions([]);
          setState("idle");
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive((index) =>
              Math.max(
                0,
                Math.min(
                  options.length - 1,
                  index + (event.key === "ArrowDown" ? 1 : -1),
                ),
              ),
            );
          }
          if (event.key === "Enter" && open && active >= 0 && options[active]) {
            event.preventDefault();
            choose(options[active]);
          }
        }}
        required
      />
      {open && !selected && (
        <div className="absolute top-full z-20 max-h-64 w-full overflow-y-auto border border-black/15 bg-[#faf9f6] shadow-lg">
          <ul
            id={listId}
            role="listbox"
            aria-label={t(
              kind === "cities"
                ? "checkout.label3"
                : kind === "streets"
                  ? "delivery.street"
                  : "checkout.addressBranch",
            )}
          >
            {options.map((option, index) => (
              <li
                key={option.ref}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={active === index}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  className={`min-h-11 w-full px-3 py-2 text-left text-sm hover:bg-black/5 ${active === index ? "bg-black/10" : ""}`}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
          {state !== "idle" && options.length === 0 && (
            <p className="p-3 text-sm" role="status">
              {t(
                state === "loading"
                  ? "delivery.loading"
                  : state === "error"
                    ? "delivery.unavailable"
                    : "delivery.empty",
              )}
            </p>
          )}
        </div>
      )}
      <FormFeedback id={`hint-${id}`} className="hint">
        {error}
      </FormFeedback>
    </div>
  );
}
