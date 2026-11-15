import {
  AdminSectionPage,
  generateMetadata as sectionMetadata,
} from "../../section-page";
import { AdminLink } from "@/components/staff/admin-link";
import { AdminSectionTabs } from "@/components/staff/admin-section-tabs";
import { CatalogGroup } from "@/components/staff/catalog/catalog-group";
import { getAdminSection } from "@/components/staff/navigation";
import { UtmBuilder } from "@/components/staff/seo/utm-builder";
import styles from "@/components/staff/seo/seo.module.css";
import { StaffHeading } from "@/components/staff/staff-heading";
import { StaffHelp } from "@/components/staff/staff-help";
import { StaffNotice } from "@/components/staff/staff-feedback";
import { StatusBadge } from "@/components/staff/status-badge";
import { journal } from "@/content/journal";
import {
  analyticsPeriods,
  isAnalyticsPeriod,
  type AnalyticsPeriod,
  type AnalyticsWindow,
} from "@/domain/analytics-window";
import { seoStaffCopy } from "@/i18n/seo-staff-uk";
import { staffCopy } from "@/i18n/staff-uk";
import { site } from "@/lib/metadata";
import { readChannelMetrics } from "@/lib/server/dashboard-metrics";
import {
  ChannelBreakdown,
  ChannelChart,
} from "@/components/staff/seo/channel-chart";
import { storefrontCaviar } from "@/lib/server/catalog/storefront";
import { requireStaffSession } from "@/lib/server/staff-session";

type Props = {
  params: Promise<{ subpage?: string[] }>;
  searchParams: Promise<{ period?: string | string[] }>;
};

function sectionProps({ params }: Props) {
  return { params: params.then((value) => ({ ...value, section: "seo" })) };
}

const kyivDateTime = new Intl.DateTimeFormat("uk-UA", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Kyiv",
});
const kyivRangeDate = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Kyiv",
});

export function generateMetadata(props: Props) {
  return sectionMetadata(sectionProps(props));
}

function Tabs({ selected }: { selected: "moderation" | "utm" }) {
  return (
    <AdminSectionTabs
      section={getAdminSection(["seo"])!.section}
      selected={selected}
    />
  );
}

async function Moderation() {
  const copy = seoStaffCopy.moderation;
  const products = await storefrontCaviar("ua").catch(() => null);
  // Two addresses per entry (ua and en), as the sitemap emits them.
  const sitemapUrls = products
    ? (products.length + journal.length + 2) * 2
    : null;

  // Short state in the badge, the explanation beneath it: a sentence inside a
  // badge overflows its row and stops reading as a status at all.
  const checks: {
    label: string;
    state: string;
    tone: "done" | "problem" | "closed";
    detail: string;
  }[] = [
    {
      label: copy.checks.indexing,
      state: site.production ? copy.on : copy.off,
      tone: site.production ? "done" : "closed",
      detail: site.production
        ? copy.details.indexingOn
        : copy.details.indexingOff,
    },
    {
      label: copy.checks.canonical,
      state: copy.ready,
      tone: "done",
      detail: copy.details.canonical,
    },
    {
      label: copy.checks.sitemap,
      state: !site.production
        ? copy.hidden
        : sitemapUrls === null
          ? copy.unavailable
          : copy.published,
      tone: !site.production
        ? "closed"
        : sitemapUrls === null
          ? "problem"
          : "done",
      detail: !site.production
        ? copy.details.sitemapOff
        : sitemapUrls === null
          ? seoStaffCopy.utm.unavailable
          : copy.details.sitemapCount.replace("{count}", String(sitemapUrls)),
    },
    {
      label: copy.checks.structured,
      state: copy.ready,
      tone: "done",
      detail: copy.details.structured,
    },
    {
      label: copy.checks.llms,
      state: site.production ? copy.published : copy.hidden,
      tone: site.production ? "done" : "closed",
      detail: site.production ? copy.details.llmsOn : copy.details.llmsOff,
    },
  ];

  return (
    <>
      <StaffHeading
        title={copy.title}
        tools={<StaffHelp label={copy.help} text={copy.helpText} />}
      />
      <Tabs selected="moderation" />
      <div className={styles.page}>
        <CatalogGroup title={copy.state}>
          <dl className={styles.checks}>
            {checks.map((check) => (
              <div key={check.label}>
                <dt>{check.label}</dt>
                <dd>
                  <StatusBadge tone={check.tone}>{check.state}</StatusBadge>
                </dd>
                <dd className={styles.detail}>{check.detail}</dd>
              </div>
            ))}
          </dl>
          <div className={styles.jumps}>
            <span>{copy.productsHint}</span>
            <AdminLink
              href="/admin/products/caviar"
              target="_blank"
              rel="noopener noreferrer"
            >
              {copy.openProducts}
            </AdminLink>
          </div>
        </CatalogGroup>
      </div>
    </>
  );
}

