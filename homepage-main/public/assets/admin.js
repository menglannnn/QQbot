const waitForPageTransition =
  window.__SITE_PAGE_TRANSITION_DONE instanceof Promise
    ? window.__SITE_PAGE_TRANSITION_DONE
    : Promise.resolve();
function el(id) {
  return document.getElementById(id);
}

const state = {
  me: null,
  modsManager: null,
  usersManager: null,
  changelogManager: null,
  workshopManager: null,
  wallManager: null,
};

const BRANCH_LABELS = {
  main: "forge",
  neoforge: "neoforge",
  sponsor: "内测版(赞助)",
};

function showToast(targetId, message, ok) {
  if (message && window.siteToast) window.siteToast(message, ok ? "success" : "error");
  const toast = el(targetId);
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle("is-show", Boolean(message));
  toast.style.borderColor = ok ? "rgba(34,197,94,0.35)" : "rgba(245,158,11,0.35)";
}

function formatBranchLabel(branch) {
  return BRANCH_LABELS[branch] || branch;
}

async function fetchJson(url, init) {
  const res = await fetch(url, { cache: "no-store", ...(init || {}) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败：${res.status}`);
  return data;
}

async function postJson(url, payload) {
  return fetchJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function deleteJson(url) {
  return fetchJson(url, {
    method: "DELETE",
  });
}

async function patchJson(url, payload) {
  return fetchJson(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

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

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatFeedbackType(type) {
  if (type === "bug") return "Bug 反馈";
  if (type === "suggestion") return "建议";
  return "普通反馈";
}

function readFeedbackAttachments(item) {
  const images = Array.isArray(item?.images) ? item.images : [];
  const files = Array.isArray(item?.files) ? item.files : [];
  return { images, files };
}

function createAttachmentCell(item) {
  const td = document.createElement("td");
  const { images, files } = readFeedbackAttachments(item);
  if (images.length === 0 && files.length === 0) {
    td.textContent = "—";
    return td;
  }

  const wrap = document.createElement("div");
  wrap.style.display = "grid";
  wrap.style.gap = "8px";

  const groups = [
    { label: "图片", items: images },
    { label: "文件", items: files },
  ];

  for (const group of groups) {
    if (group.items.length === 0) continue;
    const row = document.createElement("div");
    const title = document.createElement("div");
    title.className = "hint";
    title.textContent = `${group.label} ${group.items.length} 个`;
    row.appendChild(title);

    const links = document.createElement("div");
    links.className = "button-row";
    links.style.marginTop = "6px";
    group.items.forEach((attachment, index) => {
      const link = document.createElement("a");
      link.className = "btn btn--ghost";
      link.href = attachment?.url || "#";
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = attachment?.name || `${group.label}${index + 1}`;
      links.appendChild(link);
    });
    row.appendChild(links);
    wrap.appendChild(row);
  }

  td.appendChild(wrap);
  return td;
}

function render(items) {
  const table = el("table");
  const tbody = table.querySelector("tbody");
  tbody.innerHTML = "";

  for (const it of items) {
    const tr = document.createElement("tr");

    const tdType = document.createElement("td");
    tdType.textContent = formatFeedbackType(it.type);

    const tdTitle = document.createElement("td");
    tdTitle.textContent = it.title || "—";

    const tdContent = document.createElement("td");
    tdContent.textContent = it.content || "—";

    const tdAttach = createAttachmentCell(it);

    const tdVer = document.createElement("td");
    const parts = [];
    if (it.gameVersion) parts.push(`MC ${it.gameVersion}`);
    if (it.modVersion) parts.push(`MOD ${it.modVersion}`);
    tdVer.textContent = parts.join(" / ") || "—";

    const tdContact = document.createElement("td");
    tdContact.textContent = it.contact || "—";

    const tdTime = document.createElement("td");
    tdTime.textContent = formatTime(it.createdAt);

    const tdStatus = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `badge ${it.resolved ? "badge--ok" : "badge--warn"}`;
    badge.textContent = it.resolved ? "已处理" : "待处理";
    tdStatus.appendChild(badge);

    const tdOps = document.createElement("td");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn--ghost";
    btn.textContent = it.resolved ? "标记未处理" : "标记已处理";
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await patchJson(`/api/admin/feedback/${encodeURIComponent(it.id)}`, {
          resolved: !it.resolved,
        });
        await reload();
      } catch (err) {
        showToast("toast", `${err instanceof Error ? err.message : String(err)}`, false);
      } finally {
        btn.disabled = false;
      }
    });
    tdOps.appendChild(btn);

    tr.appendChild(tdType);
    tr.appendChild(tdTitle);
    tr.appendChild(tdContent);
    tr.appendChild(tdAttach);
    tr.appendChild(tdVer);
    tr.appendChild(tdContact);
    tr.appendChild(tdTime);
    tr.appendChild(tdStatus);
    tr.appendChild(tdOps);
    tbody.appendChild(tr);
  }
}

async function getMe() {
  if (window.__SITE_AUTH_PROMISE) {
    return await window.__SITE_AUTH_PROMISE;
  }
  try {
    const data = await fetchJson("/api/auth/me");
    return data.user || null;
  } catch {
    return null;
  }
}

function notifyAuthChanged(user) {
  window.dispatchEvent(
    new CustomEvent("site:auth-changed", {
      detail: { user: user || null },
    }),
  );
}

function getProfileUrl(user = state.me) {
  return user?.profileUrl || "/";
}

function redirectToProfile(user = state.me) {
  window.location.replace(getProfileUrl(user));
}

function getPermissionLevel(user = state.me) {
  const level = Number(user?.level || 0);
  return Number.isFinite(level) ? level : 0;
}

// 新模型:capability 判定
function hasCap(cap, user = state.me) {
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  return perms.includes("*") || perms.includes(cap);
}

function canAccessPreview(user = state.me) {
  return getPermissionLevel(user) >= 1; // 赞助者及以上
}

// 能否进入后台:拥有任一管理权限(service 客服起步)
function canManageSite(user = state.me) {
  return hasCap("users.manage", user) || hasCap("roles.configure", user) ||
    hasCap("workshop.review", user) || hasCap("feedback.manage", user) ||
    hasCap("changelog.manage", user) || hasCap("mods.manage", user) ||
    hasCap("developers.manage", user) || hasCap("audit.view", user);
}

function wallTypeLabel(wallType) {
  if (wallType === "developer") return "开发者墙";
  if (wallType === "sponsor") return "赞助者墙";
  return "不展示";
}

// 后台分区(侧边栏导航,按 capability 显示)
const ADMIN_SECTIONS = [
  { id: "feedback-section", label: "反馈处理", can: (u) => hasCap("feedback.manage", u) },
  { id: "workshop-section", label: "工坊审核", can: (u) => hasCap("workshop.review", u) },
  { id: "accounts-section", label: "用户管理", can: (u) => hasCap("users.manage", u) },
  { id: "roles-section", label: "身份组权限", can: (u) => hasCap("roles.configure", u) },
  { id: "changelog-section", label: "更新日志", can: (u) => hasCap("changelog.manage", u) },
  { id: "site-section", label: "首页配置", can: (u) => hasCap("changelog.manage", u) || hasCap("users.manage", u) },
  { id: "mods-section", label: "外部MOD", can: (u) => hasCap("mods.manage", u) },
  { id: "preview-access", label: "内测尝鲜", can: (u) => canAccessPreview(u) },
];

function availableSections(user = state.me) {
  return ADMIN_SECTIONS.filter((s) => s.can(user));
}

function setSection(id) {
  state.adminSection = id;
  for (const s of ADMIN_SECTIONS) {
    const node = el(s.id);
    if (node) node.hidden = s.id !== id;
  }
  document.querySelectorAll("#admin-sidebar [data-section]").forEach((b) => {
    b.classList.toggle("btn--primary", b.getAttribute("data-section") === id);
  });
}

// 渲染侧边栏 + 显示当前分区(保留已选,否则第一个)
function syncPermissionView(user = state.me) {
  const sidebar = el("admin-sidebar");
  const avail = availableSections(user);
  if (sidebar) {
    sidebar.innerHTML = avail
      .map((s) => `<button class="btn" type="button" data-section="${s.id}" style="justify-content:flex-start;width:100%;">${s.label}</button>`)
      .join("");
    sidebar.querySelectorAll("[data-section]").forEach((b) => {
      b.addEventListener("click", () => setSection(b.getAttribute("data-section")));
    });
  }
  const ids = avail.map((s) => s.id);
  const current = state.adminSection && ids.includes(state.adminSection) ? state.adminSection : ids[0];
  for (const s of ADMIN_SECTIONS) { const n = el(s.id); if (n) n.hidden = true; }
  if (current) setSection(current);
}

function setView(state) {
  el("login-panel").hidden = state !== "login";
  el("pw-panel").hidden = state !== "changePw";
  el("admin-panel").hidden = state !== "admin";
}

function setupPasswordToggles() {
  document.querySelectorAll('[data-toggle-password="1"]').forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    const wrapper = button.closest(".password-field");
    const input = wrapper?.querySelector("input");
    if (!(input instanceof HTMLInputElement)) return;

    button.addEventListener("click", () => {
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      button.textContent = isHidden ? "🙈" : "👁";
      button.setAttribute("aria-label", isHidden ? "隐藏密码" : "显示密码");
    });
  });
}

const ROLE_OPTIONS = [
  { key: "guest", level: 0, label: "游客 L0" },
  { key: "sponsor", level: 1, label: "赞助者 L1" },
  { key: "service", level: 2, label: "客服 L2" },
  { key: "admin", level: 3, label: "管理员 L3" },
];

function renderUserItems(items, onDelete, onRoleChange) {
  const table = el("users-table");
  if (!(table instanceof HTMLTableElement)) return;
  const tbody = table.querySelector("tbody");
  if (!(tbody instanceof HTMLTableSectionElement)) return;
  tbody.innerHTML = "";

  for (const item of items) {
    const tr = document.createElement("tr");
    const displayName = item.displayName || item.username || "—";
    const roleText = `${item.roleName || "游客"} / L${item.level ?? 0}`;
    const wallText = wallTypeLabel(item.wallType);
    const intro = item.intro || "—";
    const firstLoginText = item.mustChangePassword ? "待首次改密" : "已激活";
    const lastLoginText = formatTime(item.lastLoginAt);
    const canDelete = !item.developerSlug && item.username !== state.me?.username;
    const actorLevel = Number(state.me?.level || 0);
    const canManageTarget = hasCap("users.manage") && Number(item.level || 0) < actorLevel && item.username !== state.me?.username;
    const roleSelect = canManageTarget
      ? `<select class="select" data-role-user="${escapeHtml(item.username || "")}" style="margin-bottom:6px;min-width:110px;">${
          ROLE_OPTIONS.filter((o) => o.level < actorLevel)
            .map((o) => `<option value="${o.key}"${o.key === item.roleKey ? " selected" : ""}>${o.label}</option>`).join("")
        }</select>`
      : "";

    const cells = [
      `<img src="${escapeHtml(item.avatar || "/assets/logo.png")}" alt="${escapeHtml(displayName)}头像" style="width:32px;height:32px;border-radius:8px;object-fit:cover;border:1px solid rgba(255,255,255,0.12);" onerror="this.onerror=null;this.src='/assets/logo.png';" />`,
      `${escapeHtml(displayName)}${item.developerSlug ? `<div class="hint">开发者：${escapeHtml(item.developerSlug)}</div>` : ""}`,
      escapeHtml(item.username || "—"),
      `${escapeHtml(roleText)}${item.qq ? `<div class="hint">QQ：${escapeHtml(item.qq)}</div>` : ""}`,
      escapeHtml(wallText),
      escapeHtml(intro),
      escapeHtml(firstLoginText),
      escapeHtml(lastLoginText),
      `${roleSelect}${
        canDelete
          ? `<button class="btn btn--ghost" type="button" data-delete-user="${escapeHtml(item.username || "")}">删除</button>`
          : roleSelect ? "" : `<span class="hint">不可删除</span>`
      }`,
    ];

    cells.forEach((html) => {
      const td = document.createElement("td");
      td.innerHTML = html;
      tr.appendChild(td);
    });
    const deleteButton = tr.querySelector("[data-delete-user]");
    if (deleteButton instanceof HTMLButtonElement && typeof onDelete === "function") {
      deleteButton.addEventListener("click", () => onDelete(item));
    }
    const roleSel = tr.querySelector("[data-role-user]");
    if (roleSel instanceof HTMLSelectElement && typeof onRoleChange === "function") {
      roleSel.addEventListener("change", () => onRoleChange(item, roleSel.value));
    }
    tbody.appendChild(tr);
  }
}

function setupUsersManager() {
  const toggleButton = el("toggle-user-form");
  const formWrap = el("user-form-wrap");
  const form = el("user-form");
  const usernameInput = el("user-username");
  const displayNameInput = el("user-display-name");
  const introInput = el("user-intro");
  const qqInput = el("user-qq");
  const roleInput = el("user-role");
  const wallTypeInput = el("user-wall-type");
  const avatarInput = el("user-avatar");
  if (
    !(toggleButton instanceof HTMLButtonElement) ||
    !(formWrap instanceof HTMLElement) ||
    !(form instanceof HTMLFormElement) ||
    !(usernameInput instanceof HTMLInputElement) ||
    !(displayNameInput instanceof HTMLInputElement) ||
    !(introInput instanceof HTMLInputElement) ||
    !(roleInput instanceof HTMLSelectElement) ||
    !(wallTypeInput instanceof HTMLSelectElement) ||
    !(avatarInput instanceof HTMLInputElement)
  ) {
    return null;
  }

  // 只能创建等级低于自身的身份组
  const actorLevel = Number(state.me?.level || 0);
  [...roleInput.options].forEach((opt) => {
    const lvl = Number(opt.dataset.level || 0);
    opt.disabled = lvl >= actorLevel;
    opt.hidden = lvl >= actorLevel;
  });
  const firstEnabled = [...roleInput.options].find((o) => !o.disabled);
  if (firstEnabled) roleInput.value = firstEnabled.value;

  function syncRoleWallType() {
    if (roleInput.value === "sponsor" && wallTypeInput.value === "none") {
      wallTypeInput.value = "sponsor";
      return;
    }
    if ((roleInput.value === "admin" || roleInput.value === "service") && wallTypeInput.value === "sponsor") {
      wallTypeInput.value = "developer";
    }
  }

  function toggleForm(forceOpen) {
    const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : !formWrap.classList.contains("is-open");
    formWrap.classList.toggle("is-open", shouldOpen);
    const chev = toggleButton.querySelector(".collapse__chev");
    if (chev) chev.textContent = shouldOpen ? "▴" : "▾";
  }

  async function uploadAvatar(username, file) {
    const buf = await file.arrayBuffer();
    return fetchJson(`/api/admin/users/${encodeURIComponent(username)}/avatar`, {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "x-file-name": encodeURIComponent(file.name),
      },
      body: buf,
    });
  }

  let allUsers = [];
  const onDelete = async (item) => {
    const ok = window.confirm(`确认删除账户 ${item.displayName || item.username} 吗？删除后会同步从墙面移除。`);
    if (!ok) return;
    showToast("user-toast", "删除中…", true);
    try {
      await deleteJson(`/api/admin/users/${encodeURIComponent(item.username || "")}`);
      await refresh();
      if (state.changelogManager) void state.changelogManager.refresh();
      showToast("user-toast", "账户已删除，首页墙面会同步更新。", true);
    } catch (err) {
      showToast("user-toast", `删除失败：${err instanceof Error ? err.message : String(err)}`, false);
    }
  };
  const onRoleChange = async (item, roleKey) => {
    showToast("user-toast", "身份更新中…", true);
    try {
      await patchJson(`/api/admin/users/${encodeURIComponent(item.username || "")}/role`, { roleKey });
      await refresh();
      showToast("user-toast", `已将 ${item.displayName || item.username} 设为新身份。`, true);
    } catch (err) {
      showToast("user-toast", `身份变更失败：${err instanceof Error ? err.message : String(err)}`, false);
      await refresh();
    }
  };
  function renderFiltered() {
    const q = (el("user-search")?.value || "").trim().toLowerCase();
    const filtered = q
      ? allUsers.filter(
          (u) =>
            (u.username || "").toLowerCase().includes(q) ||
            (u.displayName || "").toLowerCase().includes(q) ||
            (u.qq || "").toLowerCase().includes(q),
        )
      : allUsers;
    renderUserItems(filtered, onDelete, onRoleChange);
  }
  const userSearch = el("user-search");
  if (userSearch instanceof HTMLInputElement) {
    userSearch.addEventListener("input", () => renderFiltered());
  }

  async function refresh() {
    if (!hasCap("users.manage")) return;
    const data = await fetchJson("/api/admin/users");
    allUsers = Array.isArray(data.items) ? data.items : [];
    renderFiltered();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const avatarFile = avatarInput.files && avatarInput.files[0] ? avatarInput.files[0] : null;
    if (avatarFile && avatarFile.size > 10 * 1024 * 1024) {
      showToast("user-toast", "头像大小不能超过 10MB。", false);
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton instanceof HTMLButtonElement) submitButton.disabled = true;
    try {
      const created = await postJson("/api/admin/users", {
        username: usernameInput.value.trim(),
        displayName: displayNameInput.value.trim(),
        intro: introInput.value.trim(),
        qq: qqInput instanceof HTMLInputElement ? qqInput.value.trim() : "",
        roleKey: roleInput.value,
        wallType: wallTypeInput.value,
      });
      if (avatarFile) {
        await uploadAvatar(created.user?.username || usernameInput.value.trim(), avatarFile);
      }
      form.reset();
      if (firstEnabled) roleInput.value = firstEnabled.value;
      wallTypeInput.value = "none";
      avatarInput.value = "";
      if (qqInput instanceof HTMLInputElement) qqInput.value = "";
      toggleForm(false);
      await refresh();
      showToast("user-toast", "账户已创建，初始密码与账户名相同，首次登录需修改。", true);
    } catch (err) {
      showToast(
        "user-toast",
        `添加失败：${err instanceof Error ? err.message : String(err)}`,
        false,
      );
    } finally {
      if (submitButton instanceof HTMLButtonElement) submitButton.disabled = false;
    }
  });

  roleInput.value = "guest";
  wallTypeInput.value = "none";
  toggleButton.addEventListener("click", () => toggleForm());
  roleInput.addEventListener("change", syncRoleWallType);
  syncRoleWallType();
  return { refresh };
}

async function reload() {
  try {
    showToast("toast", "", true);
    const data = await fetchJson("/api/admin/feedback");
    const items = Array.isArray(data.items) ? data.items : [];
    render(items);
    showToast("toast", `已加载 ${items.length} 条反馈`, true);
  } catch (err) {
    showToast("toast", `加载失败：${err instanceof Error ? err.message : String(err)}`, false);
  }
}

function setupModsManager() {
  const branchSel = el("mods-branch");
  const btnRefresh = el("mods-refresh");
  const status = el("mods-status");
  const listEl = el("mods-list");
  const selectedEl = el("mods-selected");
  const keyInput = el("mods-key");
  const titleInput = el("mods-title");
  const linksEl = el("mods-links");
  const btnAddLink = el("mods-add-link");
  const descInput = el("mods-description");
  const btnSave = el("mods-save");
  const btnClear = el("mods-clear");

  if (
    !branchSel ||
    !btnRefresh ||
    !status ||
    !listEl ||
    !selectedEl ||
    !keyInput ||
    !titleInput ||
    !linksEl ||
    !btnAddLink ||
    !descInput ||
    !btnSave ||
    !btnClear
  ) {
    return null;
  }

  const state = {
    branch: "main",
    selectedFileName: "",
    externalMap: new Map(),
    mods: [],
  };

  function setStatus(text, ok) {
    status.textContent = text || "";
    status.style.color = ok ? "rgba(34,197,94,0.9)" : "rgba(245,158,11,0.9)";
  }

  function normalizeLinks(meta) {
    if (Array.isArray(meta?.links)) {
      return meta.links
        .map((item, index) => {
          const url = typeof item?.url === "string" ? item.url.trim() : "";
          if (!url) return null;
          const label = typeof item?.label === "string" && item.label.trim()
            ? item.label.trim()
            : `站外下载 ${index + 1}`;
          return { label, url };
        })
        .filter(Boolean);
    }
    const fallback = typeof meta?.externalUrl === "string" ? meta.externalUrl.trim() : "";
    return fallback ? [{ label: "站外下载 1", url: fallback }] : [];
  }

  function normalizeTitle(meta) {
    const title = typeof meta?.title === "string" ? meta.title.trim() : "";
    return title || String(meta?.versionGuess || meta?.fileName || "");
  }

  function createLinkRow(link = {}) {
    const row = document.createElement("div");
    row.className = "link-editor__row";
    row.innerHTML =
      `<input class="input" data-link-label="1" maxlength="40" placeholder="按钮名称，例如 蓝奏云 / 夸克 / 主线路" />` +
      `<input class="input" data-link-url="1" placeholder="https://..." />` +
      `<button class="btn btn--ghost" type="button" data-link-remove="1">删除</button>`;
    const labelInput = row.querySelector('[data-link-label="1"]');
    const urlInput = row.querySelector('[data-link-url="1"]');
    if (labelInput instanceof HTMLInputElement) labelInput.value = link.label || "";
    if (urlInput instanceof HTMLInputElement) urlInput.value = link.url || "";
    row.querySelector('[data-link-remove="1"]').addEventListener("click", () => {
      row.remove();
      if (linksEl.children.length === 0) {
        createEmptyLinkRow();
      }
    });
    linksEl.appendChild(row);
  }

  function createEmptyLinkRow() {
    createLinkRow({ label: "", url: "" });
  }

  function renderLinkRows(links) {
    linksEl.innerHTML = "";
    if (!Array.isArray(links) || links.length === 0) {
      createEmptyLinkRow();
      return;
    }
    links.forEach((link) => createLinkRow(link));
  }

  function collectLinks() {
    return Array.from(linksEl.querySelectorAll(".link-editor__row"))
      .map((row) => {
        const labelInput = row.querySelector('[data-link-label="1"]');
        const urlInput = row.querySelector('[data-link-url="1"]');
        const label =
          labelInput instanceof HTMLInputElement ? labelInput.value.trim() : "";
        const url = urlInput instanceof HTMLInputElement ? urlInput.value.trim() : "";
        if (!label && !url) return null;
        return { label, url };
      })
      .filter(Boolean);
  }

  function renderLinksPreview(links) {
    if (!Array.isArray(links) || links.length === 0) return "";
    return (
      `<div class="button-row">` +
      links
        .map(
          (link) =>
            `<a class="btn btn--ghost" href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`,
        )
        .join("") +
      `</div>`
    );
  }

  function resetEditor() {
    state.selectedFileName = "";
    selectedEl.textContent = "当前为新建模式";
    keyInput.value = "";
    titleInput.value = "";
    descInput.value = "";
    renderLinkRows([]);
  }

  function selectMod(fileName) {
    state.selectedFileName = fileName;
    if (!fileName) {
      resetEditor();
      return;
    }
    const meta = state.externalMap.get(fileName) || null;
    selectedEl.textContent = fileName ? `当前选择：${normalizeTitle(meta) || fileName}` : "当前为新建模式";
    keyInput.value = fileName;
    titleInput.value = normalizeTitle(meta);
    descInput.value = meta?.description || "";
    renderLinkRows(normalizeLinks(meta));
  }

  function renderMods() {
    listEl.innerHTML = "";
    if (!Array.isArray(state.mods) || state.mods.length === 0) {
      listEl.innerHTML = `<div class="muted">当前分支暂无站外下载条目</div>`;
      return;
    }

    for (const mod of state.mods) {
      const fileName = String(mod.fileName || "");
      const version = escapeHtml(normalizeTitle(mod) || fileName || "—");
      const keyText = escapeHtml(fileName || "—");
      const date = formatDate(mod.mtimeMs);
      const description = escapeHtml(mod.description || "");
      const links = normalizeLinks(mod);

      const row = document.createElement("div");
      row.className = "history__item";
      row.innerHTML =
        `<div class="history__left">` +
        `<div class="history__name">${version}</div>` +
        `<div class="history__meta"><span>🔑 ${keyText}</span><span>🌐 ${links.length} 个外链</span><span>📅 ${date}</span></div>` +
        (description ? `<div class="hint" style="margin-top:6px;">${description}</div>` : "") +
        `</div>` +
        `<div class="button-row">` +
        `<button class="btn btn--ghost" type="button" data-pick="1">编辑</button>` +
        `<button class="btn btn--ghost" type="button" data-delete="1">删除</button>` +
        renderLinksPreview(links) +
        `</div>`;

      row.querySelector('button[data-pick="1"]').addEventListener("click", () => {
        selectMod(fileName);
        setStatus(`已选中：${fileName}`, true);
      });

      row.querySelector('button[data-delete="1"]').addEventListener("click", async () => {
        const ok = window.confirm(`确认删除 ${normalizeTitle(mod) || fileName} 吗？这会移除该条目的全部站外下载链接。`);
        if (!ok) return;
        setStatus(`删除中：${fileName}`, true);
        try {
          await deleteJson(
            `/api/admin/mods/external?branch=${encodeURIComponent(state.branch)}&fileName=${encodeURIComponent(fileName)}`,
          );
          if (state.selectedFileName === fileName) {
            resetEditor();
          }
          await refreshAll();
          setStatus(`已删除：${fileName}`, true);
        } catch (err) {
          setStatus(err instanceof Error ? err.message : String(err), false);
        }
      });

      listEl.appendChild(row);
    }
  }

  async function loadBranches(preferredBranch = state.branch) {
    const data = await fetchJson("/api/branches");
    const branches = Array.isArray(data.branches) ? data.branches : ["main"];
    const nextBranch =
      branches.includes(preferredBranch) ? preferredBranch : branches[0] || "main";
    branchSel.innerHTML = "";
    for (const b of branches) {
      const opt = document.createElement("option");
      opt.value = b;
      opt.textContent = formatBranchLabel(b);
      branchSel.appendChild(opt);
    }
    branchSel.value = nextBranch;
    state.branch = nextBranch;
  }

  async function loadExternalMap() {
    const data = await fetchJson(`/api/admin/mods/external?branch=${encodeURIComponent(state.branch)}`);
    const items = Array.isArray(data.items) ? data.items : [];
    state.externalMap = new Map(items.map((x) => [x.fileName, x]));
  }

  async function loadMods() {
    const data = await fetchJson(`/api/mods?branch=${encodeURIComponent(state.branch)}`);
    state.mods = Array.isArray(data.mods) ? data.mods : [];
  }

  async function refreshAll(preferredBranch = state.branch) {
    setStatus("加载中…", true);
    try {
      await loadBranches(preferredBranch);
      await Promise.all([loadExternalMap(), loadMods()]);
      if (state.selectedFileName && !state.mods.some((m) => m.fileName === state.selectedFileName)) {
        resetEditor();
      }
      renderMods();
      setStatus(`已加载 ${state.mods.length} 个条目`, true);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err), false);
    }
  }

  branchSel.addEventListener("change", async () => {
    state.branch = branchSel.value || "main";
    selectMod("");
    await refreshAll(state.branch);
  });

  btnRefresh.addEventListener("click", refreshAll);
  btnAddLink.addEventListener("click", () => {
    createLinkRow({ label: "", url: "" });
  });

  btnSave.addEventListener("click", async () => {
    const key = keyInput.value.trim();
    const title = titleInput.value.trim();
    if (!key) {
      setStatus("请先填写条目标识", false);
      return;
    }
    if (!title) {
      setStatus("请先填写展示名称", false);
      return;
    }
    const links = collectLinks();
    if (links.length === 0) {
      setStatus("请至少添加一个站外下载链接", false);
      return;
    }
    btnSave.disabled = true;
    setStatus("保存中…", true);
    try {
      await postJson("/api/admin/mods/external", {
        branch: state.branch,
        fileName: key,
        title,
        links,
        description: descInput.value.trim(),
      });
      await refreshAll();
      selectMod(key);
      setStatus("保存成功", true);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err), false);
    } finally {
      btnSave.disabled = false;
    }
  });

  btnClear.addEventListener("click", () => {
    resetEditor();
    setStatus("已切换到新建模式", true);
  });

  resetEditor();
  return { refreshAll };
}

function setupWorkshopManager() {
  const filterSel = el("workshop-status-filter");
  const btnRefresh = el("workshop-refresh");
  const statusEl = el("workshop-status");
  const listEl = el("workshop-list");
  if (
    !(filterSel instanceof HTMLSelectElement) ||
    !(btnRefresh instanceof HTMLButtonElement) ||
    !(statusEl instanceof HTMLElement) ||
    !(listEl instanceof HTMLElement)
  ) {
    return null;
  }

  const localState = {
    filter: filterSel.value || "pending",
  };

  function setStatus(text, ok) {
    statusEl.textContent = text || "";
    statusEl.style.color = ok ? "rgba(34,197,94,0.9)" : "rgba(245,158,11,0.9)";
  }

  function renderStatusBadge(status) {
    if (status === "approved") return `<span class="badge badge--ok">已通过</span>`;
    if (status === "rejected") return `<span class="badge badge--danger">已打回</span>`;
    return `<span class="badge badge--warn">待审核</span>`;
  }

  function renderFileButtons(files) {
    const nbtFile = files?.nbt || null;
    if (!nbtFile?.url) return `<div class="hint">暂无 NBT 文件</div>`;
    return [
      `<a class="btn btn--ghost" href="${escapeHtml(nbtFile.url)}" target="_blank" rel="noreferrer">NBT${nbtFile.size ? ` · ${escapeHtml(formatBytes(nbtFile.size))}` : ""}</a>`,
    ].join("");
  }

  function renderNbtViewerButton(item) {
    return item?.nbtViewerUrl
      ? `<a class="btn btn--ghost" href="${escapeHtml(item.nbtViewerUrl)}" target="_blank" rel="noreferrer">NBT Viewer 预览</a>`
      : "";
  }

  function renderExternalLinks(links) {
    if (!Array.isArray(links) || links.length === 0) {
      return `<div class="hint">未填写附加外链</div>`;
    }
    return links
      .map((link, index) => {
        const label = (typeof link?.label === "string" ? link.label.trim() : "") || `外链 ${index + 1}`;
        const url = typeof link?.url === "string" ? link.url.trim() : "";
        if (!url) return "";
        return `<a class="btn btn--ghost" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
      })
      .join("");
  }

  function renderItems(items) {
    listEl.innerHTML = "";
    if (!Array.isArray(items) || items.length === 0) {
      listEl.innerHTML =
        `<div class="history__item"><div class="history__left"><div class="history__name">当前筛选下暂无创意工坊投稿</div></div></div>`;
      return;
    }

    for (const item of items) {
      const row = document.createElement("div");
      row.className = "history__item history__item--stack";
      const reasonHtml = item.reviewReason
        ? `<div class="workshop-review-note">打回原因：${escapeHtml(item.reviewReason)}</div>`
        : "";
      row.innerHTML =
        `<div class="history__left">` +
        `<div class="button-row" style="justify-content:space-between;align-items:flex-start;">` +
        `<div class="history__name">${escapeHtml(item.title || "未命名作品")}</div>` +
        `${renderStatusBadge(item.status)}` +
        `</div>` +
        `<div class="history__meta">` +
        `<span>分类：${escapeHtml(item.categoryLabel || "其他")}</span>` +
        `<span>作者：${escapeHtml(item.author?.displayName || item.author?.username || "未知玩家")}</span>` +
        `<span>提交时间：${escapeHtml(formatTime(item.createdAt))}</span>` +
        `<span>最后更新：${escapeHtml(formatTime(item.updatedAt))}</span>` +
        `</div>` +
        `<div class="hint" style="margin-top:8px;">${escapeHtml(item.description || "暂无描述")}</div>` +
        `${reasonHtml}` +
        `</div>` +
        `<div class="workshop-inline-group"><div class="workshop-card__label">NBT 文件</div><div class="button-row">${renderFileButtons(item.files)}${renderNbtViewerButton(item)}</div></div>` +
        `<div class="workshop-inline-group"><div class="workshop-card__label">附加外链</div><div class="button-row">${renderExternalLinks(item.externalLinks)}</div></div>` +
        `<div class="button-row">`;

      if (item.status === "pending") {
        row.innerHTML +=
          `<button class="btn btn--primary" type="button" data-approve="1">通过</button>` +
          `<button class="btn btn--ghost" type="button" data-reject="1">打回</button>`;
      }

      row.innerHTML += `</div>`;

      const approveButton = row.querySelector('[data-approve="1"]');
      if (approveButton instanceof HTMLButtonElement) {
        approveButton.addEventListener("click", async () => {
          approveButton.disabled = true;
          setStatus(`审核通过中：${item.title || item.id}`, true);
          try {
            await patchJson(`/api/admin/workshop/${encodeURIComponent(item.id)}/review`, {
              action: "approve",
            });
            await refresh();
            setStatus(`已通过：${item.title || item.id}`, true);
          } catch (error) {
            setStatus(error instanceof Error ? error.message : String(error), false);
          } finally {
            approveButton.disabled = false;
          }
        });
      }

      const rejectButton = row.querySelector('[data-reject="1"]');
      if (rejectButton instanceof HTMLButtonElement) {
        rejectButton.addEventListener("click", async () => {
          const reason = window.prompt("请输入打回原因");
          if (reason === null) return;
          if (!reason.trim()) {
            setStatus("打回时必须填写原因", false);
            return;
          }
          rejectButton.disabled = true;
          setStatus(`打回中：${item.title || item.id}`, true);
          try {
            await patchJson(`/api/admin/workshop/${encodeURIComponent(item.id)}/review`, {
              action: "reject",
              reason: reason.trim(),
            });
            await refresh();
            setStatus(`已打回：${item.title || item.id}`, true);
          } catch (error) {
            setStatus(error instanceof Error ? error.message : String(error), false);
          } finally {
            rejectButton.disabled = false;
          }
        });
      }

      listEl.appendChild(row);
    }
  }

  async function refresh() {
    localState.filter = filterSel.value || "pending";
    setStatus("加载中…", true);
    try {
      const data = await fetchJson(`/api/admin/workshop?status=${encodeURIComponent(localState.filter)}`);
      const items = Array.isArray(data.items) ? data.items : [];
      renderItems(items);
      setStatus(`已加载 ${items.length} 条投稿`, true);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), false);
    }
  }

  filterSel.addEventListener("change", refresh);
  btnRefresh.addEventListener("click", refresh);

  return { refresh };
}

