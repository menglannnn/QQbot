// P2/P3:认证 + 注册(邮箱验证码,经飞书 SMTP)。
import { Hono } from "hono";
import { WorkerMailer } from "worker-mailer";
import {
  scryptHash, makePasswordRecord, verifyPassword,
  createSession, destroySession, destroySessionsForUser, getSessionUser, SESSION_COOKIE,
} from "../lib/auth.js";
import { loadUser, shapePublicUser, getCookie, resolveUser, defaultAvatar, isValidQQ, requireAuth } from "../lib/rbac.js";
import { nowIso, isValidImageFileName } from "../lib/content.js";
import { buildUserHomepageProfile, DEFAULT_USER_COVER } from "../lib/profiles.js";

// 现网 D1 可能还没有 users.cover 列;每个 isolate 首次用到时守卫式补列(重复执行会抛"duplicate column",忽略即可)。
let coverColumnReady = false;
async function ensureCoverColumn(env) {
  if (coverColumnReady) return;
  try { await env.DB.prepare("ALTER TABLE users ADD COLUMN cover TEXT DEFAULT ''").run(); } catch {}
  coverColumnReady = true;
}

function imgType(name) {
  const ext = name.toLowerCase().split(".").pop();
  return { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" }[ext] || "application/octet-stream";
}

const r = new Hono();

// ---------- 校验 ----------
const isPasswordValid = (p) => typeof p === "string" && p.trim().length >= 8 && p.trim().length <= 72;
const isUsernameValid = (u) => typeof u === "string" && /^[\p{L}\p{N}_-]{2,24}$/u.test(u);
const normalizeUsername = (u) => (typeof u === "string" ? u.trim() : "");
const isValidEmail = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

// 登录:按 username / qq / email 匹配
async function loadUserForLogin(env, key) {
  return await env.DB.prepare(
    `SELECT u.*, r.level AS level, r.name AS role_name, r.permissions AS permissions
       FROM users u JOIN roles r ON r.role_key = u.role_key
      WHERE u.username = ?1 OR u.qq = ?1 OR u.email = ?1 LIMIT 1`
  ).bind(key).first();
}

// ---------- Cookie 选项 ----------
function cookieSecure(env) {
  return ["1", "true", "yes"].includes(String(env.COOKIE_SECURE ?? "").toLowerCase());
}
function setSessionCookie(c, token) {
  const secure = cookieSecure(c.env);
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${7 * 24 * 3600}`,
  ];
  if (secure) parts.push("Secure");
  c.header("Set-Cookie", parts.join("; "));
}
function clearSessionCookie(c) {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (cookieSecure(c.env)) parts.push("Secure");
  c.header("Set-Cookie", parts.join("; "));
}

// ---------- 登录限流(KV)----------
async function checkLoginLimit(env, ip) {
  const raw = await env.KV.get(`loginfail:${ip}`);
  if (!raw) return { ok: true };
  const { fails, until } = JSON.parse(raw);
  const now = Date.now();
  if (until > now) return { ok: false, retryAfterMs: until - now };
  return { ok: true, fails };
}
async function recordLoginFailure(env, ip) {
  const raw = await env.KV.get(`loginfail:${ip}`);
  const prev = raw ? JSON.parse(raw).fails : 0;
  const fails = Math.min(prev + 1, 20);
  const lockSec = Math.min(fails * fails, 60);
  await env.KV.put(`loginfail:${ip}`, JSON.stringify({ fails, until: Date.now() + lockSec * 1000 }),
    { expirationTtl: Math.max(60, lockSec) });
}
const clearLoginFailures = (env, ip) => env.KV.delete(`loginfail:${ip}`);

// ---------- 路由 ----------

// 登录
r.post("/login", async (c) => {
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  const limit = await checkLoginLimit(c.env, ip);
  if (!limit.ok) return c.json({ ok: false, retryAfterMs: limit.retryAfterMs }, 429);

  const body = await c.req.json().catch(() => ({}));
  const username = normalizeUsername(body.username);
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) return c.json({ ok: false }, 400);

  const user = await loadUserForLogin(c.env, username);
  if (!user) { await recordLoginFailure(c.env, ip); return c.json({ ok: false }, 401); }
  const ok = await verifyPassword(password, { salt: user.password_salt, hash: user.password_hash });
  if (!ok) { await recordLoginFailure(c.env, ip); return c.json({ ok: false }, 401); }

  await clearLoginFailures(c.env, ip);
  const token = await createSession(c.env, user.username);
  setSessionCookie(c, token);
  await c.env.DB.prepare("UPDATE users SET last_login_at = ? WHERE username = ?")
    .bind(nowIso(), user.username).run();
  return c.json({ ok: true, user: await shapePublicUser(c.env, user) });
});

// 登出
r.post("/logout", async (c) => {
  const token = getCookie(c.req.raw, SESSION_COOKIE);
  await destroySession(c.env, token);
  clearSessionCookie(c);
  return c.json({ ok: true });
});

// 当前用户
r.get("/me", async (c) => {
  const token = getCookie(c.req.raw, SESSION_COOKIE);
  const username = await getSessionUser(c.env, token);
  if (!username) return c.json({ ok: true, user: null });
  const user = await loadUser(c.env, username);
  if (!user) return c.json({ ok: true, user: null });
  return c.json({ ok: true, user: await shapePublicUser(c.env, user) });
});

// 改密(任何已登录用户,含 mustChangePassword)
r.post("/change-password", async (c) => {
  const token = getCookie(c.req.raw, SESSION_COOKIE);
  const username = await getSessionUser(c.env, token);
  if (!username) return c.json({ ok: false }, 401);
  const body = await c.req.json().catch(() => ({}));
  const oldPassword = typeof body.oldPassword === "string" ? body.oldPassword : "";
  if (!oldPassword || !isPasswordValid(body.newPassword)) return c.json({ ok: false }, 400);
  const user = await loadUser(c.env, username);
  if (!user) return c.json({ ok: false }, 401);
  const ok = await verifyPassword(oldPassword, { salt: user.password_salt, hash: user.password_hash });
  if (!ok) return c.json({ ok: false }, 401);
  const rec = await makePasswordRecord(body.newPassword.trim());
  await c.env.DB.prepare(
    "UPDATE users SET password_salt=?, password_hash=?, must_change_password=0, updated_at=? WHERE username=?"
  ).bind(rec.salt, rec.hash, nowIso(), username).run();
  return c.json({ ok: true });
});

// 修改自己的账户(用户名/密码,需当前密码确认)
r.patch("/account", async (c) => {
  const token = getCookie(c.req.raw, SESSION_COOKIE);
  const sessionUsername = await getSessionUser(c.env, token);
  if (!sessionUsername) return c.json({ ok: false, error: "请先登录" }, 401);
  const user = await loadUser(c.env, sessionUsername);
  if (!user) return c.json({ ok: false, error: "登录状态已失效" }, 401);

  const body = await c.req.json().catch(() => ({}));
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const requestedUsername = normalizeUsername(body.newUsername);
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  const wantsUsername = Boolean(requestedUsername) && requestedUsername !== user.username;
  const wantsPassword = Boolean(newPassword.trim());

  if (!wantsUsername && !wantsPassword) return c.json({ ok: false, error: "请至少填写一个要修改的项目" }, 400);
  if (!currentPassword) return c.json({ ok: false, error: "请输入当前密码以确认修改" }, 400);
  const ok = await verifyPassword(currentPassword, { salt: user.password_salt, hash: user.password_hash });
  if (!ok) return c.json({ ok: false, error: "当前密码不正确" }, 401);

  let nextUsername = user.username;
  if (wantsUsername) {
    if (!isUsernameValid(requestedUsername)) return c.json({ ok: false, error: "账户名仅支持 2-24 位中文、字母、数字、下划线或短横线" }, 400);
    const conflict = await c.env.DB.prepare("SELECT 1 FROM users WHERE username = ? LIMIT 1").bind(requestedUsername).first();
    if (conflict) return c.json({ ok: false, error: "该账户名已被使用" }, 409);
    nextUsername = requestedUsername;
  }
  let salt = user.password_salt, hash = user.password_hash, mustChange = user.must_change_password;
  if (wantsPassword) {
    if (!isPasswordValid(newPassword)) return c.json({ ok: false, error: "新密码长度需为 8-72 位" }, 400);
    const rec = await makePasswordRecord(newPassword.trim());
    salt = rec.salt; hash = rec.hash; mustChange = 0;
  }
  await c.env.DB.prepare(
    "UPDATE users SET username=?, password_salt=?, password_hash=?, must_change_password=?, updated_at=? WHERE username=?"
  ).bind(nextUsername, salt, hash, mustChange ? 1 : 0, nowIso(), user.username).run();
  if (wantsUsername) {
    await c.env.DB.prepare("UPDATE workshop_items SET author_username=? WHERE author_username=?")
      .bind(nextUsername, user.username).run();
  }
  // 重置会话(失效旧的,发新 cookie)
  await destroySessionsForUser(c.env, user.username);
  const newToken = await createSession(c.env, nextUsername);
  setSessionCookie(c, newToken);
  const updated = await loadUser(c.env, nextUsername);
  return c.json({ ok: true, user: await shapePublicUser(c.env, updated) });
});

// 自助修改资料(显示名/QQ/简介)。QQ 变更时,若头像是默认/QQ 头像(非自定义上传)则跟随更新
r.patch("/profile", requireAuth(), async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const displayName = (typeof body.displayName === "string" ? body.displayName.trim() : user.display_name || user.username).slice(0, 20) || user.username;
  const intro = (typeof body.intro === "string" ? body.intro.trim() : (user.intro || "")).slice(0, 80);
  const qq = typeof body.qq === "string" ? body.qq.trim() : (user.qq || "");
  if (qq && !isValidQQ(qq)) return c.json({ ok: false, error: "QQ 号格式不正确" }, 400);

  let avatar = user.avatar;
  const managed = !avatar || avatar === "/assets/logo.png" || /q\.qlogo\.cn/.test(avatar);
  if (managed) avatar = defaultAvatar(qq); // 没传过自定义头像 → 跟随 QQ
  await c.env.DB.prepare(
    "UPDATE users SET display_name=?, intro=?, qq=?, avatar=?, updated_at=? WHERE username=?"
  ).bind(displayName, intro, qq, avatar, nowIso(), user.username).run();
  const updated = await loadUser(c.env, user.username);
  return c.json({ ok: true, user: await shapePublicUser(c.env, updated) });
});

// 自助上传头像(R2,单文件)
r.post("/avatar", requireAuth(), async (c) => {
  const user = c.get("user");
  const fileName = decodeURIComponent(c.req.header("x-file-name") || "").trim();
  if (!isValidImageFileName(fileName)) return c.json({ ok: false, error: "无效头像文件" }, 400);
  const buf = await c.req.arrayBuffer();
  if (!buf || buf.byteLength === 0) return c.json({ ok: false, error: "头像文件为空" }, 400);
  if (buf.byteLength > 10 * 1024 * 1024) return c.json({ ok: false, error: "头像不能超过 10MB" }, 400);
  try {
    const listed = await c.env.R2.list({ prefix: `uploads/users/${user.username}/` });
    for (const o of listed.objects || []) await c.env.R2.delete(o.key);
  } catch {}
  const key = `uploads/users/${user.username}/${fileName}`;
  await c.env.R2.put(key, buf, { httpMetadata: { contentType: imgType(fileName) } });
  const url = `/uploads/users/${encodeURIComponent(user.username)}/${encodeURIComponent(fileName)}`;
  await c.env.DB.prepare("UPDATE users SET avatar=?, updated_at=? WHERE username=?").bind(url, nowIso(), user.username).run();
  const updated = await loadUser(c.env, user.username);
  return c.json({ ok: true, user: await shapePublicUser(c.env, updated) });
});

// 自助上传个人主页背景(封面)。存到 uploads/users/<username>/cover/ 下,单文件。
r.post("/cover", requireAuth(), async (c) => {
  const user = c.get("user");
  await ensureCoverColumn(c.env);
  const fileName = decodeURIComponent(c.req.header("x-file-name") || "").trim();
  if (!isValidImageFileName(fileName)) return c.json({ ok: false, error: "无效背景图片" }, 400);
  const buf = await c.req.arrayBuffer();
  if (!buf || buf.byteLength === 0) return c.json({ ok: false, error: "背景图片为空" }, 400);
  if (buf.byteLength > 20 * 1024 * 1024) return c.json({ ok: false, error: "背景图片不能超过 20MB" }, 400);
  try {
    const listed = await c.env.R2.list({ prefix: `uploads/users/${user.username}/cover/` });
    for (const o of listed.objects || []) await c.env.R2.delete(o.key);
  } catch {}
  const key = `uploads/users/${user.username}/cover/${fileName}`;
  await c.env.R2.put(key, buf, { httpMetadata: { contentType: imgType(fileName) } });
  const url = `/uploads/users/${encodeURIComponent(user.username)}/cover/${encodeURIComponent(fileName)}`;
  await c.env.DB.prepare("UPDATE users SET cover=?, updated_at=? WHERE username=?").bind(url, nowIso(), user.username).run();
  const updated = await loadUser(c.env, user.username);
  return c.json({ ok: true, profile: buildUserHomepageProfile(updated), user: await shapePublicUser(c.env, updated) });
});

// 恢复默认背景。
r.delete("/cover", requireAuth(), async (c) => {
  const user = c.get("user");
  await ensureCoverColumn(c.env);
  try {
    const listed = await c.env.R2.list({ prefix: `uploads/users/${user.username}/cover/` });
    for (const o of listed.objects || []) await c.env.R2.delete(o.key);
  } catch {}
  await c.env.DB.prepare("UPDATE users SET cover=?, updated_at=? WHERE username=?").bind("", nowIso(), user.username).run();
  const updated = await loadUser(c.env, user.username);
  return c.json({ ok: true, profile: buildUserHomepageProfile(updated), user: await shapePublicUser(c.env, updated) });
});

// 错误脱敏:屏蔽 SMTP 账号/密码/服务器及邮箱样式,供日志安全打印
function maskSmtpError(e, env) {
  let s = String(e);
  for (const v of [env.SMTP_PASS, env.SMTP_USER, env.SMTP_HOST]) {
    if (v) s = s.split(v).join("***");
  }
  s = s.replace(/[\w.+-]+@[\w.-]+\.\w+/g, "***@***");
  return s.slice(0, 300);
}

// ---------- 注册:发送验证码 ----------
async function sendCodeViaFeishu(env, toEmail, code) {
  const port = parseInt(env.SMTP_PORT || "465", 10);
  const mailer = await WorkerMailer.connect({
    host: env.SMTP_HOST, port, secure: port === 465, authType: "login",
    credentials: { username: env.SMTP_USER, password: env.SMTP_PASS },
  });
  try {
    await mailer.send({
      from: { name: env.FROM_NAME || "账号系统", email: env.SMTP_USER },
      to: { email: toEmail },
      subject: "你的注册验证码",
      text: `验证码:${code},10 分钟内有效,请勿泄露。`,
      html: `<p>注册验证码:<b style="font-size:22px;letter-spacing:3px">${code}</b></p><p>10 分钟内有效,请勿泄露。</p>`,
    });
  } finally {
    await mailer.close();
  }
}

r.post("/send-code", async (c) => {
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  const body = await c.req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  if (!isValidEmail(email)) return c.json({ ok: false, error: "邮箱格式不正确" }, 400);

  // IP 限流:1 小时 10 次
  const ipKey = `regip:${ip}`;
  const ipCount = parseInt((await c.env.KV.get(ipKey)) || "0", 10);
  if (ipCount >= 10) return c.json({ ok: false, error: "请求过于频繁,请稍后再试" }, 429);
  // 同邮箱冷却 60s
  if (await c.env.KV.get(`regcd:${email}`)) return c.json({ ok: false, error: "发送过于频繁,请稍后再试" }, 429);
  // 邮箱已注册?
  const exists = await c.env.DB.prepare("SELECT 1 FROM users WHERE email = ? LIMIT 1").bind(email).first();
  if (exists) return c.json({ ok: false, error: "该邮箱已注册" }, 409);

  // 先确认发信可用,再写 KV,避免占用冷却/验证码却发不出
  if (!c.env.SMTP_USER || !c.env.SMTP_PASS) return c.json({ ok: false, error: "发信未配置" }, 503);

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
  const expiresAt = Date.now() + 600 * 1000;
  await c.env.KV.put(`regcode:${email}`, JSON.stringify({ code, attempts: 0, expiresAt }), { expirationTtl: 600 });
  await c.env.KV.put(`regcd:${email}`, "1", { expirationTtl: 60 });
  await c.env.KV.put(ipKey, String(ipCount + 1), { expirationTtl: 3600 });

  try {
    await sendCodeViaFeishu(c.env, email, code);
  } catch (e) {
    // 真实错误进日志(SMTP 凭据已脱敏),对外只返回模糊提示
    console.error("[send-code] SMTP 发送失败:", maskSmtpError(e, c.env));
    await c.env.KV.delete(`regcode:${email}`);
    await c.env.KV.delete(`regcd:${email}`);
    return c.json({ ok: false, error: "验证码发送失败,请稍后重试" }, 502);
  }
  return c.json({ ok: true });
});

// ---------- 注册:校验码并建号(默认 guest)----------
r.post("/register", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const username = normalizeUsername(body.username);
  const displayName = (typeof body.displayName === "string" ? body.displayName.trim() : "").slice(0, 20);
  const email = String(body.email || "").trim().toLowerCase();
  const code = String(body.code || "").trim();
  const password = typeof body.password === "string" ? body.password : "";
  const qq = (typeof body.qq === "string" ? body.qq.trim() : ""); // 选填

  if (!isUsernameValid(username)) return c.json({ ok: false, error: "账户名仅支持 2-24 位中文、字母、数字、下划线或短横线" }, 400);
  if (!displayName) return c.json({ ok: false, error: "请填写名称" }, 400);
  if (!isValidEmail(email)) return c.json({ ok: false, error: "邮箱格式不正确" }, 400);
  if (!isPasswordValid(password)) return c.json({ ok: false, error: "密码需 8-72 位" }, 400);
  if (qq && !isValidQQ(qq)) return c.json({ ok: false, error: "QQ 号格式不正确" }, 400);

  // 校验验证码
  const raw = await c.env.KV.get(`regcode:${email}`);
  if (!raw) return c.json({ ok: false, error: "验证码已过期,请重新获取" }, 400);
  const rec = JSON.parse(raw);
  if (rec.attempts >= 5) { await c.env.KV.delete(`regcode:${email}`); return c.json({ ok: false, error: "尝试次数过多,请重新获取" }, 429); }
  if (String(rec.code) !== code) {
    rec.attempts += 1;
    // 保留原有效期,避免每次错误尝试都把 TTL 续满 10 分钟
    const remainSec = Math.max(1, Math.floor(((rec.expiresAt || Date.now()) - Date.now()) / 1000));
    await c.env.KV.put(`regcode:${email}`, JSON.stringify(rec), { expirationTtl: remainSec });
    return c.json({ ok: false, error: "验证码错误" }, 400);
  }

  // 唯一性
  const dupUser = await c.env.DB.prepare("SELECT 1 FROM users WHERE username = ? LIMIT 1").bind(username).first();
  if (dupUser) return c.json({ ok: false, error: "该账户名已存在" }, 409);
  const dupEmail = await c.env.DB.prepare("SELECT 1 FROM users WHERE email = ? LIMIT 1").bind(email).first();
  if (dupEmail) return c.json({ ok: false, error: "该邮箱已注册" }, 409);

  const pw = await makePasswordRecord(password);
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO users (username, display_name, role_key, wall_type, password_salt, password_hash,
       must_change_password, email, qq, aliases, avatar, intro, developer_slug, created_at, updated_at, last_login_at)
     VALUES (?, ?, 'guest', 'none', ?, ?, 0, ?, ?, '[]', ?, '', '', ?, ?, NULL)`
  ).bind(username, displayName, pw.salt, pw.hash, email, qq, defaultAvatar(qq), now, now).run();
  await c.env.KV.delete(`regcode:${email}`);

  const token = await createSession(c.env, username);
  setSessionCookie(c, token);
  const user = await loadUser(c.env, username);
  return c.json({ ok: true, user: await shapePublicUser(c.env, user) });
});

export default r;
