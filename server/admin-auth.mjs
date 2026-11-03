import { randomBytes, createHash, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${(await derive(password, salt, 64)).toString("hex")}`;
}
export function installAdminAuth(
  app,
  {
    adminPasswordHash = process.env.ADMIN_PASSWORD_HASH,
    secureCookies = process.env.NODE_ENV === "production",
    sessionMs = 8 * 60 * 60 * 1000,
    sessionStore,
  } = {},
) {
  const sessions = new Map(),
    attempts = new Map();
  const store = sessionStore || {
    get: (key) => sessions.get(key),
    set: (key, expiry) => sessions.set(key, expiry),
    delete: (key) => sessions.delete(key),
  };
  const cookie = "kopis_admin_session",
    opts = {
      httpOnly: true,
      sameSite: "strict",
      secure: secureCookies,
      path: "/api",
    };
  const digest = (token) => createHash("sha256").update(`${adminPasswordHash}\0${token}`).digest("hex");
  function token(req) {
    const match = (req.headers.cookie || "")
      .split(";")
      .map((p) => p.trim())
      .find((p) => p.startsWith(cookie + "="));
    return match?.slice(cookie.length + 1) || "";
  }
  async function valid(req) {
    const key = digest(token(req)),
      expiry = await store.get(key);
    if (!expiry || expiry <= Date.now()) {
      await store.delete(key);
      return false;
    }
    return true;
  }
  function header(req, res, next) {
    if (req.get("X-Admin-Request") !== "1")
      return res
        .status(403)
        .json({ error: "Admin request header is required." });
    next();
  }
  app.use("/api/admin", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.post("/api/admin/login", header, async (req, res, next) => {
    try {
      if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(adminPasswordHash || ""))
        return res.status(503).json({
          error:
            "Admin sign-in is not configured. Run the password setup script and restart the server.",
        });
      const now = Date.now();
      for (const [ip, v] of attempts) if (v.until <= now) attempts.delete(ip);
      for (const [key, expiry] of sessions)
        if (expiry <= now) sessions.delete(key);
      const attempt = attempts.get(req.ip) || {
        count: 0,
        until: now + 15 * 60 * 1000,
      };
      if (attempt.count >= 5)
        return res.status(429).json({
          error: "Too many sign-in attempts. Please wait 15 minutes.",
        });
      attempt.count++;
      attempts.set(req.ip, attempt);
      const password = req.body?.password;
      if (typeof password !== "string" || password.length > 256)
        return res.status(401).json({ error: "Incorrect password." });
      const [, salt, expected] = adminPasswordHash.split(":");
      const actual = await derive(password, salt, 64);
      if (!timingSafeEqual(actual, Buffer.from(expected, "hex")))
        return res.status(401).json({ error: "Incorrect password." });
      attempts.delete(req.ip);
      await store.delete(digest(token(req)));
      const value = randomBytes(32).toString("hex");
      await store.set(digest(value), now + sessionMs);
      res
        .cookie(cookie, value, { ...opts, maxAge: sessionMs })
        .json({ authenticated: true });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/admin/session", async (req, res) => {
    const authenticated = await valid(req);
    res.status(authenticated ? 200 : 401).json({ authenticated });
  });
  app.post("/api/admin/logout", header, async (req, res) => {
    await store.delete(digest(token(req)));
    res.clearCookie(cookie, opts).json({ authenticated: false });
  });
  return async function requireAdmin(req, res, next) {
    if (!(await valid(req)))
      return res
        .status(401)
        .json({ error: "Your admin session has ended. Please sign in." });
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method))
      return header(req, res, next);
    next();
  };
}
