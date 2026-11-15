"use client";
import { localizedPath } from "@/i18n/routing";
import { FormFeedback } from "@/components/forms/form-feedback";
import { postStorefrontJson } from "@/lib/storefront-request";
import { isEmail } from "@/domain/contact";
import { useLocale, useTranslator } from "@/i18n/client";
import { ui } from "@/components/ui/styles";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Arrow } from "@/components/ui/arrow";
import { SubmitButton } from "@/components/ui/submit-button";
import { usePromotionOffer } from "./promotion-offer";
export function NewsletterForm({
  popup = false,
  onSuccess,
}: {
  popup?: boolean;
  onSuccess?: () => void;
}) {
  const t = useTranslator();
  const locale = useLocale();
  const offer = usePromotionOffer();
  const id = useId();
  const [feedback, setFeedback] = useState<{
    kind: "field" | "form";
    message: string;
  } | null>(null);
  const [filled, setFilled] = useState(false);
  // The consent link only earns its space once the field is in use.
  const [engaged, setEngaged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<{
    email: string;
    message: string;
  } | null>(null);
  const invalid = feedback?.kind === "field";
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || confirmed) return;
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "").trim();
    if (!isEmail(email)) {
      setFeedback({
        kind: "field",
        message: t(email ? "checkout.text14" : "newsletter.emailRequired"),
      });
      form
        .querySelector<HTMLInputElement>('input[name="email"]')
        ?.focus({ preventScroll: true });
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setFeedback(null);
    try {
      const { response, result } = await postStorefrontJson(
        "/api/newsletter",
        locale,
        JSON.stringify({
          email,
          website: String(new FormData(form).get("website") ?? ""),
        }),
        { signal: controller.signal, timeout: 30000 },
      );
      if (controller.signal.aborted) return;
      if (response.status === 422 && result?.code === "INVALID_EMAIL") {
        setFeedback({ kind: "field", message: t("checkout.text14") });
        form
          .querySelector<HTMLInputElement>('input[name="email"]')
          ?.focus({ preventScroll: true });
      } else if (response.status === 429) {
        setFeedback({ kind: "form", message: t("newsletter.rateLimited") });
      } else {
        if (response.ok && result?.sent === true) {
          if (onSuccess) {
            onSuccess();
          } else {
            setConfirmed({
              email,
              message: t(
                result.alreadySent
                  ? "newsletter.alreadySent"
                  : "newsletter.sent",
              ),
            });
          }
          return;
        }
        setFeedback({
          kind: "form",
          message: t("newsletter.requestFailed"),
        });
      }
    } catch {
      if (!controller.signal.aborted)
        setFeedback({ kind: "form", message: t("newsletter.networkError") });
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  if (!offer.enabled) return null;
  return (
    <form
      className={
        popup
          ? "mt-[18px] grid gap-2.5"
          : "fb-join col-start-9 col-end-13 grid content-center gap-3"
      }
      onSubmit={submit}
      noValidate
      aria-busy={busy}
    >
      <div hidden aria-hidden="true">
        <label htmlFor={`${id}-website`}>{t("newsletter.website")}</label>
        <input
          id={`${id}-website`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      {!popup && !confirmed && (
        <>
          <p className={`b-label ${ui.bLabel}`}>
            {t("newsletterForm.paragraph1", { percent: offer.percent })}
          </p>
          <p className={`b-p ${ui.bP}`}>{t("newsletterForm.paragraph2")}</p>
        </>
      )}
      {confirmed ? (
        <div
          className="fb-confirmed mt-1.5 flex items-center gap-3"
          role="status"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="m4 12 5 5L20 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
          </svg>
          <span>{confirmed.email}</span>
        </div>
      ) : (
        <div
          className={
            popup
              ? `field ${ui.field}${invalid ? " err" : ""}`
              : "fb-field mt-1.5 flex [border-bottom:1px_solid_currentColor]"
          }
        >
          <label className={popup ? "mb-2 block text-sm" : "sr"} htmlFor={id}>
            {t("contacts.text3")}
          </label>
          <input
            className={popup ? `in ${ui.in}` : "min-w-0"}
            id={id}
            name="email"
            type="email"
            placeholder={popup ? undefined : t("newsletter.emailPlaceholder")}
            autoComplete="email"
            required
            maxLength={254}
            readOnly={busy}
            aria-describedby={invalid ? `${id}-error` : undefined}
            aria-invalid={invalid}
            onFocus={() => setEngaged(true)}
            onChange={(event) => {
              const value = Boolean(event.currentTarget.value.trim());
              setFilled(value);
              if (value) setEngaged(true);
              setFeedback(null);
            }}
          />
          {!popup && (
            <button
              type="submit"
              className="relative grid min-w-11 place-items-center"
              disabled={busy}
              aria-label={t("newsletterForm.ariaLabel1")}
              aria-busy={busy}
            >
              {busy ? (
                <span className="size-4 animate-spin rounded-full border border-solid border-current border-r-transparent motion-reduce:animate-none" />
              ) : (
                <Arrow />
              )}
            </button>
          )}
        </div>
      )}
      {popup && (
        <FormFeedback
          id={`${id}-error`}
          wrapperClassName="popup-feedback data-[visible=false]:-mb-1"
          className="text-sm"
          role="status"
        >
          {invalid ? feedback.message : null}
        </FormFeedback>
      )}
      {!confirmed && (
        <a
          // Kept mounted and sized so revealing it never shifts the layout.
          className={`newsletter-consent text-xs underline underline-offset-4${
            engaged || filled ? "" : " is-idle"
          }`}
          href={localizedPath(locale, "/offer#privacy")}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={engaged || filled ? undefined : -1}
        >
          {t("forms.privacyLink")}
        </a>
      )}
      {popup && (
        <SubmitButton
          busy={busy}
          disabled={!filled}
          busyLabel={t("submission.sending")}
        >
          {t("newsletter.submit")}
        </SubmitButton>
      )}
      <FormFeedback
        id={!popup && invalid ? `${id}-error` : undefined}
        wrapperClassName={popup ? "popup-feedback" : "fb-msg"}
        className={`b-p ${ui.bP} ${popup ? "text-[var(--muted)]" : ""}`}
        role="status"
      >
        {confirmed?.message ??
          (feedback && (!popup || feedback.kind === "form")
            ? feedback.message
            : null)}
      </FormFeedback>
    </form>
  );
}
