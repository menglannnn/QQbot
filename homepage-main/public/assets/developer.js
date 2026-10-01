const waitForPageTransition =
  window.__SITE_PAGE_TRANSITION_DONE instanceof Promise
    ? window.__SITE_PAGE_TRANSITION_DONE
    : Promise.resolve();
const RADAR_META = [
  { key: "ideas", label: "有想法" },
  { key: "innovation", label: "创新" },
  { key: "logic", label: "逻辑" },
  { key: "tech", label: "技术" },
  { key: "service", label: "服务" },
  { key: "engagement", label: "参与度" },
];
const AUTH_CHANGED_EVENT = "site:auth-changed";
// 用户主页默认背景(与后端保持一致):用于判断当前是否为默认封面。
const DEFAULT_USER_COVER = "/assets/hero-bottom.png";
const PROFILE_THEME_PRESETS = {
  custom: {
    key: "custom",
    label: "自定义配色",
    description: "沿用当前主页的自定义颜色，你可以自由调整主色、星点和粒子密度。",
  },
  starry: {
    key: "starry",
    label: "星空主题",
    description: "更亮的冷色星空、明显的星星闪烁和流星坠落效果，适合科技感或幻想感主页。",
    background: {
      accentA: "#67c8ff",
      accentB: "#8b7bff",
      starColor: "#f8fbff",
      particleDensity: 104,
    },
    styles: {
      "--profile-body-background":
        "radial-gradient(920px 560px at 14% 0%, rgba(103, 200, 255, 0.24), transparent 60%), radial-gradient(860px 520px at 88% 12%, rgba(139, 123, 255, 0.2), transparent 60%), linear-gradient(180deg, #060b18, #0a132c 42%, #060911)",
      "--profile-sky-opacity": "0.94",
      "--profile-card-bg": "rgba(7, 12, 28, 0.56)",
      "--profile-card-border": "rgba(223, 235, 255, 0.13)",
      "--profile-card-shadow": "0 24px 60px rgba(0, 8, 24, 0.34)",
      "--profile-cover-overlay":
        "linear-gradient(180deg, rgba(5, 8, 20, 0.08), rgba(4, 8, 22, 0.82))",
      "--profile-kicker-color": "rgba(236, 243, 255, 0.8)",
      "--profile-hero-title": "#f8fbff",
      "--profile-hero-muted": "rgba(227, 237, 255, 0.84)",
      "--profile-clock-bg": "rgba(255, 255, 255, 0.1)",
      "--profile-clock-border": "rgba(255, 255, 255, 0.16)",
      "--profile-clock-text": "#ffffff",
      "--profile-clock-muted": "rgba(235, 243, 255, 0.8)",
      "--profile-owner-trigger-bg": "rgba(5, 8, 20, 0.46)",
      "--profile-owner-trigger-color": "#ffffff",
      "--profile-menu-bg": "rgba(7, 10, 21, 0.82)",
      "--profile-radar-grid-rgb": "255,255,255",
      "--profile-radar-label-rgb": "255,255,255",
      "--profile-radar-point-stroke": "#ffffff",
      "--text": "rgba(244, 247, 255, 0.95)",
      "--muted": "rgba(200, 210, 232, 0.82)",
      "--line": "rgba(255, 255, 255, 0.12)",
      "--panel": "rgba(12, 18, 40, 0.82)",
      "--panel2": "rgba(20, 28, 54, 0.88)",
      "--soft-bg": "rgba(255, 255, 255, 0.07)",
      "--input-bg": "rgba(255, 255, 255, 0.09)",
      "--topbar-bg": "rgba(10, 16, 36, 0.78)",
      "--ghost-bg": "rgba(255, 255, 255, 0.08)",
      "--brand": "#8dd5ff",
      "--brand2": "#c4b5fd",
      "--shadow": "0 24px 64px rgba(6, 10, 24, 0.36)",
      "--accent-strong": "#ffffff",
    },
    lightStyles: {
      "--profile-body-background":
        "radial-gradient(920px 560px at 14% 0%, rgba(103, 200, 255, 0.2), transparent 60%), radial-gradient(860px 520px at 88% 12%, rgba(139, 123, 255, 0.14), transparent 60%), linear-gradient(180deg, #f5f9ff, #eaf1ff 42%, #f7faff)",
      "--profile-sky-opacity": "0.44",
      "--profile-card-bg": "rgba(255, 255, 255, 0.78)",
      "--profile-card-border": "rgba(98, 134, 187, 0.12)",
      "--profile-card-shadow": "0 22px 52px rgba(90, 124, 175, 0.14)",
      "--profile-cover-overlay":
        "linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(22, 45, 92, 0.34))",
      "--profile-kicker-color": "rgba(41, 65, 99, 0.8)",
      "--profile-hero-title": "#10233f",
      "--profile-hero-muted": "rgba(37, 54, 83, 0.84)",
      "--profile-clock-bg": "rgba(255, 255, 255, 0.64)",
      "--profile-clock-border": "rgba(98, 134, 187, 0.16)",
      "--profile-clock-text": "#10233f",
      "--profile-clock-muted": "rgba(55, 76, 112, 0.76)",
      "--profile-owner-trigger-bg": "rgba(248, 251, 255, 0.92)",
      "--profile-owner-trigger-color": "#10233f",
      "--profile-menu-bg": "rgba(248, 251, 255, 0.94)",
      "--profile-radar-grid-rgb": "17,17,17",
      "--profile-radar-label-rgb": "17,17,17",
      "--profile-radar-point-stroke": "#111111",
      "--text": "rgba(17, 34, 62, 0.96)",
      "--muted": "rgba(78, 96, 125, 0.86)",
      "--line": "rgba(67, 88, 122, 0.12)",
      "--panel": "rgba(247, 250, 255, 0.84)",
      "--panel2": "rgba(242, 247, 255, 0.92)",
      "--soft-bg": "rgba(255, 255, 255, 0.62)",
      "--input-bg": "rgba(255, 255, 255, 0.88)",
      "--topbar-bg": "rgba(245, 249, 255, 0.9)",
      "--ghost-bg": "rgba(255, 255, 255, 0.74)",
      "--brand": "#2563eb",
      "--brand2": "#6366f1",
      "--shadow": "0 22px 54px rgba(90, 124, 175, 0.16)",
      "--accent-strong": "#10233f",
    },
  },
  gothic: {
    key: "gothic",
    label: "暗黑哥特",
    description: "更深的黑紫色层次、蝙蝠纹饰和低亮度面板，并带背景蝙蝠飞过、蝙蝠群掠过与远景尖塔剪影效果，适合偏冷肃、戏剧化的个人主页。",
    background: {
      accentA: "#6b4f77",
      accentB: "#17131f",
      starColor: "#dbc7e8",
      particleDensity: 42,
    },
    styles: {
      "--profile-body-background":
        "radial-gradient(860px 520px at 12% 0%, rgba(107, 79, 119, 0.22), transparent 60%), radial-gradient(980px 640px at 80% 16%, rgba(37, 31, 47, 0.3), transparent 62%), linear-gradient(180deg, #09070d, #130f18 44%, #060509)",
      "--profile-sky-opacity": "0.68",
      "--profile-card-bg": "rgba(14, 10, 19, 0.7)",
      "--profile-card-border": "rgba(214, 194, 228, 0.12)",
      "--profile-card-shadow": "0 28px 66px rgba(0, 0, 0, 0.4)",
      "--profile-cover-overlay":
        "linear-gradient(180deg, rgba(8, 6, 10, 0.06), rgba(8, 6, 10, 0.88))",
      "--profile-kicker-color": "rgba(232, 221, 242, 0.76)",
      "--profile-hero-title": "#fbf7ff",
      "--profile-hero-muted": "rgba(229, 220, 237, 0.84)",
      "--profile-clock-bg": "rgba(255, 255, 255, 0.06)",
      "--profile-clock-border": "rgba(255, 255, 255, 0.14)",
      "--profile-clock-text": "#f7f2ff",
      "--profile-clock-muted": "rgba(228, 220, 238, 0.74)",
      "--profile-owner-trigger-bg": "rgba(8, 6, 10, 0.6)",
      "--profile-owner-trigger-color": "#f6f0ff",
      "--profile-menu-bg": "rgba(14, 10, 19, 0.9)",
      "--profile-radar-grid-rgb": "255,255,255",
      "--profile-radar-label-rgb": "255,255,255",
      "--profile-radar-point-stroke": "#ffffff",
      "--text": "rgba(245, 239, 251, 0.94)",
      "--muted": "rgba(197, 184, 208, 0.8)",
      "--line": "rgba(255, 255, 255, 0.1)",
      "--panel": "rgba(18, 13, 23, 0.86)",
      "--panel2": "rgba(26, 18, 33, 0.92)",
      "--soft-bg": "rgba(255, 255, 255, 0.05)",
      "--input-bg": "rgba(255, 255, 255, 0.07)",
      "--topbar-bg": "rgba(16, 12, 22, 0.82)",
      "--ghost-bg": "rgba(255, 255, 255, 0.06)",
      "--brand": "#d0b4f5",
      "--brand2": "#8d7dff",
      "--shadow": "0 28px 70px rgba(0, 0, 0, 0.42)",
      "--accent-strong": "#fffaff",
    },
    lightStyles: {
      "--profile-body-background":
        "radial-gradient(860px 520px at 12% 0%, rgba(147, 111, 165, 0.18), transparent 60%), radial-gradient(980px 640px at 80% 16%, rgba(83, 68, 106, 0.12), transparent 62%), linear-gradient(180deg, #faf5fb, #f1e8f3 44%, #f8f2f7)",
      "--profile-sky-opacity": "0.32",
      "--profile-card-bg": "rgba(255, 251, 255, 0.78)",
      "--profile-card-border": "rgba(130, 100, 142, 0.14)",
      "--profile-card-shadow": "0 24px 58px rgba(109, 84, 122, 0.16)",
      "--profile-cover-overlay":
        "linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(55, 35, 66, 0.4))",
      "--profile-kicker-color": "rgba(79, 55, 92, 0.8)",
      "--profile-hero-title": "#24182b",
      "--profile-hero-muted": "rgba(72, 52, 82, 0.84)",
      "--profile-clock-bg": "rgba(255, 255, 255, 0.66)",
      "--profile-clock-border": "rgba(130, 100, 142, 0.16)",
      "--profile-clock-text": "#24182b",
      "--profile-clock-muted": "rgba(94, 73, 106, 0.76)",
      "--profile-owner-trigger-bg": "rgba(252, 248, 253, 0.92)",
      "--profile-owner-trigger-color": "#24182b",
      "--profile-menu-bg": "rgba(252, 248, 253, 0.95)",
      "--profile-radar-grid-rgb": "17,17,17",
      "--profile-radar-label-rgb": "17,17,17",
      "--profile-radar-point-stroke": "#111111",
      "--text": "rgba(39, 25, 47, 0.96)",
      "--muted": "rgba(103, 80, 114, 0.84)",
      "--line": "rgba(99, 74, 111, 0.12)",
      "--panel": "rgba(252, 247, 253, 0.84)",
      "--panel2": "rgba(248, 242, 250, 0.92)",
      "--soft-bg": "rgba(255, 255, 255, 0.6)",
      "--input-bg": "rgba(255, 255, 255, 0.88)",
      "--topbar-bg": "rgba(251, 246, 252, 0.9)",
      "--ghost-bg": "rgba(255, 255, 255, 0.74)",
      "--brand": "#7c3f8d",
      "--brand2": "#9d5bb3",
      "--shadow": "0 24px 60px rgba(109, 84, 122, 0.18)",
      "--accent-strong": "#24182b",
    },
  },
  cream: {
    key: "cream",
    label: "奶油主题",
    description: "暖奶油底色搭配深色文字，整体更柔和，也更适合展示生活化内容。",
    background: {
      accentA: "#f1c98f",
      accentB: "#d6a97d",
      starColor: "#fff3d7",
      particleDensity: 34,
    },
    styles: {
      "--profile-body-background":
        "radial-gradient(920px 540px at 14% 0%, rgba(241, 201, 143, 0.26), transparent 60%), radial-gradient(860px 500px at 88% 14%, rgba(214, 169, 125, 0.22), transparent 60%), linear-gradient(180deg, #fff7ea, #f6ead7 44%, #fdf4e6)",
      "--profile-sky-opacity": "0.28",
      "--profile-card-bg": "rgba(255, 252, 246, 0.78)",
      "--profile-card-border": "rgba(132, 96, 60, 0.12)",
      "--profile-card-shadow": "0 22px 48px rgba(126, 92, 58, 0.12)",
      "--profile-cover-overlay":
        "linear-gradient(180deg, rgba(255, 253, 248, 0.02), rgba(86, 61, 36, 0.34))",
      "--profile-kicker-color": "rgba(71, 52, 35, 0.78)",
      "--profile-hero-title": "#1f1a16",
      "--profile-hero-muted": "rgba(60, 48, 38, 0.86)",
      "--profile-clock-bg": "rgba(255, 255, 255, 0.56)",
      "--profile-clock-border": "rgba(120, 87, 55, 0.14)",
      "--profile-clock-text": "#201a16",
      "--profile-clock-muted": "rgba(84, 66, 50, 0.74)",
      "--profile-owner-trigger-bg": "rgba(255, 250, 242, 0.84)",
      "--profile-owner-trigger-color": "#231a13",
      "--profile-menu-bg": "rgba(255, 250, 242, 0.94)",
      "--profile-radar-grid-rgb": "17,17,17",
      "--profile-radar-label-rgb": "17,17,17",
      "--profile-radar-point-stroke": "#111111",
      "--text": "rgba(35, 26, 20, 0.96)",
      "--muted": "rgba(104, 84, 66, 0.86)",
      "--line": "rgba(92, 68, 42, 0.12)",
      "--panel": "rgba(255, 250, 242, 0.82)",
      "--panel2": "rgba(255, 249, 241, 0.92)",
      "--soft-bg": "rgba(255, 255, 255, 0.56)",
      "--input-bg": "rgba(255, 255, 255, 0.84)",
      "--topbar-bg": "rgba(255, 249, 241, 0.88)",
      "--ghost-bg": "rgba(255, 255, 255, 0.72)",
      "--brand": "#9b5b34",
      "--brand2": "#b6865e",
      "--shadow": "0 24px 62px rgba(144, 110, 74, 0.14)",
      "--accent-strong": "#fffaf0",
    },
  },
  bluewhite: {
    key: "bluewhite",
    label: "蓝白主题",
    description: "清透的蓝白界面和黑色文字，适合偏简洁、清爽的个人主页风格。",
    background: {
      accentA: "#8fcfff",
      accentB: "#dceeff",
      starColor: "#ffffff",
      particleDensity: 58,
    },
    styles: {
      "--profile-body-background":
        "radial-gradient(940px 540px at 10% 0%, rgba(143, 207, 255, 0.26), transparent 60%), radial-gradient(820px 460px at 90% 14%, rgba(220, 238, 255, 0.9), transparent 62%), linear-gradient(180deg, #eef7ff, #dfedfb 44%, #f8fbff)",
      "--profile-sky-opacity": "0.34",
      "--profile-card-bg": "rgba(248, 252, 255, 0.8)",
      "--profile-card-border": "rgba(62, 104, 146, 0.12)",
      "--profile-card-shadow": "0 22px 50px rgba(62, 104, 146, 0.12)",
      "--profile-cover-overlay":
        "linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(22, 64, 108, 0.3))",
      "--profile-kicker-color": "rgba(29, 53, 84, 0.78)",
      "--profile-hero-title": "#0f172a",
      "--profile-hero-muted": "rgba(31, 41, 55, 0.86)",
      "--profile-clock-bg": "rgba(255, 255, 255, 0.64)",
      "--profile-clock-border": "rgba(76, 119, 160, 0.14)",
      "--profile-clock-text": "#0f172a",
      "--profile-clock-muted": "rgba(51, 65, 85, 0.74)",
      "--profile-owner-trigger-bg": "rgba(248, 252, 255, 0.9)",
      "--profile-owner-trigger-color": "#0f172a",
      "--profile-menu-bg": "rgba(248, 252, 255, 0.94)",
      "--profile-radar-grid-rgb": "17,17,17",
      "--profile-radar-label-rgb": "17,17,17",
      "--profile-radar-point-stroke": "#111111",
      "--text": "rgba(15, 23, 42, 0.96)",
      "--muted": "rgba(71, 85, 105, 0.86)",
      "--line": "rgba(51, 65, 85, 0.1)",
      "--panel": "rgba(248, 252, 255, 0.84)",
      "--panel2": "rgba(244, 249, 255, 0.92)",
      "--soft-bg": "rgba(255, 255, 255, 0.62)",
      "--input-bg": "rgba(255, 255, 255, 0.88)",
      "--topbar-bg": "rgba(247, 251, 255, 0.9)",
      "--ghost-bg": "rgba(255, 255, 255, 0.76)",
      "--brand": "#2563eb",
      "--brand2": "#0ea5e9",
      "--shadow": "0 24px 60px rgba(70, 114, 160, 0.12)",
      "--accent-strong": "#ffffff",
    },
  },
};
const PROFILE_THEME_STYLE_KEYS = [
  "--profile-body-background",
  "--profile-sky-opacity",
  "--profile-card-bg",
  "--profile-card-border",
  "--profile-card-shadow",
  "--profile-cover-overlay",
  "--profile-kicker-color",
  "--profile-hero-title",
  "--profile-hero-muted",
  "--profile-clock-bg",
  "--profile-clock-border",
  "--profile-clock-text",
  "--profile-clock-muted",
  "--profile-owner-trigger-bg",
  "--profile-owner-trigger-color",
  "--profile-menu-bg",
  "--profile-radar-grid-rgb",
  "--profile-radar-label-rgb",
  "--profile-radar-point-stroke",
  "--text",
  "--muted",
  "--line",
  "--panel",
  "--panel2",
  "--soft-bg",
  "--input-bg",
  "--topbar-bg",
  "--ghost-bg",
  "--brand",
  "--brand2",
  "--shadow",
  "--accent-strong",
];
const PROFILE_FONT_PRESETS = {
  default: {
    key: "default",
    label: "默认字体",
    description: "使用当前站点默认字体，整体和官网其他页面保持一致。",
    styles: {
      "--profile-font-family":
        "\"Noto Serif SC\", \"Songti SC\", \"STSong\", \"SimSun\", serif",
      "--profile-title-font-family":
        "\"Noto Serif SC\", \"Songti SC\", \"STSong\", \"SimSun\", serif",
      "--profile-font-letter-spacing": "0",
      "--profile-title-letter-spacing": "0",
    },
  },
  shoujin: {
    key: "shoujin",
    label: "瘦金体",
    description: "标题和正文都会偏修长，如果本机没有瘦金字体会自动回退到楷体风格。",
    styles: {
      "--profile-font-family":
        "\"FZShuTi\", \"STXingkai\", \"KaiTi\", \"STKaiti\", serif",
      "--profile-title-font-family":
        "\"FZShuTi\", \"STXingkai\", \"KaiTi\", \"STKaiti\", serif",
      "--profile-font-letter-spacing": "0.02em",
      "--profile-title-letter-spacing": "0.08em",
    },
  },
  heiti: {
    key: "heiti",
    label: "黑体",
    description: "整体更清晰硬朗，适合现代、简洁和信息量偏多的主页。",
    styles: {
      "--profile-font-family":
        "\"Microsoft YaHei\", \"PingFang SC\", \"Hiragino Sans GB\", \"SimHei\", sans-serif",
      "--profile-title-font-family":
        "\"Microsoft YaHei\", \"PingFang SC\", \"Hiragino Sans GB\", \"SimHei\", sans-serif",
      "--profile-font-letter-spacing": "0",
      "--profile-title-letter-spacing": "0.01em",
    },
  },
  songti: {
    key: "songti",
    label: "宋体",
    description: "更接近传统印刷书卷感，适合偏正式或叙述型的主页内容。",
    styles: {
      "--profile-font-family":
        "\"Songti SC\", \"STSong\", \"SimSun\", \"Noto Serif SC\", serif",
      "--profile-title-font-family":
        "\"Songti SC\", \"STSong\", \"SimSun\", \"Noto Serif SC\", serif",
      "--profile-font-letter-spacing": "0",
      "--profile-title-letter-spacing": "0.03em",
    },
  },
  kaiti: {
    key: "kaiti",
    label: "楷体",
    description: "笔画更柔和，适合偏个人化、展示感更强的主页风格。",
    styles: {
      "--profile-font-family":
        "\"KaiTi\", \"STKaiti\", \"Kaiti SC\", \"DFKai-SB\", serif",
      "--profile-title-font-family":
        "\"KaiTi\", \"STKaiti\", \"Kaiti SC\", \"DFKai-SB\", serif",
      "--profile-font-letter-spacing": "0.01em",
      "--profile-title-letter-spacing": "0.05em",
    },
  },
  yuanti: {
    key: "yuanti",
    label: "圆体",
    description: "字形更圆润，适合偏轻松、可爱和柔和的主页氛围。",
    styles: {
      "--profile-font-family":
        "\"YouYuan\", \"Microsoft YaHei\", \"PingFang SC\", \"Hiragino Sans GB\", sans-serif",
      "--profile-title-font-family":
        "\"YouYuan\", \"Microsoft YaHei\", \"PingFang SC\", \"Hiragino Sans GB\", sans-serif",
      "--profile-font-letter-spacing": "0.01em",
      "--profile-title-letter-spacing": "0.03em",
    },
  },
};
const PROFILE_FONT_STYLE_KEYS = [
  "--profile-font-family",
  "--profile-title-font-family",
  "--profile-font-letter-spacing",
  "--profile-title-letter-spacing",
];

