// 开发者主页 / 用户主页 / 展示墙 构建器。忠实移植 server.js 的 profile 形状。
import { roleBadge, normalizeWallType, sanitizeIntro, sanitizeAvatar, levelOf } from "./rbac.js";

// 用户主页默认背景:清晰的站点大图(而不是被拉伸糊掉的 logo)。
export const DEFAULT_USER_COVER = "/assets/hero-bottom.png";

const THEME_PRESETS = new Set(["custom", "starry", "gothic", "cream", "bluewhite"]);
const FONT_PRESETS = new Set(["default", "shoujin", "heiti", "songti", "kaiti", "yuanti"]);
const RADAR_KEYS = ["ideas", "innovation", "logic", "tech", "service", "engagement"];
const HEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const t = (v, n) => (typeof v === "string" ? v.trim() : "").slice(0, n);
const url = (v) => {
  const raw = typeof v === "string" ? v.trim() : "";
  if (!raw) return "";
  if (raw.startsWith("/")) return raw;
  try { const u = new URL(raw); return (u.protocol === "http:" || u.protocol === "https:") ? raw : ""; }
  catch { return ""; }
};
const hex = (v, d) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim() : d);
const clampInt = (v, lo, hi, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d;
};

export function sanitizeDeveloperProfile(input) {
  const p = input && typeof input === "object" ? input : {};
  const cover = url(p.cover) || "/assets/logo.png";
  return {
    slug: t(p.slug, 60),
    sourceType: String(p.sourceType).trim().toLowerCase() === "account" ? "account" : "core",
    themePreset: THEME_PRESETS.has(String(p.themePreset)) ? String(p.themePreset) : "custom",
    fontPreset: FONT_PRESETS.has(String(p.fontPreset)) ? String(p.fontPreset) : "default",
    name: t(p.name, 20),
    role: t(p.role, 40),
    qq: t(p.qq, 20),
    avatar: url(p.avatar) || "/assets/logo.png",
    cover,
    headline: t(p.headline, 80),
    quote: t(p.quote, 120),
    bio: t(p.bio, 400),
    tags: Array.isArray(p.tags)
      ? [...new Set(p.tags.map((x) => t(x, 20)).filter(Boolean))].slice(0, 12) : [],
    links: Array.isArray(p.links)
      ? p.links.map((l) => ({ label: t(l?.label, 30), url: url(l?.url) }))
          .filter((l) => l.label && l.url).slice(0, 8) : [],
    projects: Array.isArray(p.projects)
      ? p.projects.map((pr) => ({
          title: t(pr?.title, 40), subtitle: t(pr?.subtitle, 140),
          url: url(pr?.url), cta: t(pr?.cta, 20) || "前往",
        })).filter((pr) => pr.title).slice(0, 8) : [],
    radar: RADAR_KEYS.reduce((acc, k) => { acc[k] = clampInt(p.radar?.[k], 0, 100, 60); return acc; }, {}),
    background: {
      accentA: hex(p.background?.accentA, "#7dd3fc"),
      accentB: hex(p.background?.accentB, "#a78bfa"),
      starColor: hex(p.background?.starColor, "#ffffff"),
      particleDensity: clampInt(p.background?.particleDensity, 20, 140, 72),
      cover,
    },
  };
}

// 开发者主页(GET /api/developers/:slug)。mappedUser: 关联用户行(可空)
export function buildDeveloperHomepageProfile(profile, mappedUser) {
  const sanitized = sanitizeDeveloperProfile(profile);
  const badge = roleBadge(mappedUser?.role_key ?? "admin");
  return {
    ...sanitized,
    permissionBadge: badge,
    permissionLevel: mappedUser ? levelOf(mappedUser) : 3,
    profileType: "developer",
    username: mappedUser?.username || "",
    editable: true,
  };
}

function userProfileProjects(level) {
  const out = [
    { title: "返回官网", subtitle: "回到模组主页", url: "/", cta: "前往" },
    { title: "创意工坊", subtitle: "浏览与投稿建筑作品", url: "/workshop.html", cta: "前往" },
    { title: "提交反馈", subtitle: "报告问题或提出建议", url: "/feedback.html", cta: "前往" },
  ];
  if (level >= 2) out.push({ title: "反馈后台", subtitle: "处理玩家反馈", url: "/admin.html", cta: "进入" });
  if (level >= 1) out.push({ title: "内测尝鲜版", subtitle: "体验最新内测分支", url: "/?branch=sponsor", cta: "查看" });
  return out;
}