const utmCopy = seoStaffCopy.utm;

/** Switching the window is a link, so the page re-renders from the cached
 *  aggregation instead of fetching anything from the browser. */
function PeriodTabs({ selected }: { selected: AnalyticsPeriod }) {
  return (
    <nav className={styles.periodTabs} aria-label={utmCopy.periodLabel}>
      {analyticsPeriods.map((period) => (
        <AdminLink
          key={period}
          href={`/admin/seo/utm?period=${period}`}
          replace
          scroll={false}
          aria-current={period === selected ? "page" : undefined}
        >
          {utmCopy.periods[period]}
        </AdminLink>
      ))}
    </nav>
  );
}

function PeriodRange({ window }: { window: AnalyticsWindow }) {
  // Exact days, not "last week": staff compare these reports against invoices.
  const from = kyivRangeDate.format(new Date(`${window.firstDay}T12:00:00Z`));
  const to = kyivRangeDate.format(new Date(`${window.lastDay}T12:00:00Z`));
  return (
    <p className={styles.range}>
      {utmCopy.rangeFrom} <time dateTime={window.firstDay}>{from}</time>{" "}
      {utmCopy.rangeTo} <time dateTime={window.lastDay}>{to}</time>{" "}
      {utmCopy.rangeInclusive}
    </p>
  );
}

async function Utm({ period }: { period: AnalyticsPeriod }) {
  const copy = utmCopy;
  const channels = await readChannelMetrics(period);

  return (
    <>
      <StaffHeading
        title={copy.title}
        tools={<StaffHelp label={copy.help} text={copy.helpText} />}
      />
      <Tabs selected="utm" />
      <div className={styles.page}>
        <CatalogGroup title={copy.builder}>
          <UtmBuilder origin={site.url.origin} />
        </CatalogGroup>
        <CatalogGroup title={copy.conversions} help={copy.chartHelpText}>
          <div className={styles.periodRow}>
            <PeriodTabs selected={period} />
            {channels && <PeriodRange window={channels.window} />}
          </div>
          {!channels ? (
            <StaffNotice message={copy.unavailable} guidance="retry" />
          ) : channels.indexRequired ? (
            <StaffNotice message={copy.indexRequired} guidance="technical" />
          ) : channels.rows.length ? (
            <>
              <ChannelChart rows={channels.rows} orders={channels.orders} />
              <ChannelBreakdown
                rows={channels.rows}
                orders={channels.orders}
                revenue={channels.revenue}
              />
              {/* What the numbers mean lives behind «i» and in the help page;
                  the panel keeps only the live fact of when they were read. */}
              <p className={styles.note}>
                {staffCopy.dashboard.dataAsOf}{" "}
                <time dateTime={new Date(channels.at).toISOString()}>
                  {kyivDateTime.format(channels.at)}
                </time>{" "}
                {staffCopy.dashboard.kyivTime}
              </p>
            </>
          ) : (
            <p className={styles.note}>{copy.empty}</p>
          )}
        </CatalogGroup>
      </div>
    </>
  );
}

export default async function Page(props: Props) {
  const { subpage = [] } = await props.params;
  if (subpage.length <= 1) {
    const page = subpage[0] ?? "moderation";
    if (page === "moderation" || page === "utm") {
      await requireStaffSession();
      if (page !== "utm") return <Moderation />;
      const { period } = await props.searchParams;
      // Anything else in the query falls back to the shortest window.
      return <Utm period={isAnalyticsPeriod(period) ? period : "week"} />;
    }
  }
  return <AdminSectionPage {...sectionProps(props)} />;
}
