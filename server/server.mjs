import { ensureOrderEmails } from "./order-emails.mjs";
import { ensureRecordRequests } from "./record-requests.mjs";
import { ensureOrders, expireOrders } from "./checkout.mjs";
import mysql from "mysql2/promise";
import { createApp } from "./app.mjs";

for (const key of ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"]) {
  if (!process.env[key]) {
    console.error(
      `Missing ${key}. Copy .env.example to .env and fill in the database settings.`,
    );
    process.exit(1);
  }
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 5,
  waitForConnections: true,
  charset: "utf8mb4",
});

try {
  // Check the actual schema too, so a missing import is caught at startup.
  await pool.execute("SELECT id FROM stock LIMIT 1");
  await ensureOrders(pool);
  await ensureOrderEmails(pool);
  await ensureRecordRequests(pool);
  await expireOrders(pool);
} catch (error) {
  console.error(
    `Database startup failed (${error.code ?? error.message}): ${error.sqlMessage ?? error.message}`,
  );
  console.error(
    "Check that MySQL is running, import database/01-setup.sql, and verify .env.",
  );
  await pool.end();
  process.exit(1);
}

const origins = (
  process.env.FRONTEND_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const port = Number(process.env.API_PORT || 3001);
const passenger = typeof globalThis.PhusionPassenger !== "undefined";
const app = createApp(pool, origins, {
  passengerMount: passenger ? "/api" : undefined,
  publicApiUrl: process.env.PUBLIC_API_URL,
});
const expiryTimer = setInterval(
  () =>
    expireOrders(pool).catch((error) =>
      console.error("Order expiry update failed:", error.code ?? error.message),
    ),
  30000,
);
expiryTimer.unref();
app.locals.orderEmails.kick();
const emailTimer = setInterval(() => app.locals.orderEmails.kick(), 30000);
emailTimer.unref();
// Passenger binds its own socket; local development still uses loopback.
const ready = () => {
  console.log("Kopi's Records API started; database connected.");
};
const server = passenger
  ? app.listen("passenger", ready)
  : app.listen(port, process.env.API_HOST || "127.0.0.1", ready);
server.on("error", async (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `Port ${port} is in use. Stop the other backend before starting this one.`
      : error.message,
  );
  await pool.end();
  process.exit(1);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () =>
    server.close(async () => {
      clearInterval(expiryTimer);
      clearInterval(emailTimer);
      await app.locals.orderEmails.stop();
      await pool.end();
      process.exit(0);
    }),
  );
}
