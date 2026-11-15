"use client";
import { useId, useState, type ReactNode } from "react";

export function Accordion({
  title,
  children,
  open,
  onToggle,
}: {
  title: ReactNode;
  children: ReactNode;
  open?: boolean;
  onToggle?: () => void;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const isOpen = open ?? expanded;
  return (
    <div className={`acc b-acc${isOpen ? " open" : ""}`}>
      <button
        className="acc-btn"
        type="button"
        aria-expanded={isOpen}
        aria-controls={id}
        onClick={() => (onToggle ? onToggle() : setExpanded(!expanded))}
      >
        {title}
        <span className="acc-ico" aria-hidden="true" />
      </button>
      <div className="acc-panel" id={id} inert={!isOpen}>
        <div className="acc-inner">
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}
