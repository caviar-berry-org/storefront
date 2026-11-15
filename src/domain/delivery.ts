export type DeliveryOption = { ref: string; label: string; cityRef?: string };
export const isDeliveryRef = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value);
export function eligibleBranch(row: Record<string, unknown>) {
  return (
    row.CategoryOfWarehouse === "Branch" &&
    ![
      "95dc212d-479c-4ffb-a8ab-8c1b9073d0bc",
      "f9316480-5f2d-425d-bc2c-ac7cd29decf0",
    ].includes(String(row.TypeOfWarehouse)) &&
    row.WarehouseStatus === "Working" &&
    row.DenyToSelect !== "1"
  );
}
