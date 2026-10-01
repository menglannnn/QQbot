// 共享内容逻辑:分支、工坊分类、校验器、sanitizer、payload 构建器。
// 从旧 server.js 忠实移植(见各路由契约)。

// ---------- 通用 ----------
export function randomId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
export function nowIso() {
  return new Date().toISOString();
}
export function normalizeIsoTimestamp(value, fallback) {
  const t = Date.parse(value);
  if (Number.isFinite(t)) return new Date(t).toISOString();
  return fallback ?? nowIso();
}
function trimSlice(v, n) {
  return (typeof v === "string" ? v.trim() : "").slice(0, n);
}

// ---------- 分支 ----------
export const FIXED_BRANCHES = ["main", "neoforge", "sponsor"];
const SPONSOR_BRANCHES = new Set(["sponsor", "beta", "preview", "internal"]);
export function normalizeBranchInput(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "" || raw === "main" || raw === "forge") return "main";
  if (raw === "neoforge") return "neoforge";
  if (SPONSOR_BRANCHES.has(raw) || /(beta|preview|alpha|test|internal|sponsor|内测|尝鲜)/i.test(raw)) {
    return "sponsor";
  }
  return raw;
}
export function isManagedBranch(branch) {
  return FIXED_BRANCHES.includes(normalizeBranchInput(branch));
}
// 新模型:sponsor 分支需 level>=1(赞助者及以上)
export function canAccessBranch(userLevel, branch) {
  const b = normalizeBranchInput(branch);
  if (!FIXED_BRANCHES.includes(b)) return false;
  if (b === "sponsor") return Number(userLevel ?? 0) >= 1;
  return true;
}

// ---------- 工坊分类 ----------
export const WORKSHOP_CATEGORY_META = {
  other: { key: "other", label: "其他" },
  residence: { key: "residence", label: "住宅" },
  commercial: { key: "commercial", label: "商业" },
  industrial: { key: "industrial", label: "工业" },
  public: { key: "public", label: "公共" },
};
const WORKSHOP_CATEGORY_ALIASES = {
  housing: "residence",
  住宅: "residence", 商业: "commercial", 工业: "industrial", 公共: "public", 其他: "other",
};
export function normalizeWorkshopCategory(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";
  if (WORKSHOP_CATEGORY_META[raw]) return raw;
  const alias = WORKSHOP_CATEGORY_ALIASES[raw] || WORKSHOP_CATEGORY_ALIASES[String(value).trim()];
  return alias || "";
}
export function listWorkshopCategories() {
  return Object.values(WORKSHOP_CATEGORY_META).map((i) => ({ key: i.key, label: i.label }));
}
function workshopCategoryMeta(key) {
  return WORKSHOP_CATEGORY_META[key] || WORKSHOP_CATEGORY_META.other;
}

// ---------- 校验器 ----------
export function isValidFeedbackDraftId(d) {
  return typeof d === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(d);
}
export function isValidImageFileName(name) {
  return typeof name === "string" && name.length >= 1 && name.length <= 120 &&
    !name.includes("/") && !name.includes("\\") && /\.(png|jpe?g|webp|gif)$/i.test(name);
}
export function isValidFeedbackFileName(name) {
  return typeof name === "string" && name.length >= 1 && name.length <= 180 &&
    !/[<>:"/\\|?*\x00-\x1f]/.test(name);
}
export function isValidWorkshopFileName(kind, name) {
  if (!isValidFeedbackFileName(name)) return false;
  if (kind === "nbt") return /\.nbt$/i.test(name);
  if (kind === "image") return /\.(png|jpe?g|webp|gif)$/i.test(name);
  return false;
}

// ---------- 外链 ----------
export function normalizeExternalLink(link, index = 0) {
  if (!link || typeof link !== "object") return null;
  const url = typeof link.url === "string" ? link.url.trim() : "";
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  } catch {
    return null;
  }
  const label = (typeof link.label === "string" && link.label.trim()
    ? link.label.trim() : `站外下载 ${index + 1}`).slice(0, 40);
  return { label, url };
}
export function sanitizeWorkshopExternalLinks(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (let i = 0; i < value.length && out.length < 8; i++) {
    const link = normalizeExternalLink(value[i], i);
    if (link) out.push(link);
  }
  return out;
}