function setupChangelogManager() {
  const form = el("changelog-form");
  const dateInput = el("changelog-date");
  const versionInput = el("changelog-version");
  const titleInput = el("changelog-title");
  const summaryInput = el("changelog-summary");
  const list = el("changelog-admin-list");
  if (
    !(form instanceof HTMLFormElement) ||
    !(dateInput instanceof HTMLInputElement) ||
    !(versionInput instanceof HTMLInputElement) ||
    !(titleInput instanceof HTMLInputElement) ||
    !(summaryInput instanceof HTMLTextAreaElement) ||
    !(list instanceof HTMLElement)
  ) {
    return null;
  }

  function todayString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function renderItems(items) {
    list.innerHTML = "";
    if (!Array.isArray(items) || items.length === 0) {
      list.innerHTML =
        `<div class="history__item"><div class="history__left"><div class="history__name">暂无更新日志</div></div></div>`;
      return;
    }

    for (const item of items) {
      const row = document.createElement("div");
      row.className = "history__item history__item--stack";
      row.innerHTML =
        `<div class="history__left">` +
        `<div class="history__meta"><span>📅 ${escapeHtml(item.date || "—")}</span>${item.version ? `<span>🏷 ${escapeHtml(item.version)}</span>` : ""}</div>` +
        `<div class="history__name" style="margin-top:8px;">${escapeHtml(item.title || "未命名日志")}</div>` +
        `<div class="hint" style="margin-top:6px;">${escapeHtml(item.summary || "")}</div>` +
        `</div>` +
        `<div class="button-row"><button class="btn btn--ghost" type="button" data-delete-log="${escapeHtml(item.id || "")}">删除</button></div>`;
      const deleteButton = row.querySelector("[data-delete-log]");
      if (deleteButton instanceof HTMLButtonElement) {
        deleteButton.addEventListener("click", async () => {
          const ok = window.confirm(`确认删除日志“${item.title || "未命名日志"}”吗？`);
          if (!ok) return;
          try {
            await deleteJson(`/api/admin/changelog/${encodeURIComponent(item.id || "")}`);
            await refresh();
            showToast("changelog-toast", "日志已删除，首页会同步更新。", true);
          } catch (err) {
            showToast("changelog-toast", `删除失败：${err instanceof Error ? err.message : String(err)}`, false);
          }
        });
      }
      list.appendChild(row);
    }
  }

  async function refresh() {
    const data = await fetchJson("/api/admin/changelog");
    renderItems(Array.isArray(data.items) ? data.items : []);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton instanceof HTMLButtonElement) submitButton.disabled = true;
    try {
      await postJson("/api/admin/changelog", {
        date: dateInput.value || todayString(),
        version: versionInput.value.trim(),
        title: titleInput.value.trim(),
        summary: summaryInput.value.trim(),
      });
      form.reset();
      dateInput.value = todayString();
      await refresh();
      showToast("changelog-toast", "更新日志已添加，首页导航会同步展示。", true);
    } catch (err) {
      showToast("changelog-toast", `添加失败：${err instanceof Error ? err.message : String(err)}`, false);
    } finally {
      if (submitButton instanceof HTMLButtonElement) submitButton.disabled = false;
    }
  });

  dateInput.value = todayString();
  return { refresh };
}

