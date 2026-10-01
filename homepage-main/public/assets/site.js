const THEME_KEY = "site-theme";
const THEME_DARK = "dark";
const THEME_LIGHT = "light";
const PAGE_TRANSITION_KEY = "page-transition-pending";
const PAGE_TRANSITION_ENTER_MS = 520;
const PAGE_TRANSITION_SPIN_MS = 500;
const PAGE_TRANSITION_HOLD_MS = 500;
const PAGE_TRANSITION_EXIT_MS = 520;
const PAGE_TRANSITION_MIN_VISIBLE_MS = 500;
const THEME_TRANSITION_MS = 600;
const AUTH_CHANGED_EVENT = "site:auth-changed";
let __siteTransitionDoneResolve = null;
let __siteTransitionDonePromise = Promise.resolve();

function markPageTransitionBusy() {
  if (!__siteTransitionDoneResolve) {
    __siteTransitionDonePromise = new Promise((resolve) => {
      __siteTransitionDoneResolve = resolve;
    });
    window.__SITE_PAGE_TRANSITION_DONE = __siteTransitionDonePromise;
  }
}

function markPageTransitionIdle() {
  if (__siteTransitionDoneResolve) {
    const resolve = __siteTransitionDoneResolve;
    __siteTransitionDoneResolve = null;
    resolve();
  }
  __siteTransitionDonePromise = Promise.resolve();
  window.__SITE_PAGE_TRANSITION_DONE = __siteTransitionDonePromise;
}

window.__SITE_PAGE_TRANSITION_DONE = __siteTransitionDonePromise;
const REVEAL_SELECTOR = [
  "main > section",
  ".section__head",
  ".hero__left",
  ".hero__right",
  ".card",
  ".dev",
  ".panel",
  ".step",
  ".download__latest",
  ".history__item",
  ".contact__row",
  ".dropzone",
  ".tile",
  ".tabs",
  ".gallery",
  ".table tbody tr",
  ".footer__inner",
].join(", ");

// #region debug-point A:page-transition-reporter
const __TRAE_DBG_URL = "/api/debug/event";
const __TRAE_DBG_SESSION = "loading-switch-animation";
const __TRAE_DBG_RUN_ID = "pre-fix";

function __traeDbgEnabled() {
  return false; // 关闭旧调试上报(/api/debug/event 已移除)
}

function __traeDbgEvent(hypothesisId, name, data, location = "public/assets/site.js") {
  try {
    if (!__traeDbgEnabled()) return;
    const payload = {
      sessionId: __TRAE_DBG_SESSION,
      runId: __TRAE_DBG_RUN_ID,
      hypothesisId,
      ts: Date.now(),
      location,
      msg: `[DEBUG] ${String(name)}`,
      href: String(window.location.href),
      name: String(name),
      data: data ?? null,
    };
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(__TRAE_DBG_URL, new Blob([body], { type: "application/json" }));
      return;
    }
    fetch(__TRAE_DBG_URL, {
      method: "POST",
      mode: "cors",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
  }
}
// #endregion

// ---------- 全局浮动提示弹窗 ----------
function siteToast(message, type = "info") {
  if (!document.body) return;
  let host = document.getElementById("site-toasts");
  if (!host) {
    host = document.createElement("div");
    host.id = "site-toasts";
    host.style.cssText =
      "position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:99999;" +
      "display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;";
    document.body.appendChild(host);
  }
  const colors = { success: "#16a34a", error: "#dc2626", info: "#2563eb", warn: "#d97706" };
  const bg = colors[type] || colors.info;
  const t = document.createElement("div");
  t.textContent = message;
  t.style.cssText =
    `pointer-events:auto;max-width:90vw;padding:10px 16px;border-radius:10px;color:#fff;` +
    `background:${bg};box-shadow:0 6px 20px rgba(0,0,0,.18);font-size:14px;line-height:1.4;` +
    `opacity:0;transform:translateY(-8px);transition:opacity .2s ease,transform .2s ease;`;
  host.appendChild(t);
  requestAnimationFrame(() => {
    t.style.opacity = "1";
    t.style.transform = "translateY(0)";
  });
  const ttl = type === "error" ? 4200 : 3000;
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateY(-8px)";
    setTimeout(() => t.remove(), 260);
  }, ttl);
}
window.siteToast = siteToast;

