"use client";
import { useDialogClose } from "@/components/ui/dialog";
import { useEffect, useRef, type ReactNode } from "react";

export function SubmissionStage({
  success,
  title,
  description,
  children,
  onClose,
}: {
  success: boolean;
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="relative min-h-full">
      <div
        className={success ? "invisible" : undefined}
        inert={success}
        aria-hidden={success || undefined}
      >
        {children}
      </div>
      {success && (
        <SubmissionSuccess
          title={title}
          description={description}
          onClose={onClose}
        />
      )}
    </div>
  );
}

function SubmissionSuccess({
  title,
  description,
  onClose,
}: {
  title: string;
  description: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const requestClose = useDialogClose() ?? onClose;
  const close = useRef(requestClose);
  useEffect(() => {
    close.current = requestClose;
  }, [requestClose]);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const timer = setTimeout(() => close.current(), 5000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className="absolute inset-0 grid content-center justify-items-center gap-5 px-7 py-12 text-center outline-none motion-safe:animate-[photo-enter_280ms_ease_both]"
    >
      <span
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-full border border-solid border-[var(--b-gold)] text-2xl text-[var(--b-gold-d)]"
      >
        ✓
      </span>
      <h2 className="h3">{title}</h2>
      <p className="max-w-[38ch] text-[var(--muted)]">{description}</p>
    </div>
  );
}
