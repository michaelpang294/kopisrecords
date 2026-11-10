import { orderPreorders } from "./preorders.mjs";
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
  const greeting = `Hi ${order.name},`;
  switch (kind) {
    case "shop_new_order":
      return {
        title: "New order",
        subject: `New order for ${order.items.reduce((count, item) => count + item.quantity, 0)} items!`,
        paragraphs: [
          order.paymentStatus === "paid"
            ? "Payment is already confirmed in admin."
            : "A customer has reported payment. Check the transfer before confirming it in admin.",
          `Name: ${order.name}\nEmail: ${order.email || "Not provided"}\nTelegram: ${order.telegram || "Not provided"}\nPhone: ${order.phone || order.contact || "Not provided"}`,
          order.fulfilment === "delivery"
            ? `Delivery address: ${order.address}\nSingapore ${order.postal}`
            : "Collection: Rocks Cafe, 98 Arab Street, Level 2, Back Alley Entrance (199794). Open Tuesday - Sunday, 2:30 - 11:00 pm",
        ],
      };
    case "customer_payment_reported":
      return {
        title: "Your order has been received!",
        subject: `Thank you for purchasing from Kopi's Records - ${order.reference}`,
        paragraphs: [
          greeting,
          "Thank you for your order! Please allow 1–2 hours for us to check on your transfer. We’ll email you once payment is confirmed.",
        ],
      };
    case "customer_payment_confirmed":
      return {
        title: "Payment confirmed",
        subject: `Your payment has been confirmed - ${order.reference}`,
        paragraphs: [
          greeting,
          "Your payment has been received and your order is confirmed. Thank you!",
          "We’ll send you an email soon once the records are packed and ready for collection at Rocks Cafe. Please wait for that email before heading down.",
        ],
      };
    case "customer_ready_for_collection":
      if (!validCollectionNumber(order.collectionNumber))
        throw Error("A collection email needs a valid bag number.");
      return {
        title: "Ready for collection",
        subject: `Your order is ready for collection - ${order.reference}`,
        paragraphs: [
          greeting,
          `Your records are ready. Your collection / bag number is ${order.collectionNumber}. Show this number when you collect.`,
          "Collection: Rocks Cafe, 98 Arab Street, Level 2, Back Alley Entrance (199794). Open Tuesday - Sunday, 2:30 - 11:00 pm",
          "To be safe, please message us on Telegram @kopirecords before you head down to collect.",
        ],
      };
    case "customer_order_dispatched":
      return {
        title: "Order dispatched",
        subject: `Your order has been mailed out - ${order.reference}`,
        paragraphs: [
          greeting,
          "Your records have been mailed out. Please allow 2–3 days for delivery.",
          "If they haven’t arrived after 3 days, reply to this email with your order reference and we’ll check on it.",
        ],
      };
    case "customer_order_completed":
      return {
        title: "Thank you for your order",
        subject: `Thank you for purchasing from Kopi's Records! - ${order.reference}`,
        paragraphs: [
          greeting,
          order.fulfilment === "collection"
            ? "Your order has been collected. Thanks for supporting Kopi’s Records!"
            : "Your order is complete. Thanks for supporting Kopi’s Records!",
          "Enjoy your records and happy listening. If you need any help, reply to this email.",
        ],
      };
    default:
      throw Error("Unknown order email kind.");
  }
}

// Only display HTTP(S) images. No server-side image fetching is needed.
function coverUrl(value, orderLink) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const site = new URL(orderLink).origin;
    const api = new URL(process.env.PUBLIC_API_URL || `${site}/api`);
    let image = new URL(value.trim(), site);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(image.hostname);
    if (image.pathname.startsWith("/covers/") &&
        (local || image.origin === site)) {
      image = new URL(api.href.replace(/\/$/, "") + image.pathname);
    }
    if (!["http:", "https:"].includes(image.protocol) || image.username || image.password) return null;
    if (new URL(site).protocol === "https:" && local) return null;
    return image.href;
  } catch {
    return null;
  }
}

