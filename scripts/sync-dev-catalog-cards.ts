import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseEnv } from "node:util";
import { cert, initializeApp, deleteApp } from "firebase-admin/app";
import { initializeFirestore } from "firebase-admin/firestore";
import { initialCaviar } from "../src/lib/catalog-fixtures.ts";
import {
  catalogCollections,
  catalogSupport,
} from "../src/lib/catalog-collections.ts";
import { uploadCatalogImage } from "../src/lib/catalog-image-upload.ts";
import type { CatalogRecord } from "../src/domain/managed-catalog.ts";

const apply = process.argv[2] === "--apply";
if (
  process.argv.length > 3 ||
  (process.argv[2] && !["--apply", "--dry-run"].includes(process.argv[2]))
)
  throw new Error("Use --dry-run or --apply");
const fixtures = initialCaviar();
const sources = fixtures.flatMap(({ data }) => [
  data.copy.ua.jarBodyImage!,
  data.copy.ua.lidImage,
  data.copy.ua.servingImage,
]);
const assets = await Promise.all(
  sources.map(async (src) => {
    const bytes = await readFile(`public${src}`);
    return {
      src,
      bytes,
      hash: createHash("sha256").update(bytes).digest("hex"),
    };
  }),
);
if (!apply) {
  console.log(
    `Verified ${assets.length} card assets, ${assets.reduce((n, a) => n + a.bytes.length, 0)} bytes`,
  );
  process.exit(0);
}
const env = parseEnv(await readFile(".env.local", "utf8"));
const projectId = "caviar-berry-dev";
if (
  env.APP_ENV !== "development" ||
  env.FIREBASE_PROJECT_ID !== projectId ||
  !env.FIREBASE_CLIENT_EMAIL?.endsWith(
    `@${projectId}.iam.gserviceaccount.com`,
  ) ||
  !env.FIREBASE_PRIVATE_KEY ||
  process.env.FIRESTORE_EMULATOR_HOST
)
  throw new Error("DEV credentials required");
const app = initializeApp({
  projectId,
  credential: cert({
    projectId,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
try {
  const db = initializeFirestore(app, { preferRest: true });
  const c = catalogCollections.caviar;
  const urls = new Map<string, string>();
  for (const a of assets)
    urls.set(
      a.src,
      await uploadCatalogImage(
        new Blob([Uint8Array.from(a.bytes)], { type: "image/webp" }),
        "caviar",
        env,
        a.hash,
      ),
    );
  await db.runTransaction(async (tx) => {
    const snaps = await tx.getAll(
      ...fixtures.map((f) => db.collection(c.records).doc(f.id)),
    );
    for (const [i, snap] of snaps.entries()) {
      const record = snap.data() as CatalogRecord<"caviar"> | undefined;
      const fixture = fixtures[i]!;
      if (!record) throw new Error(`Missing ${fixture.id}`);
      const data = structuredClone(record.data);
      for (const locale of ["ua", "en"] as const) {
        const p = data.copy[locale],
          next = fixture.data.copy[locale];
        delete p.jarImage;
        p.jarBodyImage = urls.get(next.jarBodyImage!)!;
        p.lidImage = urls.get(next.lidImage)!;
        p.servingImage = urls.get(next.servingImage)!;
        p.servingAlt = next.servingAlt;
        for (const pack of p.variants) {
          pack.available = true;
          pack.stockQuantity = ["sterlet-50", "trout-200"].includes(pack.id)
            ? 0
            : 20;
        }
      }
      for (const pack of data.copy.ua.variants) {
        const stock = data.stock[pack.id];
        if (!stock) throw new Error(`Missing stock ${pack.id}`);
        stock.quantity =
          stock.reserved +
          (["sterlet-50", "trout-200"].includes(pack.id) ? 0 : 20);
        stock.batches = [];
      }
      const rank = i + 1,
        revision = record.revision + 1;
      tx.update(snap.ref, { data, rank, revision });
      if (record.published)
        tx.set(db.collection(c.published).doc(record.id), { data, rank });
      for (const pack of data.copy.ua.variants)
        tx.set(db.collection(catalogSupport.inventory).doc(pack.id), {
          id: pack.id,
          productId: record.id,
          name: data.copy.ua.name,
          weightGrams: pack.weightGrams,
          enabled: true,
          stock: data.stock[pack.id],
          rank,
          revision,
        });
    }
  });
  const source = await db.getAll(
    ...fixtures.map((f) => db.collection(c.records).doc(f.id)),
  );
  for (const snap of source) {
    const r = snap.data() as CatalogRecord<"caviar">;
    console.log(
      r.id,
      Object.entries(r.data.stock)
        .map(([id, s]) => `${id}:${(s.quantity ?? 0) - s.reserved}`)
        .join(","),
    );
  }
  console.log(
    `Uploaded ${urls.size} DEV card backups; synchronized source, published catalogue and inventory.`,
  );
} finally {
  await deleteApp(app);
}
