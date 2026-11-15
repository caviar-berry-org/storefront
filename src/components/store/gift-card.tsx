import { getTranslator } from "@/i18n";
import { type Locale } from "@/i18n/routing";
import { ui } from "@/components/ui/styles";
import { Photo } from "@/components/ui/photo";
import { Action } from "./action";
import type { GiftView } from "@/domain/managed-catalog";
export function GiftCard({
  gift,
  locale,
  preview = false,
}: {
  gift: GiftView;
  locale: Locale;
  preview?: boolean;
}) {
  const t = getTranslator(locale);
  return (
    <article className="setb b-rv flex flex-col">
      <div
        className={`setb-media b-img framed-export media-c relative aspect-[3/2] shrink-0 overflow-hidden${gift.key === "tasting" ? " setb-media--tasting" : ""}`}
      >
        <div className="px" data-px={gift.key === "tasting" ? undefined : ""}>
          <figure className="ph-b ph-img">
            {gift.image && (
              <Photo
                src={gift.image}
                alt={gift.cap}
                quality={90}
                sizes="(max-width:640px) 100vw, 33vw"
              />
            )}
          </figure>
        </div>
        <span
          className={`badge ${ui.bLabel} inline-grid h-12 min-w-12 place-items-center border border-solid border-current px-[13px] whitespace-nowrap`}
        >
          {gift.price}
        </span>
      </div>
      <h3 className={`tc-name ${ui.tcName}`}>{gift.name}</h3>
      <ul className={`b-p ${ui.bP} grid flex-1 content-start`} role="list">
        {gift.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
      {preview ? (
        <span className={`b-btn ${ui.bBtn}`}>{t("gifts.text6")}</span>
      ) : (
        <Action className={`b-btn ${ui.bBtn}`} action="gift" value={gift.key}>
          {t("gifts.text6")}
        </Action>
      )}
    </article>
  );
}
