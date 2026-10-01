const waitForPageTransition =
  window.__SITE_PAGE_TRANSITION_DONE instanceof Promise
    ? window.__SITE_PAGE_TRANSITION_DONE
    : Promise.resolve();
function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)}${units[i]}`;
}

function formatDate(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const BRANCH_LABELS = {
  main: "forge",
  neoforge: "neoforge",
  sponsor: "内测版(赞助)",
};

function el(id) {
  return document.getElementById(id);
}

function formatBranchLabel(branch) {
  return BRANCH_LABELS[branch] || branch;
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

function linkify(text) {
  const urlPattern = /(https?:\/\/[^\s]+)|(github\.com\/[^\s]+)|(docs\.qq\.com\/[^\s]+)/gi;
  return text.replace(urlPattern, (m) => {
    const url = m.startsWith("http") ? m : `https://${m}`;
    const safe = url.replaceAll('"', "");
    return `<a class="link" href="${safe}" target="_blank" rel="noreferrer">${m}</a>`;
  });
}

function linkifySafe(text) {
  const escaped = escapeHtml(text);
  const urlPattern = /(https?:\/\/[^\s<]+)|(github\.com\/[^\s<]+)|(docs\.qq\.com\/[^\s<]+)/gi;
  return escaped.replace(urlPattern, (m) => {
    const url = m.startsWith("http") ? m : `https://${m}`;
    const safe = url.replaceAll('"', "");
    return `<a class="link" href="${safe}" target="_blank" rel="noreferrer">${m}</a>`;
  });
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeExternalLinks(mod) {
  if (Array.isArray(mod?.externalLinks)) {
    return mod.externalLinks
      .map((item, index) => {
        const url = typeof item?.url === "string" ? item.url : "";
        if (!url) return null;
        const label = typeof item?.label === "string" && item.label.trim()
          ? item.label.trim()
          : `站外下载 ${index + 1}`;
        return { label, url };
      })
      .filter(Boolean);
  }

  const fallback = String(mod?.externalUrl || (mod?.externalOnly ? mod?.url : "") || "");
  return fallback ? [{ label: "站外下载", url: fallback }] : [];
}

function normalizeDownloadLinks(mod) {
  return normalizeExternalLinks(mod).map((item) => ({
      ...item,
      external: true,
    }));
}

function renderDownloadButtons(mod, primaryClassName) {
  const links = normalizeDownloadLinks(mod);
  if (links.length === 0) return `<div class="hint">当前暂无可用下载链接</div>`;
  return (
    `<div style="display:flex;gap:10px;flex-wrap:wrap;">` +
    links
      .map(
        (link, index) =>
            `<a class="btn ${escapeHtml(index === 0 ? primaryClassName : "btn--ghost")}" href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">🌐 ${escapeHtml(link.label)}</a>`,
      )
      .join("") +
    `</div>`
  );
}

function setupModal() {
  const modal = el("img-modal");
  const img = el("modal-img");
  const caption = el("modal-caption");
  const btnPrev = el("modal-prev");
  const btnNext = el("modal-next");
  let items = [];
  let index = 0;

  function close() {
    modal.hidden = true;
    img.src = "";
    caption.textContent = "";
  }

  function open(list, startIndex) {
    items = list;
    index = Math.max(0, Math.min(startIndex, items.length - 1));
    modal.hidden = false;
    render();
  }

  function render() {
    const item = items[index];
    if (!item) return;
    img.src = item.url;
    img.alt = item.title || item.fileName || "";
    caption.textContent = item.title || item.fileName || "";
  }

  function prev() {
    index = (index - 1 + items.length) % items.length;
    render();
  }

  function next() {
    index = (index + 1) % items.length;
    render();
  }

  modal.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.close === "1") close();
  });

  document.addEventListener("keydown", (e) => {
    if (modal.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  });

  btnPrev.addEventListener("click", prev);
  btnNext.addEventListener("click", next);

  return { open, close };
}

