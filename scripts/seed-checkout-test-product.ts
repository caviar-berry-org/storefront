import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createHash } from "node:crypto";
import { cert, deleteApp, initializeApp } from "firebase-admin/app";
import { initializeFirestore } from "firebase-admin/firestore";
import { initialCaviar } from "../src/lib/catalog-fixtures.ts";
import {
  catalogCollections,
  catalogSupport,
} from "../src/lib/catalog-collections.ts";
import { uploadCatalogImage } from "../src/lib/catalog-image-upload.ts";

const env = parseEnv(readFileSync(".env.local", "utf8"));
if (
  env.APP_ENV !== "development" ||
  env.FIREBASE_PROJECT_ID !== "caviar-berry-dev" ||
  !env.FIREBASE_CLIENT_EMAIL?.endsWith(
    "@caviar-berry-dev.iam.gserviceaccount.com",
  ) ||
  !env.FIREBASE_PRIVATE_KEY ||
  process.env.FIRESTORE_EMULATOR_HOST
)
  throw new Error("Use the isolated DEV project only.");
const record = structuredClone(initialCaviar()[0]!);
record.id = "checkout-test";
record.rank = 9999;
record.revision = 1;
record.data.stock = {};
const images: string[] = [];
for (let index = 1; index <= 3; index++) {
  const bytes = readFileSync(
    `public/assets/img/testing/checkout-${index}.webp`,
  );
  const hash = createHash("sha256").update(bytes).digest("hex");
  images.push(
    await uploadCatalogImage(
      new Blob([bytes], { type: "image/webp" }),
      "caviar",
      env,
      hash,
    ),
  );
}
for (const locale of ["ua", "en"] as const) {
  const ua = locale === "ua";
  const product = record.data.copy[locale];
  product.id = record.id;
  product.slug = "checkout-test";
  product.name = ua ? "Тестове замовлення · 1–3 грн" : "Test order · UAH 1–3";
  product.englishName = "Checkout test";
  const notice = ua
    ? "Технічний товар для ручної перевірки оформлення. Оплата справжня. Фізичний товар не відправляється."
    : "Technical product for manual checkout checks. Payments are real. No physical product will be shipped.";
  product.description = notice;
  product.intro = notice;
  product.taste = notice;
  product.tasteAccent = "";
  product.season = null;
  product.lidImage = images[0]!;
  product.jarBodyImage = images[1]!;
  product.roeImage = images[1]!;
  product.servingImage = images[2]!;
  product.servingAlt = notice;
  product.detailServingImage = images[2]!;
  product.detailServingAlt = notice;
  product.gallery = [];
  product.seo = { title: product.name, description: notice, image: images[0]! };
  product.variants = [50, 100, 400].map((weightGrams, index) => ({
    id: `checkout-test-${weightGrams}`,
    weightGrams,
    priceMinor: (index + 1) * 100,
    available: true,
    stockQuantity: 100,
    image: images[index]!,
    imageIsRepresentative: false,
  }));
  for (const pack of product.variants)
    record.data.stock[pack.id] = { quantity: 100, reserved: 0, batches: [] };
}
const app = initializeApp(
  {
    projectId: env.FIREBASE_PROJECT_ID,
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  },
  "checkout-test-import",
);
const db = initializeFirestore(app, { preferRest: true });
try {
  const ref = db.collection(catalogCollections.caviar.records).doc(record.id);
  await db.runTransaction(async (tx) => {
    if ((await tx.get(ref)).exists)
      throw new Error(
        "Test product already exists. Edit or archive it in the staff catalogue.",
      );
    const slug = db
      .collection(catalogSupport.slugs)
      .doc(record.data.copy.ua.slug);
    if ((await tx.get(slug)).exists) throw new Error("Slug already exists.");
    // Keep the rank counter level with what we just wrote. Without this the
    // next card created in the admin is handed a lower rank and does not appear
    // last on the storefront.
    tx.set(db.collection(catalogSupport.settings).doc("caviar"), {
      rank: record.rank,
    });
    tx.create(ref, { ...record, archived: false });
    tx.create(slug, { productId: record.id });
    tx.create(
      db.collection(catalogCollections.caviar.published).doc(record.id),
      { rank: record.rank, data: record.data },
    );
    for (const pack of record.data.copy.ua.variants)
      tx.create(db.collection(catalogSupport.inventory).doc(pack.id), {
        id: pack.id,
        productId: record.id,
        name: record.data.copy.ua.name,
        weightGrams: pack.weightGrams,
        enabled: true,
        stock: record.data.stock[pack.id],
        rank: record.rank,
        revision: record.revision,
      });
  });
  console.log(
    "Created one DEV-only test product, three packs (1/2/3 UAH), three optimized Cloudinary images. No order, email, invoice or shipment created.",
  );
} finally {
  await deleteApp(app);
}
