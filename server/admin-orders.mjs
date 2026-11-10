import { orderPreorders, assertPreordersReady } from "./preorders.mjs";
import { expireOrders, manageOrder, transaction } from "./checkout.mjs";
import { queueOrderEmails } from "./order-emails.mjs";
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
export function adminOrderRoutes(app, pool, requireAdmin, orderEmails) {
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
        where += `
          AND (
            JSON_UNQUOTE(JSON_EXTRACT(o.details, '$.reference')) LIKE ?
            OR JSON_UNQUOTE(JSON_EXTRACT(o.details, '$.name')) LIKE ?
            OR JSON_UNQUOTE(JSON_EXTRACT(o.details, '$.contact')) LIKE ?
            OR JSON_UNQUOTE(JSON_EXTRACT(o.details, '$.email')) LIKE ?
            OR JSON_UNQUOTE(JSON_EXTRACT(o.details, '$.telegram')) LIKE ?
            OR JSON_UNQUOTE(JSON_EXTRACT(o.details, '$.collectionNumber')) LIKE ?
            OR EXISTS (
              SELECT 1
              FROM JSON_TABLE(
                o.details,
                '$.items[*]' COLUMNS (
                  title VARCHAR(500) PATH '$.title',
                  artist VARCHAR(500) PATH '$.artist' NULL ON EMPTY
                )
              ) AS ordered_item
              WHERE LOWER(ordered_item.title) LIKE ?
                OR LOWER(ordered_item.artist) LIKE ?
            )
          )
        `;

        args.push(
          ...Array(6).fill("%" + q + "%"),
          ...Array(2).fill("%" + q.toLowerCase() + "%"),
        );
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
      const [emails] = await pool.execute(
        "SELECT kind,status,attempts,last_error,sent_at FROM checkout_emails WHERE order_id = ? ORDER BY created_at,kind",
        [req.params.id],
      );
      res.json({ ...serialize(rows[0]), holds, events, emails, preorders: await orderPreorders(pool, req.params.id) });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/admin/orders/:id/emails/retry", async (req, res) => {
    await pool.execute(
      "UPDATE checkout_emails SET status = 'pending',attempts = 0,next_attempt_at = NOW(3) WHERE order_id = ? AND status = 'failed'",
      [req.params.id],
    );
    orderEmails?.kick();
    res.json({
      message:
        "Failed emails queued for retry. Payment and stock are unchanged.",
    });
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
        return res.status(400).json({
          error: "Check your bank receipt before confirming payment.",
        });
      const collectionNumber = req.body.collectionNumber;
      if (
        action === "ready_for_collection" &&
        (!Number.isSafeInteger(collectionNumber) ||
          collectionNumber < 1 ||
          collectionNumber > 999999)
      )
        return res.status(400).json({
          error: "Enter a collection / bag number from 1 to 999999.",
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
        if (action === "paid") orderEmails?.kick();
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
        if (row.status === action) {
          if (
            action === "ready_for_collection" &&
            order.collectionNumber !== collectionNumber
          )
            throw Error(
              "This order already has a collection number. Refresh and check the saved bag number before proceeding.",
            );
          return "Order already updated. No extra email queued.";
        }
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
        if (["ready_for_collection", "dispatched"].includes(action))
          await assertPreordersReady(db, req.params.id);
        if (action === "ready_for_collection") {
          // The shared reservation lock serializes assignments across admins.
          // Completed orders retain their number, but it can then be reused.
          const [used] = await db.execute(
            "SELECT o.id FROM checkout_orders o INNER JOIN checkout_fulfilment f ON f.order_id=o.id WHERE o.id<>? AND o.status='paid' AND f.status='ready_for_collection' AND JSON_UNQUOTE(JSON_EXTRACT(o.details,'$.collectionNumber')) = ? LIMIT 1",
            [req.params.id, String(collectionNumber)],
          );
          if (used.length)
            throw Error(
              "That bag number is already in use by an order awaiting collection. Choose another number.",
            );
          const details =
            typeof row.details === "string"
              ? JSON.parse(row.details)
              : row.details;
          await db.execute(
            "UPDATE checkout_orders SET details = ? WHERE id = ?",
            [JSON.stringify({ ...details, collectionNumber }), req.params.id],
          );
        }
        await db.execute(
          "INSERT INTO checkout_fulfilment (order_id,status) VALUES (?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),updated_at=CURRENT_TIMESTAMP",
          [req.params.id, action],
        );
        await db.execute(
          "INSERT INTO checkout_order_events (order_id,action) VALUES (?,?)",
          [req.params.id, action],
        );
        if (["ready_for_collection", "dispatched", "completed"].includes(action))
          await queueOrderEmails(db, req.params.id, action);
        return action === "ready_for_collection"
          ? `Ready for collection · bag #${collectionNumber}. Customer email queued.`
          : action === "completed"
            ? "Order completed. Customer thank-you email queued."
            : "Dispatched. Customer delivery email queued.";
      });
      if (["ready_for_collection", "dispatched", "completed"].includes(action))
        orderEmails?.kick();
      res.json({ message });
    } catch (e) {
      if (!e.code) return res.status(409).json({ error: e.message });
      next(e);
    }
  });
}
