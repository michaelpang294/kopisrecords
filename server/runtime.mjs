import { ensurePreorders } from "./preorders.mjs";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import mysql from "mysql2";
import { ensureOrders } from "./checkout.mjs";
import { ensureOrderEmails } from "./order-emails.mjs";
import { ensureRestockAlerts } from "./restock-alerts.mjs";
import { ensureRecordRequests } from "./record-requests.mjs";
import { ensureRestockOptins } from "./restock-optin.mjs";

export function loadRuntimeEnv() {
  const path = fileURLToPath(new URL(".env", import.meta.url));
  if (existsSync(path)) process.loadEnvFile(path);
}
export function assertProductionSettings(env = process.env) {
  if (env.NODE_ENV !== "production") return;
  if (env.ORDER_SITE_URL !== "https://kopisrecords.shop")
    throw Error("Set ORDER_SITE_URL=https://kopisrecords.shop for customer email links.");
  if (env.PUBLIC_API_URL !== "https://kopisrecords.shop/api")
    throw Error("Set PUBLIC_API_URL=https://kopisrecords.shop/api for cover images.");
  if (!(env.FRONTEND_ORIGINS || "").split(",").map((v) => v.trim()).includes("https://kopisrecords.shop"))
    throw Error("Set FRONTEND_ORIGINS to include https://kopisrecords.shop.");
  if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(env.ADMIN_PASSWORD_HASH || ""))
    throw Error("Copy the working ADMIN_PASSWORD_HASH into the private backend .env.");
  if (!env.GMAIL_APP_PASSWORD || /^(?:PASTE_|YOUR_|REPLACE_)/.test(env.GMAIL_APP_PASSWORD))
    throw Error("Copy the Gmail App Password into the private backend .env.");
}
export function databasePool(env = process.env, connectionLimit = 5) {
  for (const key of ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"])
    if (!env[key] || /^(?:PASTE_|YOUR_|REPLACE_)/.test(env[key]))
      throw Error(`Configure ${key} in the private backend .env file.`);
  const raw = mysql.createPool({
    host: env.DB_HOST, port: Number(env.DB_PORT || 3306),
    user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME,
    connectionLimit, waitForConnections: true, charset: "utf8mb4", timezone: "Z",
    connectTimeout: 10000,
  });
  // Queue this before a newly established connection is used. Dates and NOW()
  // then share UTC regardless of the hosting server's local timezone.
  raw.on("connection", (connection) => connection.query("SET time_zone = '+00:00'"));
  return raw.promise();
}
export async function prepareSchema(pool) {
  await pool.execute("SELECT id,title,artist,price,genre,cover_image,description,medium,variant,released,barcode,stock,tags FROM stock LIMIT 1");
  await ensureOrders(pool);
  await ensureOrderEmails(pool);
  await ensurePreorders(pool);
  await ensureRecordRequests(pool);
  await ensureRestockAlerts(pool);
  await ensureRestockOptins(pool);
  await pool.execute(`CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash CHAR(64) PRIMARY KEY, expires_at DATETIME(3) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX(expires_at)
  ) ENGINE=InnoDB`);
}
export function databaseSessions(pool) {
  return {
    async get(key) {
      const [rows] = await pool.execute("SELECT expires_at FROM admin_sessions WHERE token_hash = ?", [key]);
      return rows.length ? +new Date(rows[0].expires_at) : undefined;
    },
    async set(key, expiry) {
      await pool.execute("INSERT INTO admin_sessions (token_hash,expires_at) VALUES (?,?) ON DUPLICATE KEY UPDATE expires_at=VALUES(expires_at)", [key, new Date(expiry)]);
    },
    async delete(key) {
      await pool.execute("DELETE FROM admin_sessions WHERE token_hash = ?", [key]);
    },
    async cleanup() {
      await pool.execute("DELETE FROM admin_sessions WHERE expires_at <= NOW(3)");
    },
  };
}
