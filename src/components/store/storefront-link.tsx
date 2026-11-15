"use client";

import { useLocale } from "@/i18n/client";
import { localizedPath } from "@/i18n/routing";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { requestSectionScroll } from "./storefront-navigation";

export function StorefrontLink({
  section,
  beforeNavigate,
  ...props
}: Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> & {
  section: string;
  beforeNavigate?: () => void;
}) {
  const router = useRouter();
  const home = localizedPath(useLocale());
  const href = `${home}#${section}`;
  return (
    <Link
      {...props}
      href={href}
      onNavigate={(event) => {
        beforeNavigate?.();
        if (location.pathname !== home) {
          event.preventDefault();
          requestSectionScroll(section);
          router.push(href, { scroll: false });
        } else {
          event.preventDefault();
          // Build the whole URL: a bare "#id" is resolved relative to the
          // current one, which can leave a second fragment behind.
          if (location.hash !== `#${section}`)
            history.pushState(
              null,
              "",
              `${location.pathname}${location.search}#${section}`,
            );
          requestSectionScroll(section);
        }
      }}
    />
  );
}