async function loadAnnouncements() {
  const track = el("announce-track");
  try {
    const data = await fetchJson("/api/announcements");
    const list = Array.isArray(data.announcements) ? data.announcements : [];
    if (list.length === 0) {
      track.innerHTML = `<div class="announce__item">暂无公告</div>`;
      return;
    }
    const html = list
      .map((t) => `<span class="announce__item">${linkify(t)}</span>`)
      .join(`<span class="muted">|</span>`);
    track.innerHTML = `<div class="marquee" id="marquee">${html}</div>`;
    startMarquee(track, el("marquee"));
  } catch {
    track.innerHTML = `<div class="announce__item">公告加载失败</div>`;
  }
}

async function loadFeatures() {
  const grid = el("features-grid");
  if (!grid) return;
  try {
    const data = await fetchJson("/api/features");
    const features = Array.isArray(data.features) ? data.features : [];
    if (features.length === 0) return; // 未配置 → 保留页面静态默认卡
    grid.innerHTML = features
      .map(
        (f) =>
          `<div class="card">` +
          `<div class="card__icon">${escapeHtml(f.icon || "")}</div>` +
          `<div class="card__title">${escapeHtml(f.title || "")}</div>` +
          `<div class="card__desc">${escapeHtml(f.desc || "")}</div>` +
          `</div>`,
      )
      .join("");
  } catch {}
}

function startMarquee(container, inner) {
  if (!container || !inner) return;
  let last = performance.now();
  let offset = 0;
  let paused = false;

  const clone = inner.cloneNode(true);
  if (clone instanceof HTMLElement) {
    clone.id = "marquee-clone";
    inner.after(clone);
  }

  function step(now) {
    const dt = Math.min(32, now - last);
    last = now;
    if (!paused) offset += dt * 0.03;
    const w = inner.getBoundingClientRect().width;
    if (w > 0 && offset >= w) offset -= w;
    inner.style.transform = `translateX(${-offset}px)`;
    if (clone instanceof HTMLElement) clone.style.transform = `translateX(${-offset + w}px)`;
    requestAnimationFrame(step);
  }

  container.addEventListener("mouseenter", () => {
    paused = true;
  });
  container.addEventListener("mouseleave", () => {
    paused = false;
  });

  requestAnimationFrame(step);
}

function renderLatest(mod) {
  const latest = el("download-latest");
  if (!latest) return;
  if (!mod) {
    latest.innerHTML =
      `<div class="dl__title">暂无可下载版本</div>` +
      `<div class="dl__desc">当前分支暂未配置站外下载链接，请稍后查看。</div>`;
    return;
  }

  const title = escapeHtml(mod.versionGuess || mod.fileName || "—");
  const desc = escapeHtml(mod.description || "该版本仅提供站外下载链接，由后台统一维护。");
  const btns = renderDownloadButtons(mod, "btn--primary");
  const links = normalizeExternalLinks(mod);
  latest.innerHTML =
    `<div class="dl__title">${title}</div>` +
    `<div class="dl__desc">${desc}</div>` +
    `<div class="dl__meta">` +
    `<span>🌐 ${links.length} 个站外链接</span>` +
    `<span>📅 ${formatDate(mod.mtimeMs)}</span>` +
    `</div>` +
    btns;
}

function renderHistory(list) {
  const history = el("history");
  if (!history) return;
  history.innerHTML = "";
  for (const mod of list) {
    const title = escapeHtml(mod.versionGuess || mod.fileName || "—");
    const links = normalizeExternalLinks(mod);
    const btns = renderDownloadButtons(mod, "btn--ghost");
    const div = document.createElement("div");
    div.className = "history__item";
    div.innerHTML =
      `<div class="history__left">` +
      `<div class="history__name">${title}</div>` +
      `<div class="history__meta"><span>🌐 ${links.length} 个站外链接</span><span>📅 ${formatDate(mod.mtimeMs)}</span></div>` +
      `</div>` +
      btns;
    history.appendChild(div);
  }
}