function readTransitionFlag() {
  try {
    const raw = sessionStorage.getItem(PAGE_TRANSITION_KEY);
    if (!raw) return false;
    sessionStorage.removeItem(PAGE_TRANSITION_KEY);
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < 8000;
  } catch {
    return false;
  }
}

function writeTransitionFlag() {
  try {
    sessionStorage.setItem(PAGE_TRANSITION_KEY, String(Date.now()));
  } catch {
  }
}

function isSamePageUrl(url) {
  const current = new URL(window.location.href);
  return (
    url.origin === current.origin &&
    url.pathname === current.pathname &&
    url.search === current.search &&
    url.hash === current.hash
  );
}

function isTransitionableLink(link) {
  if (!(link instanceof HTMLAnchorElement)) return false;
  if (link.hasAttribute("download")) return false;
  if (link.target && link.target !== "_self") return false;
  if (link.dataset.noTransition === "1") return false;
  const href = link.getAttribute("href") || "";
  if (!href || href.startsWith("#")) return false;
  if (/^(mailto:|tel:|javascript:)/i.test(href)) return false;

  let url;
  try {
    url = new URL(link.href, window.location.href);
  } catch {
    return false;
  }
  if (url.origin !== window.location.origin) return false;
  if (url.pathname.startsWith("/download/")) return false;
  if (/\.(zip|jar|png|jpe?g|webp|gif|pdf|txt|json|csv|mp3|mp4|webm)$/i.test(url.pathname)) {
    return false;
  }
  if (isSamePageUrl(url)) return false;
  return true;
}

function ensurePageTransition() {
  let overlay = document.getElementById("page-transition");
  if (overlay) {
    // #region debug-point A:ensure-existing
    __traeDbgEvent("A", "ensurePageTransition:existing", { className: overlay.className });
    // #endregion
    return overlay;
  }

  overlay = document.createElement("div");
  overlay.id = "page-transition";
  overlay.className = "page-transition is-hidden";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML =
    `<div class="page-transition__inner">` +
    `<svg class="page-transition__spinner" viewBox="0 0 50 50" aria-hidden="true">` +
    `<circle r="20" cx="25" cy="25"></circle>` +
    `</svg>` +
    `<p class="page-transition__text">LOADING</p>` +
    `</div>`;
  document.body.appendChild(overlay);
  // #region debug-point B:overlay-events
  if (overlay.dataset.debugBound !== "1") {
    overlay.dataset.debugBound = "1";
    const reportOverlayEvent = (eventName, event) => {
      const target = event.target instanceof Element ? event.target : null;
      __traeDbgEvent(
        "B",
        `overlay:${eventName}`,
        {
          className: overlay.className,
          propertyName: "propertyName" in event ? event.propertyName || "" : "",
          animationName: "animationName" in event ? event.animationName || "" : "",
          targetClassName: target?.className || target?.tagName || "",
          elapsedTime: "elapsedTime" in event ? Number(event.elapsedTime || 0) : 0,
        },
        "public/assets/site.js:overlay-events",
      );
    };
    ["transitionrun", "transitionstart", "transitionend", "transitioncancel"].forEach((type) => {
      overlay.addEventListener(type, (event) => reportOverlayEvent(type, event), true);
    });
    ["animationstart", "animationend", "animationcancel"].forEach((type) => {
      overlay.addEventListener(type, (event) => reportOverlayEvent(type, event), true);
    });
  }
  __traeDbgEvent("B", "ensurePageTransition:created", { className: overlay.className });
  // #endregion
  return overlay;
}

function showPageTransition() {
  const overlay = ensurePageTransition();
  const classNameBefore = overlay.className;
  overlay.classList.remove("is-hidden", "is-leaving", "is-spinning");
  overlay.dataset.shownAt = String(performance.now());
  markPageTransitionBusy();
  // #region debug-point A:show
  __traeDbgEvent("A", "pageTransition:show", {
    classNameBefore,
    classNameAfter: overlay.className,
    shownAt: overlay.dataset.shownAt,
  });
  // #endregion
  document.body.classList.add("is-page-transitioning");
}

function spinPageTransition() {
  const overlay = ensurePageTransition();
  const classNameBefore = overlay.className;
  overlay.classList.remove("is-spinning");
  void overlay.offsetHeight;
  overlay.classList.add("is-spinning");
  // #region debug-point B:spin
  __traeDbgEvent("B", "pageTransition:spin", {
    classNameBefore,
    classNameAfter: overlay.className,
  });
  // #endregion
}

