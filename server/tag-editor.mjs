// One transaction changes tags only: stock, pricing and preorder metadata stay intact.
export function tagEditorRoutes(app, pool, requireAdmin, { transaction, allowedTags }) {
  app.post('/api/admin/tags', requireAdmin, async (req, res) => {
    const { records, add, remove } = req.body || {};
    const validTags = tags => Array.isArray(tags) && tags.every(tag => typeof tag === 'string' && allowedTags.has(tag) && tag !== 'preorder');
    if (!Array.isArray(records) || !records.length || records.length > 1000 || !validTags(add) || !validTags(remove) || !add.length && !remove.length || add.some(tag => remove.includes(tag)) || records.some(row => !Number.isSafeInteger(row?.id) || row.id <= 0 || !Array.isArray(row.expectedTags) || row.expectedTags.some(tag => typeof tag !== 'string')) || new Set(records.map(row => row.id)).size !== records.length) {
      return res.status(400).json({ error: 'Select 1–1000 records and supported tags to add or remove. Change preorder status in Edit records.' });
    }
    const key = tags => JSON.stringify([...new Set(tags)].sort());
    const read = tags => { const value = typeof tags === 'string' ? JSON.parse(tags) : tags; if (!Array.isArray(value)) throw new Error('Invalid stored tags.'); return value; };
    const saved = await transaction(pool, async db => {
      const ids = records.map(row => row.id).sort((a,b) => a-b);
      const [rows] = await db.execute(`SELECT id, tags FROM stock WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY id FOR UPDATE`, ids);
      if (rows.length !== records.length) throw Object.assign(new Error('A selected record was removed. Reload the list and try again.'), { status: 409 });
      const expected = new Map(records.map(row => [row.id, key(row.expectedTags)]));
      const updates = rows.map(row => {
        const tags = read(row.tags);
        if (key(tags) !== expected.get(row.id)) throw Object.assign(new Error('Tags changed on a selected record. Reload the list before saving again.'), { status: 409 });
        if (tags.includes('preorder') && add.includes('new_arrival')) throw Object.assign(new Error('Preorders cannot be marked New arrival. Deselect preorder records before adding that tag.'), { status: 400 });
        return { id: row.id, tags: [...new Set([...tags.filter(tag => !remove.includes(tag)), ...add])] };
      });
      for (const row of updates) await db.execute('UPDATE stock SET tags = ? WHERE id = ?', [JSON.stringify(row.tags), row.id]);
      return updates;
    });
    res.json({ records: saved });
  });
}
