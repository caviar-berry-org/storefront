import { managesCatalog, type StaffRole } from "@/domain/staff-team";
import { staffCopy } from "@/i18n/staff-uk";
import type { StaffIconName } from "./staff-icon";

type SectionName = keyof typeof staffCopy.sections;

export type AdminSection = {
  slug: string;
  name: SectionName & StaffIconName;
  /** Closed to managers, so the sidebar must not offer it. */
  catalogOnly?: true;
  children?: readonly {
    slug: string;
    name: SectionName;
    icon?: StaffIconName;
  }[];
};

export const adminNavigation: readonly {
  label: string;
  sections: readonly AdminSection[];
}[] = [
  {
    label: staffCopy.operations,
    sections: [
      { slug: "", name: "overview" },
      { slug: "orders", name: "orders" },
      {
        slug: "products",
        name: "products",
        catalogOnly: true,
        children: [
          { slug: "caviar", name: "caviar" },
          { slug: "gift-sets", name: "giftSets" },
          { slug: "inventory", name: "inventory" },
          { slug: "archive", name: "archivedProducts", icon: "archive" },
        ],
      },
      {
        slug: "inquiries",
        name: "inquiries",
        // Order is the staff's working order, and the first child is what the
        // sidebar opens: gift sets carry the most work, contact notes the least.
        children: [
          { slug: "gifts", name: "giftInquiries" },
          { slug: "corporate", name: "corporateInquiries" },
          { slug: "contact", name: "contactInquiries" },
          { slug: "restock", name: "restock" },
        ],
      },
      { slug: "customers", name: "customers" },
    ],
  },
  {
    label: staffCopy.storefront,
    sections: [
      {
        slug: "promotions",
        name: "promotions",
        catalogOnly: true,
        children: [
          { slug: "settings", name: "promotionSettings" },
          { slug: "issues", name: "promotionIssues" },
        ],
      },
      {
        slug: "content",
        name: "content",
        children: [
          { slug: "contacts", name: "contacts" },
          { slug: "partners", name: "partners" },
          { slug: "stories", name: "stories" },
        ],
      },
      {
        slug: "seo",
        name: "seoAndUtm",
        children: [
          { slug: "moderation", name: "seo" },
          { slug: "utm", name: "utm" },
        ],
      },
    ],
  },
  {
    label: staffCopy.administration,
    sections: [
      {
        slug: "settings",
        name: "settings",
        children: [
          { slug: "team", name: "team" },
          { slug: "services", name: "services" },
          { slug: "notifications", name: "notifications" },
          { slug: "audit", name: "audit" },
          { slug: "help", name: "help" },
        ],
      },
    ],
  },
];

const adminSections = adminNavigation.flatMap(({ sections }) => sections);

/**
 * The sidebar for one role. Route resolution deliberately still knows every
 * section: a manager who types the address gets the page's own refusal, which is
 * the authoritative check — this only stops the menu offering a dead link.
 */
export function navigationFor(role: StaffRole) {
  if (managesCatalog(role)) return adminNavigation;
  return adminNavigation
    .map((group) => ({
      ...group,
      sections: group.sections.filter((section) => !section.catalogOnly),
    }))
    .filter(({ sections }) => sections.length);
}

export function adminPath(slug: string) {
  return slug ? `/admin/${slug}` : "/admin";
}

export function getAdminSection([slug = "", subpage, ...rest]: string[]) {
  if (rest.length) return null;
  const section = adminSections.find((item) => item.slug === slug);
  if (!section) return null;
  if (subpage === undefined) return { section, child: section.children?.[0] };
  const child = section.children?.find((item) => item.slug === subpage);
  return child ? { section, child } : null;
}
