// Mod 授权 API —— 校验 token + 设备指纹,管理令牌绑定
import { Hono } from "hono";
import { loadUser, requireLevel, resolveUser } from "../lib/rbac.js";
import { nowIso } from "../lib/content.js";

const r = new Hono();

// 每个 Worker 实例只建一次表（D1 冷启动兼容层）
let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS mod_tokens (
      token             TEXT PRIMARY KEY,
      username          TEXT NOT NULL REFERENCES users(username),
      bound_fingerprint TEXT,
      bound_at          TEXT,
      reset_at          TEXT,
      created_at        TEXT NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_mod_tokens_username ON mod_tokens(username)`),
  ]);
  schemaReady = true;
}

r.use("*", async (c, next) => {
  await ensureSchema(c.env.DB);
  await next();
});

// 校验 token + fingerprint (公开端点,供 mod 调用)
r.post("/validate", async (c) => {
  const { token, fingerprint } = await c.req.json().catch(() => ({}));

  if (!token || !fingerprint) {
    return c.json({ valid: false, message: "缺少 token 或 fingerprint" });
  }

  // 查询 token,JOIN users + roles 检查 level
  const row = await c.env.DB.prepare(`
    SELECT mt.*, u.username, u.display_name, r.level
    FROM mod_tokens mt
    JOIN users u ON u.username = mt.username
    JOIN roles r ON r.role_key = u.role_key
    WHERE mt.token = ?
  `).bind(token).first();

  if (!row) {
    return c.json({ valid: false, message: "token 不存在" });
  }

  // 必须是 sponsor 及以上 (level >= 1)
  if (row.level < 1) {
    return c.json({ valid: false, message: "权限不足,需要赞助者身份" });
  }

  const now = nowIso();

  // 首次使用,绑定指纹
  if (!row.bound_fingerprint) {
    await c.env.DB.prepare(`
      UPDATE mod_tokens SET bound_fingerprint = ?, bound_at = ? WHERE token = ?
    `).bind(fingerprint, now, token).run();

    return c.json({
      valid: true,
      username: row.display_name || row.username,
      message: "首次激活成功"
    });
  }

  // 已绑定,检查指纹是否匹配
  if (row.bound_fingerprint !== fingerprint) {
    return c.json({
      valid: false,
      message: "此 token 已绑定其他设备,请在网站重置绑定"
    });
  }

  // 验证通过
  return c.json({
    valid: true,
    username: row.display_name || row.username,
    message: ""
  });
});

// 获取当前用户的 token 信息 (需登录 + sponsor)
r.get("/token", requireLevel(1), async (c) => {
  const user = c.get("user");

  const row = await c.env.DB.prepare(
    "SELECT token, bound_fingerprint, bound_at, reset_at, created_at FROM mod_tokens WHERE username = ?"
  ).bind(user.username).first();

  if (!row) {
    return c.json({ ok: true, token: null });
  }

  return c.json({
    ok: true,
    token: {
      token: row.token,
      hasBound: !!row.bound_fingerprint,
      boundAt: row.bound_at,
      resetAt: row.reset_at,
      createdAt: row.created_at,
    }
  });
});

// 生成新 token (需登录 + sponsor)
r.post("/token/generate", requireLevel(1), async (c) => {
  const user = c.get("user");

  // 检查是否已有 token
  const existing = await c.env.DB.prepare(
    "SELECT token FROM mod_tokens WHERE username = ?"
  ).bind(user.username).first();

  if (existing) {
    return c.json({ ok: false, error: "已存在 token,请先删除或重置" }, 400);
  }

  const token = crypto.randomUUID();
  const now = nowIso();

  await c.env.DB.prepare(`
    INSERT INTO mod_tokens (token, username, created_at)
    VALUES (?, ?, ?)
  `).bind(token, user.username, now).run();

  return c.json({ ok: true, token });
});

// 重置设备绑定 (需登录 + sponsor,30天冷却)
r.post("/token/reset", requireLevel(1), async (c) => {
  const user = c.get("user");

  const row = await c.env.DB.prepare(
    "SELECT token, reset_at FROM mod_tokens WHERE username = ?"
  ).bind(user.username).first();

  if (!row) {
    return c.json({ ok: false, error: "未找到 token" }, 404);
  }

  // 检查冷却 (24小时)
  if (row.reset_at) {
    const lastReset = new Date(row.reset_at).getTime();
    const now = Date.now();
    const cooldownMs = 24 * 3600 * 1000;

    if (now - lastReset < cooldownMs) {
      const remainingHours = Math.ceil((cooldownMs - (now - lastReset)) / (3600 * 1000));
      return c.json({
        ok: false,
        error: `重置冷却中,还需等待 ${remainingHours} 小时`
      }, 429);
    }
  }

  const now = nowIso();
  await c.env.DB.prepare(`
    UPDATE mod_tokens
    SET bound_fingerprint = NULL, bound_at = NULL, reset_at = ?
    WHERE token = ?
  `).bind(now, row.token).run();

  return c.json({ ok: true, message: "设备绑定已重置" });
});

export default r;
