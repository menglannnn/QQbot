// P2/P4:管理后台。capability + 层级鉴权(见 rbac.js)。
import { Hono } from "hono";
import {
  requireCap, requireLevel, CAPS, shapeAdminUser, roleBadge, normalizeRoleKey,
  normalizeWallType, loadRole, loadUser, canAssignRole, canConfigureRole,
  canManageLevel, levelOf, effectivePerms, ROLE_KEYS, defaultAvatar, isValidQQ,
} from "../lib/rbac.js";
import { makePasswordRecord, destroySessionsForUser } from "../lib/auth.js";
import {
  nowIso, randomId, normalizeBranchInput, isManagedBranch,
  sanitizeChangelogEntry, sanitizeExternalModKey, normalizeExternalLink,
  parseExternalConfigEntry, normalizeWorkshopCategory, workshopRowToEntry,
  buildWorkshopItemPayload,
} from "../lib/content.js";
import { isValidImageFileName } from "../lib/content.js";

const r = new Hono();

const isUsernameValid = (u) => typeof u === "string" && /^[\p{L}\p{N}_-]{2,24}$/u.test(u);
const normalizeUsername = (u) => (typeof u === "string" ? u.trim() : "");

async function audit(env, actor, action, target, detail) {
  try {
    await env.DB.prepare(
      "INSERT INTO audit_log (actor, action, target, detail, created_at) VALUES (?,?,?,?,?)"
    ).bind(actor, action, target, detail ? JSON.stringify(detail) : null, nowIso()).run();
  } catch {}
}

// ============ 用户管理 ============
r.get("/users", requireCap(CAPS.USERS_MANAGE), async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT u.*, r.level AS level, r.name AS role_name FROM users u
       JOIN roles r ON r.role_key = u.role_key`
  ).all();
  const items = (rows.results || []).map(shapeAdminUser)
    .sort((a, b) => b.level - a.level || (a.displayName).localeCompare(b.displayName));
  return c.json({ ok: true, items });
});

// 创建用户(初始密码=用户名,需首次改密)
r.post("/users", requireCap(CAPS.USERS_MANAGE), async (c) => {
  const actor = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const username = normalizeUsername(body.username);
  const displayName = (typeof body.displayName === "string" ? body.displayName.trim() : "").slice(0, 20);
  const roleKey = normalizeRoleKey(body.roleKey);
  const wallType = normalizeWallType(body.wallType);
  const intro = (typeof body.intro === "string" ? body.intro.trim() : "").slice(0, 80);
  const qq = (typeof body.qq === "string" ? body.qq.trim() : "");

  if (!isUsernameValid(username)) return c.json({ ok: false, error: "账户名仅支持 2-24 位中文、字母、数字、下划线或短横线" }, 400);
  if (!displayName) return c.json({ ok: false, error: "请填写名称" }, 400);
  if (qq && !isValidQQ(qq)) return c.json({ ok: false, error: "QQ 号格式不正确" }, 400);

  const role = await loadRole(c.env, roleKey);
  if (!canAssignRole(actor, 0, role.level)) return c.json({ ok: false, error: "无权分配该身份组" }, 403);

  const dup = await c.env.DB.prepare("SELECT 1 FROM users WHERE username = ? LIMIT 1").bind(username).first();
  if (dup) return c.json({ ok: false, error: "该账户名已存在" }, 409);

  const pw = await makePasswordRecord(username);
  const now = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO users (username, display_name, role_key, wall_type, password_salt, password_hash,
       must_change_password, email, qq, aliases, avatar, intro, developer_slug, created_at, updated_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, '', ?, '[]', ?, ?, '', ?, ?, NULL)`
  ).bind(username, displayName, roleKey, wallType, pw.salt, pw.hash, qq, defaultAvatar(qq), intro, now, now).run();
  await audit(c.env, actor.username, "user.create", username, { roleKey });
  const row = await loadUser(c.env, username);
  return c.json({ ok: true, user: shapeAdminUser(row) });
});

