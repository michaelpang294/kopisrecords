import { randomUUID } from "node:crypto";
import { createGmailSender, shopEmail } from "./gmail.mjs";

export const preorderLabels = {
  awaiting_release: "Awaiting release",
  on_the_way: "On the way to us",
  ready: "Ready",
};
const parse = (value) => typeof value === "string" ? JSON.parse(value) : value;
export function hasPreorderTag(value) {
  try { return (parse(value) || []).includes("preorder"); } catch { return false; }
}
export function validArrival(value) {
  if (value === null || value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}
const day = (value) => !value ? null : value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
export function arrivalLabel(value) {
  return value ? new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(day(value) + "T00:00:00Z")) : "To be confirmed";
}
export async function ensurePreorders(pool) {
  await pool.execute(`CREATE TABLE IF NOT EXISTS product_preorders (
    product_id BIGINT UNSIGNED PRIMARY KEY, status VARCHAR(24) NOT NULL DEFAULT 'awaiting_release',
    expected_arrival DATE NULL, version INT UNSIGNED NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS checkout_preorder_items (
    order_id CHAR(36) NOT NULL, product_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY(order_id,product_id), INDEX(product_id)
  ) ENGINE=InnoDB`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS preorder_emails (
    order_id CHAR(36) NOT NULL, product_id BIGINT UNSIGNED NOT NULL, version INT UNSIGNED NOT NULL,
    payload JSON NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'pending', attempts INT UNSIGNED NOT NULL DEFAULT 0,
    claim CHAR(36) NULL, next_attempt_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    last_error VARCHAR(40) NULL, sent_at DATETIME(3) NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(order_id,product_id,version), INDEX(status,next_attempt_at)
  ) ENGINE=InnoDB`);
  // Associate legacy open orders with titles still tagged preorder. Immutable new
  // snapshots take precedence: an explicit false is never reclassified later.
  await pool.execute(`INSERT IGNORE INTO checkout_preorder_items (order_id,product_id)
    SELECT o.id,j.product_id FROM checkout_orders o
    CROSS JOIN JSON_TABLE(o.details,'$.items[*]' COLUMNS(product_id BIGINT PATH '$.id', preorder VARCHAR(8) PATH '$.preorder' NULL ON EMPTY)) AS j
    JOIN stock s ON s.id=j.product_id
    WHERE o.status IN ('awaiting_payment_confirmation','payment_reported','paid')
    AND (j.preorder='true' OR (j.preorder IS NULL AND JSON_CONTAINS(COALESCE(s.tags,'[]'),'"preorder"')))`);
  await pool.execute(`INSERT IGNORE INTO product_preorders (product_id)
    SELECT DISTINCT product_id FROM checkout_preorder_items`);
}
export async function registerPreorders(db, orderId, items) {
  for (const item of items.filter((line) => line.preorder)) {
    await db.execute("INSERT IGNORE INTO product_preorders (product_id) VALUES (?)", [item.id]);
    await db.execute("INSERT IGNORE INTO checkout_preorder_items (order_id,product_id) VALUES (?,?)", [orderId, item.id]);
  }
}
export async function orderPreorders(db, orderId) {
  const [rows] = await db.execute(`SELECT m.product_id,p.status,p.expected_arrival FROM checkout_preorder_items m
    LEFT JOIN product_preorders p ON p.product_id=m.product_id WHERE m.order_id=? ORDER BY m.product_id`, [orderId]);
  return rows.map((row) => ({ productId: Number(row.product_id), status: row.status || "awaiting_release", expectedArrival: day(row.expected_arrival) }));
}
export async function assertPreordersReady(db, orderId) {
  if ((await orderPreorders(db, orderId)).some((item) => item.status !== "ready"))
    throw Error("This order is on hold. Mark every preorder title Ready before arranging collection or dispatch.");
}
export async function preorderCatalog(db) {
  const [rows] = await db.execute("SELECT product_id,status,expected_arrival,version FROM product_preorders");
  return new Map(rows.map((row) => [Number(row.product_id), { preorderStatus: row.status, expectedArrival: day(row.expected_arrival), preorderVersion: Number(row.version) }]));
}

export async function updatePreorder(db, productId, input) {
  if (!Object.hasOwn(preorderLabels, input?.status) || !validArrival(input.expectedArrival) ||
      !Number.isSafeInteger(input.version) || input.version < 0)
    throw Error("Choose a status, a valid arrival date (or leave it blank), and refresh the saved version.");
  const [products] = await db.execute("SELECT * FROM stock WHERE id = ?", [productId]);
  if (!products.length) {
    const [tracked] = await db.execute("SELECT product_id,status,expected_arrival,version FROM product_preorders WHERE product_id=? FOR UPDATE", [productId]);
    if (!tracked.length) throw Error("Product not found.");
    products.push({ id: productId, title: `Removed listing #${productId}`, artist: "" });
  }
  await db.execute("INSERT IGNORE INTO product_preorders (product_id) VALUES (?)", [productId]);
  const [rows] = await db.execute("SELECT product_id,status,expected_arrival,version FROM product_preorders WHERE product_id=? FOR UPDATE", [productId]);
  const previous = rows[0];
  if (Number(previous.version) !== input.version) throw Error("This preorder was updated elsewhere. Refresh before saving.");
  const nextDate = input.expectedArrival || null;
  const dateChanged = day(previous.expected_arrival) !== nextDate;
  if (previous.status === input.status && !dateChanged) return { message: "No changes to save.", queued: 0 };
  const version = Number(previous.version) + 1;
  await db.execute("UPDATE product_preorders SET status=?,expected_arrival=?,version=? WHERE product_id=?", [input.status, nextDate, version, productId]);
  const [orders] = await db.execute(`SELECT o.id,o.details FROM checkout_preorder_items m JOIN checkout_orders o ON o.id=m.order_id
    LEFT JOIN checkout_fulfilment f ON f.order_id=o.id WHERE m.product_id=?
    AND o.status IN ('payment_reported','paid') AND COALESCE(f.status,o.status) IN ('payment_reported','paid')`, [productId]);
  let queued = 0;
  for (const row of orders) {
    const details = parse(row.details);
    if (!details.email) continue;
    const item = details.items.find((line) => Number(line.id) === productId) || products[0];
    const payload = { title: item.title, artist: item.artist, medium: item.medium || products[0].medium,
      variant: item.variant || products[0].variant, status: input.status, expectedArrival: nextDate,
      previousArrival: day(previous.expected_arrival), dateChanged };
    const [result] = await db.execute("INSERT IGNORE INTO preorder_emails (order_id,product_id,version,payload) VALUES (?,?,?,?)", [row.id, productId, version, JSON.stringify(payload)]);
    queued += result.affectedRows;
  }
  return { message: `Preorder updated. ${queued} customer email(s) queued.`, queued, version };
}

