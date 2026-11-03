import { grantRecovery } from "./order-access.mjs";
import {
  ensureOrderEmails,
  createOrderEmailDispatcher,
} from "./order-emails.mjs";
// Local terminal only. There is deliberately no unauthenticated HTTP payment-confirmation endpoint.
import { loadRuntimeEnv, databasePool, assertProductionSettings } from "./runtime.mjs";
loadRuntimeEnv();
assertProductionSettings();
import { manageOrder } from "./checkout.mjs";
const [action, reference] = process.argv.slice(2);
if (
  !["paid", "cancel"].includes(action) ||
  !/^KR[A-F0-9]{20}$/.test(reference || "")
) {
  console.error(
    "Usage: node --env-file=.env order-admin.mjs paid|cancel KR_ORDER_REFERENCE",
  );
  process.exit(1);
}
const pool = databasePool(process.env, 2);
try {
  await ensureOrderEmails(pool);
  const result = await manageOrder(pool, action, reference);
  console.log(result);
  await createOrderEmailDispatcher(pool, {
    issueLink: (id) => grantRecovery(pool, id),
  }).flush();
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
