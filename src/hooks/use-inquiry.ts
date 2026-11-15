"use client";
import { postStorefrontJson } from "@/lib/storefront-request";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslator } from "@/i18n/client";
import type { InquiryInput, InquiryKind } from "@/domain/inquiry";
export function useInquiry() {
  const t = useTranslator();
  const locale = useLocale();
  const [success, setSuccess] = useState(false);
  const request = useRef<{ body: string; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState({
    message: "",
    showContacts: false,
  });
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function send(
    kind: InquiryKind,
    subject: string,
    data: InquiryInput,
    targetId?: string,
    variantId?: string,
    website = "",
  ) {
    if (pending.current) return;
    const body = JSON.stringify({
      kind,
      subject,
      ...data,
      targetId,
      variantId,
      website,
    });
    if (request.current?.body !== body)
      request.current = { body, id: crypto.randomUUID() };
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setFeedback({ message: "", showContacts: false });
    try {
      const { response, result } = await postStorefrontJson(
        "/api/inquiries",
        locale,
        body,
        {
          signal: controller.signal,
          timeout: 15000,
          idempotencyKey: request.current.id,
        },
      );
      if (!controller.signal.aborted) {
        if (response.ok && result?.accepted === true) {
          setSuccess(true);
          return;
        }
        if (response.status === 422 && result?.errors) {
          const fields = [
            "name",
            "contact",
            "date",
            "comment",
            "consent",
          ] as const;
          const errors = Object.fromEntries(
            fields.flatMap((field) => {
              const message = result.errors[field];
              return typeof message === "string" && message
                ? [[field, message]]
                : [];
            }),
          ) as Partial<Record<keyof InquiryInput, string>>;
          if (Object.keys(errors).length) return errors;
        }
        const showContacts =
          kind === "notify" &&
          !response.ok &&
          response.status !== 422 &&
          response.status !== 409;
        setFeedback({
          message: showContacts
            ? t("inquiry.notifyUnavailable")
            : (result?.message ?? t("inquiry.unavailable")),
          showContacts,
        });
      }
    } catch {
      if (!controller.signal.aborted) {
        const showContacts = kind === "notify";
        setFeedback({
          message: t(
            showContacts
              ? "inquiry.notifyNetworkError"
              : "inquiry.networkError",
          ),
          showContacts,
        });
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      pending.current = null;
    }
  }
  return { busy, feedback, success, send };
}
