import { FormFeedback } from "./form-feedback";
import { fitCommentHeight } from "./fit-comment-height";
import { ui } from "@/components/ui/styles";
import {
  useId,
  type ReactNode,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

type FieldProps = { label: ReactNode; error?: string; hint?: string } & (
  | ({ multiline?: false } & InputHTMLAttributes<HTMLInputElement>)
  | ({ multiline: true } & TextareaHTMLAttributes<HTMLTextAreaElement>)
);
export function Field({ label, error, hint, ...props }: FieldProps) {
  const generated = useId();
  const id = props.id ?? generated;
  const shared = {
    id,
    "aria-invalid": Boolean(error),
    "aria-describedby": error || hint ? `${id}-error` : undefined,
    className: `in ${ui.in}`,
  };
  return (
    <div className={`field ${ui.field}${error ? " err" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {props.multiline ? (
        <textarea
          {...omitMultiline(props)}
          {...shared}
          onInput={(event) => {
            props.onInput?.(event);
            fitCommentHeight(event.currentTarget);
          }}
        />
      ) : (
        <input {...omitMultiline(props)} {...shared} />
      )}
      <FormFeedback
        id={`${id}-error`}
        className={error ? "hint" : "text-sm text-[var(--muted)]"}
      >
        {error ?? hint}
      </FormFeedback>
    </div>
  );
}
function omitMultiline<T extends { multiline?: boolean }>(props: T) {
  const { multiline, ...rest } = props;
  void multiline;
  return rest;
}
