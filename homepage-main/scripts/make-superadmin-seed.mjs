// 本地运行,生成唯一「超级管理员」的 D1 seed SQL。密码不出本机、不进仓库。
// 用法:
//   node scripts/make-superadmin-seed.mjs <username> <password> [displayName]
//   会直接写出 scripts/seed-superadmin.sql(UTF-8,无 BOM)。
// 注入(需先建好 roles/users 表):
//   wrangler d1 execute nsuk --file scripts/seed-superadmin.sql --remote
//
// 安全:superadmin 唯一,只能这样注入;任何线上接口都不得创建/修改 superadmin。

import crypto from "crypto";
import { writeFileSync } from "node:fs";

const [, , username, password, displayName] = process.argv;
if (!username || !password) {
  console.error("用法: node scripts/make-superadmin-seed.mjs <username> <password> [displayName]");
  process.exit(1);
}

function scryptHash(pw, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(pw, salt, 64, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

const salt = crypto.randomBytes(16); // 与 server.js 一致:16 字节盐
const saltB64 = salt.toString("base64");
const hashB64 = (await scryptHash(password, salt)).toString("base64");
const now = new Date().toISOString();
const u = username.replaceAll("'", "''");
const dn = (displayName || username).replaceAll("'", "''");

// 守卫:确保库里此前没有 superadmin(唯一性)。若已存在则整段不插入。
const sql = `-- 仅当尚无 superadmin 时插入(保证唯一)
INSERT INTO users
  (username, display_name, role_key, wall_type,
   password_salt, password_hash, must_change_password,
   email, qq, aliases, avatar, intro, developer_slug,
   created_at, updated_at, last_login_at)
SELECT
  '${u}', '${dn}', 'superadmin', 'none',
  '${saltB64}', '${hashB64}', 0,
  '', '', '[]', '/assets/logo.png', '', '',
  '${now}', '${now}', NULL
WHERE NOT EXISTS (SELECT 1 FROM users WHERE role_key = 'superadmin');
`;
writeFileSync("scripts/seed-superadmin.sql", sql, "utf-8");
console.log("✓ 已写出 scripts/seed-superadmin.sql(UTF-8)。下一步:");
console.log("  npx wrangler d1 execute nsuk --remote --file scripts/seed-superadmin.sql");
