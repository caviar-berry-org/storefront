"use client";
import { useRef, useState, useTransition } from "react";
import { queryInquiries } from "@/app/(staff)/admin/inquiries/actions";
import {
  inquiryStatuses,
  inquiryInventoryHref,
  type InquiryCategory,
  type InquiryCursor,
  type InquiryPage,
} from "@/domain/staff-inquiries";
import { inquiriesCopy as c } from "@/i18n/inquiries-staff-uk";
import { AdminLink } from "../admin-link";
import { StaffPagination } from "../staff-pagination";
import { StaffSelect } from "../staff-select";
import s from "../customers/customers.module.css";
import local from "./inquiries.module.css";
import { StatusBadge } from "../status-badge";
export function InquiryDirectory({
  category,
  initial,
}: {
  category: InquiryCategory;
  initial: InquiryPage | null;
}) {
  const [page, setPage] = useState(initial),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [error, setError] = useState(initial ? "" : (c.unavailable as string)),
    [pending, start] = useTransition(),
    [current, setCurrent] = useState(1);
  const [cursors, setCursors] = useState<(InquiryCursor | null)[]>(
    initial?.next ? [null, initial.next] : [null],
  );
  const applied = useRef({ search: "", status: "all" });
  const lock = useRef(false);
  function load(target = 1, reset = false) {
    if (lock.current) return;
    lock.current = true;
    setError("");
    start(async () => {
      try {
        const f = reset ? { search, status } : applied.current;
        const result = await queryInquiries(
          category,
          f.search,
          f.status,
          reset ? null : (cursors[target - 1] ?? null),
        );
        if ("error" in result) {
          setError(c[result.error]);
          return;
        }
        applied.current = f;
        setPage(result);
        setCurrent(target);
        const known = reset ? [null] : cursors.slice(0, target);
        setCursors(result.next ? [...known, result.next] : known);
      } catch {
        setError(c.unavailable);
      } finally {
        lock.current = false;
      }
    });
  }
  return (
    <section className={s.directory} aria-label={c.categories[category]}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(1, true);
        }}
      >
        <fieldset
          disabled={pending}
          className={`${s.filters} ${local.filters}`}
          data-simple={category === "restock"}
        >
          <label className={s.search}>
            <span>{category === "restock" ? c.emailSearch : c.search}</span>
            <input
              type="search"
              maxLength={254}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                category === "restock" ? "email@example.com" : c.hint
              }
              aria-describedby={
                error === c.invalid ? "inquiry-search-error" : undefined
              }
              aria-invalid={error === c.invalid}
            />
            {error === c.invalid && (
              <span id="inquiry-search-error" role="status">
                {error}
              </span>
            )}
          </label>
          <div className={local.filterGroup}>
            {category !== "restock" && (
              <StaffSelect
                label={c.status}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">{c.all}</option>
                {inquiryStatuses.map((st) => (
                  <option key={st} value={st}>
                    {c.statuses[st]}
                  </option>
                ))}
              </StaffSelect>
            )}
            <div className={s.actions}>
              <button className={s.primary}>{c.apply}</button>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                  applied.current = { search: "", status: "all" };
                  load();
                }}
              >
                {c.reset}
              </button>
            </div>
          </div>
        </fieldset>
      </form>
      {error && error !== c.invalid && <p role="alert">{error}</p>}
      <div className={s.tableWrap} aria-busy={pending}>
        <table className={s.table}>
          <thead>
            <tr>
              {[
                c.name,
                c.contact,
                c.subject,
                category === "restock" ? c.mail : c.status,
                c.date,
              ].map((h) => (
                <th scope="col" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {page?.rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <AdminLink
                    className={s.customerLink}
                    href={`/admin/inquiries/${category}/${r.id}`}
                  >
                    {r.name}
                  </AdminLink>
                </td>
                <td>{r.contact}</td>
                <td>
                  {inquiryInventoryHref(r) ? (
                    <AdminLink
                      className={s.badge}
                      href={inquiryInventoryHref(r)!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {r.subject}
                    </AdminLink>
                  ) : (
                    <span className={s.badge}>{r.subject}</span>
                  )}
                </td>
                <td>
                  {category === "restock" ? (
                    (c.mailStates[r.mail as keyof typeof c.mailStates] ??
                    r.mail)
                  ) : (
                    <StatusBadge kind="inquiry" value={r.status}>
                      {c.statuses[r.status]}
                    </StatusBadge>
                  )}
                </td>
                <td>
                  {new Date(r.createdAt).toLocaleString("uk-UA", {
                    timeZone: "Europe/Kyiv",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {page && !page.rows.length && <p className={s.empty}>{c.empty}</p>}
      </div>
      {page && (
        <StaffPagination
          currentPage={current}
          reachablePages={cursors.length}
          pending={pending}
          onPageChange={(n) => load(n)}
        />
      )}
    </section>
  );
}
