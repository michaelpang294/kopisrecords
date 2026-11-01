import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from './app.mjs';

test('HTTP contract matches the existing React shop and admin forms', async (t) => {
  // Script database responses: these tests exercise HTTP behavior and binding,
  // while a live MySQL import/connection is checked separately on your computer.
  const pending = [];
  const pool = {
    async execute(sql, values = []) {
      const expected = pending.shift();
      assert.ok(expected, `Unexpected database call: ${sql}`);
      assert.match(sql, expected.sql);
      if (expected.values) assert.deepEqual(values, expected.values);
      return [expected.result];
    },
  };
  const server = createApp(pool, ['http://localhost:5173']).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const sample = {
    id: 1, title: 'Souvlaki', artist: 'Slowdive', price: '45.00', genre: 'Shoegaze',
    cover_image: 'http://localhost:3001/covers/sample-01.svg', description: 'Sample',
    medium: 'Vinyl', variant: 'Test', released: '1993', barcode: '000123', stock: 4,
  };
  const send = (method, body, extraHeaders = {}) => ({
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', ...extraHeaders },
    body: JSON.stringify(body),
  });

  pending.push({ sql: /^SELECT 1/, result: [{ ok: 1 }] });
  let res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok', database: 'connected' });

  pending.push({ sql: /^SELECT \* FROM stock ORDER BY id DESC$/, result: [sample] });
  res = await fetch(`${base}/api/stock`, { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.deepEqual(await res.json(), [{ ...sample, price: 45 }]);

  const title = "Test'); DROP TABLE stock; --";
  const form = { ...sample, title, price: '12.50', stock: '0' };
  const expectedValues = [title, 'Slowdive', '12.50', 'Shoegaze', sample.cover_image,
    'Sample', 'Vinyl', 'Test', '1993', '000123', 0];
  pending.push({ sql: /^INSERT INTO stock .*VALUES \(\?(, \?){10}\)$/, values: expectedValues, result: { insertId: 7 } });
  res = await fetch(`${base}/api/stock`, send('POST', form));
  assert.equal(res.status, 201);
  const created = await res.json();
  assert.equal(created.id, 7);
  assert.equal(created.title, title);
  assert.equal(created.price, 12.5);
  assert.equal(created.stock, 0);
  assert.equal(created.barcode, '000123');

  pending.push({ sql: /^UPDATE stock SET .* WHERE id = \?$/, values: [...expectedValues, 7], result: { affectedRows: 1 } });
  res = await fetch(`${base}/api/stock/7`, send('PUT', form));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).price, 12.5);

  pending.push({ sql: /^SELECT \* FROM stock WHERE id = \?$/, values: [7], result: [created] });
  res = await fetch(`${base}/api/stock/7`);
  assert.deepEqual(await res.json(), created);

  pending.push({ sql: /^DELETE FROM stock WHERE id = \?$/, values: [7], result: { affectedRows: 1 } });
  res = await fetch(`${base}/api/stock/7`, { method: 'DELETE' });
  assert.equal(res.status, 200);

  pending.push({ sql: /^SELECT \* FROM stock WHERE id = \?$/, values: [999], result: [] });
  res = await fetch(`${base}/api/stock/999`);
  assert.equal(res.status, 404);

  for (const invalid of [{ price: -1 }, { price: '12.345' }, { stock: -1 }, { stock: '2.5' }, { title: '' }, { medium: 'Tape' }]) {
    res = await fetch(`${base}/api/stock`, send('POST', { ...sample, ...invalid }));
    assert.equal(res.status, 400);
    assert.equal(typeof (await res.json()).error, 'string');
  }

  res = await fetch(`${base}/api/stock/0`, send('PUT', form));
  assert.equal(res.status, 400);
  res = await fetch(`${base}/api/stock`, send('POST', form, { Origin: 'https://unrelated.example' }));
  assert.equal(res.status, 403);
  res = await fetch(`${base}/api/stock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(res.status, 400);
  res = await fetch(`${base}/api/stock`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'PUT' } });
  assert.equal(res.status, 204);
  assert.match(res.headers.get('access-control-allow-methods'), /PUT/);
  res = await fetch(`${base}/covers/sample-01.svg`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Souvlaki/);
  assert.equal(pending.length, 0);
});
