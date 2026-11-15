"use client";

import { usePathname } from "next/navigation";
import { getTranslator } from "./index";
import { localeFromPath } from "./routing";

export function useLocale() {
  return localeFromPath(usePathname() ?? "");
}

export function useTranslator() {
  return getTranslator(useLocale());
}
