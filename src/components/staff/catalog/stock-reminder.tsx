"use client";
import { useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { AdminLink } from "../admin-link";
import { StaffIcon } from "../staff-icon";
import s from "./catalog.module.css";

/**
 * Shown once, right after a card is created: a published product with no stock
 * is visible on the storefront but cannot be ordered, and that is the single
 * thing most likely to be missed.
 */
export function StockReminder({ id }: { id: string }) {
  const dialog = useRef<HTMLDialogElement>(null),
    title = useId();
  const router = useRouter();
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={s.modal}
      aria-labelledby={title}
      onClose={() => router.replace("/admin/products/caviar")}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <h2 id={title}>Картку товару створено</h2>
      <p>
        До поповнення кожне фасування має нульову доступну кількість, тож товар
        видно на сайті, але замовити його не можна.
      </p>
      <div className={s.controls}>
        <AdminLink
          className={s.primary}
          href={`/admin/products/inventory?product=${encodeURIComponent(id)}`}
        >
          <StaffIcon name="products" />
          Внести залишки
        </AdminLink>
        <button
          type="button"
          className={s.button}
          onClick={() => dialog.current?.close()}
        >
          Пізніше
        </button>
      </div>
    </dialog>
  );
}
