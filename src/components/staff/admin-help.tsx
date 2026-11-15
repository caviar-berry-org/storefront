import { adminHelpCopy as copy } from "@/i18n/admin-help-uk";
import { AdminLink } from "./admin-link";
import { AdminSectionTabs } from "./admin-section-tabs";
import { CatalogGroup } from "./catalog/catalog-group";
import { getAdminSection } from "./navigation";
import { StaffHeading } from "./staff-heading";
import styles from "./admin-help.module.css";

export function AdminHelp() {
  return (
    <div className={styles.page}>
      <StaffHeading title={copy.title} />
      <AdminSectionTabs
        section={getAdminSection(["settings"])!.section}
        selected="help"
      />
      <p className={styles.introduction}>{copy.introduction}</p>
      <nav className={styles.contents} aria-label={copy.navigation}>
        {copy.sections.map((section) => (
          <a key={section.id} href={`#help-${section.id}`}>
            {section.title}
          </a>
        ))}
      </nav>
      {copy.sections.map((section, index) => (
        <div
          className={styles.section}
          id={`help-${section.id}`}
          key={section.id}
        >
          <CatalogGroup
            title={section.title}
            collapsible
            initiallyOpen={index === 0}
          >
            {section.links.length > 0 && (
              <nav className={styles.links} aria-label={section.title}>
                {section.links.map((link) => (
                  <AdminLink href={link.href} key={link.href}>
                    {link.label}
                  </AdminLink>
                ))}
              </nav>
            )}
            {section.steps.length > 0 && (
              <div>
                <h3>{copy.steps}</h3>
                <ol>
                  {section.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
            <div>
              <h3>{copy.rules}</h3>
              <ul>
                {section.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
          </CatalogGroup>
        </div>
      ))}
    </div>
  );
}
