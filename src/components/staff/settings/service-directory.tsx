import { settingsCopy } from "@/i18n/settings-staff-uk";
import { AdminSectionTabs } from "../admin-section-tabs";
import { getAdminSection } from "../navigation";
import { StaffHeading } from "../staff-heading";
import { StaffHelp } from "../staff-help";
import styles from "./settings.module.css";

const copy = settingsCopy.services;
const docs = copy.documentation;

function ServiceLinks({
  links,
}: {
  links: readonly { label: string; href: string }[];
}) {
  return (
    <div className={styles.serviceLinks}>
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          {...(link.href.startsWith("http") && {
            target: "_blank",
            rel: "noopener noreferrer",
          })}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}

export function ServiceDirectory() {
  return (
    <>
      <StaffHeading
        title={copy.title}
        tools={<StaffHelp label={copy.help} text={copy.helpText} />}
      />
      <AdminSectionTabs
        section={getAdminSection(["settings"])!.section}
        selected="services"
      />
      <div className={styles.page}>
        <div className={styles.services}>
          {copy.widgets.map((widget) => (
            <section className={styles.service} key={widget.id}>
              <header>
                <h3>{widget.title}</h3>
                <StaffHelp label={widget.title} text={widget.help} compact />
              </header>
              <p>{widget.summary}</p>
              <ServiceLinks links={widget.links} />
            </section>
          ))}
        </div>
        <section className={styles.service} data-wide>
          <header>
            <h3>{docs.title}</h3>
            <StaffHelp label={docs.title} text={docs.help} compact />
          </header>
          <p>{docs.summary}</p>
          <p className={styles.keyWarning}>{docs.warning}</p>
          <ServiceLinks links={[{ label: docs.linkLabel, href: docs.link }]} />
        </section>
      </div>
    </>
  );
}
