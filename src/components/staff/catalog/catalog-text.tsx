"use client";

import { useId, useState, type ReactNode } from "react";
import { catalogStaffCopy as copy } from "@/i18n/catalog-staff-uk";
import { StaffFieldError } from "../staff-feedback";
import styles from "./catalog.module.css";

export function CatalogText({
  name,
  label,
  value = "",
  required = false,
  limit,
  area = false,
  pattern,
  type = "text",
  inputMode,
  onValueChange,
  error,
}: {
  name: string;
  label: ReactNode;
  value?: string | number;
  required?: boolean;
  limit?: number;
  area?: boolean;
  pattern?: string;
  type?: string;
  inputMode?: "decimal" | "numeric";
  onValueChange?: (value: string) => void;
  error?: string;
}) {
  const id = useId();
  const [clientError, setClientError] = useState("");
  const feedback = clientError || error;
  const props = {
    id,
    name,
    required,
    maxLength: limit,
    defaultValue: value,
    "aria-invalid": Boolean(feedback),
    "data-staff-text": true,
    onInvalid: (
      event: React.InvalidEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      event.preventDefault();
      setClientError(copy.confirmValue);
    },
    "aria-describedby": feedback ? `${id}-error` : undefined,
    onBlur: (
      event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      const field = event.currentTarget;
      setClientError(
        !field.validity.valid || (required && !field.value.trim())
          ? copy.confirmValue
          : "",
      );
    },
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      setClientError("");
      onValueChange?.(event.currentTarget.value);
    },
  };
  return (
    <label className={styles.field} htmlFor={id}>
      <span>{label}</span>
      {area ? (
        <textarea {...props} />
      ) : (
        <input {...props} type={type} inputMode={inputMode} pattern={pattern} />
      )}
      <StaffFieldError id={`${id}-error`} message={feedback} />
    </label>
  );
}
