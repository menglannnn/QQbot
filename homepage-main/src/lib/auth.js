// 密码与会话。与旧 server.js 完全同款 scrypt(现有哈希可直接复用)。
// 会话从内存 Map 改为 KV:key = `session:${hmac(token)}` → username,带 TTL。
import crypto from "node:crypto";

export const SESSION_COOKIE = "sid";
const SESSION_TTL_SEC = 7 * 24 * 3600;

export function scryptHash(password, saltB64) {
  const salt = Buffer.from(saltB64, "base64");
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) =>
      err ? reject(err) : resolve(Buffer.from(key).toString("base64"))
    );
  });
}

export async function makePasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString("base64");
  return { salt, hash: await scryptHash(password, salt) };
}

export async function verifyPassword(password, record) {
  if (!record || typeof record.salt !== "string" || typeof record.hash !== "string") return false;
  const calc = await scryptHash(password, record.salt);
  const a = Buffer.from(record.hash, "base64");
  const b = Buffer.from(calc, "base64");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function hmac(token, secret) {
  return crypto.createHmac("sha256", secret || "dev_secret").update(token).digest("base64url");
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export async function createSession(env, username) {
  const token = randomToken();
  const h = hmac(token, env.SESSION_SECRET);
  // 主记录 + 按用户名的二级索引(用于按用户批量失效)
  await env.KV.put(`session:${h}`, username, { expirationTtl: SESSION_TTL_SEC });
  await env.KV.put(`usess:${username}:${h}`, "1", { expirationTtl: SESSION_TTL_SEC });
  return token;
}

export async function getSessionUser(env, token) {
  if (!token) return "";
  return (await env.KV.get(`session:${hmac(token, env.SESSION_SECRET)}`)) || "";
}

export async function destroySession(env, token) {
  if (!token) return;
  const h = hmac(token, env.SESSION_SECRET);
  const username = await env.KV.get(`session:${h}`);
  await env.KV.delete(`session:${h}`);
  if (username) await env.KV.delete(`usess:${username}:${h}`);
}

// 失效某用户的所有会话(删用户/封禁时)
export async function destroySessionsForUser(env, username) {
  let cursor;
  do {
    const listed = await env.KV.list({ prefix: `usess:${username}:`, cursor });
    for (const k of listed.keys) {
      const h = k.name.slice(`usess:${username}:`.length);
      await env.KV.delete(`session:${h}`);
      await env.KV.delete(k.name);
    }
    cursor = listed.list_complete ? undefined : listed.cursor;
  } while (cursor);
}
