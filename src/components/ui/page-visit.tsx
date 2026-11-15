"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
export const lastStorefrontPageKey = "ucb-last-page";

export function PageVisit() {
  const path = usePathname();
  useEffect(() => {
    try {
      sessionStorage.setItem(lastStorefrontPageKey, path);
    } catch {
      /* Navigation still works without storage. */
    }
  }, [path]);
  return null;
}
