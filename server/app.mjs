import { createOrderEmailDispatcher } from "./order-emails.mjs";
import { createRestockDispatcher, restockAlertRoutes } from "./restock-alerts.mjs";
import { adminRequestRoutes } from "./admin-requests.mjs";
import { recordRequestRoutes } from "./record-requests.mjs";
import { recoveryRoutes, grantRecovery } from "./order-access.mjs";
import { installAdminAuth } from "./admin-auth.mjs";
import { adminOrderRoutes } from "./admin-orders.mjs";
import {
  availableStock,
  checkoutRoutes,
  transaction,
  orderResponse,
} from "./checkout.mjs";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "node:url";

// These names match the Product type and forms in your existing React src/.
const columns = [
  "title",
  "artist",
  "price",
  "genre",
  "cover_image",
  "description",
  "medium",
  "variant",
  "released",
  "barcode",
  "stock",
  "tags",
];
const textLimits = {
  title: 255,
  artist: 255,
  genre: 255,
  cover_image: 2048,
  description: 10000,
  medium: 30,
  variant: 255,
  released: 30,
  barcode: 100,
};
const allowedMethods = new Set(["GET", "POST", "PUT", "DELETE", "OPTIONS"]);

const allowedTags = new Set([
  "preorder",
  "new_arrival",
  "recommended",
  "bestseller",
  "record_of_the_week",
  "sale",
]);
function readTags(value) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}
function productForJson(row, publicApiUrl) {
  // MySQL DECIMAL stays exact in storage; React's Product type expects a number.
  let cover = row.cover_image;
  // Local cover files use the hosted API after deployment; remote art is preserved.
  if (publicApiUrl && typeof cover === "string") {
    const match = cover.match(
      /^(?:https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?)?\/(?:api\/)?covers\/(.+)$/,
    );
    if (match) cover = `${publicApiUrl.replace(/\/$/, "")}/covers/${match[1]}`;
  }
  return {
    ...row,
    cover_image: cover,
    price: Number(row.price),
    tags: readTags(row.tags) ?? [],
  };
}

function validateProduct(body, creating = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Send a JSON object containing the product fields.");
  }

  const product = {};
  for (const [field, limit] of Object.entries(textLimits)) {
    const value = body[field] ?? (field === "medium" ? "Vinyl" : "");
    if (typeof value !== "string" || value.length > limit) {
      throw new Error(
        `${field} must be text with at most ${limit} characters.`,
      );
    }
    product[field] = value.trim();
  }
  if (!product.title || !product.artist) {
    throw new Error("Title and artist are required.");
  }
  if (!["Vinyl", "CD"].includes(product.medium)) {
    throw new Error("Medium must be Vinyl or CD.");
  }

  // The edit form sends numeric values as strings, so accept both forms.
  const priceText = String(body.price ?? "").trim();
  const stockText = String(body.stock ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(priceText) || Number(priceText) > 99999999.99) {
    throw new Error(
      "Price must be a nonnegative amount with at most 2 decimal places.",
    );
  }
  if (!/^\d+$/.test(stockText) || Number(stockText) > 4294967295) {
    throw new Error(
      "Stock must be a nonnegative whole number up to 4294967295.",
    );
  }
  product.price = priceText;
  product.stock = Number(stockText);
  if (creating || body.tags !== undefined) {
    let tags = body.tags === undefined ? [] : readTags(body.tags);
    if (
      !Array.isArray(tags) ||
      tags.length > 20 ||
      tags.some((tag) => typeof tag !== "string" || !allowedTags.has(tag))
    ) {
      throw new Error("Tags must be an array of supported record tags.");
    }
    tags = [...new Set(tags)];
    if (creating && !tags.includes("new_arrival")) tags.unshift("new_arrival");
    product.tags = JSON.stringify(tags);
  }
  return product;
}

function readId(value) {
  if (!/^[1-9]\d*$/.test(value) || Number(value) > 4294967295) return null;
  return Number(value);
}

