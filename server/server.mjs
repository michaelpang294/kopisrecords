import { loadRuntimeEnv, databasePool, databaseSessions, prepareSchema, assertProductionSettings } from "./runtime.mjs";
import { expireOrders } from "./checkout.mjs";
import { createApp } from "./app.mjs";

loadRuntimeEnv();
let pool;
try {
  assertProductionSettings();
  pool = databasePool();
  await prepareSchema(pool);
  await expireOrders(pool);
} catch (error) {
  console.error("Database/configuration startup failed:", error.code || error.message);
  if (pool) await pool.end();
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
  sessionStore: databaseSessions(pool),
});
const cronMode = process.env.BACKGROUND_MODE === "cron";
const expiryTimer = cronMode ? null : setInterval(
  () =>
    expireOrders(pool).catch((error) =>
      console.error("Order expiry update failed:", error.code ?? error.message),
    ),
  30000,
);
expiryTimer?.unref();
app.locals.orderEmails.kick();
app.locals.restockAlerts.kick();
app.locals.preorderEmails.kick();
const emailTimer = cronMode ? null : setInterval(() => {
  app.locals.orderEmails.kick();
  app.locals.restockAlerts.kick();
  app.locals.preorderEmails.kick();
}, 30000);
emailTimer?.unref();
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
      await app.locals.restockAlerts.stop();
      await app.locals.preorderEmails.stop();
      await pool.end();
      process.exit(0);
    }),
  );
}
