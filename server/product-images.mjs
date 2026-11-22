// Add only the optional gallery column; existing stock and order rows stay intact.
export async function ensureProductImages(pool) {
  const [columns] = await pool.execute("SHOW COLUMNS FROM stock LIKE 'images'");
  if (columns.length) return;
  try { await pool.execute("ALTER TABLE stock ADD COLUMN images JSON NULL"); }
  catch (error) { if (error.code !== "ER_DUP_FIELDNAME") throw error; }
}
export function validateProductImages(value) {
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { throw Error("Product photos must be a list of image URLs."); }
  }
  if (!Array.isArray(value) || value.length > 20) throw Error("Add up to 20 extra product photos.");
  const images = value.map((entry) => {
    if (typeof entry !== "string" || !entry.trim() || entry.trim().length > 2048 || /[\u0000-\u001f\u007f]/.test(entry)) throw Error("Enter valid product image URLs, up to 2048 characters each.");
    const url = entry.trim();
    if (/^\/(?!\/)/.test(url) && !url.includes('\\')) return url;
    try { const parsed = new URL(url); if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw Error(); }
    catch { throw Error("Use public HTTP(S) image URLs or a path starting with /."); }
    return url;
  });
  return [...new Set(images)];
}
export function productImages(value) {
  if (value == null) return [];
  try { return validateProductImages(value); } catch { return []; }
}
