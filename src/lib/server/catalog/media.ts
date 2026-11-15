import "server-only";

import { catalogAssetId } from "@/lib/catalog-image-upload";
import { catalogImageLimit, catalogImageTypes } from "@/domain/managed-catalog";

export function validCatalogImage(value: string) {
  if (
    /^\/assets\/img\/[\w./-]+\.(png|jpe?g|webp)$/i.test(value) &&
    !value.includes("..") &&
    !value.includes("//")
  )
    return true;
  return catalogAssetId(value) !== null;
}

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  new TextDecoder().decode(bytes.subarray(start, end));

function validBytes(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === "image/png")
    return bytes[0] === 137 && ascii(bytes, 1, 4) === "PNG";
  return (
    type === "image/webp" &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 12) === "WEBP"
  );
}

export async function readCatalogImage(
  request: Request,
): Promise<{ status: 400 | 413 | 415 } | { file: Blob }> {
  const type = request.headers.get("content-type") ?? "";
  if (!catalogImageTypes.includes(type)) return { status: 415 } as const;
  if (Number(request.headers.get("content-length")) > catalogImageLimit)
    return { status: 413 } as const;
  const reader = request.body?.getReader();
  if (!reader) return { status: 400 } as const;
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > catalogImageLimit) {
        await reader.cancel();
        return { status: 413 } as const;
      }
      chunks.push(Uint8Array.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  if (!validBytes(Buffer.concat(chunks), type)) return { status: 415 } as const;
  return { file: new Blob(chunks, { type }) };
}
