import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createApp } from "./app.mjs";
import { hashPassword } from "./admin-auth.mjs";
import { databaseSessions, assertProductionSettings } from "./runtime.mjs";
import { runJobs } from "./worker.mjs";
import { database } from "./testing/fake-database.mjs";

async function endpoint(t, options, pool = { execute: async () => [[]] }) {
  const server = createApp(pool, ["https://kopisrecords.shop"], options).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  t.after(() => new Promise((r) => server.close(r)));
  return async (path, data, cookie = "") => {
    const r = await fetch(`http://127.0.0.1:${server.address().port}` + path, {
      method: data === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Request": "1", Cookie: cookie },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return { status: r.status, value: await r.json(), cookie: r.headers.get("set-cookie")?.split(";")[0] };
  };
}

test("database admin sessions survive different Passenger app processes, revoke on logout and expire", async (t) => {
  const rows = new Map();
  const pool = { async execute(sql, args) {
    if (sql.startsWith("SELECT expires_at")) return [rows.has(args[0]) ? [{ expires_at: rows.get(args[0]) }] : []];
    if (sql.startsWith("INSERT INTO admin_sessions")) rows.set(args[0], args[1]);
    else if (sql.includes("WHERE token_hash")) rows.delete(args[0]);
    else throw Error(sql);
    return [{}];
  } };
  const password = "correct-password-123", adminPasswordHash = await hashPassword(password);
  const make = () => endpoint(t, { adminPasswordHash, secureCookies: false, sessionStore: databaseSessions(pool) });
  const first = await make(), second = await make();
  const login = await first("/api/admin/login", { password });
  assert.equal(login.status, 200); assert.equal(rows.size, 1);
  const raw = login.cookie.split("=")[1];
  assert(!rows.has(raw)); assert([...rows.keys()].every((key) => /^[a-f0-9]{64}$/.test(key)));
  assert.equal((await second("/api/admin/session", undefined, login.cookie)).status, 200);
  const changed = await endpoint(t, { adminPasswordHash: await hashPassword("changed-password-123"), secureCookies: false, sessionStore: databaseSessions(pool) });
  assert.equal((await changed("/api/admin/session", undefined, login.cookie)).status, 401);
  await second("/api/admin/logout", {}, login.cookie);
  assert.equal((await first("/api/admin/session", undefined, login.cookie)).status, 401);
  const again = await first("/api/admin/login", { password });
  for (const key of rows.keys()) rows.set(key, new Date(0));
  assert.equal((await second("/api/admin/session", undefined, again.cookie)).status, 401);
});

test("the cron worker delivers a queued stock alert without starting an HTTP server", async () => {
  const pool = database(1), original = pool.getConnection;
  let released = 0, unlocked = 0, cleanup = 0;
  pool.getConnection = async () => {
    const db = await original();
    return { ...db, execute: async (sql, args) => {
      if (sql.startsWith("SELECT GET_LOCK")) return [[{ acquired: 1 }]];
      if (sql.startsWith("SELECT RELEASE_LOCK")) { unlocked++; return [[{ released: 1 }]]; }
      return db.execute(sql, args);
    }, release() { released++; db.release(); } };
  };
  const execute = pool.execute;
  pool.execute = async (sql, args) => {
    if (sql.startsWith("DELETE FROM admin_sessions")) { cleanup++; return [{}]; }
    return execute(sql, args);
  };
  const id = "44444444-4444-4444-8444-444444444444";
  pool.state.alerts.set(id, { alert_id: id, generation: "55555555-5555-4555-8555-555555555555", product_id: 1, email: "test@example.com", status: "waiting", attempts: 0, next_attempt_at: new Date(0).toISOString(), created_at: new Date().toISOString() });
  const sent = [];
  const result = await runJobs(pool, { databaseName: "test", siteUrl: "https://kopisrecords.shop", orderMailer: { ready: false }, restockMailer: { ready: true, send: async (mail) => sent.push(mail) } });
  assert.equal(result.skipped, false); assert.equal(sent.length, 1);
  assert.match(sent[0].text, /https:\/\/kopisrecords.shop\/shop\/product\/1/);
  assert.equal(pool.state.alerts.get(id).status, "sent");
  assert.equal(unlocked, 1); assert.equal(cleanup, 1); assert(released >= 1);
});

test("overlapping cron runs skip cleanly; the job lock is released if processing fails", async () => {
  let released = 0, unlocked = 0, acquired = 0;
  const pool = {
    async getConnection() {
      return { execute: async (sql) => {
        if (sql.startsWith("SELECT GET_LOCK")) return [[{ acquired }]];
        if (sql.startsWith("SELECT RELEASE_LOCK")) { unlocked++; return [[]]; }
        throw Error(sql);
      }, release() { released++; }, beginTransaction: async () => { throw Error("test job failure"); }, rollback: async () => {} };
    },
  };
  assert.equal((await runJobs(pool, { orderMailer: { ready: false }, restockMailer: { ready: false } })).skipped, true);
  assert.equal(released, 1); assert.equal(unlocked, 0);
  acquired = 1;
  await assert.rejects(runJobs(pool, { orderMailer: { ready: false }, restockMailer: { ready: false } }), /test job failure/);
  assert.equal(unlocked, 1); assert(released >= 2);
});

test("production settings reject local email links and accept the existing hosted domain", () => {
  const env = { NODE_ENV: "production", ORDER_SITE_URL: "https://kopisrecords.shop", PUBLIC_API_URL: "https://kopisrecords.shop/api", FRONTEND_ORIGINS: "https://kopisrecords.shop", ADMIN_PASSWORD_HASH: `scrypt:${'a'.repeat(32)}:${'b'.repeat(128)}`, GMAIL_APP_PASSWORD: "test-only-not-real" };
  assert.doesNotThrow(() => assertProductionSettings(env));
  assert.throws(() => assertProductionSettings({ ...env, ORDER_SITE_URL: "http://localhost:5173" }), /ORDER_SITE_URL/);
  assert.throws(() => assertProductionSettings({ ...env, ADMIN_PASSWORD_HASH: "" }), /ADMIN_PASSWORD_HASH/);
});

test("custom local cover URLs become hosted API URLs, while remote images remain unchanged", async (t) => {
  const pool = { async execute(sql) {
    if (sql.includes("SUM(quantity)")) return [[{ held: 0 }]];
    if (sql === "SELECT product_id,status,expected_arrival,version FROM product_preorders") return [[]];
    if (sql.startsWith("SELECT * FROM stock")) return [[
      { id: 1, stock: 1, price: "40.00", cover_image: "http://localhost:3001/covers/my-album.jpg" },
      { id: 2, stock: 1, price: "40.00", cover_image: "/covers/another.jpg" },
      { id: 3, stock: 1, price: "40.00", cover_image: "https://example.com/cover.jpg" },
    ]];
    throw Error(sql);
  } };
  const call = await endpoint(t, { passengerMount: "/api", publicApiUrl: "https://kopisrecords.shop/api" }, pool);
  const r = await call("/api/stock");
  assert.equal(r.status, 200);
  assert.deepEqual(r.value.map((p) => p.cover_image), ["https://kopisrecords.shop/api/covers/my-album.jpg", "https://kopisrecords.shop/api/covers/another.jpg", "https://example.com/cover.jpg"]);
});
