import { createHash, randomUUID } from "node:crypto";
import { createRequestMailer } from "./request-email.mjs";

export async function ensureRecordRequests(pool) {
  await pool.execute(`CREATE TABLE IF NOT EXISTS record_requests (
    request_id CHAR(36) PRIMARY KEY, fingerprint CHAR(64) NOT NULL,
    name VARCHAR(100) NOT NULL, email VARCHAR(254) NOT NULL,
    contact VARCHAR(100) NOT NULL DEFAULT '', record VARCHAR(200) NOT NULL,
    notes TEXT NOT NULL, ip_hash CHAR(64) NOT NULL,
    email_status VARCHAR(16) NOT NULL DEFAULT 'pending', mail_claim CHAR(36) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX (email,created_at), INDEX (ip_hash,created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}
const sha = (value) => createHash("sha256").update(value).digest("hex");
function validate(body) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw Error("Invalid request.");
  if (
    typeof body.requestId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      body.requestId,
    )
  )
    throw Error("Please refresh the page and try again.");
  const value = { requestId: body.requestId };
  for (const [field, limit] of Object.entries({
    name: 100,
    email: 254,
    contact: 100,
    record: 200,
    notes: 1500,
  })) {
    const raw = body[field] ?? "";
    if (
      typeof raw !== "string" ||
      raw.length > limit ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(raw) ||
      (field !== "notes" && /[\r\n]/.test(raw))
    )
      throw Error(`Please check the ${field} field.`);
    value[field] = raw.trim();
  }
  value.email = value.email.toLowerCase();
  if (!value.name || !value.record)
    throw Error("Your name and the record are required.");
  if (
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(
      value.email,
    )
  )
    throw Error("Please enter a valid email address.");
  return value;
}

export function recordRequestRoutes(app, pool, mailer = createRequestMailer()) {
  const attempts = new Map();
  app.post("/api/record-requests", async (req, res) => {
    res.set("Cache-Control", "no-store");
    let value;
    try {
      value = validate(req.body);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    const now = Date.now();
    for (const [key, entry] of attempts)
      if (entry.until <= now) attempts.delete(key);
    const key = sha(req.ip || "unknown");
    const limit = attempts.get(key) || {
      count: 0,
      until: now + 10 * 60 * 1000,
    };
    if (limit.count >= 10)
      return res
        .status(429)
        .json({ error: "Please wait a few minutes before trying again." });
    limit.count++;
    attempts.set(key, limit);
    const { requestId, ...fields } = value;
    const fingerprint = sha(JSON.stringify(fields));
    let [rows] = await pool.execute(
      "SELECT * FROM record_requests WHERE request_id = ?",
      [requestId],
    );
    if (!rows.length) {
      if (!mailer.ready)
        return res
          .status(503)
          .json({
            error:
              "Requests by email aren’t available yet. Please email kopisrecords@gmail.com directly.",
          });
      // Persistent limits also apply across process restarts and workers.
      const [counts] = await pool.execute(
        "SELECT COUNT(*) AS total, COALESCE(SUM(email = ? OR ip_hash = ?),0) AS customer FROM record_requests WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)",
        [value.email, key],
      );
      if (Number(counts[0].customer) >= 3 || Number(counts[0].total) >= 30)
        return res
          .status(429)
          .json({
            error:
              "We’ve received several requests recently. Please try again later or email us directly.",
          });
      await pool.execute(
        "INSERT IGNORE INTO record_requests (request_id,fingerprint,name,email,contact,record,notes,ip_hash) VALUES (?,?,?,?,?,?,?,?)",
        [
          requestId,
          fingerprint,
          value.name,
          value.email,
          value.contact,
          value.record,
          value.notes,
          key,
        ],
      );
      [rows] = await pool.execute(
        "SELECT * FROM record_requests WHERE request_id = ?",
        [requestId],
      );
    }
    const saved = rows[0];
    if (saved.fingerprint !== fingerprint)
      return res
        .status(409)
        .json({
          error: "This request has changed. Please start a new request.",
        });
    if (saved.email_status === "sent")
      return res.json({ received: true, emailStatus: "sent" });
    if (!mailer.ready)
      return res
        .status(202)
        .json({
          received: true,
          emailStatus: "failed",
          message:
            "Your request is saved, but the confirmation email could not be sent. Please contact kopisrecords@gmail.com.",
        });
    const claim = randomUUID();
    const [claimed] = await pool.execute(
      "UPDATE record_requests SET email_status = 'sending', mail_claim = ? WHERE request_id = ? AND email_status IN ('pending','failed')",
      [claim, requestId],
    );
    if (!claimed.affectedRows)
      return res
        .status(202)
        .json({
          received: true,
          emailStatus: "sending",
          message:
            "Your request is saved and its email is being processed. Check your inbox shortly.",
        });
    try {
      await mailer.send(value);
    } catch (error) {
      // Never expose SMTP credentials, recipient addresses or raw provider errors.
      console.error(
        "Record request email failed:",
        error.code || "MAIL_SEND_FAILED",
      );
      await pool.execute(
        "UPDATE record_requests SET email_status = 'failed' WHERE request_id = ? AND mail_claim = ?",
        [requestId, claim],
      );
      return res
        .status(202)
        .json({
          received: true,
          emailStatus: "failed",
          message:
            "Your request is saved, but the confirmation email could not be sent. You can retry below or contact kopisrecords@gmail.com.",
        });
    }
    await pool.execute(
      "UPDATE record_requests SET email_status = 'sent' WHERE request_id = ? AND mail_claim = ?",
      [requestId, claim],
    );
    return res.status(201).json({ received: true, emailStatus: "sent" });
  });
}
