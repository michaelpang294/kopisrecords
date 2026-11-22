import { createHash } from "node:crypto";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const validInvoiceId = (value) => typeof value === "string" && uuid.test(value);
export const isInvoice = (order) => order?.source === "invoice" && validInvoiceId(order.invoiceId);
export const invoiceReference = (id) => "KR" + id.replaceAll("-", "").slice(0, 20).toUpperCase();
export function invoiceError(message, status = 400) { return Object.assign(Error(message), { status }); }
function text(value, label, limit, required = false, multiline = false) {
  if (typeof value !== "string") { if (value == null && !required) return ""; throw invoiceError(`Enter a valid ${label}.`); }
  const clean = value.trim();
  if ((required && !clean) || clean.length > limit || (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(clean)) throw invoiceError(`Enter a valid ${label}.`);
  return clean;
}
export function invoiceEmailAddress(value, required = false) {
  const email = text(value, "customer email", 254, required).toLowerCase();
  if (email && !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email)) throw invoiceError("Enter a valid customer email address.");
  return email;
}
function cents(value, label) {
  const raw = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw invoiceError(`${label} must be a nonnegative amount with up to two decimal places.`);
  const [whole, decimals = ""] = raw.split(".");
  const amount = Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount > 20000000) throw invoiceError(`${label} is too large.`);
  return amount;
}
export function invoiceCover(value, siteUrl) {
  if (!value) return "";
  try {
    const site = new URL(siteUrl || process.env.ORDER_SITE_URL || "http://localhost:5173");
    let url = new URL(value, site);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw Error();
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    // A full local API URL already works during development. Hosted emails
    // must instead use the public API origin so customers can load the image.
    if (site.protocol === "http:" && local && /^https?:\/\//i.test(value) && !process.env.PUBLIC_API_URL) return url.href;
    if ((url.origin === site.origin || local) && /^\/(?:api\/)?covers\//.test(url.pathname))
      url = new URL((process.env.PUBLIC_API_URL || site.origin + "/api").replace(/\/$/, "") + url.pathname.replace(/^\/api/, ""));
    if (site.protocol === "https:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw Error();
    return url.href;
  } catch { throw invoiceError("Use a valid HTTP(S) cover image URL. Local files and embedded image data are not supported."); }
}
export function validateInvoiceDraft(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw invoiceError("Enter your invoice details.");
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 100) throw invoiceError("Add between 1 and 100 records.");
  const ids = new Set();
  const items = body.items.map((item) => {
    if (!item || !validInvoiceId(item.key) || ids.has(item.key)) throw invoiceError("Each record needs its own valid row ID.");
    ids.add(item.key);
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) throw invoiceError("Record quantities must be whole numbers from 1 to 100.");
    const unit = cents(item.unitPrice, "Record price");
    const cover = text(item.cover_image, "cover image URL", 2048);
    if (cover) invoiceCover(cover);
    return { key: item.key, title: text(item.title, "album title", 255, true), artist: text(item.artist, "artist", 255, true), unitPrice: (unit / 100).toFixed(2), quantity: item.quantity,
      medium: text(item.medium, "format", 30, true), variant: text(item.variant, "variant / pressing", 255), cover_image: cover };
  });
  if (!["collection", "delivery"].includes(body.fulfilment)) throw invoiceError("Choose collection or delivery.");
  const fee = body.fulfilment === "delivery" ? cents(body.deliveryFee, "Delivery fee") : 0;
  if (![1,3,7,14,30].includes(body.expiryDays)) throw invoiceError("Choose an invoice expiry of 1, 3, 7, 14 or 30 days.");
  const draft = { items, fulfilment: body.fulfilment, deliveryFee: (fee / 100).toFixed(2), expiryDays: body.expiryDays,
    customerName: text(body.customerName, "customer name", 120), email: invoiceEmailAddress(body.email),
    notes: text(body.notes, "customer note", 2000, false, true), internalNotes: text(body.internalNotes, "internal notes", 2000, false, true),
    platform: text(body.platform, "sales platform", 80), externalReference: text(body.externalReference, "platform reference", 120) };
  invoiceTotals(draft); return draft;
}
export function invoiceTotals(draft) {
  const subtotal = draft.items.reduce((sum, item) => sum + cents(item.unitPrice, "Record price") * item.quantity, 0);
  const delivery = draft.fulfilment === "delivery" ? cents(draft.deliveryFee, "Delivery fee") : 0;
  const total = subtotal + delivery;
  if (!Number.isSafeInteger(total) || total <= 0 || total > 20000000) throw invoiceError("Invoice total must be more than zero and no more than S$200,000.");
  return { subtotal, delivery, total, count: draft.items.reduce((sum, i) => sum + i.quantity, 0) };
}
export function invoiceOrder(id, draft, siteUrl, now = Date.now()) {
  const totals = invoiceTotals(draft);
  return { source: "invoice", invoiceId: id, invoiceDetailsConfirmed: false, reference: invoiceReference(id),
    items: draft.items.map((item, index) => ({ id: -(index + 1), title: item.title, artist: item.artist, medium: item.medium, variant: item.variant,
      cover_image: invoiceCover(item.cover_image, siteUrl), quantity: item.quantity, price: cents(item.unitPrice, "Record price"), preorder: false })),
    subtotal: totals.subtotal, delivery: totals.delivery, total: totals.total, name: draft.customerName || "Customer", email: invoiceEmailAddress(draft.email, true),
    phone: "", telegram: "", contact: "", address: "", postal: "", fulfilment: draft.fulfilment, customerNote: draft.notes,
    expiresAt: new Date(now + draft.expiryDays * 86400000).toISOString(), status: "awaiting_payment_confirmation" };
}
export function invoiceFingerprint(order) { return createHash("sha256").update(JSON.stringify(order)).digest("hex"); }
export function invoiceCustomer(body, fulfilment) {
  const name = text(body?.name, "name", 120, true), phone = text(body?.phone, "phone number", 40, true);
  if (!/^\+?[0-9 ()-]+$/.test(phone) || !/^[0-9]{8,15}$/.test(phone.replace(/\D/g, ""))) throw invoiceError("Enter a valid contact number (8–15 digits).");
  const username = text(body?.telegram, "Telegram username", 64, true).replace(/^@/, "");
  if (!/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(username)) throw invoiceError("Enter a valid Telegram username, e.g. @yourusername.");
  const address = fulfilment === "delivery" ? text(body?.address, "delivery address", 500, true, true) : "";
  const postal = fulfilment === "delivery" ? text(body?.postal, "postal code", 6, true) : "";
  if (postal && !/^\d{6}$/.test(postal)) throw invoiceError("Enter a six-digit Singapore postal code.");
  return { name, phone, contact: phone, telegram: "@" + username, address, postal };
}
export function assertInvoiceDetails(order) {
  if (isInvoice(order) && !order.invoiceDetailsConfirmed) throw invoiceError("Confirm your contact and delivery details on the invoice page before reporting payment.", 409);
}
