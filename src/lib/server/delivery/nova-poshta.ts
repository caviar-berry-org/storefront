import "server-only";
import { unstable_cache } from "next/cache";
import {
  eligibleBranch,
  isDeliveryRef,
  type DeliveryOption,
} from "@/domain/delivery";

async function directory(method: string, properties: Record<string, string>) {
  if (!process.env.NOVA_POSHTA_API_KEY)
    throw new Error("Delivery unavailable.");
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch("https://api.novaposhta.ua/v2.0/json/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: process.env.NOVA_POSHTA_API_KEY,
        modelName: "Address",
        calledMethod: method,
        methodProperties: properties,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const result = response.ok ? await response.json() : null;
    if (
      (response.status === 429 ||
        result?.errorCodes?.includes("20000401501")) &&
      attempt < 2
    ) {
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
      continue;
    }
    if (!response.ok) throw new Error("Delivery unavailable.");
    if (result.success !== true || !Array.isArray(result.data))
      throw new Error("Delivery unavailable.");
    return result.data as Record<string, unknown>[];
  }
  throw new Error("Delivery unavailable.");
}
const cities = unstable_cache(
  (query: string) =>
    directory("getCities", { FindByString: query, Limit: "20", Page: "1" }),
  ["nova-cities-v1"],
  { revalidate: 86400 },
);
const branches = unstable_cache(
  (cityRef: string, query: string) =>
    directory("getWarehouses", {
      CityRef: cityRef,
      FindByString: query,
      Limit: "100",
      Page: "1",
      TypeOfWarehouse: "",
    }),
  ["nova-branches-v1"],
  { revalidate: 600 },
);
export async function deliveryOptions(
  kind: string,
  query: string,
  cityRef?: string,
): Promise<DeliveryOption[]> {
  if (kind === "cities")
    return (await cities(query))
      .filter((r) => isDeliveryRef(r.Ref))
      .map((r) => ({
        ref: String(r.Ref),
        label: `${r.Description}${r.AreaDescription ? `, ${r.AreaDescription}` : ""}`,
      }));
  if (kind === "streets" && isDeliveryRef(cityRef))
    return (
      await directory("getStreet", {
        CityRef: cityRef,
        FindByString: query,
        Limit: "50",
      })
    )
      .filter((r) => isDeliveryRef(r.Ref))
      .map((r) => ({
        ref: String(r.Ref),
        label: String(r.Description),
        cityRef,
      }));
  if (kind !== "branches" || !isDeliveryRef(cityRef))
    throw new Error("Invalid delivery query.");
  return (await branches(cityRef, query)).filter(eligibleBranch).map((r) => ({
    ref: String(r.Ref),
    label: String(r.Description),
    cityRef: String(r.CityRef),
  }));
}
export async function resolveDelivery(input: {
  cityRef?: string;
  branchRef?: string;
  streetRef?: string;
  street?: string;
  house?: string;
  apartment?: string;
  entrance?: string;
  floor?: string;
  delivery: string;
  address: string;
}) {
  if (!isDeliveryRef(input.cityRef)) return null;
  const rows = await directory("getCities", { Ref: input.cityRef, Limit: "1" });
  const city = rows.find((r) => r.Ref === input.cityRef);
  if (!city) return null;
  if (input.delivery === "courier") {
    if (
      !isDeliveryRef(input.streetRef) ||
      !input.street ||
      !input.house?.trim()
    )
      return null;
    const streets = await directory("getStreet", {
      CityRef: input.cityRef,
      FindByString: input.street,
      Limit: "100",
    });
    const street = streets.find((row) => row.Ref === input.streetRef);
    if (!street) return null;
    const fields = {
      streetRef: input.streetRef,
      street: String(street.Description),
      house: input.house.trim(),
      apartment: input.apartment?.trim() ?? "",
      entrance: input.entrance?.trim() ?? "",
      floor: input.floor?.trim() ?? "",
    };
    return {
      city: String(city.Description),
      cityRef: input.cityRef,
      destination: `${street.StreetsType ?? ""} ${fields.street}, ${fields.house}${fields.apartment ? `, кв. ${fields.apartment}` : ""}`,
      ...fields,
    };
  }
  if (!isDeliveryRef(input.branchRef)) return null;
  const warehouses = await directory("getWarehouses", {
    Ref: input.branchRef,
    CityRef: input.cityRef,
    Limit: "1",
  });
  const branch = warehouses.find(
    (r) =>
      r.Ref === input.branchRef &&
      r.CityRef === input.cityRef &&
      eligibleBranch(r),
  );
  return branch
    ? {
        city: String(city.Description),
        cityRef: input.cityRef,
        destination: String(branch.Description),
        branchRef: input.branchRef,
      }
    : null;
}

export async function verifyTracking(number: string) {
  if (!/^\d{14}$/.test(number) || !process.env.NOVA_POSHTA_API_KEY)
    throw new Error("Invalid tracking number.");
  const response = await fetch("https://api.novaposhta.ua/v2.0/json/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: process.env.NOVA_POSHTA_API_KEY,
      modelName: "TrackingDocument",
      calledMethod: "getStatusDocuments",
      methodProperties: {
        Documents: [{ DocumentNumber: number }],
      },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Tracking unavailable.");
  const data = await response.json();
  const row = data.data?.find(
    (item: Record<string, unknown>) => item.Number === number,
  );
  if (
    data.success !== true ||
    !row ||
    !row.StatusCode ||
    ["2", "3"].includes(String(row.StatusCode))
  )
    throw new Error("Tracking unavailable.");
  return { number, statusCode: String(row.StatusCode), checkedAt: Date.now() };
}
