import { availableStock, checkoutRoutes } from './checkout.mjs';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';

// These names match the Product type and forms in your existing React src/.
const columns = [
  'title', 'artist', 'price', 'genre', 'cover_image', 'description',
  'medium', 'variant', 'released', 'barcode', 'stock',
];
const textLimits = {
  title: 255, artist: 255, genre: 255, cover_image: 2048,
  description: 10000, medium: 30, variant: 255, released: 30, barcode: 100,
};
const allowedMethods = new Set(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']);

function productForJson(row) {
  // MySQL DECIMAL stays exact in storage; React's Product type expects a number.
  return { ...row, price: Number(row.price) };
}

function validateProduct(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Send a JSON object containing the product fields.');
  }

  const product = {};
  for (const [field, limit] of Object.entries(textLimits)) {
    const value = body[field] ?? (field === 'medium' ? 'Vinyl' : '');
    if (typeof value !== 'string' || value.length > limit) {
      throw new Error(`${field} must be text with at most ${limit} characters.`);
    }
    product[field] = value.trim();
  }
  if (!product.title || !product.artist) {
    throw new Error('Title and artist are required.');
  }
  if (!['Vinyl', 'CD'].includes(product.medium)) {
    throw new Error('Medium must be Vinyl or CD.');
  }

  // The edit form sends numeric values as strings, so accept both forms.
  const priceText = String(body.price ?? '').trim();
  const stockText = String(body.stock ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(priceText) || Number(priceText) > 99999999.99) {
    throw new Error('Price must be a nonnegative amount with at most 2 decimal places.');
  }
  if (!/^\d+$/.test(stockText) || Number(stockText) > 4294967295) {
    throw new Error('Stock must be a nonnegative whole number up to 4294967295.');
  }
  product.price = priceText;
  product.stock = Number(stockText);
  return product;
}

function readId(value) {
  if (!/^[1-9]\d*$/.test(value) || Number(value) > 4294967295) return null;
  return Number(value);
}

export function createApp(pool, origins) {
  const app = express();
  app.disable('x-powered-by');

  // Reject foreign browser origins before writes can reach the database.
  app.use((req, res, next) => {
    const origin = req.get('Origin');
    if (origin && !origins.includes(origin)) {
      return res.status(403).json({ error: 'Frontend origin is not allowed. Check FRONTEND_ORIGINS in .env.' });
    }
    if (!allowedMethods.has(req.method)) {
      return res.status(405).json({ error: 'Method not allowed.' });
    }
    next();
  });
  app.use(cors({ origin: origins, methods: [...allowedMethods] }));
  app.use(express.json({ limit: '64kb' }));

  // Bundled local placeholders keep the sample product images working offline.
  const coversPath = fileURLToPath(new URL('./covers/', import.meta.url));
  app.use('/covers', express.static(coversPath));

  checkoutRoutes(app, pool);

  app.get('/api/health', async (req, res) => {
    await pool.execute('SELECT 1 AS ok');
    res.json({ status: 'ok', database: 'connected' });
  });

  app.get('/api/stock', async (req, res) => {
    const [rows] = await pool.execute('SELECT * FROM stock ORDER BY id DESC');
    if (req.query.inventory !== "on-hand") for (const row of rows) row.stock = await availableStock(pool,row);
    res.json(rows.map(productForJson));
  });

  app.get('/api/stock/:id', async (req, res) => {
    const id = readId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid product ID.' });
    const [rows] = await pool.execute('SELECT * FROM stock WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Product not found.' });
    if (req.query.inventory !== "on-hand") rows[0].stock = await availableStock(pool,rows[0]);
    res.json(productForJson(rows[0]));
  });

  app.post('/api/stock', async (req, res) => {
    let product;
    try {
      product = validateProduct(req.body);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    const fields = columns.map((column) => `\`${column}\``).join(', ');
    const placeholders = columns.map(() => '?').join(', ');
    const [result] = await pool.execute(
      `INSERT INTO stock (${fields}) VALUES (${placeholders})`,
      columns.map((column) => product[column]),
    );
    res.status(201).json(productForJson({ id: result.insertId, ...product }));
  });

  app.put('/api/stock/:id', async (req, res) => {
    const id = readId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid product ID.' });
    let product;
    try {
      product = validateProduct(req.body);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    const fields = columns.map((column) => `\`${column}\` = ?`).join(', ');
    const [result] = await pool.execute(
      `UPDATE stock SET ${fields} WHERE id = ?`,
      [...columns.map((column) => product[column]), id],
    );
    // MySQL reports matched rows with FOUND_ROWS (mysql2's default), including
    // an unchanged update, so saving the same values remains successful.
    if (!result.affectedRows) return res.status(404).json({ error: 'Product not found.' });
    res.json(productForJson({ id, ...product }));
  });

  app.delete('/api/stock/:id', async (req, res) => {
    const id = readId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid product ID.' });
    const [result] = await pool.execute('DELETE FROM stock WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Product not found.' });
    res.json({ message: 'Product deleted.', id });
  });

  app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON.' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request is too large.' });
    }
    console.error('API request failed:', error.code ?? error.message);
    res.status(500).json({ error: 'Database request failed. Check the backend terminal.' });
  });
  return app;
}
