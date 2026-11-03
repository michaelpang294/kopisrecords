import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "./app.mjs";

test("Passenger full and stripped paths use one /api prefix and preserve queries", async (t) => {
  const calls = [];
  const pool = {
    async execute(sql, params = []) {
      calls.push({ sql, params });
      if (sql === "SELECT 1 AS ok") return [[{ ok: 1 }]];
      if (sql.includes("SUM(quantity)")) return [[{ held: 0 }]];
      if (sql.startsWith("SELECT * FROM stock"))
        return [
          [
            {
              id: 1,
              stock: 2,
              price: "36.00",
              tags: '["new_arrival"]',
              cover_image: "http://localhost:3001/covers/sample-01.svg",
            },
          ],
        ];
      throw new Error(sql);
    },
  };
  const server = createApp(pool, ["https://kopisrecords.shop"], {
    passengerMount: "/api",
    publicApiUrl: "https://kopisrecords.shop/api",
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ["/health", "/api/health"]) {
    const res = await fetch(base + path);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok", database: "connected" });
  }
  for (const path of [
    "/stock?sort=newest",
    "/api/stock?sort=newest",
    "/api/stock/1",
  ]) {
    const res = await fetch(base + path);
    assert.equal(res.status, 200);
    const body = await res.json();
    const product = Array.isArray(body) ? body[0] : body;
    assert.equal(
      product.cover_image,
      "https://kopisrecords.shop/api/covers/sample-01.svg",
    );
    assert.deepEqual(product.tags, ["new_arrival"]);
  }
  for (const path of ["/covers/sample-01.svg", "/api/covers/sample-01.svg"]) {
    const res = await fetch(base + path);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /image\/svg/);
  }
  for (const path of [
    "/stock?inventory=on-hand",
    "/api/stock?inventory=on-hand",
  ]) {
    assert.equal((await fetch(base + path)).status, 401);
  }
  const before = calls.length;
  const denied = await fetch(base + "/stock", {
    method: "POST",
    headers: {
      Origin: "https://foreign.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(denied.status, 403);
  assert.equal(calls.length, before);
  assert.equal((await fetch(base + "/.env")).status, 404);
});
