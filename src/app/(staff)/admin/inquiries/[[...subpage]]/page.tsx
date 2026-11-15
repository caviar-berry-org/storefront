import { InquiryCountBadge } from "@/components/staff/inquiries/inquiry-counts";
import local from "@/components/staff/inquiries/inquiries.module.css";
import { notFound, redirect } from "next/navigation";
import { requireStaffSession } from "@/lib/server/staff-session";
import {
  inquiryCategories,
  inquiryInventoryHref,
  type InquiryCategory,
} from "@/domain/staff-inquiries";
import {
  inquiries,
  inquiryRecord,
  readInquiries,
} from "@/lib/server/inquiries/queries";
import { inquiriesCopy as c } from "@/i18n/inquiries-staff-uk";
import { StaffHeading } from "@/components/staff/staff-heading";
import { StaffHelp } from "@/components/staff/staff-help";
import { AdminLink } from "@/components/staff/admin-link";
import { InquiryDirectory } from "@/components/staff/inquiries/inquiry-directory";
import { InquiryStatusEditor } from "@/components/staff/inquiries/inquiry-status";
import { StatusBadge } from "@/components/staff/status-badge";
import { StaffRecord } from "@/components/staff/staff-record";
import s from "@/components/staff/staff.module.css";
import catalog from "@/components/staff/catalog/catalog.module.css";
export const metadata = { title: "Заявки | Caviar Berry" };
export default async function Page({
  params,
}: {
  params: Promise<{ subpage?: string[] }>;
}) {
  await requireStaffSession();
  const { subpage = [] } = await params;
  if (!subpage.length) redirect("/admin/inquiries/contact");
  if (["pending", "customer-requests"].includes(subpage[0] ?? ""))
    redirect("/admin/inquiries/contact");
  const category = subpage[0] as InquiryCategory;
  if (!inquiryCategories.includes(category) || subpage.length > 2) notFound();
  if (subpage[1]) {
    const id = subpage[1];
    if (!/^[a-z0-9-]{36}$/i.test(id)) notFound();
    const result = await inquiries()
      .doc(id)
      .get()
      .then(inquiryRecord)
      .catch(() => undefined);
    if (result === undefined) return <p role="alert">{c.unavailable}</p>;
    if (!result || result.category !== category) notFound();
    const fields = [
      [c.name, result.name],
      [c.contact, result.contact],
      [c.subject, result.subject],
      [
        c.date,
        new Date(result.createdAt).toLocaleString("uk-UA", {
          timeZone: "Europe/Kyiv",
        }),
      ],
      // Only the gift form asks for a delivery date, and no submission can reach
      // staff without consent — showing either elsewhere is noise.
      ...(category === "gifts"
        ? [[c.deliveryDate, result.date || "—"] as [string, string]]
        : []),
      [c.comment, result.comment || "—"],
      ...(result.variantId
        ? [[c.pack, result.variantId] as [string, string]]
        : []),
    ];
    return (
      <StaffRecord
        title={result.name}
        back={{ href: `/admin/inquiries/${category}`, label: c.back }}
        badges={
          <>
            <span>{c.categories[category]}</span>
            <StatusBadge kind="inquiry" value={result.status}>
              {c.statuses[result.status]}
            </StatusBadge>
          </>
        }
      >
        {category !== "restock" && <InquiryStatusEditor record={result} />}
        <dl className={`${catalog.group} ${local.details}`}>
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {/* Jumps to other modules, kept out of the field list and opened beside it. */}
        {(result.customerId || inquiryInventoryHref(result)) && (
          <p className={local.jumps}>
            {result.customerId && (
              <AdminLink
                href={`/admin/customers/${encodeURIComponent(result.customerId)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {c.customer}
              </AdminLink>
            )}
            {inquiryInventoryHref(result) && (
              <AdminLink
                href={inquiryInventoryHref(result)!}
                target="_blank"
                rel="noopener noreferrer"
              >
                {c.product}: {result.subject}
              </AdminLink>
            )}
          </p>
        )}
        {category === "restock" ? (
          <p>
            {c.mail}:{" "}
            {c.mailStates[result.mail as keyof typeof c.mailStates] ??
              result.mail}
          </p>
        ) : null}
      </StaffRecord>
    );
  }
  const initial = await readInquiries(category).catch(() => null);
  return (
    <div className={local.page}>
      <StaffHeading
        title={c.title}
        tools={<StaffHelp label={c.help} text={c.helpText} />}
      />
      <nav className={s.tabs} aria-label={c.title}>
        {inquiryCategories.map((cat) => (
          <AdminLink
            key={cat}
            href={`/admin/inquiries/${cat}`}
            aria-current={cat === category ? "page" : undefined}
          >
            {c.categories[cat]}
            {cat !== "restock" && <InquiryCountBadge category={cat} />}
          </AdminLink>
        ))}
      </nav>
      <InquiryDirectory key={category} category={category} initial={initial} />
    </div>
  );
}
