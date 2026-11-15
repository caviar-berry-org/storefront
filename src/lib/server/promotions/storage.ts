import "server-only";
import { createHash } from "node:crypto";
import { firebaseAdminDatabase } from "../firestore";

export const campaign = "first-order-dev-v1";
// Issued codes expire after 90 days; books are isolated by APP_ENV.
export const promotionLifetime: number | null = 90 * 24 * 60 * 60 * 1000;
export const emailKey = (email: string) =>
  createHash("sha256").update(email).digest("hex");

export function promotionDatabase() {
  if (
    !["development", "production"].includes(process.env.APP_ENV ?? "") ||
    (process.env.APP_ENV === "development" &&
      process.env.FIREBASE_PROJECT_ID !== "caviar-berry-dev") ||
    (process.env.APP_ENV === "production" &&
      process.env.FIREBASE_PROJECT_ID === "caviar-berry-dev")
  )
    throw new Error("Promotion environment mismatch.");
  return firebaseAdminDatabase();
}

export function promotionBook() {
  return promotionDatabase().doc(`promotionBooks/${process.env.APP_ENV}`);
}
