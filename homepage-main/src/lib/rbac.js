// 鉴权 / 角色中心 —— 新模型(见 MIGRATION-CF.md §10)。
// 身份组等级:guest 0 / sponsor 1 / service 2 / admin 3 / superadmin 4。
// 规则:level=L 只能管理「等级严格 < L」的用户/身份组;superadmin 持 '*' 绕过。
import { getSessionUser, SESSION_COOKIE } from "./auth.js";

export const ROLE_KEYS = ["guest", "sponsor", "service", "admin", "superadmin"];

// 权限目录(capability keys)
export const CAPS = {
  USERS_MANAGE: "users.manage",
  ROLES_CONFIGURE: "roles.configure",
  WORKSHOP_REVIEW: "workshop.review",
  FEEDBACK_MANAGE: "feedback.manage",
  CHANGELOG_MANAGE: "changelog.manage",
  MODS_MANAGE: "mods.manage",
  DEVELOPERS_MANAGE: "developers.manage",
  AUDIT_VIEW: "audit.view",
};

// 身份组徽章(展示用;level/permissions 以 D1 roles 表为准)
const BADGE = {
  guest: { label: "游客", className: "is-guest", accentA: "#9ca3af", accentB: "#6b7280" },
  sponsor: { label: "赞助者", className: "is-sponsor", accentA: "#fb923c", accentB: "#ea580c" },
  service: { label: "客服", className: "is-service", accentA: "#facc15", accentB: "#eab308" },
  admin: { label: "管理员", className: "is-admin", accentA: "#22c55e", accentB: "#16a34a" },
  superadmin: { label: "超级管理员", className: "is-admin", accentA: "#f59e0b", accentB: "#d97706" },
};

export function normalizeRoleKey(v) {
  const r = String(v ?? "").trim().toLowerCase();
  return ROLE_KEYS.includes(r) ? r : "guest";
}

export function roleBadge(roleKey) {
  const key = normalizeRoleKey(roleKey);
  return { key, ...BADGE[key] };
}

export function normalizeWallType(v) {
  const r = String(v ?? "").trim().toLowerCase();
  return r === "developer" || r === "sponsor" ? r : "none";
}

export function sanitizeIntro(v) {
  return typeof v === "string" ? v.trim().slice(0, 80) : "";
}

