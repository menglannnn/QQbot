// 本地一次性:把站点内容 JSON(developers/changelog/external_mods)转成 D1 seed SQL。
// 不导入旧 users(按决策从空表起步,仅种子超管)。
// 用法:
//   node scripts/import-content.mjs > scripts/seed-content.sql
//   wrangler d1 execute nsuk --local  --file scripts/seed-content.sql
//   wrangler d1 execute nsuk --remote --file scripts/seed-content.sql
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CONFIG = path.join(ROOT, "public", "config");

function readJson(p, fallback) {
  try { return JSON.parse(readFileSync(p, "utf-8")); } catch { return fallback; }
}
const q = (s) => `'${String(s).replaceAll("'", "''")}'`;
const out = [];
out.push("-- 内容导入(developers / changelog / external_mods)。users 不导入。");

// developers.json -> developers(slug, data)
const dev = readJson(path.join(CONFIG, "developers.json"), { developers: [] });
for (const d of dev.developers || []) {
  if (!d?.slug) continue;
  out.push(
    `INSERT OR REPLACE INTO developers (slug, data) VALUES (${q(d.slug)}, ${q(JSON.stringify(d))});`
  );
}

// changelog.json -> changelog(id, data, created_at)
const cl = readJson(path.join(CONFIG, "changelog.json"), { items: [] });
for (const it of cl.items || []) {
  const id = it.id || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  out.push(
    `INSERT OR REPLACE INTO changelog (id, data, created_at) VALUES (${q(id)}, ${q(JSON.stringify(it))}, ${q(it.createdAt || "")});`
  );
}

// external_mods.json -> external_mods(id, data)  (id = branch::fileName)
const em = readJson(path.join(CONFIG, "external_mods.json"), { mods: [] });
for (const m of em.mods || []) {
  const id = `${m.branch || "main"}::${m.fileName || ""}`;
  out.push(
    `INSERT OR REPLACE INTO external_mods (id, data) VALUES (${q(id)}, ${q(JSON.stringify(m))});`
  );
}

out.push(`-- developers: ${(dev.developers || []).length}, changelog: ${(cl.items || []).length}, external_mods: ${(em.mods || []).length}`);
writeFileSync("scripts/seed-content.sql", out.join("\n") + "\n", "utf-8");
console.log("✓ 已写出 scripts/seed-content.sql(UTF-8)。下一步:");
console.log("  npx wrangler d1 execute nsuk --remote --file scripts/seed-content.sql");
