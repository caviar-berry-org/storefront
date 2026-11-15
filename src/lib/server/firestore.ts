import "server-only";

import { initializeFirestore } from "firebase-admin/firestore";
import { firebaseAdminApp } from "./firebase-admin";

export function firebaseAdminDatabase() {
  return initializeFirestore(firebaseAdminApp(), { preferRest: true });
}