export function orderEmail(kind, order, link) {
  const items = order.items.map((item) => ({
    item,
    cover: coverUrl(item.cover_image, link),
    title: `${item.quantity} × ${item.artist ? item.artist + " — " : ""}${item.title}`,
    format: item.medium || "Not recorded for this order",
    variant: item.variant || "Not specified",
  }));
  const lines = items.flatMap(({ item, title, format, variant, cover }) => [
    `${title} · ${money(item.price * item.quantity)}`,
    `Format: ${format}`,
    `Variant / pressing: ${variant}`,
    `Product ID: ${item.id}`,
    ...(cover ? [`Cover image: ${cover}`] : []),
    `Variant / pressing: ${variant}`,
    ...(item.preorder
      ? [`Release Date: ${item.released || "To be announced"}`]
      : []),
  ]);
  const fulfilment =
    order.fulfilment === "delivery" ? "Delivery" : "Self collection";
  const shop = kind === "shop_new_order";
  const { title, subject, paragraphs } = emailContent(kind, order);
  if (order.items.some((item) => item.preorder) && ["customer_payment_reported", "customer_payment_confirmed"].includes(kind)) {
    const hold = "Your complete order, including any in-stock records, will be held until all preorder items are ready. Expected arrival dates are estimates. We’ll email you separately when the full order is ready for collection or has been dispatched.";
    if (kind === "customer_payment_confirmed") paragraphs[2] = hold;
    else paragraphs.push(hold);
  }
  const summary = [
    ...(order.fulfilment === "collection" &&
    validCollectionNumber(order.collectionNumber)
      ? [`Collection / bag number: ${order.collectionNumber}`]
      : []),
    ...lines,
    `Subtotal (${order.items.reduce((count, item) => count + item.quantity, 0)} items): ${money(order.subtotal)}`,
    `${fulfilment}: ${order.delivery ? money(order.delivery) : "Free"}`,
    `Total: ${money(order.total)}`,
  ];
  const text = [
    title,
    `Order: ${order.reference}`,
    "",
    ...paragraphs.flatMap((p) => [p, ""]),
    ...summary,
    "",
    `${shop ? "Open admin" : "Your private order link"}: ${link}`,
    "",
    ...(shop
      ? []
      : [
          "Please keep this link private. If you have any questions, feel free to drop us a message on telegram at @kopirecords or simply reply to this email.",
          "Thank you once again!",
          "",
          "Cheers,",
          "Michael from Kopi's Records",
        ]),
  ].join("\n");
  const safeLink = escape(link);
  // Presentation tables keep artwork beside item details in email clients.
  const itemHtml = items.map(({ item, title, format, variant, cover }) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;border-collapse:collapse;margin:16px 0;border-bottom:1px solid #eee"><tr>${cover ? `<td width="96" valign="top" style="width:96px;vertical-align:top;padding:0 16px 16px 0"><img src="${escape(cover)}" alt="${escape(`${item.artist ? item.artist + " - " : ""}${item.title} cover`)}" width="80" height="80" style="display:block;width:80px;height:80px;object-fit:contain;border:0"></td>` : ""}<td valign="top" style="vertical-align:top;padding:0 0 16px;overflow-wrap:anywhere;word-break:break-word"><p style="margin:0 0 4px"><strong>${escape(title)}</strong></p><p style="margin:4px 0">Format: ${escape(format)}</p><p style="margin:4px 0">Variant / pressing: ${escape(variant)}</p>${item.preorder ? `<p style="margin:4px 0">Release Date: ${escape(item.released || "To be announced")}</p>` : ""}<p style="margin:4px 0">${escape(money(item.price * item.quantity))}</p></td></tr></table>`
  ).join("");
  const htmlSummary = [
    ...(order.fulfilment === "collection" && validCollectionNumber(order.collectionNumber)
      ? [`Collection / bag number: ${order.collectionNumber}`] : []),
    `Subtotal (${order.items.reduce((count, item) => count + item.quantity, 0)} items): ${money(order.subtotal)}`,
    `${fulfilment}: ${order.delivery ? money(order.delivery) : "Free"}`,
    `Total: ${money(order.total)}`,
  ];
  return {
    from: { name: "Kopi’s Records", address: shopEmail },
    to: shop ? shopEmail : { name: order.name, address: order.email },
    replyTo: shopEmail,
    subject,
    text,
    html: `<div style="max-width:600px;margin:0 auto;padding:24px;font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#222;background:#fff"><h1 style="font-size:22px;line-height:1.3">${escape(title)}</h1><p style="margin:8px 0 20px">Order: <strong>${escape(order.reference)}</strong></p>${paragraphs.map((p) => `<p style="white-space:pre-wrap">${escape(p)}</p>`).join("")}<div style="border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:12px 0;margin:20px 0">${itemHtml}${htmlSummary.map((p) => `<p style="margin:6px 0">${escape(p)}</p>`).join("")}</div><p><a href="${safeLink}" style="color:#174ea6">${shop ? "Open admin" : "View your order"}</a></p>${shop ? "" : `<p>Please keep this link private. If you have any questions, feel free to drop us a message on telegram at @kopirecords or simply reply to this email.</p><p>Thank you once again!</p><p>Cheers,<br>Michael from Kopi's Records</p>`}</div>`,
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
          const preorders = await orderPreorders(pool, job.order_id);
          order.items = order.items.map((item) => ({ ...item, preorder: item.preorder || preorders.some((p) => p.productId === Number(item.id)) }));
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
