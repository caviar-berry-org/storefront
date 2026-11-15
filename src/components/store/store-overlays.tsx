"use client";
import { contacts } from "@/content/contacts";
import { useRouter } from "next/navigation";
import { localizedPath } from "@/i18n/routing";
import { useLocale, useTranslator } from "@/i18n/client";
import { StorefrontLink } from "./storefront-link";
import { postsFor } from "@/lib/storefront-copy";
import { Dialog } from "@/components/ui/dialog";
import { ui } from "@/components/ui/styles";
import { InquiryForm } from "./inquiry-form";
import { NewsletterDialog } from "./newsletter-dialog";
import { usePromotionOffer } from "./promotion-offer";
import { useStore } from "./store-provider";
import { Cart } from "./cart";
import { Checkout } from "./checkout";
import { navigation } from "./header";
import { LanguageSwitcher } from "./language-switcher";
import { ArticleReader } from "./article-reader";

const corporateLink = ["corp", "inquiry.corporateTitle"] as const;
const mobileNavigation = navigation.flatMap<
  (typeof navigation)[number] | typeof corporateLink
>((link) => (link[0] === "quality" ? [corporateLink, link] : [link]));

export function StoreOverlays() {
  const t = useTranslator();
  const locale = useLocale();
  const router = useRouter();
  const { overlay, setOverlay, summary, gifts, products } = useStore();
  const offer = usePromotionOffer();
  if (!overlay) return null;
  const close = () => setOverlay(null);
  if (overlay.type === "cart")
    return (
      <Dialog
        key="cart"
        id="cart"
        animateClose
        title={t("cart.title")}
        kind="side"
        onClose={close}
      >
        <Cart />
      </Dialog>
    );
  if (overlay.type === "checkout") {
    const closeCheckout = () => {
      close();
      const home = localizedPath(locale);
      if (location.pathname === home) {
        if (location.hash)
          history.replaceState(null, "", location.pathname + location.search);
        requestAnimationFrame(() =>
          window.scrollTo({ top: 0, behavior: "instant" }),
        );
      } else {
        router.replace(home);
      }
    };
    return (
      <Dialog
        key="checkout"
        id="checkout"
        title={t("checkout.heading1")}
        kind="full"
        showCloseButton={false}
        header={
          <div className="checkout-actions">
            <button
              type="button"
              className={`b-link ${ui.bLink} checkout-back`}
              onClick={() => setOverlay({ type: "cart" })}
            >
              {t("checkout.button1")}
            </button>
            <button
              type="button"
              className="x"
              onClick={closeCheckout}
              aria-label={t("common.close")}
            />
          </div>
        }
        onClose={closeCheckout}
      >
        <Checkout />
      </Dialog>
    );
  }
  if (overlay.type === "menu")
    return (
      <Dialog
        key="menu"
        title={t("header.ariaLabel2")}
        kind="side"
        className="mobile-menu"
        showCloseButton={false}
        onClose={close}
      >
        <div className="flex h-[68px] shrink-0 items-center justify-between gap-3">
          <button
            type="button"
            className="min-h-11 text-sm font-medium tracking-[.14em] uppercase"
            onClick={close}
          >
            {t("common.close")}
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium tracking-[.13em] uppercase"
            aria-label={t("header.text7", { value1: summary.count })}
            onClick={() => setOverlay({ type: "cart" })}
          >
            {t("header.cartLabel")}
            <span className="inline-grid h-[22px] min-w-[22px] place-items-center bg-[var(--b-ink)] px-1.5 text-xs tracking-normal text-[var(--b-bg)]">
              {summary.count}
            </span>
          </button>
        </div>
        <nav aria-label={t("storeOverlays.ariaLabel1")}>
          {mobileNavigation.map(([id, label]) => (
            <StorefrontLink key={id} section={id} beforeNavigate={close}>
              {t(id === "delivery" ? "footer.link1" : label)}
            </StorefrontLink>
          ))}
        </nav>
        <div className="mobile-menu-foot mt-auto grid gap-1.5 pt-7 max-[640px]:gap-0">
          <LanguageSwitcher className="flex" onNavigate={close} />
          <a href={`tel:${contacts.phones[0].tel}`}>
            {contacts.phones[0].display}
          </a>
          <a href={`tel:${contacts.phones[1].tel}`}>
            {contacts.phones[1].display}
          </a>
          <a href={`mailto:${contacts.email}`}>{contacts.email}</a>
        </div>
      </Dialog>
    );
  if (overlay.type === "post") {
    const index = Number(overlay.value);
    const post = postsFor(locale)[index];
    if (!post) return null;
    return (
      <Dialog
        key={`post-${index}`}
        id="article"
        title={post.t}
        panelWidth={1120}
        onClose={close}
      >
        <ArticleReader
          index={index}
          onClose={close}
          onSelect={(next) => setOverlay({ type: "post", value: String(next) })}
        />
      </Dialog>
    );
  }
  if (overlay.type === "newsletter")
    return offer.enabled ? (
      <Dialog
        title={t("newsletter.title", { percent: offer.percent })}
        kind="pop"
        className="submission-dialog"
        animateClose
        onClose={close}
      >
        <NewsletterDialog />
      </Dialog>
    ) : null;
  const gift = gifts.find((set) => set.key === overlay.value);
  const product =
    overlay.type === "notify"
      ? products.find((item) => item.id === overlay.value)
      : undefined;
  const pack = product?.variants.find((item) => item.id === overlay.variantId);
  const corporate = overlay.type === "gift" && overlay.value === "corp";
  const title = corporate
    ? t("inquiry.corporateTitle")
    : overlay.type === "gift"
      ? t("inquiry.giftTitle", { name: gift?.label ?? overlay.value ?? "" })
      : overlay.type === "notify"
        ? t("storeOverlays.text2")
        : t("contacts.text1").trim();
  return (
    <Dialog
      key={`${overlay.type}-${overlay.value}-${overlay.variantId}`}
      title={title}
      panelWidth={720}
      className="submission-dialog"
      animateClose
      initialFocus="input[name=name]"
      onClose={close}
    >
      <InquiryForm
        title={title}
        kind={overlay.type}
        corporate={corporate}
        targetId={overlay.value}
        targetLabel={[
          product?.name,
          pack && `${pack.weightGrams}${t("catalog.text5")}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        variantId={overlay.variantId}
        onClose={close}
      />
    </Dialog>
  );
}
