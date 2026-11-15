"use client";

import { FormFeedback } from "@/components/forms/form-feedback";
import { useTranslator } from "@/i18n/client";
import { MAX_QUANTITY } from "@/domain/cart";
import { useId, useState, type ReactNode } from "react";

export function Quantity({
  value,
  onChange,
  min = 1,
  max = MAX_QUANTITY,
  label,
  className = "",
  rangeMessage,
  feedback,
  busy = false,
}: {
  value: number;
  onChange: (n: number, manual?: boolean) => void;
  min?: number;
  max?: number;
  label?: string;
  className?: string;
  rangeMessage?: string;
  feedback?: ReactNode;
  busy?: boolean;
}) {
  const t = useTranslator();
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [feedbackKind, setFeedbackKind] = useState<
    "range" | "max" | "adjusted" | null
  >(null);

  function commit() {
    if (draft === null) return;
    setDraft(null);
    const next = Number(draft);
    if (!/^\d+$/.test(draft) || !Number.isSafeInteger(next) || next < min) {
      setFeedbackKind("range");
      return;
    }
    if (next > max && max <= min) {
      setFeedbackKind("max");
      return;
    }
    const accepted = Math.min(next, max);
    setFeedbackKind(next > max ? "adjusted" : null);
    if (accepted !== value) onChange(accepted, true);
  }

  function step(next: number) {
    setFeedbackKind(null);
    setDraft(null);
    onChange(next);
  }

  return (
    <div className={className}>
      <div
        className="qty inline-flex max-w-full items-center [border:1px_solid_var(--line)]"
        role="group"
        aria-label={label ?? t("quantity.text1")}
      >
        <button
          type="button"
          disabled={busy || value <= min}
          onClick={() => step(value - 1)}
          aria-label={t("quantity.ariaLabel1")}
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="w-9 min-w-0 bg-transparent text-center [border:0]"
          value={draft ?? String(value)}
          aria-label={label ?? t("quantity.text1")}
          aria-invalid={feedbackKind === "range" || feedbackKind === "max"}
          aria-describedby={feedbackKind || feedback ? id : undefined}
          disabled={busy || max < min}
          onChange={(event) => {
            setFeedbackKind(null);
            setDraft(event.target.value);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
        <button
          type="button"
          disabled={busy || value >= max}
          onClick={() => step(value + 1)}
          aria-label={t("quantity.ariaLabel2")}
        >
          +
        </button>
      </div>
      <FormFeedback
        id={id}
        className="pt-1 text-xs text-[var(--muted)]"
        role="alert"
      >
        {feedbackKind === "adjusted" && feedback
          ? feedback
          : feedbackKind
            ? feedbackKind !== "range" && rangeMessage
              ? rangeMessage
              : t("quantity.range", { min, max })
            : feedback}
      </FormFeedback>
    </div>
  );
}
