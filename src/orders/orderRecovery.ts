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
  items: {
    id: number;
    title: string;
    artist?: string;
    quantity: number;
    price: number;
  }[];
};
export type RecentOrder = {
  token: string;
  reference: string;
  status: string;
  total?: number;
  savedAt: string;
  orderId?: string;
};
const key = "kopisrecords-recent-orders",
  eventName = "kopis-recent-orders-updated";
let memory: RecentOrder[] = [];
let memoryOnly = false;
export const validToken = (token: string) => /^[a-f0-9]{64}$/.test(token);
export function recentOrders(): RecentOrder[] {
  if (memoryOnly) return memory;
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    if (Array.isArray(data))
      return data
        .filter(
          (value): value is RecentOrder =>
            !!value &&
            typeof value === "object" &&
            validToken(value.token) &&
            typeof value.reference === "string" &&
            typeof value.status === "string" &&
            typeof value.savedAt === "string",
        )
        .slice(0, 20);
  } catch {
    /* Use in-memory links if storage is unavailable. */
  }
  return memory;
}
function save(values: RecentOrder[]) {
  memory = values;
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    memoryOnly = true; /* Copy the link if this browser cannot remember it. */
  }
  window.dispatchEvent(new window.Event(eventName));
}
export function rememberOrder(
  token: string,
  order: Pick<RecoveredOrder, "reference" | "status" | "total">,
  orderId?: string,
) {
  if (!validToken(token)) return;
  const existing = recentOrders(),
    previous = existing.find((value) => value.token === token);
  save(
    [
      {
        token,
        reference: order.reference,
        status: order.status,
        total: order.total,
        savedAt: previous?.savedAt || new Date().toISOString(),
        orderId: orderId || previous?.orderId,
      },
      ...existing.filter((value) => value.token !== token),
    ].slice(0, 20),
  );
}
export function removeRecent(token: string) {
  save(recentOrders().filter((value) => value.token !== token));
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
  return recentOrders().find((value) => value.orderId === id)?.token || "";
}
export function prepareRecovery(id: string) {
  const found = tokenForOrder(id);
  if (found) return found;
  const token = newRecoveryToken();
  rememberOrder(
    token,
    { reference: "Checkout in progress", status: "creating", total: 0 },
    id,
  );
  return token;
}
export function recoveryPath(token: string) {
  return `/order#token=${token}`;
}
export function recoveryUrl(token: string) {
  return window.location.origin + recoveryPath(token);
}
export function subscribeOrders(fn: () => void) {
  window.addEventListener("storage", fn);
  window.addEventListener(eventName, fn);
  return () => {
    window.removeEventListener("storage", fn);
    window.removeEventListener(eventName, fn);
  };
}