function stockNumber(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 4294967295;
}
async function guardStock(db, id, expectedStock, nextStock) {
  const [rows] = await db.execute(
    "SELECT * FROM stock WHERE id = ? FOR UPDATE",
    [id],
  );
  if (!rows.length) {
    const error = new Error("Product not found.");
    error.status = 404;
    throw error;
  }
  const product = rows[0];
  if (Number(product.stock) !== expectedStock) {
    const error = new Error(
      `Stock changed from ${expectedStock} to ${product.stock}. Refresh the record before saving so paid orders are not overwritten.`,
    );
    error.status = 409;
    throw error;
  }
  const [held] = await db.execute(
    "SELECT COALESCE(SUM(quantity),0) AS held FROM checkout_reservations WHERE product_id = ? AND (state = 'reported' OR (state = 'active' AND expires_at > NOW(3)))",
    [id],
  );
  if (nextStock < Number(held[0].held)) {
    const error = new Error(
      `There are ${held[0].held} reserved copies. Review or cancel their orders before reducing stock below that number.`,
    );
    error.status = 409;
    throw error;
  }
  return product;
}

export function createApp(pool, origins, options = {}) {
  const app = express();
  app.disable("x-powered-by");
  if (options.passengerMount) {
    // Passenger installations can forward either the full URL or the path
    // relative to PassengerBaseURI. Keep the existing /api route contract.
    app.use((req, res, next) => {
      const mount = options.passengerMount;
      if (
        req.url !== mount &&
        !req.url.startsWith(mount + "/") &&
        !req.url.startsWith(mount + "?")
      ) {
        req.url = mount + (req.url.startsWith("/") ? req.url : "/" + req.url);
      }
      next();
    });
  }

  // Reject foreign browser origins before writes can reach the database.
  app.use((req, res, next) => {
    const origin = req.get("Origin");
    if (origin && !origins.includes(origin)) {
      return res.status(403).json({
        error:
          "Frontend origin is not allowed. Check FRONTEND_ORIGINS in .env.",
      });
    }
    if (!allowedMethods.has(req.method)) {
      return res.status(405).json({ error: "Method not allowed." });
    }
    next();
  });
  app.use(
    cors({ origin: origins, credentials: true, methods: [...allowedMethods] }),
  );
  app.use(express.json({ limit: "64kb" }));

  // Bundled local placeholders keep the sample product images working offline.
  const coversPath = fileURLToPath(new URL("./covers/", import.meta.url));
  app.use("/covers", express.static(coversPath));
  app.use("/api/covers", express.static(coversPath));

  recordRequestRoutes(app, pool, options.requestMailer);

  const orderEmails = createOrderEmailDispatcher(pool, {
    mailer: options.orderMailer,
    siteUrl: options.orderSiteUrl,
    issueLink: (id) => grantRecovery(pool, id),
  });
  app.locals.orderEmails = orderEmails;
  const requireAdmin = installAdminAuth(app, options);
  const restockAlerts = createRestockDispatcher(pool, {
    transaction,
    availableStock,
    mailer: options.restockMailer,
    siteUrl: options.orderSiteUrl,
    requireConfirmation: options.restockRequireConfirmation,
  });
  app.locals.restockAlerts = restockAlerts;
  restockAlertRoutes(app, pool, { transaction, availableStock, dispatcher: restockAlerts, requireAdmin });
  adminOrderRoutes(app, pool, requireAdmin, orderEmails);
  adminRequestRoutes(app, pool, requireAdmin);
  recoveryRoutes(app, pool, {
    transaction,
    orderResponse,
    requireAdmin,
    orderEmails,
  });
  checkoutRoutes(app, pool, orderEmails);

  app.get("/api/health", async (req, res) => {
    await pool.execute("SELECT 1 AS ok");
    res.json({ status: "ok", database: "connected" });
  });

  app.get(
    "/api/stock",
    (req, res, next) =>
      req.query.inventory === "on-hand" ? requireAdmin(req, res, next) : next(),
    async (req, res) => {
      const [rows] = await pool.execute("SELECT * FROM stock ORDER BY id DESC");
      if (req.query.inventory !== "on-hand")
        for (const row of rows) row.stock = await availableStock(pool, row);
      res.json(rows.map((row) => productForJson(row, options.publicApiUrl)));
    },
  );

  app.get(
    "/api/stock/:id",
    (req, res, next) =>
      req.query.inventory === "on-hand" ? requireAdmin(req, res, next) : next(),
    async (req, res) => {
      const id = readId(req.params.id);
      if (id === null)
        return res.status(400).json({ error: "Invalid product ID." });
      const [rows] = await pool.execute("SELECT * FROM stock WHERE id = ?", [
        id,
      ]);
      if (!rows.length)
        return res.status(404).json({ error: "Product not found." });
      if (req.query.inventory !== "on-hand")
        rows[0].stock = await availableStock(pool, rows[0]);
      res.json(productForJson(rows[0], options.publicApiUrl));
    },
  );

  app.post("/api/stock", requireAdmin, async (req, res) => {
    let product;
    try {
      product = validateProduct(req.body, true);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    const fields = columns.map((column) => `\`${column}\``).join(", ");
    const placeholders = columns.map(() => "?").join(", ");
    const [result] = await pool.execute(
      `INSERT INTO stock (${fields}) VALUES (${placeholders})`,
      columns.map((column) => product[column]),
    );
    res.status(201).json(productForJson({ id: result.insertId, ...product }));
  });

  app.post("/api/admin/stock/:id", requireAdmin, async (req, res, next) => {
    const id = readId(req.params.id);
    if (
      id === null ||
      !stockNumber(req.body?.stock) ||
      !stockNumber(req.body?.expectedStock)
    )
      return res.status(400).json({
        error: "Enter a valid stock quantity and original stock count.",
      });
    try {
      const saved = await transaction(pool, async (db) => {
        const product = await guardStock(
          db,
          id,
          req.body.expectedStock,
          req.body.stock,
        );
        await db.execute("UPDATE stock SET stock = ? WHERE id = ?", [
          req.body.stock,
          id,
        ]);
        return productForJson({ ...product, stock: req.body.stock });
      });
      restockAlerts.kick();
      res.json(saved);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/stock/:id", requireAdmin, async (req, res) => {
    const id = readId(req.params.id);
    if (id === null)
      return res.status(400).json({ error: "Invalid product ID." });
    let product;
    try {
      product = validateProduct(req.body);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    if (
      req.body.expectedStock !== undefined &&
      !stockNumber(req.body.expectedStock)
    )
      return res.status(400).json({ error: "Invalid original stock count." });
    const save = async (db) => {
      if (req.body.expectedStock !== undefined)
        await guardStock(db, id, req.body.expectedStock, product.stock);
      const updateColumns = columns.filter(
        (column) => column !== "tags" || product.tags !== undefined,
      );
      const fields = updateColumns
        .map((column) => `\`${column}\` = ?`)
        .join(", ");
      const [result] = await db.execute(
        `UPDATE stock SET ${fields} WHERE id = ?`,
        [...updateColumns.map((column) => product[column]), id],
      );
      // MySQL reports matched rows with FOUND_ROWS (mysql2's default), including
      // an unchanged update, so saving the same values remains successful.
      if (!result.affectedRows) {
        const error = new Error("Product not found.");
        error.status = 404;
        throw error;
      }
      const [savedRows] = await db.execute("SELECT * FROM stock WHERE id = ?", [
        id,
      ]);
      if (!savedRows.length) {
        const error = new Error("Product not found.");
        error.status = 404;
        throw error;
      }
      return productForJson(savedRows[0]);
    };
    const saved =
      req.body.expectedStock === undefined
        ? await save(pool)
        : await transaction(pool, save);
    restockAlerts.kick();
    res.json(saved);
  });

  app.delete("/api/stock/:id", requireAdmin, async (req, res) => {
    const id = readId(req.params.id);
    if (id === null)
      return res.status(400).json({ error: "Invalid product ID." });
    const [result] = await pool.execute("DELETE FROM stock WHERE id = ?", [id]);
    if (!result.affectedRows)
      return res.status(404).json({ error: "Product not found." });
    res.json({ message: "Product deleted.", id });
  });

  app.use((req, res) => res.status(404).json({ error: "Route not found." }));
  app.use((error, req, res, next) => {
    if ([400, 404, 409].includes(error.status))
      return res.status(error.status).json({ error: error.message });
    if (error.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Invalid JSON." });
    }
    if (error.type === "entity.too.large") {
      return res.status(413).json({ error: "Request is too large." });
    }
    console.error("API request failed:", error.code ?? error.message);
    res
      .status(500)
      .json({ error: "Database request failed. Check the backend terminal." });
  });
  return app;
}
