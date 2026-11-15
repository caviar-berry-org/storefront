"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getInquiryCounts } from "@/app/(staff)/admin/inquiries/actions";
import type { InquiryCategory } from "@/domain/staff-inquiries";
import { inquiriesCopy as c } from "@/i18n/inquiries-staff-uk";
import s from "../staff.module.css";
export type InquiryCounts = Record<InquiryCategory, number> | null;
const Counts = createContext<InquiryCounts>(null);
export function InquiryCountsProvider({
  initial,
  children,
}: {
  initial: InquiryCounts;
  children: ReactNode;
}) {
  const [counts, setCounts] = useState(initial);
  useEffect(() => {
    let active = true,
      busy = false;
    async function refresh() {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const value = await getInquiryCounts();
        if (active) setCounts(value);
      } catch {
        /* Keep the last confirmed counts on a transient failure. */
      } finally {
        busy = false;
      }
    }
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    window.addEventListener("inquiries-updated", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("inquiries-updated", refresh);
    };
  }, []);
  return <Counts.Provider value={counts}>{children}</Counts.Provider>;
}
export function InquiryCountBadge({
  category,
}: {
  category?: InquiryCategory;
}) {
  const counts = useContext(Counts);
  if (!counts) return null;
  const count = category
    ? counts[category]
    : counts.contact + counts.corporate + counts.gifts;
  return count > 0 ? (
    <span
      className={s.inquiryQueueCount}
      aria-label={`${c.newLabel}: ${count}`}
    >
      {count}
    </span>
  ) : null;
}
