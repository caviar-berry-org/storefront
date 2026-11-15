"use client";

import { useTranslator } from "@/i18n/client";
import { useEffect, useId, useRef, useState } from "react";
import { primaryPhone } from "@/content/contacts";

const phone = primaryPhone.tel;

export function FloatingContact() {
  const t = useTranslator();
  const id = useId();
  const contact = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !contact.current?.contains(event.target)
      )
        setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div
      ref={contact}
      className="floating-contact fixed right-[max(16px,env(safe-area-inset-right))] bottom-[max(16px,env(safe-area-inset-bottom))] z-40"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (!open || event.key !== "Escape") return;
        event.stopPropagation();
        close();
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="grid size-[58px] place-items-center rounded-full bg-[var(--b-gold)] text-white shadow-[0_8px_24px_#00000038] transition-colors hover:bg-[var(--b-gold-d)]"
        aria-label={t("contactButton.label")}
        aria-controls={id}
        aria-expanded={open}
        title={t("contactButton.label")}
        onClick={() => setOpen((current) => !current)}
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M6.6 10.8c1.5 3 3.9 5.4 6.9 6.9l2.3-2.3c.3-.3.7-.4 1.1-.2 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1v3.5c0 .6-.4 1-1 1C10.7 21.3 2.7 13.3 2.7 3.3c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.2 1.1l-2 2.6Z" />
        </svg>
      </button>
      <div
        id={id}
        hidden={!open}
        className="floating-contact-menu absolute right-0 bottom-[calc(100%+10px)] w-max"
      >
        <a
          href="https://t.me/ukrainian_caviar"
          target="_blank"
          rel="noopener noreferrer"
          onClick={close}
        >
          {t("contactButton.telegram")}
        </a>
        <a href={`tel:${phone}`} onClick={close}>
          {t("inquiry.call")}
        </a>
      </div>
    </div>
  );
}
