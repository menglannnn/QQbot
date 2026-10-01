// 开发者自助:编辑自己的资料 / 封面(P4)。鉴权:登录 + 拥有该 slug。
import { Hono } from "hono";
import { requireAuth } from "../lib/rbac.js";
import { buildEditableDeveloperProfile, buildDeveloperHomepageProfile } from "../lib/profiles.js";
import { isValidImageFileName } from "../lib/content.js";

const r = new Hono();

// 校验:已登录且 slug 属于自己
function ownSlug(c) {
  const user = c.get("user");
  const slug = (c.req.param("slug") || "").trim();
  if (!slug || slug !== (user.developer_slug || "").trim()) return null;
  return slug;
}

async function loadProfile(env, slug) {
  const row = await env.DB.prepare("SELECT data FROM developers WHERE slug = ?").bind(slug).first();
  if (!row) return null;
  try { return JSON.parse(row.data); } catch { return null; }
}
async function saveProfile(env, slug, profile) {
  await env.DB.prepare("INSERT OR REPLACE INTO developers (slug, data) VALUES (?, ?)")
    .bind(slug, JSON.stringify(profile)).run();
}
async function mappedUser(env, slug) {
  return await env.DB.prepare("SELECT * FROM users WHERE developer_slug = ?").bind(slug).first();
}

// 编辑资料
r.patch("/:slug", requireAuth(), async (c) => {
  const slug = ownSlug(c);
  if (!slug) return c.json({ ok: false, error: "Forbidden" }, 403);
  const existing = await loadProfile(c.env, slug);
  if (!existing) return c.json({ ok: false, error: "Not found" }, 404);
  const body = await c.req.json().catch(() => ({}));
  const updated = buildEditableDeveloperProfile(existing, body);
  await saveProfile(c.env, slug, updated);
  return c.json({ ok: true, profile: buildDeveloperHomepageProfile(updated, await mappedUser(c.env, slug)) });
});

// 上传封面(R2,单文件)
r.post("/:slug/cover", requireAuth(), async (c) => {
  const slug = ownSlug(c);
  if (!slug) return c.json({ ok: false, error: "Forbidden" }, 403);
  const fileName = decodeURIComponent(c.req.header("x-file-name") || "").trim();
  if (!isValidImageFileName(fileName)) return c.json({ ok: false, error: "Invalid image file" }, 400);
  const buf = await c.req.arrayBuffer();
  if (!buf || buf.byteLength === 0) return c.json({ ok: false, error: "Empty image" }, 400);
  if (buf.byteLength > 20 * 1024 * 1024) return c.json({ ok: false, error: "封面不能超过 20MB" }, 400);
  const existing = await loadProfile(c.env, slug);
  if (!existing) return c.json({ ok: false, error: "Not found" }, 404);

  try {
    const listed = await c.env.R2.list({ prefix: `uploads/developers/${slug}/` });
    for (const o of listed.objects || []) await c.env.R2.delete(o.key);
  } catch {}
  const key = `uploads/developers/${slug}/${fileName}`;
  await c.env.R2.put(key, buf, { httpMetadata: { contentType: imgType(fileName) } });
  const coverUrl = `/uploads/developers/${encodeURIComponent(slug)}/${encodeURIComponent(fileName)}`;
  const updated = buildEditableDeveloperProfile(existing, { cover: coverUrl });
  await saveProfile(c.env, slug, updated);
  return c.json({ ok: true, profile: buildDeveloperHomepageProfile(updated, await mappedUser(c.env, slug)) });
});

// 删除封面
r.delete("/:slug/cover", requireAuth(), async (c) => {
  const slug = ownSlug(c);
  if (!slug) return c.json({ ok: false, error: "Forbidden" }, 403);
  const existing = await loadProfile(c.env, slug);
  if (!existing) return c.json({ ok: false, error: "Not found" }, 404);
  try {
    const listed = await c.env.R2.list({ prefix: `uploads/developers/${slug}/` });
    for (const o of listed.objects || []) await c.env.R2.delete(o.key);
  } catch {}
  const updated = buildEditableDeveloperProfile(existing, { cover: "/assets/logo.png" });
  await saveProfile(c.env, slug, updated);
  return c.json({ ok: true, profile: buildDeveloperHomepageProfile(updated, await mappedUser(c.env, slug)) });
});

function imgType(name) {
  const ext = name.toLowerCase().split(".").pop();
  return { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" }[ext] || "application/octet-stream";
}

export default r;