// 合并可编辑字段(PATCH /api/developers/:slug 与封面更新)
export function buildEditableDeveloperProfile(existingProfile, body) {
  const current = sanitizeDeveloperProfile(existingProfile);
  const p = body && typeof body === "object" ? body : {};
  const tags = Array.isArray(p.tags) ? p.tags
    : typeof p.tagsText === "string" ? p.tagsText.split(/[\n,，]/) : current.tags;
  const next = sanitizeDeveloperProfile({
    ...current,
    themePreset: typeof p.themePreset === "string" ? p.themePreset : current.themePreset,
    fontPreset: typeof p.fontPreset === "string" ? p.fontPreset : current.fontPreset,
    headline: typeof p.headline === "string" ? p.headline : current.headline,
    quote: typeof p.quote === "string" ? p.quote : current.quote,
    bio: typeof p.bio === "string" ? p.bio : current.bio,
    cover: typeof p.cover === "string" ? p.cover : current.cover,
    tags,
    radar: typeof p.radar === "object" && p.radar ? p.radar : current.radar,
    background: typeof p.background === "object" && p.background
      ? { ...current.background, ...p.background } : current.background,
  });
  return {
    ...current,
    themePreset: next.themePreset, fontPreset: next.fontPreset,
    headline: next.headline, quote: next.quote, bio: next.bio, cover: next.cover,
    tags: next.tags, radar: next.radar,
    background: { ...current.background, ...next.background, cover: next.cover },
  };
}

// 用户主页(GET /api/users/:username/profile)
export function buildUserHomepageProfile(userRow) {
  const badge = roleBadge(userRow.role_key);
  const level = levelOf(userRow);
  const intro = sanitizeIntro(userRow.intro);
  const displayName = userRow.display_name || userRow.username;
  const links = [{ label: "返回官网", url: "/" }];
  if (level >= 2) links.push({ label: "管理后台", url: "/admin.html" });
  const cover = (typeof userRow.cover === "string" && userRow.cover.trim()) ? userRow.cover.trim() : DEFAULT_USER_COVER;
  const sanitized = sanitizeDeveloperProfile({
    slug: userRow.username,
    sourceType: "account",
    name: displayName,
    role: `${badge.label}账户主页`,
    qq: userRow.qq ?? "",
    avatar: sanitizeAvatar(userRow.avatar),
    cover,
    headline: intro || `${badge.label}账户主页`,
    quote: `${displayName} 的个人主页`,
    bio: intro || `${displayName} 当前身份为 ${badge.label}。`,
    tags: [badge.label, `${level}级权限`, "站点账户"],
    links,
    projects: userProfileProjects(level),
  });
  return {
    ...sanitized,
    permissionBadge: badge,
    permissionLevel: level,
    profileType: "user",
    username: userRow.username,
    editable: false,
  };
}

// ---------- 展示墙 ----------
function buildProfileUrlForUser(userRow) {
  const slug = (userRow.developer_slug || "").trim();
  return slug ? `/developers/${encodeURIComponent(slug)}.html`
    : `/profile.html?user=${encodeURIComponent(userRow.username)}`;
}
function wallFromDeveloper(profile, linkedUser) {
  return {
    id: `developer:${profile.slug}`,
    name: profile.name,
    role: profile.role || "开发者",
    intro: profile.headline || profile.bio || "",
    qq: profile.qq || linkedUser?.qq || "",
    avatar: profile.avatar || "/assets/logo.png",
    profileUrl: linkedUser ? buildProfileUrlForUser(linkedUser) : `/developers/${encodeURIComponent(profile.slug)}.html`,
    wallType: "developer",
    permissionLevel: linkedUser ? levelOf(linkedUser) : 3,
  };
}
function wallFromUser(userRow, wallType) {
  const badge = roleBadge(userRow.role_key);
  const displayName = userRow.display_name || userRow.username;
  const sponsor = wallType === "sponsor";
  return {
    id: `user:${userRow.username}`,
    name: displayName,
    role: sponsor ? `${badge.label}成员` : `${badge.label}开发者`,
    intro: sanitizeIntro(userRow.intro) || `${displayName} 的${sponsor ? "赞助者" : "开发者"}主页`,
    qq: userRow.qq ?? "",
    avatar: sanitizeAvatar(userRow.avatar),
    profileUrl: buildProfileUrlForUser(userRow),
    wallType: normalizeWallType(wallType),
    permissionLevel: levelOf(userRow),
  };
}
const sortProfiles = (arr) =>
  arr.sort((a, b) => b.permissionLevel - a.permissionLevel || a.name.localeCompare(b.name));

// developerProfiles: [{profile, linkedUser}], devAccounts/sponsors: userRows
export function buildWallPayload({ developers, devAccountUsers, sponsorUsers }) {
  const developerProfiles = developers.map(({ profile, linkedUser }) => wallFromDeveloper(profile, linkedUser));
  const developerAccounts = devAccountUsers.map((u) => wallFromUser(u, "developer"));
  const sponsorProfiles = sponsorUsers.map((u) => wallFromUser(u, "sponsor"));
  return {
    developers: sortProfiles([...developerProfiles, ...developerAccounts]),
    sponsors: sortProfiles(sponsorProfiles),
  };
}