const state = {
  profile: null,
  me: null,
  skyCleanup: null,
  coverFile: null,
  radarAnimationId: 0,
};

function el(id) {
  return document.getElementById(id);
}

async function fetchJson(url, init) {
  const res = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...(init || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

async function postJson(url, payload) {
  return fetchJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function patchJson(url, payload) {
  return fetchJson(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function notifyAuthChanged(user) {
  window.dispatchEvent(
    new CustomEvent(AUTH_CHANGED_EVENT, {
      detail: { user: user || null },
    }),
  );
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatClock(date) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh} : ${mm} : ${ss}`;
}

function formatDateLine(date) {
  const week = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y} 年 ${m} 月 ${d} 日 ${week[date.getDay()]}`;
}

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function clampUnit(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

function easeOutCubic(value) {
  const x = clampUnit(value);
  return 1 - ((1 - x) ** 3);
}

function easeOutBack(value) {
  const x = clampUnit(value) - 1;
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + (c3 * (x ** 3)) + (c1 * (x ** 2));
}

function getSweepReveal(targetRadius, sweepRadius, feather = 28) {
  return clampUnit((sweepRadius - targetRadius + feather) / Math.max(feather, 1));
}

function getInputValue(id) {
  const node = el(id);
  return node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement
    ? node.value
    : "";
}

function getProfileThemePreset(key) {
  const raw = typeof key === "string" ? key.trim() : "";
  return PROFILE_THEME_PRESETS[raw] || PROFILE_THEME_PRESETS.custom;
}

function getProfileFontPreset(key) {
  const raw = typeof key === "string" ? key.trim() : "";
  return PROFILE_FONT_PRESETS[raw] || PROFILE_FONT_PRESETS.default;
}

function setEditorControlValue(id, value) {
  const target = el(id);
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    target.value = value;
  }
}

function setThemeDescription(themePreset) {
  const target = el("edit-theme-description");
  if (!(target instanceof HTMLElement)) return;
  target.textContent = getProfileThemePreset(themePreset).description;
}

function setFontDescription(fontPreset) {
  const target = el("edit-font-description");
  if (!(target instanceof HTMLElement)) return;
  target.textContent = getProfileFontPreset(fontPreset).description;
}

function applyThemePresetToEditor(themePreset) {
  const preset = getProfileThemePreset(themePreset);
  if (!preset.background) return;
  setEditorControlValue("edit-accent-a", preset.background.accentA);
  setEditorControlValue("edit-accent-b", preset.background.accentB);
  setEditorControlValue("edit-star-color", preset.background.starColor);
  setEditorControlValue("edit-particle-density", String(preset.background.particleDensity));
}

function getRadarValue(profile, key) {
  return clampNumber(profile?.radar?.[key], 0, 100, 60);
}

function isImageFile(file) {
  return Boolean(file && /\.(png|jpe?g|webp|gif)$/i.test(file.name || ""));
}

function renderProjects(projects) {
  const list = Array.isArray(projects) ? projects : [];
  if (list.length === 0) {
    return "";
  }

  return list
    .map(
      (item) =>
        `<article class="profile-card">` +
        `<div class="profile-card__title">${escapeHtml(item.title || "未命名项目")}</div>` +
        `<div class="profile-card__desc">${escapeHtml(item.subtitle || "")}</div>` +
        `<a class="btn btn--primary" href="${escapeHtml(item.url || "#")}">${escapeHtml(item.cta || "前往")}</a>` +
        `</article>`,
    )
    .join("");
}

function showToast(message, ok) {
  const toast = el("profile-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle("is-show", Boolean(message));
  toast.style.borderColor = ok ? "rgba(34,197,94,0.35)" : "rgba(245,158,11,0.35)";
}

// ---------- 个人主页背景(封面)自助更换,仅对本人可见 ----------
function ensureUserCoverControl() {
  const cover = document.querySelector(".profile-cover");
  if (!(cover instanceof HTMLElement)) return null;
  let ctrl = el("user-cover-control");
  if (ctrl instanceof HTMLElement) return ctrl;
  ctrl = document.createElement("div");
  ctrl.id = "user-cover-control";
  ctrl.className = "user-cover-control";
  ctrl.hidden = true;
  ctrl.innerHTML =
    '<input type="file" id="user-cover-input" accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif" hidden />' +
    '<button type="button" class="btn btn--ghost" id="user-cover-pick">更换背景</button>' +
    '<button type="button" class="btn btn--ghost" id="user-cover-remove" hidden>移除背景</button>';
  cover.appendChild(ctrl);
  const input = ctrl.querySelector("#user-cover-input");
  ctrl.querySelector("#user-cover-pick").addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    input.value = "";
    if (file) await uploadUserCover(file);
  });
  ctrl.querySelector("#user-cover-remove").addEventListener("click", () => void removeUserCover());
  return ctrl;
}

async function uploadUserCover(file) {
  if (!isImageFile(file)) {
    showToast("只支持 PNG/JPG/JPEG/WEBP/GIF 图片。", false);
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    showToast("背景图片不能超过 20MB。", false);
    return;
  }
  try {
    showToast("背景上传中…", true);
    const data = await fetchJson("/api/auth/cover", {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "x-file-name": encodeURIComponent(file.name),
      },
      body: await file.arrayBuffer(),
    });
    if (data.profile) {
      state.profile = data.profile;
      renderProfile(state.profile);
    }
    syncUserCoverControl();
    showToast("背景已更新", true);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "背景上传失败", false);
  }
}

async function removeUserCover() {
  try {
    showToast("正在恢复默认背景…", true);
    const data = await fetchJson("/api/auth/cover", { method: "DELETE" });
    if (data.profile) {
      state.profile = data.profile;
      renderProfile(state.profile);
    }
    syncUserCoverControl();
    showToast("已恢复默认背景", true);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "操作失败", false);
  }
}

