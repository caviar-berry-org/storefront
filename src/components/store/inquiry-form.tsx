"use client";
import { contacts } from "@/content/contacts";
import { useId, useState, type FormEvent } from "react";
import { ui } from "@/components/ui/styles";
import { useTranslator } from "@/i18n/client";
import {
  kyivDate,
  nextCalendarDate,
  validateInquiry,
  type InquiryKind,
  type InquiryErrors,
  type InquiryInput,
} from "@/domain/inquiry";
import { MAX_PHONE_LENGTH, normalizeInquiryPhone } from "@/domain/contact";
import { FormFeedback } from "@/components/forms/form-feedback";
import { readPhoneInput } from "@/components/forms/phone-input";
import { Field } from "@/components/forms/field";
import { Consent } from "@/components/forms/consent";
import { SubmitButton } from "@/components/ui/submit-button";
import { useInquiry } from "@/hooks/use-inquiry";
import { SubmissionStage } from "./submission-stage";
import { StorefrontLink } from "./storefront-link";

export function InquiryForm({
  title,
  kind,
  onClose,
  corporate = false,
  targetId,
  targetLabel,
  variantId,
}: {
  title: string;
  kind: InquiryKind;
  onClose: () => void;
  corporate?: boolean;
  targetId?: string;
  targetLabel?: string;
  variantId?: string;
}) {
  const t = useTranslator();
  const id = useId();
  const [errors, setErrors] = useState<InquiryErrors>({});
  const [serverErrors, setServerErrors] = useState<
    Partial<Record<keyof InquiryInput, string>>
  >({});
  const [complete, setComplete] = useState(false);
  const { busy, feedback, success, send } = useInquiry();
  const notify = kind === "notify";
  const write = kind === "write";
  const gift = kind === "gift";
  const today = kyivDate();
  const error = (key: keyof InquiryInput) =>
    errors[key] ? t(`inquiry.error.${errors[key]}`) : serverErrors[key];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const data: InquiryInput = {
      name: String(values.get("name") ?? ""),
      contact: String(values.get("contact") ?? ""),
      date: String(values.get("date") ?? ""),
      comment: String(values.get("comment") ?? ""),
      consent: values.get("consent") === "on",
    };
    const next = validateInquiry(data, kind, kyivDate());
    if (
      form.querySelector<HTMLInputElement>('input[name="date"]')?.validity
        .badInput
    )
      next.date = "dateFormat";
    setServerErrors({});
    setErrors(next);
    if (Object.keys(next).length) {
      form
        .querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)
        ?.focus();
      return;
    }
    const result = await send(
      kind,
      title,
      {
        ...data,
        contact: normalizeInquiryPhone(data.contact) ?? data.contact.trim(),
      },
      targetId,
      variantId,
      String(values.get("website") ?? ""),
    );
    if (result) {
      setServerErrors(result);
      form
        .querySelector<HTMLElement>(`[name="${Object.keys(result)[0]}"]`)
        ?.focus();
    }
  }
  return (
    <SubmissionStage
      success={success}
      title={t("submission.title")}
      description={t(
        notify
          ? "submission.notifyBody"
          : write
            ? "submission.writeBody"
            : "submission.giftBody",
      )}
      onClose={onClose}
    >
      <form
        className="inquiry-form mx-auto grid w-full min-w-0 max-w-[620px] grid-cols-[minmax(0,1fr)] gap-[18px] px-[clamp(20px,4vw,48px)] pt-[clamp(56px,6vw,72px)] pb-10"
        onChange={(event) => {
          const form = event.currentTarget;
          const values = new FormData(form);
          setComplete(
            Boolean(
              String(values.get("name") ?? "").trim() &&
              String(values.get("contact") ?? "").trim() &&
              values.get("consent") === "on" &&
              (!write || String(values.get("comment") ?? "").trim()),
            ),
          );
          const key = (event.target as unknown as HTMLInputElement)
            .name as keyof InquiryInput;
          setErrors((current) => ({ ...current, [key]: undefined }));
          setServerErrors((current) => ({ ...current, [key]: undefined }));
        }}
        onSubmit={submit}
        noValidate
        aria-busy={busy}
      >
        <div hidden aria-hidden="true">
          <input
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-label={t("newsletter.website")}
          />
        </div>
        <h2 className="h3">{title}</h2>
        {targetLabel && <p>{targetLabel}</p>}
        {write && <p>{t("inquiry.intro")}</p>}
        <fieldset
          disabled={busy}
          className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-[18px] border-0"
        >
          <Field
            name="name"
            label={t(notify || write ? "inquiry.shortName" : "checkout.label1")}
            autoComplete="name"
            required
            minLength={notify ? 2 : undefined}
            maxLength={160}
            error={error("name")}
          />
          <Field
            name="contact"
            label={t(
              notify
                ? "inquiry.notifyEmail"
                : kind === "gift"
                  ? "inquiry.phone"
                  : "inquiry.contact",
            )}
            type={notify ? "email" : kind === "gift" ? "tel" : "text"}
            inputMode={gift ? "tel" : write ? "email" : undefined}
            onInput={
              gift
                ? (event) => {
                    readPhoneInput(event.currentTarget);
                  }
                : undefined
            }
            autoComplete={kind === "gift" ? "tel" : "email"}
            placeholder={gift ? t("inquiry.phonePlaceholder") : undefined}
            required
            maxLength={gift ? MAX_PHONE_LENGTH : 254}
            error={error("contact")}
          />
          {kind === "gift" && !corporate && (
            <Field
              name="date"
              type="date"
              label={
                <span className={ui.draftUnderline}>{t("inquiry.date")}</span>
              }
              min={nextCalendarDate(today)}
              onChange={() => {
                setErrors((current) => ({ ...current, date: undefined }));
                setServerErrors((current) => ({ ...current, date: undefined }));
              }}
              error={error("date")}
            />
          )}
          {!notify && (
            <Field
              multiline
              name="comment"
              label={t(write ? "inquiry.message" : "checkout.text9")}
              maxLength={1000}
              error={error("comment")}
            />
          )}
          <Consent
            id={`${id}-consent`}
            error={error("consent")}
            description={notify ? t("inquiry.notifyConsent") : undefined}
          />
        </fieldset>
        <div>
          <FormFeedback role="alert">
            {feedback.message && (
              <p className="inquiry-feedback [background:#f6e5e1] [color:#7e2a1e] p-[12px_14px] text-[16px]">
                {feedback.message}{" "}
                {feedback.showContacts && (
                  <StorefrontLink
                    className="underline"
                    section="contacts"
                    beforeNavigate={onClose}
                  >
                    {t("inquiry.goToContacts")}
                  </StorefrontLink>
                )}
                {!notify && (
                  <a
                    className="underline"
                    href={`tel:${contacts.phones[0].tel}`}
                  >
                    {t("inquiry.call")}
                  </a>
                )}
              </p>
            )}
          </FormFeedback>
          <SubmitButton
            busy={busy}
            disabled={!complete}
            busyLabel={t("submission.sending")}
            className="btn btn--fill w-full"
          >
            {t(
              corporate
                ? "inquiry.corporateSubmit"
                : kind === "gift"
                  ? "gifts.text6"
                  : kind === "notify"
                    ? "inquiry.notifySubmit"
                    : "inquiry.send",
            )}
          </SubmitButton>
        </div>
      </form>
    </SubmissionStage>
  );
}
