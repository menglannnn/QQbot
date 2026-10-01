# NSUK Homepage → 全 Cloudflare 迁移方案

把现有 Node/Express 单机应用迁到 Cloudflare,**前端 + 后端 + 数据 + 文件 + 发信全部在 CF 上**,无需自有服务器。

---

## 1. 目标架构

部署形态:**Cloudflare Pages(Advanced 模式,单个 `_worker.js`,框架用 Hono)**

```
Cloudflare Pages 项目
├── 静态资源(public/ 原封不动:html / css / assets / vendor)
└── _worker.js (Hono)  ← server.js 的所有 /api 路由迁到这里
       ├── D1   (SQLite)   account/feedback/workshop/changelog/external_mods/developers
       ├── KV   (键值)     session 存储 + 注册验证码
       ├── R2   (对象存储)  uploads/*(头像、封面、mod、gallery、workshop、feedback 文件)
       └── 飞书 SMTP        注册验证码发信(worker-mailer)
```

请求分流:静态文件由 Pages 直接命中;未命中的走 `_worker.js`,Hono 里 `/api/*` 进业务逻辑,其余 `c.env.ASSETS.fetch` 回落到静态资源。

---

## 2. 资源映射总表

| 现状(server.js) | 不兼容原因 | CF 目标 |
|---|---|---|
| Express 常驻服务 `app.listen` | 无常驻进程 | **Hono** on Worker |
| 内存 `sessions = new Map()` | Worker 无状态,Map 即丢 | **KV**:`session:{tokenHash}` → username,带 TTL |
| `data/users.json` | `fs.writeFile` 不可用(只读 FS) | **D1** 表 `users` |
| `data/feedback.json` | 同上 | **D1** 表 `feedback` |
| `data/workshop.json` | 同上 | **D1** 表 `workshop_items` |
| `public/config/changelog.json` | 同上 | **D1** 表 `changelog` |
| `public/config/external_mods.json` | 同上 | **D1** 表 `external_mods` |
| `public/config/developers.json` | 同上(admin 可改封面) | **D1** 表 `developers`(或 KV) |
| `public/config/announcements.txt` | 只读即可 | 保留为**静态文件**(或 KV,若需后台编辑) |
| `public/uploads/**` 二进制上传 | 不能写磁盘 | **R2** bucket,key 沿用原路径结构 |
| `fs.appendFile` 调试 ndjson + `watch()` | 无文件写/无 watch | **删除**(本就是开发期调试工具) |
| `require("minecraft-assets")` 运行时读包内文件 | Worker 无 node_modules 文件访问 | **预导出**用到的纹理为静态资源(见 §6 风险) |
| `prismarine-nbt` 解析 | 纯 JS,依赖 Buffer/zlib | Worker 内解析(`nodejs_compat`,需实测) |
| `three`(仅前端用) | —— | **静态 vendor 资源**,无改动 |
| `/__admin/shutdown` | 无进程可关 | 删除 |

---

## 3. 关键好消息:密码 & 会话加密**无需重做**

`server.js` 的认证用的是 Node `crypto`:`scrypt` 派生、`createHmac('sha256')` 签 session token、`randomBytes`、`timingSafeEqual`。这些在 Workers 开启 **`nodejs_compat`** 后**全部可用**。

意味着:
- **现有用户的密码哈希(salt/hash)直接导入 D1 即可,用户无需改密。**
- session token 的 HMAC 方案原样保留,只把"存哪儿"从 Map 换成 KV。

`server.js` 里这几个函数几乎可原样搬:`scryptHash` / `makePasswordRecord` / `verifyPassword` / `hashSessionToken` / `randomTokenBase64Url`。
仅 session 三件套 `createSession` / `destroySession` / `getSessionUsername` 改为读写 KV。

---

## 4. D1 表结构(由现有 JSON 推导)