function renderWallCards(targetId, items, emptyText) {
  const wall = el(targetId);
  if (!wall) return;
  wall.innerHTML = "";
  if (!Array.isArray(items) || items.length === 0) {
    wall.innerHTML = `<div class="panel panel--empty">${escapeHtml(emptyText)}</div>`;
    return;
  }

  for (const item of items) {
    const card = document.createElement("div");
    card.className = "dev";
    card.innerHTML =
      `<img class="dev__avatar" src="${escapeHtml(item.avatar || "/assets/logo.png")}" alt="${escapeHtml(item.name || "成员")}" loading="lazy" onerror="this.onerror=null;this.src='/assets/logo.png';" />` +
      `<div class="dev__name">${escapeHtml(item.name || "未命名成员")}</div>` +
      `<div class="dev__role">${escapeHtml(item.role || "站点成员")}</div>` +
      `<div class="dev__intro">${escapeHtml(item.intro || "欢迎访问个人主页")}</div>` +
      `<div class="dev__qq">${item.qq ? `QQ：${escapeHtml(item.qq)}` : "暂未填写 QQ"}</div>` +
      `<div class="dev__actions"><a class="btn btn--ghost" href="${escapeHtml(item.profileUrl || "/")}">个人主页</a></div>`;
    wall.appendChild(card);
  }
}

async function loadWalls() {
  try {
    const data = await fetchJson("/api/walls");
    renderWallCards("developers-wall", data.developers, "当前暂无开发者展示");
    renderWallCards("sponsors-wall", data.sponsors, "当前暂无赞助者展示");
  } catch {
    renderWallCards("developers-wall", [], "开发者墙加载失败");
    renderWallCards("sponsors-wall", [], "赞助者墙加载失败");
  }
}

function renderChangelog(items) {
  const list = el("changelog-list");
  if (!list) return;
  list.innerHTML = "";
  if (!Array.isArray(items) || items.length === 0) {
    list.innerHTML =
      `<div class="history__item">` +
      `<div class="history__left"><div class="history__name">暂无更新日志</div><div class="hint">后台添加日志后会自动同步到这里。</div></div>` +
      `</div>`;
    return;
  }

  for (const item of items) {
    const row = document.createElement("div");
    row.className = "history__item history__item--stack";
    const titleHtml = linkifySafe(item.title || "未命名更新");
    const summaryHtml = linkifySafe(item.summary || "");
    row.innerHTML =
      `<div class="history__left">` +
      `<div class="history__meta"><span>📅 ${escapeHtml(item.date || "—")}</span>${item.version ? `<span>🏷 ${escapeHtml(item.version)}</span>` : ""}</div>` +
      `<div class="history__name" style="margin-top:8px;">${titleHtml}</div>` +
      `<div class="hint" style="margin-top:6px;">${summaryHtml}</div>` +
      `</div>`;
    list.appendChild(row);
  }
}

async function loadChangelog() {
  try {
    const data = await fetchJson("/api/changelog");
    renderChangelog(Array.isArray(data.items) ? data.items : []);
  } catch {
    renderChangelog([]);
  }
}

async function loadBranchesAndMods() {
  const select = el("branch");
  const latestVersion = el("latest-version");
  const latestSize = el("latest-size");
  const latestDate = el("latest-date");

  let branches = ["main"];
  try {
    const data = await fetchJson("/api/branches");
    if (Array.isArray(data.branches) && data.branches.length > 0) {
      branches = data.branches;
    }
  } catch {
    branches = ["main"];
  }

  select.innerHTML = "";
  for (const b of branches) {
    const opt = document.createElement("option");
    opt.value = b;
    opt.textContent = formatBranchLabel(b);
    select.appendChild(opt);
  }

  async function load(branch) {
    let mods = [];
    try {
      const data = await fetchJson(`/api/mods?branch=${encodeURIComponent(branch)}`);
      mods = Array.isArray(data.mods) ? data.mods : [];
    } catch {
      mods = [];
    }

    const latest = mods[0] ?? null;
    renderLatest(latest);
    renderHistory(mods.slice(1));

    if (latest) {
      latestVersion.textContent = latest.versionGuess;
      latestSize.textContent = `${normalizeExternalLinks(latest).length} 个外链`;
      latestDate.textContent = formatDate(latest.mtimeMs);
    } else {
      latestVersion.textContent = "—";
      latestSize.textContent = "—";
      latestDate.textContent = "—";
    }
  }

  select.addEventListener("change", () => {
    load(select.value);
  });

  await load(select.value || branches[0] || "main");
}

