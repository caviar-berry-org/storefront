"use client";
import { StaffHeading } from "../staff-heading";
import { StaffHelp } from "../staff-help";
import { AdminSectionTabs } from "../admin-section-tabs";
import { getAdminSection } from "../navigation";
import promotionStyles from "./promotions.module.css";
import { StaffExport } from "../staff-export";
import staff from "../staff.module.css";
import { useRef, useState, useTransition } from "react";
import { promotionsCopy as c } from "@/i18n/promotions-staff-uk";
import type { readPromotionIssues } from "@/lib/server/promotions/queries";
import { queryPromotionIssues } from "@/app/(staff)/admin/promotions/actions";
import { StaffPagination } from "../staff-pagination";
import { StaffFieldError } from "../staff-feedback";
import { StatusBadge } from "../status-badge";
import s from "../customers/customers.module.css";
export function PromotionIssues(
  initial: Awaited<ReturnType<typeof readPromotionIssues>>,
) {
  const [page, setPage] = useState(initial),
    [search, setSearch] = useState(initial.search),
    [current, setCurrent] = useState(1),
    [error, setError] = useState(""),
    [pending, start] = useTransition();
  const [cursors, setCursors] = useState<(typeof initial.next)[]>(
    initial.next ? [null, initial.next] : [null],
  );
  const applied = useRef(initial.search),
    lock = useRef(false);
  function load(target = 1, reset = false) {
    if (lock.current) return;
    lock.current = true;
    setError("");
    start(async () => {
      try {
        const term = reset ? search : applied.current;
        const cursor = reset ? null : cursors[target - 1];
        const result = await queryPromotionIssues({
          search: term,
          ...(cursor ? { before: String(cursor.before), id: cursor.id } : {}),
        });
        if ("error" in result) {
          setError(c[result.error]);
          return;
        }
        setPage(result);
        setCurrent(target);
        applied.current = term;
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
    <div className={promotionStyles.page}>
      <StaffHeading
        title={c.title}
        tools={
          <div className={staff.recordTools}>
            <StaffExport
              href={() =>
                `/admin/promotions/export?search=${encodeURIComponent(applied.current)}`
              }
              filename="promotion-issues.xlsx"
              label="Excel"
              title={c.exportExcel}
              failure={c.unavailable}
            />
            <StaffHelp
              label={c.help}
              text={
                c.terms +
                " Експорт містить усі видачі або застосований пошук email."
              }
            />
          </div>
        }
      />
      <AdminSectionTabs
        section={getAdminSection(["promotions"])!.section}
        selected="issues"
      />
      <section className={s.directory}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(1, true);
          }}
        >
          <fieldset disabled={pending} className={s.filters}>
            <label className={s.search}>
              <span>{c.search}</span>
              <input
                type="search"
                maxLength={254}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-invalid={error === c.searchInvalid}
                aria-describedby={
                  error === c.searchInvalid
                    ? "promotion-search-error"
                    : undefined
                }
              />
              {/* Always mounted: the reserved line keeps the button aligned. */}
              <StaffFieldError
                id="promotion-search-error"
                message={error === c.searchInvalid ? error : undefined}
              />
            </label>
            <div className={s.actions}>
              <button className={s.primary}>{c.search}</button>
            </div>
          </fieldset>
        </form>
        {error && error !== c.searchInvalid && <p role="alert">{error}</p>}
        <div className={s.tableWrap} aria-busy={pending}>
          <table className={s.table}>
            <thead>
              <tr>
                {[c.email, c.code, c.created, c.expires, c.state].map(
                  (label) => (
                    <th scope="col" key={label}>
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {page.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.email}</strong>
                  </td>
                  <td>
                    {/* A consumed code can no longer be entered anywhere. */}
                    <span
                      className={
                        row.usage === "used" ? promotionStyles.spent : undefined
                      }
                    >
                      {row.code}
                    </span>{" "}
                    · {row.percent}%
                  </td>
                  <td>{row.created}</td>
                  <td>{row.expires}</td>
                  <td>
                    <div className={promotionStyles.issueState}>
                      <StatusBadge kind="promoUsage" value={row.usage}>
                        {c[row.usage]}
                      </StatusBadge>
                      {c.states[row.state as keyof typeof c.states] && (
                        <StatusBadge kind="mail" value={row.state}>
                          {c.states[row.state as keyof typeof c.states]}
                        </StatusBadge>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!page.rows.length && <p className={s.empty}>{c.empty}</p>}
        </div>
        <StaffPagination
          currentPage={current}
          reachablePages={cursors.length}
          pending={pending}
          onPageChange={(n) => load(n)}
        />
      </section>
    </div>
  );
}