function hidePageTransition() {
  const overlay = ensurePageTransition();
  const shownAt = Number(overlay.dataset.shownAt || "0");
  const elapsed = Number.isFinite(shownAt) ? performance.now() - shownAt : 0;
  const waitMs =
    Number.isFinite(elapsed) && elapsed < PAGE_TRANSITION_MIN_VISIBLE_MS
      ? PAGE_TRANSITION_MIN_VISIBLE_MS - elapsed
      : 0;
  // #region debug-point C:hide-scheduled
  __traeDbgEvent("C", "pageTransition:hideScheduled", {
    className: overlay.className,
    shownAt,
    elapsed,
    waitMs,
  });
  // #endregion

  window.setTimeout(() => {
    const classNameBefore = overlay.className;
    overlay.classList.add("is-leaving");
    // #region debug-point C:leave
    __traeDbgEvent("C", "pageTransition:leave", {
      classNameBefore,
      classNameAfter: overlay.className,
    });
    // #endregion
    window.setTimeout(() => {
      const nestedClassNameBefore = overlay.className;
      // 从 is-leaving(下移出屏) 复位到 is-hidden(上移出屏) 时禁用过渡,
      // 否则遮罩会带着背景色从底部滑到顶部穿过整屏,造成"背景色页面向上滑动"的观感。
      const prevTransition = overlay.style.transition;
      overlay.style.transition = "none";
      overlay.classList.add("is-hidden");
      overlay.classList.remove("is-leaving", "is-spinning");
      void overlay.offsetHeight;
      overlay.style.transition = prevTransition;
      // #region debug-point C:hidden
      __traeDbgEvent("C", "pageTransition:hidden", {
        classNameBefore: nestedClassNameBefore,
        classNameAfter: overlay.className,
      });
      // #endregion
      document.body.classList.remove("is-page-transitioning");
      markPageTransitionIdle();
    }, PAGE_TRANSITION_EXIT_MS);
  }, waitMs);
}

function runEntryTransition() {
  // #region debug-point D:entry-start
  __traeDbgEvent("D", "entryTransition:start", {
    readyState: document.readyState,
    visibilityState: document.visibilityState,
  });
  // #endregion
  const overlay = ensurePageTransition();
  const continued =
    !overlay.classList.contains("is-hidden") &&
    overlay.classList.contains("is-spinning") &&
    !overlay.classList.contains("is-leaving");
  if (continued) {
    if (!overlay.dataset.shownAt) {
      overlay.dataset.shownAt = String(performance.now());
    }
    document.body.classList.add("is-page-transitioning");
    markPageTransitionBusy();
    // #region debug-point D:entry-continued
    __traeDbgEvent("D", "entryTransition:continued", {
      className: overlay.className,
      shownAt: overlay.dataset.shownAt,
    });
    // #endregion
  } else {
    showPageTransition();
    // Continue spinning immediately on the destination page so the transfer feels uninterrupted.
    spinPageTransition();
  }
  window.setTimeout(hidePageTransition, PAGE_TRANSITION_SPIN_MS + PAGE_TRANSITION_HOLD_MS);
}

function navigateWithTransition(target, options = {}) {
  const { useHistoryBack = false, replace = false } = options;
  writeTransitionFlag();
  // #region debug-point E:navigate-prepare
  __traeDbgEvent("E", "navigate:prepare", {
    target,
    useHistoryBack,
    replace,
    enterMs: PAGE_TRANSITION_ENTER_MS,
    spinMs: PAGE_TRANSITION_SPIN_MS,
    holdMs: PAGE_TRANSITION_HOLD_MS,
    exitMs: PAGE_TRANSITION_EXIT_MS,
  });
  // #endregion
  showPageTransition();
  window.setTimeout(spinPageTransition, PAGE_TRANSITION_ENTER_MS);
  window.setTimeout(() => {
    // #region debug-point E:navigate-fire
    __traeDbgEvent("E", "navigate:fire", {
      target,
      useHistoryBack,
      replace,
      bodyTransitioning: document.body.classList.contains("is-page-transitioning"),
    });
    // #endregion
    if (useHistoryBack) {
      window.history.back();
      return;
    }
    if (replace) {
      window.location.replace(target);
      return;
    }
    window.location.href = target;
  }, PAGE_TRANSITION_ENTER_MS + PAGE_TRANSITION_SPIN_MS + PAGE_TRANSITION_HOLD_MS);
}