async function loadCarousel(modalApi) {
  const viewport = el("carousel-viewport");
  const carousel = el("carousel");
  if (!viewport || !carousel) return;

  let categories = [];
  try {
    const data = await fetchJson("/api/gallery/categories");
    categories = Array.isArray(data.categories) ? data.categories : [];
  } catch {
    categories = [];
  }

  const preferred =
    categories.find((c) => c.includes("玩家截图")) ??
    categories.find((c) => c.toLowerCase() === "screenshot") ??
    categories.find((c) => c.includes("截图")) ??
    categories[0] ??
    "";

  let images = [];
  try {
    const data = await fetchJson(`/api/gallery?category=${encodeURIComponent(preferred)}`);
    images = Array.isArray(data.images) ? data.images : [];
  } catch {
    images = [];
  }

  const list = images.slice(0, 8).map((it) => ({
    ...it,
    title: it.fileName,
  }));

  if (list.length === 0) {
    viewport.innerHTML = `<div class="muted">暂无截图（把图片放入 public/uploads/gallery/&lt;分类&gt;）</div>`;
    return;
  }

  let idx = 0;
  const img = document.createElement("img");
  img.className = "carousel__img";
  viewport.innerHTML = "";
  viewport.appendChild(img);

  function render() {
    const item = list[idx];
    img.src = item.url;
    img.alt = item.title || "";
  }

  function shift(dir) {
    idx = (idx + dir + list.length) % list.length;
    render();
  }

  carousel.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const dir = t.getAttribute("data-dir");
    if (dir === "-1") shift(-1);
    if (dir === "1") shift(1);
  });

  img.addEventListener("click", () => {
    modalApi.open(list, idx);
  });

  render();
}

async function loadScreenshotGrid(modalApi) {
  const grid = el("shotgrid");
  if (!grid) return;

  let categories = [];
  try {
    const data = await fetchJson("/api/gallery/categories");
    categories = Array.isArray(data.categories) ? data.categories : [];
  } catch {
    categories = [];
  }

  const preferred =
    categories.find((c) => c.includes("玩家截图")) ??
    categories.find((c) => c.toLowerCase() === "screenshot") ??
    categories.find((c) => c.includes("截图")) ??
    categories[0] ??
    "";

  let images = [];
  try {
    const data = await fetchJson(`/api/gallery?category=${encodeURIComponent(preferred)}`);
    images = Array.isArray(data.images) ? data.images : [];
  } catch {
    images = [];
  }

  const all = images.map((it) => ({
    ...it,
    title: it.fileName,
  }));

  const list = all.slice(0, 12);
  if (list.length === 0) {
    grid.innerHTML = "";
    return;
  }

  grid.innerHTML = "";
  list.forEach((item, idx) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "shotgrid__item";
    tile.innerHTML = `<img loading="lazy" src="${item.url}" alt="${item.title || ""}" />`;
    tile.addEventListener("click", () => modalApi.open(all, idx));
    grid.appendChild(tile);
  });
}

function setupHeroTagPanel() {
  const tab = el("hero-tab");
  if (!(tab instanceof HTMLElement)) return;
  const media = tab.closest(".hero__inner--media");

  function sync() {
    const tabHidden = window.scrollY > 140;
    tab.classList.toggle("is-hidden-by-scroll", tabHidden);
    // 浮层隐藏后,底部按钮栏回到居中;浮层覆盖时按钮保持左移(见 CSS)。
    if (media instanceof HTMLElement) {
      media.classList.toggle("is-tab-clear", tabHidden);
    }
  }

  sync();
  window.addEventListener("scroll", sync, { passive: true });
}

function setupHistoryToggle() {
  const btn = el("toggle-history");
  const history = el("history");
  if (!btn || !history) return;
  btn.addEventListener("click", () => {
    history.classList.toggle("is-open");
  });
}

function setupSmoothScroll() {
  document.addEventListener("click", (e) => {
    const a = e.target instanceof HTMLElement ? e.target.closest("a") : null;
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href || !href.startsWith("#")) return;
    const target = document.querySelector(href);
    if (!(target instanceof HTMLElement)) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

await waitForPageTransition;

el("year").textContent = String(new Date().getFullYear());
setupSmoothScroll();
setupHistoryToggle();
const modalApi = setupModal();
setupHeroTagPanel();
await loadAnnouncements();
await loadFeatures();
await loadBranchesAndMods();
await loadCarousel(modalApi);
await loadScreenshotGrid(modalApi);
await loadWalls();
await loadChangelog();
