"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  CART_KEY,
  cartSummary,
  changeQuantity,
  restoreCart,
  MAX_QUANTITY,
  MAX_CART_SUBTOTAL_MINOR,
  type CartLine,
} from "@/domain/cart";
import { findVariant, type Product, type Variant } from "@/domain/catalog";
import type { GiftView } from "@/domain/managed-catalog";
import {
  initialCheckout,
  type CheckoutInput,
  type DeliveryMethod,
} from "@/domain/checkout";
import type { Promotion } from "@/domain/promotion";
import { useLocale } from "@/i18n/client";
import { postStorefrontJson } from "@/lib/storefront-request";

export type CartChangeError =
  { kind: "stock"; limit: number } | { kind: "subtotal" | "unavailable" };
type Removal = { deadline: number; exiting: boolean };

type Overlay = {
  type:
    | "cart"
    | "checkout"
    | "menu"
    | "gift"
    | "post"
    | "write"
    | "notify"
    | "newsletter";
  value?: string;
  variantId?: string;
} | null;
let memory = "[]";
let memoryOnly = false;
const listeners = new Set<() => void>();
function readSnapshot() {
  if (memoryOnly) return memory;
  try {
    return localStorage.getItem(CART_KEY) ?? memory;
  } catch {
    return memory;
  }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === CART_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
function save(lines: CartLine[]) {
  memory = JSON.stringify(lines);
  try {
    localStorage.setItem(CART_KEY, memory);
  } catch {
    // Reading may still work when storage writes exceed quota.
    memoryOnly = true;
  }
  listeners.forEach((listener) => listener());
}
function parse(
  raw: string,
  products: readonly Product[],
  preserveUnknown: boolean,
) {
  try {
    return restoreCart(JSON.parse(raw), products, preserveUnknown);
  } catch {
    return [];
  }
}
interface StoreContextValue {
  products: readonly Product[];
  gifts: readonly GiftView[];
  checkoutDraft: CheckoutInput;
  setCheckoutDraft: (data: CheckoutInput) => void;
  setCheckoutDelivery: (delivery: DeliveryMethod) => void;
  lines: CartLine[];
  promotion: Promotion | null;
  setPromotion: (promotion: Promotion | null) => void;
  summary: ReturnType<typeof cartSummary>;
  overlay: Overlay;
  setOverlay: (overlay: Overlay) => void;
  setQuantity: (
    variantId: string,
    quantity: number,
    options?: { increment?: boolean; fitStock?: boolean },
  ) => Promise<CartChangeError | null>;
  completeOrder: (id: string, purchased: CartLine[]) => void;
  checkingQuantity: boolean;
  applyCartSnapshot: (snapshot: unknown) => void;
  removals: Record<string, Removal>;
  scheduleRemoval: (variantId: string) => void;
  undoRemoval: (variantId: string) => void;
}
const StoreContext = createContext<StoreContextValue | null>(null);
export function StoreProvider({
  children,
  products: catalogue,
  gifts,
  preserveUnknown,
}: {
  children: ReactNode;
  products: readonly Product[];
  gifts: readonly GiftView[];
  preserveUnknown: boolean;
}) {
  const locale = useLocale();
  const [updates, setUpdates] = useState<
    Record<string, Pick<Variant, "stockQuantity" | "priceMinor">>
  >({});
  const products = useMemo(
    () =>
      Object.keys(updates).length === 0
        ? catalogue
        : catalogue.map((product) => ({
            ...product,
            variants: product.variants.map((variant) =>
              updates[variant.id]
                ? { ...variant, ...updates[variant.id] }
                : variant,
            ),
          })),
    [catalogue, updates],
  );
  const raw = useSyncExternalStore(subscribe, readSnapshot, () => "[]");
  const lines = useMemo(
    () => parse(raw, products, preserveUnknown),
    [raw, products, preserveUnknown],
  );
  const [checkoutDraft, setCheckoutDraft] = useState(initialCheckout);
  const checkoutAddresses = useRef<Partial<Record<DeliveryMethod, string>>>({});
  function setCheckoutDelivery(delivery: DeliveryMethod) {
    checkoutAddresses.current[checkoutDraft.delivery] = checkoutDraft.address;
    setCheckoutDraft({
      ...checkoutDraft,
      delivery,
      address:
        delivery === "courier"
          ? (checkoutDraft.street ?? "")
          : (checkoutAddresses.current[delivery] ?? ""),
    });
  }
  function completeOrder(id: string, purchased: CartLine[]) {
    const receipt = `ucb-cart-receipt-${id}`;
    try {
      if (sessionStorage.getItem(receipt)) return;
      sessionStorage.setItem(receipt, "1");
    } catch {
      /* Cart completion remains idempotent in this mounted view. */
    }
    const latest = parse(readSnapshot(), products, preserveUnknown);
    save(
      latest
        .map((line) => ({
          ...line,
          quantity: Math.max(
            0,
            line.quantity -
              (purchased.find((item) => item.variantId === line.variantId)
                ?.quantity ?? 0),
          ),
        }))
        .filter((line) => line.quantity > 0),
    );
    setPromotion(null);
    setCheckoutDraft(initialCheckout);
    try {
      sessionStorage.removeItem("ucb-promo-code");
    } catch {
      /* Optional tab storage. */
    }
  }
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const hadCart = useRef(false);
  useEffect(() => {
    if (lines.length) hadCart.current = true;
    else if (hadCart.current || promotion) {
      setPromotion(null);
      try {
        sessionStorage.removeItem("ucb-promo-code");
      } catch {
        /* Storage may be unavailable. */
      }
      hadCart.current = false;
    }
  }, [lines.length, promotion]);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [checkingQuantity, setCheckingQuantity] = useState(false);
  const check = useRef<AbortController | null>(null);
  const [removals, setRemovals] = useState<Record<string, Removal>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const active = timers.current;
    return () => {
      check.current?.abort();
      for (const timer of active.values()) clearTimeout(timer);
      active.clear();
    };
  }, []);

  const undoRemoval = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setRemovals((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  function scheduleRemoval(id: string) {
    if (timers.current.has(id)) return;
    const original = parse(readSnapshot(), catalogue, preserveUnknown).find(
      (line) => line.variantId === id,
    );
    if (!original) return;
    const deadline = Date.now() + 5000;
    setRemovals((current) => ({
      ...current,
      [id]: { deadline, exiting: false },
    }));
    timers.current.set(
      id,
      setTimeout(() => {
        setRemovals((current) => ({
          ...current,
          [id]: { deadline, exiting: true },
        }));
        timers.current.set(
          id,
          setTimeout(() => {
            const current = parse(readSnapshot(), catalogue, preserveUnknown);
            save(
              current.filter(
                (line) =>
                  line.variantId !== id || line.quantity !== original.quantity,
              ),
            );
            undoRemoval(id);
          }, 220),
        );
      }, 5000),
    );
  }

  function applyCartSnapshot(snapshot: unknown) {
    if (!Array.isArray(snapshot)) return;
    const entries = snapshot.flatMap((row) =>
      typeof row?.id === "string" &&
      findVariant(catalogue, row.id) &&
      Number.isSafeInteger(row.limit) &&
      row.limit >= 0 &&
      row.limit <= MAX_QUANTITY &&
      Number.isSafeInteger(row.priceMinor) &&
      row.priceMinor >= 0
        ? [[row.id, { stockQuantity: row.limit, priceMinor: row.priceMinor }]]
        : [],
    );
    if (entries.length)
      setUpdates((current) => ({ ...current, ...Object.fromEntries(entries) }));
  }

  async function setQuantity(
    id: string,
    quantity: number,
    { increment = false, fitStock = false } = {},
  ): Promise<CartChangeError | null> {
    if (!Number.isSafeInteger(quantity) || quantity < (increment ? 1 : 0))
      return { kind: "unavailable" };
    const current = parse(readSnapshot(), products, preserveUnknown);
    const before = current.find((line) => line.variantId === id)?.quantity ?? 0;
    const next = increment ? before + quantity : quantity;
    if (next <= before) {
      save(changeQuantity(current, id, next, products));
      return null;
    }
    const match = findVariant(products, id);
    if (!match || check.current || timers.current.has(id))
      return { kind: "unavailable" };

    const controller = new AbortController();
    check.current = controller;
    setCheckingQuantity(true);
    try {
      const { response, result } = await postStorefrontJson(
        "/api/cart/variant",
        locale,
        JSON.stringify({ productId: match.product.id, variantId: id }),
        { signal: controller.signal, timeout: 7000 },
      );
      const limit = result?.limit;
      const price = result?.priceMinor;
      if (
        !response.ok ||
        !Number.isSafeInteger(limit) ||
        limit < 0 ||
        limit > MAX_QUANTITY
      )
        return { kind: "unavailable" };
      if (price !== null && (!Number.isSafeInteger(price) || price < 0))
        return { kind: "unavailable" };

      const priceMinor = price ?? match.variant.priceMinor;
      const update = { stockQuantity: limit, priceMinor };
      setUpdates((values) => ({ ...values, [id]: update }));
      const accepted = fitStock ? Math.min(next, limit) : next;
      if (accepted > limit || accepted <= before)
        return { kind: "stock", limit };

      const latest = parse(readSnapshot(), products, preserveUnknown);
      const latestQuantity =
        latest.find((line) => line.variantId === id)?.quantity ?? 0;
      if (latestQuantity !== before || timers.current.has(id))
        return { kind: "unavailable" };
      const otherLines = latest.filter((line) => line.variantId !== id);
      if (
        cartSummary(otherLines, products).subtotalMinor +
          priceMinor * accepted >
        MAX_CART_SUBTOTAL_MINOR
      )
        return { kind: "subtotal" };

      const line = { variantId: id, quantity: accepted };
      save(
        before
          ? latest.map((item) => (item.variantId === id ? line : item))
          : [...latest, line],
      );
      return null;
    } catch {
      return { kind: "unavailable" };
    } finally {
      check.current = null;
      if (!controller.signal.aborted) setCheckingQuantity(false);
    }
  }
  return (
    <StoreContext.Provider
      value={{
        products,
        gifts,
        checkoutDraft,
        setCheckoutDraft,
        setCheckoutDelivery,
        lines,
        promotion,
        setPromotion,
        summary: cartSummary(lines, products),
        overlay,
        setOverlay,
        setQuantity,
        completeOrder,
        checkingQuantity,
        applyCartSnapshot,
        removals,
        scheduleRemoval,
        undoRemoval,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("StoreProvider is required");
  return value;
}
