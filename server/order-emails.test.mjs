import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { createApp } from "./app.mjs";
import { database } from "./testing/fake-database.mjs";
import { hashPassword } from "./admin-auth.mjs";
import {
  createOrderEmailDispatcher,
  orderEmail,
  queueOrderEmails,
} from "./order-emails.mjs";
import { grantRecovery } from "./order-access.mjs";

const body = () => ({
  requestId: randomUUID(),
  recoveryToken: randomBytes(32).toString("hex"),
  name: "Michael",
  email: "Customer@Example.com",
  phone: "+65 9123 4567",
  telegram: "@customer",
  items: [{ id: 1, quantity: 1 }],
  fulfilment: "collection",
});
async function setup(t) {
  const pool = database(4),
    sent = [];
  let failKind = "";
  const mailer = {
    ready: false,
    async send(mail) {
      if (failKind && mail.messageId.includes(failKind))
        throw Object.assign(Error("private SMTP info"), {
          code: "SMTP_TEST_FAILED",
        });
      sent.push(mail);
    },
  };
  const app = createApp(pool, ["http://localhost:5173"], {
    adminPasswordHash: await hashPassword("correct-password-123"),
    secureCookies: false,
    orderMailer: mailer,
    orderSiteUrl: "http://localhost:5173",
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
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Request": "1",
        Cookie: cookie,
        ...extra,
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return { status: r.status, value: await r.json(), response: r };
  }
  async function login() {
    const r = await call("/api/admin/login", {
      password: "correct-password-123",
    });
    return r.response.headers.get("set-cookie").split(";")[0];
  }
  return {
    pool,
    app,
    mailer,
    sent,
    call,
    login,
    setFail: (kind) => (failKind = kind),
  };
}

test("new checkout requires all three contacts, stores them privately and queues no email before report", async (t) => {
  const f = await setup(t);
  for (const field of ["email", "phone", "telegram"]) {
    const b = body();
    delete b[field];
    assert.equal((await f.call("/api/checkout", b)).status, 400);
  }
  for (const change of [
    { email: "bad" },
    { email: "x@example.com\r\nBcc:bad@example.com" },
    { phone: "not a phone" },
    { telegram: "no spaces allowed" },
  ])
    assert.equal(
      (await f.call("/api/checkout", { ...body(), ...change })).status,
      400,
    );
  const b = body();
  const made = await f.call("/api/checkout", b);
  assert.equal(made.status, 200);
  assert.equal(f.pool.state.emails.size, 0);
  const details = JSON.parse(f.pool.state.orders.get(b.requestId).details);
  assert.equal(details.email, "customer@example.com");
  assert.equal(details.phone, b.phone);
  assert.equal(details.telegram, b.telegram);
  for (const field of [
    "name",
    "email",
    "phone",
    "telegram",
    "contact",
    "address",
    "postal",
  ])
    assert.equal(made.value[field], undefined);
  const lookup = await f.call("/api/order-recovery", undefined, "", {
    Authorization: "Bearer " + b.recoveryToken,
  });
  assert.equal(lookup.status, 200);
  for (const field of ["email", "phone", "telegram"])
    assert.equal(lookup.value[field], undefined);
  assert.equal(
    (await f.call("/api/checkout", { ...b, email: "other@example.com" }))
      .status,
    409,
  );
});

test("reporting via checkout or private link sends customer/shop once; paid admin action sends only after bank confirmation", async (t) => {
  const f = await setup(t),
    b = body();
  await f.call("/api/checkout", b);
  const responses = await Promise.all([
    f.call(`/api/checkout/${b.requestId}/payment-reported`, {}),
    f.call("/api/order-recovery/payment-reported", {}, "", {
      Authorization: "Bearer " + b.recoveryToken,
    }),
  ]);
  assert(responses.every((r) => r.status === 200));
  assert.equal(f.pool.state.emails.size, 2);
  assert.equal(f.pool.state.stock, 4);
  f.mailer.ready = true;
  await f.app.locals.orderEmails.flush();
  assert.equal(f.sent.length, 2);
  const review = f.sent.find((m) => typeof m.to === "object"),
    shop = f.sent.find((m) => typeof m.to === "string");
  assert.equal(review.to.address, "customer@example.com");
  assert.equal(shop.from.address, "kopisrecords@gmail.com");
  assert.equal(shop.to, "kopisrecords@gmail.com");
  assert.match(review.text, /1–2 hours/);
  assert.match(review.text, /We’ll email you once payment is confirmed/);
  assert.match(shop.text, /Telegram: @customer/);
  assert.match(shop.text, /Phone: \+65 9123 4567/);
  const token = review.text.match(/\/order#token=([a-f0-9]{64})/)[1];
  assert(
    f.pool.state.access.has(createHash("sha256").update(token).digest("hex")),
  );
  const recovered = await f.call("/api/order-recovery", undefined, "", {
    Authorization: "Bearer " + token,
  });
  assert.equal(recovered.value.status, "payment_reported");
  assert.equal(recovered.value.qr, null);
  await f.call(`/api/checkout/${b.requestId}/payment-reported`, {});
  await f.app.locals.orderEmails.flush();
  assert.equal(f.sent.length, 2);
  const cookie = await f.login();
  assert.equal(
    (
      await f.call(
        `/api/admin/orders/${b.requestId}/action`,
        { action: "paid", confirmed: true },
        cookie,
      )
    ).status,
    400,
  );
  assert.equal(f.pool.state.emails.size, 2);
  assert.equal(
    (
      await f.call(
        `/api/admin/orders/${b.requestId}/action`,
        { action: "paid", confirmed: true, paymentVerified: true },
        cookie,
      )
    ).status,
    200,
  );
  await f.app.locals.orderEmails.flush();
  assert.equal(f.pool.state.stock, 3);
  assert.equal(f.sent.length, 3);
  const confirmed = f.sent.find((m) => m.subject.includes("confirmed"));
  assert.match(confirmed.text, /payment.*has been received/s);
  assert.match(confirmed.text, /Please wait for that email/);
  assert.match(confirmed.text, /Rocks Cafe/);
  assert.match(confirmed.text, /\/order#token=[a-f0-9]{64}/);
  await f.call(
    `/api/admin/orders/${b.requestId}/action`,
    { action: "paid", confirmed: true, paymentVerified: true },
    cookie,
  );
  await f.app.locals.orderEmails.flush();
  assert.equal(f.sent.length, 3);
  assert.equal(f.pool.state.stock, 3);
  const detail = await f.call(
    `/api/admin/orders/${b.requestId}`,
    undefined,
    cookie,
  );
  assert.equal(detail.value.email, "customer@example.com");
  assert.equal(detail.value.telegram, "@customer");
  assert.equal(detail.value.emails.length, 3);
  assert(detail.value.emails.every((e) => e.status === "sent"));
});

test("SMTP failures do not undo reported/paid states or stock; restart/retry delivers only failed email", async (t) => {
  const f = await setup(t),
    b = body();
  await f.call("/api/checkout", b);
  await f.call(`/api/checkout/${b.requestId}/payment-reported`, {});
  f.mailer.ready = true;
  f.setFail("customer_payment_reported");
  await f.app.locals.orderEmails.flush();
  assert.equal(f.pool.state.orders.get(b.requestId).status, "payment_reported");
  assert.equal(f.pool.state.stock, 4);
  assert.equal(f.sent.length, 1);
  const failed = f.pool.state.emails.get(
    b.requestId + "|customer_payment_reported",
  );
  assert.equal(failed.status, "failed");
  assert.equal(failed.last_error, "SMTP_TEST_FAILED");
  f.setFail("");
  failed.next_attempt_at = 0;
  const restarted = createOrderEmailDispatcher(f.pool, {
    mailer: f.mailer,
    siteUrl: "http://localhost:5173",
    issueLink: (id) => grantRecovery(f.pool, id),
  });
  await restarted.flush();
  assert.equal(failed.status, "sent");
  assert.equal(f.sent.length, 2);
  const cookie = await f.login();
  f.setFail("customer_payment_confirmed");
  await f.call(
    `/api/admin/orders/${b.requestId}/action`,
    { action: "paid", confirmed: true, paymentVerified: true },
    cookie,
  );
  await f.app.locals.orderEmails.flush();
  assert.equal(f.pool.state.orders.get(b.requestId).status, "paid");
  assert.equal(f.pool.state.stock, 3);
  const confirmation = f.pool.state.emails.get(
    b.requestId + "|customer_payment_confirmed",
  );
  assert.equal(confirmation.status, "failed");
  assert.equal(
    (await f.call(`/api/admin/orders/${b.requestId}/emails/retry`, {})).status,
    401,
  );
  f.setFail("");
  assert.equal(
    (await f.call(`/api/admin/orders/${b.requestId}/emails/retry`, {}, cookie))
      .status,
    200,
  );
  await f.app.locals.orderEmails.flush();
  assert.equal(confirmation.status, "sent");
  assert.equal(f.sent.length, 3);
  assert.equal(f.pool.state.stock, 3);
});

test("two email workers claim each pending delivery once; queue failure rolls back the payment transition", async (t) => {
  const f = await setup(t),
    b = body();
  await f.call("/api/checkout", b);
  await f.call(`/api/checkout/${b.requestId}/payment-reported`, {});
  const mailer = { ready: true, send: async (m) => f.sent.push(m) };
  const worker = () =>
    createOrderEmailDispatcher(f.pool, {
      mailer,
      issueLink: (id) => grantRecovery(f.pool, id),
    });
  await Promise.all([worker().flush(), worker().flush()]);
  assert.equal(f.sent.length, 2);
  const second = body();
  await f.call("/api/checkout", second);
  const original = f.pool.getConnection;
  f.pool.getConnection = async () => {
    const db = await original();
    return {
      ...db,
      execute: async (sql, p) => {
        if (sql.startsWith("INSERT IGNORE INTO checkout_emails"))
          throw Object.assign(Error("queue failed"), {
            code: "TEST_DB_FAILURE",
          });
        return db.execute(sql, p);
      },
    };
  };
  const report = await f.call(
    `/api/checkout/${second.requestId}/payment-reported`,
    {},
  );
  assert.equal(report.status, 500);
  assert.equal(
    f.pool.state.orders.get(second.requestId).status,
    "awaiting_payment_confirmation",
  );
  assert(
    ![...f.pool.state.emails.values()].some(
      (e) => e.order_id === second.requestId,
    ),
  );
});

test("templates escape customer content and older orders without email are skipped safely", async (t) => {
  const f = await setup(t),
    b = body();
  await f.call("/api/checkout", b);
  const row = f.pool.state.orders.get(b.requestId);
  const order = JSON.parse(row.details);
  const mail = orderEmail(
    "customer_payment_confirmed",
    {
      ...order,
      name: "<script>bad</script>",
      items: [{ ...order.items[0], title: "<img onerror=evil>" }],
    },
    "http://localhost:5173/order#token=" + b.recoveryToken,
  );
  assert(!mail.html.includes("<script>"));
  assert(!mail.html.includes("<img onerror"));
  assert(mail.html.includes("&lt;script&gt;"));
  assert.equal(mail.disableFileAccess, true);
  delete order.email;
  row.details = JSON.stringify(order);
  row.status = "paid";
  await queueOrderEmails(f.pool, b.requestId, "confirmed");
  f.mailer.ready = true;
  await f.app.locals.orderEmails.flush();
  assert.equal(f.sent.length, 0);
  assert.equal(
    f.pool.state.emails.get(b.requestId + "|customer_payment_confirmed").status,
    "skipped",
  );
});

test("a fast admin confirmation supersedes the unsent review email; expired reports never enqueue mail", async (t) => {
  const f = await setup(t),
    b = body();
  await f.call("/api/checkout", b);
  await f.call(`/api/checkout/${b.requestId}/payment-reported`, {});
  const cookie = await f.login();
  await f.call(
    `/api/admin/orders/${b.requestId}/action`,
    { action: "paid", confirmed: true, paymentVerified: true },
    cookie,
  );
  f.mailer.ready = true;
  await f.app.locals.orderEmails.flush();
  assert.equal(f.sent.length, 2);
  assert.equal(
    f.pool.state.emails.get(b.requestId + "|customer_payment_reported").status,
    "skipped",
  );
  assert(f.sent.some((m) => m.subject.includes("confirmed")));
  assert(
    f.sent.some((m) => m.text.includes("already confirmed in admin")),
  );
  f.mailer.ready = false;
  const expired = body();
  await f.call("/api/checkout", expired);
  const row = f.pool.state.orders.get(expired.requestId),
    details = JSON.parse(row.details);
  details.expiresAt = new Date(Date.now() - 1000).toISOString();
  row.details = JSON.stringify(details);
  const res = await f.call(
    `/api/checkout/${expired.requestId}/payment-reported`,
    {},
  );
  assert.equal(res.status, 409);
  assert(
    ![...f.pool.state.emails.values()].some(
      (e) => e.order_id === expired.requestId,
    ),
  );
});

async function deliveryOrder(f) {
  const b = { ...body(), fulfilment: "delivery", address: "98 Arab Street", postal: "199794" };
  assert.equal((await f.call("/api/checkout", b)).status, 200);
  assert.equal((await f.call(`/api/checkout/${b.requestId}/payment-reported`, {})).status, 200);
  const cookie = await f.login();
  assert.equal((await f.call(`/api/admin/orders/${b.requestId}/action`, {
    action: "paid", confirmed: true, paymentVerified: true,
  }, cookie)).status, 200);
  const action = (value) => f.call(`/api/admin/orders/${b.requestId}/action`, { action: value, confirmed: true }, cookie);
  return { b, cookie, action };
}

test("dispatch sends the delivery estimate and follow-up contact, then completion sends one final thank-you", async (t) => {
  const f = await setup(t), { b, cookie, action } = await deliveryOrder(f);
  assert.equal(f.pool.state.emails.has(b.requestId + "|customer_order_dispatched"), false);
  f.mailer.ready = true;
  await f.app.locals.orderEmails.flush();
  const stock = f.pool.state.stock;
  const dispatch = await Promise.all([action("dispatched"), action("dispatched")]);
  assert(dispatch.every((r) => r.status === 200));
  await f.app.locals.orderEmails.flush();
  const dispatched = f.sent.filter((m) => m.messageId.includes("customer_order_dispatched"));
  assert.equal(dispatched.length, 1);
  const mail = dispatched[0];
  assert.equal(mail.from.address, "kopisrecords@gmail.com");
  assert.equal(mail.to.address, "customer@example.com");
  assert.equal(mail.replyTo, "kopisrecords@gmail.com");
  assert.match(mail.subject, /has been mailed out/);
  assert.match(mail.text, /allow 2–3 days for delivery/);
  assert.match(mail.text, /Your records have been mailed out/);
  assert.match(mail.text, /haven’t arrived after 3 days/);
  assert.match(mail.text, /reply to this email/);
  assert(!mail.text.includes("Collection / bag number:"));
  const token = mail.text.match(/\/order#token=([a-f0-9]{64})/)[1];
  const receipt = await f.call("/api/order-recovery", undefined, "", { Authorization: "Bearer " + token });
  assert.equal(receipt.value.status, "dispatched");
  assert.equal(receipt.value.qr, null);
  assert.equal(receipt.value.email, undefined);
  const detail = await f.call(`/api/admin/orders/${b.requestId}`, undefined, cookie);
  assert(detail.value.emails.some((m) => m.kind === "customer_order_dispatched" && m.status === "sent"));
  assert.equal(f.pool.state.fulfilment.get(b.requestId), "dispatched");
  assert.equal(f.sent.filter((m) => m.messageId.includes("customer_order_completed")).length, 0);
  const completed = await Promise.all([action("completed"), action("completed")]);
  assert(completed.every((r) => r.status === 200));
  await f.app.locals.orderEmails.flush();
  const thanks = f.sent.filter((m) => m.messageId.includes("customer_order_completed"));
  assert.equal(thanks.length, 1);
  assert.equal(thanks[0].to.address, "customer@example.com");
  assert.match(thanks[0].text, /Thanks for supporting/);
  assert.match(thanks[0].text, /Enjoy your records/);
  assert(!thanks[0].text.includes("has been collected"));
  assert.equal(f.pool.state.stock, stock);
  assert.equal(f.pool.state.events.filter((e) => e.action === "dispatched").length, 1);
  assert.equal(f.pool.state.events.filter((e) => e.action === "completed").length, 1);
});

test("dispatch keeps paid-delivery and admin confirmation guards; SMTP failure can be retried without changing stock", async (t) => {
  const f = await setup(t), { b, cookie, action } = await deliveryOrder(f);
  const path = `/api/admin/orders/${b.requestId}/action`;
  assert.equal((await f.call(path, { action: "dispatched", confirmed: true })).status, 401);
  assert.equal((await f.call(path, { action: "dispatched", confirmed: false }, cookie)).status, 400);
  assert.equal((await action("completed")).status, 409);
  f.mailer.ready = true;
  await f.app.locals.orderEmails.flush();
  f.setFail("customer_order_dispatched");
  assert.equal((await action("dispatched")).status, 200);
  await f.app.locals.orderEmails.flush();
  assert.equal(f.pool.state.fulfilment.get(b.requestId), "dispatched");
  const job = f.pool.state.emails.get(b.requestId + "|customer_order_dispatched");
  assert.equal(job.status, "failed");
  f.setFail("");
  await f.call(`/api/admin/orders/${b.requestId}/emails/retry`, {}, cookie);
  await f.app.locals.orderEmails.flush();
  assert.equal(job.status, "sent");
  assert.equal(f.sent.filter((m) => m.messageId.includes("customer_order_dispatched")).length, 1);
  assert.equal(f.pool.state.stock, 3);
  const collection = body();
  await f.call("/api/checkout", collection);
  await f.call(`/api/checkout/${collection.requestId}/payment-reported`, {});
  await f.call(`/api/admin/orders/${collection.requestId}/action`, { action: "paid", confirmed: true, paymentVerified: true }, cookie);
  assert.equal((await f.call(`/api/admin/orders/${collection.requestId}/action`, { action: "dispatched", confirmed: true }, cookie)).status, 409);
  assert.equal(f.pool.state.emails.has(collection.requestId + "|customer_order_dispatched"), false);
});

test("a dispatch queue failure rolls back status and event; completed orders suppress stale dispatch emails", async (t) => {
  const f = await setup(t), { b, action } = await deliveryOrder(f);
  const getConnection = f.pool.getConnection;
  f.pool.getConnection = async () => {
    const db = await getConnection();
    return { ...db, execute: async (sql, args) => {
      if (sql.startsWith("INSERT IGNORE INTO checkout_emails"))
        throw Object.assign(Error("queue failed"), { code: "TEST_QUEUE_FAILURE" });
      return db.execute(sql, args);
    } };
  };
  assert.equal((await action("dispatched")).status, 500);
  assert.equal(f.pool.state.fulfilment.has(b.requestId), false);
  assert(!f.pool.state.events.some((e) => e.action === "dispatched"));
  assert.equal(f.pool.state.emails.has(b.requestId + "|customer_order_dispatched"), false);
  f.pool.getConnection = getConnection;
  assert.equal((await action("dispatched")).status, 200);
  assert.equal((await action("completed")).status, 200);
  f.mailer.ready = true;
  await f.app.locals.orderEmails.flush();
  assert.equal(f.pool.state.emails.get(b.requestId + "|customer_order_dispatched").status, "skipped");
  assert.equal(f.sent.filter((m) => m.messageId.includes("customer_order_dispatched")).length, 0);
  assert.equal(f.sent.filter((m) => m.messageId.includes("customer_order_completed")).length, 1);
  assert.equal(f.pool.state.stock, 3);
});

test("legacy delivery orders without email finish safely, and dispatch content escapes customer text", async (t) => {
  const f = await setup(t), { b, action } = await deliveryOrder(f);
  const row = f.pool.state.orders.get(b.requestId), details = JSON.parse(row.details);
  const mail = orderEmail("customer_order_dispatched", { ...details, name: "<script>bad</script>" }, "http://localhost:5173/order#token=" + b.recoveryToken);
  assert(!mail.html.includes("<script>"));
  assert.match(mail.html, /&lt;script&gt;/);
  delete details.email;
  row.details = JSON.stringify(details);
  await action("dispatched");
  f.mailer.ready = true;
  await f.app.locals.orderEmails.flush();
  assert.equal(f.pool.state.emails.get(b.requestId + "|customer_order_dispatched").status, "skipped");
  await action("completed");
  await f.app.locals.orderEmails.flush();
  assert.equal(f.pool.state.emails.get(b.requestId + "|customer_order_completed").status, "skipped");
});
