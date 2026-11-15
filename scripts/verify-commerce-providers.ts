import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
const env = parseEnv(readFileSync(".env.local", "utf8"));
if (
  env.APP_ENV !== "development" ||
  env.FIREBASE_PROJECT_ID !== "caviar-berry-dev"
)
  throw new Error("Read-only checks require the DEV configuration.");
for (const path of ["details", "pubkey"]) {
  const response = await fetch(`https://api.monobank.ua/api/merchant/${path}`, {
    headers: { "X-Token": env.MONO_TOKEN ?? "" },
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => null);
  console.log(
    `mono ${path}: ${response.ok && (path === "pubkey" ? Boolean(data?.key) : Boolean(data?.merchantId)) ? "OK" : `unavailable (${response.status})`}`,
  );
  if (!response.ok) process.exitCode = 1;
}
const response = await fetch("https://api.novaposhta.ua/v2.0/json/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    apiKey: env.NOVA_POSHTA_API_KEY,
    modelName: "Address",
    calledMethod: "getWarehouseTypes",
    methodProperties: {},
  }),
  signal: AbortSignal.timeout(10000),
});
const data = await response.json();
console.log(
  `Nova Poshta directory: ${response.ok && data.success === true ? "OK" : "unavailable"}`,
);
if (!response.ok || data.success !== true) process.exitCode = 1;
console.log(
  "Read-only checks only. Token mode must be confirmed with the issuer. No invoice, debit, email or shipment created.",
);
