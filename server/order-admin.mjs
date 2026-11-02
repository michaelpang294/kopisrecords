// Local terminal only. There is deliberately no unauthenticated HTTP payment-confirmation endpoint.
import mysql from "mysql2/promise";
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
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 2,
});
try {
  const result = await manageOrder(pool, action, reference);
  console.log(result);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
