"use client";

import { useState } from "react";
import { StaffIcon } from "./staff-icon";
import { StaffSpinner } from "./staff-feedback";
import styles from "./staff.module.css";

/**
 * Downloads a staff export route. A plain link cannot tell the operator that the
 * server refused, so the response is fetched and surfaced in place.
 */
export function StaffExport({
  href,
  filename,
  label,
  title,
  failure,
}: {
  href: string | (() => string);
  filename: string;
  label: string;
  title: string;
  failure: string;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch(typeof href === "function" ? href() : href);
      if (!response.ok) throw new Error("export");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={styles.toolAction}
        title={title}
        disabled={busy}
        aria-busy={busy}
        onClick={download}
      >
        {busy ? <StaffSpinner /> : <StaffIcon name="download" />}
        {label}
      </button>
      {failed && (
        <small role="alert" className={styles.toolError}>
          {failure}
        </small>
      )}
    </>
  );
}
