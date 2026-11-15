import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { cert, initializeApp, deleteApp } from "firebase-admin/app";
import { initializeFirestore } from "firebase-admin/firestore";
const env = { ...parseEnv(readFileSync(".env.local", "utf8")), ...process.env };
if (
  env.APP_ENV !== "development" ||
  env.FIREBASE_PROJECT_ID !== "caviar-berry-dev"
)
  throw new Error("DEV project only");
const app = initializeApp(
  {
    projectId: env.FIREBASE_PROJECT_ID,
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  },
  "seed-inquiries",
);
try {
  const db = initializeFirestore(app, { preferRest: true });
  const batch = db.batch();
  const existing = await db
    .collection("inquiries")
    .where("testSeed", "==", "staff-inquiries-v1")
    .get();
  const found = new Set(existing.docs.map((d) => d.id));
  let created = 0;
  const categories = ["contact", "corporate", "gifts", "restock"] as const;
  const statuses = ["new", "viewed", "working", "processed", "cancelled"];
  for (const [group, category] of categories.entries())
    for (let i = 0; i < 5; i++) {
      const id = `10000000-0000-4000-800${group}-${String(i + 1).padStart(12, "0")}`;
      if (found.has(id)) continue;
      batch.create(db.collection("inquiries").doc(id), {
        test: true,
        testSeed: "staff-inquiries-v1",
        kind:
          category === "restock"
            ? "notify"
            : category === "contact"
              ? "write"
              : "gift",
        name: `ТЕСТ · ${category} ${i + 1}`,
        contact:
          category === "gifts" || category === "corporate"
            ? `+3800000000${group}${i}`
            : `qa.${category}.${i + 1}@example.com`,
        subject:
          category === "gifts"
            ? ["Знайомство", "Дегустація", "Преміум"][i % 3]
            : category === "corporate"
              ? "Пропозиція для компанії"
              : category === "restock"
                ? "Ікра стерляді 50 г"
                : "Написати нам",
        targetId:
          category === "corporate"
            ? "corp"
            : category === "gifts"
              ? ["introduction", "tasting", "premium"][i % 3]
              : category === "restock"
                ? "sterlet"
                : null,
        variantId: category === "restock" ? "sterlet-50" : null,
        date: category === "gifts" ? "2026-12-20" : "",
        comment: `Тестова заявка №${i + 1}. Демонстраційні дані для перевірки адмінки. Листи за цим записом не надсилати.`,
        status: category === "restock" ? "new" : statuses[i],
        revision: 0,
        createdAt: Date.now() - (i * 3 + group) * 86400000,
        locale: i % 2 ? "en" : "ua",
        mailState: category === "restock" ? "test" : null,
        privacyConsent: { accepted: true, at: Date.now() },
        marketingConsent: false,
      });
      created++;
    }
  await batch.commit();
  console.log(
    `DEV inquiry fixtures: created ${created}; existing ${found.size}. No mail jobs created.`,
  );
} finally {
  await deleteApp(app);
}
