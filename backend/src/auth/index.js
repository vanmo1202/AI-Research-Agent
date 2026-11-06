const express = require("express");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const db = require("../config/database");
const scrypt = promisify(crypto.scrypt);
const digest = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
const cookieName = "research_session";
const ttl = 7 * 24 * 3600 * 1000;
const error = (message, status = 400) =>
  Object.assign(new Error(message), { status });
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${(await scrypt(password, salt, 64)).toString("hex")}`;
}
async function verify(password, encoded) {
  const [salt, hash] = encoded.split(":");
  const actual = await scrypt(password, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(hash, "hex"));
}
function passwordPolicy(value) {
  if (typeof value !== "string" || value.length < 12 || value.length > 128)
    throw error("Mật khẩu cần từ 12 đến 128 ký tự.");
}
function csrf(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const allowed = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
  let origin = req.get("Origin");
  if (!origin && req.get("Referer")) {
    try {
      origin = new URL(req.get("Referer")).origin;
    } catch {}
  }
  if (origin !== allowed)
    return next(error("Nguồn yêu cầu không hợp lệ.", 403));
  next();
}
async function authenticate(req, res, next) {
  try {
    const token = (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      throw error("Vui lòng đăng nhập.", 401);
    const user = await db.get(
      `SELECT u.id,u.email,u.name,u.role,s.id session_id FROM user_sessions s
      JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL
      AND s.expires_at>? AND u.status='active'`,
      [digest(token), new Date().toISOString()],
    );
    if (!user) throw error("Phiên đăng nhập đã hết hạn.", 401);
    req.user = user;
    req.owner = user.id;
    res.set("Cache-Control", "no-store");
    next();
  } catch (e) {
    next(e);
  }
}
const windows = new Map();
function limit(req, res, next) {
  const now = Date.now();
  for (const [key, entry] of windows)
    if (entry.until < now) windows.delete(key);
  const key = req.ip;
  const entry = windows.get(key) || { count: 0, until: now + 900000 };
  windows.set(key, entry);
  if (++entry.count > Math.max(1, Number(process.env.AUTH_RATE_LIMIT) || 30))
    return res
      .status(429)
      .set("Retry-After", "900")
      .json({
        success: false,
        error: "Quá nhiều lần thử. Vui lòng thử lại sau.",
      });
  next();
}
function setCookie(res, token) {
  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.COOKIE_SECURE === "true" ||
      process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ttl,
  });
}
async function issue(res, user) {
  const token = crypto.randomBytes(32).toString("hex");
  await db.run(
    "INSERT INTO user_sessions(id,user_id,token_hash,created_at,expires_at) VALUES(?,?,?,?,?)",
    [
      crypto.randomUUID(),
      user.id,
      digest(token),
      new Date().toISOString(),
      new Date(Date.now() + ttl).toISOString(),
    ],
  );
  setCookie(res, token);
}
const router = express.Router();
router.use(csrf);
router.post("/register", limit, async (req, res) => {
  const { email, name, password } = req.body || {};
  passwordPolicy(password);
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 100
  )
    throw error("Tên hoặc email không hợp lệ.");
  const user = {
    id: crypto.randomUUID(),
    email: email.trim().toLowerCase(),
    name: name.trim(),
    role: "user",
  };
  const hash = await hashPassword(password),
    now = new Date().toISOString();
  try {
    await db.run(
      "INSERT INTO users(id,email,name,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?)",
      [user.id, user.email, user.name, hash, now, now],
    );
  } catch (e) {
    if (e.code === "SQLITE_CONSTRAINT")
      throw error("Không thể tạo tài khoản với thông tin này.");
    throw e;
  }
  await issue(res, user);
  res.status(201).json({ success: true, data: user });
});
router.post("/login", limit, async (req, res) => {
  const { email, password } = req.body || {};
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    typeof password !== "string" ||
    password.length > 128
  )
    throw error("Thông tin đăng nhập không hợp lệ.", 401);
  const user = await db.get(
    "SELECT * FROM users WHERE email=? COLLATE NOCASE",
    [email.trim()],
  );
  const valid = await verify(
    password,
    user?.password_hash || `${"0".repeat(32)}:${"0".repeat(128)}`,
  );
  if (!user || !valid || user.status !== "active")
    throw error("Thông tin đăng nhập không hợp lệ.", 401);
  await issue(res, user);
  res.json({
    success: true,
    data: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});
router.get("/me", authenticate, (req, res) => {
  const { session_id, ...user } = req.user;
  res.json({ success: true, data: user });
});
router.post("/logout", authenticate, async (req, res) => {
  await db.run("UPDATE user_sessions SET revoked_at=? WHERE id=?", [
    new Date().toISOString(),
    req.user.session_id,
  ]);
  res.clearCookie(cookieName, { path: "/" });
  res.json({ success: true, data: { loggedOut: true } });
});
router.post("/change-password", limit, authenticate, async (req, res) => {
  const { currentPassword, password } = req.body || {};
  passwordPolicy(password);
  if (typeof currentPassword !== "string" || currentPassword.length > 128)
    throw error("Mật khẩu hiện tại không hợp lệ.");
  const user = await db.get("SELECT password_hash FROM users WHERE id=?", [
    req.owner,
  ]);
  if (!(await verify(currentPassword, user.password_hash)))
    throw error("Mật khẩu hiện tại không hợp lệ.");
  const hash = await hashPassword(password),
    now = new Date().toISOString();
  await db.transaction(async (tx) => {
    await tx.run("UPDATE users SET password_hash=?,updated_at=? WHERE id=?", [
      hash,
      now,
      req.owner,
    ]);
    await tx.run("UPDATE user_sessions SET revoked_at=? WHERE user_id=?", [
      now,
      req.owner,
    ]);
  });
  await issue(res, req.user);
  res.json({ success: true, data: { changed: true } });
});
module.exports = { router, authenticate, csrf, hashPassword };