export function preorderRoutes(app, pool, requireAdmin, { transaction, dispatcher }) {
  app.get("/api/admin/preorders", requireAdmin, async (req, res, next) => {
    try {
      const [products] = await pool.execute("SELECT * FROM stock ORDER BY id DESC");
      const catalog = await preorderCatalog(pool);
      // A removed catalogue listing can still belong to an open preorder.
      for (const [id] of catalog) if (!products.some((p) => Number(p.id) === id))
        products.push({ id, title: `Removed listing #${id}`, artist: "", medium: "", variant: "", released: "" });
      const [failed] = await pool.execute("SELECT COUNT(*) AS total FROM preorder_emails WHERE status='failed'");
      res.set("Cache-Control", "no-store").json({ products: products.filter((p) => hasPreorderTag(p.tags) || catalog.has(Number(p.id))).map((p) => ({
        id: Number(p.id), title: p.title, artist: p.artist, medium: p.medium, variant: p.variant, released: p.released,
        preorderStatus: "awaiting_release", expectedArrival: null, preorderVersion: 0, ...catalog.get(Number(p.id)),
      })), failedEmails: Number(failed[0]?.total || 0) });
    } catch (error) { next(error); }
  });
  app.put("/api/admin/preorders/:id", requireAdmin, async (req, res, next) => {
    if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id))) return res.status(400).json({ error: "Invalid product ID." });
    try {
      const result = await transaction(pool, (db) => updatePreorder(db, Number(req.params.id), req.body));
      dispatcher.kick(); res.json(result);
    } catch (error) { if (!error.code) return res.status(409).json({ error: error.message }); next(error); }
  });
  app.post("/api/admin/preorders/emails/retry", requireAdmin, async (req, res, next) => {
    try {
      await pool.execute("UPDATE preorder_emails SET status='pending',attempts=0,next_attempt_at=NOW(3) WHERE status='failed'");
      dispatcher.kick(); res.json({ message: "Failed preorder emails queued for retry." });
    } catch (error) { next(error); }
  });
}
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function preorderEmail(order, payload, link) {
  const lines = [ `Hi ${order.name},`,
    `An update on ${payload.artist ? payload.artist + " — " : ""}${payload.title}${payload.medium ? " (" + payload.medium + ")" : ""}.`,
    ...(payload.variant ? [`Variant / pressing: ${payload.variant}`] : []),
    `Status: ${preorderLabels[payload.status]}`,
    ...(payload.dateChanged ? [`Expected arrival changed from ${arrivalLabel(payload.previousArrival)} to ${arrivalLabel(payload.expectedArrival)}.`] : [`Expected arrival: ${arrivalLabel(payload.expectedArrival)}`]),
    payload.status === "ready" ? "This title has arrived. If your order has other preorders, we’ll hold everything until they are all ready. We’ll email you separately when your complete order is packed for collection or dispatched. Please don’t head down to collect yet." : "We’re holding your complete order, including any in-stock items, until all preorders are ready. Expected arrival dates are estimates; we’ll email you if they change.",
    "Questions? Reply to this email or message @kopirecords on Telegram.", "Cheers,", "Michael from Kopi’s Records" ];
  const heading = payload.dateChanged ? "Preorder arrival update" : "Preorder progress update";
  return { from: { name: "Kopi’s Records", address: shopEmail }, to: { name: order.name, address: order.email }, replyTo: shopEmail,
    subject: `${heading} — ${order.reference}`,
    text: [heading, `Order: ${order.reference}`, "", ...lines.flatMap((p) => [p, ""]), `Your private order link: ${link}`, "Keep this link private."].join("\n"),
    html: `<div style="max-width:600px;margin:auto;padding:24px;font:16px/1.6 Arial,sans-serif;color:#222"><h1 style="font-size:22px">${escape(heading)}</h1><p>Order: <strong>${escape(order.reference)}</strong></p>${lines.map((p) => `<p>${escape(p)}</p>`).join("")}<p><a href="${escape(link)}">View your order</a></p><p>Keep this link private.</p></div>`, disableFileAccess: true, disableUrlAccess: true };
}
export function createPreorderDispatcher(pool, { mailer = createGmailSender(), siteUrl, issueLink } = {}) {
  const url = new URL(siteUrl || process.env.ORDER_SITE_URL || (process.env.NODE_ENV === "production" ? "https://kopisrecords.shop" : "http://localhost:5173"));
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw Error("Invalid preorder email site URL.");
  let running = null, stopped = false;
  async function flush() {
    if (stopped || !mailer.ready) return;
    if (running) return running;
    running = (async () => {
      const [jobs] = await pool.execute("SELECT order_id,product_id,version,payload FROM preorder_emails WHERE (status='pending' OR (status='failed' AND attempts<5)) AND next_attempt_at<=NOW(3) ORDER BY created_at LIMIT 20");
      for (const job of jobs) {
        const claim = randomUUID(); let accepted = false;
        const [result] = await pool.execute("UPDATE preorder_emails SET status='sending',claim=?,attempts=attempts+1 WHERE order_id=? AND product_id=? AND version=? AND (status='pending' OR (status='failed' AND attempts<5)) AND next_attempt_at<=NOW(3)", [claim, job.order_id, job.product_id, job.version]);
        if (!result.affectedRows) continue;
        try {
          const [rows] = await pool.execute("SELECT o.details,o.status,COALESCE(f.status,o.status) AS fulfilment_status,p.version FROM checkout_orders o LEFT JOIN checkout_fulfilment f ON f.order_id=o.id JOIN product_preorders p ON p.product_id=? WHERE o.id=?", [job.product_id, job.order_id]);
          const row = rows[0], order = row && parse(row.details);
          if (!order?.email || !["payment_reported", "paid"].includes(row.status) || !["payment_reported", "paid"].includes(row.fulfilment_status) || Number(row.version) !== Number(job.version)) {
            await pool.execute("UPDATE preorder_emails SET status='skipped',last_error='NOT_APPLICABLE' WHERE order_id=? AND product_id=? AND version=? AND claim=?", [job.order_id, job.product_id, job.version, claim]); continue;
          }
          const message = preorderEmail(order, parse(job.payload), `${url.origin}/order#token=${await issueLink(job.order_id)}`);
          message.messageId = `<${job.order_id}.preorder.${job.product_id}.${job.version}@kopisrecords.shop>`;
          await mailer.send(message); accepted = true;
          await pool.execute("UPDATE preorder_emails SET status='sent',sent_at=NOW(3),last_error=NULL WHERE order_id=? AND product_id=? AND version=? AND claim=?", [job.order_id, job.product_id, job.version, claim]);
        } catch (error) {
          console.error("Preorder email delivery failed:", error.code || "PREORDER_EMAIL_FAILED");
          if (accepted) continue;
          const code = /^[A-Z0-9_]{1,40}$/.test(error.code || "") ? error.code : "PREORDER_EMAIL_FAILED";
          await pool.execute("UPDATE preorder_emails SET status='failed',last_error=?,next_attempt_at=DATE_ADD(NOW(3),INTERVAL 1 MINUTE) WHERE order_id=? AND product_id=? AND version=? AND claim=?", [code, job.order_id, job.product_id, job.version, claim]);
        }
      }
    })();
    try { await running; } finally { running = null; }
  }
  return { flush, async stop() { stopped = true; if (running) await running; }, kick() { if (!stopped) setImmediate(() => void flush().catch((e) => console.error("Preorder queue failed:", e.code || "QUEUE_FAILED"))); } };
}