const CAP_LABELS = {
  "users.manage": "用户管理",
  "roles.configure": "身份组配置",
  "workshop.review": "工坊审核",
  "feedback.manage": "反馈处理",
  "changelog.manage": "更新日志",
  "mods.manage": "外部MOD",
  "developers.manage": "开发者资料",
  "audit.view": "审计日志",
};

function setupRolesManager() {
  const list = el("roles-list");
  if (!(list instanceof HTMLElement)) return null;

  async function refresh() {
    if (!hasCap("roles.configure")) return;
    const data = await fetchJson("/api/admin/roles");
    const caps = Array.isArray(data.caps) ? data.caps : Object.keys(CAP_LABELS);
    const myPerms = Array.isArray(state.me?.permissions) ? state.me.permissions : [];
    const canGrant = (cap) => myPerms.includes("*") || myPerms.includes(cap);
    list.innerHTML = "";
    for (const role of data.items || []) {
      if (role.roleKey === "superadmin") continue;
      const editable = role.manageable;
      const checks = caps.map((cap) => {
        const checked = (role.permissions || []).includes(cap) ? " checked" : "";
        const disabled = !editable || !canGrant(cap) ? " disabled" : "";
        return `<label style="display:inline-flex;gap:4px;align-items:center;margin:2px 12px 2px 0;"><input type="checkbox" data-cap="${escapeHtml(cap)}"${checked}${disabled}/> ${escapeHtml(CAP_LABELS[cap] || cap)}</label>`;
      }).join("");
      const wrap = document.createElement("div");
      wrap.className = "panel";
      wrap.style.cssText = "padding:12px;margin-bottom:10px;";
      wrap.innerHTML =
        `<div style="font-weight:600;margin-bottom:6px;">${escapeHtml(role.name)} <span class="hint">L${role.level}</span></div>` +
        `<div data-role-caps="${escapeHtml(role.roleKey)}">${checks}</div>` +
        (editable
          ? `<div style="margin-top:8px;"><button class="btn btn--primary" type="button" data-save-role="${escapeHtml(role.roleKey)}">保存</button></div>`
          : `<div class="hint" style="margin-top:6px;">无权配置该身份组</div>`);
      list.appendChild(wrap);
    }
    list.querySelectorAll("[data-save-role]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const roleKey = btn.getAttribute("data-save-role");
        const container = list.querySelector(`[data-role-caps="${roleKey}"]`);
        if (!container) return;
        const permissions = [...container.querySelectorAll("input[data-cap]:checked")].map((i) => i.getAttribute("data-cap"));
        showToast("roles-toast", "保存中…", true);
        try {
          await patchJson(`/api/admin/roles/${encodeURIComponent(roleKey)}`, { permissions });
          showToast("roles-toast", "权限已更新。", true);
        } catch (err) {
          showToast("roles-toast", `保存失败：${err instanceof Error ? err.message : String(err)}`, false);
        }
      });
    });
  }
  return { refresh };
}

