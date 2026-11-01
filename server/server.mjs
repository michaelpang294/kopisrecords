import mysql from 'mysql2/promise';
import { createApp } from './app.mjs';

for (const key of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) {
  if (!process.env[key]) {
    console.error(`Missing ${key}. Copy .env.example to .env and fill in the database settings.`);
    process.exit(1);
  }
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 5,
  waitForConnections: true,
  charset: 'utf8mb4',
});

try {
  // Check the actual schema too, so a missing import is caught at startup.
  await pool.execute('SELECT id FROM stock LIMIT 1');
} catch (error) {
  console.error(`Cannot connect to the local database (${error.code ?? error.message}).`);
  console.error('Check that MySQL is running, import database/01-setup.sql, and verify .env.');
  await pool.end();
  process.exit(1);
}

const origins = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
const port = Number(process.env.API_PORT || 3001);
const app = createApp(pool, origins);
// Local testing only: bind to loopback. The frontend still calls localhost:3001.
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Kopi's Records API: http://localhost:${port}/api/stock`);
  console.log(`Database connected: ${process.env.DB_NAME}`);
  console.log('Keep this terminal open while testing your website.');
});
server.on('error', async (error) => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is in use. Stop the other backend before starting this one.`
    : error.message);
  await pool.end();
  process.exit(1);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(async () => {
    await pool.end();
    process.exit(0);
  }));
}