function syncUserCoverControl() {
  const ctrl = ensureUserCoverControl();
  if (!(ctrl instanceof HTMLElement)) return;
  const isUserOwner = state.profile?.profileType === "user" && isOwner();
  ctrl.hidden = !isUserOwner;
  const removeBtn = el("user-cover-remove");
  if (removeBtn instanceof HTMLElement) {
    const cover = state.profile?.cover || "";
    const isDefault = !cover || cover === "/assets/logo.png" || cover === DEFAULT_USER_COVER;
    removeBtn.hidden = isDefault;
  }
}

function ensureOwnerMenu() {
  const cover = document.querySelector(".profile-cover");
  if (!(cover instanceof HTMLElement)) return null;
  let menu = el("profile-owner-menu");
  if (menu instanceof HTMLElement) return menu;
  menu = document.createElement("div");
  menu.id = "profile-owner-menu";
  menu.className = "profile-owner-menu";
  menu.hidden = true;
  menu.innerHTML =
    `<button class="profile-owner-menu__trigger" type="button" id="profile-owner-menu-trigger" aria-label="账户菜单" aria-haspopup="true" aria-expanded="false">&#9881;</button>` +
    `<div class="profile-owner-menu__panel" id="profile-owner-menu-panel" hidden>` +
    `<button class="btn btn--ghost" type="button" id="profile-account-open">账户设置</button>` +
    `<button class="btn btn--ghost" type="button" id="profile-logout">退出账户</button>` +
    `</div>`;
  cover.appendChild(menu);
  return menu;
}

function setOwnerMenuOpen(open) {
  const trigger = el("profile-owner-menu-trigger");
  const panel = el("profile-owner-menu-panel");
  if (!(trigger instanceof HTMLButtonElement) || !(panel instanceof HTMLElement)) return;
  panel.hidden = !open;
  trigger.setAttribute("aria-expanded", open ? "true" : "false");
}

function ensureAccountPanel() {
  const shell = document.querySelector(".profile-shell");
  if (!(shell instanceof HTMLElement)) return null;
  let panel = el("profile-account-panel");
  if (panel instanceof HTMLElement) return panel;
  panel = document.createElement("section");
  panel.id = "profile-account-panel";
  panel.className = "panel profile-account-panel";
  panel.hidden = true;
  panel.innerHTML =
    `<div class="section__head" style="margin: 0 0 10px;">` +
    `<h2 style="margin: 0;">账户设置</h2>` +
    `<p style="margin: 6px 0 0;">退出登录、修改账户名和密码都统一放在这里。</p>` +
    `</div>` +
    `<form class="form" id="account-form" style="max-width: 760px;">` +
    `<div class="field">` +
    `<div class="field__label">当前账户名</div>` +
    `<input class="input" id="account-current-username" readonly />` +
    `</div>` +
    `<div class="field">` +
    `<div class="field__label">新账户名（可选）</div>` +
    `<input class="input" id="account-new-username" maxlength="24" placeholder="2-24 位中文、字母、数字、下划线或短横线" />` +
    `</div>` +
    `<div class="field">` +
    `<div class="field__label">当前密码</div>` +
    `<input class="input" id="account-current-password" type="password" autocomplete="current-password" required />` +
    `</div>` +
    `<div class="field">` +
    `<div class="field__label">新密码（可选）</div>` +
    `<input class="input" id="account-new-password" type="password" autocomplete="new-password" minlength="8" maxlength="72" />` +
    `</div>` +
    `<div class="field">` +
    `<div class="field__label">确认新密码</div>` +
    `<input class="input" id="account-confirm-password" type="password" autocomplete="new-password" minlength="8" maxlength="72" />` +
    `</div>` +
    `<div class="form__actions">` +
    `<div class="hint">只改账户名时也需要输入当前密码确认；首次登录也请先在这里改掉默认密码。</div>` +
    `<div class="button-row">` +
    `<button class="btn btn--primary" type="submit">保存账户设置</button>` +
    `<button class="btn btn--ghost" type="button" id="account-panel-close">收起账户设置</button>` +
    `</div>` +
    `</div>` +
    `</form>` +
    `<div class="toast" id="account-toast"></div>`;
  const editor = el("profile-editor");
  if (editor instanceof HTMLElement) {
    shell.insertBefore(panel, editor);
  } else {
    shell.appendChild(panel);
  }
  return panel;
}

