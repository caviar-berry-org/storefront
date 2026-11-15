"use client";
import { useRouter } from "next/navigation";
import { useLocale } from "@/i18n/client";
import { Dialog } from "@/components/ui/dialog";
import { Header } from "./header";
import { useStore } from "./store-provider";
import { ProductDetails } from "./product-details";
export function ProductModal({ productId }: { productId: string }) {
  const router = useRouter();
  const locale = useLocale();
  const { products } = useStore();
  const product = products.find(({ id }) => id === productId);
  if (!product) return null;
  return (
    <Dialog
      id="pmodal"
      header={<Header modal />}
      title={product.name}
      className="pm-b-mode"
      onClose={() => router.back()}
    >
      <ProductDetails key={`${locale}-${product.id}`} product={product} />
    </Dialog>
  );
}
