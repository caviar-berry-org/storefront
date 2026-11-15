"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAdminNavigation } from "../shell/admin-navigation";
import { StaffNotice, StaffSpinner } from "../staff-feedback";
import { catalogStaffCopy as copy } from "@/i18n/catalog-staff-uk";
import styles from "./catalog.module.css";
import { AdminLink } from "../admin-link";
import { StaffConfirm } from "../staff-confirm";

type Result =
  { id: string } | { error: keyof typeof copy.errors; field?: string };

function revealField(field: HTMLElement) {
  const section = field.closest<HTMLDetailsElement>("[data-catalog-section]");
  if (section) section.open = true;
  return field.matches('input[type="hidden"]')
    ? (field.parentElement?.querySelector<HTMLElement>('input[type="file"]') ??
        section?.querySelector("summary"))
    : field;
}

export function CatalogEditorForm({
  save,
  back,
  children,
  successHref,
  confirm,
}: {
  save: (data: FormData) => Promise<Result>;
  back: string;
  successHref?: (id: string, form: FormData) => string;
  /** Return a consequence to state before saving, or null to save straight away. */
  confirm?: (
    data: FormData,
  ) => { title: string; body: string; label: string } | null;
  children: (error: (name: string) => string | undefined) => ReactNode;
}) {
  const router = useRouter();
  const navigation = useAdminNavigation();
  const lock = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<
    (Exclude<Result, { id: string }> & { inline?: boolean }) | null
  >(null);
  const [pendingSave, setPendingSave] = useState<{
    data: FormData;
    title: string;
    body: string;
    label: string;
  } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || navigation?.pending) return;
    const form = event.currentTarget;
    if (form.querySelector("[data-uploading]")) {
      setFailure({ error: "invalid" });
      return;
    }
    const data = new FormData(form);
    const consequence = confirm?.(data);
    if (consequence) {
      setFailure(null);
      setPendingSave({ data, ...consequence });
      return;
    }
    await commit(form, data);
  }

  async function commit(form: HTMLFormElement, submitted: FormData) {
    lock.current = true;
    setBusy(true);
    setFailure(null);
    try {
      const result = await save(submitted);
      if ("id" in result) {
        const href = successHref?.(result.id, submitted) ?? back;
        if (navigation) navigation.navigate(href, { replace: true });
        else router.replace(href);
        return;
      }
      let inline = false;
      if (result.field) {
        const field = Array.from(form.elements).find(
          (element) => element.getAttribute("name") === result.field,
        );
        if (field instanceof HTMLElement) {
          inline = field.hasAttribute("data-staff-text");
          const target = revealField(field);
          target?.focus({ preventScroll: true });
          target?.scrollIntoView({ block: "nearest" });
        }
      }
      setFailure({ ...result, inline });
    } catch {
      setFailure({ error: "unavailable" });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form
      ref={formRef}
      className={styles.form}
      onSubmit={submit}
      onInput={(event) => {
        if (
          event.target instanceof HTMLElement &&
          failure?.field === event.target.getAttribute("name")
        )
          setFailure(null);
      }}
      onInvalidCapture={(event) => {
        const first = event.currentTarget.querySelector(
          "input:invalid, select:invalid, textarea:invalid",
        );
        if (first instanceof HTMLElement && event.target === first) {
          const target = revealField(first);
          target?.focus({ preventScroll: true });
          target?.scrollIntoView({ block: "nearest" });
        }
      }}
      aria-busy={busy}
    >
      {children((name) =>
        failure?.field === name ? copy.errors[failure.error] : undefined,
      )}
      {failure && !failure.inline && (
        <StaffNotice
          message={copy.errors[failure.error]}
          guidance={failure.error === "unavailable" ? "technical" : undefined}
        />
      )}
      <div className={styles.controls}>
        <button
          type="submit"
          className={styles.primary}
          disabled={busy || navigation?.pending}
        >
          {busy && <StaffSpinner />}
          {busy ? copy.loading : copy.save}
        </button>
        <AdminLink
          href={back}
          className={styles.button}
          aria-disabled={busy || undefined}
        >
          {copy.cancel}
        </AdminLink>
      </div>
      <StaffConfirm
        open={pendingSave !== null}
        title={pendingSave?.title ?? ""}
        body={pendingSave?.body ?? ""}
        confirmLabel={pendingSave?.label ?? copy.save}
        busy={busy}
        onConfirm={() => {
          const queued = pendingSave;
          const form = formRef.current;
          if (!queued || !form) return;
          setPendingSave(null);
          void commit(form, queued.data);
        }}
        onDismiss={() => {
          if (!busy) setPendingSave(null);
        }}
      />
    </form>
  );
}