function setupPageTransition() {
  if (!document.body) return;
  ensurePageTransition();
  if (!document.body.classList.contains("is-page-transitioning")) {
    markPageTransitionIdle();
  }
  const shouldPlayEnter = readTransitionFlag();
  // #region debug-point D:setup
  __traeDbgEvent("D", "setupPageTransition", {
    shouldPlayEnter,
    readyState: document.readyState,
    visibilityState: document.visibilityState,
  });
  // #endregion
  if (shouldPlayEnter) {
    runEntryTransition();
  }

  window.addEventListener("pageshow", (event) => {
    // #region debug-point D:pageshow
    __traeDbgEvent("D", "pageshow", {
      persisted: Boolean(event.persisted),
      href: window.location.href,
    });
    // #endregion
    if (!event.persisted && !readTransitionFlag()) return;
    runEntryTransition();
  });

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest("a") : null;
    if (!(link instanceof HTMLAnchorElement) || !isTransitionableLink(link)) return;
    // #region debug-point E:click
    __traeDbgEvent("E", "click:transitionable", {
      href: link.getAttribute("href") || "",
      resolvedHref: link.href,
      target: link.target || "",
      noTransition: link.dataset.noTransition || "",
    });
    // #endregion
    event.preventDefault();
    navigateWithTransition(link.href);
  }, true);
}

function readSavedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return "";
  }
}

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? THEME_DARK : THEME_LIGHT;
}

function getTheme() {
  const saved = readSavedTheme();
  if (saved === THEME_DARK || saved === THEME_LIGHT) return saved;
  return document.documentElement.dataset.theme || getSystemTheme();
}

function persistTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
  }
}

function updateThemeButtons(theme) {
  const nextTheme = theme === THEME_DARK ? THEME_LIGHT : THEME_DARK;
  const nextLabel = nextTheme === THEME_LIGHT ? "亮色" : "暗色";
  document.querySelectorAll('[data-theme-toggle="1"]').forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    const icon = button.querySelector("[data-theme-icon]");
    const label = button.querySelector("[data-theme-label]");
    if (icon) icon.textContent = theme === THEME_DARK ? "☀" : "☾";
    if (label) label.textContent = theme === THEME_DARK ? "亮色" : "暗色";
    button.setAttribute("aria-label", `切换到${nextLabel}模式`);
    button.title = `切换到${nextLabel}模式`;
  });
}

let themeTransitionFrame = 0;
let themeTransitionApplyFrame = 0;
let themeTransitionSwapTimer = 0;
let themeViewTransitionStylesReady = false;

function ensureThemeViewTransitionStyles() {
  if (themeViewTransitionStylesReady) return;
  const existing = document.getElementById("theme-view-transition-styles");
  if (existing) {
    themeViewTransitionStylesReady = true;
    return;
  }
  const style = document.createElement("style");
  style.id = "theme-view-transition-styles";
  style.textContent = `
html.is-theme-transitioning::view-transition-old(root),
html.is-theme-transitioning::view-transition-new(root) {
  animation-duration: var(--theme-switch-duration);
  animation-timing-function: var(--theme-switch-ease);
  animation-fill-mode: both;
}

html.is-theme-transitioning[data-theme-transition-direction="to-dark"]::view-transition-old(root) {
  animation-name: theme-switch-old-to-dark;
}

html.is-theme-transitioning[data-theme-transition-direction="to-dark"]::view-transition-new(root) {
  animation-name: theme-switch-new-to-dark;
}

html.is-theme-transitioning[data-theme-transition-direction="to-light"]::view-transition-old(root) {
  animation-name: theme-switch-old-to-light;
}

html.is-theme-transitioning[data-theme-transition-direction="to-light"]::view-transition-new(root) {
  animation-name: theme-switch-new-to-light;
}

@media (prefers-reduced-motion: reduce) {
  html.is-theme-transitioning::view-transition-old(root),
  html.is-theme-transitioning::view-transition-new(root) {
    animation-duration: var(--theme-switch-duration) !important;
    animation-timing-function: var(--theme-switch-ease) !important;
    animation-fill-mode: both !important;
  }
}`;
  document.head.appendChild(style);
  themeViewTransitionStylesReady = true;
}