// 修改用户身份组(分级授权)
r.patch("/users/:username/role", requireCap(CAPS.USERS_MANAGE), async (c) => {
  const actor = c.get("user");
  const username = normalizeUsername(c.req.param("username"));
  const body = await c.req.json().catch(() => ({}));
  const newRoleKey = normalizeRoleKey(body.roleKey);
  const target = await loadUser(c.env, username);
  if (!target) return c.json({ ok: false, error: "账户不存在" }, 404);
  const newRole = await loadRole(c.env, newRoleKey);
  if (!canAssignRole(actor, levelOf(target), newRole.level)) {
    return c.json({ ok: false, error: "无权进行该身份变更" }, 403);
  }
  const wallType = body.wallType != null ? normalizeWallType(body.wallType) : target.wall_type;
  await c.env.DB.prepare("UPDATE users SET role_key=?, wall_type=?, updated_at=? WHERE username=?")
    .bind(newRoleKey, wallType, nowIso(), username).run();
  await audit(c.env, actor.username, "user.role", username, { from: target.role_key, to: newRoleKey });
  const row = await loadUser(c.env, username);
  return c.json({ ok: true, user: shapeAdminUser(row) });
});

// 删除用户
r.delete("/users/:username", requireCap(CAPS.USERS_MANAGE), async (c) => {
  const actor = c.get("user");
  const username = normalizeUsername(c.req.param("username"));
  if (!username) return c.json({ ok: false, error: "无效账户名" }, 400);
  const target = await loadUser(c.env, username);
  if (!target) return c.json({ ok: false, error: "账户不存在" }, 404);
  if (target.username === actor.username) return c.json({ ok: false, error: "不能删除当前登录账户" }, 400);
  if (!canManageLevel(actor, levelOf(target))) return c.json({ ok: false, error: "无权删除该账户" }, 403);

  await c.env.DB.prepare("DELETE FROM users WHERE username = ?").bind(username).run();
  // 清头像 R2
  try {
    const listed = await c.env.R2.list({ prefix: `uploads/users/${username}/` });
    for (const o of listed.objects || []) await c.env.R2.delete(o.key);
  } catch {}
  await destroySessionsForUser(c.env, username);
  await audit(c.env, actor.username, "user.delete", username, null);
  return c.json({ ok: true });
});

// 头像上传(R2)
r.post("/users/:username/avatar", requireCap(CAPS.USERS_MANAGE), async (c) => {
  const actor = c.get("user");
  const username = normalizeUsername(c.req.param("username"));
  if (!isUsernameValid(username)) return c.json({ ok: false, error: "无效账户名" }, 400);
  const fileName = decodeURIComponent(c.req.header("x-file-name") || "").trim();
  if (!isValidImageFileName(fileName)) return c.json({ ok: false, error: "无效头像文件" }, 400);
  const buf = await c.req.arrayBuffer();
  if (!buf || buf.byteLength === 0) return c.json({ ok: false, error: "头像文件为空" }, 400);
  if (buf.byteLength > 10 * 1024 * 1024) return c.json({ ok: false, error: "头像不能超过 10MB" }, 400);

  const target = await loadUser(c.env, username);
  if (!target) return c.json({ ok: false, error: "账户不存在" }, 404);
  // 层级:仅能改等级低于自身者(或本人)的头像
  if (target.username !== actor.username && !canManageLevel(actor, levelOf(target))) {
    return c.json({ ok: false, error: "无权修改该账户" }, 403);
  }

  // 单文件:清空旧头像目录
  try {
    const listed = await c.env.R2.list({ prefix: `uploads/users/${username}/` });
    for (const o of listed.objects || []) await c.env.R2.delete(o.key);
  } catch {}
  const key = `uploads/users/${username}/${fileName}`;
  await c.env.R2.put(key, buf, { httpMetadata: { contentType: guessImageType(fileName) } });
  const avatarUrl = `/uploads/users/${encodeURIComponent(username)}/${encodeURIComponent(fileName)}`;
  await c.env.DB.prepare("UPDATE users SET avatar=?, updated_at=? WHERE username=?")
    .bind(avatarUrl, nowIso(), username).run();
  const row = await loadUser(c.env, username);
  return c.json({ ok: true, user: shapeAdminUser(row) });
});

