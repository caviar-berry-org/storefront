"use client";

import { useRef, useState, useTransition } from "react";
import { queryOrders } from "@/app/(staff)/admin/orders/actions";
import {
  defaultOrderFilters,
  orderSearchTerm,
  orderStatuses,
  orderTypes,
  type OrderCursor,
  type OrderError,
  type OrderFilters,
  type OrderPage,
} from "@/domain/orders";
import { ordersCopy as copy } from "@/i18n/orders-staff-uk";
import { staffCopy } from "@/i18n/staff-uk";
import { AdminLink } from "../admin-link";
import { OrderTable } from "./order-table";
import { StaffPagination } from "../staff-pagination";
import directory from "../customers/customers.module.css";
import { StaffSelect } from "../staff-select";
import { StaffBusy, StaffFieldError } from "../staff-feedback";
import { OrderNotice } from "./order-notice";

const fields = staffCopy.customerDirectory;

export function OrderDirectory({
  initial,
  initialFilters,
}: {
  initial: OrderPage | { error: OrderError };
  initialFilters: OrderFilters;
}) {
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState("error" in initial ? null : initial);
  const [cursors, setCursors] = useState<(OrderCursor | null)[]>(
    "next" in initial && initial.next ? [null, initial.next] : [null],
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState("error" in initial ? initial.error : null);
  const [pending, startTransition] = useTransition();
  const results = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const lastAttempt = useRef({ filters: initialFilters, page: 1 });

  const filtered = Boolean(
    filters.search.trim() || filters.status !== "all" || filters.type !== "all",
  );
  const dirty =
    draft.search !== filters.search ||
    draft.status !== filters.status ||
    draft.type !== filters.type;

  function load(nextFilters: OrderFilters, target = 1) {
    if (lock.current) return;
    if (orderSearchTerm(nextFilters.search) === null) {
      setError("invalid");
      return;
    }
    lastAttempt.current = { filters: nextFilters, page: target };
    lock.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await queryOrders(
          nextFilters,
          cursors[target - 1] ?? null,
        );
        if ("error" in result) return setError(result.error);
        setPage(result);
        setFilters(nextFilters);
        setCurrentPage(target);
        const next = result.next;
        const previous = cursors[target];
        if (
          target === 1 ||
          !next ||
          next.id !== previous?.id ||
          next.createdAt !== previous.createdAt
        ) {
          const visited = cursors.slice(0, target);
          setCursors(next ? [...visited, next] : visited);
        }
        if (target !== currentPage)
          results.current?.scrollIntoView({ block: "start" });
      } catch {
        setError("unavailable");
      } finally {
        lock.current = false;
      }
    });
  }

  return (
    <section
      className={directory.directory}
      aria-label={staffCopy.sections.orders}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          load(draft);
        }}
      >
        <fieldset className={directory.filters} disabled={pending}>
          <label className={directory.search}>
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
                error === "invalid" ? "order-search-error" : undefined
              }
              onChange={(event) => {
                setDraft({ ...draft, search: event.target.value });
                if (error === "invalid") setError(null);
              }}
            />
            <StaffFieldError
              id="order-search-error"
              message={error === "invalid" ? copy.searchInvalid : undefined}
            />
          </label>
          <StaffSelect
            label={copy.status}
            value={draft.status}
            onChange={(event) =>
              setDraft({
                ...draft,
                status: event.target.value as OrderFilters["status"],
              })
            }
          >
            <option value="all">{copy.all}</option>
            <option value="active">{copy.active}</option>
            {orderStatuses.map((status) => (
              <option key={status} value={status}>
                {copy.statuses[status]}
              </option>
            ))}
          </StaffSelect>
          <StaffSelect
            label={copy.type}
            value={draft.type}
            onChange={(event) =>
              setDraft({
                ...draft,
                type: event.target.value as OrderFilters["type"],
              })
            }
          >
            <option value="all">{copy.all}</option>
            {orderTypes.map((type) => (
              <option key={type} value={type}>
                {copy.types[type]}
              </option>
            ))}
          </StaffSelect>
          <div className={directory.actions}>
            <button className={directory.primary} type="submit">
              {fields.apply}
            </button>
            <button
              type="button"
              disabled={!filtered && !dirty && currentPage === 1}
              onClick={() => {
                setDraft(defaultOrderFilters);
                if (filtered || currentPage > 1) load(defaultOrderFilters);
                else setError(page ? null : "unavailable");
              }}
            >
              {fields.reset}
            </button>
          </div>
        </fieldset>
      </form>
      {error && error !== "invalid" && (
        <OrderNotice error={error}>
          {error === "session" ? (
            <AdminLink href="/sign-in">{staffCopy.signIn.title}</AdminLink>
          ) : (
            <button
              className={directory.retry}
              type="button"
              disabled={pending}
              onClick={() =>
                load(lastAttempt.current.filters, lastAttempt.current.page)
              }
            >
              {copy.retry}
            </button>
          )}
        </OrderNotice>
      )}
      <div ref={results} className={directory.status}>
        {pending ? (
          <StaffBusy />
        ) : (
          page && `${staffCopy.pagination.page} ${currentPage}`
        )}
      </div>
      <div aria-busy={pending} className={directory.results}>
        {page &&
          (page.rows.length ? (
            <OrderTable rows={page.rows} />
          ) : (
            <p className={directory.empty}>
              {filtered ? copy.noMatches : copy.empty}
            </p>
          ))}
        {page && cursors.length > 1 && (
          <StaffPagination
            currentPage={currentPage}
            reachablePages={cursors.length}
            pending={pending}
            onPageChange={(target) => load(filters, target)}
          />
        )}
      </div>
    </section>
  );
}
