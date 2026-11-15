import { ProductsPage, type ProductSearchParams } from "../../../catalog-page";
export { metadata } from "../../../catalog-page";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; pack: string }>;
  searchParams: ProductSearchParams;
}) {
  const { id, pack } = await params;
  return (
    <ProductsPage
      kind="inventory"
      id={id}
      pack={pack}
      searchParams={searchParams}
    />
  );
}
