"use client";

import { createContext, useState, type ReactNode } from "react";
import { catalogStaffCopy as copy } from "@/i18n/catalog-staff-uk";
import { StaffHelp } from "../staff-help";
import { StaffIcon } from "../staff-icon";
import styles from "./catalog.module.css";

export const ShowImagePreview = createContext(true);

export function CatalogGroup({
  title,
  help,
  children,
  collapsible = false,
  initiallyOpen = false,
  badge,
}: {
  title: string;
  help?: string;
  children: ReactNode;
  collapsible?: boolean;
  initiallyOpen?: boolean;
  badge?: ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  if (collapsible) {
    return (
      <section
        className={styles.disclosure}
        data-has-help={help ? true : undefined}
      >
        <details
          data-catalog-section
          open={open}
          onToggle={(event) => setOpen(event.currentTarget.open)}
        >
          <summary className={styles.summary}>
            <h2>
              <StaffIcon name="chevron" />
              {title}
              {badge}
            </h2>
          </summary>
          <div className={styles.sectionBody}>
            <ShowImagePreview.Provider value={open}>
              {children}
            </ShowImagePreview.Provider>
          </div>
        </details>
        {help && (
          <div className={styles.sectionHelp}>
            <StaffHelp label={`${copy.helpAbout} ${title}`} text={help} />
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={styles.group}>
      <div className={styles.fieldTitle}>
        <h2>
          {title}
          {badge}
        </h2>
        {help && <StaffHelp label={title} text={help} />}
      </div>
      {children}
    </section>
  );
}
