"use server";
import { after } from "next/server";
import { queueRestockMail, deliverMailJobs } from "@/lib/server/mail/jobs";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  catalogKinds,
  validCatalogId,
  type CatalogCursor,
  type CatalogKind,
  type Stock,
} from "@/domain/managed-catalog";
import { catalogStaff } from "@/lib/server/catalog/access";
import { stockInput } from "@/lib/server/catalog/stock-form";
import {
  readCatalogPage,
  readInventoryPage,
} from "@/lib/server/catalog/queries";
import { refreshCatalog } from "@/lib/server/catalog/storefront";
import { saveCatalogRecord } from "@/lib/server/catalog/save-record";
import { writeCatalogVisibility } from "@/lib/server/catalog/visibility";
import { writeStock } from "@/lib/server/catalog/inventory";
import {
  knownCatalogError,
  type CatalogMutationResult as Result,
} from "@/lib/server/catalog/mutation-errors";

function reportCatalogSaveError(
  kind: CatalogKind,
  stage: "write" | "refresh",
  error: unknown,
) {
  const code = error instanceof Error && "code" in error ? error.code : null;
  const safeCode =
    typeof code === "number" ||
    (typeof code === "string" && /^[a-z][a-z0-9_-]{0,47}$/i.test(code))
      ? code
      : null;
  console.error("[catalog.save]", { kind, stage, code: safeCode });
}

function validCursor(cursor: CatalogCursor | null) {
  return (
    cursor === null ||
    (Boolean(cursor) &&
      Number.isSafeInteger(cursor.rank) &&
      validCatalogId(cursor.id))
  );
}

export async function catalogPageAction(
  kind: CatalogKind | "inventory",
  cursor: CatalogCursor | null,
  archived = false,
) {
  if (
    !(await catalogStaff()) ||
    !validCursor(cursor) ||
    typeof archived !== "boolean"
  )
    return null;
  try {
    if (kind === "inventory") return await readInventoryPage(cursor);
    return catalogKinds.includes(kind)
      ? await readCatalogPage(kind, cursor, archived)
      : null;
  } catch {
    return null;
  }
}

export async function saveCatalogAction(
  kind: CatalogKind,
  id: string | null,
  revision: number,
  form: FormData,
): Promise<Result> {
  const staff = await catalogStaff();
  if (!staff) return { error: "denied" };
  if (!catalogKinds.includes(kind) || (id !== null && !validCatalogId(id)))
    return { error: "invalid" };
  const recordId = id ?? randomUUID();

  try {
    await saveCatalogRecord(kind, id, recordId, revision, form, staff.uid);
  } catch (error) {
    const known = knownCatalogError(error);
    if (known) return known;
    reportCatalogSaveError(kind, "write", error);
    return { error: "unavailable" };
  }
  try {
    invalidate(kind);
  } catch (error) {
    reportCatalogSaveError(kind, "refresh", error);
  }
  return { id: recordId };
}

export async function changeCatalogVisibility(
  kind: CatalogKind,
  id: string,
  revision: number,
  operation: "hide" | "restore" | "delete",
): Promise<Result> {
  const staff = await catalogStaff();
  if (!staff) return { error: "denied" };
  if (
    !catalogKinds.includes(kind) ||
    !validCatalogId(id) ||
    !["hide", "restore", "delete"].includes(operation)
  )
    return { error: "invalid" };

  try {
    await writeCatalogVisibility(kind, id, revision, operation, staff.uid);
  } catch (error) {
    return knownCatalogError(error) ?? { error: "unavailable" };
  }
  invalidate(kind);
  return { id };
}

export async function saveInventoryAction(
  id: string,
  packId: string,
  revision: number,
  form: FormData,
): Promise<Result> {
  return updateInventory(id, packId, revision, (previous) =>
    stockInput(form, previous),
  );
}

export async function clearInventoryAction(
  id: string,
  packId: string,
  revision: number,
): Promise<Result> {
  return updateInventory(id, packId, revision, ({ reserved }) => ({
    quantity: reserved,
    reserved,
    batches: [],
  }));
}

async function updateInventory(
  id: string,
  packId: string,
  revision: number,
  updateStock: (previous: Stock) => Stock,
): Promise<Result> {
  const staff = await catalogStaff();
  if (!staff) return { error: "denied" };
  if (!validCatalogId(id) || !validCatalogId(packId))
    return { error: "invalid" };
  try {
    await writeStock(id, packId, revision, updateStock, staff.uid);
  } catch (error) {
    return knownCatalogError(error) ?? { error: "unavailable" };
  }
  invalidate("caviar");
  return { id };
}

function invalidate(kind: CatalogKind) {
  refreshCatalog(kind);
  if (kind === "caviar")
    after(async () => {
      await queueRestockMail();
      await deliverMailJobs();
    });
  revalidatePath(`/admin/products/${kind}`);
  revalidatePath("/admin/products/archive");
  if (kind === "caviar") revalidatePath("/admin/products/inventory");
  revalidatePath(`/admin/products/${kind}/[id]`, "page");
  if (kind === "caviar")
    revalidatePath("/admin/products/inventory/[id]/[pack]", "page");
  revalidatePath("/[locale]", "layout");
  if (kind === "caviar") revalidatePath("/sitemap.xml");
}
