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
function database(stock = 1) {
  const state = { orders: new Map(), holds: [], stock };
  let tail = Promise.resolve();
  const execute = async (sql, args = []) => {
    if (sql.startsWith("SELECT id FROM checkout_reservation_lock"))
      return [[{ id: 1 }]];
    if (sql.startsWith("SELECT * FROM checkout_orders WHERE id"))
      return [
        [
          ...(state.orders.has(args[0])
            ? [structuredClone(state.orders.get(args[0]))]
            : []),
        ],
      ];
    if (sql.startsWith("SELECT * FROM checkout_orders WHERE JSON_"))
      return [
        [...state.orders.values()]
          .filter((o) => JSON.parse(o.details).reference === args[0])
          .map((o) => structuredClone(o)),
      ];
    if (sql.startsWith("SELECT id,title"))
      return [
        [
          {
            id: 1,
            title: "Test",
            artist: "Artist",
            price: "40.00",
            stock: state.stock,
          },
        ],
      ];
    if (sql.startsWith("SELECT COALESCE"))
      return [
        [
          {
            held: state.holds
              .filter(
                (h) =>
                  h.product_id === args[0] &&
                  (h.state === "reported" ||
                    (h.state === "active" && h.expires_at > Date.now())),
              )
              .reduce((s, h) => s + h.quantity, 0),
          },
        ],
      ];
    if (sql.startsWith("INSERT INTO checkout_orders")) {
      state.orders.set(args[0], {
        id: args[0],
        fingerprint: args[1],
        details: args[2],
        status: "awaiting_payment_confirmation",
      });
      return [{}];
    }
    if (sql.startsWith("INSERT INTO checkout_reservations")) {
      state.holds.push({
        order_id: args[0],
        product_id: args[1],
        quantity: args[2],
        expires_at: +args[3],
        state: "active",
      });
      return [{}];
    }
    if (sql.startsWith("SELECT * FROM checkout_reservations"))
      return [
        state.holds
          .filter((h) => h.order_id === args[0])
          .map((h) => ({ ...h })),
      ];
    if (sql.startsWith("UPDATE stock SET stock = stock -")) {
      if (state.stock < args[2]) return [{ affectedRows: 0 }];
      state.stock -= args[0];
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith("UPDATE checkout_orders SET status")) {
      const status = sql.match(/status = '([^']+)'/)[1];
      state.orders.get(args[0]).status = status;
      return [{}];
    }
    if (sql.startsWith("UPDATE checkout_reservations SET state")) {
      const status = sql.match(/state = '([^']+)'/)[1];
      for (const h of state.holds) if (h.order_id === args[0]) h.state = status;
      return [{}];
    }
    throw Error(sql);
  };
  return {
    state,
    execute,
    async getConnection() {
      let unlock, snapshot;
      return {
        async beginTransaction() {
          const previous = tail;
          tail = new Promise((r) => (unlock = r));
          await previous;
          snapshot = structuredClone(state);
        },
        execute,
        async commit() {
          unlock();
        },
        async rollback() {
          Object.assign(state, snapshot);
          unlock();
        },
        release() {},
      };
    },
  };
}
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