// 首页配置分区里的墙面管理:调整账户 wallType,首页开发者墙/赞助者墙即时同步。
function setupWallManager() {
  const wrap = el("site-walls");
  const table = el("site-walls-table");
  const search = el("site-wall-search");
  if (!(wrap instanceof HTMLElement) || !(table instanceof HTMLTableElement)) return null;
  if (!hasCap("users.manage")) {
    wrap.hidden = true;
    return null;
  }
  wrap.hidden = false;

  const WALL_OPTIONS = [
    { key: "none", label: "不展示" },
    { key: "developer", label: "开发者墙" },
    { key: "sponsor", label: "赞助者墙" },
  ];
  let allUsers = [];

  function render() {
    const tbody = table.querySelector("tbody");
    if (!(tbody instanceof HTMLTableSectionElement)) return;
    const q = (search instanceof HTMLInputElement ? search.value : "").trim().toLowerCase();
    const items = q
      ? allUsers.filter(
          (u) =>
            (u.username || "").toLowerCase().includes(q) ||
            (u.displayName || "").toLowerCase().includes(q),
        )
      : allUsers;
    tbody.innerHTML = "";
    const actorLevel = Number(state.me?.level || 0);
    for (const item of items) {
      const manageable = Number(item.level || 0) < actorLevel && item.username !== state.me?.username;
      const tr = document.createElement("tr");
      const select = manageable
        ? `<select class="select" data-wall-user="${escapeHtml(item.username || "")}">${WALL_OPTIONS.map(
            (o) => `<option value="${o.key}"${o.key === (item.wallType || "none") ? " selected" : ""}>${o.label}</option>`,
          ).join("")}</select>`
        : `<span class="hint">${escapeHtml(wallTypeLabel(item.wallType))}(无权调整)</span>`;
      const cells = [
        `<img src="${escapeHtml(item.avatar || "/assets/logo.png")}" alt="${escapeHtml(item.displayName || item.username || "")}头像" style="width:28px;height:28px;border-radius:8px;object-fit:cover;border:1px solid rgba(255,255,255,0.12);" onerror="this.onerror=null;this.src='/assets/logo.png';" />`,
        escapeHtml(item.displayName || item.username || "—"),
        escapeHtml(item.username || "—"),
        escapeHtml(`${item.roleName || "游客"} / L${item.level ?? 0}`),
        select,
      ];
      cells.forEach((html) => {
        const td = document.createElement("td");
        td.innerHTML = html;
        tr.appendChild(td);
      });
      const sel = tr.querySelector("[data-wall-user]");
      if (sel instanceof HTMLSelectElement) {
        sel.addEventListener("change", async () => {
          showToast("site-wall-toast", "墙面更新中…", true);
          try {
            await patchJson(`/api/admin/users/${encodeURIComponent(item.username || "")}/role`, {
              roleKey: item.roleKey,
              wallType: sel.value,
            });
            item.wallType = sel.value;
            showToast("site-wall-toast", `已将 ${item.displayName || item.username} 的墙面设为「${wallTypeLabel(sel.value)}」。`, true);
          } catch (err) {
            showToast("site-wall-toast", `墙面更新失败：${err instanceof Error ? err.message : String(err)}`, false);
            await refresh();
          }
        });
      }
      tbody.appendChild(tr);
    }
  }

  if (search instanceof HTMLInputElement) {
    search.addEventListener("input", () => render());
  }

  async function refresh() {
    if (!hasCap("users.manage")) return;
    try {
      const data = await fetchJson("/api/admin/users");
      allUsers = Array.isArray(data.items) ? data.items : [];
      render();
    } catch {}
  }
  return { refresh };
}

