"use client";
import { ui } from "@/components/ui/styles";
import { useLocale, useTranslator } from "@/i18n/client";
import { useEffect, useState, useRef, type CSSProperties } from "react";
import {
  formatCaviarLatin,
  isVariantAvailable,
  type Product,
} from "@/domain/catalog";
import { quantityLimit } from "@/domain/cart";
import { formatMoney } from "@/lib/format-money";
import { Arrow } from "@/components/ui/arrow";
import { Accordion } from "@/components/ui/accordion";
import { Gallery } from "./gallery";
import { Quantity } from "./quantity";
import { useStore, type CartChangeError } from "./store-provider";
import { CartFeedback } from "./cart-feedback";
import { Action } from "./action";

const confirmationDuration = 2800;
const packSwitchConfirmationDuration = 750;
const minimumCheckingDuration = 600;

export function ProductDetails({ product: initial }: { product: Product }) {
  const {
    products,
    setQuantity: changeCartQuantity,
    lines,
    checkingQuantity,
    overlay,
  } = useStore();
  const t = useTranslator();
  const locale = useLocale();
  const currentProduct =
    products.find(({ id }) => id === initial.id) ?? initial;
  const [index, setIndex] = useState(() =>
    Math.max(0, currentProduct.variants.findIndex(isVariantAvailable)),
  );
  const [quantity, setQuantity] = useState(1);
  const [manualQuantity, setManualQuantity] = useState(false);
  const lastAdd = useRef(-Infinity);
  const article = useRef<HTMLElement>(null);
  const purchase = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = purchase.current;
    if (!panel || !article.current) return;
    const measure = () =>
      article.current?.style.setProperty(
        "--purchase-height",
        `${panel.getBoundingClientRect().height}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);
  const [checkingAdd, setCheckingAdd] = useState(false);
  const [addedUntil, setAddedUntil] = useState<number | null>(null);
  const [lastAddError, setAddError] = useState<CartChangeError | null>(null);
  const live = {
    product: currentProduct,
    lines,
  };
  const [frozen, setFrozen] = useState<typeof live | null>(null);
  const covered = overlay?.type === "cart" || overlay?.type === "checkout";
  // Keep the visible product stable while the cart uses live stock and prices.
  if (covered !== Boolean(frozen)) setFrozen(covered ? live : null);
  const { product, lines: displayedLines } = covered && frozen ? frozen : live;
  const checking = checkingAdd;
  const added = addedUntil !== null;
  const addError = lastAddError;
  const latin = formatCaviarLatin(product.latin);
  const firstAvailable = product.variants.findIndex(isVariantAvailable);
  const variant = product.variants[index]!;
  const limit = quantityLimit(variant);
  const remaining = Math.max(
    0,
    limit -
      (displayedLines.find((line) => line.variantId === variant.id)?.quantity ??
        0),
  );
  const selectedQuantity = Math.min(quantity, Math.max(1, remaining));
  const accent =
    product.tasteAccent && product.taste.startsWith(product.tasteAccent)
      ? product.tasteAccent
      : "";
  const premiumNote = product.latinNote?.trim();
  useEffect(() => {
    if (addedUntil === null) return;
    const timeout = setTimeout(
      () => setAddedUntil(null),
      addedUntil - performance.now(),
    );
    return () => clearTimeout(timeout);
  }, [addedUntil]);
  const serving = product.detailServingImage ?? product.servingImage;
  const photos = [
    {
      src: variant.image,
      alt: t("productDetails.alt1", {
        value1: product.name,
        value2: variant.weightGrams,
      }),
    },
    {
      src: serving,
      alt:
        product.detailServingImage && product.detailServingAlt
          ? product.detailServingAlt
          : product.servingAlt,
    },
    ...product.gallery,
  ];
  return (
    <article
      ref={article}
      className="pp"
      data-product={product.id}
      style={{ "--plate": product.plate } as CSSProperties}
    >
      <Gallery
        photos={photos}
        weight={variant.weightGrams}
        variantId={variant.id}
        productId={product.id}
      />
      <div className={`pp-info [align-self:stretch]`}>
        <div
          className={`pp-sticky sticky top-[64px] grid gap-[18px] [justify-items:start] text-left p-[0_clamp(8px,_4vw,_64px)_32px] max-[640px]:relative max-[640px]:top-0 max-[640px]:p-[24px_0] min-[641px]:pr-[clamp(8px,_3vw,_48px)]`}
        >
          {latin && (
            <p className={`b-label ${ui.bLabel} [overflow-wrap:anywhere]`}>
              {latin}
              {premiumNote && "*"}
            </p>
          )}
          <h1
            className={`pp-name [font-family:var(--b-cond)] font-normal uppercase text-[clamp(30px,_3.2vw,_48px)] leading-[1.05] tracking-[0.02em]`}
          >
            {product.name}
          </h1>
          {product.season && (
            <p className={`b-label ${ui.bLabel} cc-season`}>
              {t("catalog.season")}
              <span className={ui.draftUnderline}>{product.season}</span>
            </p>
          )}
          {product.intro && <p className={`b-p ${ui.bP}`}>{product.intro}</p>}
          <p className={`b-p ${ui.bP}`}>
            <b>
              {t("productDetails.text1")}
              {accent}
            </b>
            {product.taste.slice(accent.length)}
          </p>
          {premiumNote && <p className="pp-latin-note">* {premiumNote}</p>}
          <div ref={purchase} className="pp-purchase grid w-full gap-[18px]">
            <fieldset className="product-packs">
              <legend className={`b-label ${ui.bLabel} pp-size`}>
                {t("product.packSize")}
              </legend>
              <div
                className="b-packs"
                style={{ "--packs": product.variants.length } as CSSProperties}
              >
                {product.variants.map((item, i) => (
                  <label
                    className="pack leading-[1.2]"
                    key={item.id}
                    data-unavailable={!isVariantAvailable(item) || undefined}
                  >
                    <input
                      type="radio"
                      name={`pack-${product.id}`}
                      value={item.id}
                      checked={i === index}
                      disabled={checking}
                      onChange={() => {
                        setIndex(i);
                        const switchDeadline =
                          performance.now() + packSwitchConfirmationDuration;
                        setAddedUntil((deadline) =>
                          deadline === null
                            ? null
                            : Math.min(deadline, switchDeadline),
                        );
                        setQuantity(1);
                        setManualQuantity(false);
                        setAddError(null);
                      }}
                    />
                    <span>
                      {item.weightGrams}
                      {t("catalog.text5")}
                    </span>
                    <small>{formatMoney(item.priceMinor, locale)}</small>
                  </label>
                ))}
              </div>
            </fieldset>
            <div
              className={`pp-buy grid grid-cols-[134px_minmax(0,1fr)] items-start gap-[8px] w-full`}
            >
              <Quantity
                key={variant.id}
                value={selectedQuantity}
                max={remaining}
                rangeMessage={t("product.remainingQuantity", {
                  count: remaining,
                })}
                busy={checking}
                className="b-qty"
                onChange={(n, manual) => {
                  setQuantity(n);
                  setManualQuantity(Boolean(manual));
                  setAddError(null);
                }}
              />
              <button
                className={`b-btn ${ui.bBtn} max-[640px]:px-2`}
                aria-disabled={remaining === 0 || checking || added}
                aria-busy={checking}
                data-added={added || undefined}
                onClick={async () => {
                  if (!remaining || checking || added || checkingQuantity)
                    return;
                  const now = performance.now();
                  if (now - lastAdd.current < 350) return;
                  lastAdd.current = now;
                  setAddError(null);
                  setCheckingAdd(true);
                  const [error] = await Promise.all([
                    changeCartQuantity(variant.id, selectedQuantity, {
                      increment: true,
                      fitStock: manualQuantity,
                    }),
                    new Promise((resolve) =>
                      setTimeout(resolve, minimumCheckingDuration),
                    ),
                  ]);
                  setCheckingAdd(false);
                  setAddError(error);
                  if (!error)
                    setAddedUntil(performance.now() + confirmationDuration);
                }}
              >
                {t(
                  added
                    ? "productDetails.paragraph2"
                    : checking
                      ? "cart.checking"
                      : "product.addToCart",
                )}
              </button>
              <span className="sr" role="status">
                {added && t("productDetails.paragraph2")}
              </span>
              {addError && (addError.kind !== "stock" || limit > 0) ? (
                <p role="status" className="cart-line-feedback col-span-full">
                  <CartFeedback error={addError} />
                </p>
              ) : (
                limit > 0 &&
                remaining === 0 &&
                !checking &&
                !added && (
                  <p role="status" className="cart-line-feedback col-span-full">
                    <CartFeedback error={{ kind: "stock", limit }} />
                  </p>
                )
              )}
            </div>
            {limit === 0 && (
              <>
                <p className={`b-label ${ui.bLabel} cc-out`} role="status">
                  {t(
                    firstAvailable >= 0
                      ? "productDetails.packUnavailable"
                      : "catalog.text2",
                  )}
                </p>
                <Action
                  action="notify"
                  value={product.id}
                  variantId={variant.id}
                  className={`b-link ${ui.bLink}`}
                >
                  {t("productDetails.text3")}
                  <Arrow />
                </Action>
              </>
            )}
          </div>
          <div className={`b-accs pp-more mt-[28px]`}>
            <Accordion title={t("productDetails.title1")}>
              <dl>
                {[
                  [
                    product.fishLabel ?? t("productDetails.text4"),
                    product.fish,
                  ],
                  [t("productDetails.text5"), product.grain],
                  [t("productDetails.text6"), product.ingredients],
                  [t("productDetails.text7"), product.allergen],
                  [t("productDetails.text8"), product.storage],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
              </dl>
            </Accordion>
            <Accordion title={t("productDetails.title2")}>
              <p>{product.nutrition}</p>
            </Accordion>
            <Accordion title={t("productDetails.title3")}>
              <p>{product.pairing}</p>
            </Accordion>
            <Accordion title={t("footer.link1")}>
              <div className="pp-delivery">
                <div>
                  <b>{t("delivery.text2")}</b>
                  <p>{t("delivery.paragraph1")}</p>
                </div>
                <div>
                  <b>{t("delivery.text3")}</b>
                  <ul>
                    <li>{t("delivery.text4")}</li>
                    <li>{t("delivery.paymentWallets")}</li>
                    <li>{t("delivery.text5")}</li>
                  </ul>
                </div>
                <div>
                  <b>{t("delivery.text6")}</b>
                  <p>{t("delivery.paragraph2")}</p>
                </div>
              </div>
            </Accordion>
          </div>
        </div>
      </div>
    </article>
  );
}
