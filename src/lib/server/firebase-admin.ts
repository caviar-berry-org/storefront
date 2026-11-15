import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";

export function firebaseAdminApp() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim().replace(
    /\\n/g,
    "\n",
  );
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin credentials are incomplete.");
  }

  const name = "caviar-berry";
  return (
    getApps().find((app) => app.name === name) ??
    initializeApp(
      { projectId, credential: cert({ projectId, clientEmail, privateKey }) },
      name,
    )
  );
}
