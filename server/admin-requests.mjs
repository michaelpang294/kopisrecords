const emailStatuses = new Set(["pending", "sending", "sent", "failed"]);

export function adminRequestRoutes(app, pool, requireAdmin) {
  app.get("/api/admin/record-requests", requireAdmin, async (req, res) => {
    const q = String(req.query.q || "").trim();
    const emailStatus = String(req.query.emailStatus || "");
    const requestedPage = String(req.query.page || "1");
    if (
      q.length > 200 ||
      (emailStatus && !emailStatuses.has(emailStatus)) ||
      !/^[1-9]\d{0,5}$/.test(requestedPage)
    ) {
      return res
        .status(400)
        .json({ error: "Please check the request filters." });
    }
    const where = [],
      params = [];
    if (emailStatus) {
      where.push("email_status = ?");
      params.push(emailStatus);
    }
    if (q) {
      const term = `%${q.replace(/[!%_]/g, "!$&")}%`;
      where.push(
        "(name LIKE ? ESCAPE '!' OR email LIKE ? ESCAPE '!' OR contact LIKE ? ESCAPE '!' OR record LIKE ? ESCAPE '!' OR notes LIKE ? ESCAPE '!')",
      );
      params.push(term, term, term, term, term);
    }
    const suffix = where.length ? " WHERE " + where.join(" AND ") : "";
    const [counts] = await pool.execute(
      "SELECT COUNT(*) AS total FROM record_requests" + suffix,
      params,
    );
    const total = Number(counts[0].total),
      pageSize = 25;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Number(requestedPage), totalPages);
    // Only expose customer-facing request fields to the authenticated admin.
    const [rows] = await pool.execute(
      "SELECT request_id,name,email,contact,record,notes,email_status,created_at FROM record_requests" +
        suffix +
        " ORDER BY created_at DESC, request_id DESC LIMIT ? OFFSET ?",
      [...params, pageSize, (page - 1) * pageSize],
    );
    res.set("Cache-Control", "no-store").json({
      requests: rows.map((row) => ({
        id: row.request_id,
        name: row.name,
        email: row.email,
        contact: row.contact,
        record: row.record,
        notes: row.notes,
        emailStatus: row.email_status,
        createdAt: row.created_at,
      })),
      total,
      page,
      pageSize,
      totalPages,
    });
  });
}
