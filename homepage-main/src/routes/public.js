// P1:公开只读接口。数据源:D1 + R2 + ASSETS。
import { Hono } from "hono";
import { resolveUser, levelOf, requireAuth } from "../lib/rbac.js";
import {
  FIXED_BRANCHES, canAccessBranch, normalizeBranchInput, isManagedBranch,
  listWorkshopCategories, normalizeWorkshopCategory,
  parseExternalConfigEntry, externalModToListItem,
  sanitizeChangelogEntry, buildWorkshopItemPayload, workshopRowToEntry,
} from "../lib/content.js";
import {
  sanitizeDeveloperProfile, buildDeveloperHomepageProfile,
  buildUserHomepageProfile, buildWallPayload,
} from "../lib/profiles.js";

const r = new Hono();

// 工具:加载 username->row 映射(用于作者展示)
async function loadUserMap(env, usernames) {
  const map = new Map();
  const uniq = [...new Set(usernames.filter(Boolean))];
  if (uniq.length === 0) return map;
  const placeholders = uniq.map(() => "?").join(",");
  const rows = await env.DB.prepare(
    `SELECT username, display_name, developer_slug FROM users WHERE username IN (${placeholders})`
  ).bind(...uniq).all();
  for (const row of rows.results || []) map.set(row.username, row);
  return map;
}

// 1. 公告(优先后台配置,未配置则回落到静态文件)
r.get("/announcements", async (c) => {
  try {
    const row = await c.env.DB.prepare("SELECT value FROM site_config WHERE key='announcements'").first();
    if (row) {
      const arr = JSON.parse(row.value);
      if (Array.isArray(arr)) return c.json({ announcements: arr.map((s) => String(s).trim()).filter(Boolean) });
    }
  } catch {}
  try {
    const res = await c.env.ASSETS.fetch(new URL("/config/announcements.txt", c.req.url));
    if (!res.ok) return c.json({ announcements: [] });
    const text = await res.text();
    return c.json({ announcements: text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) });
  } catch {
    return c.json({ announcements: [] });
  }
});

// 1b. 首页特色卡片(后台可配,未配置返回空 → 前端保留静态默认)
r.get("/features", async (c) => {
  try {
    const row = await c.env.DB.prepare("SELECT value FROM site_config WHERE key='features'").first();
    if (row) {
      const arr = JSON.parse(row.value);
      if (Array.isArray(arr)) return c.json({ features: arr });
    }
  } catch {}
  return c.json({ features: [] });
});

// 2. 分支(按用户等级过滤 sponsor)
r.get("/branches", async (c) => {
  const user = await resolveUser(c);
  const level = levelOf(user);
  const branches = FIXED_BRANCHES.filter((b) => canAccessBranch(level, b));
  return c.json({ branches });
});

// 3. mods(读 external_mods 表,按 branch 过滤 + 访问校验)
r.get("/mods", async (c) => {
  const user = await resolveUser(c);
  const branch = normalizeBranchInput(c.req.query("branch"));
  if (!canAccessBranch(levelOf(user), branch)) return c.json({ ok: false, error: "Forbidden" }, 403);
  let mods = [];
  if (isManagedBranch(branch)) {
    const rows = await c.env.DB.prepare("SELECT data FROM external_mods").all();
    const parsed = (rows.results || [])
      .map((row) => { try { return parseExternalConfigEntry(JSON.parse(row.data)); } catch { return null; } })
      .filter(Boolean)
      .filter((m) => m.branch === branch);
    parsed.sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
    mods = parsed.map((m) => externalModToListItem(m, branch));
  }
  return c.json({ branch, mods });
});

