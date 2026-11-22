import { randomUUID } from "node:crypto";
import { createGmailSender, shopEmail } from "./gmail.mjs";
import { transaction, orderResponse, expireOrders } from "./checkout.mjs";
import { grantRecovery, orderForToken } from "./order-access.mjs";
import { validInvoiceId, isInvoice, invoiceError, validateInvoiceDraft, invoiceTotals, invoiceOrder, invoiceReference, invoiceFingerprint, invoiceEmailAddress, invoiceCustomer } from "./invoice-rules.mjs";
const parse = (value) => typeof value === "string" ? JSON.parse(value) : value;
const iso = (value) => value ? new Date(value).toISOString() : null;
export async function ensureInvoices(pool) {
  await pool.execute(`CREATE TABLE IF NOT EXISTS custom_invoices (
    id CHAR(36) PRIMARY KEY, draft JSON NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'draft', version INT UNSIGNED NOT NULL DEFAULT 1,
    expires_at DATETIME(3) NULL, sent_at DATETIME(3) NULL,
    email_status VARCHAR(16) NOT NULL DEFAULT 'not_queued', email_attempts INT UNSIGNED NOT NULL DEFAULT 0,
    email_claim CHAR(36) NULL, email_next_attempt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), email_error VARCHAR(40) NULL, email_sent_at DATETIME(3) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX(status,created_at), INDEX(email_status,email_next_attempt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}
const select = "SELECT i.*,o.status AS order_status,COALESCE(f.status,o.status) AS fulfilment_status FROM custom_invoices i LEFT JOIN checkout_orders o ON o.id=i.id LEFT JOIN checkout_fulfilment f ON f.order_id=o.id";
function serialize(row) {
  return { id: row.id, draft: parse(row.draft), status: row.status, version: Number(row.version), reference: invoiceReference(row.id),
    totals: invoiceTotals(parse(row.draft)), createdAt: iso(row.created_at), issuedAt: iso(row.sent_at), expiresAt: iso(row.expires_at),
    emailStatus: row.email_status, emailAttempts: Number(row.email_attempts), emailError: row.email_error, emailSentAt: iso(row.email_sent_at),
    orderStatus: row.fulfilment_status || row.order_status || null };
}
async function getInvoice(db, id, lock = false) {
  if (!validInvoiceId(id)) throw invoiceError("Invoice not found.", 404);
  const [rows] = await db.execute("SELECT * FROM custom_invoices WHERE id=?" + (lock ? " FOR UPDATE" : ""), [id]);
  if (!rows.length) throw invoiceError("Invoice not found.", 404);
  return rows[0];
}
const sameVersion = (row, value) => { if (!Number.isSafeInteger(value) || Number(row.version) !== value) throw invoiceError("This invoice changed in another tab. Refresh and review it again before continuing.", 409); };
function website(siteUrl) {
  const url = new URL(siteUrl || process.env.ORDER_SITE_URL || (process.env.NODE_ENV === "production" ? "https://kopisrecords.shop" : "http://localhost:5173"));
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw Error("Invoice links require a valid website origin.");
  return url.origin;
}
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const money = (value) => `S$${(value / 100).toFixed(2)}`;
const deadline = (value) => new Intl.DateTimeFormat("en-SG", { timeZone: "Asia/Singapore", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) + " SGT";
export function invoiceEmail(id, draft, link, expiresAt, siteUrl) {
  const order = invoiceOrder(id, draft, siteUrl);
  const totals = invoiceTotals(draft);
  const lines = order.items.flatMap((item) => [ `${item.quantity} × ${item.artist} — ${item.title} · ${money(item.price * item.quantity)}`,
    `Format: ${item.medium}`, `Variant / pressing: ${item.variant || "Not specified"}` ]);
  const summary = [`Subtotal (${totals.count} items): ${money(totals.subtotal)}`, `${draft.fulfilment === "delivery" ? "Delivery" : "Self collection"}: ${totals.delivery ? money(totals.delivery) : "Free"}`, `Total: ${money(totals.total)}`];
  const intro = [draft.customerName ? `Hi ${draft.customerName},` : "Hi,", "Here’s the invoice for your custom order. Review your records and confirm your contact details using the payment link below, then pay by PayNow.", ...(draft.notes ? [draft.notes] : []), `Payment link expires: ${expiresAt ? deadline(expiresAt) : `${draft.expiryDays} days after sending`}.`, "After paying, press ‘I’ve made payment’. We’ll check the transfer and email you once it’s confirmed."];
  const cards = order.items.map((item) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;border-bottom:1px solid #ddd;margin:16px 0"><tr>${item.cover_image ? `<td width="96" valign="top" style="width:96px;padding:0 16px 16px 0"><img src="${escape(item.cover_image)}" alt="${escape(`${item.artist} — ${item.title} cover`)}" width="80" height="80" style="display:block;object-fit:contain"></td>` : ""}<td valign="top" style="padding-bottom:16px;overflow-wrap:anywhere"><p style="margin:0 0 4px"><strong>${escape(`${item.quantity} × ${item.artist} — ${item.title}`)}</strong></p><p style="margin:4px 0">Format: ${escape(item.medium)}</p><p style="margin:4px 0">Variant / pressing: ${escape(item.variant || "Not specified")}</p><p style="margin:4px 0">${money(item.price * item.quantity)}</p></td></tr></table>`).join("");
  return { from: { name: "Kopi’s Records", address: shopEmail }, to: { name: draft.customerName, address: invoiceEmailAddress(draft.email, true) }, replyTo: shopEmail,
    subject: `Your invoice from Kopi’s Records — ${invoiceReference(id)}`,
    text: ["Your custom order", `Order: ${invoiceReference(id)}`, "", ...intro.flatMap((line) => [line, ""]), ...lines, "", ...summary, "", `Review and pay: ${link}`, "Keep this payment link private. Questions? Reply to this email or message @kopirecords on Telegram.", "", "Cheers,", "Michael from Kopi’s Records"].join("\n"),
    html: `<div style="max-width:600px;margin:auto;padding:24px;font:16px/1.6 Arial,sans-serif;color:#222"><h1 style="font-size:22px">Your custom order</h1><p>Order: <strong>${invoiceReference(id)}</strong></p>${intro.map((line) => `<p style="white-space:pre-wrap">${escape(line)}</p>`).join("")}${cards}${summary.map((line) => `<p>${escape(line)}</p>`).join("")}<p><a href="${escape(link)}" style="color:#174ea6">Review &amp; pay your invoice</a></p><p>Keep this payment link private. Questions? Reply to this email or message @kopirecords on Telegram.</p><p>Cheers,<br>Michael from Kopi’s Records</p></div>`, disableFileAccess: true, disableUrlAccess: true };
}
export function createInvoiceDispatcher(pool, { mailer = createGmailSender(), siteUrl } = {}) {
  const origin = website(siteUrl); let running = null, stopped = false;
  async function flush() {
    if (stopped || !mailer.ready) return; if (running) return running;
    running = (async () => {
      const [jobs] = await pool.execute("SELECT id FROM custom_invoices WHERE status='sent' AND (email_status='pending' OR (email_status='failed' AND email_attempts<5)) AND email_next_attempt<=NOW(3) ORDER BY created_at LIMIT 10");
      for (const job of jobs) {
        const claim = randomUUID(); let accepted = false;
        const [claimed] = await pool.execute("UPDATE custom_invoices SET email_status='sending',email_claim=?,email_attempts=email_attempts+1 WHERE id=? AND status='sent' AND (email_status='pending' OR (email_status='failed' AND email_attempts<5)) AND email_next_attempt<=NOW(3)", [claim, job.id]);
        if (!claimed.affectedRows) continue;
        try {
          const [rows] = await pool.execute(select + " WHERE i.id=?", [job.id]);
          const row = rows[0];
          if (!row || row.status !== "sent" || row.order_status !== "awaiting_payment_confirmation" || !row.expires_at || +new Date(row.expires_at) <= Date.now()) {
            await pool.execute("UPDATE custom_invoices SET email_status='skipped',email_error='NOT_APPLICABLE' WHERE id=? AND email_claim=?", [job.id, claim]); continue;
          }
          const token = await grantRecovery(pool, job.id);
          const message = invoiceEmail(job.id, parse(row.draft), `${origin}/invoice#token=${token}`, row.expires_at, origin);
          message.messageId = `<${job.id}.custom_invoice@kopisrecords.shop>`;
          await mailer.send(message); accepted = true;
          await pool.execute("UPDATE custom_invoices SET email_status='sent',email_sent_at=NOW(3),email_error=NULL WHERE id=? AND email_claim=?", [job.id, claim]);
        } catch (error) {
          console.error("Invoice email delivery failed:", error.code || "INVOICE_EMAIL_FAILED");
          if (accepted) continue;
          const code = /^[A-Z0-9_]{1,40}$/.test(error.code || "") ? error.code : "INVOICE_EMAIL_FAILED";
          await pool.execute("UPDATE custom_invoices SET email_status='failed',email_error=?,email_next_attempt=DATE_ADD(NOW(3),INTERVAL 1 MINUTE) WHERE id=? AND email_claim=?", [code, job.id, claim]);
        }
      }
    })();
    try { await running; } finally { running = null; }
  }
  return { get ready() { return mailer.ready; }, flush, async stop() { stopped = true; if (running) await running; }, kick() { if (!stopped) setImmediate(() => void flush().catch((e) => console.error("Invoice queue failed:", e.code || "QUEUE_FAILED"))); } };
}
export function invoiceRoutes(app, pool, requireAdmin, { dispatcher, siteUrl }) {
  const origin = website(siteUrl);
  const handle = (fn) => async (req, res, next) => { try { res.set("Cache-Control", "no-store"); res.json(await fn(req)); } catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); next(e); } };
  app.get("/api/admin/invoices", requireAdmin, handle(async (req) => {
    await expireOrders(pool);
    const page = Math.max(1, Math.min(100000, Number(req.query.page) || 1)); if (!Number.isInteger(page)) throw invoiceError("Invalid page.");
    let where = " WHERE 1=1"; const args = [], q = String(req.query.q || "").trim().slice(0,120), status = String(req.query.status || "");
    if (status) { if (!["draft","sent","void"].includes(status)) throw invoiceError("Invalid invoice filter."); where += " AND i.status=?"; args.push(status); }
    if (q) { where += " AND (JSON_UNQUOTE(JSON_EXTRACT(i.draft,'$.customerName')) LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(i.draft,'$.email')) LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(i.draft,'$.platform')) LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(i.draft,'$.externalReference')) LIKE ? OR CONCAT('KR',UPPER(LEFT(REPLACE(i.id,'-',''),20))) LIKE ?)"; args.push(...Array(5).fill("%"+q+"%")); }
    const [count] = await pool.execute("SELECT COUNT(*) AS total FROM custom_invoices i" + where, args);
    const [rows] = await pool.execute(select + where + ` ORDER BY i.created_at DESC,i.id DESC LIMIT 30 OFFSET ${(page-1)*30}`, args);
    return { invoices: rows.map(serialize), total: Number(count[0].total), page, pageSize: 30 };
  }));
  app.post("/api/admin/invoices", requireAdmin, handle(async (req) => {
    if (!validInvoiceId(req.body?.id)) throw invoiceError("Invalid invoice ID.");
    const draft = validateInvoiceDraft(req.body.draft);
    return transaction(pool, async (db) => {
      const [existing] = await db.execute("SELECT * FROM custom_invoices WHERE id=? FOR UPDATE", [req.body.id]);
      if (existing.length) { if (JSON.stringify(validateInvoiceDraft(parse(existing[0].draft))) !== JSON.stringify(draft)) throw invoiceError("This invoice already exists. Open it before editing.",409); return serialize(existing[0]); }
      await db.execute("INSERT INTO custom_invoices (id,draft) VALUES (?,?)", [req.body.id, JSON.stringify(draft)]);
      return serialize(await getInvoice(db, req.body.id));
    });
  }));
  app.get("/api/admin/invoices/:id", requireAdmin, handle(async (req) => {
    if (!validInvoiceId(req.params.id)) throw invoiceError("Invoice not found.",404);
    await expireOrders(pool); const [rows] = await pool.execute(select + " WHERE i.id=?", [req.params.id]);
    if (!rows.length) throw invoiceError("Invoice not found.",404); return serialize(rows[0]);
  }));
  app.put("/api/admin/invoices/:id", requireAdmin, handle(async (req) => {
    const draft = validateInvoiceDraft(req.body?.draft);
    return transaction(pool, async (db) => {
      const row = await getInvoice(db, req.params.id, true); sameVersion(row, req.body.version);
      if (row.status !== "draft") throw invoiceError("An issued or void invoice cannot be edited. Duplicate it as a new draft instead.",409);
      await db.execute("UPDATE custom_invoices SET draft=?,version=version+1 WHERE id=?", [JSON.stringify(draft), row.id]);
      return serialize(await getInvoice(db,row.id));
    });
  }));
  app.get("/api/admin/invoices/:id/preview", requireAdmin, handle(async (req) => {
    const row = await getInvoice(pool, req.params.id); sameVersion(row, Number(req.query.version));
    if (row.status !== "draft") throw invoiceError("This invoice has already been issued or voided.",409);
    const draft = parse(row.draft); invoiceEmailAddress(draft.email,true);
    const message = invoiceEmail(row.id,draft,origin+"/invoice#preview",null,origin);
    return { subject: message.subject, html: message.html, text: message.text, version: Number(row.version) };
  }));
  app.post("/api/admin/invoices/:id/send", requireAdmin, handle(async (req) => {
    if (!dispatcher.ready) throw invoiceError("Configure Gmail before sending an invoice.",503);
    const result = await transaction(pool, async (db) => {
      const row = await getInvoice(db, req.params.id, true);
      if (row.status === "sent") return { message: "Invoice already issued. No duplicate order or email created.", invoice: serialize(row) };
      sameVersion(row,req.body?.version); if (row.status !== "draft") throw invoiceError("This invoice cannot be sent.",409);
      const draft = validateInvoiceDraft(parse(row.draft)); invoiceEmailAddress(draft.email,true);
      const order = invoiceOrder(row.id,draft,origin);
      await db.execute("INSERT INTO checkout_orders (id,fingerprint,details) VALUES (?,?,?)", [row.id,invoiceFingerprint(order),JSON.stringify(order)]);
      await db.execute("INSERT INTO checkout_order_events (order_id,action) VALUES (?,?)",[row.id,"invoice_issued"]);
      await db.execute("UPDATE custom_invoices SET status='sent',version=version+1,sent_at=NOW(3),expires_at=?,email_status='pending',email_attempts=0,email_next_attempt=NOW(3),email_error=NULL WHERE id=?",[new Date(order.expiresAt),row.id]);
      return { message: "Invoice issued. Email queued; check delivery status below.", invoice: serialize(await getInvoice(db,row.id)) };
    }); dispatcher.kick(); return result;
  }));
  app.post("/api/admin/invoices/:id/link", requireAdmin, handle(async (req) => transaction(pool,async db=>{
    const row=await getInvoice(db,req.params.id,true); if(row.status!=="sent")throw invoiceError("Issue the invoice before creating a payment link.",409);
    return { link: `${origin}/invoice#token=${await grantRecovery(db,row.id)}` };
  })));
  app.post("/api/admin/invoices/:id/email/retry", requireAdmin, handle(async req=>{
    await transaction(pool,async db=>{
      const row=await getInvoice(db,req.params.id,true);
      if(row.status!=="sent"||row.email_status!=="failed")throw invoiceError("Only a failed invoice email can be retried.",409);
      await db.execute("UPDATE custom_invoices SET email_status='pending',email_attempts=0,email_next_attempt=NOW(3),email_error=NULL WHERE id=?",[row.id]);
    });dispatcher.kick();return{message:"Failed invoice email queued for retry."};
  }));
  app.post("/api/admin/invoices/:id/void", requireAdmin, handle(async req=>{
    if(req.body?.confirmed!==true)throw invoiceError("Confirm that you checked for payment before voiding.");
    return transaction(pool,async db=>{
      const row=await getInvoice(db,req.params.id,true);sameVersion(row,req.body.version);
      if(row.status==='void')return{message:'Invoice already voided.'};
      if(row.status==='sent'){
        const [orders]=await db.execute("SELECT * FROM checkout_orders WHERE id = ?",[row.id]);
        if(!orders.length||!['awaiting_payment_confirmation','expired','cancelled'].includes(orders[0].status))throw invoiceError("Payment has been reported or confirmed. Review this in Orders; do not void it here.",409);
        if(orders[0].status!=='cancelled'){
          await db.execute("UPDATE checkout_orders SET status = 'cancelled' WHERE id = ?",[row.id]);
          await db.execute("INSERT INTO checkout_order_events (order_id,action) VALUES (?,?)",[row.id,'cancelled']);
        }
      }
      await db.execute("UPDATE custom_invoices SET status='void',version=version+1 WHERE id=?",[row.id]);return{message:'Invoice voided. No refund was made.'};
    });
  }));
  // Registered after recoveryRoutes, so its existing rate limiter also applies.
  app.post("/api/order-recovery/invoice-details",handle(async req=>transaction(pool,async db=>{
    const token=req.get('Authorization')?.replace(/^Bearer /,''),row=await orderForToken(db,token);
    const order=parse(row.details);if(!isInvoice(order)||order.invoiceId!==row.id)throw invoiceError("Invoice not found.",404);
    const current=await orderResponse(db,row);if(current.status!=='awaiting_payment_confirmation')throw invoiceError("This invoice is no longer awaiting payment. Use your order page for its current status.",409);
    const contact=invoiceCustomer(req.body,order.fulfilment);
    const updated={...order,...contact,invoiceDetailsConfirmed:true};
    await db.execute("UPDATE checkout_orders SET details = ? WHERE id = ?",[JSON.stringify(updated),row.id]);
    return orderResponse(db,{...row,details:updated});
  })));
}
