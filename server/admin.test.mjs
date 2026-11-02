import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "./app.mjs";
import { hashPassword } from "./admin-auth.mjs";
import { database } from "./testing/fake-database.mjs";
async function setup(t, options = {}) {
  const pool = database(5);
  const server = createApp(pool, ["http://localhost:5173"], {
    adminPasswordHash: await hashPassword("correct-password-123"),
    ...options,
  }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(path, body, cookie = "", extra = {}) {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Origin: "http://localhost:5173",
        "X-Admin-Request": "1",
        "Content-Type": "application/json",
        Cookie: cookie,
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const value = await response.json();
    return { status: response.status, value, response };
  }
  async function login() {
    const r = await call("/api/admin/login", {
      password: "correct-password-123",
    });
    assert.equal(r.status, 200);
    return r.response.headers.get("set-cookie").split(";")[0];
  }
  async function checkout(method = "collection") {
    const id = randomUUID();
    const r = await call("/api/checkout", {
      requestId: id,
      items: [{ id: 1, quantity: 1 }],
      name: "Michael",
      contact: "@customer",
      fulfilment: method,
      address: "98 Arab Street",
      postal: "199794",
    });
    assert.equal(r.status, 200);
    await call("/api/checkout/" + id + "/payment-reported", {});
    return id;
  }
  return { pool, call, login, checkout };
}
test("admin authentication, CSRF headers, session/logout and protected APIs", async (t) => {
  const { call, login } = await setup(t);
  for (const [path, body] of [
    ["/api/admin/orders", undefined],
    ["/api/admin/orders/x", undefined],
    ["/api/admin/orders/x/action", { action: "paid" }],
    ["/api/stock", { title: "evil" }],
    ["/api/stock?inventory=on-hand", undefined],
  ])
    assert.equal((await call(path, body)).status, 401);
  assert.equal(
    (await call("/api/admin/login", { password: "wrong" })).status,
    401,
  );
  const cookie = await login();
  const session = await call("/api/admin/session", undefined, cookie);
  assert.equal(session.status, 200);
  const settings = (
    await call("/api/admin/login", { password: "correct-password-123" })
  ).response.headers.get("set-cookie");
  assert.match(settings, /HttpOnly/);
  assert.match(settings, /SameSite=Strict/);
  assert.equal(
    (
      await call("/api/admin/orders/x/action", { action: "paid" }, cookie, {
        "X-Admin-Request": "",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("/api/admin/orders", undefined, cookie, {
        Origin: "https://foreign.example",
      })
    ).status,
    403,
  );
  await call("/api/admin/logout", {}, cookie);
  assert.equal(
    (await call("/api/admin/session", undefined, cookie)).status,
    401,
  );
});
test("login rate limit and fail-closed setup", async (t) => {
  const { call } = await setup(t);
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await call("/api/admin/login", { password: "wrong" })).status,
      401,
    );
  assert.equal(
    (await call("/api/admin/login", { password: "correct-password-123" }))
      .status,
    429,
  );
  const disabled = await setup(t, { adminPasswordHash: "" });
  assert.equal(
    (await disabled.call("/api/admin/login", { password: "" })).status,
    503,
  );
});
test("order filters, details, payment confirmation once, fulfilment and cancellation", async (t) => {
  const { pool, call, login, checkout } = await setup(t);
  const cookie = await login();
  const id = await checkout();
  const delivery = await checkout("delivery");
  let r = await call(
    "/api/admin/orders?status=payment_reported",
    undefined,
    cookie,
  );
  assert.equal(r.status, 200);
  assert.equal(r.value.total, 2);
  assert.equal(r.value.orders[0].contact, "@customer");
  r = await call("/api/admin/orders/" + id, undefined, cookie);
  assert.equal(r.value.name, "Michael");
  assert.equal(r.value.holds[0].state, "reported");
  const action = (id, action, extra = {}) =>
    call(
      "/api/admin/orders/" + id + "/action",
      { action, confirmed: true, ...extra },
      cookie,
    );
  assert.equal((await action(id, "paid")).status, 400);
  assert.equal(pool.state.stock, 5);
  assert.equal((await action(id, "completed")).status, 409);
  assert.equal(
    (await action(id, "paid", { paymentVerified: true })).status,
    200,
  );
  assert.equal(pool.state.stock, 4);
  assert.equal(
    (await action(id, "paid", { paymentVerified: true })).status,
    200,
  );
  assert.equal(pool.state.stock, 4);
  assert.equal((await action(id, "dispatched")).status, 409);
  assert.equal((await action(id, "ready_for_collection")).status, 200);
  assert.equal((await action(id, "completed")).status, 200);
  assert.equal(pool.state.stock, 4);
  assert.equal((await action(id, "cancel")).status, 409);
  assert.equal((await action(delivery, "cancel")).status, 200);
  assert.equal(
    pool.state.holds.find((h) => h.order_id === delivery).state,
    "released",
  );
  r = await call(
    "/api/admin/orders?status=completed&q=Michael",
    undefined,
    cookie,
  );
  assert.equal(r.value.total, 1);
  assert.equal(r.value.orders[0].paymentStatus, "paid");
  assert.equal(r.value.orders[0].status, "completed");
  r = await call("/api/admin/orders/" + id, undefined, cookie);
  assert.deepEqual(
    r.value.events.map((e) => e.action),
    ["completed", "ready_for_collection", "paid"],
  );
});
test("expired sessions cannot mutate stock; delivery follows dispatched then completed", async (t) => {
  const expired = await setup(t, { sessionMs: 1 });
  const shortCookie = await expired.login();
  assert.equal(
    (await expired.call("/api/admin/orders", undefined, shortCookie)).status,
    401,
  );
  const { pool, call, login, checkout } = await setup(t);
  const cookie = await login();
  const id = await checkout("delivery");
  const action = (value) =>
    call(
      `/api/admin/orders/${id}/action`,
      { action: value, confirmed: true, paymentVerified: true },
      cookie,
    );
  assert.equal((await action("paid")).status, 200);
  assert.equal(pool.state.stock, 4);
  assert.equal((await action("ready_for_collection")).status, 409);
  assert.equal((await action("dispatched")).status, 200);
  assert.equal((await action("completed")).status, 200);
  assert.equal(pool.state.stock, 4);
});
