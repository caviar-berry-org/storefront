"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { queryCustomers } from "@/app/(staff)/admin/customers/actions";
import {
  customerSearchTerm,
  customerTypes,
  type CustomerCursor,
  type CustomerFilters,
  type CustomerPage,
  type CustomerQueryError,
  type CustomerType,
} from "@/domain/customer-directory";
import { staffCopy } from "@/i18n/staff-uk";
import { StaffBusy, StaffFieldError, StaffNotice } from "../staff-feedback";
import { AdminLink } from "../admin-link";
import { CustomerTable } from "./customer-table";
import { StaffPagination } from "../staff-pagination";
import styles from "./customers.module.css";

const copy = staffCopy.customerDirectory;
const allCustomers: CustomerFilters = { search: "", types: [] };

export function CustomerDirectory({
  initialPage,
  today,
}: {
  initialPage: CustomerPage | null;
  today: string;
}) {
  const [draft, setDraft] = useState(allCustomers);
  const [filters, setFilters] = useState(allCustomers);
  const [page, setPage] = useState(initialPage);
  const [cursors, setCursors] = useState<(CustomerCursor | null)[]>(
    initialPage?.next ? [null, initialPage.next] : [null],
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<CustomerQueryError | null>(
    initialPage ? null : "unavailable",
  );
  const [pending, startTransition] = useTransition();
  const lock = useRef(false);
  const resultStart = useRef<HTMLDivElement>(null);

  function load(nextFilters: CustomerFilters, targetPage = 1, reset = true) {
    if (lock.current) return;
    if (customerSearchTerm(nextFilters.search) === null) {
      setError("invalid");
      return;
    }

    lock.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await queryCustomers(
          nextFilters,
          reset ? null : (cursors[targetPage - 1] ?? null),
        );
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setPage(result);
        setFilters(nextFilters);
        const next = result.next;
        const previousNext = cursors[targetPage];
        if (
          reset ||
          !next ||
          next.id !== previousNext?.id ||
          next.lastInteractionAt !== previousNext.lastInteractionAt
        ) {
          const known = reset ? [null] : cursors.slice(0, targetPage);
          setCursors(next ? [...known, next] : known);
        }
        setCurrentPage(targetPage);
        if (targetPage !== currentPage) {
          resultStart.current?.scrollIntoView({ block: "start" });
        }
      } catch {
        setError("unavailable");
      } finally {
        lock.current = false;
      }
    });
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    load(draft);
  }

  function selectType(type: CustomerType, checked: boolean) {
    setDraft((current) => ({
      ...current,
      types: checked
        ? [...current.types, type]
        : current.types.filter((item) => item !== type),
    }));
  }

  const filtered = Boolean(filters.search.trim() || filters.types.length);
  const dirty =
    draft.search !== filters.search ||
    customerTypes.some(
      (type) => draft.types.includes(type) !== filters.types.includes(type),
    );

  return (
    <section
      aria-label={staffCopy.sections.customers}
      className={styles.directory}
    >
      <form onSubmit={apply}>
        <fieldset className={styles.filters} disabled={pending}>
          <label className={styles.search}>
            <span>{copy.search}</span>
            <input
              type="search"
              autoComplete="off"
              spellCheck={false}
              maxLength={254}
              placeholder={copy.searchHint}
              value={draft.search}
              aria-invalid={error === "invalid"}
              aria-describedby={
                error === "invalid" ? "customer-search-error" : undefined
              }
              onChange={(event) => {
                setDraft({ ...draft, search: event.target.value });
                if (error === "invalid") setError(null);
              }}
            />
            <StaffFieldError
              id="customer-search-error"
              message={error === "invalid" ? copy.invalid : undefined}
            />
          </label>
          <fieldset className={styles.segments}>
            <legend>{copy.segments}</legend>
            <div>
              {customerTypes.map((type) => (
                <label key={type}>
                  <input
                    type="checkbox"
                    checked={draft.types.includes(type)}
                    onChange={(event) => selectType(type, event.target.checked)}
                  />
                  {copy.types[type]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className={styles.actions}>
            <button
              className={styles.primary}
              type="submit"
              disabled={!dirty && !error && currentPage === 1}
            >
              {copy.apply}
            </button>
            <button
              type="button"
              disabled={!dirty && !filtered && currentPage === 1}
              onClick={() => {
                setDraft(allCustomers);
                if (filtered || currentPage > 1) load(allCustomers);
                else setError(page ? null : "unavailable");
              }}
            >
              {copy.reset}
            </button>
          </div>
        </fieldset>
      </form>
      {error && error !== "invalid" && (
        <StaffNotice
          message={copy[error]}
          guidance={
            error === "indexRequired"
              ? "technical"
              : error === "unavailable"
                ? "retry"
                : undefined
          }
        >
          {error === "session" && (
            <AdminLink href="/sign-in">{staffCopy.signIn.title}</AdminLink>
          )}
        </StaffNotice>
      )}
      <div ref={resultStart} className={styles.status}>
        {pending ? (
          <StaffBusy />
        ) : (
          page && `${staffCopy.pagination.page} ${currentPage}`
        )}
      </div>
      <div aria-busy={pending} className={styles.results}>
        {page &&
          (page.rows.length ? (
            <CustomerTable rows={page.rows} today={today} />
          ) : (
            <p className={styles.empty}>
              {filtered ? copy.noMatches : copy.empty}
            </p>
          ))}
        {page && (page.rows.length > 0 || currentPage > 1) && (
          <StaffPagination
            currentPage={currentPage}
            reachablePages={cursors.length}
            pending={pending}
            onPageChange={(target) => load(filters, target, false)}
          />
        )}
      </div>
    </section>
  );
}
