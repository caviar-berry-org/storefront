import { ui } from "@/components/ui/styles";
import { getTranslator } from "@/i18n";
import { isLocale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { StorefrontLink } from "@/components/store/storefront-link";
import { products } from "@/lib/catalog";
import { storefrontCaviar } from "@/lib/server/catalog/storefront";
import { pageMetadata } from "@/lib/metadata";
import { productGraph } from "@/lib/seo-graph";
import { JsonLd } from "@/components/seo/json-ld";
import { ProductDetails } from "@/components/store/product-details";
import { PageVisit } from "@/components/ui/page-visit";
export function generateStaticParams() {
  return products.map(({ slug }) => ({ slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const product = (await storefrontCaviar(locale)).find(
    (item) => item.slug === slug,
  );
  if (!product) return {};
  return pageMetadata(
    locale,
    product.seo?.title?.trim() || product.name,
    product.seo?.description?.trim() || product.description,
    `/products/${product.slug}`,
    product.seo?.image || product.variants[0]?.image,
  );
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const product = (await storefrontCaviar(locale)).find(
    (item) => item.slug === slug,
  );
  if (!product) notFound();
  const t = getTranslator(locale);
  return (
    <main id="main-content" className="product-page">
      <JsonLd items={productGraph(locale, product)} />
      <PageVisit />
      <StorefrontLink
        className={`b-link ${ui.bLink} product-back`}
        section="ikra"
      >
        {t("page.text3")}
      </StorefrontLink>
      <ProductDetails key={product.id} product={product} />
    </main>
  );
}
