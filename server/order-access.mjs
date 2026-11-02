import { createHash, randomBytes } from "node:crypto";
const tokenPattern = /^[a-f0-9]{64}$/;
const hash = (token) => createHash("sha256").update(token).digest("hex");
export async function grantRecovery(
  db,
  orderId,
  token = randomBytes(32).toString("hex"),
) {
  if (!tokenPattern.test(token || "")) {
    const e = new Error("Invalid recovery token.");
    e.status = 400;
    throw e;
  }
  const digest = hash(token);
  const [existing] = await db.execute(
    "SELECT order_id FROM checkout_order_recovery WHERE token_hash = ?",
    [digest],
  );
  if (existing.length && existing[0].order_id !== orderId) {
    const e = new Error(
      "Recovery token is already used. Start a fresh checkout.",
    );
    e.status = 409;
    throw e;
  }
  if (!existing.length)
    await db.execute(
      "INSERT INTO checkout_order_recovery (token_hash,order_id) VALUES (?,?)",
      [digest, orderId],
    );
  return token;
}
export function recoveryRoutes(
  app,
  pool,
  { transaction, orderResponse, requireAdmin },
) {
  const reads = new Map();
  const limitReads = (req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "no-referrer");
    const now = Date.now();
    for (const [key, v] of reads) if (now - v.start > 60000) reads.delete(key);
    const limit = reads.get(req.ip) || { start: now, count: 0 };
    limit.count++;
    reads.set(req.ip, limit);
    if (limit.count > 90)
      return res
        .status(429)
        .json({ error: "Too many requests. Please wait a minute." });
    next();
  };
  app.use("/api/order-recovery", limitReads);
  app.use("/api/checkout/:id", limitReads);
  async function find(db, req) {
    const token = req.get("Authorization")?.replace(/^Bearer /, "");
    if (!tokenPattern.test(token || "")) {
      const e = new Error("Order link not found.");
      e.status = 404;
      throw e;
    }
    const [access] = await db.execute(
      "SELECT order_id FROM checkout_order_recovery WHERE token_hash = ?",
      [hash(token)],
    );
    if (!access.length) {
      const e = new Error("Order link not found.");
      e.status = 404;
      throw e;
    }
    const [rows] = await db.execute(
      "SELECT * FROM checkout_orders WHERE id = ?",
      [access[0].order_id],
    );
    if (!rows.length) {
      const e = new Error("Order link not found.");
      e.status = 404;
      throw e;
    }
    return rows[0];
  }
  async function receipt(db, row) {
    const result = await orderResponse(db, row);
    const [fulfilment] = await db.execute(
      "SELECT status FROM checkout_fulfilment WHERE order_id = ?",
      [row.id],
    );
    if (
      result.status === "paid" &&
      ["ready_for_collection", "dispatched", "completed"].includes(
        fulfilment[0]?.status,
      )
    )
      result.status = fulfilment[0].status;
    return result;
  }
  function failure(res, next, e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
  app.get("/api/order-recovery", async (req, res, next) => {
    try {
      res.json(
        await transaction(pool, async (db) => receipt(db, await find(db, req))),
      );
    } catch (e) {
      failure(res, next, e);
    }
  });
  app.post("/api/order-recovery/payment-reported", async (req, res, next) => {
    try {
      const result = await transaction(pool, async (db) => {
        const row = await find(db, req),
          current = await receipt(db, row);
        if (
          [
            "payment_reported",
            "paid",
            "ready_for_collection",
            "dispatched",
            "completed",
          ].includes(current.status)
        )
          return current;
        if (current.status !== "awaiting_payment_confirmation") {
          const e = new Error(
            "This hold has ended. If you already paid, contact us with your reference. Do not pay again.",
          );
          e.status = 409;
          throw e;
        }
        await db.execute(
          "UPDATE checkout_reservations SET state = 'reported' WHERE order_id = ? AND state = 'active'",
          [row.id],
        );
        await db.execute(
          "UPDATE checkout_orders SET status = 'payment_reported' WHERE id = ?",
          [row.id],
        );
        return { ...current, status: "payment_reported", qr: null };
      });
      res.json(result);
    } catch (e) {
      failure(res, next, e);
    }
  });
  // The existing private UUID is a bearer credential for an older active checkout.
  app.post("/api/checkout/:id/recovery", async (req, res, next) => {
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
        return {
          recoveryToken: await grantRecovery(
            db,
            rows[0].id,
            req.body?.recoveryToken,
          ),
        };
      });
      res.json(result);
    } catch (e) {
      failure(res, next, e);
    }
  });
  app.post(
    "/api/admin/orders/:id/recovery",
    requireAdmin,
    async (req, res, next) => {
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
          return { recoveryToken: await grantRecovery(db, rows[0].id) };
        });
        res.json(result);
      } catch (e) {
        failure(res, next, e);
      }
    },
  );
}
