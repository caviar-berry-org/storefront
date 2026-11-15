import { Fragment } from "react";
import { ui } from "@/components/ui/styles";
import { getTranslator } from "@/i18n";
import { localizedPath, type Locale } from "@/i18n/routing";
import Link from "next/link";
import type { CSSProperties } from "react";
import {
  formatCaviarLatin,
  isVariantAvailable,
  type Product,
} from "@/domain/catalog";
import { formatMoney } from "@/lib/format-money";
import { CardMedia } from "./card-media";
import { Jar } from "./jar";
import { Photo } from "@/components/ui/photo";
import { Arrow } from "@/components/ui/arrow";
import { Action } from "./action";
export type CardProduct = Pick<
  Product,
  | "id"
  | "slug"
  | "name"
  | "grain"
  | "description"
  | "plate"
  | "season"
  | "latin"
  | "latinNote"
  | "variants"
  | "jarImage"
  | "lidImage"
  | "jarBodyImage"
  | "servingImage"
  | "servingAlt"
>;

function keepGrainMeasurementsTogether(text: string) {
  return text.replace(
    /(?<![\p{L}\d])\d+(?:[.,]\d+)?(?:[ \t\u00a0]*[-–—][ \t\u00a0]*\d+(?:[.,]\d+)?)?[ \t\u00a0]*(?:мм|mm)(?!\p{L})/giu,
    (measurement) =>
      measurement
        .replace(/[ \t\u00a0]+/g, "\u00a0")
        .replace(/[-–—]/g, "\u2060$&\u2060"),
  );
}

export function ProductCard({
  product,
  locale,
  preview = false,
}: {
  product: CardProduct;
  preview?: boolean;
  locale: Locale;
}) {
  const t = getTranslator(locale);
  const detailsLabel = t("catalog.text6", { value1: product.name });
  const latin = formatCaviarLatin(product.latin, product.id);
  const species = latin ? latin.split("/") : [];
  const first = product.variants.find(isVariantAvailable);
  const available = first !== undefined;
  const grain = product.grain.split(";")[0]!;
  const grainAt = grain ? product.description.indexOf(grain) : -1;
  const href = localizedPath(locale, `/products/${product.slug}`);
  const jar = (!preview || product.jarImage || product.lidImage) && (
    <Jar product={product} />
  );
  const serving = (
    <figure className="ph-b ph-img">
      {product.servingImage && (
        <Photo
          src={product.servingImage}
          alt={product.servingAlt}
          quality={90}
          sizes="(max-width: 760px) 42vw, 25vw"
        />
      )}
    </figure>
  );
  const details = (
    <>
      {t("catalog.text7")}
      <Arrow />
    </>
  );
  const notify = (
    <>
      {t("catalog.text8")}
      <Arrow />
    </>
  );
  return (
    <article
      className={`col-card flex flex-col [border:1px_dotted_var(--b-dot)] b-rv${available ? "" : " is-out"}`}
      style={{ "--plate": product.plate } as CSSProperties}
    >
      <CardMedia className="cc-media b-img grid grid-cols-[1fr_1fr]">
        {preview ? (
          <>
            <div className="tile-tin">{jar}</div>
            <div>{serving}</div>
          </>
        ) : (
          <>
            <Link
              className="tile-tin"
              href={href}
              scroll={false}
              tabIndex={available ? -1 : undefined}
              aria-label={detailsLabel}
            >
              {jar}
            </Link>
            <Link
              href={href}
              scroll={false}
              tabIndex={-1}
              aria-label={detailsLabel}
            >
              {serving}
            </Link>
          </>
        )}
      </CardMedia>
      <div
        className={`cc-body flex-1 flex flex-col gap-[8px] p-[20px_20px_18px] text-left`}
      >
        <h3 className={`tc-name ${ui.tcName}`}>{product.name}</h3>
        <p
          className={`b-label ${ui.bLabel} cc-status${product.season ? " cc-season" : ""}${available ? "" : " cc-out"}`}
        >
          {!available ? (
            t("catalog.text2")
          ) : product.season ? (
            <>
              {t("catalog.season")}
              <span className={ui.draftUnderline}>{product.season}</span>
            </>
          ) : (
            "\u00a0"
          )}
        </p>
        <p
          className={`tc-lat [overflow-wrap:anywhere] text-[14px] [color:var(--b-mute)]`}
        >
          {species.length
            ? species.map((name, index) => {
                const last = index === species.length - 1;
                return (
                  <Fragment key={index}>
                    <span
                      style={{ display: "inline-block", maxInlineSize: "100%" }}
                    >
                      {name}
                      {last ? product.latinNote && "*" : "/"}
                    </span>
                    {!last && <wbr />}
                  </Fragment>
                );
              })
            : "\u00a0"}
        </p>
        <p
          className={`b-p ${ui.bP} cc-desc [color:var(--b-mute)] max-w-[48ch]`}
        >
          {grainAt < 0 ? (
            keepGrainMeasurementsTogether(product.description)
          ) : (
            <>
              {keepGrainMeasurementsTogether(
                product.description.slice(0, grainAt),
              )}
              <b>{keepGrainMeasurementsTogether(grain)}</b>
              {keepGrainMeasurementsTogether(
                product.description.slice(grainAt + grain.length),
              )}
            </>
          )}
        </p>
        <div
          className={`cc-foot mt-auto pt-[10px] flex items-center gap-[16px] flex-wrap${available ? " justify-between" : " justify-start"}`}
        >
          {first ? (
            <>
              <span className={`b-label ${ui.bLabel}`}>
                {t("catalog.text4")}
                {formatMoney(first.priceMinor, locale)} / {first.weightGrams}
                {t("catalog.text5")}
              </span>
              {preview ? (
                <span className={`b-link ${ui.bLink}`}>{details}</span>
              ) : (
                <Link
                  className={`b-link ${ui.bLink}`}
                  href={href}
                  scroll={false}
                  aria-label={detailsLabel}
                >
                  {details}
                </Link>
              )}
            </>
          ) : preview ? (
            <span className={`b-link ${ui.bLink}`}>{notify}</span>
          ) : (
            <Action
              className={`b-link ${ui.bLink}`}
              action="notify"
              value={product.id}
              variantId={product.variants[0]?.id}
            >
              {notify}
            </Action>
          )}
        </div>
      </div>
    </article>
  );
}