// ---------- 工坊附件/条目 ----------
export function sanitizeWorkshopAttachment(item, kind, draftId) {
  if (!item || typeof item !== "object") return null;
  if (!isValidFeedbackDraftId(draftId)) return null;
  const name = typeof item.name === "string" ? item.name.trim() : "";
  if (!isValidWorkshopFileName(kind, name)) return null;
  const url = typeof item.url === "string" ? item.url.trim() : "";
  const prefix = `/uploads/workshop/${encodeURIComponent(draftId)}/${kind}/`;
  if (!url.startsWith(prefix)) return null;
  const size = Number(item.size);
  return { kind, name, url, size: Number.isFinite(size) && size > 0 ? size : 0 };
}
// 新模型:图片必填(≥1),NBT 选填。返回 { images: [...], nbt?: {...} };无图片返回 null
export function sanitizeWorkshopFiles(files, category, draftId) {
  const src = files && typeof files === "object" ? files : {};
  const out = { images: [] };
  if (Array.isArray(src.images)) {
    for (const item of src.images) {
      if (out.images.length >= 8) break;
      const att = sanitizeWorkshopAttachment(item, "image", draftId);
      if (att) out.images.push(att);
    }
  }
  if (out.images.length === 0) return null;
  const nbt = sanitizeWorkshopAttachment(src.nbt, "nbt", draftId);
  if (nbt) out.nbt = nbt;
  return out;
}
export function normalizeWorkshopStatus(v) {
  const r = String(v ?? "").trim().toLowerCase();
  return r === "approved" || r === "rejected" ? r : "pending";
}
// 把存储行(D1)转成前端 payload。userMap: username -> userRow(含 developer_slug)
export function buildWorkshopItemPayload(entry, userMap) {
  const meta = workshopCategoryMeta(entry.category);
  const files = entry.files || {};
  const nbtUrl = files?.nbt?.url || "";
  const author = userMap?.get(entry.authorUsername);
  const authorProfileUrl = author
    ? (author.developer_slug
        ? `/developers/${encodeURIComponent(author.developer_slug)}.html`
        : `/profile.html?user=${encodeURIComponent(author.username)}`)
    : `/profile.html?user=${encodeURIComponent(entry.authorUsername || "")}`;
  return {
    id: entry.id,
    title: entry.title,
    category: meta.key,
    categoryLabel: meta.label,
    description: entry.description,
    files,
    externalLinks: entry.externalLinks || [],
    nbtViewerUrl: nbtUrl ? `/nbt-viewer.html?url=${encodeURIComponent(nbtUrl)}` : "",
    status: entry.status,
    reviewReason: entry.reviewReason || "",
    reviewedBy: entry.reviewedBy || "",
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    reviewedAt: entry.reviewedAt ?? null,
    publishedAt: entry.publishedAt ?? null,
    author: {
      username: entry.authorUsername,
      displayName: author?.display_name || entry.authorDisplayName || entry.authorUsername,
      profileUrl: authorProfileUrl,
    },
  };
}
// D1 行 -> 内部条目对象(解析 JSON 列)
export function workshopRowToEntry(row) {
  let files = {}, externalLinks = [];
  try { files = JSON.parse(row.files || "{}"); } catch {}
  try { externalLinks = JSON.parse(row.external_links || "[]"); } catch {}
  return {
    id: row.id, draftId: row.draft_id, title: row.title, category: row.category,
    description: row.description, files, externalLinks,
    authorUsername: row.author_username, authorDisplayName: row.author_display_name,
    status: row.status, reviewReason: row.review_reason, reviewedBy: row.reviewed_by,
    createdAt: row.created_at, updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at, publishedAt: row.published_at,
  };
}

// ---------- changelog ----------
function sanitizeChangelogDate(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const t = Date.parse(raw);
  const d = Number.isFinite(t) ? new Date(t) : new Date();
  return d.toISOString().slice(0, 10);
}
export function sanitizeChangelogEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const title = trimSlice(entry.title, 60);
  const summary = trimSlice(entry.summary, 240);
  if (!title || !summary) return null;
  const createdAt = normalizeIsoTimestamp(entry.createdAt);
  return {
    id: (typeof entry.id === "string" && entry.id.trim()) ? entry.id.trim() : randomId(),
    version: trimSlice(entry.version, 40),
    title, summary,
    date: sanitizeChangelogDate(entry.date ?? entry.createdAt ?? createdAt),
    createdAt,
  };
}

// ---------- external mods ----------
export function sanitizeExternalModKey(value) {
  const raw = (typeof value === "string" ? value.trim()
    : typeof value === "number" ? String(value) : "");
  if (!raw || raw.length > 80 || /[\\/\x00-\x1f]/.test(raw)) return "";
  return raw;
}
export function formatVersionGuess(fileName) {
  const base = String(fileName || "").replace(/\.(zip|jar)$/i, "");
  const m = base.match(/(\d+\.\d+\.\d+[^-_ ]*)/);
  return m?.[1] ?? base;
}
export function parseExternalConfigEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const branch = normalizeBranchInput(entry.branch || "main");
  let links = [];
  if (Array.isArray(entry.links)) {
    links = entry.links.map((l, i) => normalizeExternalLink(l, i)).filter(Boolean);
  } else if (entry.externalUrl || entry.url) {
    const l = normalizeExternalLink({ label: entry.label, url: entry.externalUrl || entry.url }, 0);
    if (l) links = [l];
  }
  const fileName = sanitizeExternalModKey(
    entry.fileName || entry.id || (links[0] ? new URL(links[0].url).pathname.split("/").pop() : "") || entry.title
  );
  if (!fileName || links.length === 0) return null;
  return {
    branch, fileName,
    title: trimSlice(entry.title, 80) || formatVersionGuess(fileName),
    description: trimSlice(entry.description, 120),
    links, updatedAt: normalizeIsoTimestamp(entry.updatedAt),
  };
}
export function externalModToListItem(item, branch) {
  return {
    branch,
    fileName: item.fileName,
    sizeBytes: null,
    mtimeMs: Date.parse(item.updatedAt) || 0,
    versionGuess: item.title || formatVersionGuess(item.fileName),
    externalOnly: true,
    externalLinks: item.links,
    description: item.description || "",
  };
}
