import { database } from "./testing/fake-database.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "./app.mjs";
import { crc16, paynowPayload, manageOrder } from "./checkout.mjs";
test("CRC and mobile PayNow encoding", () => {
  assert.equal(crc16("123456789"), "29B1");
  const qr = paynowPayload(4950, "KR123");
  assert.ok(qr.includes("+6591470168"));
  assert.ok(qr.includes("540549.50"));
  assert.equal(qr.slice(-4), crc16(qr.slice(0, -4)));
});
// Stateful adapter exercises transaction boundaries/rollback and request races.
// It does not replace a real InnoDB integration test.
async function setup(t, stock = 1) {
  const pool = database(stock);
  const server = createApp(pool, []).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}/api/checkout`;
  return {
    pool,
    async call(path = "", body) {
      const res = await fetch(
        base + path,
        body
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          : {},
      );
      return [res.status, await res.json()];
    },
  };
}
const body = () => ({
  requestId: randomUUID(),
  items: [{ id: 1, quantity: 1, price: 1 }],
  name: "Customer",
  contact: "@person",
  fulfilment: "delivery",
  address: "98 Arab Street",
  postal: "199794",
});
test("simultaneous last-copy checkout: one success; retry does not reserve twice", async (t) => {
  const { pool, call } = await setup(t);
  const b = body();
  const results = await Promise.all([call("", b), call("", body())]);
  assert.deepEqual(results.map((r) => r[0]).sort(), [200, 400]);
  const [, first] = await call("", b);
  assert.equal(first.total, 4450);
  assert.equal(pool.state.holds.length, 1);
  assert.equal(pool.state.stock, 1);
  assert.ok(first.qr.startsWith("data:image/png"));
  assert.equal((await call("", { ...b, name: "Other" }))[0], 409);
});
test("expired hold releases availability; old QR hidden and late report rejected", async (t) => {
  const { pool, call } = await setup(t);
  const b = body();
  await call("", b);
  const row = pool.state.orders.get(b.requestId);
  const details = JSON.parse(row.details);
  details.expiresAt = new Date(Date.now() - 1000).toISOString();
  row.details = JSON.stringify(details);
  pool.state.holds[0].expires_at = Date.now() - 1000;
  const [, expired] = await call("/" + b.requestId);
  assert.equal(expired.status, "expired");
  assert.equal(expired.qr, null);
  assert.equal(
    (await call("/" + b.requestId + "/payment-reported", {}))[0],
    409,
  );
  assert.equal((await call("", body()))[0], 200);
});
test("reported holds survive expiry; verify paid deducts once, not twice", async (t) => {
  const { pool, call } = await setup(t);
  const b = body();
  const [, o] = await call("", b);
  const [, reported] = await call("/" + b.requestId + "/payment-reported", {});
  assert.equal(reported.status, "payment_reported");
  pool.state.holds[0].expires_at = Date.now() - 1000;
  assert.equal((await call("", body()))[0], 400);
  await manageOrder(pool, "paid", o.reference);
  assert.equal(pool.state.stock, 0);
  await manageOrder(pool, "paid", o.reference);
  assert.equal(pool.state.stock, 0);
  assert.equal(pool.state.holds[0].state, "committed");
});
test("cancel releases reported hold; invalid input and failed stock settlement rollback", async (t) => {
  const { pool, call } = await setup(t);
  assert.equal((await call("", { ...body(), postal: "123" }))[0], 400);
  assert.equal(pool.state.orders.size, 0);
  const b = body();
  const [, o] = await call("", b);
  await call("/" + b.requestId + "/payment-reported", {});
  pool.state.stock = 0;
  await assert.rejects(manageOrder(pool, "paid", o.reference));
  assert.equal(pool.state.orders.get(b.requestId).status, "payment_reported");
  pool.state.stock = 1;
  await manageOrder(pool, "cancel", o.reference);
  assert.equal((await call("", body()))[0], 200);
});
