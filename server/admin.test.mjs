import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
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
  async function call(path, body, cookie = "", extra = {}, method) {
    const response = await fetch(base + path, {
      method: method || (body === undefined ? "GET" : "POST"),
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
      email: "customer@example.com",
      phone: "+65 9123 4567",
      telegram: "@customer",
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
  assert.equal(r.value.orders[0].contact, "+65 9123 4567");
  assert.equal(r.value.orders[0].telegram, "@customer");
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
  assert.equal((await action(id, "ready_for_collection", { collectionNumber: 123 })).status, 200);
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
  assert.equal((await call(`/api/admin/orders/${id}/action`, {
    action: "ready_for_collection", confirmed: true, collectionNumber: 123,
  }, cookie)).status, 409);
  assert.equal((await action("dispatched")).status, 200);
  assert.equal((await action("completed")).status, 200);
  assert.equal(pool.state.stock, 4);
});
test("mobile stock changes reject stale counts and held-copy reductions, preserving tags", async (t) => {
  const { pool, call, login, checkout } = await setup(t);
  const cookie = await login();
  await checkout();
  const update = (stock, expectedStock) =>
    call("/api/admin/stock/1", { stock, expectedStock }, cookie);
  assert.equal((await update(4, 3)).status, 409);
  assert.equal(pool.state.stock, 5);
  assert.equal((await update(0, 5)).status, 409);
  assert.equal(pool.state.stock, 5);
  const saved = await update(6, 5);
  assert.equal(saved.status, 200);
  assert.equal(saved.value.stock, 6);
  assert.deepEqual(saved.value.tags, ["recommended"]);
  assert.equal((await update(7, 5)).status, 409);
  assert.equal(pool.state.stock, 6);
  assert.equal((await update(-1, 6)).status, 400);
  const staleEdit = await call(
    "/api/stock/1",
    {
      title: "Test",
      artist: "Artist",
      price: 40,
      stock: 6,
      medium: "Vinyl",
      expectedStock: 5,
    },
    cookie,
    {},
    "PUT",
  );
  assert.equal(staleEdit.status, 409);
  assert.equal(pool.state.stock, 6);
});

test("private recovery persists only hashes, masks personal data, reuses order and reports payment without renewing hold", async (t) => {
  const { pool, call, login } = await setup(t);
  const requestId = randomUUID(),
    token = randomBytes(32).toString("hex");
  const body = {
    requestId,
    recoveryToken: token,
    items: [{ id: 1, quantity: 1 }],
    name: "Private customer",
    contact: "@private",
    email: "customer@example.com",
    phone: "+65 9123 4567",
    telegram: "@customer",
    fulfilment: "delivery",
    address: "Private address",
    postal: "199794",
  };
  const created = await call("/api/checkout", body);
  assert.equal(created.status, 200);
  assert.equal(created.value.recoveryToken, token);
  assert.equal(
    pool.state.access.get(createHash("sha256").update(token).digest("hex")),
    requestId,
  );
  assert.ok(!pool.state.access.has(token));
  assert.ok(!pool.state.orders.get(requestId).details.includes(token));
  const auth = { Authorization: `Bearer ${token}` };
  const first = await call("/api/order-recovery", undefined, "", auth);
  assert.equal(first.status, 200);
  assert.equal(first.value.reference, created.value.reference);
  assert.equal(first.value.expiresAt, created.value.expiresAt);
  for (const key of [
    "name",
    "contact",
    "address",
    "postal",
    "fingerprint",
    "email",
    "phone",
    "telegram",
    "recoveryToken",
  ])
    assert.equal(first.value[key], undefined);
  const again = await call("/api/checkout", body);
  assert.equal(again.value.expiresAt, created.value.expiresAt);
  assert.equal(pool.state.orders.size, 1);
  assert.equal(pool.state.holds.length, 1);
  assert.equal(
    (
      await call("/api/order-recovery", undefined, "", {
        Authorization: "Bearer " + created.value.reference,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await call("/api/order-recovery", undefined, "", {
        Authorization: "Bearer " + "0".repeat(64),
      })
    ).status,
    404,
  );
  let report = await call("/api/order-recovery/payment-reported", {}, "", auth);
  assert.equal(report.value.status, "payment_reported");
  assert.equal(report.value.qr, null);
  assert.equal(report.value.expiresAt, created.value.expiresAt);
  assert.equal(pool.state.stock, 5);
  report = await call("/api/order-recovery/payment-reported", {}, "", auth);
  assert.equal(report.status, 200);
  assert.equal(pool.state.holds.length, 1);
  const cookie = await login();
  await call(
    `/api/admin/orders/${requestId}/action`,
    { action: "paid", confirmed: true, paymentVerified: true },
    cookie,
  );
  await call(
    `/api/admin/orders/${requestId}/action`,
    { action: "dispatched", confirmed: true },
    cookie,
  );
  assert.equal(
    (await call("/api/order-recovery", undefined, "", auth)).value.status,
    "dispatched",
  );
  assert.equal(pool.state.stock, 4);
  assert.equal(
    (await call(`/api/admin/orders/${requestId}/recovery`, {})).status,
    401,
  );
  const additional = await call(
    `/api/admin/orders/${requestId}/recovery`,
    {},
    cookie,
  );
  assert.equal(additional.status, 200);
  assert.notEqual(additional.value.recoveryToken, token);
  assert.equal(
    (
      await call("/api/order-recovery", undefined, "", {
        Authorization: `Bearer ${additional.value.recoveryToken}`,
      })
    ).status,
    200,
  );
});
test("recovery rejects expired payments and never extends expiry", async (t) => {
  const { pool, call } = await setup(t);
  const id = randomUUID();
  const created = await call("/api/checkout", {
    requestId: id,
    items: [{ id: 1, quantity: 1 }],
    name: "Test",
    contact: "@test",
    email: "customer@example.com",
    phone: "+65 9123 4567",
    telegram: "@customer",
    fulfilment: "collection",
  });
  const token = created.value.recoveryToken;
  const row = pool.state.orders.get(id),
    details = JSON.parse(row.details);
  details.expiresAt = new Date(Date.now() - 1000).toISOString();
  row.details = JSON.stringify(details);
  pool.state.holds[0].expires_at = Date.now() - 1000;
  const auth = { Authorization: `Bearer ${token}` };
  const recovered = await call("/api/order-recovery", undefined, "", auth);
  assert.equal(recovered.value.status, "expired");
  assert.equal(recovered.value.qr, null);
  assert.equal(recovered.value.expiresAt, details.expiresAt);
  assert.equal(
    (await call("/api/order-recovery/payment-reported", {}, "", auth)).status,
    409,
  );
  assert.equal(pool.state.orders.size, 1);
});
