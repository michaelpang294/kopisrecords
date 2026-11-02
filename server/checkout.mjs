import QRCode from "qrcode";
import { createHash } from "node:crypto";
export function crc16(text) {
  let crc = 0xffff;
  for (const byte of Buffer.from(text)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
const tlv = (id, value) =>
  id + String(Buffer.byteLength(value)).padStart(2, "0") + value;
export function paynowPayload(cents, reference) {
  const account =
    tlv("00", "SG.PAYNOW") +
    tlv("01", "0") +
    tlv("02", "+6591470168") +
    tlv("03", "0");
  const payload =
    tlv("00", "01") +
    tlv("01", "12") +
    tlv("26", account) +
    tlv("52", "0000") +
    tlv("53", "702") +
    tlv("54", (cents / 100).toFixed(2)) +
    tlv("58", "SG") +
    tlv("59", "KOPIS RECORDS") +
    tlv("60", "Singapore") +
    tlv("62", tlv("01", reference)) +
    "6304";
  return payload + crc16(payload);
}
export async function ensureOrders(pool) {
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS checkout_orders (id CHAR(36) PRIMARY KEY, fingerprint CHAR(64) NOT NULL, status VARCHAR(40) NOT NULL DEFAULT 'awaiting_payment_confirmation', details JSON NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`,
  );
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS checkout_reservation_lock (id INT PRIMARY KEY) ENGINE=InnoDB`,
  );
  await pool.execute(
    "INSERT IGNORE INTO checkout_reservation_lock (id) VALUES (1)",
  );
  await pool.execute(`CREATE TABLE IF NOT EXISTS checkout_reservations (
    order_id CHAR(36) NOT NULL, product_id BIGINT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NOT NULL, expires_at DATETIME(3) NOT NULL,
    state VARCHAR(20) NOT NULL DEFAULT 'active',
    PRIMARY KEY (order_id,product_id), INDEX (product_id,state,expires_at)) ENGINE=InnoDB`);
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS checkout_fulfilment (order_id CHAR(36) PRIMARY KEY,status VARCHAR(40) NOT NULL,updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB`,
  );
  await pool.execute(
    `CREATE TABLE IF NOT EXISTS checkout_order_events (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,order_id CHAR(36) NOT NULL,action VARCHAR(40) NOT NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,INDEX(order_id)) ENGINE=InnoDB`,
  );
}
export function checkoutRoutes(app, pool) {
  const attempts = new Map();
  app.post("/api/checkout", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    try {
      const now = Date.now();
      for (const [key, value] of attempts)
        if (now - value.start > 60000) attempts.delete(key);
      const rate = attempts.get(req.ip) || { start: now, count: 0 };
      rate.count++;
      attempts.set(req.ip, rate);
      if (rate.count > 20)
        return res
          .status(429)
          .json({ error: "Too many attempts. Please wait a minute." });
      const b = req.body;
      const fail = (message) => {
        const e = new Error(message);
        e.status = 400;
        throw e;
      };
      if (!b || !/^[a-f0-9-]{36}$/i.test(b.requestId || ""))
        fail("Invalid checkout request.");
      if (!Array.isArray(b.items) || !b.items.length || b.items.length > 100)
        fail("Your cart must contain 1–100 records.");
      const ids = new Set();
      for (const item of b.items) {
        if (
          !Number.isSafeInteger(item.id) ||
          item.id <= 0 ||
          !Number.isSafeInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 100 ||
          ids.has(item.id)
        )
          fail("Invalid cart quantities.");
        ids.add(item.id);
      }
      const text = (key, max) => {
        const v = b[key];
        if (typeof v !== "string" || !v.trim() || v.trim().length > max)
          fail(`Please enter a valid ${key}.`);
        return v.trim();
      };
      const name = text("name", 120),
        contact = text("contact", 120);
      if (!["collection", "delivery"].includes(b.fulfilment))
        fail("Choose collection or delivery.");
      const address = b.fulfilment === "delivery" ? text("address", 500) : "";
      const postal = b.fulfilment === "delivery" ? text("postal", 6) : "";
      if (postal && !/^\d{6}$/.test(postal))
        fail("Enter a six-digit Singapore postal code.");
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify({
            items: b.items,
            name,
            contact,
            fulfilment: b.fulfilment,
            address,
            postal,
          }),
        )
        .digest("hex");
      await transaction(pool, async (db) => {
        const [existing] = await db.execute(
          "SELECT * FROM checkout_orders WHERE id = ?",
          [b.requestId],
        );
        if (existing.length) {
          if (existing[0].fingerprint !== fingerprint) {
            const e = new Error(
              "This request was already used. Start a fresh checkout.",
            );
            e.status = 409;
            throw e;
          }
          return await orderResponse(db, existing[0]);
        }
        const [stock] = await db.execute(
          `SELECT id,title,artist,price,stock FROM stock WHERE id IN (${b.items.map(() => "?").join(",")}) ORDER BY id FOR UPDATE`,
          b.items.map((i) => i.id),
        );
        for (const product of stock)
          product.stock = await availableStock(db, product);
        const lines = b.items.map((item) => {
          const p = stock.find((p) => Number(p.id) === item.id);
          if (!p || Number(p.stock) < item.quantity)
            fail("Stock changed. Return to your cart and refresh.");
          const price = Math.round(Number(p.price) * 100);
          if (p.price === null || !Number.isSafeInteger(price) || price < 0)
            fail("A record price is unavailable.");
          return {
            id: item.id,
            title: p.title,
            artist: p.artist,
            quantity: item.quantity,
            price,
          };
        });
        const subtotal = lines.reduce(
            (sum, i) => sum + i.price * i.quantity,
            0,
          ),
          delivery = b.fulfilment === "delivery" ? 450 : 0,
          total = subtotal + delivery;
        if (!Number.isSafeInteger(total) || total <= 0 || total > 20000000)
          fail(
            "This order amount cannot be paid online. Please contact the shop.",
          );
        // Idempotent order creation and reservation share one transaction.
        const reference =
          "KR" + b.requestId.replaceAll("-", "").slice(0, 20).toUpperCase();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        const order = {
          reference,
          items: lines,
          subtotal,
          delivery,
          total,
          name,
          contact,
          fulfilment: b.fulfilment,
          address,
          postal,
          expiresAt,
          status: "awaiting_payment_confirmation",
        };
        await db.execute(
          "INSERT INTO checkout_orders (id,fingerprint,details) VALUES (?,?,?)",
          [b.requestId, fingerprint, JSON.stringify(order)],
        );
        for (const line of lines)
          await db.execute(
            "INSERT INTO checkout_reservations (order_id,product_id,quantity,expires_at) VALUES (?,?,?,?)",
            [b.requestId, line.id, line.quantity, new Date(expiresAt)],
          );
        // Build the response before commit, but send only after the transaction commits.
        return await orderResponse(db, {
          id: b.requestId,
          status: order.status,
          details: order,
        });
      }).then((result) => {
        if (!res.headersSent) res.json(result);
      });
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: e.message });
      next(e);
    }
  });
  app.get("/api/checkout/:id", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    try {
      const result = await transaction(pool, async (db) => {
        const [rows] = await db.execute(
          "SELECT * FROM checkout_orders WHERE id = ?",
          [req.params.id],
        );
        if (!rows.length) {
          const e = new Error("Order not found.");
          e.status = 404;
          throw e;
        }
        return orderResponse(db, rows[0]);
      });
      res.json(result);
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: e.message });
      next(e);
    }
  });
  app.post("/api/checkout/:id/payment-reported", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    try {
      const result = await transaction(pool, async (db) => {
        const [rows] = await db.execute(
          "SELECT * FROM checkout_orders WHERE id = ?",
          [req.params.id],
        );
        if (!rows.length) {
          const e = new Error("Order not found.");
          e.status = 404;
          throw e;
        }
        const current = await orderResponse(db, rows[0]);
        if (current.status === "payment_reported") return current;
        if (current.status !== "awaiting_payment_confirmation") {
          const e = new Error(
            "This hold is no longer active. If you paid, contact us with your reference. Do not pay again.",
          );
          e.status = 409;
          throw e;
        }
        await db.execute(
          "UPDATE checkout_reservations SET state = 'reported' WHERE order_id = ? AND state = 'active'",
          [req.params.id],
        );
        await db.execute(
          "UPDATE checkout_orders SET status = 'payment_reported' WHERE id = ?",
          [req.params.id],
        );
        return { ...current, status: "payment_reported", qr: null };
      });
      res.json(result);
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: e.message });
      next(e);
    }
  });
}

export async function transaction(pool, fn) {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    await db.execute(
      "SELECT id FROM checkout_reservation_lock WHERE id = 1 FOR UPDATE",
    );
    const result = await fn(db);
    await db.commit();
    return result;
  } catch (e) {
    await db.rollback();
    throw e;
  } finally {
    db.release();
  }
}
export async function availableStock(db, product) {
  const [rows] = await db.execute(
    "SELECT COALESCE(SUM(quantity),0) AS held FROM checkout_reservations WHERE product_id = ? AND (state = 'reported' OR (state = 'active' AND expires_at > NOW(3)))",
    [product.id],
  );
  return Math.max(0, Number(product.stock) - Number(rows[0].held));
}
export async function orderResponse(db, row) {
  const order =
    typeof row.details === "string" ? JSON.parse(row.details) : row.details;
  let status = row.status;
  // Legacy orders have no holds: do not offer another payable QR for them.
  if (
    status === "awaiting_payment_confirmation" &&
    (!order.expiresAt || Date.parse(order.expiresAt) <= Date.now())
  ) {
    status = "expired";
    await db.execute(
      "UPDATE checkout_orders SET status = 'expired' WHERE id = ? AND status = 'awaiting_payment_confirmation'",
      [row.id],
    );
  }
  const { name, contact, address, postal, ...publicOrder } = order;
  return {
    ...publicOrder,
    status,
    serverTime: new Date().toISOString(),
    qr:
      status === "awaiting_payment_confirmation"
        ? await QRCode.toDataURL(paynowPayload(order.total, order.reference), {
            width: 480,
            margin: 4,
            errorCorrectionLevel: "M",
          })
        : null,
  };
}

export async function expireOrders(pool) {
  await transaction(pool, (db) =>
    db.execute(
      "UPDATE checkout_orders o SET o.status = 'expired' WHERE o.status = 'awaiting_payment_confirmation' AND EXISTS (SELECT 1 FROM checkout_reservations r WHERE r.order_id = o.id AND r.state = 'active' AND r.expires_at <= NOW(3))",
    ),
  );
}

export async function manageOrder(pool, action, reference) {
  return transaction(pool, async (db) => {
    const [rows] = await db.execute(
      "SELECT * FROM checkout_orders WHERE JSON_UNQUOTE(JSON_EXTRACT(details,'$.reference')) = ?",
      [reference],
    );
    if (rows.length !== 1) throw Error("A unique order was not found.");
    const row = rows[0];
    const details =
      typeof row.details === "string" ? JSON.parse(row.details) : row.details;
    const [holds] = await db.execute(
      "SELECT * FROM checkout_reservations WHERE order_id = ? ORDER BY product_id",
      [row.id],
    );
    if (action === "paid") {
      if (row.status === "paid")
        return "Already paid: no additional stock deducted.";
      if (row.status !== "payment_reported")
        throw Error(
          "Only payment_reported orders can be marked paid. Expired/legacy orders need manual stock reconciliation; do not force them through.",
        );
      if (!holds.length || holds.some((h) => h.state !== "reported"))
        throw Error(
          "Active reported holds are missing; investigate before marking paid.",
        );
      for (const hold of holds) {
        const [result] = await db.execute(
          "UPDATE stock SET stock = stock - ? WHERE id = ? AND stock >= ?",
          [hold.quantity, hold.product_id, hold.quantity],
        );
        if (result.affectedRows !== 1)
          throw Error(
            "Physical stock changed. No changes were saved; reconcile the order manually.",
          );
      }
      await db.execute(
        "UPDATE checkout_reservations SET state = 'committed' WHERE order_id = ?",
        [row.id],
      );
      await db.execute(
        "UPDATE checkout_orders SET status = 'paid' WHERE id = ?",
        [row.id],
      );
      await db.execute(
        "INSERT INTO checkout_order_events (order_id,action) VALUES (?,?)",
        [row.id, "paid"],
      );
      return `Marked ${details.reference} paid and deducted stock once.`;
    }
    if (row.status === "paid")
      throw Error(
        "Paid orders require a separate refund/return workflow. Cancellation refused.",
      );
    await db.execute(
      "UPDATE checkout_reservations SET state = 'released' WHERE order_id = ?",
      [row.id],
    );
    await db.execute(
      "UPDATE checkout_orders SET status = 'cancelled' WHERE id = ?",
      [row.id],
    );
    if (row.status !== "cancelled")
      await db.execute(
        "INSERT INTO checkout_order_events (order_id,action) VALUES (?,?)",
        [row.id, "cancelled"],
      );
    return `Cancelled ${details.reference}; holds released. Verify bank receipts before cancelling payment-reported orders.`;
  });
}
