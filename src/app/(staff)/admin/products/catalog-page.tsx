import { StockReminder } from "@/components/staff/catalog/stock-reminder";
import { FocusedInventory } from "@/components/staff/catalog/focused-inventory";
import { inquiryInventory } from "@/lib/server/inquiries/inventory";
import { inquiryCategories } from "@/domain/staff-inquiries";
import type { InquiryCategory } from "@/domain/staff-inquiries";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminLink } from "@/components/staff/admin-link";
import { AdminSectionTabs } from "@/components/staff/admin-section-tabs";
import { getAdminSection } from "@/components/staff/navigation";
import { StaffHelp } from "@/components/staff/staff-help";
import { StaffExport } from "@/components/staff/staff-export";
import { StaffIcon } from "@/components/staff/staff-icon";
import { StaffHeading } from "@/components/staff/staff-heading";
import { StaffRecord } from "@/components/staff/staff-record";
import { CatalogList } from "@/components/staff/catalog/catalog-list";
import { GiftEditor } from "@/components/staff/catalog/gift-editor";
import { CaviarEditor } from "@/components/staff/catalog/caviar-editor";
import { InventoryEditor } from "@/components/staff/catalog/inventory-editor";
import styles from "@/components/staff/catalog/catalog.module.css";
import staffStyles from "@/components/staff/staff.module.css";
import { staffCopy } from "@/i18n/staff-uk";
import { catalogStaffCopy as copy } from "@/i18n/catalog-staff-uk";
import { catalogStaff } from "@/lib/server/catalog/access";
import { requireStaffSession } from "@/lib/server/staff-session";
import {
  readCatalogPackChoices,
  readCatalogPage,
  readCatalogRecord,
  readInventoryPage,
} from "@/lib/server/catalog/queries";
import { isOrderId } from "@/domain/orders";
import { ordersCopy } from "@/i18n/orders-staff-uk";
import { validCatalogId } from "@/domain/managed-catalog";

export const metadata: Metadata = {
  title: `${staffCopy.sections.products} | ${staffCopy.brand}`,
};

export type ProductSearchParams = Promise<{
  variant?: string;
  fromOrder?: string;
  from?: string;
  kind?: string;
  created?: string;
  product?: string;
  gift?: string;
  fromInquiry?: string;
  inquiryCategory?: string;
}>;

