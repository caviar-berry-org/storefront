import { FormFeedback } from "./form-feedback";
import { localizedPath } from "@/i18n/routing";
import { ui } from "@/components/ui/styles";
import { useLocale, useTranslator } from "@/i18n/client";
export function Consent({
  id,
  error,
  description,
}: {
  id: string;
  error?: string;
  description?: string;
}) {
  const t = useTranslator();
  const privacy = localizedPath(useLocale(), "/offer#privacy");
  return (
    <div>
      <label
        className={`check flex gap-[10px] items-start text-[15px] [color:var(--ink-2)] cursor-pointer`}
      >
        <input
          id={id}
          name="consent"
          type="checkbox"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <span className={ui.draftUnderline}>
          {description ?? t("checkout.text10")}
          <a
            className="underline underline-offset-4"
            href={privacy}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("forms.privacyLink")}
          </a>
          .
        </span>
      </label>
      <FormFeedback id={`${id}-error`} className="text-sm text-[#A23A2A]">
        {error}
      </FormFeedback>
    </div>
  );
}