// 4. gallery 分类(R2 list delimiter)
r.get("/gallery/categories", async (c) => {
  try {
    const listed = await c.env.R2.list({ prefix: "uploads/gallery/", delimiter: "/" });
    const categories = (listed.delimitedPrefixes || [])
      .map((p) => decodeURIComponent(p.replace(/^uploads\/gallery\//, "").replace(/\/$/, "")))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    return c.json({ categories });
  } catch {
    return c.json({ categories: [] });
  }
});

// 5. gallery 图片
r.get("/gallery", async (c) => {
  const category = (c.req.query("category") || "").trim();
  try {
    const prefix = category ? `uploads/gallery/${category}/` : "uploads/gallery/";
    const listed = await c.env.R2.list({ prefix, delimiter: category ? undefined : "/" });
    const images = (listed.objects || [])
      .filter((o) => /\.(png|jpe?g|webp|gif)$/i.test(o.key))
      .map((o) => ({
        fileName: o.key.split("/").pop(),
        url: "/" + o.key.split("/").map(encodeURIComponent).join("/"),
        category: category || null,
        uploaded: o.uploaded,
      }))
      .sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded))
      .map(({ uploaded, ...rest }) => rest);
    return c.json({ category: category || null, images });
  } catch {
    return c.json({ category: category || null, images: [] });
  }
});

// 6. 展示墙
r.get("/walls", async (c) => {
  const [devRows, userRows] = await Promise.all([
    c.env.DB.prepare("SELECT data FROM developers").all(),
    c.env.DB.prepare("SELECT * FROM users").all(),
  ]);
  const developerProfiles = (devRows.results || [])
    .map((row) => { try { return sanitizeDeveloperProfile(JSON.parse(row.data)); } catch { return null; } })
    .filter((p) => p && p.slug);
  const users = userRows.results || [];
  const userBySlug = new Map(users.filter((u) => u.developer_slug).map((u) => [u.developer_slug, u]));
  const devSlugs = new Set(developerProfiles.map((p) => p.slug));

  const developers = developerProfiles.map((profile) => ({ profile, linkedUser: userBySlug.get(profile.slug) || null }));
  const devAccountUsers = users.filter((u) => u.wall_type === "developer" && !devSlugs.has(u.developer_slug || ""));
  const sponsorUsers = users.filter((u) => u.wall_type === "sponsor");

  const payload = buildWallPayload({ developers, devAccountUsers, sponsorUsers });
  return c.json({ ok: true, ...payload });
});

// 7. changelog
r.get("/changelog", async (c) => {
  const rows = await c.env.DB.prepare("SELECT data FROM changelog").all();
  const items = (rows.results || [])
    .map((row) => { try { return sanitizeChangelogEntry(JSON.parse(row.data)); } catch { return null; } })
    .filter(Boolean)
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  return c.json({ ok: true, items });
});

// 8. 工坊分类
r.get("/workshop/meta", (c) => c.json({ ok: true, categories: listWorkshopCategories() }));

// 9. 工坊公开列表(approved)
r.get("/workshop", async (c) => {
  const rawCategory = c.req.query("category");
  let category = "";
  if (rawCategory != null && rawCategory !== "") {
    category = normalizeWorkshopCategory(rawCategory);
    if (!category) return c.json({ ok: false, error: "创意工坊分类无效" }, 400);
  }
  let sql = "SELECT * FROM workshop_items WHERE status = 'approved'";
  const binds = [];
  if (category) { sql += " AND category = ?"; binds.push(category); }
  const rows = await c.env.DB.prepare(sql).bind(...binds).all();
  const entries = (rows.results || []).map(workshopRowToEntry)
    .sort((a, b) => (Date.parse(b.publishedAt || b.updatedAt) || 0) - (Date.parse(a.publishedAt || a.updatedAt) || 0));
  const userMap = await loadUserMap(c.env, entries.map((e) => e.authorUsername));
  return c.json({ ok: true, categories: listWorkshopCategories(), items: entries.map((e) => buildWorkshopItemPayload(e, userMap)) });
});

// 10. 我的工坊(需登录)
r.get("/workshop/mine", requireAuth(), async (c) => {
  const user = c.get("user");
  const rows = await c.env.DB.prepare("SELECT * FROM workshop_items WHERE author_username = ?")
    .bind(user.username).all();
  const entries = (rows.results || []).map(workshopRowToEntry)
    .sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
  const userMap = await loadUserMap(c.env, entries.map((e) => e.authorUsername));
  return c.json({ ok: true, items: entries.map((e) => buildWorkshopItemPayload(e, userMap)) });
});

// 11. 开发者主页
r.get("/developers/:slug", async (c) => {
  const slug = (c.req.param("slug") || "").trim();
  const row = await c.env.DB.prepare("SELECT data FROM developers WHERE slug = ?").bind(slug).first();
  if (!row) return c.json({ ok: false, error: "Not found" }, 404);
  let profile;
  try { profile = JSON.parse(row.data); } catch { return c.json({ ok: false, error: "Not found" }, 404); }
  const mappedUser = await c.env.DB.prepare("SELECT * FROM users WHERE developer_slug = ?").bind(slug).first();
  return c.json({ ok: true, profile: buildDeveloperHomepageProfile(profile, mappedUser) });
});

// 12. 用户主页
r.get("/users/:username/profile", async (c) => {
  const username = (c.req.param("username") || "").trim();
  if (!username) return c.json({ ok: false, error: "Not found" }, 404);
  const row = await c.env.DB.prepare(
    `SELECT u.*, r.level AS level, r.permissions AS permissions FROM users u
       JOIN roles r ON r.role_key = u.role_key WHERE u.username = ?`
  ).bind(username).first();
  if (!row) return c.json({ ok: false, error: "Not found" }, 404);
  return c.json({ ok: true, profile: buildUserHomepageProfile(row) });
});

export default r;
