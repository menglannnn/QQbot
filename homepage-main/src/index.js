// NSUK Homepage —— Cloudflare Pages (Advanced 模式) 入口。Hono 应用。
import { Hono } from "hono";
import publicRoutes from "./routes/public.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import developersRoutes from "./routes/developers.js";
import workshopRoutes from "./routes/workshop.js";
import feedbackRoutes from "./routes/feedback.js";
import uploadsRoutes from "./routes/uploads.js";
import modRoutes from "./routes/mod.js";

const app = new Hono();

// 日志脱敏:屏蔽 env 里的敏感值与邮箱样式
function maskSecrets(s, env) {
  let out = String(s ?? "");
  for (const k of ["SMTP_PASS", "SMTP_USER", "SESSION_SECRET", "SMTP_HOST"]) {
    const v = env?.[k];
    if (v && typeof v === "string") out = out.split(v).join("***");
  }
  return out.replace(/[\w.+-]+@[\w.-]+\.\w+/g, "***@***");
}

// 全局错误中间件:对外只回通用提示 + 错误码 ref;日志记完整信息(脱敏)
app.onError((err, c) => {
  let ref = "ERR";
  try { ref = crypto.randomUUID().slice(0, 8); } catch {}
  let user = "";
  try { user = c.get("user")?.username || ""; } catch {}
  const meta = {
    ref,
    method: c.req.method,
    path: (() => { try { return new URL(c.req.url).pathname; } catch { return ""; } })(),
    ip: c.req.header("CF-Connecting-IP") || "",
    user,
    ts: new Date().toISOString(),
  };
  console.error("[error]", JSON.stringify(meta), maskSecrets(err?.stack || err, c.env));
  // 静态资源等非 /api 请求,尽量回落到资源(避免把页面变成 JSON 报错)
  if (!meta.path.startsWith("/api") && !meta.path.startsWith("/uploads")) {
    try { return c.env.ASSETS.fetch(c.req.raw); } catch {}
  }
  return c.json({ ok: false, error: "服务器开小差了,请稍后重试", ref }, 500);
});

// 健康检查 + 绑定自检
app.get("/healthz", (c) => c.json({ ok: true, ts: new Date().toISOString() }));
app.get("/api/_ping", async (c) => {
  const out = { bindings: { DB: !!c.env.DB, KV: !!c.env.KV, R2: !!c.env.R2 } };
  try {
    const r = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM roles").first();
    out.roles = r?.n ?? 0;
    const su = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role_key='superadmin'").first();
    out.superadminConfigured = (su?.n ?? 0) > 0; // 仅暴露是否已配置,不泄露用户名
  } catch (e) { console.error("[_ping] DB error:", String(e)); out.dbError = true; }
  return c.json(out);
});

// 业务路由(更具体的前缀先挂)
app.route("/api/auth", authRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/developers", developersRoutes);
app.route("/api/workshop", workshopRoutes);
app.route("/api/feedback", feedbackRoutes);
app.route("/api/mod", modRoutes);
app.route("/api", publicRoutes);
app.route("/uploads", uploadsRoutes);

// 静态资源回落(public/ 下的 html/css/assets/vendor)
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
