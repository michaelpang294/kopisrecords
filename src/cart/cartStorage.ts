export const CART_KEY = "kopisrecords-cart";

export type CartItem = { id: number; quantity: number };
export type CartResult = { ok: boolean; message: string };

/** Read the original [{ id, quantity }] format, including older saved carts. */
export function parseCart(raw: string | null): { items: CartItem[]; invalid: boolean } {
  if (raw === null) return { items: [], invalid: false };
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return { items: [], invalid: true };
    const merged = new Map<number, number>();
    let invalid = false;

    for (const entry of value) {
      if (
        !entry ||
        typeof entry !== "object" ||
        !Number.isSafeInteger(entry.id) ||
        entry.id < 1 ||
        !Number.isSafeInteger(entry.quantity) ||
        entry.quantity < 1
      ) {
        invalid = true;
        continue;
      }
      const quantity = (merged.get(entry.id) || 0) + entry.quantity;
      if (!Number.isSafeInteger(quantity)) {
        invalid = true;
        continue;
      }
      merged.set(entry.id, quantity);
    }
    return {
      items: [...merged].map(([id, quantity]) => ({ id, quantity })),
      invalid,
    };
  } catch {
    return { items: [], invalid: true };
  }
}

export function getStock(value: unknown): number {
  const stock = Number(value);
  return Number.isSafeInteger(stock) && stock > 0 ? stock : 0;
}

/** Use integer cents for cart arithmetic. Prices are always SGD. */
export function getPriceCents(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const amount = Number(value);
  const cents = Math.round(amount * 100);
  return Number.isFinite(amount) && amount >= 0 && Number.isSafeInteger(cents) ? cents : null;
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