function clearThemeTransitionState() {
  window.cancelAnimationFrame(themeTransitionFrame);
  window.cancelAnimationFrame(themeTransitionApplyFrame);
  window.clearTimeout(themeTransitionSwapTimer);
  themeTransitionFrame = 0;
  themeTransitionApplyFrame = 0;
  themeTransitionSwapTimer = 0;
}

function finishThemeTransition() {
  clearThemeTransitionState();
  const root = document.documentElement;
  root.classList.remove("is-theme-transitioning");
  delete root.dataset.themeTransitionDirection;
}

function applyThemeWithComfort(nextTheme, persist = false) {
  const root = document.documentElement;
  const currentTheme = getTheme();
  if (currentTheme === nextTheme) {
    applyTheme(nextTheme, persist);
    return;
  }

  const direction = currentTheme === THEME_DARK && nextTheme === THEME_LIGHT ? "to-light" : "to-dark";
  clearThemeTransitionState();
  root.dataset.themeTransitionDirection = direction;
  root.classList.add("is-theme-transitioning");
  if (typeof document.startViewTransition === "function") {
    ensureThemeViewTransitionStyles();
    const transition = document.startViewTransition(() => {
      applyTheme(nextTheme, persist);
    });
    themeTransitionSwapTimer = window.setTimeout(() => {
      finishThemeTransition();
    }, THEME_TRANSITION_MS + 80);
    transition.finished.catch(() => {}).finally(() => {
      finishThemeTransition();
    });
    return;
  }
  themeTransitionFrame = window.requestAnimationFrame(() => {
    themeTransitionApplyFrame = window.requestAnimationFrame(() => {
      applyTheme(nextTheme, persist);
    });
  });
  themeTransitionSwapTimer = window.setTimeout(() => {
    finishThemeTransition();
  }, THEME_TRANSITION_MS + 80);
}

function applyTheme(theme, persist = false) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  updateThemeButtons(theme);
  if (persist) persistTheme(theme);
}

function setupThemeToggle() {
  document.querySelectorAll('[data-theme-toggle="1"]').forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    button.addEventListener("click", () => {
      const next = getTheme() === THEME_DARK ? THEME_LIGHT : THEME_DARK;
      applyThemeWithComfort(next, true);
    });
  });
}

function setupTopbarState() {
  const topbar = document.querySelector(".topbar");
  if (!(topbar instanceof HTMLElement)) return;

  function sync() {
    topbar.classList.toggle("is-scrolled", window.scrollY > 12);
  }

  sync();
  window.addEventListener("scroll", sync, { passive: true });
}

function setupBackButton() {
  if (window.location.pathname === "/" || window.location.pathname === "/index.html") return;
  document.querySelectorAll(".nav").forEach((nav) => {
    if (!(nav instanceof HTMLElement) || nav.querySelector('[data-nav-back="1"]')) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nav__btn nav__btn--back";
    button.dataset.navBack = "1";
    button.textContent = "返回上一页";
    button.addEventListener("click", () => {
      if (window.history.length > 1 && document.referrer) {
        navigateWithTransition("", { useHistoryBack: true });
        return;
      }
      navigateWithTransition("/");
    });
    nav.prepend(button);
  });
}

let pendingUserRequest = null;

async function loadCurrentUser() {
  if (pendingUserRequest) return pendingUserRequest;

  const promise = (async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return null;
      return data.user || null;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return null;
      }
      return null;
    } finally {
      pendingUserRequest = null;
    }
  })();

  pendingUserRequest = promise;
  window.__SITE_AUTH_PROMISE = promise;
  return promise;
}