```sql
-- 账号(对应 users.json)。注意:level/权限不存这里,由 role_key JOIN roles 派生(见 §10.4)
CREATE TABLE users (
  username        TEXT PRIMARY KEY,
  display_name    TEXT NOT NULL DEFAULT '',
  role_key        TEXT NOT NULL DEFAULT 'guest'    -- 引用 roles.role_key
                  REFERENCES roles(role_key),
  wall_type       TEXT NOT NULL DEFAULT 'none',
  password_salt   TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  email           TEXT DEFAULT '',                 -- 新增:注册验证码用
  qq              TEXT DEFAULT '',
  aliases         TEXT DEFAULT '[]',               -- JSON 数组
  avatar          TEXT DEFAULT '/assets/logo.png',
  intro           TEXT DEFAULT '',
  developer_slug  TEXT DEFAULT '',
  created_at      TEXT,
  updated_at      TEXT,
  last_login_at   TEXT
);

-- 反馈(对应 feedback.json)
CREATE TABLE feedback (
  id           TEXT PRIMARY KEY,
  type         TEXT DEFAULT '',
  title        TEXT DEFAULT '',
  content      TEXT DEFAULT '',
  contact      TEXT DEFAULT '',
  game_version TEXT DEFAULT '',
  mod_version  TEXT DEFAULT '',
  images       TEXT DEFAULT '[]',   -- JSON,R2 url 列表
  files        TEXT DEFAULT '[]',   -- JSON
  resolved     INTEGER DEFAULT 0,
  meta         TEXT DEFAULT '{}',   -- JSON(ip/ua)
  created_at   TEXT
);

-- 创意工坊(对应 workshop.json items)
CREATE TABLE workshop_items (
  id                  TEXT PRIMARY KEY,
  draft_id            TEXT,
  title               TEXT DEFAULT '',
  category            TEXT DEFAULT '',
  description         TEXT DEFAULT '',
  files               TEXT DEFAULT '{}',  -- JSON(nbt 等,含 R2 url)
  external_links      TEXT DEFAULT '[]',
  author_username     TEXT,
  author_display_name TEXT,
  status              TEXT DEFAULT 'pending',  -- pending/approved/rejected
  review_reason       TEXT DEFAULT '',
  reviewed_by         TEXT DEFAULT '',
  created_at          TEXT,
  updated_at          TEXT,
  reviewed_at         TEXT,
  published_at        TEXT
);

CREATE TABLE changelog (
  id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT
);
CREATE TABLE external_mods (
  id TEXT PRIMARY KEY, data TEXT NOT NULL
);
CREATE TABLE developers (
  slug TEXT PRIMARY KEY, data TEXT NOT NULL  -- developers.json 结构较复杂,整体存 JSON
);
```

> 注:changelog/external_mods/developers 结构相对自由,先用 `id + data(JSON)` 整体存,够用且迁移快;若后续要按字段查询再拆列。

---

## 5. 路由迁移清单(server.js 现有 30+ 接口)

| 分类 | 路由 | 迁移做法 |
|---|---|---|
| 公开读 | `/api/announcements` `/api/branches` `/api/mods` `/api/gallery*` `/api/walls` `/api/changelog` `/api/workshop` `/api/workshop/meta` `/api/developers/:slug` `/api/users/:username/profile` | 读 D1 / 静态 / R2 列举 |
| 认证 | `/api/auth/login` `/logout` `/me` `/change-password` | KV session + D1 users(crypto 复用) |
| **注册(新增)** | `/api/auth/register` + `/api/auth/send-code` | 验证码存 KV → 飞书 SMTP 发信 → 校验后写 D1 users |
| 用户内容 | `POST /api/workshop` `POST /api/feedback` | `c.req.formData()` 解析 → 文件 PUT 到 R2 → 写 D1 |
| 头像/封面 | `/api/admin/users` 改头像、`/api/developers/:slug/cover` | R2 上传 + D1 更新 |
| 管理 | `/api/admin/users`(增删查)`/admin/feedback` `/admin/changelog`(增删)`/admin/workshop`(审核)`/admin/mods/external`(增删) | D1 CRUD,鉴权用 KV session + role 校验 |
| 工具 | `/api/workshop/nbt-preview` | 从 R2 取 .nbt → prismarine-nbt 解析(需实测兼容) |
| 资源 | `/vendor/minecraft-assets/*` `/vendor/three/*` | 静态化(见 §6) |
| 运维 | `/healthz` | 保留;`/__admin/shutdown` `/api/debug/event` 删除 |

---

## 6. 风险点 / 需要单独处理的硬骨头

1. **minecraft-assets 运行时取纹理**(已降级,非风险)
   核实结论:`nbt-preview` **服务端不合成图片**,只用 `minecraftAssets.textureContent[key]` 按方块名查每个面的纹理,连同 `renderModel` 返回,**3D 渲染由前端 three.js 完成**。
   策略:**构建期**把 1.21.8 全套原版纹理导出为静态 PNG 放 `public/vendor/mc/1.21.8/textures/`(一两千个小图,在 Pages 2 万文件上限内,走 CDN 缓存);`blocks`/`blocksModels` 元数据(纯 JSON,几百 KB)作为静态资源或打进 bundle;`nbt-preview` 改成**返回纹理 URL 而非 base64**。→ 响应更小更快,从风险点降为"一个导出脚本 + 改返回字段"。

