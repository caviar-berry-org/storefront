"use client";
import local from "./inquiries.module.css";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateInquiry } from "@/app/(staff)/admin/inquiries/actions";
import { inquiryStatuses, type InquiryRecord } from "@/domain/staff-inquiries";
import { inquiriesCopy as c } from "@/i18n/inquiries-staff-uk";
import { StaffSelect } from "../staff-select";
import { StatusBadge } from "../status-badge";
import s from "../catalog/catalog.module.css";
export function InquiryStatusEditor({ record }: { record: InquiryRecord }) {
  const [current, setCurrent] = useState({
      status: record.status,
      revision: record.revision,
    }),
    [draft, setDraft] = useState(record.status),
    [error, setError] = useState(""),
    [pending, start] = useTransition();
  const opened = useRef(false);
  const router = useRouter();
  useEffect(() => {
    if (opened.current || record.status !== "new") return;
    opened.current = true;
    start(async () => {
      try {
        const r = await updateInquiry(record.id, "open", record.revision);
        if ("error" in r) setError(c[r.error ?? "unavailable"]);
        else {
          setCurrent(r);
          setDraft(r.status);
          router.refresh();
        }
      } catch {
        setError(c.viewedFailed);
      }
    });
  }, [record.id, record.status, record.revision, router]);
  return (
    <form
      className={`${s.group} ${local.statusForm}`}
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        start(async () => {
          try {
            const r = await updateInquiry(record.id, draft, current.revision);
            if ("error" in r) setError(c[r.error ?? "unavailable"]);
            else {
              setCurrent(r);
              setDraft(r.status);
              window.dispatchEvent(new Event("inquiries-updated"));
              router.refresh();
            }
          } catch {
            setError(c.unavailable);
          }
        });
      }}
    >
      <fieldset disabled={pending} className={s.field}>
        {/* The saved status stays visible while a different one is being picked. */}
        <p className={local.statusCurrent}>
          <span>{c.currentStatus}</span>
          <StatusBadge kind="inquiry" value={current.status}>
            {c.statuses[current.status]}
          </StatusBadge>
        </p>
        <StaffSelect
          label={c.status}
          value={draft}
          onChange={(e) => setDraft(e.target.value as typeof draft)}
        >
          {inquiryStatuses
            .filter((st) => st !== "new" || current.status === "new")
            .map((st) => (
              <option value={st} key={st}>
                {c.statuses[st]}
              </option>
            ))}
        </StaffSelect>
        {error && <p role="alert">{error}</p>}
        <div className={s.controls}>
          <button
            className={s.primary}
            disabled={pending || draft === current.status}
          >
            {c.save}
          </button>
          <button
            type="button"
            className={s.button}
            onClick={() => setDraft(current.status)}
          >
            {c.cancel}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