export function isValidRelativeOrHttpUrl(v) {
  const raw = typeof v === "string" ? v.trim() : "";
  if (!raw) return false;
  if (raw.startsWith("/")) return true;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
export function sanitizeAvatar(v) {
  const raw = typeof v === "string" ? v.trim() : "";
  return raw && isValidRelativeOrHttpUrl(raw) ? raw : "/assets/logo.png";
}

// ---------- QQ 头像 ----------
export function isValidQQ(qq) {
  return typeof qq === "string" && /^\d{5,12}$/.test(qq.trim());
}
export function qqAvatarUrl(qq) {
  return `https://q.qlogo.cn/headimg_dl?dst_uin=${encodeURIComponent(qq.trim())}&spec=640`;
}
// 默认头像:填了合法 QQ 号则用 QQ 头像,否则站点 logo
export function defaultAvatar(qq) {
  return isValidQQ(qq) ? qqAvatarUrl(qq) : "/assets/logo.png";
}

// ---------- D1 用户加载 ----------
export async function loadUser(env, username) {
  if (!username) return null;
  return await env.DB.prepare(
    `SELECT u.*, r.level AS level, r.name AS role_name, r.permissions AS permissions
       FROM users u JOIN roles r ON r.role_key = u.role_key
      WHERE u.username = ?`
  ).bind(username).first();
}

export async function loadRole(env, roleKey) {
  return await env.DB.prepare(
    "SELECT role_key, level, name, permissions FROM roles WHERE role_key = ?"
  ).bind(normalizeRoleKey(roleKey)).first();
}

// ---------- 权限判定 ----------
export function effectivePerms(roleOrUser) {
  let p = [];
  try { p = JSON.parse(roleOrUser?.permissions || "[]"); } catch { p = []; }
  return p.includes("*") ? "ALL" : new Set(p);
}
export function hasPerm(user, cap) {
  const e = effectivePerms(user);
  return e === "ALL" || e.has(cap);
}
export function levelOf(user) {
  return Number(user?.level ?? 0);
}
// 能否管理某等级(严格高于)
export function canManageLevel(actor, targetLevel) {
  return levelOf(actor) > Number(targetLevel);
}
// 分配身份:需 users.manage + 目标现等级<自身 + 新身份等级<自身 + 不可授予 superadmin
export function canAssignRole(actor, targetCurrentLevel, newRoleLevel) {
  if (!hasPerm(actor, CAPS.USERS_MANAGE)) return false;
  if (Number(newRoleLevel) >= 4) return false;
  return canManageLevel(actor, targetCurrentLevel) && canManageLevel(actor, newRoleLevel);
}
// 配置身份组权限:需 roles.configure + 该组等级<自身 + 授予项 ⊆ 自身
export function canConfigureRole(actor, roleLevel, grantedPerms) {
  if (!hasPerm(actor, CAPS.ROLES_CONFIGURE)) return false;
  if (!canManageLevel(actor, roleLevel)) return false;
  const e = effectivePerms(actor);
  if (e === "ALL") return true;
  return grantedPerms.every((cap) => cap !== "*" && e.has(cap));
}

// ---------- 暴露给前端的用户形状(新模型) ----------
export async function shapePublicUser(env, row) {
  if (!row) return null;
  const badge = roleBadge(row.role_key);
  const developerSlug = (row.developer_slug || "").trim();
  let avatar = sanitizeAvatar(row.avatar);
  let profileUrl = `/profile.html?user=${encodeURIComponent(row.username)}`;
  if (developerSlug) {
    profileUrl = `/developers/${encodeURIComponent(developerSlug)}.html`;
    const dev = await env.DB.prepare("SELECT data FROM developers WHERE slug = ?")
      .bind(developerSlug).first();
    if (dev) {
      try { avatar = sanitizeAvatar(JSON.parse(dev.data)?.avatar) ; } catch {}
    }
  }
  const perms = effectivePerms(row);
  return {
    username: row.username,
    displayName: row.display_name || row.username,
    qq: row.qq ?? "",
    intro: sanitizeIntro(row.intro),
    wallType: normalizeWallType(row.wall_type),
    developerSlug,
    roleKey: badge.key,
    roleName: row.role_name || badge.label,
    level: levelOf(row),
    permissions: perms === "ALL" ? ["*"] : [...perms],
    badge,
    mustChangePassword: Boolean(row.must_change_password),
    avatar,
    cover: typeof row.cover === "string" ? row.cover : "",
    profileUrl,
  };
}

// 管理后台用的用户形状(含时间戳,不查 developer 头像)
export function shapeAdminUser(row) {
  const badge = roleBadge(row.role_key);
  return {
    username: row.username,
    displayName: row.display_name || row.username,
    qq: row.qq ?? "",
    roleKey: badge.key,
    roleName: row.role_name || badge.label,
    level: levelOf(row),
    badge,
    wallType: normalizeWallType(row.wall_type),
    intro: sanitizeIntro(row.intro),
    avatar: sanitizeAvatar(row.avatar),
    email: row.email ?? "",
    mustChangePassword: Boolean(row.must_change_password),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    lastLoginAt: row.last_login_at ?? null,
  };
}

// ---------- Hono 中间件 ----------
export function getCookie(req, name) {
  const header = req.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i <= 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return "";
}

// 解析当前会话用户(不强制),挂到 c.set("user")
export async function resolveUser(c) {
  const token = getCookie(c.req.raw, SESSION_COOKIE);
  const username = await getSessionUser(c.env, token);
  if (!username) return null;
  const user = await loadUser(c.env, username);
  c.set("user", user || null);
  return user || null;
}

// 需要登录;enforcePwChange=true 时 mustChangePassword 用户被 428 拦截
export function requireAuth({ enforcePwChange = true } = {}) {
  return async (c, next) => {
    const user = await resolveUser(c);
    if (!user) return c.json({ ok: false }, 401);
    if (enforcePwChange && user.must_change_password) {
      return c.json({ ok: false, mustChangePassword: true }, 428);
    }
    await next();
  };
}

export function requireLevel(min) {
  return async (c, next) => {
    const user = await resolveUser(c);
    if (!user) return c.json({ ok: false }, 401);
    if (user.must_change_password) return c.json({ ok: false, mustChangePassword: true }, 428);
    if (levelOf(user) < min) return c.json({ ok: false, level: levelOf(user) }, 403);
    await next();
  };
}

export function requireCap(cap) {
  return async (c, next) => {
    const user = await resolveUser(c);
    if (!user) return c.json({ ok: false }, 401);
    if (user.must_change_password) return c.json({ ok: false, mustChangePassword: true }, 428);
    if (!hasPerm(user, cap)) return c.json({ ok: false, level: levelOf(user) }, 403);
    await next();
  };
}