2. **prismarine-nbt 在 Worker 的兼容性**
   纯 JS,但依赖 `Buffer`、可能用 `zlib`(gzip 压缩的 nbt)。`nodejs_compat` 提供了 Buffer/zlib,**大概率能跑,但必须实测**一个真实 .nbt 文件。跑不通的退路:NBT 解析放前端浏览器做。

3. **上传解析**
   现有代码手动处理 multipart/文件落盘。Hono 里统一改成 `const form = await c.req.formData()`,再 `env.R2.put(key, file.stream())`。所有 `safeJoin`/`UPLOADS_DIR` 路径逻辑替换成 R2 key。

4. **R2 文件的公开访问**
   `public/uploads/...` 现在是直接静态托管。迁 R2 后,要么给 R2 bucket 绑自定义域名公开读,要么在 `_worker.js` 加一条 `/uploads/*` → `env.R2.get()` 的代理路由。建议后者,鉴权可控。

5. **跨请求内存缓存 / 写串行链**
   `ExpiringCache`、`usersWriteChain` 等 Promise 串行写,是为"单进程 + 文件写"设计的。D1 自带事务与并发控制,**这些全部删除**,直接查/写 D1。

---

## 7. wrangler 配置(Pages + 绑定)

`wrangler.toml`:
```toml
name = "nsuk-homepage"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "public"

[[d1_databases]]
binding = "DB"
database_name = "nsuk"
database_id = "<wrangler d1 create 后填>"

[[kv_namespaces]]
binding = "KV"
id = "<wrangler kv namespace create 后填>"

[[r2_buckets]]
binding = "R2"
bucket_name = "nsuk-uploads"

[vars]
SMTP_HOST = "smtp.feishu.cn"
SMTP_PORT = "465"
# secrets(命令写入,不入库):
# wrangler pages secret put SESSION_SECRET
# wrangler pages secret put SMTP_USER
# wrangler pages secret put SMTP_PASS
```

`_worker.js` 由 Hono 应用打包产出(esbuild),放在 Pages 输出目录根。

---

## 8. 数据迁移脚本

写一个本地一次性脚本 `scripts/migrate-to-d1.mjs`:
1. 读 `data/*.json` + `public/config/*.json`
2. 生成 `INSERT` 语句(或用 `wrangler d1 execute --file`)
3. 遍历 `public/uploads/**` 用 `wrangler r2 object put` 批量上传(保持 key 路径一致)

用户密码原样导入(salt/hash 不变)。

---

## 9. 分期实施(每期可独立部署验证)

**全部阶段已完成并本地验证通过(2026-06-10)。**

- **P0 脚手架** ✅ wrangler.toml(D1/KV/R2)+ Hono 骨架 `_worker.js` + schema.sql + auth/rbac 库 + 静态回落。
- **P1 只读接口** ✅ announcements/branches/mods/gallery(R2)/walls/changelog/workshop(列表+mine)/developers/:slug/users/:u/profile。
- **P2 认证 + 后台** ✅ login(KV 限流)/logout/me/change-password/account;admin 用户增删改组/角色权限配置(分级 RBAC)。
- **P3 注册 + 验证码** ✅ send-code/register(飞书 SMTP via worker-mailer,KV 存码 + 冷却 + IP 限流 + 防爆破),注册默认 guest。
- **P4 写入 + R2** ✅ workshop 投稿/上传、feedback 提交/上传、developer 资料/封面、admin 内容管理(changelog/mods/workshop 审核/feedback)、`/uploads/*` 由 R2 提供。
- **P5 NBT + 纹理** ✅ 纯 JS NBT 解析器(零依赖,避开 prismarine-nbt 的 eval)+ DecompressionStream gzip;1.21.8 全套纹理导出为静态 + 元数据驱动的纹理 URL 解析。
- **前端切换** ✅ site.js/admin.js 改用新 `level`+`permissions` 模型;capability 门控后台分区;新增「身份组权限配置」+「用户改组」UI(按层级过滤)。
- **深度审查 + 修复** ✅ 修复:feedback 表结构错配(500)、NBT 数组长度/递归深度上界(DoS)、头像上传补层级校验、`/api/_ping` 不再泄露超管名、send-code 先验配置再写 KV、注册错误码不再续命 TTL。
- **P1 只读公开接口**:announcements/mods/gallery/changelog/developers/workshop 列表 → D1+静态。前端可正常浏览。
- **P2 认证**:login/logout/me/change-password 迁 KV+D1;导入用户数据。后台能登录。
- **P3 注册 + 验证码**:接入飞书 SMTP send-code/register(复用之前 cf-auth-mailer 逻辑)。
- **P4 写入类**:feedback/workshop 提交 + 上传迁 R2;admin CRUD。
- **P5 硬骨头**:minecraft-assets 静态化 + nbt-preview;收尾删除调试代码。

