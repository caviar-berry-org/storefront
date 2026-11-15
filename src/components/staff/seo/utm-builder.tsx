"use client";

import { useState } from "react";
import { utmLink, utmSources } from "@/domain/attribution";
import { seoStaffCopy } from "@/i18n/seo-staff-uk";
import { StaffCopyButton } from "../staff-copy";
import { StaffFieldError } from "../staff-feedback";
import { StaffSelect } from "../staff-select";
import catalog from "../catalog/catalog.module.css";
import styles from "./seo.module.css";

const copy = seoStaffCopy.utm;
const pages = [
  { id: "home", path: "/ua" },
  { id: "caviar", path: "/ua#ikra" },
  { id: "gifts", path: "/ua#gifts" },
  { id: "delivery", path: "/ua#delivery" },
] as const;

const validCampaign = /^[a-z0-9][a-z0-9._-]{0,39}$/;

/** No moderation here: the links are generated, copied and pasted elsewhere. */
export function UtmBuilder({ origin }: { origin: string }) {
  const [page, setPage] = useState<string>(pages[0].path);
  const [campaign, setCampaign] = useState("");
  const normalized = campaign.trim().toLowerCase();
  const valid = !normalized || validCampaign.test(normalized);

  return (
    <div className={styles.builder}>
      <div className={styles.builderRow}>
        <StaffSelect
          label={copy.page}
          value={page}
          onChange={(event) => setPage(event.target.value)}
        >
          {pages.map((entry) => (
            <option key={entry.id} value={entry.path}>
              {copy.pages[entry.id]}
            </option>
          ))}
        </StaffSelect>
        <label className={catalog.field}>
          {copy.campaign}
          <input
            value={campaign}
            maxLength={40}
            autoComplete="off"
            spellCheck={false}
            placeholder="autumn-2026"
            aria-invalid={!valid}
            aria-describedby="utm-campaign-error"
            onChange={(event) => setCampaign(event.target.value)}
          />
        </label>
        <StaffFieldError
          id="utm-campaign-error"
          message={valid ? undefined : copy.campaignHint}
        />
      </div>
      <ul className={styles.links}>
        {utmSources
          .filter((source) => source !== "offline" && source !== "other")
          .map((source) => {
            const href = utmLink(origin, page, source, {
              ...(valid && normalized && { campaign: normalized }),
            });
            return (
              <li key={source}>
                <span className={styles.linkSource}>{source}</span>
                <code>{href}</code>
                <StaffCopyButton value={href} label={source} />
              </li>
            );
          })}
      </ul>
    </div>
  );
}
