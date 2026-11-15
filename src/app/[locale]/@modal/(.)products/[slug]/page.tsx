import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/routing";
import { storefrontCaviar } from "@/lib/server/catalog/storefront";
import { ProductModal } from "@/components/store/product-modal";
export default async function ModalPage({
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
  return <ProductModal productId={product.id} />;
}