function setupSiteConfigManager() {
  const textarea = el("site-announcements");
  const saveBtn = el("site-save");
  const featuresWrap = el("site-features");
  const addBtn = el("site-feature-add");
  if (!(textarea instanceof HTMLTextAreaElement) || !(saveBtn instanceof HTMLButtonElement)) return null;
  // 只有拥有 changelog.manage 才能读写公告/卡片;否则隐藏该面板(墙面管理由 setupWallManager 单独控制)。
  const configPanel = textarea.closest(".panel");
  if (!hasCap("changelog.manage") && configPanel instanceof HTMLElement) {
    configPanel.hidden = true;
  }

  function addFeatureRow(f = {}) {
    if (!(featuresWrap instanceof HTMLElement)) return;
    const row = document.createElement("div");
    row.className = "site-feature-row";
    row.style.cssText = "display:grid;grid-template-columns:64px 1fr 2fr auto;gap:8px;align-items:center;";
    row.innerHTML =
      `<input class="input" data-f="icon" maxlength="8" placeholder="图标" value="${escapeHtml(f.icon || "")}" />` +
      `<input class="input" data-f="title" maxlength="20" placeholder="标题" value="${escapeHtml(f.title || "")}" />` +
      `<input class="input" data-f="desc" maxlength="120" placeholder="描述" value="${escapeHtml(f.desc || "")}" />` +
      `<button class="btn btn--ghost" type="button" data-f-remove="1">移除</button>`;
    const rm = row.querySelector("[data-f-remove]");
    if (rm) rm.addEventListener("click", () => row.remove());
    featuresWrap.appendChild(row);
  }
  function collectFeatures() {
    if (!(featuresWrap instanceof HTMLElement)) return [];
    return [...featuresWrap.querySelectorAll(".site-feature-row")]
      .map((row) => ({
        icon: (row.querySelector('[data-f="icon"]')?.value || "").trim(),
        title: (row.querySelector('[data-f="title"]')?.value || "").trim(),
        desc: (row.querySelector('[data-f="desc"]')?.value || "").trim(),
      }))
      .filter((f) => f.title || f.desc);
  }
  if (addBtn instanceof HTMLButtonElement) addBtn.addEventListener("click", () => addFeatureRow());

  async function refresh() {
    if (!hasCap("changelog.manage")) return;
    try {
      const data = await fetchJson("/api/admin/site-config");
      textarea.value = (data.announcements || []).join("\n");
      if (featuresWrap instanceof HTMLElement) {
        featuresWrap.innerHTML = "";
        (data.features || []).forEach((f) => addFeatureRow(f));
      }
    } catch {}
  }

  saveBtn.addEventListener("click", async () => {
    const announcements = textarea.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const features = collectFeatures();
    showToast("site-toast", "保存中…", true);
    try {
      const res = await fetch("/api/admin/site-config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ announcements, features }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "保存失败");
      showToast("site-toast", "已保存,首页即时生效。", true);
    } catch (err) {
      showToast("site-toast", `保存失败:${err instanceof Error ? err.message : String(err)}`, false);
    }
  });
  return { refresh };
}

async function boot() {
  const me = await getMe();
  state.me = me;
  syncPermissionView(me);
  if (!me) {
    setView("login");
    return;
  }
  if (!canManageSite(me)) {
    notifyAuthChanged(me);
    redirectToProfile(me);
    return;
  }

  el("me").textContent = `当前登录：${me.displayName || me.username} / ${me.roleName || "游客"} / L${getPermissionLevel(me)}`;
  setView("admin");

  // 初始分区:按 URL hash 或第一个可用项
  const hashSec = (location.hash || "").replace("#", "");
  if (hashSec === "feedback") state.adminSection = "feedback-section";
  else if (hashSec === "manage") state.adminSection = "accounts-section";
  else if (hashSec) state.adminSection = hashSec.endsWith("-section") ? hashSec : `${hashSec}-section`;
  syncPermissionView(me);

  if (me.mustChangePassword) {
    setView("changePw");
    showToast("pw-toast", "检测到默认密码未修改，请先修改密码。", false);
  } else {
    await reload();
    if (!state.usersManager) state.usersManager = setupUsersManager();
    if (!state.modsManager) state.modsManager = setupModsManager();
    if (!state.workshopManager) state.workshopManager = setupWorkshopManager();
    if (!state.changelogManager) state.changelogManager = setupChangelogManager();
    if (!state.siteManager) state.siteManager = setupSiteConfigManager();
    if (hasCap("changelog.manage", me) && state.siteManager) {
      await state.siteManager.refresh();
    }
    if (!state.wallManager) state.wallManager = setupWallManager();
    if (hasCap("users.manage", me) && state.wallManager) {
      await state.wallManager.refresh();
    }
    if (!state.rolesManager) state.rolesManager = setupRolesManager();
    if (hasCap("roles.configure", me) && state.rolesManager) {
      await state.rolesManager.refresh();
    }
    if (hasCap("users.manage", me) && state.usersManager) {
      await state.usersManager.refresh();
    }
    if (hasCap("mods.manage", me) && state.modsManager) {
      await state.modsManager.refreshAll();
    }
    if (hasCap("workshop.review", me) && state.workshopManager) {
      await state.workshopManager.refresh();
    }
    if (hasCap("changelog.manage", me) && state.changelogManager) {
      await state.changelogManager.refresh();
    }
  }
}

el("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const username = String(fd.get("username") || "").trim();
  const password = String(fd.get("password") || "");

  const btn = e.target.querySelector('button[type="submit"]');
  if (btn instanceof HTMLButtonElement) btn.disabled = true;

  try {
    const data = await postJson("/api/auth/login", { username, password });
    if (!data.ok) throw new Error("登录失败");
    const nextUser = data.user || null;
    notifyAuthChanged(nextUser);
    if (nextUser && !canManageSite(nextUser)) {
      showToast("login-toast", "该账户无反馈后台权限，正在跳转到个人主页。", true);
      redirectToProfile(nextUser);
      return;
    }
    showToast("login-toast", "登录成功", true);
    await waitForPageTransition;
    await boot();
  } catch (err) {
    showToast(
      "login-toast",
      `登录失败：${err instanceof Error ? err.message : String(err)}`,
      false,
    );
  } finally {
    if (btn instanceof HTMLButtonElement) btn.disabled = false;
  }
});

el("pw-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const oldPassword = String(fd.get("oldPassword") || "");
  const newPassword = String(fd.get("newPassword") || "");

  const btn = e.target.querySelector('button[type="submit"]');
  if (btn instanceof HTMLButtonElement) btn.disabled = true;

  try {
    await postJson("/api/auth/change-password", { oldPassword, newPassword });
    showToast("pw-toast", "密码修改成功", true);
    await waitForPageTransition;
    await boot();
  } catch (err) {
    showToast(
      "pw-toast",
      `修改失败：${err instanceof Error ? err.message : String(err)}`,
      false,
    );
  } finally {
    if (btn instanceof HTMLButtonElement) btn.disabled = false;
  }
});

el("reload").addEventListener("click", reload);

setupPasswordToggles();
await waitForPageTransition;
await boot();
