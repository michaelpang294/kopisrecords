import { expireOrders, manageOrder, transaction } from "./checkout.mjs";
const statuses = [
  "awaiting_payment_confirmation",
  "payment_reported",
  "paid",
  "ready_for_collection",
  "dispatched",
  "completed",
  "cancelled",
  "expired",
];
const select =
  "SELECT o.id,o.status AS payment_status,o.created_at,o.details,COALESCE(f.status,o.status) AS status,f.updated_at FROM checkout_orders o LEFT JOIN checkout_fulfilment f ON f.order_id=o.id";
function serialize(row) {
  const details =
    typeof row.details === "string" ? JSON.parse(row.details) : row.details;
  return {
    ...details,
    id: row.id,
    status: row.status,
    paymentStatus: row.payment_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export function adminOrderRoutes(app, pool, requireAdmin) {
  app.use("/api/admin/orders", requireAdmin);
  app.get("/api/admin/orders", async (req, res, next) => {
    try {
      await expireOrders(pool);
      const status = String(req.query.status || ""),
        q = String(req.query.q || "")
          .trim()
          .slice(0, 120),
        page = Math.max(1, Math.min(100000, Number(req.query.page) || 1));
      if (status && !statuses.includes(status))
        return res.status(400).json({ error: "Invalid order status." });
      if (!Number.isInteger(page))
        return res.status(400).json({ error: "Invalid page." });
      let where = " WHERE 1=1";
      const args = [];
      if (status) {
        where += " AND COALESCE(f.status,o.status)=?";
        args.push(status);
      }
      if (q) {
        where +=
          " AND (JSON_UNQUOTE(JSON_EXTRACT(o.details,'$.reference')) LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(o.details,'$.name')) LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(o.details,'$.contact')) LIKE ?)";
        args.push(...Array(3).fill("%" + q + "%"));
      }
      const [count] = await pool.execute(
        "SELECT COUNT(*) AS total FROM checkout_orders o LEFT JOIN checkout_fulfilment f ON f.order_id=o.id" +
          where,
        args,
      );
      const [rows] = await pool.execute(
        select +
          where +
          ` ORDER BY o.created_at DESC,o.id DESC LIMIT 30 OFFSET ${(page - 1) * 30}`,
        args,
      );
      res.json({
        orders: rows.map(serialize),
        total: Number(count[0].total),
        page,
        pageSize: 30,
      });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/admin/orders/:id", async (req, res, next) => {
    try {
      await expireOrders(pool);
      const [rows] = await pool.execute(select + " WHERE o.id=?", [
        req.params.id,
      ]);
      if (!rows.length)
        return res.status(404).json({ error: "Order not found." });
      const [holds] = await pool.execute(
        "SELECT product_id,quantity,state,expires_at FROM checkout_reservations WHERE order_id=?",
        [req.params.id],
      );
      const [events] = await pool.execute(
        "SELECT action,created_at FROM checkout_order_events WHERE order_id=? ORDER BY id DESC",
        [req.params.id],
      );
      res.json({ ...serialize(rows[0]), holds, events });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/admin/orders/:id/action", async (req, res, next) => {
    try {
      const action = req.body?.action;
      if (
        ![
          "paid",
          "cancel",
          "ready_for_collection",
          "dispatched",
          "completed",
        ].includes(action)
      )
        return res.status(400).json({ error: "Invalid order action." });
      if (req.body.confirmed !== true)
        return res
          .status(400)
          .json({ error: "Confirm this order action first." });
      if (action === "paid" && req.body.paymentVerified !== true)
        return res
          .status(400)
          .json({
            error: "Check your bank receipt before confirming payment.",
          });
      if (action === "paid" || action === "cancel") {
        const [rows] = await pool.execute(
          "SELECT details FROM checkout_orders WHERE id=?",
          [req.params.id],
        );
        if (!rows.length)
          return res.status(404).json({ error: "Order not found." });
        const details =
          typeof rows[0].details === "string"
            ? JSON.parse(rows[0].details)
            : rows[0].details;
        const message = await manageOrder(pool, action, details.reference);
        return res.json({ message });
      }
      const message = await transaction(pool, async (db) => {
        const [rows] = await db.execute(select + " WHERE o.id=?", [
          req.params.id,
        ]);
        if (!rows.length) throw Error("Order not found.");
        const row = rows[0],
          order = serialize(row);
        if (row.payment_status !== "paid")
          throw Error("Verify payment before arranging fulfilment.");
        if (row.status === action) return "Order already updated.";
        const allowed =
          (action === "ready_for_collection" &&
            order.fulfilment === "collection" &&
            row.status === "paid") ||
          (action === "dispatched" &&
            order.fulfilment === "delivery" &&
            row.status === "paid") ||
          (action === "completed" &&
            ["ready_for_collection", "dispatched"].includes(row.status));
        if (!allowed)
          throw Error(
            "That status change is not allowed for this order. Refresh and review its fulfilment method.",
          );
        await db.execute(
          "INSERT INTO checkout_fulfilment (order_id,status) VALUES (?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),updated_at=CURRENT_TIMESTAMP",
          [req.params.id, action],
        );
        await db.execute(
          "INSERT INTO checkout_order_events (order_id,action) VALUES (?,?)",
          [req.params.id, action],
        );
        return "Order updated.";
      });
      res.json({ message });
    } catch (e) {
      if (!e.code) return res.status(409).json({ error: e.message });
      next(e);
    }
  });
}
