"use client";

import { staffCopy } from "@/i18n/staff-uk";
import { StaffIcon } from "./staff-icon";
import styles from "./staff-pagination.module.css";

const copy = staffCopy.pagination;

export function StaffPagination({
  currentPage,
  reachablePages,
  pending,
  onPageChange,
}: {
  currentPage: number;
  reachablePages: number;
  pending?: boolean;
  onPageChange: (page: number) => void;
}) {
  const first = Math.max(1, Math.min(currentPage - 1, reachablePages - 2));
  const last = Math.min(first + 2, reachablePages);
  const pages = Array.from(
    { length: last - first + 1 },
    (_, index) => first + index,
  );

  function numberButton(page: number) {
    return (
      <button
        key={page}
        type="button"
        aria-label={`${copy.page} ${page}`}
        aria-current={page === currentPage ? "page" : undefined}
        disabled={pending}
        onClick={() => page !== currentPage && onPageChange(page)}
      >
        {page}
      </button>
    );
  }

  return (
    <nav aria-label={copy.label} className={styles.pagination}>
      {currentPage > 1 && (
        <button
          type="button"
          aria-label={copy.previous}
          disabled={pending}
          onClick={() => onPageChange(currentPage - 1)}
          className={styles.previous}
        >
          <StaffIcon name="arrow" />
        </button>
      )}
      {first > 1 && numberButton(1)}
      {first > 2 && <span aria-hidden="true">…</span>}
      {pages.map(numberButton)}
      {last < reachablePages - 1 && <span aria-hidden="true">…</span>}
      {last < reachablePages && numberButton(reachablePages)}
      {currentPage < reachablePages && (
        <button
          type="button"
          aria-label={copy.next}
          disabled={pending}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <StaffIcon name="arrow" />
        </button>
      )}
    </nav>
  );
}