---

## 10. 管理后台设计(已定稿)——分级 RBAC

### 10.1 身份组(5 级)

| role_key | level | 名称 | 数量 | 默认权限 |
|---|---|---|---|---|
| guest | 0 | 访客/普通用户 | 多 | 无(仅前台) |
| sponsor | 1 | 赞助者 | 多 | 无(展示墙 + 个人资料) |
| service | 2 | 客服 | 多 | `feedback.manage` `workshop.review` |
| admin | 3 | 管理员 | 多 | 除超管专属外的全部管理权限 |
| superadmin | 4 | 超级管理员 | **唯一,种子注入** | `*`(全部) |

### 10.2 两条核心规则(均按 level 判定)

1. **管理边界**:level=L 的操作者,只能管理/改配置**等级严格 < L** 的身份组与用户。
   - admin(3) 可管 guest/sponsor/service,**不能动其他 admin,也不能把任何人提为 admin**。
   - 授予 admin(3) 身份只有 superadmin(4) 能做。
2. **超级管理员**:权限 `*`,可配置所有人;**唯一**,提前种子注入,**任何接口都不得创建/修改/删除 superadmin 或将他人提为 superadmin**。

附加防提权:**只能授予自己拥有的权限**(`granted ⊆ actor.effectivePermissions`;superadmin 持全集不受限)。

### 10.3 权限目录(capability keys,可配置)

```
users.manage        增删用户、给低于自身等级的人分配身份组
roles.configure     配置低于自身等级身份组的权限集合
workshop.review     审核创意工坊
feedback.manage     处理/标记反馈
changelog.manage    更新日志增删
mods.manage         外部 mod 增删
developers.manage   开发者资料维护
audit.view          查看审计日志
```

### 10.4 D1:身份组表(权限可配置 → 不再硬编码)

```sql
CREATE TABLE roles (
  role_key    TEXT PRIMARY KEY,          -- guest/sponsor/service/admin/superadmin
  level       INTEGER NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  permissions TEXT NOT NULL DEFAULT '[]' -- JSON 数组;'["*"]' 表示全部
);
-- users.role_key 外键引用 roles;用户的 level / 权限从 roles 表 JOIN 得到(单一数据源)

-- 默认身份组种子
INSERT INTO roles (role_key, level, name, permissions) VALUES
 ('guest',      0, '访客',     '[]'),
 ('sponsor',    1, '赞助者',   '[]'),
 ('service',    2, '客服',     '["feedback.manage","workshop.review"]'),
 ('admin',      3, '管理员',   '["users.manage","roles.configure","workshop.review","feedback.manage","changelog.manage","mods.manage","developers.manage","audit.view"]'),
 ('superadmin', 4, '超级管理员','["*"]');
```

> `users` 表的 `permission_level` 改为**派生字段**(由 role_key JOIN roles 得到),避免双写不一致。

### 10.5 鉴权逻辑(Hono 中间件)

```js
// 取操作者有效权限
function effectivePerms(role) {
  const p = JSON.parse(role.permissions || "[]");
  return p.includes("*") ? "ALL" : new Set(p);
}
function has(actor, cap) {
  const e = effectivePerms(actor.role);
  return e === "ALL" || e.has(cap);
}
// 能否管理某个目标等级(用户或身份组)
function canManageLevel(actor, targetLevel) {
  return actor.role.level > targetLevel;   // 严格大于
}
// 分配身份:需 users.manage + 目标现等级 < 自身 + 新身份等级 < 自身 + 新增权限 ⊆ 自身
// 配置身份组权限:需 roles.configure + 该身份组等级 < 自身 + 授予项 ⊆ 自身
// superadmin 始终绕过(ALL),但 superadmin 本身不可被任何接口改动
```

接口网关:`/api/admin/*` 先过 `requireLevel(>=2)`(客服起步可进后台,但每个动作再按 capability + 层级二次校验)。

### 10.6 首个超级管理员:种子注入

