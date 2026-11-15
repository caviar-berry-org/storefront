"use client";
import {
  lockPageScroll,
  unlockPageScroll,
} from "@/components/store/page-scroll-lock";
import { useTranslator } from "@/i18n/client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
  type KeyboardEventHandler,
} from "react";

const DialogCloseContext = createContext<(() => void) | null>(null);
export const useDialogClose = () => useContext(DialogCloseContext);

export function Dialog({
  children,
  title,
  id,
  kind = "modal",
  className = "",
  onClose,
  animateClose = false,
  panelWidth,
  showCloseButton = true,
  initialFocus,
  header,
  onKeyDown,
}: {
  children: ReactNode;
  title: string;
  id?: string;
  kind?: "modal" | "side" | "full" | "pop";
  className?: string;
  onClose: () => void;
  animateClose?: boolean;
  panelWidth?: number;
  showCloseButton?: boolean;
  initialFocus?: string;
  header?: ReactNode;
  onKeyDown?: KeyboardEventHandler<HTMLDialogElement>;
}) {
  const t = useTranslator();
  const ref = useRef<HTMLDialogElement>(null);
  const focusAnchor = useRef<HTMLSpanElement>(null);
  const closeRef = useRef(onClose);
  const closing = useRef(false);
  const backdropPressed = useRef(false);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const el = ref.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    if (!el) return;
    closing.current = false;
    lockPageScroll();
    const anchor = focusAnchor.current;
    anchor?.setAttribute("autofocus", "");
    el.showModal();
    if (document.activeElement !== anchor)
      anchor?.focus({ preventScroll: true });
    if (
      initialFocus &&
      !matchMedia("(max-width: 760px), (pointer: coarse)").matches
    )
      el.querySelector<HTMLElement>(initialFocus)?.focus({
        preventScroll: true,
      });
    return () => {
      el.close();
      if (!document.querySelector("dialog.layer[open]")) unlockPageScroll();
      if (
        previousFocus?.isConnected &&
        document.activeElement !== previousFocus
      )
        previousFocus.focus({ preventScroll: true });
    };
  }, [initialFocus]);
  function requestClose() {
    if (closing.current) return;
    closing.current = true;
    const el = ref.current;
    if (!animateClose || !el) {
      closeRef.current();
      return;
    }
    const panel = el.querySelector<HTMLElement>(".panel");
    if (panel) {
      panel.style.setProperty(
        "--exit-translate",
        getComputedStyle(panel).translate,
      );
      panel.inert = true;
    }
    el.setAttribute("data-closing", "");
    const animations = panel?.getAnimations() ?? [];
    void Promise.allSettled(
      animations.map((animation) => animation.finished),
    ).then(() => {
      if (el.isConnected && el.open) closeRef.current();
    });
  }
  return (
    <dialog
      ref={ref}
      id={id}
      aria-label={title}
      onKeyDown={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest("dialog") === event.currentTarget
        )
          onKeyDown?.(event);
      }}
      className={`layer layer--${kind} is-open ${className}`}
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        event.stopPropagation();
        requestClose();
      }}
      onPointerDown={(event) => {
        backdropPressed.current =
          event.button === 0 && event.target === event.currentTarget;
      }}
      onPointerUp={(event) => {
        backdropPressed.current &&= event.target === event.currentTarget;
      }}
      onPointerCancel={() => {
        backdropPressed.current = false;
      }}
      onClick={(event) => {
        if (backdropPressed.current && event.target === event.currentTarget)
          requestClose();
        backdropPressed.current = false;
      }}
    >
      <span ref={focusAnchor} className="sr" tabIndex={-1} />
      {header}
      <div
        className="panel"
        style={panelWidth ? { width: `min(${panelWidth}px, 100%)` } : undefined}
      >
        {showCloseButton && (
          <button
            type="button"
            className="x"
            onClick={requestClose}
            aria-label={t("common.close")}
          />
        )}
        <DialogCloseContext.Provider value={requestClose}>
          {children}
        </DialogCloseContext.Provider>
      </div>
    </dialog>
  );
}