function showAccountToast(message, ok) {
  const toast = el("account-toast");
  if (!(toast instanceof HTMLElement)) return;
  toast.textContent = message;
  toast.classList.toggle("is-show", Boolean(message));
  toast.style.borderColor = ok ? "rgba(34,197,94,0.35)" : "rgba(245,158,11,0.35)";
}

function fillAccountForm(user = state.me) {
  const current = el("account-current-username");
  const next = el("account-new-username");
  const currentPassword = el("account-current-password");
  const newPassword = el("account-new-password");
  const confirmPassword = el("account-confirm-password");
  if (current instanceof HTMLInputElement) {
    current.value = user?.username || "";
  }
  if (next instanceof HTMLInputElement) {
    next.value = user?.username || "";
  }
  if (currentPassword instanceof HTMLInputElement) currentPassword.value = "";
  if (newPassword instanceof HTMLInputElement) newPassword.value = "";
  if (confirmPassword instanceof HTMLInputElement) confirmPassword.value = "";
}

function setAccountPanelOpen(open) {
  const panel = ensureAccountPanel();
  if (!(panel instanceof HTMLElement)) return;
  panel.hidden = !open;
  if (open) {
    fillAccountForm();
    showAccountToast("", true);
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function startClock() {
  const clockEl = el("profile-clock");
  const dateEl = el("profile-date");
  if (!clockEl || !dateEl) return;

  function tick() {
    const now = new Date();
    clockEl.textContent = formatClock(now);
    dateEl.textContent = formatDateLine(now);
  }

  tick();
  setInterval(tick, 1000);
}

function applyTheme(profile) {
  const root = document.documentElement;
  const preset = getProfileThemePreset(profile?.themePreset);
  const fontPreset = getProfileFontPreset(profile?.fontPreset);
  const isLightTheme = root.dataset.theme === "light";
  const accentA = profile?.background?.accentA || preset.background?.accentA || "#7dd3fc";
  const accentB = profile?.background?.accentB || preset.background?.accentB || "#a78bfa";
  const starColor = profile?.background?.starColor || preset.background?.starColor || "#ffffff";
  PROFILE_THEME_STYLE_KEYS.forEach((key) => root.style.removeProperty(key));
  PROFILE_FONT_STYLE_KEYS.forEach((key) => root.style.removeProperty(key));
  root.style.setProperty("--profile-accent-a", accentA);
  root.style.setProperty("--profile-accent-b", accentB);
  root.style.setProperty("--profile-star-color", starColor);
  Object.entries(preset.styles || {}).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  Object.entries(isLightTheme ? (preset.lightStyles || {}) : {}).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  Object.entries(fontPreset.styles || {}).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  document.body.dataset.profilePreset = preset.key;
  document.body.dataset.profileFont = fontPreset.key;
}

function hexToRgba(hex, alpha) {
  const raw = String(hex || "").replace("#", "");
  const safe = raw.length >= 6 ? raw.slice(0, 6) : "ffffff";
  const r = Number.parseInt(safe.slice(0, 2), 16);
  const g = Number.parseInt(safe.slice(2, 4), 16);
  const b = Number.parseInt(safe.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function startSky(profile) {
  const canvas = el("profile-sky");
  if (!(canvas instanceof HTMLCanvasElement)) return;

  if (typeof state.skyCleanup === "function") {
    state.skyCleanup();
    state.skyCleanup = null;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const preset = getProfileThemePreset(profile?.themePreset);
  const isStarryPreset = preset.key === "starry";
  const isGothicPreset = preset.key === "gothic";
  const accentA = profile?.background?.accentA || "#7dd3fc";
  const accentB = profile?.background?.accentB || "#a78bfa";
  const starColor = profile?.background?.starColor || "#ffffff";
  const density = clampNumber(profile?.background?.particleDensity, 20, 140, 72);
  let stars = [];
  let particles = [];
  let meteors = [];
  let galaxyClusters = [];
  let bats = [];
  let batSwarms = [];
  let skyline = null;
  let rafId = 0;

  function createMeteor(width, height) {
    const startX = width * (0.55 + (Math.random() * 0.5));
    const startY = -40 + (Math.random() * Math.max(60, height * 0.24));
    const speedX = -(6.4 + (Math.random() * 5.2));
    const speedY = 3.4 + (Math.random() * 3.2);
    return {
      x: startX,
      y: startY,
      vx: speedX,
      vy: speedY,
      life: 0,
      ttl: 42 + Math.floor(Math.random() * 22),
      length: 130 + (Math.random() * 120),
      width: 1.4 + (Math.random() * 1.8),
      alpha: 0.42 + (Math.random() * 0.28),
      color: Math.random() > 0.48 ? accentA : accentB,
    };
  }

  function createGalaxyCluster(width, height, index) {
    const radius = Math.min(width, height) * (0.1 + (Math.random() * 0.08));
    const edgeAnchors = [
      { x: 0.1 + (Math.random() * 0.08), y: 0.1 + (Math.random() * 0.1), rotation: -0.58 },
      { x: 0.86 - (Math.random() * 0.08), y: 0.12 + (Math.random() * 0.1), rotation: 0.62 },
      { x: 0.12 + (Math.random() * 0.08), y: 0.74 + (Math.random() * 0.12), rotation: -0.42 },
      { x: 0.84 - (Math.random() * 0.08), y: 0.76 + (Math.random() * 0.1), rotation: 0.46 },
    ];
    const anchor = edgeAnchors[index % edgeAnchors.length];
    return {
      x: width * anchor.x,
      y: height * anchor.y,
      radius,
      rotation: anchor.rotation + ((Math.random() * 0.16) - 0.08),
      alpha: 0.09 + (Math.random() * 0.07),
      coreAlpha: 0.18 + (Math.random() * 0.08),
      swirlOffset: Math.random() * Math.PI * 2,
      swirlSpeed: 0.0016 + (Math.random() * 0.0022),
      armTightness: 1.8 + (Math.random() * 1.3),
      stretchX: 1.2 + (Math.random() * 0.6),
      stretchY: 0.42 + (Math.random() * 0.24),
      colorA: index % 2 === 0 ? accentA : accentB,
      colorB: index % 2 === 0 ? "#ffffff" : starColor,
      dust: Array.from({ length: 26 + Math.floor(Math.random() * 16) }, () => ({
        distance: Math.random(),
        angle: Math.random() * Math.PI * 2,
        size: 0.8 + (Math.random() * 1.8),
        alpha: 0.08 + (Math.random() * 0.14),
      })),
    };
  }

  function createBat(width, height) {
    const fromLeft = Math.random() > 0.42;
    const size = 14 + (Math.random() * 18);
    const baseY = height * (0.1 + (Math.random() * 0.32));
    return {
      x: fromLeft ? -size * (4 + Math.random() * 3) : width + size * (4 + Math.random() * 3),
      y: baseY,
      baseY,
      size,
      direction: fromLeft ? 1 : -1,
      speed: 0.3 + (Math.random() * 0.4),
      flap: Math.random() * Math.PI * 2,
      flapSpeed: 0.14 + (Math.random() * 0.1),
      sway: 6 + (Math.random() * 12),
      alpha: 0.08 + (Math.random() * 0.1),
      tint: Math.random() > 0.5 ? accentA : accentB,
      drift: Math.random() * Math.PI * 2,
    };
  }

  function drawBat(bat) {
    const flapAmount = Math.sin(bat.flap) * 0.28;
    const bodyColor = hexToRgba("#050307", bat.alpha * 0.92);
    const glowColor = hexToRgba(bat.tint, bat.alpha * 0.3);

    ctx.save();
    ctx.translate(bat.x, bat.y);
    ctx.scale(bat.direction, 1);
    ctx.rotate((bat.direction * 0.08) + (flapAmount * 0.12));

    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, bat.size * 1.9);
    glow.addColorStop(0, glowColor);
    glow.addColorStop(1, hexToRgba(bat.tint, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, bat.size * 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(0, -bat.size * 0.16);
    ctx.quadraticCurveTo(-bat.size * 0.18, -bat.size * (0.58 + flapAmount), -bat.size * 0.62, -bat.size * (0.3 + (flapAmount * 0.4)));
    ctx.quadraticCurveTo(-bat.size * 1.04, -bat.size * 0.04, -bat.size * 0.9, bat.size * 0.18);
    ctx.quadraticCurveTo(-bat.size * 0.62, bat.size * 0.08, -bat.size * 0.28, bat.size * 0.2);
    ctx.quadraticCurveTo(-bat.size * 0.12, bat.size * 0.34, 0, bat.size * 0.12);
    ctx.quadraticCurveTo(bat.size * 0.12, bat.size * 0.34, bat.size * 0.28, bat.size * 0.2);
    ctx.quadraticCurveTo(bat.size * 0.62, bat.size * 0.08, bat.size * 0.9, bat.size * 0.18);
    ctx.quadraticCurveTo(bat.size * 1.04, -bat.size * 0.04, bat.size * 0.62, -bat.size * (0.3 + (flapAmount * 0.4)));
    ctx.quadraticCurveTo(bat.size * 0.18, -bat.size * (0.58 + flapAmount), 0, -bat.size * 0.16);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-bat.size * 0.08, -bat.size * 0.12);
    ctx.lineTo(-bat.size * 0.03, -bat.size * 0.34);
    ctx.lineTo(0, -bat.size * 0.18);
    ctx.lineTo(bat.size * 0.03, -bat.size * 0.34);
    ctx.lineTo(bat.size * 0.08, -bat.size * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function createBatSwarm(width, height) {
    const fromLeft = Math.random() > 0.5;
    const formationWidth = Math.max(420, width * (0.56 + (Math.random() * 0.22)));
    const formationDepth = 72 + (Math.random() * 38);
    const wingCount = 7 + Math.floor(Math.random() * 4);
    const members = [];

    for (let wing = 0; wing < wingCount; wing += 1) {
      const progress = wing / Math.max(1, wingCount - 1);
      const distance = progress * formationWidth;
      const rowLift = progress * formationDepth * (0.94 + (Math.random() * 0.12));
      const baseSize = 13.2 - (progress * 3.8);
      const baseOffsetX = -distance - (Math.random() * 20);
      const baseFlapSpeed = 0.16 + (Math.random() * 0.08);

      if (wing === 0) {
        members.push({
          offsetX: 0,
          offsetY: 0,
          size: baseSize + (Math.random() * 1.6),
          flap: Math.random() * Math.PI * 2,
          flapSpeed: baseFlapSpeed,
          alphaScale: 1,
        });
        continue;
      }

      members.push({
        offsetX: baseOffsetX,
        offsetY: rowLift,
        size: baseSize + (Math.random() * 2.2),
        flap: Math.random() * Math.PI * 2,
        flapSpeed: baseFlapSpeed,
        alphaScale: 0.98,
      });

      members.push({
        offsetX: baseOffsetX * (0.94 + (Math.random() * 0.08)),
        offsetY: -rowLift * (0.9 + (Math.random() * 0.14)),
        size: (baseSize - 0.5) + (Math.random() * 2),
        flap: Math.random() * Math.PI * 2,
        flapSpeed: 0.16 + (Math.random() * 0.08),
        alphaScale: 0.92,
      });

      if (wing % 2 === 0 && wing < wingCount - 1) {
        members.push({
          offsetX: baseOffsetX * (0.82 + (Math.random() * 0.08)),
          offsetY: rowLift * (Math.random() * 0.18 - 0.09),
          size: (baseSize - 1) + (Math.random() * 1.6),
          flap: Math.random() * Math.PI * 2,
          flapSpeed: 0.15 + (Math.random() * 0.07),
          alphaScale: 0.84,
        });
      }
    }

    const startX = fromLeft
      ? -180
      : width + 180;
    return {
      x: startX,
      y: height * (0.08 + (Math.random() * 0.18)),
      direction: fromLeft ? 1 : -1,
      speed: 1.45 + (Math.random() * 0.5),
      alpha: 0.15 + (Math.random() * 0.06),
      drift: Math.random() * Math.PI * 2,
      formationWidth,
      members,
    };
  }

  function createSkyline(width, height) {
    const baseY = height + 8;
    const towers = [];
    let x = -30;
    while (x < width + 40) {
      const towerWidth = 54 + Math.random() * 86;
      const towerHeight = height * (0.14 + (Math.random() * 0.16));
      const spireHeight = towerHeight * (0.18 + (Math.random() * 0.3));
      towers.push({
        x,
        width: towerWidth,
        bodyTop: baseY - towerHeight,
        spireTop: baseY - towerHeight - spireHeight,
        notch: Math.random() > 0.55,
        crossbar: Math.random() > 0.62,
      });
      x += towerWidth * (0.62 + (Math.random() * 0.3));
    }
    return { baseY, towers };
  }

  function drawSkyline(width, height) {
    if (!skyline?.towers?.length) return;
    const silhouette = ctx.createLinearGradient(0, height, 0, height * 0.62);
    silhouette.addColorStop(0, hexToRgba("#040206", 0.48));
    silhouette.addColorStop(1, hexToRgba(accentB, 0.08));
    ctx.fillStyle = silhouette;
    ctx.beginPath();
    ctx.moveTo(-20, height + 20);
    skyline.towers.forEach((tower) => {
      ctx.lineTo(tower.x, skyline.baseY);
      ctx.lineTo(tower.x, tower.bodyTop);
      if (tower.notch) {
        ctx.lineTo(tower.x + (tower.width * 0.18), tower.bodyTop + 18);
        ctx.lineTo(tower.x + (tower.width * 0.34), tower.bodyTop);
      }
      ctx.lineTo(tower.x + (tower.width * 0.5), tower.spireTop);
      if (tower.crossbar) {
        ctx.lineTo(tower.x + (tower.width * 0.5), tower.spireTop + 12);
        ctx.lineTo(tower.x + (tower.width * 0.37), tower.spireTop + 18);
        ctx.lineTo(tower.x + (tower.width * 0.63), tower.spireTop + 18);
        ctx.lineTo(tower.x + (tower.width * 0.5), tower.spireTop + 12);
      }
      ctx.lineTo(tower.x + tower.width, tower.bodyTop);
      ctx.lineTo(tower.x + tower.width, skyline.baseY);
    });
    ctx.lineTo(width + 20, height + 20);
    ctx.closePath();
    ctx.fill();

    skyline.towers.forEach((tower) => {
      ctx.fillStyle = hexToRgba(accentA, 0.05);
      ctx.fillRect(tower.x + (tower.width * 0.42), tower.bodyTop + 22, Math.max(2, tower.width * 0.06), Math.max(16, tower.width * 0.22));
    });
  }

  function resize() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const starCount = Math.max(
      isStarryPreset ? 72 : 40,
      Math.round((width * height) / (isStarryPreset ? 16500 : 22000)),
    );
    const particleCount = Math.max(
      isStarryPreset ? 24 : 16,
      Math.round(density / (isStarryPreset ? 2.5 : 3)),
    );
    stars = Array.from({ length: starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * (isStarryPreset ? 1.9 : 1.6) + 0.3,
      speed: Math.random() * (isStarryPreset ? 0.22 : 0.15) + (isStarryPreset ? 0.05 : 0.03),
      alpha: Math.random() * (isStarryPreset ? 0.68 : 0.6) + (isStarryPreset ? 0.24 : 0.2),
      twinkle: Math.random() * Math.PI * 2,
      halo: Math.random() * (isStarryPreset ? 1.8 : 0.8) + 0.4,
      flare: isStarryPreset ? Math.random() : 0,
    }));
    particles = Array.from({ length: particleCount }, (_, index) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * (isStarryPreset ? 2.8 : 2.4) + 0.8,
      vy: -(Math.random() * (isStarryPreset ? 0.36 : 0.26) + 0.08),
      vx: Math.random() * (isStarryPreset ? 0.44 : 0.3) - (isStarryPreset ? 0.22 : 0.15),
      alpha: Math.random() * (isStarryPreset ? 0.34 : 0.28) + 0.08,
      color: index % 2 === 0 ? accentA : accentB,
    }));
    meteors = [];
    galaxyClusters = isStarryPreset
      ? Array.from({ length: 3 }, (_, index) => createGalaxyCluster(width, height, index))
      : [];
    bats = isGothicPreset
      ? Array.from({ length: Math.max(4, Math.round(width / 420)) }, () => createBat(width, height))
      : [];
    batSwarms = [];
    skyline = isGothicPreset ? createSkyline(width, height) : null;
  }

  function frame() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    ctx.clearRect(0, 0, width, height);

    if (isStarryPreset) {
      const haze = ctx.createRadialGradient(width * 0.22, height * 0.1, 0, width * 0.22, height * 0.1, width * 0.6);
      haze.addColorStop(0, hexToRgba(accentA, 0.12));
      haze.addColorStop(1, hexToRgba(accentA, 0));
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, width, height);

      const hazeB = ctx.createRadialGradient(width * 0.82, height * 0.18, 0, width * 0.82, height * 0.18, width * 0.52);
      hazeB.addColorStop(0, hexToRgba(accentB, 0.1));
      hazeB.addColorStop(1, hexToRgba(accentB, 0));
      ctx.fillStyle = hazeB;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(width * 0.62, height * 0.16);
      ctx.rotate(-0.24);
      const milkyBand = ctx.createLinearGradient(-width * 0.34, 0, width * 0.34, 0);
      milkyBand.addColorStop(0, hexToRgba(accentA, 0));
      milkyBand.addColorStop(0.16, hexToRgba(accentA, 0.045));
      milkyBand.addColorStop(0.5, hexToRgba("#ffffff", 0.08));
      milkyBand.addColorStop(0.82, hexToRgba(accentB, 0.04));
      milkyBand.addColorStop(1, hexToRgba(accentB, 0));
      ctx.fillStyle = milkyBand;
      ctx.fillRect(-width * 0.34, -height * 0.03, width * 0.68, height * 0.06);
      ctx.restore();

      galaxyClusters.forEach((cluster) => {
        cluster.swirlOffset += cluster.swirlSpeed;
        ctx.save();
        ctx.translate(cluster.x, cluster.y);
        ctx.rotate(cluster.rotation);
        ctx.scale(cluster.stretchX, cluster.stretchY);

        const outerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, cluster.radius * 1.8);
        outerGlow.addColorStop(0, hexToRgba(cluster.colorA, cluster.alpha * 0.85));
        outerGlow.addColorStop(0.45, hexToRgba(cluster.colorB, cluster.alpha * 0.36));
        outerGlow.addColorStop(1, hexToRgba(cluster.colorA, 0));
        ctx.fillStyle = outerGlow;
        ctx.beginPath();
        ctx.arc(0, 0, cluster.radius * 1.8, 0, Math.PI * 2);
        ctx.fill();

        const coreGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, cluster.radius * 0.52);
        coreGlow.addColorStop(0, hexToRgba("#ffffff", cluster.coreAlpha));
        coreGlow.addColorStop(0.55, hexToRgba(cluster.colorB, cluster.coreAlpha * 0.55));
        coreGlow.addColorStop(1, hexToRgba(cluster.colorA, 0));
        ctx.fillStyle = coreGlow;
        ctx.beginPath();
        ctx.arc(0, 0, cluster.radius * 0.52, 0, Math.PI * 2);
        ctx.fill();

        cluster.dust.forEach((dust) => {
          const orbit = cluster.swirlOffset + dust.angle + (dust.distance * cluster.armTightness * Math.PI * 2);
          const distance = cluster.radius * (0.2 + (dust.distance * 0.95));
          const dx = Math.cos(orbit) * distance;
          const dy = Math.sin(orbit) * distance * (0.42 + (dust.distance * 0.22));
          ctx.fillStyle = hexToRgba(
            dust.distance > 0.56 ? cluster.colorA : cluster.colorB,
            dust.alpha * (1 - (dust.distance * 0.38)),
          );
          ctx.beginPath();
          ctx.arc(dx, dy, dust.size, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      });
    }

    if (isGothicPreset) {
      const haze = ctx.createRadialGradient(width * 0.2, height * 0.12, 0, width * 0.2, height * 0.12, width * 0.48);
      haze.addColorStop(0, hexToRgba(accentA, 0.1));
      haze.addColorStop(1, hexToRgba(accentA, 0));
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, width, height);

      const hazeB = ctx.createRadialGradient(width * 0.78, height * 0.16, 0, width * 0.78, height * 0.16, width * 0.42);
      hazeB.addColorStop(0, hexToRgba(accentB, 0.12));
      hazeB.addColorStop(1, hexToRgba(accentB, 0));
      ctx.fillStyle = hazeB;
      ctx.fillRect(0, 0, width, height);

      drawSkyline(width, height);

      bats.forEach((bat) => {
        bat.x += bat.speed * bat.direction;
        bat.flap += bat.flapSpeed;
        bat.drift += 0.018;
        bat.y = bat.baseY + Math.sin(bat.drift) * (bat.sway * 0.35);

        if (bat.direction > 0 && bat.x > width + (bat.size * 5)) {
          const replacement = createBat(width, height);
          replacement.direction = 1;
          replacement.x = -replacement.size * (4 + Math.random() * 3);
          Object.assign(bat, replacement);
        } else if (bat.direction < 0 && bat.x < -(bat.size * 5)) {
          const replacement = createBat(width, height);
          replacement.direction = -1;
          replacement.x = width + replacement.size * (4 + Math.random() * 3);
          Object.assign(bat, replacement);
        }

        drawBat(bat);
      });

      if (batSwarms.length < 1 && Math.random() < 0.006) {
        batSwarms.push(createBatSwarm(width, height));
      }

      batSwarms = batSwarms.filter((swarm) => {
        swarm.x += swarm.speed * swarm.direction;
        swarm.drift += 0.02;
        swarm.y += Math.sin(swarm.drift) * 0.18;
        let minScreenX = Number.POSITIVE_INFINITY;
        let maxScreenX = Number.NEGATIVE_INFINITY;

        swarm.members.forEach((member, index) => {
          member.flap += member.flapSpeed;
          const memberX = swarm.x + (member.offsetX * swarm.direction);
          const memberY = swarm.y + member.offsetY + Math.sin((swarm.drift * 1.3) + index) * 5;
          minScreenX = Math.min(minScreenX, memberX - (member.size * 1.8));
          maxScreenX = Math.max(maxScreenX, memberX + (member.size * 1.8));
          drawBat({
            x: memberX,
            y: memberY,
            direction: swarm.direction,
            size: member.size,
            flap: member.flap,
            alpha: swarm.alpha * member.alphaScale * (0.82 + ((index % 3) * 0.06)),
            tint: index % 2 === 0 ? accentA : accentB,
          });
        });

        return maxScreenX > -220 && minScreenX < width + 220;
      });
    }

    for (const star of stars) {
      star.twinkle += star.speed;
      const twinkleAmount = isStarryPreset ? 0.24 : 0.12;
      const alpha = star.alpha + Math.sin(star.twinkle) * twinkleAmount;
      const visibleAlpha = Math.max(isStarryPreset ? 0.14 : 0.08, alpha);
      if (isStarryPreset) {
        const glowRadius = star.r * (3.4 + (Math.sin(star.twinkle * 0.8) + 1) * star.halo);
        const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, glowRadius);
        glow.addColorStop(0, hexToRgba(starColor, visibleAlpha * 0.24));
        glow.addColorStop(1, hexToRgba(starColor, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(star.x, star.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = hexToRgba(starColor, visibleAlpha);
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
      if (isStarryPreset && star.flare > 0.72) {
        const flareAlpha = Math.max(0, Math.sin(star.twinkle * 0.6)) * 0.32;
        if (flareAlpha > 0.02) {
          ctx.strokeStyle = hexToRgba(starColor, flareAlpha);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(star.x - (star.r * 3.4), star.y);
          ctx.lineTo(star.x + (star.r * 3.4), star.y);
          ctx.moveTo(star.x, star.y - (star.r * 3.4));
          ctx.lineTo(star.x, star.y + (star.r * 3.4));
          ctx.stroke();
        }
      }
    }

    for (const particle of particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;
      if (particle.y < -10) {
        particle.y = height + 10;
        particle.x = Math.random() * width;
      }
      if (particle.x < -20) particle.x = width + 20;
      if (particle.x > width + 20) particle.x = -20;

      const gradient = ctx.createRadialGradient(
        particle.x,
        particle.y,
        0,
        particle.x,
        particle.y,
        particle.r * 4,
      );
      gradient.addColorStop(0, hexToRgba(particle.color, particle.alpha));
      gradient.addColorStop(1, hexToRgba(particle.color, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.r * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (isStarryPreset) {
      if (meteors.length < 2 && Math.random() < 0.018) {
        meteors.push(createMeteor(width, height));
      }

      meteors = meteors.filter((meteor) => {
        meteor.life += 1;
        meteor.x += meteor.vx;
        meteor.y += meteor.vy;
        if (
          meteor.life > meteor.ttl ||
          meteor.x < -meteor.length ||
          meteor.y > height + meteor.length
        ) {
          return false;
        }

        const tailX = meteor.x - (meteor.vx * 1.8);
        const tailY = meteor.y - (meteor.vy * 1.8);
        const meteorAlpha = meteor.alpha * (1 - (meteor.life / meteor.ttl));
        const trail = ctx.createLinearGradient(meteor.x, meteor.y, tailX, tailY);
        trail.addColorStop(0, hexToRgba("#ffffff", meteorAlpha * 0.95));
        trail.addColorStop(0.35, hexToRgba(meteor.color, meteorAlpha * 0.75));
        trail.addColorStop(1, hexToRgba(meteor.color, 0));
        ctx.strokeStyle = trail;
        ctx.lineWidth = meteor.width;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(meteor.x, meteor.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        const headGlow = ctx.createRadialGradient(meteor.x, meteor.y, 0, meteor.x, meteor.y, meteor.width * 8);
        headGlow.addColorStop(0, hexToRgba("#ffffff", meteorAlpha));
        headGlow.addColorStop(1, hexToRgba(meteor.color, 0));
        ctx.fillStyle = headGlow;
        ctx.beginPath();
        ctx.arc(meteor.x, meteor.y, meteor.width * 4.6, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });
    }

    rafId = requestAnimationFrame(frame);
  }

  resize();
  frame();
  window.addEventListener("resize", resize);
  state.skyCleanup = () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener("resize", resize);
  };
}

function drawRadar(profile, progress = 1) {
  const canvas = el("profile-radar");
  if (!(canvas instanceof HTMLCanvasElement)) return;

  const rect = canvas.getBoundingClientRect();
  const size = Math.max(280, Math.floor(rect.width || 320));
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(size * dpr);
  canvas.height = Math.floor(size * dpr);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const center = size / 2;
  const radius = size * 0.34;
  const sweepRadius = radius * Math.max(0.06, Math.min(1.08, easeOutBack(progress)));
  const axisReveal = getSweepReveal(radius, sweepRadius, 34);
  const rootStyle = getComputedStyle(document.documentElement);
  const accentA = rootStyle.getPropertyValue("--profile-accent-a").trim() || "#7dd3fc";
  const accentB = rootStyle.getPropertyValue("--profile-accent-b").trim() || "#a78bfa";
  const isLightTheme = document.documentElement.dataset.theme === "light";
  const gridRgb = rootStyle.getPropertyValue("--profile-radar-grid-rgb").trim() || (isLightTheme ? "0,0,0" : "255,255,255");
  const labelRgb = rootStyle.getPropertyValue("--profile-radar-label-rgb").trim() || (isLightTheme ? "0,0,0" : "255,255,255");
  const pointStroke = rootStyle.getPropertyValue("--profile-radar-point-stroke").trim() || (isLightTheme ? "#111111" : "#ffffff");
  const labelColor = (labelReveal) =>
    `rgba(${labelRgb},${(isLightTheme ? 0.72 : 0.82) * labelReveal})`;

  for (let ring = 1; ring <= 5; ring += 1) {
    const targetRingRadius = (radius / 5) * ring;
    const ringReveal = getSweepReveal(targetRingRadius, sweepRadius, 34);
    if (ringReveal <= 0) continue;
    const r = targetRingRadius * (0.96 + (0.04 * ringReveal));
    ctx.beginPath();
    RADAR_META.forEach((item, index) => {
      const angle = (-Math.PI / 2) + (Math.PI * 2 * index) / RADAR_META.length;
      const x = center + Math.cos(angle) * r;
      const y = center + Math.sin(angle) * r;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = `rgba(${gridRgb},${(isLightTheme ? 0.08 : 0.04) + ((isLightTheme ? 0.18 : 0.1) * ringReveal)})`;
    ctx.stroke();
  }

  RADAR_META.forEach((item, index) => {
    const angle = (-Math.PI / 2) + (Math.PI * 2 * index) / RADAR_META.length;
    const axisLength = radius * easeOutCubic(axisReveal);
    const x = center + Math.cos(angle) * axisLength;
    const y = center + Math.sin(angle) * axisLength;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(x, y);
    ctx.strokeStyle = `rgba(${gridRgb},${(isLightTheme ? 0.12 : 0.05) + ((isLightTheme ? 0.2 : 0.09) * axisReveal)})`;
    ctx.stroke();

    const labelRadius = radius + 24;
    const labelReveal = getSweepReveal(labelRadius, sweepRadius, 38);
    const labelTravel = (radius * 0.72) + ((labelRadius - (radius * 0.72)) * easeOutCubic(labelReveal));
    const lx = center + Math.cos(angle) * labelTravel;
    const ly = center + Math.sin(angle) * labelTravel;
    ctx.fillStyle = labelColor(labelReveal);
    ctx.font = "13px sans-serif";
    ctx.textAlign = lx >= center + 8 ? "left" : lx <= center - 8 ? "right" : "center";
    ctx.textBaseline = ly >= center + 8 ? "top" : ly <= center - 8 ? "bottom" : "middle";
    ctx.fillText(item.label, lx, ly);
  });

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, hexToRgba(accentA, 0.52));
  gradient.addColorStop(1, hexToRgba(accentB, 0.38));
  ctx.beginPath();
  RADAR_META.forEach((item, index) => {
    const angle = (-Math.PI / 2) + (Math.PI * 2 * index) / RADAR_META.length;
    const targetRadius = radius * (getRadarValue(profile, item.key) / 100);
    const pointReveal = getSweepReveal(targetRadius, sweepRadius, 42);
    const pointRadius = targetRadius * Math.min(1.04, easeOutBack(pointReveal));
    const x = center + Math.cos(angle) * pointRadius;
    const y = center + Math.sin(angle) * pointRadius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = accentA;
  ctx.lineWidth = 2;
  ctx.stroke();

  RADAR_META.forEach((item, index) => {
    const angle = (-Math.PI / 2) + (Math.PI * 2 * index) / RADAR_META.length;
    const targetRadius = radius * (getRadarValue(profile, item.key) / 100);
    const pointReveal = getSweepReveal(targetRadius, sweepRadius, 42);
    const pointRadius = targetRadius * Math.min(1.04, easeOutBack(pointReveal));
    const x = center + Math.cos(angle) * pointRadius;
    const y = center + Math.sin(angle) * pointRadius;
    ctx.beginPath();
    ctx.arc(x, y, 2 + (2 * pointReveal), 0, Math.PI * 2);
    ctx.fillStyle = accentB;
    ctx.fill();
    ctx.strokeStyle = pointStroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

function animateRadar(profile) {
  if (state.radarAnimationId) {
    cancelAnimationFrame(state.radarAnimationId);
    state.radarAnimationId = 0;
  }

  const duration = 680;
  const startAt = performance.now();

  function frame(now) {
    const progress = clampUnit((now - startAt) / duration);
    drawRadar(profile, progress);
    if (progress < 1) {
      state.radarAnimationId = requestAnimationFrame(frame);
      return;
    }
    state.radarAnimationId = 0;
    drawRadar(profile, 1);
  }

  state.radarAnimationId = requestAnimationFrame(frame);
}

function renderProfile(profile) {
  state.profile = profile;
  document.title = `${profile.name} | ${profile.profileType === "user" ? "账户主页" : "开发者主页"}`;
  applyTheme(profile);
  el("profile-name").textContent = profile.name || "";
  el("profile-role").textContent = profile.role || "";
  ensurePermissionBadge(profile);
  el("profile-headline").textContent = profile.headline || "";
  el("profile-quote").textContent = profile.quote || "";
  el("profile-bio").textContent = profile.bio || "";
  el("profile-qq").textContent = profile.qq || "—";
  el("profile-avatar").src = profile.avatar || "/assets/logo.png";
  el("profile-avatar").alt = profile.name || "开发者头像";
  el("profile-cover").src = profile.cover || "/assets/logo.png";
  el("profile-cover").alt = `${profile.name || "开发者"}封面`;
  const projectsHost = el("profile-projects");
  const projectsSection = projectsHost?.closest(".profile-section");
  if (projectsHost instanceof HTMLElement) {
    const projects = Array.isArray(profile.projects) ? profile.projects : [];
    projectsHost.innerHTML = renderProjects(projects);
    if (projectsSection instanceof HTMLElement) {
      projectsSection.hidden = projects.length === 0;
    }
  }
  startSky(profile);
  animateRadar(profile);
}

function ensurePermissionBadge(profile) {
  const roleEl = el("profile-role");
  if (!(roleEl instanceof HTMLElement)) return;
  let badge = el("profile-permission-badge");
  if (!(badge instanceof HTMLElement)) {
    badge = document.createElement("span");
    badge.id = "profile-permission-badge";
    badge.className = "profile-role-badge";
    roleEl.insertAdjacentElement("beforebegin", badge);
  }
  const meta = profile?.permissionBadge;
  if (!meta?.label) {
    badge.hidden = true;
    badge.textContent = "";
    badge.className = "profile-role-badge";
    return;
  }
  badge.hidden = false;
  badge.textContent = meta.label;
  badge.className = `profile-role-badge ${meta.className || ""}`.trim();
}

function applyProfileAvatarSize() {
  const avatar = el("profile-avatar");
  if (!(avatar instanceof HTMLImageElement)) return;
  const compact = window.matchMedia("(max-width: 720px)").matches;
  avatar.style.width = compact ? "50px" : "56px";
  avatar.style.height = compact ? "50px" : "56px";
  avatar.style.borderRadius = compact ? "8px" : "10px";
}

function setCoverFileLabel() {
  const label = el("cover-file-label");
  if (!(label instanceof HTMLElement)) return;
  const file = state.coverFile;
  if (file) {
    label.textContent = `待上传：${file.name}`;
    return;
  }
  const currentCover = state.profile?.cover || "/assets/logo.png";
  label.textContent =
    currentCover === "/assets/logo.png"
      ? "当前封面：默认封面"
      : `当前封面：${currentCover.split("/").pop() || "已上传图片"}`;
}

function updateCoverPreview() {
  const preview = el("cover-preview");
  if (!(preview instanceof HTMLImageElement)) return;
  preview.src = state.profile?.cover || "/assets/logo.png";
  preview.alt = `${state.profile?.name || "开发者"}封面预览`;
  setCoverFileLabel();
}

async function uploadCoverFile() {
  const file = state.coverFile;
  if (!file || !state.profile?.slug) return;
  if (!isImageFile(file)) {
    showToast("只支持 PNG/JPG/JPEG/WEBP/GIF 图片。", false);
    return;
  }
  showToast("封面上传中…", true);
  const data = await fetchJson(`/api/developers/${encodeURIComponent(state.profile.slug)}/cover`, {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "x-file-name": encodeURIComponent(file.name),
    },
    body: await file.arrayBuffer(),
  });
  state.coverFile = null;
  state.profile = data.profile;
  renderProfile(state.profile);
  fillEditor(state.profile);
  showToast("封面已上传", true);
}

async function deleteCover() {
  if (!state.profile?.slug) return;
  showToast("正在删除封面…", true);
  const data = await fetchJson(`/api/developers/${encodeURIComponent(state.profile.slug)}/cover`, {
    method: "DELETE",
  });
  state.coverFile = null;
  state.profile = data.profile;
  renderProfile(state.profile);
  fillEditor(state.profile);
  showToast("封面已恢复默认", true);
}

function renderRadarEditor(profile) {
  const host = el("profile-radar-editor");
  if (!(host instanceof HTMLElement)) return;
  host.innerHTML = RADAR_META.map(
    (item) =>
      `<div class="profile-editor__item">` +
      `<div class="profile-editor__row">` +
      `<span class="profile-editor__label">${escapeHtml(item.label)}</span>` +
      `<span class="profile-editor__value" id="value-${escapeHtml(item.key)}">${getRadarValue(profile, item.key)}</span>` +
      `</div>` +
      `<input class="input" type="range" min="0" max="100" step="1" value="${getRadarValue(profile, item.key)}" data-radar-input="${escapeHtml(item.key)}" />` +
      `</div>`,
  ).join("");

  host.querySelectorAll("[data-radar-input]").forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    input.addEventListener("input", () => {
      const out = el(`value-${input.dataset.radarInput}`);
      if (out) out.textContent = input.value;
    });
  });
}

function fillEditor(profile) {
  setEditorControlValue("edit-theme-preset", profile?.themePreset || "custom");
  setThemeDescription(profile?.themePreset || "custom");
  setEditorControlValue("edit-font-preset", profile?.fontPreset || "default");
  setFontDescription(profile?.fontPreset || "default");
  setEditorControlValue("edit-accent-a", profile?.background?.accentA || "#7dd3fc");
  setEditorControlValue("edit-accent-b", profile?.background?.accentB || "#a78bfa");
  setEditorControlValue("edit-star-color", profile?.background?.starColor || "#ffffff");
  setEditorControlValue(
    "edit-particle-density",
    String(clampNumber(profile?.background?.particleDensity, 20, 140, 72)),
  );
  setEditorControlValue("edit-tags", Array.isArray(profile.tags) ? profile.tags.join("\n") : "");
  setEditorControlValue("edit-headline", profile.headline || "");
  setEditorControlValue("edit-quote", profile.quote || "");
  setEditorControlValue("edit-bio", profile.bio || "");
  state.coverFile = null;
  updateCoverPreview();
  renderRadarEditor(profile);
}

function collectEditorPayload() {
  const radar = {};
  document.querySelectorAll("[data-radar-input]").forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    radar[input.dataset.radarInput] = clampNumber(input.value, 0, 100, 60);
  });
  return {
    cover: state.profile?.cover || "/assets/logo.png",
    themePreset: getInputValue("edit-theme-preset") || "custom",
    fontPreset: getInputValue("edit-font-preset") || "default",
    headline: getInputValue("edit-headline"),
    quote: getInputValue("edit-quote"),
    bio: getInputValue("edit-bio"),
    tagsText: getInputValue("edit-tags"),
    radar,
    background: {
      accentA: getInputValue("edit-accent-a") || "#7dd3fc",
      accentB: getInputValue("edit-accent-b") || "#a78bfa",
      starColor: getInputValue("edit-star-color") || "#ffffff",
      particleDensity: clampNumber(getInputValue("edit-particle-density"), 20, 140, 72),
    },
  };
}

function getCurrentProfileSlug() {
  const pageSlug = document.body.dataset.developerSlug || "";
  if (pageSlug) return pageSlug;
  return state.profile?.slug || "";
}

function matchesCurrentOwner(user) {
  if (!user) return false;
  if (state.profile?.profileType === "user") {
    return Boolean(user.username && state.profile?.username && user.username === state.profile.username);
  }
  const currentSlug = getCurrentProfileSlug();
  return Boolean(user.developerSlug && currentSlug && user.developerSlug === currentSlug);
}

function isOwner() {
  if (state.profile?.profileType !== "user" && !state.profile?.editable) return false;
  return matchesCurrentOwner(state.me);
}

function canEditProfile() {
  return isOwner() && state.profile?.profileType !== "user" && Boolean(state.profile?.editable);
}

async function syncOwnerState(options = {}) {
  const { allowCachedFallback = false } = options;
  ensureOwnerMenu();
  ensureAccountPanel();
  const btn = el("profile-edit-toggle");
  const actions = btn?.closest(".profile-owner-actions");
  const panel = el("profile-editor");
  const menu = el("profile-owner-menu");
  const accountPanel = el("profile-account-panel");
  if (btn instanceof HTMLButtonElement) {
    btn.hidden = true;
  }
  if (actions instanceof HTMLElement) {
    actions.hidden = true;
  }
  if (panel instanceof HTMLElement) {
    panel.hidden = true;
  }
  if (menu instanceof HTMLElement) {
    menu.hidden = true;
  }
  if (accountPanel instanceof HTMLElement) {
    accountPanel.hidden = true;
  }
  setOwnerMenuOpen(false);

  const previousMe = state.me;
  const nextMe = await loadAuth();
  state.me = nextMe;
  if (!nextMe && allowCachedFallback && matchesCurrentOwner(previousMe)) {
    state.me = previousMe;
  }
  const owner = isOwner();
  const editable = canEditProfile();
  if (btn instanceof HTMLButtonElement) {
    btn.hidden = !editable;
  }
  if (actions instanceof HTMLElement) {
    actions.hidden = !editable;
  }
  if (menu instanceof HTMLElement) {
    menu.hidden = !owner;
  }
  if (owner) {
    fillAccountForm(state.me);
  }
  if (owner && state.me?.mustChangePassword) {
    setAccountPanelOpen(true);
    showToast("检测到默认密码未修改，请先在账户设置里完成改密。", false);
  }
  syncUserCoverControl();
  return owner;
}

function toggleEditor(forceOpen) {
  const panel = el("profile-editor");
  if (!(panel instanceof HTMLElement)) return;
  panel.hidden = typeof forceOpen === "boolean" ? !forceOpen : !panel.hidden;
  if (!panel.hidden) {
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function setupEditor() {
  const btn = el("profile-edit-toggle");
  const closeBtn = el("profile-editor-close");
  const form = el("profile-form");
  const dropzone = el("cover-dropzone");
  const fileInput = el("cover-file");
  const pickBtn = el("cover-pick");
  const uploadBtn = el("cover-upload");
  const removeBtn = el("cover-remove");
  const themePreset = el("edit-theme-preset");
  const fontPreset = el("edit-font-preset");
  const accentAInput = el("edit-accent-a");
  const accentBInput = el("edit-accent-b");
  const starColorInput = el("edit-star-color");
  const particleDensityInput = el("edit-particle-density");
  if (
    !(btn instanceof HTMLButtonElement) ||
    !(closeBtn instanceof HTMLButtonElement) ||
    !(form instanceof HTMLFormElement) ||
    !(dropzone instanceof HTMLElement) ||
    !(fileInput instanceof HTMLInputElement) ||
    !(pickBtn instanceof HTMLButtonElement) ||
    !(uploadBtn instanceof HTMLButtonElement) ||
    !(removeBtn instanceof HTMLButtonElement) ||
    !(themePreset instanceof HTMLSelectElement) ||
    !(fontPreset instanceof HTMLSelectElement) ||
    !(accentAInput instanceof HTMLInputElement) ||
    !(accentBInput instanceof HTMLInputElement) ||
    !(starColorInput instanceof HTMLInputElement) ||
    !(particleDensityInput instanceof HTMLInputElement)
  ) {
    return;
  }

  btn.addEventListener("click", async () => {
    const owner = await syncOwnerState({ allowCachedFallback: true });
    if (!owner) {
      showToast("登录状态已失效，请先去后台重新登录自己的账号。", false);
      return;
    }
    if (state.profile) fillEditor(state.profile);
    toggleEditor(true);
  });
  closeBtn.addEventListener("click", () => toggleEditor(false));

  themePreset.addEventListener("change", () => {
    setThemeDescription(themePreset.value);
    if (themePreset.value !== "custom") {
      applyThemePresetToEditor(themePreset.value);
    }
  });

  fontPreset.addEventListener("change", () => {
    setFontDescription(fontPreset.value);
  });

  [accentAInput, accentBInput, starColorInput, particleDensityInput].forEach((input) => {
    input.addEventListener("input", () => {
      if (themePreset.value === "custom") return;
      themePreset.value = "custom";
      setThemeDescription("custom");
    });
  });

  pickBtn.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("click", (e) => {
    if (e.target instanceof HTMLElement && e.target.closest("button")) return;
    fileInput.click();
  });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0] || null;
    state.coverFile = file;
    setCoverFileLabel();
  });
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("is-over");
  });
  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("is-over");
  });
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("is-over");
    const file = e.dataTransfer?.files?.[0] || null;
    state.coverFile = file;
    setCoverFileLabel();
  });
  uploadBtn.addEventListener("click", async () => {
    const owner = await syncOwnerState({ allowCachedFallback: true });
    if (!owner) {
      showToast("登录状态已失效，请先去后台重新登录自己的账号。", false);
      return;
    }
    try {
      await uploadCoverFile();
      fileInput.value = "";
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), false);
    }
  });
  removeBtn.addEventListener("click", async () => {
    const owner = await syncOwnerState({ allowCachedFallback: true });
    if (!owner) {
      showToast("登录状态已失效，请先去后台重新登录自己的账号。", false);
      return;
    }
    try {
      await deleteCover();
      fileInput.value = "";
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), false);
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const owner = await syncOwnerState({ allowCachedFallback: true });
    if (!state.profile?.slug || !owner) {
      showToast("当前不是你的主页，或登录状态已失效，请重新登录后再保存。", false);
      return;
    }
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = true;
    showToast("保存中…", true);
    try {
      const data = await fetchJson(`/api/developers/${encodeURIComponent(state.profile.slug)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(collectEditorPayload()),
      });
      state.profile = data.profile;
      renderProfile(state.profile);
      fillEditor(state.profile);
      showToast("主页资料已保存", true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), false);
    } finally {
      if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = false;
    }
  });
}

function setupAccountControls() {
  ensureOwnerMenu();
  ensureAccountPanel();
  const trigger = el("profile-owner-menu-trigger");
  const accountOpen = el("profile-account-open");
  const logoutBtn = el("profile-logout");
  const closeBtn = el("account-panel-close");
  const form = el("account-form");
  if (
    !(trigger instanceof HTMLButtonElement) ||
    !(accountOpen instanceof HTMLButtonElement) ||
    !(logoutBtn instanceof HTMLButtonElement) ||
    !(closeBtn instanceof HTMLButtonElement) ||
    !(form instanceof HTMLFormElement)
  ) {
    return;
  }
  if (trigger.dataset.bound === "1") return;
  trigger.dataset.bound = "1";

  trigger.addEventListener("click", () => {
    const panel = el("profile-owner-menu-panel");
    const nextOpen = panel instanceof HTMLElement ? panel.hidden : true;
    setOwnerMenuOpen(nextOpen);
  });
  accountOpen.addEventListener("click", () => {
    setOwnerMenuOpen(false);
    setAccountPanelOpen(true);
  });
  closeBtn.addEventListener("click", () => setAccountPanelOpen(false));
  logoutBtn.addEventListener("click", async () => {
    logoutBtn.disabled = true;
    try {
      await postJson("/api/auth/logout", {});
      state.me = null;
      notifyAuthChanged(null);
      setOwnerMenuOpen(false);
      setAccountPanelOpen(false);
      window.location.reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), false);
    } finally {
      logoutBtn.disabled = false;
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const newUsernameInput = el("account-new-username");
    const currentPasswordInput = el("account-current-password");
    const newPasswordInput = el("account-new-password");
    const confirmPasswordInput = el("account-confirm-password");
    if (
      !(newUsernameInput instanceof HTMLInputElement) ||
      !(currentPasswordInput instanceof HTMLInputElement) ||
      !(newPasswordInput instanceof HTMLInputElement) ||
      !(confirmPasswordInput instanceof HTMLInputElement)
    ) {
      return;
    }

    const payload = {
      newUsername: newUsernameInput.value.trim(),
      currentPassword: currentPasswordInput.value,
      newPassword: newPasswordInput.value,
    };
    const wantsUsername = Boolean(payload.newUsername) && payload.newUsername !== (state.me?.username || "");
    const wantsPassword = Boolean(payload.newPassword.trim());
    if (!wantsUsername && !wantsPassword) {
      showAccountToast("请至少修改账户名或密码中的一项。", false);
      return;
    }
    if (wantsPassword && payload.newPassword !== confirmPasswordInput.value) {
      showAccountToast("两次输入的新密码不一致。", false);
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = true;
    try {
      const data = await patchJson("/api/auth/account", payload);
      state.me = data.user || null;
      notifyAuthChanged(state.me);
      fillAccountForm(state.me);
      setOwnerMenuOpen(false);
      showAccountToast("账户设置已保存", true);
      if (state.profile?.profileType === "user" && state.me?.profileUrl) {
        window.location.replace(state.me.profileUrl);
        return;
      }
      await syncOwnerState();
      setAccountPanelOpen(false);
    } catch (err) {
      showAccountToast(`保存失败：${err instanceof Error ? err.message : String(err)}`, false);
      setAccountPanelOpen(true);
    } finally {
      if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = false;
    }
  });

  document.addEventListener("click", (event) => {
    const menu = el("profile-owner-menu");
    if (!(menu instanceof HTMLElement) || menu.hidden) return;
    const target = event.target;
    if (target instanceof Node && menu.contains(target)) return;
    setOwnerMenuOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    setOwnerMenuOpen(false);
    const panel = el("profile-account-panel");
    if (panel instanceof HTMLElement && !panel.hidden) {
      setAccountPanelOpen(false);
    }
  });
}

async function loadAuth() {
  if (window.__SITE_AUTH_PROMISE) {
    return window.__SITE_AUTH_PROMISE;
  }
  try {
    const data = await fetchJson("/api/auth/me");
    return data.user || null;
  } catch (error) {
    return null;
  }
}

async function main() {
  setupAccountControls();
  setupEditor();
  startClock();

  const slug = document.body.dataset.developerSlug || "";
  const isUserProfile = document.body.dataset.profileMode === "user";
  const username = new URLSearchParams(window.location.search).get("user") || "";
  const requestUrl = isUserProfile
    ? `/api/users/${encodeURIComponent(username)}/profile`
    : `/api/developers/${encodeURIComponent(slug)}`;
  if (isUserProfile ? !username : !slug) return;

  try {
    const [me, profileData] = await Promise.all([loadAuth(), fetchJson(requestUrl)]);
    state.me = me;
    renderProfile(profileData.profile);
    await syncOwnerState();
    if (isOwner()) {
      fillEditor(profileData.profile);
    }
  } catch {
    document.title = isUserProfile ? "账户不存在" : "开发者不存在";
    el("profile-name").textContent = isUserProfile ? "未找到账户主页" : "未找到开发者";
    el("profile-role").textContent = "请返回首页重新选择。";
  }
}

window.addEventListener("resize", () => {
  applyProfileAvatarSize();
  if (state.profile) drawRadar(state.profile);
});

new MutationObserver(() => {
  if (state.profile) {
    applyTheme(state.profile);
    drawRadar(state.profile);
  }
}).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["data-theme"],
});

window.addEventListener("focus", () => {
  if (state.profile) {
    void syncOwnerState();
  }
});

await waitForPageTransition;
await main();
applyProfileAvatarSize();
