import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { cert, deleteApp, initializeApp } from "firebase-admin/app";
import { initializeFirestore } from "firebase-admin/firestore";
import {
  orderCollectionPath,
  orderNumberLookupTerms,
} from "../src/domain/orders.ts";

/**
 * Adds the `number:` lookup keys to orders created before staff could search by
 * order number. Idempotent: an order that already carries its keys is skipped,
 * and nothing else in the document is touched.
 */
const devProject = "caviar-berry-dev";

async function backfill() {
  const env = parseEnv(readFileSync(".env.local", "utf8"));
  const {
    APP_ENV,
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY,
  } = env;
  if (
    APP_ENV !== "development" ||
    FIREBASE_PROJECT_ID !== devProject ||
    !FIREBASE_CLIENT_EMAIL?.endsWith(
      `@${devProject}.iam.gserviceaccount.com`,
    ) ||
    !FIREBASE_PRIVATE_KEY ||
    process.env.FIRESTORE_EMULATOR_HOST
  ) {
    throw new Error(
      "Use .env.local with the caviar-berry-dev credentials and no emulator override.",
    );
  }

  const app = initializeApp({
    projectId: devProject,
    credential: cert({
      projectId: devProject,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });

  try {
    const db = initializeFirestore(app, { preferRest: true });
    const snapshot = await db
      .collection(orderCollectionPath("development"))
      .select("number", "lookupKeys")
      .get();

    let updated = 0;
    let batch = db.batch();
    let pending = 0;
    for (const doc of snapshot.docs) {
      const number = doc.get("number");
      if (typeof number !== "string" || !number.trim()) continue;
      const existing: string[] = Array.isArray(doc.get("lookupKeys"))
        ? doc.get("lookupKeys")
        : [];
      const terms = orderNumberLookupTerms(number);
      const missing = terms.filter((term) => !existing.includes(term));
      if (!missing.length) continue;
      batch.update(doc.ref, { lookupKeys: [...existing, ...missing] });
      updated++;
      if (++pending === 400) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    }
    if (pending) await batch.commit();
    console.log(
      `Checked ${snapshot.size} orders in ${devProject}; added number keys to ${updated}.`,
    );
  } finally {
    await deleteApp(app);
  }
}

await backfill();
