import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { cert, deleteApp, initializeApp } from "firebase-admin/app";
import { initializeFirestore } from "firebase-admin/firestore";
import { initialCaviar, initialGifts } from "../src/lib/catalog-fixtures.ts";
import { syncCatalogMedia } from "./sync-catalog-media.ts";
import { seedDevInventory } from "./seed-dev-inventory.ts";
import { importCatalogMedia } from "./catalog-import-media.ts";
import {
  catalogCollections,
  catalogRecordArchived,
  catalogRoot,
  catalogSupport,
} from "../src/lib/catalog-collections.ts";

const flags = process.argv.slice(2);
if (
  flags.some(
    (flag) =>
      flag !== "--local-media" &&
      flag !== "--dry-run" &&
      flag !== "--sync-media" &&
      flag !== "--demo-inventory",
  )
)
  throw new Error("Unknown import option.");
const demoInventory = flags.includes("--demo-inventory");
if (demoInventory && flags.length !== 1)
  throw new Error("Use --demo-inventory on its own.");
if (flags.includes("--dry-run")) {
  const caviar = initialCaviar();
  const gifts = initialGifts();
  console.log(
    `Prepared ${caviar.length} caviar products, ${caviar.flatMap((item) => item.data.copy.ua.variants).length} packs and ${gifts.length} gift sets.`,
  );
  process.exit(0);
}
const projectId = "caviar-berry-dev";
const env = parseEnv(readFileSync(".env.local", "utf8"));
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const privateKey = env.FIREBASE_PRIVATE_KEY;
if (
  env.APP_ENV !== "development" ||
  env.FIREBASE_PROJECT_ID !== projectId ||
  !clientEmail?.endsWith(`@${projectId}.iam.gserviceaccount.com`) ||
  !privateKey ||
  process.env.FIRESTORE_EMULATOR_HOST
) {
  throw new Error("Use .env.local with caviar-berry-dev credentials.");
}

const app = initializeApp({
  projectId,
  credential: cert({
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  }),
});
const db = initializeFirestore(app, { preferRest: true });

async function seedDevCatalog() {
  const legacyMarker = await db
    .collection("catalogSettings")
    .doc("dev-import-v1")
    .get();
  if (legacyMarker.exists)
    throw new Error(
      "Legacy DEV catalogue detected. Seeding requires the catalog/main layout.",
    );
  const marker = db.collection(catalogSupport.settings).doc("dev-import-v1");
  const caviar = initialCaviar();
  const gifts = initialGifts();
  if ((await marker.get()).exists) {
    if (flags.includes("--sync-media")) {
      const count = await syncCatalogMedia(db, env);
      console.log(`Synced ${count} local catalogue photos to dev Cloudinary.`);
    } else {
      console.log("The dev catalogue was already imported.");
    }
  } else {
    if (flags.includes("--sync-media"))
      throw new Error("Import the dev catalogue before syncing media.");
    if (!flags.includes("--local-media")) {
      const count = await importCatalogMedia(caviar, gifts, env);
      console.log(
        `Prepared ${count} catalogue photos in the dev Cloudinary account.`,
      );
    }
    const records = [
      ...caviar.map((record) => ({ record, ...catalogCollections.caviar })),
      ...gifts.map((record) => ({
        record,
        ...catalogCollections["gift-sets"],
      })),
    ];
    const seeded = await db.runTransaction(
      async (transaction) => {
        if ((await transaction.get(marker)).exists) return false;
        const entries = records.map((entry) => ({
          ...entry,
          source: db.collection(entry.records).doc(entry.record.id),
          view: db.collection(entry.published).doc(entry.record.id),
        }));
        const current = await transaction.getAll(
          ...entries.flatMap(({ source, view }) => [source, view]),
        );
        if (current.some((doc) => doc.exists)) {
          throw new Error(
            "Catalogue IDs already exist. Review the records before importing.",
          );
        }
        for (const { record, source, view } of entries) {
          transaction.create(source, {
            ...record,
            archived: catalogRecordArchived(record),
          });
          transaction.create(view, { rank: record.rank, data: record.data });
        }
        const counts = new Map<string, number>();
        for (const gift of gifts) {
          for (const id of new Set(
            gift.data.items.flatMap((item) => item.variantIds),
          )) {
            counts.set(id, (counts.get(id) ?? 0) + 1);
          }
        }
        for (const record of caviar) {
          const product = record.data.copy.ua;
          transaction.create(
            db.collection(catalogSupport.slugs).doc(product.slug),
            {
              productId: product.id,
            },
          );
          for (const pack of product.variants) {
            transaction.create(
              db.collection(catalogSupport.inventory).doc(pack.id),
              {
                id: pack.id,
                productId: product.id,
                name: product.name,
                weightGrams: pack.weightGrams,
                enabled: pack.available,
                stock: record.data.stock[pack.id],
                revision: record.revision,
                rank: record.rank,
              },
            );
          }
        }
        for (const [id, count] of counts)
          transaction.create(
            db.collection(catalogSupport.packReferences).doc(id),
            {
              count,
            },
          );
        transaction.set(
          db.doc(catalogRoot),
          { schemaVersion: 1 },
          { merge: true },
        );
        transaction.create(marker, { version: 1 });
        return true;
      },
      { maxAttempts: 2 },
    );
    console.log(
      seeded
        ? "Imported 4 caviar products and 3 gift sets in caviar-berry-dev."
        : "The dev catalogue was already imported.",
    );
  }
}

try {
  if (demoInventory) {
    const count = await seedDevInventory(db);
    console.log(
      `Added demo batches to ${count} caviar packs in caviar-berry-dev.`,
    );
  } else await seedDevCatalog();
} catch (error) {
  console.error(
    "Could not import the dev catalogue.",
    error instanceof Error ? error.message : "",
  );
  process.exitCode = 1;
} finally {
  await deleteApp(app);
}
