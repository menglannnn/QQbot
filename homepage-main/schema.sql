-- NSUK Homepage D1 schema —— 见 MIGRATION-CF.md §4 / §10
-- 应用: npm run db:local  (本地)  /  npm run db:remote  (线上)

-- ============ 身份组(权限可配置) ============
CREATE TABLE IF NOT EXISTS roles (
  role_key    TEXT PRIMARY KEY,
  level       INTEGER NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  permissions TEXT NOT NULL DEFAULT '[]'   -- JSON 数组;'["*"]' = 全部
);

INSERT OR IGNORE INTO roles (role_key, level, name, permissions) VALUES
 ('guest',      0, '访客',       '[]'),
 ('sponsor',    1, '赞助者',     '[]'),
 ('service',    2, '客服',       '["feedback.manage","workshop.review"]'),
 ('admin',      3, '管理员',     '["users.manage","roles.configure","workshop.review","feedback.manage","changelog.manage","mods.manage","developers.manage","audit.view"]'),
 ('superadmin', 4, '超级管理员', '["*"]');

-- ============ 账号(level/权限由 role_key JOIN roles 派生) ============
CREATE TABLE IF NOT EXISTS users (
  username             TEXT PRIMARY KEY,
  display_name         TEXT NOT NULL DEFAULT '',
  role_key             TEXT NOT NULL DEFAULT 'guest' REFERENCES roles(role_key),
  wall_type            TEXT NOT NULL DEFAULT 'none',
  password_salt        TEXT NOT NULL,
  password_hash        TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  email                TEXT DEFAULT '',
  qq                   TEXT DEFAULT '',
  aliases              TEXT DEFAULT '[]',
  avatar               TEXT DEFAULT '/assets/logo.png',
  intro                TEXT DEFAULT '',
  cover                TEXT DEFAULT '',
  developer_slug       TEXT DEFAULT '',
  created_at           TEXT,
  updated_at           TEXT,
  last_login_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_key);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============ 反馈(整体存 JSON,与 changelog/workshop 同风格)============
CREATE TABLE IF NOT EXISTS feedback (
  id         TEXT PRIMARY KEY,
  data       TEXT NOT NULL,       -- JSON:完整反馈记录
  resolved   INTEGER DEFAULT 0,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);

-- ============ 创意工坊 ============
CREATE TABLE IF NOT EXISTS workshop_items (
  id                  TEXT PRIMARY KEY,
  draft_id            TEXT,
  title               TEXT DEFAULT '',
  category            TEXT DEFAULT '',
  description         TEXT DEFAULT '',
  files               TEXT DEFAULT '{}',
  external_links      TEXT DEFAULT '[]',
  author_username     TEXT,
  author_display_name TEXT,
  status              TEXT DEFAULT 'pending',
  review_reason       TEXT DEFAULT '',
  reviewed_by         TEXT DEFAULT '',
  created_at          TEXT,
  updated_at          TEXT,
  reviewed_at         TEXT,
  published_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_workshop_status ON workshop_items(status);
CREATE INDEX IF NOT EXISTS idx_workshop_author ON workshop_items(author_username);

-- ============ 内容(结构自由,整体存 JSON) ============
CREATE TABLE IF NOT EXISTS changelog (
  id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT
);
CREATE TABLE IF NOT EXISTS external_mods (
  id TEXT PRIMARY KEY, data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS developers (
  slug TEXT PRIMARY KEY, data TEXT NOT NULL
);

-- ============ 站点配置(首页公告等,后台可编辑) ============
CREATE TABLE IF NOT EXISTS site_config (
  key   TEXT PRIMARY KEY,   -- 如 'announcements'
  value TEXT NOT NULL       -- JSON
);

-- ============ 审计日志 ============
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor      TEXT,
  action     TEXT,
  target     TEXT,
  detail     TEXT,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- ============ Mod 授权令牌 ============
CREATE TABLE IF NOT EXISTS mod_tokens (
  token             TEXT PRIMARY KEY,
  username          TEXT NOT NULL REFERENCES users(username),
  bound_fingerprint TEXT DEFAULT NULL,
  bound_at          TEXT DEFAULT NULL,
  reset_at          TEXT DEFAULT NULL,
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mod_tokens_username ON mod_tokens(username);