function setupAccountShortcut(user) {
  const isSignedIn = Boolean(user?.username);
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  const has = (cap) => perms.includes("*") || perms.includes(cap);
  const canManage = has("users.manage") || has("roles.configure") || has("changelog.manage") || has("mods.manage") || has("developers.manage");
  const canService = has("feedback.manage") || has("workshop.review");

  document.querySelectorAll(".nav").forEach((nav) => {
    if (!(nav instanceof HTMLElement)) return;
    let area = nav.querySelector('[data-account-area="1"]');
    if (!(area instanceof HTMLElement)) {
      area = document.createElement("span");
      area.dataset.accountArea = "1";
      area.style.display = "inline-flex";
      area.style.gap = "8px";
      area.style.alignItems = "center";
      nav.append(area);
    }
    area.replaceChildren();

    if (!isSignedIn) {
      const login = document.createElement("a");
      login.href = "/login.html";
      login.className = "nav__btn";
      login.textContent = "登录";
      const reg = document.createElement("a");
      reg.href = "/register.html";
      reg.textContent = "注册";
      area.append(login, reg);
      return;
    }

    if (canService || canManage) {
      const a = document.createElement("a");
      a.href = "/admin.html";
      a.textContent = "后台";
      area.append(a);
    }
    // 头像 -> 个人主页(展示页);名字 -> 账户设置。两个入口分别指向不同页面。
    const profileHref = `/profile.html?user=${encodeURIComponent(user.username)}`;
    const acc = document.createElement("a");
    acc.href = profileHref;
    acc.className = "nav__account";
    acc.title = "查看个人主页";
    const avatar = document.createElement("img");
    avatar.className = "nav__account-avatar";
    avatar.src = user.avatar || "/assets/logo.png";
    avatar.alt = `${user.displayName || user.username || "用户"}头像`;
    avatar.onerror = () => { avatar.onerror = null; avatar.src = "/assets/logo.png"; };
    acc.append(avatar);

    // 名字作为兄弟元素,用自带省略号的 .nav__account-name(放进 38px 头像按钮会被裁掉)
    const name = document.createElement("a");
    name.href = "/account.html";
    name.className = "nav__account-name";
    name.textContent = user.displayName || user.username;
    name.title = "账户设置";

    const logout = document.createElement("a");
    logout.href = "#";
    logout.textContent = "退出";
    logout.addEventListener("click", async (e) => {
      e.preventDefault();
      try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
      window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT, { detail: { user: null } }));
      window.location.assign("/");
    });
    area.append(acc, name, logout);
  });
}

// 供 account.js 等在更新资料后刷新导航
window.__SITE_REFRESH_AUTH = (user) => { void syncAccountShortcut(user); };

function syncAuthRequiredNodes(user) {
  const level = Number(user?.level || 0);
  document.querySelectorAll('[data-auth-required="1"]').forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const minLevel = Number(node.dataset.authMinLevel || 0);
    node.hidden = !user || level < minLevel;
  });
}

async function syncAccountShortcut(user) {
  const nextUser = user === undefined ? await loadCurrentUser() : user;
  setupAccountShortcut(nextUser);
  syncAuthRequiredNodes(nextUser);
}

function watchAccountShortcut() {
  window.addEventListener(AUTH_CHANGED_EVENT, (event) => {
    const nextUser = event instanceof CustomEvent ? event.detail?.user : undefined;
    void syncAccountShortcut(nextUser);
  });

  window.addEventListener("focus", () => {
    void syncAccountShortcut();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    // 延迟一小会儿，避免与初始加载冲突
    setTimeout(() => {
      void syncAccountShortcut();
    }, 100);
  });
}

function setupReveal() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const seen = new WeakSet();
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const target = entry.target;
        if (target instanceof HTMLElement) {
          target.classList.add("is-visible");
        }
        observer.unobserve(target);
      });
    },
    {
      threshold: 0.12,
      rootMargin: "0px 0px -8% 0px",
    },
  );

  function prepare(node) {
    if (!(node instanceof HTMLElement) || seen.has(node)) return;
    seen.add(node);
    node.classList.add("reveal-target");
    const parent = node.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((item) => item.matches(REVEAL_SELECTOR));
      const index = Math.max(0, siblings.indexOf(node));
      node.style.setProperty("--reveal-delay", `${Math.min(index * 70, 280)}ms`);
    }
    observer.observe(node);
  }

  function collect(root) {
    if (!(root instanceof Element)) return;
    if (root.matches(REVEAL_SELECTOR)) prepare(root);
    root.querySelectorAll(REVEAL_SELECTOR).forEach(prepare);
  }

  collect(document.body);

  const mutation = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) collect(node);
      });
    });
  });

  mutation.observe(document.body, { childList: true, subtree: true });
}

function watchSystemTheme() {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", () => {
    const saved = readSavedTheme();
    if (saved === THEME_DARK || saved === THEME_LIGHT) return;
    applyTheme(media.matches ? THEME_DARK : THEME_LIGHT);
  });
}

applyTheme(getTheme());
setupPageTransition();
setupBackButton();
setupThemeToggle();
setupTopbarState();
setupReveal();
watchSystemTheme();
watchAccountShortcut();
await syncAccountShortcut();
