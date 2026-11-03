import { createHash, randomUUID } from "node:crypto";
import { createGmailSender, shopEmail } from "./gmail.mjs";

export async function ensureRestockAlerts(pool) {
  await pool.execute(`CREATE TABLE IF NOT EXISTS restock_alerts (
    alert_id CHAR(36) PRIMARY KEY, generation CHAR(36) NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL, email VARCHAR(254) NOT NULL,
    ip_hash CHAR(64) NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'waiting',
    attempts INT UNSIGNED NOT NULL DEFAULT 0, claim CHAR(36) NULL,
    claimed_at DATETIME(3) NULL, next_attempt_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    last_error VARCHAR(40) NULL, sent_at DATETIME(3) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY product_email (product_id,email), INDEX(status,next_attempt_at),
    INDEX(ip_hash,created_at), INDEX(email,created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}
const hash = (value) => createHash("sha256").update(value).digest("hex");
const escape = (value) => String(value ?? "").replace(/[&<>"']/g,
  (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
function validate(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      !Number.isSafeInteger(body.productId) || body.productId < 1 || body.productId > 4294967295)
    throw Error("Choose a valid record.");
  if (typeof body.email !== "string" || body.email.length > 254 || /[\u0000-\u001f\u007f]/.test(body.email))
    throw Error("Please enter a valid email address.");
  const email = body.email.trim().toLowerCase();
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email))
    throw Error("Please enter a valid email address.");
  return { productId: body.productId, email };
}
export function restockAlertRoutes(app, pool, { transaction, availableStock, dispatcher, requireAdmin }) {
  const attempts = new Map();
  app.post("/api/restock-alerts", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    let value;
    try { value = validate(req.body); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    const now = Date.now(), ipHash = hash(req.ip || "unknown");
    for (const [ip, rate] of attempts) if (rate.until <= now) attempts.delete(ip);
    const rate = attempts.get(ipHash) || { count: 0, until: now + 10 * 60 * 1000 };
    rate.count++;
    attempts.set(ipHash, rate);
    if (rate.count > 20)
      return res.status(429).json({ error: "Please wait a few minutes before trying again." });
    if (!dispatcher.ready)
      return res.status(503).json({ error: "Stock alerts aren’t available right now. Please try again later or email kopisrecords@gmail.com." });
    try {
      const result = await transaction(pool, async (db) => {
        const [products] = await db.execute("SELECT * FROM stock WHERE id = ?", [value.productId]);
        if (!products.length) return { status: 404, error: "This record is no longer listed." };
        if (await availableStock(db, products[0]) > 0)
          return { status: 409, error: "This record is available now. Check availability to add it to your cart.", code: "AVAILABLE" };
        const [existing] = await db.execute(
          "SELECT * FROM restock_alerts WHERE product_id = ? AND email = ?", [value.productId, value.email]);
        // The same generic response protects existing subscriber information.
        if (existing.length && ["waiting", "sending", "failed"].includes(existing[0].status)) return {};
        const [limits] = await db.execute(
          "SELECT COUNT(*) AS total,COALESCE(SUM(email = ?),0) AS customer,COALESCE(SUM(ip_hash = ?),0) AS source FROM restock_alerts WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)",
          [value.email, ipHash]);
        if (Number(limits[0].total) >= 100 || Number(limits[0].customer) >= 10 || Number(limits[0].source) >= 20)
          return { status: 429, error: "We’ve received several signups recently. Please try again later." };
        if (existing.length) {
          await db.execute(
            "UPDATE restock_alerts SET generation = ?,ip_hash = ?,status = 'waiting',attempts = 0,claim = NULL,claimed_at = NULL,next_attempt_at = NOW(3),last_error = NULL,sent_at = NULL,created_at = CURRENT_TIMESTAMP WHERE alert_id = ? AND status = 'sent'",
            [randomUUID(), ipHash, existing[0].alert_id]);
        } else {
          await db.execute(
            "INSERT INTO restock_alerts (alert_id,generation,product_id,email,ip_hash) VALUES (?,?,?,?,?)",
            [randomUUID(), randomUUID(), value.productId, value.email, ipHash]);
        }
        return {};
      });
      if (result.status) return res.status(result.status).json({ error: result.error, ...(result.code ? { code: result.code } : {}) });
      res.status(202).json({ message: "You’re on the list. We’ll email you once when this record is available again." });
    } catch (error) { next(error); }
  });
  // Failed alerts can be retried by the shop, without subscribing or emailing anyone twice.
  app.post("/api/admin/restock-alerts/retry", requireAdmin, async (req, res) => {
    await pool.execute("UPDATE restock_alerts SET status = 'waiting',attempts = 0,next_attempt_at = NOW(3) WHERE status = 'failed'");
    dispatcher.kick();
    res.json({ message: "Failed stock alerts queued for retry." });
  });
}

export function restockEmail(alert, product, origin) {
  const record = `${product.artist} — ${product.title}`,
    link = `${origin}/shop/product/${product.id}`;
  const paragraphs = [
    `Good news! ${record} is available at Kopi’s Records again.`,
    "You asked us to let you know when this record returned to the crates. Take a look using the link below.",
    "Availability may change. Place your order to secure a copy.",
    "This is your one-time availability alert for this record. If it sells out again, you can sign up for another alert on its page.",
  ];
  return {
    from: { name: "Kopi’s Records", address: shopEmail }, to: alert.email, replyTo: shopEmail,
    subject: `Back in stock: ${record}`.replace(/[\r\n]+/g, " ").slice(0, 300),
    text: ["Back in the crates!", "", ...paragraphs.flatMap((p) => [p, ""]), `View the record: ${link}`, "", "With love,", "Kopi’s Records"].join("\n"),
    html: `<div style="background:#15120f;padding:28px 16px;color:#efe8dc;font-family:Arial,sans-serif"><div style="max-width:580px;margin:auto;border:1px solid #493b2e;background:#211b16;border-radius:8px;padding:28px"><p style="font-size:12px;letter-spacing:2px;color:#cbb79c">KOPI’S RECORDS</p><h1 style="font:normal 28px/1.25 Georgia,serif">Back in the crates!</h1>${paragraphs.map((p) => `<p style="line-height:1.8;color:#ddd3c6">${escape(p)}</p>`).join("")}<p style="margin:28px 0"><a href="${escape(link)}" style="display:inline-block;background:#cbb79c;color:#15120f;padding:14px 20px;border-radius:6px;text-decoration:none">View the record ↗</a></p><p style="font-size:12px;color:#c0b4a3">Have a question? Reply to this email.</p><p style="line-height:1.8;color:#cbb79c">With love,<br>Kopi’s Records</p></div></div>`,
    disableFileAccess: true, disableUrlAccess: true,
  };
}

export function createRestockDispatcher(pool, { transaction, availableStock, mailer = createGmailSender(), siteUrl }) {
  const parsed = new URL(siteUrl || process.env.ORDER_SITE_URL || (process.env.NODE_ENV === "production" ? "https://kopisrecords.shop" : "http://localhost:5173"));
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password)
    throw Error("ORDER_SITE_URL must be an HTTP(S) website origin.");
  let running = null, stopped = false;
  async function flush() {
    if (stopped || !mailer.ready) return;
    if (running) return running;
    running = (async () => {
      const [candidates] = await pool.execute(
        "SELECT a.alert_id FROM restock_alerts a INNER JOIN stock s ON s.id=a.product_id WHERE (a.status='waiting' OR (a.status='failed' AND a.attempts<5)) AND a.next_attempt_at<=NOW(3) AND s.stock>COALESCE((SELECT SUM(r.quantity) FROM checkout_reservations r WHERE r.product_id=s.id AND (r.state='reported' OR (r.state='active' AND r.expires_at>NOW(3)))),0) ORDER BY a.created_at,a.alert_id LIMIT 10");
      for (const candidate of candidates) {
        const claimed = await transaction(pool, async (db) => {
          const [alerts] = await db.execute("SELECT * FROM restock_alerts WHERE alert_id = ?", [candidate.alert_id]);
          const alert = alerts[0];
          if (!alert || !["waiting", "failed"].includes(alert.status) || alert.attempts >= 5 || +new Date(alert.next_attempt_at) > Date.now()) return null;
          const [products] = await db.execute("SELECT * FROM stock WHERE id = ?", [alert.product_id]);
          if (!products.length || await availableStock(db, products[0]) < 1) return null;
          const claim = randomUUID();
          const [changed] = await db.execute(
            "UPDATE restock_alerts SET status = 'sending',claim = ?,claimed_at = NOW(3),attempts = attempts + 1 WHERE alert_id = ? AND generation = ? AND status IN ('waiting','failed') AND attempts < 5 AND next_attempt_at <= NOW(3)",
            [claim, alert.alert_id, alert.generation]);
          return changed.affectedRows ? { alert, product: products[0], claim } : null;
        });
        if (!claimed) continue;
        const { alert, product, claim } = claimed;
        let accepted = false;
        try {
          const message = restockEmail(alert, product, parsed.origin);
          message.messageId = `<${alert.alert_id}.${alert.generation}.restock@kopisrecords.shop>`;
          await mailer.send(message);
          accepted = true;
          await pool.execute(
            "UPDATE restock_alerts SET status = 'sent',sent_at = NOW(3),last_error = NULL WHERE alert_id = ? AND generation = ? AND claim = ? AND status = 'sending'",
            [alert.alert_id, alert.generation, claim]);
        } catch (error) {
          const code = /^[A-Z0-9_]{1,40}$/.test(error.code || "") ? error.code : "RESTOCK_MAIL_FAILED";
          console.error("Stock alert delivery failed:", code);
          // An accepted message with a failed status write needs manual review, not a blind resend.
          if (accepted) continue;
          await pool.execute(
            "UPDATE restock_alerts SET status = 'failed',last_error = ?,next_attempt_at = DATE_ADD(NOW(3), INTERVAL 1 MINUTE) WHERE alert_id = ? AND generation = ? AND claim = ? AND status = 'sending'",
            [code, alert.alert_id, alert.generation, claim]);
        }
      }
    })();
    try { await running; } finally { running = null; }
  }
  return {
    get ready() { return mailer.ready; },
    flush,
    async stop() { stopped = true; if (running) await running; },
    kick() {
      if (stopped || !mailer.ready) return;
      setImmediate(() => void flush().catch((error) => console.error("Stock alert queue failed:", error.code || "QUEUE_FAILED")));
    },
  };
}
