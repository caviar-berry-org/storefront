"use client";

import { useEffect } from "react";
import {
  attributionCookie,
  parseAttribution,
  readAttribution,
  serializeAttribution,
} from "@/domain/attribution";

const ninetyDays = 90 * 24 * 60 * 60;

/**
 * Records which channel brought this visitor, once. First touch wins: a person
 * who arrives from Instagram and later returns through a search result is still
 * credited to Instagram, which is what the channel actually earned.
 *
 * Written client-side into a first-party cookie so the server can read it when
 * an order is created, without spending a request of its own on the visit.
 */
export function VisitAttribution() {
  useEffect(() => {
    try {
      const existing = document.cookie
        .split("; ")
        .find((entry) => entry.startsWith(`${attributionCookie}=`))
        ?.slice(attributionCookie.length + 1);
      if (readAttribution(existing ? decodeURIComponent(existing) : null))
        return;
      const attribution = parseAttribution(location.search, Date.now());
      if (!attribution) return;
      const secure = location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${attributionCookie}=${encodeURIComponent(
        serializeAttribution(attribution),
      )}; Path=/; Max-Age=${ninetyDays}; SameSite=Lax${secure}`;
    } catch {
      /* Blocked storage must never break the page. */
    }
  }, []);
  return null;
}
