"use client";
import { ui } from "@/components/ui/styles";
import { useTranslator } from "@/i18n/client";
import { useId, useState, type ReactNode } from "react";
import { Arrow } from "./arrow";
export function HistoryText({ children }: { children: ReactNode }) {
  const t = useTranslator();
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <div
        id={id}
        className={`hist2-txt [grid-column:6/13] grid gap-0 max-w-[760px] sticky top-[88px] max-[640px]:static b-p ${ui.bP} b-rv`}
        data-collapsed={!open || undefined}
      >
        {children}
      </div>
      <button
        type="button"
        className={`b-link ${ui.bLink} hist-more`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {open ? t("expandable.text1") : t("expandable.text2")}
        <Arrow />
      </button>
    </>
  );
}
export function AboutItem({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div
      className={`ls-item w-full grid grid-cols-[minmax(0,_0.8fr)_minmax(0,_1.2fr)] gap-[24px] p-[22px_0] [border-bottom:1px_dotted_var(--b-dot)] max-[640px]:grid-cols-[1fr] max-[640px]:gap-[8px] max-[1180px]:grid-cols-[1fr] max-[1180px]:gap-[8px] b-rv${open ? " open" : ""}`}
    >
      <h3 className={`tc-name ${ui.tcName}`}>
        <span className="max-[640px]:hidden">{title}</span>
        <button
          className="about-toggle flex w-full items-center justify-between text-left uppercase min-[641px]:hidden"
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          {title}
          <span className="acc-ico" aria-hidden="true" />
        </button>
      </h3>
      <div id={id} className="acc-panel about-copy">
        <div className="acc-inner">{children}</div>
      </div>
    </div>
  );
}
