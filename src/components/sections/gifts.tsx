import { ui } from "@/components/ui/styles";
import { SplitText } from "@/components/ui/typography";
import { getTranslator } from "@/i18n";
import type { Locale } from "@/i18n/routing";
import { storefrontGifts } from "@/lib/server/catalog/storefront";
import { GiftCard } from "@/components/store/gift-card";
export async function GiftsSection({ locale }: { locale: Locale }) {
  const t = getTranslator(locale);
  const gifts = await storefrontGifts(locale);
  if (!gifts.length) return null;
  return (
    <div className={`b-wrap ${ui.bWrap} b-sec ${ui.bSec}`}>
      <SplitText className={`b-h2 ${ui.bH2} b-center`}>
        {t("gifts.heading1")}
      </SplitText>
      <p className={`b-p ${ui.bP} b-lead-c b-lead-full b-rv mt-6 text-left`}>
        {t("gifts.paragraph1")}
      </p>
      <div
        className={`b-grid ${ui.bGrid} sets-b mt-[clamp(40px,5vw,72px)] min-[641px]:mt-7`}
      >
        {gifts.map((gift) => (
          <GiftCard key={gift.key} gift={gift} locale={locale} />
        ))}
      </div>
    </div>
  );
}
