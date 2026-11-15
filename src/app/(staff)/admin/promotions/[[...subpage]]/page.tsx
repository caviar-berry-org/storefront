import { StaffHelp } from "@/components/staff/staff-help";
import styles from "@/components/staff/promotions/promotions.module.css";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/server/staff-session";
import { catalogStaff } from "@/lib/server/catalog/access";
import { promotionSettingsRef } from "@/lib/server/promotions/settings";
import { readPromotionIssues } from "@/lib/server/promotions/queries";
import { readPromotionSettings } from "@/domain/promotion-settings";
import { freshCaviar } from "@/lib/server/catalog/storefront";
import { promotionsCopy as copy } from "@/i18n/promotions-staff-uk";
import { StaffHeading } from "@/components/staff/staff-heading";
import { AdminSectionTabs } from "@/components/staff/admin-section-tabs";
import { getAdminSection } from "@/components/staff/navigation";
import { PromotionSettingsForm } from "@/components/staff/promotions/promotion-settings-form";
import { PromotionIssues } from "@/components/staff/promotions/promotion-issues";
export const metadata: Metadata = { title: `${copy.title} | Caviar Berry` };
async function Settings() {
  const data = await Promise.all([
    promotionSettingsRef().get(),
    freshCaviar(),
    catalogStaff(),
  ])
    .then(([snapshot, products, editable]) => ({
      initial: readPromotionSettings(snapshot.data()),
      // freshCaviar already hides the test product wherever it cannot be sold,
      // so the scope list offers exactly the products a code can discount.
      products: products.map((p) => ({ id: p.id, name: p.name })),
      editable: Boolean(editable),
    }))
    .catch(() => null);
  return data ? (
    <>
      <PromotionSettingsForm {...data} />
      {process.env.PROMOTION_EMAIL_ENABLED !== "true" && <p>{copy.disabled}</p>}
    </>
  ) : (
    <p role="alert">{copy.unavailable}</p>
  );
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ subpage?: string[] }>;
  searchParams: Promise<{ before?: string; id?: string; search?: string }>;
}) {
  await requireStaffSession();
  const { subpage = [] } = await params;
  if (!subpage.length) redirect("/admin/promotions/settings");
  const selected = subpage[0];
  if (
    subpage.length !== 1 ||
    (selected !== "settings" && selected !== "issues")
  )
    notFound();
  const section = getAdminSection(["promotions"])!.section;
  const issues =
    selected === "issues"
      ? await readPromotionIssues(await searchParams).catch(() => null)
      : null;
  if (selected === "issues" && issues) return <PromotionIssues {...issues} />;
  return (
    <div className={styles.page}>
      <StaffHeading
        title={copy.title}
        tools={
          <StaffHelp
            label={copy.help}
            text={
              copy.terms +
              " Експорт Excel містить весь список або результат пошуку email."
            }
          />
        }
      />
      <AdminSectionTabs section={section} selected={selected} />
      {selected === "settings" ? (
        <Settings />
      ) : issues ? (
        <PromotionIssues {...issues} />
      ) : (
        <p role="alert">{copy.unavailable}</p>
      )}
    </div>
  );
}
