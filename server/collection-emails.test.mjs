import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { createApp } from "./app.mjs";
import { database } from "./testing/fake-database.mjs";
import { hashPassword } from "./admin-auth.mjs";
import { createOrderEmailDispatcher, orderEmail } from "./order-emails.mjs";
import { grantRecovery } from "./order-access.mjs";

async function setup(t) {
  const pool = database(10), sent = [];
  let failKind = "";
  const mailer = {
    ready: false,
    async send(message) {
      if (failKind && message.messageId.includes(failKind))
        throw Object.assign(Error("SMTP failed"), { code: "TEST_SMTP_FAILED" });
      sent.push(message);
    },
  };
  const app = createApp(pool, ["http://localhost:5173"], {
    adminPasswordHash: await hashPassword("correct-password-123"),
    secureCookies: false, orderMailer: mailer, orderSiteUrl: "http://localhost:5173",
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    await app.locals.orderEmails.stop();
    await new Promise((r) => server.close(r));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(path, data, cookie = "", extra = {}) {
    const r = await fetch(base + path, {
      method: data === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Request": "1", Cookie: cookie, ...extra },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return { status: r.status, value: await r.json(), response: r };
  }
  const login = await call("/api/admin/login", { password: "correct-password-123" });
  const cookie = login.response.headers.get("set-cookie").split(";")[0];
  const action = (id, value, extra = {}) => call(`/api/admin/orders/${id}/action`, {
    action: value, confirmed: true, paymentVerified: true, ...extra,
  }, cookie);
  async function checkout(fulfilment = "collection", pay = true) {
    const id = randomUUID(), token = randomBytes(32).toString("hex");
    const created = await call("/api/checkout", {
      requestId: id, recoveryToken: token, name: "Michael", email: "customer@example.com",
      phone: "+65 9123 4567", telegram: "@customer", fulfilment,
      items: [{ id: 1, quantity: 1 }], address: "98 Arab Street", postal: "199794",
    });
    assert.equal(created.status, 200);
    if (pay) {
      assert.equal((await call(`/api/checkout/${id}/payment-reported`, {})).status, 200);
      assert.equal((await action(id, "paid")).status, 200);
    }
    return { id, token, reference: created.value.reference };
  }
  return { pool, sent, mailer, app, call, action, checkout, cookie,
    fail: (kind) => { failKind = kind; } };
}
const job = (f, id, kind) => f.pool.state.emails.get(id + "|" + kind);
const mailFor = (f, kind) => f.sent.filter((m) => m.messageId.includes(kind));

test("a collection bag number is required, validated and restricted to paid collection orders", async (t) => {
  const f = await setup(t), c = await f.checkout();
  for (const number of [undefined, null, 0, -1, 1000000, 1.5, "123", "1e2", {}, true])
    assert.equal((await f.action(c.id, "ready_for_collection", { collectionNumber: number })).status, 400);
  assert.equal(f.pool.state.fulfilment.has(c.id), false);
  assert.equal(job(f, c.id, "customer_ready_for_collection"), undefined);
  const unpaid = await f.checkout("collection", false), delivery = await f.checkout("delivery");
  assert.equal((await f.action(unpaid.id, "ready_for_collection", { collectionNumber: 1 })).status, 409);
  assert.equal((await f.action(delivery.id, "ready_for_collection", { collectionNumber: 1 })).status, 409);
  assert.equal((await f.action(c.id, "completed")).status, 409);
  const payload = { action: "ready_for_collection", confirmed: true, collectionNumber: 1 };
  assert.equal((await f.call(`/api/admin/orders/${c.id}/action`, payload)).status, 401);
  assert.equal((await f.call(`/api/admin/orders/${c.id}/action`, payload, f.cookie, { "X-Admin-Request": "" })).status, 403);
  assert.equal((await f.action(c.id, "ready_for_collection", { collectionNumber: 1, confirmed: false })).status, 400);
  assert.equal((await f.action(c.id, "ready_for_collection", { collectionNumber: 1 })).status, 200);
  assert.equal(JSON.parse(f.pool.state.orders.get(c.id).details).collectionNumber, 1);
});

test("ready and completed messages contain the bag number and private link, and repeated actions send once", async (t) => {
  const f = await setup(t), c = await f.checkout();
  f.mailer.ready = true;
  await f.app.locals.orderEmails.flush();
  const stockAfterPaid = f.pool.state.stock;
  const results = await Promise.all([1, 2].map(() => f.action(c.id, "ready_for_collection", { collectionNumber: 999999 })));
  assert(results.every((r) => r.status === 200));
  await f.app.locals.orderEmails.flush();
  assert.equal(mailFor(f, "customer_ready_for_collection").length, 1);
  const ready = mailFor(f, "customer_ready_for_collection")[0];
  assert.equal(ready.from.address, "kopisrecords@gmail.com");
  assert.equal(ready.to.address, "customer@example.com");
  assert.match(ready.subject, /Ready for collection.*999999/);
  assert.match(ready.text, /collection \/ bag number is 999999/);
  assert.match(ready.text, /98 Arab Street/);
  assert.match(ready.text, /timing agreed/);
  assert.match(ready.text, /tell us this number/i);
  const token = ready.text.match(/\/order#token=([a-f0-9]{64})/)[1];
  const receipt = await f.call("/api/order-recovery", undefined, "", { Authorization: "Bearer " + token });
  assert.equal(receipt.value.collectionNumber, 999999);
  assert.equal(receipt.value.status, "ready_for_collection");
  assert.equal(receipt.value.qr, null);
  assert.equal(receipt.value.email, undefined);
  const detail = await f.call(`/api/admin/orders/${c.id}`, undefined, f.cookie);
  assert.equal(detail.value.collectionNumber, 999999);
  assert(detail.value.emails.some((e) => e.kind === "customer_ready_for_collection" && e.status === "sent"));
  const found = await f.call("/api/admin/orders?q=999999&status=ready_for_collection", undefined, f.cookie);
  assert.equal(found.value.total, 1);
  assert.equal(found.value.orders[0].id, c.id);
  assert.equal((await f.action(c.id, "ready_for_collection", { collectionNumber: 2 })).status, 409);
  assert.equal(JSON.parse(f.pool.state.orders.get(c.id).details).collectionNumber, 999999);
  const completed = await Promise.all([f.action(c.id, "completed"), f.action(c.id, "completed")]);
  assert(completed.every((r) => r.status === 200));
  await f.app.locals.orderEmails.flush();
  assert.equal(mailFor(f, "customer_order_completed").length, 1);
  const thanks = mailFor(f, "customer_order_completed")[0];
  assert.match(thanks.text, /has been collected/);
  assert.match(thanks.text, /enjoy your records/);
  assert.match(thanks.text, /\/order#token=[a-f0-9]{64}/);
  assert.equal(thanks.to.address, "customer@example.com");
  assert.equal(f.pool.state.stock, stockAfterPaid);
  assert.equal(f.pool.state.events.filter((e) => e.action === "ready_for_collection").length, 1);
  assert.equal(f.pool.state.events.filter((e) => e.action === "completed").length, 1);
  const finalReceipt = await f.call("/api/order-recovery", undefined, "", { Authorization: "Bearer " + c.token });
  assert.equal(finalReceipt.value.status, "completed");
  assert.equal(finalReceipt.value.collectionNumber, 999999);
});

test("concurrent bag assignments cannot collide; a completed bag number can be reused", async (t) => {
  const f = await setup(t), a = await f.checkout(), b = await f.checkout();
  const results = await Promise.all([a, b].map((c) => f.action(c.id, "ready_for_collection", { collectionNumber: 42 })));
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const winner = results[0].status === 200 ? a : b, loser = winner === a ? b : a;
  assert.equal(job(f, loser.id, "customer_ready_for_collection"), undefined);
  assert.equal(JSON.parse(f.pool.state.orders.get(loser.id).details).collectionNumber, undefined);
  assert.equal((await f.action(winner.id, "completed")).status, 200);
  assert.equal((await f.action(loser.id, "ready_for_collection", { collectionNumber: 42 })).status, 200);
  assert.equal(JSON.parse(f.pool.state.orders.get(winner.id).details).collectionNumber, 42);
  assert.equal(JSON.parse(f.pool.state.orders.get(loser.id).details).collectionNumber, 42);
});

test("SMTP failure preserves the ready/completed states; retries do not repeat stock or order actions", async (t) => {
  const f = await setup(t), c = await f.checkout();
  f.mailer.ready = true;
  await f.app.locals.orderEmails.flush();
  f.fail("customer_ready_for_collection");
  await f.action(c.id, "ready_for_collection", { collectionNumber: 81 });
  await f.app.locals.orderEmails.flush();
  assert.equal(f.pool.state.fulfilment.get(c.id), "ready_for_collection");
  assert.equal(job(f, c.id, "customer_ready_for_collection").status, "failed");
  f.fail("");
  job(f, c.id, "customer_ready_for_collection").next_attempt_at = 0;
  const restarted = createOrderEmailDispatcher(f.pool, {
    mailer: f.mailer, siteUrl: "http://localhost:5173", issueLink: (id) => grantRecovery(f.pool, id),
  });
  await restarted.flush();
  assert.equal(mailFor(f, "customer_ready_for_collection").length, 1);
  f.fail("customer_order_completed");
  await f.action(c.id, "completed");
  await f.app.locals.orderEmails.flush();
  assert.equal(f.pool.state.fulfilment.get(c.id), "completed");
  assert.equal(job(f, c.id, "customer_order_completed").status, "failed");
  f.fail("");
  await f.call(`/api/admin/orders/${c.id}/emails/retry`, {}, f.cookie);
  await f.app.locals.orderEmails.flush();
  assert.equal(mailFor(f, "customer_order_completed").length, 1);
  assert.equal(f.pool.state.stock, 9);
});

test("collection number, state and event all roll back if queuing the stage email fails", async (t) => {
  const f = await setup(t), c = await f.checkout(), getConnection = f.pool.getConnection;
  const failQueue = async () => {
    const db = await getConnection();
    return { ...db, execute: async (sql, args) => {
      if (sql.startsWith("INSERT IGNORE INTO checkout_emails"))
        throw Object.assign(Error("queue failure"), { code: "TEST_QUEUE_FAILED" });
      return db.execute(sql, args);
    } };
  };
  f.pool.getConnection = failQueue;
  assert.equal((await f.action(c.id, "ready_for_collection", { collectionNumber: 7 })).status, 500);
  assert.equal(f.pool.state.fulfilment.get(c.id), undefined);
  assert.equal(JSON.parse(f.pool.state.orders.get(c.id).details).collectionNumber, undefined);
  assert(!f.pool.state.events.some((e) => e.action === "ready_for_collection"));
  f.pool.getConnection = getConnection;
  assert.equal((await f.action(c.id, "ready_for_collection", { collectionNumber: 7 })).status, 200);
  f.pool.getConnection = failQueue;
  assert.equal((await f.action(c.id, "completed")).status, 500);
  assert.equal(f.pool.state.fulfilment.get(c.id), "ready_for_collection");
  assert(!f.pool.state.events.some((e) => e.action === "completed"));
  assert.equal(job(f, c.id, "customer_order_completed"), undefined);
  assert.equal(f.pool.state.stock, 9);
});

test("completed orders suppress a stale unsent collection email; delivery and older orders finish safely", async (t) => {
  const f = await setup(t), c = await f.checkout();
  await f.action(c.id, "ready_for_collection", { collectionNumber: 12 });
  await f.action(c.id, "completed");
  f.mailer.ready = true;
  await f.app.locals.orderEmails.flush();
  assert.equal(job(f, c.id, "customer_ready_for_collection").status, "skipped");
  assert.equal(mailFor(f, "customer_ready_for_collection").length, 0);
  assert.equal(mailFor(f, "customer_order_completed").length, 1);
  const delivery = await f.checkout("delivery");
  await f.action(delivery.id, "dispatched");
  await f.action(delivery.id, "completed");
  await f.app.locals.orderEmails.flush();
  const thanks = mailFor(f, "customer_order_completed").find((m) => m.messageId.includes(delivery.id));
  assert.match(thanks.text, /is now complete/);
  assert(!thanks.text.includes("has been collected"));
  assert(!thanks.text.includes("Collection / bag number:"));
  const legacy = await f.checkout();
  const details = JSON.parse(f.pool.state.orders.get(legacy.id).details);
  delete details.email;
  f.pool.state.orders.get(legacy.id).details = JSON.stringify(details);
  await f.action(legacy.id, "ready_for_collection", { collectionNumber: 16 });
  await f.action(legacy.id, "completed");
  await f.app.locals.orderEmails.flush();
  assert.equal(job(f, legacy.id, "customer_order_completed").status, "skipped");
  const escaped = orderEmail("customer_ready_for_collection", {
    ...details, email: "customer@example.com", name: "<script>bad</script>", collectionNumber: 99,
  }, "http://localhost:5173/order#token=" + legacy.token);
  assert(!escaped.html.includes("<script>"));
  assert.match(escaped.html, /&lt;script&gt;/);
  assert.match(escaped.html, /YOUR COLLECTION \/ BAG NUMBER/);
});
