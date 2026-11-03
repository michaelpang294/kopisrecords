import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./app.mjs";
import { hashPassword } from "./admin-auth.mjs";
import { database } from "./testing/fake-database.mjs";
import { availableStock, transaction } from "./checkout.mjs";
import { createRestockDispatcher, restockEmail } from "./restock-alerts.mjs";

async function setup(t, stock = 0) {
  const pool = database(stock), sent = [];
  let fail = false;
  const mailer = { ready: true, async send(mail) {
    if (fail) throw Object.assign(Error("private SMTP detail"), { code: "TEST_SMTP_FAILED" });
    sent.push(mail);
  } };
  const app = createApp(pool, ["http://localhost:5173"], {
    adminPasswordHash: await hashPassword("correct-password-123"),
    secureCookies: false, restockMailer: mailer, orderMailer: { ready: false },
    orderSiteUrl: "http://localhost:5173",
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(async () => {
    await app.locals.restockAlerts.stop(); await app.locals.orderEmails.stop();
    await new Promise((r) => server.close(r));
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function call(path, data, cookie = "", headers = {}) {
    const r = await fetch(origin + path, {
      method: data === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Request": "1", Cookie: cookie, ...headers },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return { status: r.status, value: await r.json(), response: r };
  }
  const signup = (email = "Customer@Example.com", productId = 1) => call("/api/restock-alerts", { email, productId });
  const login = async () => (await call("/api/admin/login", { password: "correct-password-123" })).response.headers.get("set-cookie").split(";")[0];
  return { pool, mailer, sent, app, call, signup, login, setFail: (value) => { fail = value; } };
}

test("sold-out signup validates email and product, persists privately, deduplicates and sends no early mail", async (t) => {
  const f = await setup(t);
  for (const body of [{}, { email: "bad", productId: 1 }, { email: "x@example.com\r\nBcc:bad@example.com", productId: 1 }, { email: "x@example.com", productId: 0 }, { email: "x@example.com", productId: "1" }])
    assert.equal((await f.call("/api/restock-alerts", body)).status, 400);
  assert.equal((await f.signup("x@example.com", 99)).status, 404);
  const responses = await Promise.all([f.signup(), f.signup(" customer@example.com ")]);
  assert(responses.every((r) => r.status === 202));
  assert.deepEqual(responses[0].value, responses[1].value);
  assert.equal(f.pool.state.alerts.size, 1);
  const alert = [...f.pool.state.alerts.values()][0];
  assert.equal(alert.email, "customer@example.com"); assert.equal(alert.status, "waiting");
  assert.match(alert.ip_hash, /^[a-f0-9]{64}$/);
  assert.equal(responses[0].value.email, undefined);
  await f.app.locals.restockAlerts.flush();
  assert.equal(f.sent.length, 0);
  assert.equal((await f.call("/api/restock-alerts")).status, 404);
  f.mailer.ready = false;
  assert.equal((await f.signup("another@example.com")).status, 503);
});

test("an in-stock record rejects stale signup; held copies do not trigger alerts until actually available", async (t) => {
  const f = await setup(t, 1);
  const available = await f.signup();
  assert.equal(available.status, 409); assert.equal(available.value.code, "AVAILABLE");
  assert.equal(f.pool.state.alerts.size, 0);
  const hold = { order_id: "hold", product_id: 1, quantity: 1, state: "active", expires_at: Date.now() + 60000 };
  f.pool.state.holds.push(hold);
  assert.equal((await f.signup()).status, 202);
  await f.app.locals.restockAlerts.flush(); assert.equal(f.sent.length, 0);
  hold.state = "reported"; hold.expires_at = Date.now() - 60000;
  await f.app.locals.restockAlerts.flush(); assert.equal(f.sent.length, 0);
  hold.state = "released";
  await f.app.locals.restockAlerts.flush(); assert.equal(f.sent.length, 1);
  assert.equal(f.pool.state.stock, 1); // Alerting never deducts or reserves a copy.
});

test("restocking from admin emails each signup once and permits a new signup for a later sell-out", async (t) => {
  const f = await setup(t);
  await f.signup(); await f.signup("other@example.com");
  const cookie = await f.login();
  const changed = await f.call("/api/admin/stock/1", { stock: 2, expectedStock: 0 }, cookie);
  assert.equal(changed.status, 200);
  await f.app.locals.restockAlerts.flush();
  assert.equal(f.sent.length, 2);
  assert.deepEqual(f.sent.map((m) => m.to).sort(), ["customer@example.com", "other@example.com"]);
  const mail = f.sent[0];
  assert.equal(mail.from.address, "kopisrecords@gmail.com");
  assert.equal(mail.replyTo, "kopisrecords@gmail.com");
  assert.match(mail.text, /http:\/\/localhost:5173\/shop\/product\/1/);
  assert.match(mail.text, /one-time availability alert/);
  assert.match(mail.text, /Availability may change/);
  assert(!mail.bcc); assert(!mail.cc);
  await f.app.locals.restockAlerts.flush();
  await f.call("/api/admin/stock/1", { stock: 3, expectedStock: 2 }, cookie);
  await f.app.locals.restockAlerts.flush(); assert.equal(f.sent.length, 2);
  const original = [...f.pool.state.alerts.values()].find((a) => a.email === "customer@example.com").generation;
  f.pool.state.stock = 0;
  assert.equal((await f.signup()).status, 202);
  assert.equal(f.pool.state.alerts.size, 2);
  const rearmed = [...f.pool.state.alerts.values()].find((a) => a.email === "customer@example.com");
  assert.notEqual(rearmed.generation, original);
  f.pool.state.stock = 1;
  await f.app.locals.restockAlerts.flush();
  assert.equal(f.sent.length, 3);
});

test("two workers claim one alert; SMTP failure persists for retry without altering stock", async (t) => {
  const f = await setup(t);
  await f.signup(); f.pool.state.stock = 1;
  const worker = () => createRestockDispatcher(f.pool, { transaction, availableStock, mailer: f.mailer, siteUrl: "http://localhost:5173" });
  await Promise.all([worker().flush(), worker().flush()]);
  assert.equal(f.sent.length, 1);
  f.pool.state.stock = 0; await f.signup("retry@example.com"); f.pool.state.stock = 1;
  f.setFail(true); await f.app.locals.restockAlerts.flush();
  let alert = [...f.pool.state.alerts.values()].find((a) => a.email === "retry@example.com");
  assert.equal(alert.status, "failed"); assert.equal(alert.last_error, "TEST_SMTP_FAILED");
  assert.equal(f.pool.state.stock, 1);
  f.setFail(false); alert.next_attempt_at = new Date(0).toISOString();
  await worker().flush();
  alert = [...f.pool.state.alerts.values()].find((a) => a.email === "retry@example.com");
  assert.equal(alert.status, "sent"); assert.equal(f.sent.length, 2);
  await worker().flush(); assert.equal(f.sent.length, 2);
});

test("deleted products are not advertised; failed alerts stop at five attempts and admin retry stays protected", async (t) => {
  const f = await setup(t);
  await f.signup(); f.pool.state.productPresent = false; f.pool.state.stock = 1;
  await f.app.locals.restockAlerts.flush(); assert.equal(f.sent.length, 0);
  f.pool.state.productPresent = true;
  const alert = [...f.pool.state.alerts.values()][0];
  alert.status = "failed"; alert.attempts = 5;
  await f.app.locals.restockAlerts.flush(); assert.equal(f.sent.length, 0);
  assert.equal((await f.call("/api/admin/restock-alerts/retry", {})).status, 401);
  const cookie = await f.login();
  assert.equal((await f.call("/api/admin/restock-alerts/retry", {}, cookie, { "X-Admin-Request": "" })).status, 403);
  assert.equal((await f.call("/api/admin/restock-alerts/retry", {}, cookie)).status, 200);
  await f.app.locals.restockAlerts.flush(); assert.equal(f.sent.length, 1);
});

test("stock vanishing before claim and a failed claim transaction send no email; content is escaped", async (t) => {
  const f = await setup(t);
  await f.signup(); f.pool.state.stock = 1;
  const original = f.pool.execute;
  f.pool.execute = async (sql, args) => {
    const result = await original(sql, args);
    if (sql.startsWith("SELECT a.alert_id")) f.pool.state.stock = 0;
    return result;
  };
  await f.app.locals.restockAlerts.flush(); assert.equal(f.sent.length, 0);
  f.pool.execute = original; f.pool.state.stock = 1;
  const getConnection = f.pool.getConnection;
  f.pool.getConnection = async () => {
    const db = await getConnection();
    return { ...db, execute: async (sql, args) => {
      if (sql.startsWith("UPDATE restock_alerts SET status = 'sending'")) throw Error("claim failed");
      return db.execute(sql, args);
    } };
  };
  await assert.rejects(f.app.locals.restockAlerts.flush(), /claim failed/);
  assert.equal([...f.pool.state.alerts.values()][0].status, "waiting");
  assert.equal(f.sent.length, 0);
  const mail = restockEmail({ email: "x@example.com" }, { id: 1, title: "<img onerror=evil>", artist: "<script>bad</script>" }, "https://kopisrecords.shop");
  assert(!mail.html.includes("<script>")); assert(!mail.html.includes("<img onerror"));
  assert.match(mail.html, /&lt;script&gt;/);
});

test("signup limits persist independently of in-memory requests", async (t) => {
  const f = await setup(t);
  await f.signup();
  const sample = [...f.pool.state.alerts.values()][0];
  for (let i = 0; i < 20; i++) f.pool.state.alerts.set("rate-" + i, { ...sample, alert_id: "rate-" + i, product_id: i + 2, email: `user${i}@example.com` });
  const denied = await f.signup("new@example.com");
  assert.equal(denied.status, 429); assert.equal(f.sent.length, 0);
  const foreign = await f.call("/api/restock-alerts", { email: "x@example.com", productId: 1 }, "", { Origin: "https://foreign.example" });
  assert.equal(foreign.status, 403);
});
