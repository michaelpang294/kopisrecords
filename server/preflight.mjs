import { loadRuntimeEnv, databasePool, prepareSchema } from "./runtime.mjs";
import { createGmailSender } from "./gmail.mjs";
loadRuntimeEnv();
let pool;
try {
  if (Number(process.versions.node.split('.')[0]) < 22) throw Error("Use Node.js 22 or newer.");
  if (process.env.NODE_ENV !== "production") throw Error("Set NODE_ENV=production in the backend .env.");
  if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(process.env.ADMIN_PASSWORD_HASH || ""))
    throw Error("Copy ADMIN_PASSWORD_HASH from your working local server/.env.");
  const expected = "https://kopisrecords.shop";
  if (process.env.ORDER_SITE_URL !== expected) throw Error(`Set ORDER_SITE_URL=${expected}.`);
  if (process.env.PUBLIC_API_URL !== expected + "/api") throw Error(`Set PUBLIC_API_URL=${expected}/api.`);
  if (!(process.env.FRONTEND_ORIGINS || "").split(',').includes(expected)) throw Error("Add the HTTPS website origin to FRONTEND_ORIGINS.");
  pool = databasePool();
  await prepareSchema(pool);
  const [timezone] = await pool.execute("SELECT @@session.time_zone AS zone");
  if (timezone[0].zone !== "+00:00") throw Error("The database connection timezone must be UTC.");
  const [rows] = await pool.execute("SELECT COUNT(*) AS total FROM stock");
  console.log("Database and required tables ready; existing stock rows:", Number(rows[0].total));
  const [local] = await pool.execute("SELECT COUNT(*) AS total FROM stock WHERE cover_image REGEXP '^https?://(localhost|127[.]0[.]0[.]1)(:[0-9]+)?/'");
  if (Number(local[0].total)) console.log("Local cover URLs found:", Number(local[0].total), "— ensure the matching files exist in the backend covers folder.");
  const mailer = createGmailSender();
  if (!mailer.ready) throw Error("Set GMAIL_APP_PASSWORD in the private backend .env.");
  await mailer.verify();
  console.log("Gmail SMTP authentication verified; no email was sent.");
  console.log("Production checks passed. Restart the cPanel Node.js app and configure the five-minute cron job.");
} catch (error) {
  console.error("Production check failed:", error.code || error.message);
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
