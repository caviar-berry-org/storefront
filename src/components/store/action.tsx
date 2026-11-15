"use client";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  MouseEvent,
} from "react";
import { useStore } from "./store-provider";

type Shared = {
  action: "gift" | "post" | "write" | "notify";
  value?: string;
  variantId?: string;
};

/**
 * Opens an overlay. With `href` it renders a real link instead of a button, so
 * the destination is crawlable and can be opened in a new tab, while a plain
 * left click still opens the overlay in place.
 */
export function Action({
  action,
  value,
  variantId,
  children,
  href,
  ...props
}: Shared & { children?: React.ReactNode } & (
    | ({ href: string } & AnchorHTMLAttributes<HTMLAnchorElement>)
    | ({ href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)
  )) {
  const { setOverlay } = useStore();
  const open = () => setOverlay({ type: action, value, variantId });

  if (href !== undefined)
    return (
      <a
        {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)}
        href={href}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          // Let the browser handle anything that means "somewhere else".
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          open();
        }}
      >
        {children}
      </a>
    );

  return (
    <button
      {...(props as ButtonHTMLAttributes<HTMLButtonElement>)}
      type="button"
      onClick={open}
    >
      {children}
    </button>
  );
}
