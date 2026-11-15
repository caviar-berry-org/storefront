import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { adminPath, getAdminSection } from "@/components/staff/navigation";
import { PlannedSection } from "@/components/staff/planned-section";
import { staffCopy } from "@/i18n/staff-uk";
import { requireStaffSession } from "@/lib/server/staff-session";

type Props = { params: Promise<{ section: string; subpage?: string[] }> };

const movedSections = new Map([
  ["utm", "seo/utm"],
  ["audit", "settings/audit"],
  ["help", "settings/help"],
]);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section, subpage = [] } = await params;
  const route = getAdminSection([section, ...subpage]);
  const title = route
    ? staffCopy.sections[route.child?.name ?? route.section.name]
    : staffCopy.missing;
  return { title: `${title} | ${staffCopy.brand}` };
}

export async function AdminSectionPage({ params }: Props) {
  await requireStaffSession();
  const { section, subpage = [] } = await params;
  const movedTo = subpage.length === 0 ? movedSections.get(section) : null;
  if (movedTo) redirect(adminPath(movedTo));
  const route = getAdminSection([section, ...subpage]);
  if (!route) notFound();
  return <PlannedSection {...route} />;
}