// ============ 身份组配置(角色权限可配置)============
r.get("/roles", requireLevel(2), async (c) => {
  const actor = c.get("user");
  const rows = await c.env.DB.prepare("SELECT role_key, level, name, permissions FROM roles ORDER BY level").all();
  const items = (rows.results || []).map((row) => ({
    roleKey: row.role_key, level: row.level, name: row.name,
    permissions: (() => { try { return JSON.parse(row.permissions); } catch { return []; } })(),
    badge: roleBadge(row.role_key),
    manageable: canManageLevel(actor, row.level),  // 当前操作者能否配置该组
  }));
  return c.json({ ok: true, items, caps: Object.values(CAPS) });
});

// 配置某身份组的权限集合
r.patch("/roles/:roleKey", requireCap(CAPS.ROLES_CONFIGURE), async (c) => {
  const actor = c.get("user");
  const roleKey = normalizeRoleKey(c.req.param("roleKey"));
  if (roleKey === "superadmin") return c.json({ ok: false, error: "超级管理员不可修改" }, 403);
  const role = await loadRole(c.env, roleKey);
  if (!role) return c.json({ ok: false, error: "身份组不存在" }, 404);
  const body = await c.req.json().catch(() => ({}));
  const allCaps = new Set(Object.values(CAPS));
  const granted = Array.isArray(body.permissions)
    ? [...new Set(body.permissions.filter((p) => allCaps.has(p)))] : [];
  if (!canConfigureRole(actor, role.level, granted)) {
    return c.json({ ok: false, error: "无权配置该身份组或包含越权权限" }, 403);
  }
  await c.env.DB.prepare("UPDATE roles SET permissions=? WHERE role_key=?")
    .bind(JSON.stringify(granted), roleKey).run();
  await audit(c.env, actor.username, "role.configure", roleKey, { permissions: granted });
  return c.json({ ok: true });
});

// ============ 反馈 ============
r.get("/feedback", requireCap(CAPS.FEEDBACK_MANAGE), async (c) => {
  const rows = await c.env.DB.prepare("SELECT data FROM feedback ORDER BY created_at DESC").all();
  const items = (rows.results || []).map((row) => { try { return JSON.parse(row.data); } catch { return null; } }).filter(Boolean);
  return c.json({ ok: true, items });
});
r.patch("/feedback/:id", requireCap(CAPS.FEEDBACK_MANAGE), async (c) => {
  const id = (c.req.param("id") || "").trim();
  const body = await c.req.json().catch(() => ({}));
  if (!id || typeof body.resolved !== "boolean") return c.json({ ok: false }, 400);
  const row = await c.env.DB.prepare("SELECT data FROM feedback WHERE id = ?").bind(id).first();
  if (!row) return c.json({ ok: false }, 404);
  let rec; try { rec = JSON.parse(row.data); } catch { return c.json({ ok: false }, 400); }
  rec.resolved = body.resolved;
  await c.env.DB.prepare("UPDATE feedback SET data=?, resolved=? WHERE id=?")
    .bind(JSON.stringify(rec), body.resolved ? 1 : 0, id).run();
  return c.json({ ok: true });
});

