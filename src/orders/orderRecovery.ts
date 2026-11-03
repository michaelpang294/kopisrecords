export type RecoveredOrder = {
  reference: string;
  subtotal: number;
  delivery: number;
  total: number;
  qr: string | null;
  status: string;
  expiresAt?: string;
  serverTime: string;
  recoveryToken?: string;
  fulfilment?: string;
  collectionNumber?: number;
  items: {
    id: number;
    title: string;
    artist?: string;
    quantity: number;
    price: number;
  }[];
};
// Keep only the checkout in the current tab, never an order-history list.
type ActiveCheckout = { id: string; token: string };
const activeKey = "kopis-checkout-hold";
let memory: ActiveCheckout | null = null;
export const validToken = (token: string) => /^[a-f0-9]{64}$/.test(token);
const validId = (id: string) =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
export function activeCheckout(): ActiveCheckout | null {
  try {
    const raw = sessionStorage.getItem(activeKey);
    if (!raw) return memory;
    // An active checkout from the previous frontend can still be refreshed.
    if (validId(raw)) return { id: raw, token: "" };
    const value = JSON.parse(raw);
    if (value && validId(value.id) && validToken(value.token)) return value;
  } catch {
    /* Use this tab's in-memory state if storage is blocked. */
  }
  return memory;
}
export function setActiveCheckout(id: string, token: string) {
  if (!validId(id) || !validToken(token)) return;
  memory = { id, token };
  try {
    sessionStorage.setItem(activeKey, JSON.stringify(memory));
  } catch {
    /* Keep this tab open. */
  }
}
export function clearActiveCheckout(id?: string) {
  if (id && activeCheckout()?.id !== id) return;
  memory = null;
  try {
    sessionStorage.removeItem(activeKey);
  } catch {
    /* No storage access. */
  }
}
export function discardLegacyOrderHistory() {
  try {
    localStorage.removeItem("kopisrecords-recent-orders");
  } catch {
    /* No storage access. */
  }
}
export function newRecoveryToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function newCheckoutId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const text = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}`;
}
export function tokenForOrder(id: string) {
  const current = activeCheckout();
  return current?.id === id ? current.token : "";
}
export function prepareRecovery(id: string) {
  const token = tokenForOrder(id) || newRecoveryToken();
  setActiveCheckout(id, token);
  return token;
}
export function checkoutIdForToken(token: string) {
  const current = activeCheckout();
  return current?.token === token ? current.id : "";
}
export function recoveryPath(token: string) {
  return `/order#token=${token}`;
}
export function recoveryUrl(token: string) {
  return window.location.origin + recoveryPath(token);
}