export async function ProductsPage({
  kind,
  id,
  pack,
  searchParams,
}: {
  kind: "caviar" | "gift-sets" | "inventory" | "archive";
  id?: string;
  pack?: string;
  searchParams: ProductSearchParams;
}) {
  await requireStaffSession();
  if (!(await catalogStaff())) return <p role="alert">{copy.errors.denied}</p>;
  const query = await searchParams;
  if (kind === "archive") {
    const archiveKind = query.kind === "gift-sets" ? "gift-sets" : "caviar";
    const initial = await readCatalogPage(archiveKind, null, true).catch(
      () => null,
    );
    return (
      <>
        <StaffHeading title={staffCopy.sections.products} />
        <AdminSectionTabs
          section={getAdminSection(["products"])!.section}
          selected="archive"
        />
        <StaffHeading
          level="h2"
          title={staffCopy.sections.archivedProducts}
          tools={
            <StaffHelp
              label={staffCopy.sections.archivedProducts}
              text={copy.actionHelp}
            />
          }
        />
        <nav className={styles.controls} aria-label={copy.archiveCategories}>
          <AdminLink
            className={styles.button}
            href="/admin/products/archive"
            aria-current={archiveKind === "caviar" ? "page" : undefined}
          >
            {staffCopy.sections.caviar}
          </AdminLink>
          <AdminLink
            className={styles.button}
            href="/admin/products/archive?kind=gift-sets"
            aria-current={archiveKind === "gift-sets" ? "page" : undefined}
          >
            {staffCopy.sections.giftSets}
          </AdminLink>
        </nav>
        <CatalogList
          key={archiveKind}
          kind={archiveKind}
          initial={initial}
          archived
        />
      </>
    );
  }
  const route = getAdminSection(["products", kind])!;
  const title = staffCopy.sections[route.child!.name];
  const path = `/admin/products/${kind}`;
  if (!id) {
    const initial = await (
      kind === "inventory"
        ? query.product || query.gift
          ? (query.product && !validCatalogId(query.product)) ||
            (query.gift && !validCatalogId(query.gift))
            ? Promise.resolve(null)
            : inquiryInventory(query.product, query.gift)
          : readInventoryPage()
        : readCatalogPage(kind)
    ).catch(() => null);
    return (
      <>
        <StaffHeading title={staffCopy.sections.products} />
        <AdminSectionTabs section={route.section} selected={kind} />
        {kind === "caviar" && validCatalogId(query.created) && (
          <StockReminder id={query.created} />
        )}
        <StaffHeading
          level="h2"
          title={title}
          tools={
            kind === "inventory" ? (
              <div className={staffStyles.recordTools}>
                <StaffExport
                  href="/admin/products/inventory/export"
                  filename="inventory.xlsx"
                  label={copy.excel}
                  title={copy.exportExcel}
                  failure={copy.exportFailed}
                />
                <StaffHelp label={title} text={copy.inventoryHelp} />
              </div>
            ) : (
              <AdminLink className={styles.primary} href={`${path}/new`}>
                <StaffIcon name="add" />
                {copy.add}
              </AdminLink>
            )
          }
        />
        {kind === "inventory" && (query.product || query.gift) && (
          <AdminLink className={styles.button} href="/admin/products/inventory">
            Усі залишки
          </AdminLink>
        )}
        {kind === "inventory" && (query.product || query.gift) ? (
          <FocusedInventory
            rows={
              (initial?.rows as
                | import("@/domain/managed-catalog").InventoryRow[]
                | undefined) ?? null
            }
          />
        ) : (
          <CatalogList key={kind} kind={kind} initial={initial} />
        )}
      </>
    );
  }
  if (!validCatalogId(id)) notFound();
  const archive =
    kind !== "inventory" && id !== "new" && query.from === "archive";
  const back = {
    href: archive
      ? `/admin/products/archive${kind === "gift-sets" ? "?kind=gift-sets" : ""}`
      : kind === "caviar" && id !== "new" && query.from === "inventory"
        ? "/admin/products/inventory"
        : path,
    label: copy.back,
  };
  if (kind === "inventory") {
    if (!validCatalogId(pack)) notFound();
    const record = await readCatalogRecord("caviar", id);
    const variant = record?.data.copy.ua.variants.find(
      (item) => item.id === pack,
    );
    if (!record || !variant) notFound();
    return (
      <InventoryEditor
        back={
          isOrderId(query.fromOrder)
            ? {
                href: `/admin/orders/${query.fromOrder}`,
                label: ordersCopy.detail,
              }
            : isOrderId(query.fromInquiry) &&
                inquiryCategories.includes(
                  query.inquiryCategory as InquiryCategory,
                )
              ? {
                  href: `/admin/inquiries/${query.inquiryCategory}/${query.fromInquiry}`,
                  label: "До заявки",
                }
              : back
        }
        title={`${record.data.copy.ua.name} · ${variant.weightGrams} г`}
        record={record}
        packId={pack}
      />
    );
  }
  if (kind === "gift-sets") {
    const [record, choices] = await Promise.all([
      id === "new" ? null : readCatalogRecord(kind, id),
      readCatalogPackChoices(),
    ]);
    if (id !== "new" && !record) notFound();
    return (
      <StaffRecord back={back} title={record?.data.name.ua ?? copy.add}>
        <GiftEditor
          record={record ?? undefined}
          choices={choices}
          back={back.href}
        />
      </StaffRecord>
    );
  }
  const record = id === "new" ? null : await readCatalogRecord(kind, id);
  if (id !== "new" && !record) notFound();
  const { variant } = query;
  return (
    <StaffRecord back={back} title={record?.data.copy.ua.name ?? copy.add}>
      <CaviarEditor
        record={record ?? undefined}
        selectedPack={variant}
        back={back.href}
      />
    </StaffRecord>
  );
}