不开公网 bootstrap 接口。本地跑 `scripts/make-superadmin-seed.mjs <user> <pass>`(与 server.js 同款 scrypt)生成 seed SQL,P2 阶段:
```
wrangler d1 execute nsuk --file scripts/seed-superadmin.sql --remote
```
密码不进聊天、不进仓库。**老的 5 个用户不导入。**

### 10.7 注册策略

邮箱验证码注册 → **自动 guest**(level 0),仅前台;一切特权由上级在后台按层级授予。注册接口被刷只会产生 guest,碰不到后台。

### 10.8 审计

删除原 ndjson 文件日志,改 D1 表记录后台敏感操作(谁/何时/动作/目标):
```sql
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT, action TEXT, target TEXT, detail TEXT, created_at TEXT
);
```

**前端**:`admin.html` 按 `effectivePerms` 动态显示可操作项(无权限的按钮隐藏),仍调 `/api/admin/*`。

## 11. 本地开发与运行(P0 已验证)

```bash
npm install
npm run build                 # esbuild: src/ → public/_worker.js
npx wrangler d1 execute nsuk --local --file schema.sql          # 建表+roles种子
# 生成并注入超管(密码本地输入,不进库):
node scripts/make-superadmin-seed.mjs <user> <pass> [显示名] > scripts/seed-superadmin.sql
npx wrangler d1 execute nsuk --local --file scripts/seed-superadmin.sql
npx wrangler pages dev        # 配置驱动,读 wrangler.toml 绑定;默认端口 8788
```

**坑(已踩平)**:本地 D1 按 `database_id` keying。`wrangler pages dev` 与 `wrangler d1 execute --local` **必须都走 wrangler.toml 配置**(不要给 pages dev 加 `--d1 DB=nsuk` 之类命令行参数),否则两者写到不同 sqlite 文件,表互相看不见。

自检:`curl http://127.0.0.1:8788/api/_ping` 应返回三个绑定为 true、5 个 roles、superadmin 用户名。

## 12. 上线部署(remote)

```bash
# 1) 创建云端资源,把返回 id 填进 wrangler.toml
wrangler d1 create nsuk
wrangler kv namespace create KV
wrangler r2 bucket create nsuk-uploads

# 2) 建表 + 种子(线上)
wrangler d1 execute nsuk --remote --file schema.sql
node scripts/make-superadmin-seed.mjs <用户名> <密码> <显示名> > scripts/seed-superadmin.sql
wrangler d1 execute nsuk --remote --file scripts/seed-superadmin.sql
node scripts/import-content.mjs > scripts/seed-content.sql
wrangler d1 execute nsuk --remote --file scripts/seed-content.sql

# 3) 导出 MC 纹理(进 public/vendor) + 构建
node scripts/export-mc-assets.mjs
npm run build

# 4) 上传现有 uploads/ 到 R2(gallery / developer 封面等需保留的)
#    逐个:wrangler r2 object put nsuk-uploads/<key> --file <本地路径> --remote

# 5) secrets(务必设置!)
wrangler pages secret put SESSION_SECRET   # 必须:否则会话 HMAC 退回弱默认值
wrangler pages secret put SMTP_USER        # 飞书邮箱
wrangler pages secret put SMTP_PASS        # 飞书授权码
wrangler pages secret put COOKIE_SECURE    # 设为 "1"(生产 https)

# 6) 部署
wrangler pages deploy
```

## 13. 已知遗留(低优先,不阻塞上线)

- **SESSION_SECRET 必设**:未设时 `auth.js` 退回 `"dev_secret"`(仅供本地)。生产务必 `wrangler pages secret put SESSION_SECRET`。
- **workshop 上传 draftId 未绑定用户**:draftId 为客户端随机 8–80 字符,理论上他人可猜测后往同前缀写 R2(无清理)。如需收紧:服务端签发 draftId 或 key 加 username 命名空间。
- **改名遗留头像**:`PATCH /api/auth/account` 改用户名后,旧 `/uploads/users/<旧名>/` R2 对象不会自动迁移(头像 URL 仍指向旧 key,可正常访问但 admin 端无法清理)。
- **开发者主页 `editable:true`**:公开 `GET /api/developers/:slug` 恒返回 editable:true(沿用旧行为),前端再按登录态自行判断归属。

## 14. 仍待确认(不阻塞)

- developers.json / changelog 是否需要按字段查询(决定 D1 是否拆列;默认整体存 JSON)。
- announcements 是否要后台可编辑(默认保留静态文件)。