// ============ changelog ============
r.get("/changelog", requireCap(CAPS.CHANGELOG_MANAGE), async (c) => {
  const rows = await c.env.DB.prepare("SELECT data FROM changelog").all();
  const items = (rows.results || []).map((row) => { try { return sanitizeChangelogEntry(JSON.parse(row.data)); } catch { return null; } })
    .filter(Boolean).sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  return c.json({ ok: true, items });
});
r.post("/changelog", requireCap(CAPS.CHANGELOG_MANAGE), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const entry = sanitizeChangelogEntry(body);
  if (!entry) return c.json({ ok: false, error: "请填写版本、标题和内容" }, 400);
  await c.env.DB.prepare("INSERT OR REPLACE INTO changelog (id, data, created_at) VALUES (?,?,?)")
    .bind(entry.id, JSON.stringify(entry), entry.createdAt).run();
  // 上限 100:删除超出的旧条目
  const all = await c.env.DB.prepare("SELECT id FROM changelog ORDER BY created_at DESC").all();
  const extra = (all.results || []).slice(100);
  for (const row of extra) await c.env.DB.prepare("DELETE FROM changelog WHERE id = ?").bind(row.id).run();
  return c.json({ ok: true, item: entry });
});
r.delete("/changelog/:id", requireCap(CAPS.CHANGELOG_MANAGE), async (c) => {
  const id = (c.req.param("id") || "").trim();
  if (!id) return c.json({ ok: false, error: "日志编号无效" }, 400);
  const row = await c.env.DB.prepare("SELECT 1 FROM changelog WHERE id = ?").bind(id).first();
  if (!row) return c.json({ ok: false, error: "日志不存在" }, 404);
  await c.env.DB.prepare("DELETE FROM changelog WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

// ============ external mods ============
r.get("/mods/external", requireCap(CAPS.MODS_MANAGE), async (c) => {
  const branch = c.req.query("branch") ? normalizeBranchInput(c.req.query("branch")) : "";
  const rows = await c.env.DB.prepare("SELECT data FROM external_mods").all();
  let items = (rows.results || []).map((row) => { try { return parseExternalConfigEntry(JSON.parse(row.data)); } catch { return null; } }).filter(Boolean);
  if (branch) items = items.filter((m) => m.branch === branch);
  return c.json({ ok: true, items });
});
r.post("/mods/external", requireCap(CAPS.MODS_MANAGE), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const branch = normalizeBranchInput(body.branch);
  if (!isManagedBranch(branch)) return c.json({ ok: false, error: "Invalid branch" }, 400);
  const fileName = sanitizeExternalModKey(body.fileName);
  if (!fileName) return c.json({ ok: false, error: "Invalid item key" }, 400);
  let links = [];
  if (Array.isArray(body.links)) {
    links = body.links.map((l, i) => normalizeExternalLink(l, i)).filter(Boolean);
    if (links.length !== body.links.length) return c.json({ ok: false, error: "Invalid external links" }, 400);
  } else if (body.externalUrl) {
    const l = normalizeExternalLink({ label: "", url: body.externalUrl }, 0);
    if (l) links = [l];
  }
  if (links.length === 0) return c.json({ ok: false, error: "At least one external link is required" }, 400);
  const entry = { branch, fileName, title: String(body.title || "").trim().slice(0, 80),
    description: String(body.description || "").trim().slice(0, 120), links, updatedAt: nowIso() };
  await c.env.DB.prepare("INSERT OR REPLACE INTO external_mods (id, data) VALUES (?, ?)")
    .bind(`${branch}::${fileName}`, JSON.stringify(entry)).run();
  return c.json({ ok: true });
});
r.delete("/mods/external", requireCap(CAPS.MODS_MANAGE), async (c) => {
  const branch = normalizeBranchInput(c.req.query("branch"));
  if (!isManagedBranch(branch)) return c.json({ ok: false, error: "Invalid branch" }, 400);
  const fileName = sanitizeExternalModKey(c.req.query("fileName"));
  if (!fileName) return c.json({ ok: false, error: "Invalid item key" }, 400);
  const id = `${branch}::${fileName}`;
  const row = await c.env.DB.prepare("SELECT 1 FROM external_mods WHERE id = ?").bind(id).first();
  if (!row) return c.json({ ok: false, error: "Not found" }, 404);
  await c.env.DB.prepare("DELETE FROM external_mods WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

// ============ 首页内容(公告等) ============
async function readSiteConfig(env, key) {
  const row = await env.DB.prepare("SELECT value FROM site_config WHERE key=?").bind(key).first();
  if (!row) return [];
  try { const a = JSON.parse(row.value); return Array.isArray(a) ? a : []; } catch { return []; }
}
r.get("/site-config", requireCap(CAPS.CHANGELOG_MANAGE), async (c) => {
  return c.json({
    ok: true,
    announcements: await readSiteConfig(c.env, "announcements"),
    features: await readSiteConfig(c.env, "features"),
  });
});
r.put("/site-config", requireCap(CAPS.CHANGELOG_MANAGE), async (c) => {
  const actor = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const announcements = Array.isArray(body.announcements)
    ? body.announcements.map((s) => String(s).trim()).filter(Boolean).slice(0, 50) : [];
  const features = Array.isArray(body.features)
    ? body.features.map((f) => ({
        icon: String(f?.icon ?? "").trim().slice(0, 8),
        title: String(f?.title ?? "").trim().slice(0, 20),
        desc: String(f?.desc ?? "").trim().slice(0, 120),
      })).filter((f) => f.title || f.desc).slice(0, 12) : [];
  await c.env.DB.prepare("INSERT OR REPLACE INTO site_config (key, value) VALUES ('announcements', ?)")
    .bind(JSON.stringify(announcements)).run();
  await c.env.DB.prepare("INSERT OR REPLACE INTO site_config (key, value) VALUES ('features', ?)")
    .bind(JSON.stringify(features)).run();
  await audit(c.env, actor.username, "site.config", "homepage", { announcements: announcements.length, features: features.length });
  return c.json({ ok: true, announcements, features });
});

// ============ 工坊审核 ============
async function workshopUserMap(env, usernames) {
  const map = new Map();
  const uniq = [...new Set(usernames.filter(Boolean))];
  if (!uniq.length) return map;
  const ph = uniq.map(() => "?").join(",");
  const rows = await env.DB.prepare(`SELECT username, display_name, developer_slug FROM users WHERE username IN (${ph})`).bind(...uniq).all();
  for (const row of rows.results || []) map.set(row.username, row);
  return map;
}
const WS_STATUS_ORDER = { pending: 0, rejected: 1, approved: 2 };
r.get("/workshop", requireCap(CAPS.WORKSHOP_REVIEW), async (c) => {
  const status = c.req.query("status") || "";
  if (status && !["approved", "rejected", "pending", "all"].includes(status)) {
    return c.json({ ok: false, error: "审核状态无效" }, 400);
  }
  let sql = "SELECT * FROM workshop_items";
  const binds = [];
  if (status && status !== "all") { sql += " WHERE status = ?"; binds.push(status); }
  const rows = await c.env.DB.prepare(sql).bind(...binds).all();
  const entries = (rows.results || []).map(workshopRowToEntry).sort(
    (a, b) => (WS_STATUS_ORDER[a.status] - WS_STATUS_ORDER[b.status]) ||
      (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)
  );
  const userMap = await workshopUserMap(c.env, entries.map((e) => e.authorUsername));
  return c.json({ ok: true, items: entries.map((e) => buildWorkshopItemPayload(e, userMap)) });
});
r.patch("/workshop/:id/review", requireCap(CAPS.WORKSHOP_REVIEW), async (c) => {
  const actor = c.get("user");
  const id = (c.req.param("id") || "").trim();
  if (!id) return c.json({ ok: false, error: "投稿编号无效" }, 400);
  const body = await c.req.json().catch(() => ({}));
  const action = body.action;
  if (action !== "approve" && action !== "reject") return c.json({ ok: false, error: "审核操作无效" }, 400);
  const reason = (typeof body.reason === "string" ? body.reason.trim() : "").slice(0, 200);
  if (action === "reject" && !reason) return c.json({ ok: false, error: "打回时必须填写原因" }, 400);

  const row = await c.env.DB.prepare("SELECT * FROM workshop_items WHERE id = ?").bind(id).first();
  if (!row) return c.json({ ok: false, error: "投稿不存在" }, 404);
  const now = nowIso();
  const status = action === "approve" ? "approved" : "rejected";
  await c.env.DB.prepare(
    `UPDATE workshop_items SET status=?, review_reason=?, reviewed_by=?, reviewed_at=?,
       published_at=?, updated_at=? WHERE id=?`
  ).bind(status, action === "reject" ? reason : "", actor.display_name || actor.username, now,
    action === "approve" ? now : null, now, id).run();
  await audit(c.env, actor.username, "workshop.review", id, { action });
  const updated = await c.env.DB.prepare("SELECT * FROM workshop_items WHERE id = ?").bind(id).first();
  const entry = workshopRowToEntry(updated);
  const userMap = await workshopUserMap(c.env, [entry.authorUsername]);
  return c.json({ ok: true, item: buildWorkshopItemPayload(entry, userMap) });
});

function guessImageType(name) {
  const ext = name.toLowerCase().split(".").pop();
  return { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" }[ext] || "application/octet-stream";
}

export default r;
