"use client";
import { useTranslator } from "@/i18n/client";
import { LanguageSwitcher } from "./language-switcher";
import { BrandEmblem } from "@/components/ui/brand-emblem";
import { useStore } from "./store-provider";
import { StorefrontLink } from "./storefront-link";
import { captureLocaleMenuPosition } from "./locale-scroll";

export const navigation = [
  ["ikra", "header.text1"],
  ["gifts", "header.text3"],
  ["about", "header.text2"],
  ["quality", "header.text4"],
  ["delivery", "delivery.text2"],
  ["faq", "header.faq"],
  ["blog", "header.text5"],
  ["contacts", "header.text6"],
] as const;
const navLink =
  "hidden min-h-11 items-center whitespace-nowrap no-underline min-[1181px]:inline-flex hover:underline underline-offset-5 decoration-1";

export function Header({ modal = false }: { modal?: boolean }) {
  const t = useTranslator();
  const { summary, setOverlay } = useStore();
  return (
    <header
      id={modal ? undefined : "hdr"}
      className={`store-header fixed inset-x-0 top-0 z-50 text-[var(--b-ink)] transition-colors duration-500${modal ? " is-compact show-logo" : ""}`}
    >
      <nav
        aria-label={t("header.ariaLabel1")}
        className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 text-sm font-light"
      >
        <div className="flex min-w-0 items-center gap-5">
          <button
            className="inline-flex size-11 shrink-0 items-center justify-center min-[1181px]:hidden"
            aria-label={t("header.ariaLabel2")}
            onClick={() => {
              captureLocaleMenuPosition();
              setOverlay({ type: "menu" });
            }}
          >
            <svg
              width="20"
              height="16"
              viewBox="0 0 20 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M0 2h20M0 8h20M0 14h20" />
            </svg>
          </button>
          {navigation.slice(0, 4).map(([id, label]) => (
            <StorefrontLink
              key={id}
              className={navLink}
              section={id}
              data-spy={id}
            >
              {t(label)}
            </StorefrontLink>
          ))}
        </div>
        <StorefrontLink
          className="header-logo"
          section="ikra"
          aria-label={t("header.ariaLabel3")}
        >
          <BrandEmblem className="header-emblem" eager />
        </StorefrontLink>
        <div className="flex min-w-0 items-center justify-end gap-5">
          {navigation.slice(4).map(([id, label]) => (
            <StorefrontLink
              key={id}
              className={navLink}
              section={id}
              data-spy={id}
            >
              {t(label)}
            </StorefrontLink>
          ))}
          <LanguageSwitcher className="hidden shrink-0 min-[1181px]:flex" />
          <button
            className="inline-grid min-h-11 shrink-0 items-center whitespace-nowrap text-[13px] tabular-nums min-[421px]:text-sm"
            onClick={() => setOverlay({ type: "cart" })}
            aria-label={t("header.text7", { value1: summary.count })}
          >
            <span
              className="invisible col-start-1 row-start-1"
              aria-hidden="true"
            >
              {t("header.cart", { count: 999 })}
            </span>
            <span className="col-start-1 row-start-1 text-right">
              {t("header.cart", { count: summary.count })}
            </span>
          </button>
        </div>
      </nav>
    </header>
  );
}
