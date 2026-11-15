"use client";

import { StatusBadge } from "../status-badge";
import { useRef, useState } from "react";
import { catalogPageAction } from "@/app/(staff)/admin/products/actions";
import {
  type CatalogCursor,
  type CatalogKind,
  type CatalogListEntry,
  type InventoryRow,
} from "@/domain/managed-catalog";
import { catalogStaffCopy as copy } from "@/i18n/catalog-staff-uk";
import { Photo } from "@/components/ui/photo";
import { CatalogActions } from "./catalog-actions";
import { StaffBusy, StaffNotice } from "../staff-feedback";
import { StaffPagination } from "../staff-pagination";
import styles from "./catalog.module.css";
import { InventoryTable } from "./inventory-table";

type Page = {
  rows: (CatalogListEntry | InventoryRow)[];
  next: CatalogCursor | null;
};

type Props = {
  kind: CatalogKind | "inventory";
  initial: Page | null;
  archived?: boolean;
};

export function CatalogList(props: Props) {
  const version =
    props.initial?.rows.map((row) => `${row.id}:${row.revision}`).join(",") ??
    "unavailable";
  return (
    <CatalogListState
      key={`${props.kind}:${props.archived}:${version}`}
      {...props}
    />
  );
}

function CatalogListState({ kind, initial, archived = false }: Props) {
  const requestId = useRef(0);
  const [data, setData] = useState(initial);
  const [number, setNumber] = useState(1);
  const [cursors, setCursors] = useState<(CatalogCursor | null)[]>([null]);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState(!initial);
  async function go(
    target: number,
    cursor = target === 1
      ? null
      : (cursors[target - 1] ??
        (target === number + 1 ? data?.next : undefined)),
  ) {
    if (cursor === undefined) return;
    const request = ++requestId.current;
    setPending(true);
    setFailure(false);
    try {
      const result = await catalogPageAction(kind, cursor, archived);
      if (request !== requestId.current) return;
      if (!result) return setFailure(true);
      if (target > 1 && !result.rows.length) return go(1, null);
      setData(result);
      setNumber(target);
      setCursors((current) => {
        const updated = current.slice(0, target);
        updated[target - 1] = cursor;
        return updated;
      });
    } catch {
      if (request === requestId.current) setFailure(true);
    } finally {
      if (request === requestId.current) setPending(false);
    }
  }

  return (
    <div aria-busy={pending}>
      {failure && (
        <StaffNotice message={copy.errors.unavailable} guidance="retry">
          <button
            className={styles.button}
            type="button"
            onClick={() => go(number)}
            disabled={pending}
          >
            {copy.retry}
          </button>
        </StaffNotice>
      )}
      {pending && <StaffBusy />}
      {data && !data.rows.length && (
        <p>{archived ? copy.archiveEmpty : copy.empty}</p>
      )}
      {kind === "inventory" ? (
        <InventoryTable
          rows={(data?.rows ?? []) as InventoryRow[]}
          reload={() => go(number)}
        />
      ) : (
        <div className={styles.cards}>
          {(data?.rows as CatalogListEntry[] | undefined)?.map(
            (record, index) => {
              const { title, image, alt, subtitle } = record;
              return (
                <article key={record.id} className={styles.card}>
                  {image && (
                    <Photo
                      src={image}
                      alt={alt}
                      className={styles.image}
                      sizes="320px"
                      loading={index === 0 ? "eager" : "lazy"}
                    />
                  )}
                  <h3>{title}</h3>
                  <p>{subtitle}</p>
                  <StatusBadge
                    kind="catalog"
                    value={
                      record.published
                        ? "published"
                        : record.everPublished
                          ? "hidden"
                          : "draft"
                    }
                  >
                    {record.published
                      ? copy.published
                      : record.everPublished
                        ? copy.hidden
                        : copy.draft}
                  </StatusBadge>
                  <CatalogActions
                    record={record}
                    title={title}
                    archived={archived}
                    kind={kind}
                    reload={() => go(number)}
                  />
                </article>
              );
            },
          )}
        </div>
      )}
      {(number > 1 || data?.next) && (
        <StaffPagination
          currentPage={number}
          reachablePages={number + Number(Boolean(data?.next))}
          pending={pending}
          onPageChange={(page) => void go(page)}
        />
      )}
    </div>
  );
}
