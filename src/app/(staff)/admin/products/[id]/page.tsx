import { notFound, redirect } from "next/navigation";
import { validCatalogId } from "@/domain/managed-catalog";
import type { ProductSearchParams } from "../catalog-page";

export default async function LegacyProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: ProductSearchParams;
}) {
  const { id } = await params;
  if (!validCatalogId(id)) notFound();
  const { variant } = await searchParams;
  redirect(
    `/admin/products/caviar/${id}${validCatalogId(variant) ? `?variant=${variant}` : ""}`,
  );
}
