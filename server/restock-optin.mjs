import { randomBytes, randomUUID, createHash } from "node:crypto";
export async function ensureRestockOptins(pool) {
  await pool.execute(`CREATE TABLE IF NOT EXISTS restock_optins (
    alert_id CHAR(36) NOT NULL, generation CHAR(36) NOT NULL, token_hash CHAR(64) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending', attempts INT UNSIGNED NOT NULL DEFAULT 0,
    claim CHAR(36) NULL, next_attempt_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    expires_at DATETIME(3) NULL, sent_at DATETIME(3) NULL, confirmed_at DATETIME(3) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, last_error VARCHAR(40) NULL,
    PRIMARY KEY(alert_id,generation), UNIQUE KEY(token_hash), INDEX(status,next_attempt_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}
export async function subscribeConfirmed(db, value, existing, ipHash) {
  const alert = existing[0];
  if (alert) {
    const [checks] = await db.execute("SELECT * FROM restock_optins WHERE alert_id = ? AND generation = ?", [alert.alert_id, alert.generation]);
    const check = checks[0];
    if (check?.confirmed_at && ["waiting", "sending", "failed"].includes(alert.status)) return {};
    if (alert.status === "unconfirmed" && check &&
        (["pending", "sending", "failed"].includes(check.status) || +new Date(check.expires_at) > Date.now())) return {};
  }
  const [limits] = await db.execute("SELECT COUNT(*) AS total,COALESCE(SUM(email = ?),0) AS customer,COALESCE(SUM(ip_hash = ?),0) AS source FROM restock_alerts WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)", [value.email, ipHash]);
  if (Number(limits[0].total) >= 100 || Number(limits[0].customer) >= 10 || Number(limits[0].source) >= 20)
    return { status: 429, error: "We’ve received several signups recently. Please try again later." };
  const id = alert?.alert_id || randomUUID(), generation = randomUUID();
  if (alert) {
    await db.execute("UPDATE restock_alerts SET generation = ?,ip_hash = ?,status = 'unconfirmed',attempts = 0,claim = NULL,claimed_at = NULL,next_attempt_at = NOW(3),last_error = NULL,sent_at = NULL,created_at = CURRENT_TIMESTAMP WHERE alert_id = ?", [generation, ipHash, id]);
  } else {
    await db.execute("INSERT INTO restock_alerts (alert_id,generation,product_id,email,ip_hash,status) VALUES (?,?,?,?,?,'unconfirmed')", [id, generation, value.productId, value.email, ipHash]);
  }
  await db.execute("INSERT INTO restock_optins (alert_id,generation) VALUES (?,?)", [id, generation]);
  return {};
}
const escape = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export async function sendOptinEmails(pool, mailer, origin) {
  const [rows] = await pool.execute("SELECT v.alert_id,v.generation,a.email,s.artist,s.title FROM restock_optins v INNER JOIN restock_alerts a ON a.alert_id=v.alert_id AND a.generation=v.generation INNER JOIN stock s ON s.id=a.product_id WHERE a.status='unconfirmed' AND (v.status='pending' OR (v.status='failed' AND v.attempts<5)) AND v.next_attempt_at<=NOW(3) ORDER BY v.created_at LIMIT 10");
  for (const row of rows) {
    const raw = randomBytes(32).toString("hex"), tokenHash = createHash("sha256").update(raw).digest("hex"), claim = randomUUID();
    const [result] = await pool.execute("UPDATE restock_optins SET status = 'sending',claim = ?,token_hash = ?,expires_at = DATE_ADD(NOW(3), INTERVAL 24 HOUR),attempts = attempts + 1 WHERE alert_id = ? AND generation = ? AND (status = 'pending' OR (status = 'failed' AND attempts < 5)) AND next_attempt_at <= NOW(3)", [claim, tokenHash, row.alert_id, row.generation]);
    if (!result.affectedRows) continue;
    const link = `${origin}/stock-alert#token=${raw}`;
    const record = `${row.artist} — ${row.title}`;
    let accepted = false;
    try {
      await mailer.send({
        from: { name: "Kopi’s Records", address: "kopisrecords@gmail.com" }, to: row.email, replyTo: "kopisrecords@gmail.com",
        subject: `Confirm your stock alert: ${record}`.replace(/[\r\n]+/g, " ").slice(0, 300),
        text: `Confirm your email for a stock alert\n\nYou requested an availability alert for ${record}.\n\nOpen this link and press Confirm stock alert: ${link}\n\nThe link expires in 24 hours. Once confirmed, we’ll email you once when this record is available. If you didn’t request this, you can ignore this message.\n\nWith love,\nKopi’s Records`,
        html: `<div style="background:#15120f;color:#efe8dc;padding:28px;font-family:Arial,sans-serif"><div style="max-width:580px;margin:auto"><p style="color:#cbb79c">KOPI’S RECORDS</p><h1 style="font:normal 28px Georgia,serif">Confirm your stock alert</h1><p style="line-height:1.8">You requested an availability alert for ${escape(record)}.</p><p><a href="${escape(link)}" style="display:inline-block;background:#cbb79c;color:#15120f;padding:14px 20px;border-radius:6px">Confirm stock alert ↗</a></p><p style="line-height:1.8">The link expires in 24 hours. Once confirmed, we’ll email you once when this record is available. If you didn’t request this, you can ignore this message.</p><p>With love,<br>Kopi’s Records</p></div></div>`,
        messageId: `<${row.alert_id}.${row.generation}.optin@kopisrecords.shop>`, disableFileAccess: true, disableUrlAccess: true,
      });
      accepted = true;
      await pool.execute("UPDATE restock_optins SET status = 'sent',sent_at = NOW(3),last_error = NULL WHERE alert_id = ? AND generation = ? AND claim = ? AND status = 'sending'", [row.alert_id, row.generation, claim]);
    } catch (error) {
      const code = /^[A-Z0-9_]{1,40}$/.test(error.code || "") ? error.code : "OPTIN_MAIL_FAILED";
      console.error("Stock alert verification failed:", code);
      if (!accepted) await pool.execute("UPDATE restock_optins SET status = 'failed',last_error = ?,next_attempt_at = DATE_ADD(NOW(3), INTERVAL 1 MINUTE) WHERE alert_id = ? AND generation = ? AND claim = ? AND status = 'sending'", [code, row.alert_id, row.generation, claim]);
    }
  }
}
export function optinRoutes(app, pool, { transaction, dispatcher }) {
  app.post("/api/restock-alerts/confirm", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const raw = req.get("Authorization")?.replace(/^Bearer /, "");
    if (!/^[a-f0-9]{64}$/.test(raw || "")) return res.status(404).json({ error: "This confirmation link is incomplete." });
    const result = await transaction(pool, async (db) => {
      const [rows] = await db.execute("SELECT v.alert_id,v.generation,v.expires_at,v.confirmed_at FROM restock_optins v INNER JOIN restock_alerts a ON a.alert_id=v.alert_id AND a.generation=v.generation WHERE v.token_hash = ?", [createHash("sha256").update(raw).digest("hex")]);
      const row = rows[0];
      if (!row) return { status: 404, error: "This confirmation link is no longer valid. Sign up again on the record’s page." };
      if (!row.confirmed_at && +new Date(row.expires_at) <= Date.now()) return { status: 410, error: "This link has expired. Sign up again on the record’s page for a new one." };
      if (!row.confirmed_at) {
        await db.execute("UPDATE restock_optins SET status = 'confirmed',confirmed_at = NOW(3) WHERE alert_id = ? AND generation = ?", [row.alert_id, row.generation]);
        await db.execute("UPDATE restock_alerts SET status = 'waiting' WHERE alert_id = ? AND generation = ? AND status = 'unconfirmed'", [row.alert_id, row.generation]);
      }
      return {};
    });
    if (result.status) return res.status(result.status).json({ error: result.error });
    dispatcher.kick();
    res.json({ message: "Your email is confirmed. We’ll email you once when this record is available." });
  });
}
