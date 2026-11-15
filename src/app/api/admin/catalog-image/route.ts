import { catalogStaff } from "@/lib/server/catalog/access";
import { uploadCatalogImage } from "@/lib/catalog-image-upload";
import { readCatalogImage } from "@/lib/server/catalog/media";
import { staffSettings } from "@/lib/server/staff-session";

export async function POST(request: Request) {
  const reply = (status: number, data?: { image: string }) =>
    Response.json(data ?? {}, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  if (request.headers.get("origin") !== staffSettings()?.origin)
    return reply(403);
  const kind = request.headers.get("x-catalog-kind");
  if (kind !== "caviar" && kind !== "gift-sets") return reply(400);
  try {
    if (!(await catalogStaff())) return reply(403);
    const result = await readCatalogImage(request);
    if ("status" in result) return reply(result.status);
    return reply(201, { image: await uploadCatalogImage(result.file, kind) });
  } catch {
    return reply(503);
  }
}
