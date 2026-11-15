import "server-only";

import { orderCollectionPath, type Order } from "@/domain/orders";
import { firebaseAdminDatabase } from "../firestore";

export function orderCollection(db = firebaseAdminDatabase()) {
  return db.collection(orderCollectionPath(process.env.APP_ENV));
}

export function orderData(doc: FirebaseFirestore.DocumentSnapshot) {
  if (!doc.exists) return null;
  return { ...(doc.data() as Omit<Order, "id">), id: doc.id };
}
