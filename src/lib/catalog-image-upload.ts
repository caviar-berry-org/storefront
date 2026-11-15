import { createHash, randomUUID } from "node:crypto";
import type { CatalogKind } from "../domain/managed-catalog.ts";

type Environment = Record<string, string | undefined>;

export function cloudName(environment: Environment = process.env) {
  const value = environment.CLOUDINARY_CLOUD_NAME?.trim();
  return value && /^[a-z0-9-]+$/.test(value) ? value : null;
}

export function catalogAssetFolder(
  kind: CatalogKind,
  environment: Environment = process.env,
) {
  const root =
    environment.APP_ENV === "production"
      ? "caviar-berry-prod"
      : "caviar-berry-dev";
  return `${root}/${kind === "caviar" ? "storefront" : "gift-sets"}`;
}

export function catalogAssetId(
  url: string,
  environment: Environment = process.env,
) {
  const cloud = cloudName(environment);
  if (
    !cloud ||
    !url.startsWith(`https://res.cloudinary.com/${cloud}/image/upload/`)
  )
    return null;
  return (
    /^v\d+\/(catalog\/[a-f0-9-]+)\.(?:jpg|png|webp)(?:#\d{1,4}x\d{1,4})?$/.exec(
      url.split("/image/upload/")[1] ?? "",
    )?.[1] ?? null
  );
}

export async function uploadCatalogImage(
  file: Blob,
  kind: CatalogKind,
  environment: Environment = process.env,
  assetId: string = randomUUID(),
) {
  const publicId = `catalog/${assetId}`;
  const image = await cloudinaryRequest(
    {
      allowed_formats: "jpg,png,webp",
      asset_folder: catalogAssetFolder(kind, environment),
      overwrite: "false",
      public_id: publicId,
      transformation: "c_limit,w_2400,h_2400",
    },
    environment,
    file,
  );
  if (
    image.public_id !== publicId ||
    !Number.isSafeInteger(image.version) ||
    !["jpg", "png", "webp"].includes(image.format)
  )
    throw new Error("Invalid media response.");
  if (
    !Number.isSafeInteger(image.width) ||
    !Number.isSafeInteger(image.height) ||
    image.width < 1 ||
    image.height < 1 ||
    image.width > 2400 ||
    image.height > 2400
  )
    throw new Error("Invalid media dimensions.");
  return `https://res.cloudinary.com/${cloudName(environment)}/image/upload/v${image.version}/${publicId}.${image.format}#${image.width}x${image.height}`;
}

async function cloudinaryRequest(
  options: Record<string, string>,
  environment: Environment,
  file: Blob,
) {
  const cloud = cloudName(environment);
  const key = environment.CLOUDINARY_API_KEY?.trim();
  const secret = environment.CLOUDINARY_API_SECRET?.trim();
  if (!cloud || !key || !secret)
    throw new Error("Catalog media is unavailable.");
  const params = {
    ...options,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  const signature = createHash("sha256")
    .update(
      Object.entries(params)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, value]) => `${name}=${value}`)
        .join("&") + secret,
    )
    .digest("hex");
  const body = new FormData();
  for (const [name, value] of Object.entries(params)) body.set(name, value);
  body.set("api_key", key);
  body.set("signature", signature);
  body.set("file", file, `image.${file.type.split("/")[1]}`);
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
    {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const message =
      typeof detail?.error?.message === "string" ? detail.error.message : "";
    const reason = /signature/i.test(message)
      ? "invalid signature"
      : /api.key|cloud.name|unknown cloud|unauthorized/i.test(message)
        ? "check cloud name and API key"
        : /too large|maximum.*size/i.test(message)
          ? "file too large"
          : /transformation/i.test(message)
            ? "image transformation rejected"
            : /format|invalid image/i.test(message)
              ? "image format rejected"
              : /timestamp|stale request/i.test(message)
                ? "request timestamp rejected"
                : /public.id|folder/i.test(message)
                  ? "asset ID or folder rejected"
                  : /credit|quota|limit/i.test(message)
                    ? "provider quota or limit"
                    : "provider rejected request";
    throw new Error(`Cloudinary HTTP ${response.status}: ${reason}.`);
  }
  return response.json();
}
