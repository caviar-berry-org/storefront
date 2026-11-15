import { ProductsPage, type ProductSearchParams } from "../../catalog-page";
export { metadata } from "../../catalog-page";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: ProductSearchParams;
}) {
  const { id } = await params;
  return <ProductsPage kind="gift-sets" id={id} searchParams={searchParams} />;
}
