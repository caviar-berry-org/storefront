"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { localeFromPath, localizedPath } from "@/i18n/routing";
import { useStore } from "./store-provider";
import { usePromotionOffer } from "./promotion-offer";

const seenKey = "ucb-pop";
let seenWithoutStorage = false;

function wasShown() {
  try {
    return sessionStorage.getItem(seenKey) !== null;
  } catch {
    return seenWithoutStorage;
  }
}

export function NewsletterPrompt() {
  const path = usePathname();
  const { setOverlay } = useStore();
  const { enabled } = usePromotionOffer();

  useEffect(() => {
    if (
      !enabled ||
      path !== localizedPath(localeFromPath(path)) ||
      wasShown() ||
      new URLSearchParams(location.search).has("static")
    )
      return;

    const delay = matchMedia("(max-width:560px)").matches ? 25000 : 12000;
    let timer = window.setTimeout(show, delay);

    function show() {
      if (wasShown()) return;
      if (
        document.hidden ||
        document.querySelector("dialog[open]") ||
        document.querySelector(
          '.floating-contact button[aria-expanded="true"]',
        ) ||
        document.activeElement?.matches("input, textarea, select")
      ) {
        timer = window.setTimeout(show, 1000);
        return;
      }
      try {
        sessionStorage.setItem(seenKey, "1");
      } catch {
        seenWithoutStorage = true;
      }
      setOverlay({ type: "newsletter" });
    }

    return () => clearTimeout(timer);
  }, [path, setOverlay, enabled]);

  return null;
}
