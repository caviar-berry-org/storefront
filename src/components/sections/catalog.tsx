import { ProductCard } from "@/components/store/product-card";
import { ui } from "@/components/ui/styles";
import { SplitText } from "@/components/ui/typography";
import { storefrontCaviar } from "@/lib/server/catalog/storefront";
import { getTranslator } from "@/i18n";
import type { Locale } from "@/i18n/routing";

export async function CatalogSection({ locale }: { locale: Locale }) {
  const t = getTranslator(locale);
  const products = await storefrontCaviar(locale);
  return (
    <div className={`b-wrap ${ui.bWrap} b-sec ${ui.bSec}`}>
      <SplitText as="h2" className={`b-h2 ${ui.bH2} b-h2-mid`}>
        {t("catalog.heading1")}
        <span className="l2">{t("catalog.text1")}</span>
      </SplitText>
      <div
        className={`collage grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-[16px] mt-[clamp(40px,_5vw,_72px)] max-[760px]:grid-cols-[1fr]`}
      >
        {products.map((product) => (
          <ProductCard key={product.id} product={product} locale={locale} />
        ))}
      </div>
    </div>
  );
}
