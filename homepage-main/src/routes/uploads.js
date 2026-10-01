// 服务 /uploads/* —— 从 R2 读取(替代旧 express.static),带边缘缓存。
// 规模化建议:给 R2 桶绑自定义域名,让图片直接走 R2 CDN、不经过本 Worker。
// 该路由作为回落/无自定义域名时仍可用。
import { Hono } from "hono";

const r = new Hono();

function guessType(key) {
  const ext = key.toLowerCase().split(".").pop();
  return {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
    nbt: "application/octet-stream", json: "application/json", txt: "text/plain; charset=utf-8",
  }[ext] || "application/octet-stream";
}

r.get("/*", async (c) => {
  const request = c.req.raw;
  const cache = caches.default;

  const path = new URL(c.req.url).pathname;
  const key = path.replace(/^\/+/, "").split("/").map(decodeURIComponent).join("/");
  if (!key.startsWith("uploads/")) return c.notFound();
  // 工坊 NBT 仅提供在线预览(经 /api/workshop/nbt-preview 服务端解析),禁止直链下载;下载请走作品外链。
  // 放在边缘缓存查询之前,避免历史缓存条目绕过该限制。
  if (/^uploads\/workshop\/[^/]+\/nbt\//.test(key)) {
    return c.json({ ok: false, error: "NBT 文件仅提供在线预览,下载请使用作品的站外下载链接" }, 403);
  }

  // 命中边缘缓存直接返回,不打 R2
  const cached = await cache.match(request);
  if (cached) return cached;
  const obj = await c.env.R2.get(key);
  if (!obj) return c.notFound();

  const headers = new Headers();
  headers.set("Content-Type", obj.httpMetadata?.contentType || guessType(key));
  headers.set("Cache-Control", "public, max-age=86400");
  if (obj.httpEtag) headers.set("ETag", obj.httpEtag);
  const res = new Response(obj.body, { headers });
  // 写入边缘缓存(后台进行,不阻塞响应)
  c.executionCtx.waitUntil(cache.put(request, res.clone()));
  return res;
});

export default r;
