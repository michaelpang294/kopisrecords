import { randomUUID } from "node:crypto";
import { createGmailSender, shopEmail } from "./gmail.mjs";

export const emailLabels = {
  customer_payment_reported: "Customer · payment under review",
  shop_new_order: "Shop · new order",
  customer_payment_confirmed: "Customer · payment confirmed",
  customer_ready_for_collection: "Customer · ready for collection",
  customer_order_dispatched: "Customer · dispatched",
  customer_order_completed: "Customer · thank you",
};
export async function ensureOrderEmails(pool) {
  await pool.execute(`CREATE TABLE IF NOT EXISTS checkout_emails (
    order_id CHAR(36) NOT NULL, kind VARCHAR(40) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending', attempts INT UNSIGNED NOT NULL DEFAULT 0,
    claim CHAR(36) NULL, claimed_at DATETIME(3) NULL,
    next_attempt_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    last_error VARCHAR(40) NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME(3) NULL, PRIMARY KEY (order_id,kind),
    INDEX (status,next_attempt_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}
export async function queueOrderEmails(db, id, stage) {
  const kinds = {
    reported: ["customer_payment_reported", "shop_new_order"],
    confirmed: ["customer_payment_confirmed"],
    ready_for_collection: ["customer_ready_for_collection"],
    dispatched: ["customer_order_dispatched"],
    completed: ["customer_order_completed"],
  }[stage];
  if (!kinds) throw Error("Unknown order email stage.");
  for (const kind of kinds)
    await db.execute(
      "INSERT IGNORE INTO checkout_emails (order_id,kind) VALUES (?,?)",
      [id, kind],
    );
}
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (cents) => `S$${(Number(cents) / 100).toFixed(2)}`;
const validCollectionNumber = (number) =>
  Number.isSafeInteger(number) && number >= 1 && number <= 999999;
function emailContent(kind, order) {
  switch (kind) {
    case "shop_new_order":
      return {
        title: "A new order needs your attention.",
        subject: `New order: ${order.reference} — payment reported`,
        paragraphs: [
          `A customer has reported payment for order ${order.reference}. ${order.paymentStatus === "paid" ? "Payment has already been confirmed in admin." : "Check the bank transfer before confirming payment in admin."}`,
          `Name: ${order.name}\nEmail: ${order.email || "Not provided"}\nTelegram: ${order.telegram || "Not provided"}\nPhone: ${order.phone || order.contact || "Not provided"}`,
          ...(order.fulfilment === "delivery"
            ? [`Delivery address: ${order.address}\nSingapore ${order.postal}`]
            : [
                "Collection: Rocks Cafe, 98 Arab Street, Level 2, Back Alley Entrance (199794)",
              ]),
        ],
      };
    case "customer_payment_reported":
      return {
        title: "Thank you. We’ll check your payment.",
        subject: `Thank you for your order ${order.reference} — payment under review`,
        paragraphs: [
          `Hi ${order.name},`,
          `Thank you for your order! We’ve received your payment notification for ${order.reference}. Please give us 1–2 hours to check the transfer manually.`,
          "Don’t worry if your order isn’t confirmed straight away—your order and payment update are safely recorded with us. If your bank shows a successful transfer to our PayNow recipient, there’s no need to pay again. We’ll match the transfer to your order and email you once it’s confirmed.",
        ],
      };
    case "customer_payment_confirmed":
      return {
        title: "Payment received. Your order is confirmed.",
        subject: `Payment received — order ${order.reference} confirmed`,
        paragraphs: [
          `Hi ${order.name},`,
          `Your payment for ${order.reference} has been received, and your order is confirmed. Thank you for supporting Kopi’s Records!`,
          "We’ll contact you on Telegram or by phone with updates on self collection or delivery. You can also check your order using the private link below.",
        ],
      };
    case "customer_ready_for_collection":
      if (!validCollectionNumber(order.collectionNumber))
        throw Error("A collection email needs a valid bag number.");
      return {
        title: "Your records are ready for collection!",
        subject: `Ready for collection — bag #${order.collectionNumber} · ${order.reference}`,
        paragraphs: [
          `Hi ${order.name},`,
          `Your order ${order.reference} is packed and ready for collection. Your collection / bag number is ${order.collectionNumber}.`,
          "Please tell us this number when you collect so we can find your bag. You can show this email or your private order page too.",
          "Collect at Rocks Cafe, 98 Arab Street, Level 2, Back Alley Entrance (199794). Please follow the collection timing agreed with us on Telegram or by phone. If you haven’t arranged a time yet, reply to this email and we’ll help.",
          "Thanks for your patience. We can’t wait to get these records into your hands!",
        ],
      };
    case "customer_order_dispatched":
      return {
        title: "Your records are on their way!",
        subject: `Your order has been mailed out — ${order.reference}`,
        paragraphs: [
          `Hi ${order.name},`,
          `Your order ${order.reference} has been mailed out and is on its way to you.`,
          "Please allow 2–3 days for delivery. Thank you for your patience while your records make their way to you!",
          "If your order hasn’t arrived after 3 days, please drop us a message or reply to this email with your order reference. We’ll be happy to check on it for you.",
          "You can also check your order using the private link below. We hope your next favourite is in this parcel!",
        ],
      };
    case "customer_order_completed":
      return {
        title: "Thank you. Enjoy your records!",
        subject: `Thank you for shopping with Kopi’s Records — ${order.reference}`,
        paragraphs: [
          `Hi ${order.name},`,
          order.fulfilment === "collection"
            ? `Your order ${order.reference} has been collected. Thank you for supporting Kopi’s Records!`
            : `Your order ${order.reference} is now complete. Thank you for supporting Kopi’s Records!`,
          "We hope you enjoy your records and find a new favourite in your rotation. Give them a spin, and we’ll see you on your next dig.",
          "If there’s anything you need help with, just reply to this email. Happy listening!",
        ],
      };
    default:
      throw Error("Unknown order email kind.");
  }
}
export function orderEmail(kind, order, link) {
  const lines = order.items.map(
    (item) =>
      `${item.quantity} × ${item.artist ? item.artist + " — " : ""}${item.title} · ${money(item.price * item.quantity)}`,
  );
  const fulfilment =
    order.fulfilment === "delivery" ? "Delivery" : "Self collection";
  const shop = kind === "shop_new_order",
    ready = kind === "customer_ready_for_collection";
  const { title, subject, paragraphs } = emailContent(kind, order);
  const summary = [
    `Order: ${order.reference}`,
    ...(order.fulfilment === "collection" &&
    validCollectionNumber(order.collectionNumber)
      ? [`Collection / bag number: ${order.collectionNumber}`]
      : []),
    ...lines,
    `Records: ${money(order.subtotal)}`,
    `${fulfilment}: ${order.delivery ? money(order.delivery) : "Free"}`,
    `Total: ${money(order.total)}`,
  ];
  const text = [
    title,
    "",
    ...paragraphs.flatMap((p) => [p, ""]),
    ...summary,
    "",
    `${shop ? "Open admin" : "Your private order link"}: ${link}`,
    "",
    ...(shop
      ? []
      : [
          "Keep this link private. Have a question? Reply to this email.",
          "",
          "With love,",
          "Kopi’s Records",
        ]),
  ].join("\n");
  const safeLink = escape(link);
  return {
    from: { name: "Kopi’s Records", address: shopEmail },
    to: shop ? shopEmail : { name: order.name, address: order.email },
    replyTo: shopEmail,
    subject,
    text,
    html: `<div style="background:#15120f;padding:28px 16px;color:#efe8dc;font-family:Arial,sans-serif"><div style="max-width:580px;margin:auto;border:1px solid #493b2e;background:#211b16;border-radius:8px;padding:28px"><p style="font-size:12px;letter-spacing:2px;color:#cbb79c">KOPI’S RECORDS</p><h1 style="font:normal 28px/1.25 Georgia,serif">${escape(title)}</h1>${ready ? `<div style="background:#cbb79c;color:#15120f;text-align:center;padding:20px;border-radius:8px;margin:24px 0"><p style="font-size:12px;margin:0 0 8px">YOUR COLLECTION / BAG NUMBER</p><p style="font-size:40px;font-weight:bold;margin:0">${escape(order.collectionNumber)}</p></div>` : ""}${paragraphs.map((p) => `<p style="white-space:pre-wrap;line-height:1.8;color:#ddd3c6">${escape(p)}</p>`).join("")}<div style="border-top:1px solid #493b2e;border-bottom:1px solid #493b2e;padding:16px 0;margin:24px 0">${summary.map((p) => `<p style="line-height:1.6">${escape(p)}</p>`).join("")}</div><p><a href="${safeLink}" style="color:#cbb79c">${shop ? "Open admin" : "View your order"} ↗</a></p>${shop ? "" : `<p style="font-size:12px;line-height:1.7;color:#c0b4a3">Keep this link private. Have a question? Reply to this email.</p><p style="line-height:1.8;color:#cbb79c">With love,<br>Kopi’s Records</p>`}</div></div>`,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
}

export function createOrderEmailDispatcher(
  pool,
  { mailer = createGmailSender(), siteUrl, issueLink },
) {
  const parsed = new URL(
    siteUrl ||
      process.env.ORDER_SITE_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://kopisrecords.shop"
        : "http://localhost:5173"),
  );
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  )
    throw Error("ORDER_SITE_URL must be an HTTP(S) website origin.");
  const origin = parsed.origin;
  let running = null;
  let stopped = false;
  async function flush() {
    if (stopped) return;
    if (running) return running;
    if (!mailer.ready) return;
    running = (async () => {
      const [jobs] = await pool.execute(
        "SELECT order_id,kind FROM checkout_emails WHERE (status = 'pending' OR (status = 'failed' AND attempts < 5)) AND next_attempt_at <= NOW(3) ORDER BY created_at,kind LIMIT 10",
      );
      for (const job of jobs) {
        const claim = randomUUID();
        const [claimed] = await pool.execute(
          "UPDATE checkout_emails SET status = 'sending',claim = ?,claimed_at = NOW(3),attempts = attempts + 1 WHERE order_id = ? AND kind = ? AND (status = 'pending' OR (status = 'failed' AND attempts < 5)) AND next_attempt_at <= NOW(3)",
          [claim, job.order_id, job.kind],
        );
        if (!claimed.affectedRows) continue;
        let stage = "sending";
        try {
          const [rows] = await pool.execute(
            "SELECT * FROM checkout_orders WHERE id = ?",
            [job.order_id],
          );
          const row = rows[0],
            order =
              row &&
              (typeof row.details === "string"
                ? JSON.parse(row.details)
                : row.details);
          const [fulfilment] = row?.status === "paid"
            ? await pool.execute(
                "SELECT status FROM checkout_fulfilment WHERE order_id = ?",
                [job.order_id],
              )
            : [[]];
          const fulfilmentStatus = fulfilment[0]?.status || row?.status;
          const skip =
            !row ||
            !Object.hasOwn(emailLabels, job.kind) ||
            !["payment_reported", "paid"].includes(row.status) ||
            (job.kind === "customer_payment_reported" &&
              row.status === "paid") ||
            (job.kind === "customer_payment_confirmed" &&
              (row.status !== "paid" || fulfilmentStatus === "completed")) ||
            (job.kind === "customer_ready_for_collection" &&
              (row.status !== "paid" ||
                order.fulfilment !== "collection" ||
                fulfilmentStatus !== "ready_for_collection" ||
                !validCollectionNumber(order.collectionNumber))) ||
            (job.kind === "customer_order_dispatched" &&
              (row.status !== "paid" ||
                order.fulfilment !== "delivery" ||
                fulfilmentStatus !== "dispatched")) ||
            (job.kind === "customer_order_completed" &&
              (row.status !== "paid" || fulfilmentStatus !== "completed")) ||
            (job.kind !== "shop_new_order" && !order.email);
          if (skip) {
            await pool.execute(
              "UPDATE checkout_emails SET status = 'skipped',last_error = 'NOT_APPLICABLE' WHERE order_id = ? AND kind = ? AND claim = ?",
              [job.order_id, job.kind, claim],
            );
            continue;
          }
          const link =
            job.kind === "shop_new_order"
              ? `${origin}/admin/orders`
              : `${origin}/order#token=${await issueLink(job.order_id)}`;
          const message = orderEmail(
            job.kind,
            { ...order, paymentStatus: row.status },
            link,
          );
          message.messageId = `<${job.order_id}.${job.kind}@kopisrecords.shop>`;
          await mailer.send(message);
          stage = "accepted";
          await pool.execute(
            "UPDATE checkout_emails SET status = 'sent',sent_at = NOW(3),last_error = NULL WHERE order_id = ? AND kind = ? AND claim = ?",
            [job.order_id, job.kind, claim],
          );
        } catch (error) {
          console.error(
            "Order email delivery failed:",
            error.code || "ORDER_EMAIL_FAILED",
          );
          // If SMTP accepted it but recording that failed, leave it 'sending'
          // for manual reconciliation instead of automatically sending again.
          if (stage === "accepted") continue;
          const code = /^[A-Z0-9_]{1,40}$/.test(error.code || "")
            ? error.code
            : "ORDER_EMAIL_FAILED";
          await pool.execute(
            "UPDATE checkout_emails SET status = 'failed',last_error = ?,next_attempt_at = DATE_ADD(NOW(3), INTERVAL 1 MINUTE) WHERE order_id = ? AND kind = ? AND claim = ?",
            [code, job.order_id, job.kind, claim],
          );
        }
      }
    })();
    try {
      await running;
    } finally {
      running = null;
    }
  }
  return {
    flush,
    async stop() {
      stopped = true;
      if (running) await running;
    },
    kick() {
      if (stopped) return;
      setImmediate(
        () =>
          void flush().catch((error) =>
            console.error(
              "Order email queue failed:",
              error.code || "QUEUE_FAILED",
            ),
          ),
      );
    },
  };
}
