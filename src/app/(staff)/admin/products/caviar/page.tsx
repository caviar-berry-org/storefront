import { ProductsPage, type ProductSearchParams } from "../catalog-page";

export { metadata } from "../catalog-page";

export default function Page({
  searchParams,
}: {
  searchParams: ProductSearchParams;
}) {
  return <ProductsPage kind="caviar" searchParams={searchParams} />;
}
