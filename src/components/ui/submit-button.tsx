"use client";
import { useTranslator } from "@/i18n/client";
import type { ButtonHTMLAttributes } from "react";
export function SubmitButton({
  busy,
  busyLabel,
  children,
  className = "btn btn--fill",
  disabled,
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  busy: boolean;
  busyLabel?: string;
}) {
  const t = useTranslator();
  return (
    <button
      {...props}
      type="submit"
      disabled={busy || disabled}
      aria-busy={busy}
      style={busy ? { ...style, opacity: 1 } : style}
      className={`${className}${busy && !busyLabel ? " is-loading" : ""}`}
    >
      <span>{busy && busyLabel ? busyLabel : children}</span>
      {busy && <span className="sr">{t("submitButton.text1")}</span>}
    </button>
  );
}
