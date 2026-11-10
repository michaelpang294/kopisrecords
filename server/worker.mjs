import { createPreorderDispatcher } from "./preorders.mjs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { loadRuntimeEnv, databasePool, databaseSessions, assertProductionSettings } from "./runtime.mjs";
import { expireOrders, transaction, availableStock } from "./checkout.mjs";
import { createOrderEmailDispatcher } from "./order-emails.mjs";
import { createRestockDispatcher } from "./restock-alerts.mjs";
import { grantRecovery } from "./order-access.mjs";

export async function runJobs(pool, { databaseName, orderMailer, restockMailer, preorderMailer, siteUrl } = {}) {
  const lockName = "kopis-jobs-" + createHash("sha256").update(databaseName || process.env.DB_NAME || "shop").digest("hex").slice(0, 32);
  const lock = await pool.getConnection();
  let acquired = false, orders, restock, preorders;
  try {
    const [rows] = await lock.execute("SELECT GET_LOCK(?,0) AS acquired", [lockName]);
    if (rows[0]?.acquired === null || rows[0]?.acquired === undefined)
      throw Error("The database could not create the background-job lock.");
    acquired = Number(rows[0]?.acquired) === 1;
    if (!acquired) return { skipped: true };
    orders = createOrderEmailDispatcher(pool, { mailer: orderMailer, siteUrl, issueLink: (id) => grantRecovery(pool, id) });
    restock = createRestockDispatcher(pool, { transaction, availableStock, mailer: restockMailer, siteUrl });
    preorders = createPreorderDispatcher(pool, { mailer: preorderMailer || orderMailer, siteUrl, issueLink: (id) => grantRecovery(pool, id) });
    await expireOrders(pool);
    await databaseSessions(pool).cleanup();
    await orders.flush();
    await restock.flush();
    await preorders.flush();
    return { skipped: false };
  } finally {
    try {
      if (orders) await orders.stop();
      if (restock) await restock.stop();
      if (preorders) await preorders.stop();
    } finally {
      try {
        if (acquired) await lock.execute("SELECT RELEASE_LOCK(?)", [lockName]);
      } finally { lock.release(); }
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadRuntimeEnv();
  process.env.NODE_ENV ||= "production";
  let pool;
  try {
    assertProductionSettings();
    pool = databasePool(process.env, 3);
    const result = await runJobs(pool);
    if (!result.skipped) console.log(new Date().toISOString(), "Background email and expiry checks completed.");
  } catch (error) {
    console.error("Background checks failed:", error.code || error.message);
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
  }
}
