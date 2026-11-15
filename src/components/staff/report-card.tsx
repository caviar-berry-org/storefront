"use client";

import { useId, useState } from "react";
import { staffCopy } from "@/i18n/staff-uk";
import { PlannedState } from "./planned-state";
import { StaffIcon, type StaffIconName } from "./staff-icon";
import styles from "./staff.module.css";

const periods = Object.entries(staffCopy.dashboard.periods);

export function ReportCard({
  title,
  icon,
}: {
  title: string;
  icon: StaffIconName;
}) {
  const id = useId();
  const [period, setPeriod] = useState("month");

  return (
    <section className={styles.card} aria-labelledby={id}>
      <div className={styles.reportHeader}>
        <h2 id={id}>
          <StaffIcon name={icon} />
          {title}
        </h2>
        <fieldset className={styles.periods}>
          <legend className={styles.srOnly}>
            {staffCopy.dashboard.period}
          </legend>
          {periods.map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name={id}
                value={value}
                checked={period === value}
                onChange={() => setPeriod(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
      </div>
      <div className={styles.chart} data-period={period}>
        <PlannedState label={staffCopy.unavailable} />
      </div>
    </section>
  );
}
