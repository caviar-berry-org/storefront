import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseEnv } from "node:util";
import { cert, deleteApp, initializeApp } from "firebase-admin/app";
import { initializeFirestore } from "firebase-admin/firestore";
import {
  customerLookupKeys,
  type CustomerActivity,
  type CustomerSummary,
} from "../src/domain/customer-directory.ts";

import { seedDevCustomerOrders } from "./seed-dev-customer-orders.ts";

const devProject = "caviar-berry-dev";
const demoNames = [
  "Олена Тестова",
  "Студія «Північ»",
  "Іван Зразковий",
  "Марта Тестова",
  "Агенція «Обрій»",
  "Роман Зразковий",
  "Наталя Тестова",
  "Світлана Зразкова",
  "Кав’ярня «Маяк»",
  "Артем Тестовий",
  "Юлія Зразкова",
  "Денис Тестовий",
  "Команда «Плин»",
  "Аліна Зразкова",
  "Олег Тестовий",
  "Катерина Зразкова",
  "Компанія «Вісь»",
  "Андрій Тестовий",
  "Ірина Зразкова",
  "Микита Тестовий",
  "Вітрина «Лист»",
  "Софія Зразкова",
  "Лев Тестовий",
  "Віра Зразкова",
  "Павло Тестовий",
] as const;
const corporate = new Set([2, 5, 9, 13, 17, 21]);
const day = 86_400_000;

export function demoCustomers() {
  return demoNames.map((name, index) => {
    const number = index + 1;
    const suffix = String(number).padStart(2, "0");
    const isCorporate = corporate.has(number);
    const date = Date.UTC(2026, 10, 8, 8, (index % 8) * 5) - index * 2 * day;
    const events: CustomerActivity[] = [];
    const add = (
      kind: CustomerActivity["kind"],
      subject: string | null = null,
      totalMinor?: number,
    ) => {
      const offset = events.length;
      events.push({
        id: `demo-${offset + 1}`,
        kind,
        occurredAt: date - offset * day,
        subject,
        ...(totalMinor !== undefined && { totalMinor }),
      });
    };
    if (number % 3 === 0 || number === 1)
      add("order", `DEMO-${suffix}-01`, 160000 + number * 10000);
    if (number % 6 === 0 || number === 1)
      add("order", `DEMO-${suffix}-02`, 220000 + number * 10000);
    if (isCorporate) add("corporate", "Подарункові набори для команди");
    if (number % 2 === 0) add("restock", "Ікра форелі");
    if (number % 5 === 0) add("contact", "Питання про доставку");
    if (number % 3 === 1 || !events.length) add("promotion");

    const customer: CustomerSummary = {
      id: `demo-customer-${suffix}`,
      name: number === 4 || number === 19 ? null : name,
      email: number === 8 ? null : `demo.${suffix}@example.com`,
      phone:
        number % 4 === 0 && number !== 8 ? null : `+380 00 123 45 ${suffix}`,
      type: isCorporate ? "corporate" : "retail",
      orderCount: events.filter((event) => event.kind === "order").length,
      sources: events
        .map(({ kind }) => kind)
        .filter((kind) => kind !== "order"),
      lastInteractionAt: date,
      demo: true,
    };
    return { customer, events };
  });
}

async function seed() {
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
    if (process.argv[2] === "--orders") {
      await seedDevCustomerOrders(db);
      console.log(`Prepared three linked demo orders in ${devProject}.`);
      return;
    }
    const fixtures = demoCustomers();
    const refs = fixtures.map(({ customer }) =>
      db.collection("customers").doc(customer.id),
    );
    // Check the reserved IDs before writing so existing non-demo profiles cannot be replaced.
    await db.runTransaction(
      async (transaction) => {
        const snapshots = await transaction.getAll(...refs);
        if (snapshots.some((doc) => doc.exists && doc.get("demo") !== true)) {
          throw new Error("A reserved demo ID belongs to a non-demo customer.");
        }
        const first = refs[0]!;
        const orderSnapshots = await transaction.getAll(
          ...["demo-1", "demo-2", "demo-order-03"].map((id) =>
            first.collection("activity").doc(id),
          ),
        );
        const detailedOrders = new Set(
          orderSnapshots
            .filter(
              (doc) =>
                doc.get("demo") === true && doc.get("orderLines")?.length,
            )
            .map((doc) => doc.id),
        );
        for (const { customer, events } of fixtures) {
          const { id, ...data } = customer;
          const ref = db.collection("customers").doc(id);
          transaction.set(ref, {
            ...data,
            ...(id === first.id &&
              detailedOrders.size > 0 && {
                orderCount: Math.max(
                  data.orderCount,
                  Number(snapshots[0]?.get("orderCount") ?? 0),
                ),
              }),
            lookupKeys: customerLookupKeys(customer),
          });
          for (const { id: eventId, ...event } of events) {
            if (id !== first.id || !detailedOrders.has(eventId))
              transaction.set(ref.collection("activity").doc(eventId), event);
          }
        }
      },
      { maxAttempts: 2 },
    );
    const verified = await db.getAll(...refs);
    if (verified.some((doc) => !doc.exists || doc.get("demo") !== true)) {
      throw new Error("Could not verify all demo customers after writing.");
    }
    console.log(`Verified ${verified.length} demo customers in ${devProject}.`);
  } finally {
    await deleteApp(app);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await seed();
  } catch (error) {
    console.error(
      "Could not seed the dev customer directory.",
      error instanceof Error ? error.message : "",
    );
    process.exitCode = 1;
  }
}
