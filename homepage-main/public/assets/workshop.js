const waitForPageTransition =
  window.__SITE_PAGE_TRANSITION_DONE instanceof Promise
    ? window.__SITE_PAGE_TRANSITION_DONE
    : Promise.resolve();

const state = {
  me: null,
  categories: [],
  filter: "",
};

function el(id) {
  return document.getElementById(id);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function fetchJson(url, init) {
  const res = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...(init || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.error || `请求失败：${res.status}`) + (data.ref ? `(错误码 ${data.ref})` : ""));
  return data;
}

async function postJson(url, payload) {
  return fetchJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function showToast(message, ok) {
  if (message && window.siteToast) window.siteToast(message, ok ? "success" : "error");
  const toast = el("workshop-toast");
  if (!(toast instanceof HTMLElement)) return;
  toast.textContent = message || "";
  toast.classList.toggle("is-show", Boolean(message));
  toast.style.borderColor = ok ? "rgba(34,197,94,0.35)" : "rgba(245,158,11,0.35)";
}

function formatTime(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)}${units[index]}`;
}

function createDraftId() {
  return `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function statusBadge(status) {
  if (status === "approved") return `<span class="badge badge--ok">已通过</span>`;
  if (status === "rejected") return `<span class="badge badge--danger">已打回</span>`;
  return `<span class="badge badge--warn">待审核</span>`;
}

function normalizeLinkValue(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return text;
}

function renderNbtButtons(item) {
  const nbtFile = item?.files?.nbt || null;
  if (!nbtFile?.url) return `<div class="hint">暂无 NBT 文件</div>`;
  // 官网只提供在线预览,不提供 NBT 直接下载;下载走作品外链。
  const buttons = [];
  if (item?.nbtViewerUrl) {
    buttons.push(
      `<a class="btn btn--ghost" href="${escapeHtml(item.nbtViewerUrl)}" target="_blank" rel="noreferrer">NBT Viewer 在线预览${nbtFile.size ? ` · ${escapeHtml(formatBytes(nbtFile.size))}` : ""}</a>`,
    );
  }
  buttons.push(`<span class="hint">下载请使用下方外链</span>`);
  return buttons.join("");
}

function renderExternalLinkButtons(links) {
  if (!Array.isArray(links) || links.length === 0) return `<div class="hint">未填写其他外链</div>`;
  return links
    .map((link, index) => {
      const label = normalizeLinkValue(link?.label) || `外链 ${index + 1}`;
      const url = normalizeLinkValue(link?.url);
      if (!url) return "";
      return `<a class="btn btn--ghost" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
    })
    .join("");
}

function renderImages(item) {
  const images = Array.isArray(item?.files?.images) ? item.files.images : [];
  if (images.length === 0) return "";
  return (
    `<div class="workshop-card__images" style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;">` +
    images
      .map(
        (img) =>
          `<a href="${escapeHtml(img.url)}" target="_blank" rel="noreferrer">` +
          `<img src="${escapeHtml(img.url)}" alt="${escapeHtml(item.title || "作品图片")}" loading="lazy" ` +
          `style="width:120px;height:90px;object-fit:cover;border-radius:8px;border:1px solid var(--line);" ` +
          `onerror="this.style.display='none'" /></a>`,
      )
      .join("") +
    `</div>`
  );
}

function renderWorkshopItems(items) {
  const grid = el("workshop-grid");
  if (!(grid instanceof HTMLElement)) return;
  const limit = Number(grid.dataset.limit || 0);
  const list = Array.isArray(items) ? (limit > 0 ? items.slice(0, limit) : items) : [];
  if (list.length === 0) {
    grid.innerHTML = `<div class="panel panel--empty">还没有已通过的创意工坊作品。</div>`;
    return;
  }

  grid.innerHTML = list
    .map((item) => {
      const authorName = item.author?.displayName || item.author?.username || "未知玩家";
      const authorUrl = item.author?.profileUrl || "#";
      return (
        `<article class="panel workshop-card">` +
        `<div class="button-row" style="justify-content:space-between;align-items:flex-start;">` +
        `<div class="workshop-card__title">${escapeHtml(item.title || "未命名作品")}</div>` +
        `${statusBadge(item.status)}` +
        `</div>` +
        `<div class="workshop-card__meta">` +
        `<span>分类：${escapeHtml(item.categoryLabel || "其他")}</span>` +
        `<span>作者：<a class="link" href="${escapeHtml(authorUrl)}">${escapeHtml(authorName)}</a></span>` +
        `<span>发布时间：${escapeHtml(formatTime(item.publishedAt || item.updatedAt))}</span>` +
        `</div>` +
        `<div class="workshop-card__desc">${escapeHtml(item.description || "暂无描述")}</div>` +
        renderImages(item) +
        (item?.files?.nbt
          ? `<div class="workshop-card__block"><div class="workshop-card__label">NBT 文件</div><div class="button-row">${renderNbtButtons(item)}</div></div>`
          : "") +
        `<div class="workshop-card__block"><div class="workshop-card__label">附加外链</div><div class="button-row">${renderExternalLinkButtons(item.externalLinks)}</div></div>` +
        `</article>`
      );
    })
    .join("");
}

function renderMineItems(items) {
  const section = el("workshop-mine-section");
  const list = el("workshop-mine-list");
  if (!(section instanceof HTMLElement) || !(list instanceof HTMLElement)) return;

  if (!state.me?.username) {
    section.hidden = true;
    return;
  }
  section.hidden = false;

  if (!Array.isArray(items) || items.length === 0) {
    list.innerHTML = `<div class="history__item"><div class="history__left"><div class="history__name">你还没有提交过创意工坊内容</div><div class="hint">填写上面的表单后，提交记录会出现在这里。</div></div></div>`;
    return;
  }

  list.innerHTML = items
    .map((item) => {
      const reason = item.reviewReason
        ? `<div class="workshop-review-note">打回原因：${escapeHtml(item.reviewReason)}</div>`
        : "";
      return (
        `<div class="history__item history__item--stack">` +
        `<div class="history__left">` +
        `<div class="button-row" style="justify-content:space-between;align-items:flex-start;">` +
        `<div class="history__name">${escapeHtml(item.title || "未命名作品")}</div>` +
        `${statusBadge(item.status)}` +
        `</div>` +
        `<div class="history__meta">` +
        `<span>分类：${escapeHtml(item.categoryLabel || "其他")}</span>` +
        `<span>提交时间：${escapeHtml(formatTime(item.createdAt))}</span>` +
        `<span>最后更新：${escapeHtml(formatTime(item.updatedAt))}</span>` +
        `</div>` +
        `<div class="hint" style="margin-top:8px;">${escapeHtml(item.description || "暂无描述")}</div>` +
        `${reason}` +
        `</div>` +
        `<div class="workshop-inline-group"><div class="workshop-card__label">NBT 文件</div><div class="button-row">${renderNbtButtons(item)}</div></div>` +
        `<div class="workshop-inline-group"><div class="workshop-card__label">附加外链</div><div class="button-row">${renderExternalLinkButtons(item.externalLinks)}</div></div>` +
        `</div>`
      );
    })
    .join("");
}

function syncAuthHint() {
  const authHint = el("workshop-auth-hint");
  const form = el("workshop-form");
  if (!(authHint instanceof HTMLElement) || !(form instanceof HTMLFormElement)) return;
  if (state.me?.username) {
    authHint.textContent = `当前登录：${state.me.displayName || state.me.username}，可以直接投稿创意工坊内容。`;
    form.querySelectorAll("input, textarea, select, button").forEach((node) => {
      node.disabled = false;
    });
    return;
  }

  authHint.textContent = "尚未登录，先从右上角账户入口进入登录页，再回来投稿。";
  form.querySelectorAll("input, textarea, select, button").forEach((node) => {
    node.disabled = true;
  });
}

function createExternalLinkRow(link = {}) {
  const container = el("workshop-links");
  if (!(container instanceof HTMLElement)) return;
  const row = document.createElement("div");
  row.className = "link-editor__row";
  row.innerHTML =
    `<input class="input" type="text" data-link-label="1" maxlength="40" placeholder="链接名称，例如 教程页" value="${escapeHtml(link.label || "")}" />` +
    `<input class="input" type="url" data-link-url="1" placeholder="https://example.com" value="${escapeHtml(link.url || "")}" />` +
    `<button class="btn btn--ghost" type="button" data-link-remove="1">移除</button>`;
  const removeButton = row.querySelector('[data-link-remove="1"]');
  if (removeButton instanceof HTMLButtonElement) {
    removeButton.addEventListener("click", () => {
      row.remove();
      ensureAtLeastOneLinkRow();
    });
  }
  container.appendChild(row);
}

function ensureAtLeastOneLinkRow() {
  const container = el("workshop-links");
  if (!(container instanceof HTMLElement)) return;
  if (container.children.length === 0) {
    createExternalLinkRow();
  }
}

function collectExternalLinks() {
  const container = el("workshop-links");
  if (!(container instanceof HTMLElement)) return [];
  return Array.from(container.querySelectorAll(".link-editor__row"))
    .map((row) => {
      const labelInput = row.querySelector('[data-link-label="1"]');
      const urlInput = row.querySelector('[data-link-url="1"]');
      const label = labelInput instanceof HTMLInputElement ? labelInput.value.trim() : "";
      const url = urlInput instanceof HTMLInputElement ? urlInput.value.trim() : "";
      if (!label && !url) return null;
      return { label, url };
    })
    .filter(Boolean);
}

async function loadCategories() {
  const filterSelect = el("workshop-filter");
  const categorySelect = el("workshop-category");
  if (!(filterSelect instanceof HTMLSelectElement) && !(categorySelect instanceof HTMLSelectElement)) return;

  const data = await fetchJson("/api/workshop/meta");
  state.categories = Array.isArray(data.categories) ? data.categories : [];
  const opts = state.categories
    .map((item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`)
    .join("");
  if (filterSelect instanceof HTMLSelectElement) {
    filterSelect.innerHTML = `<option value="">全部分类</option>` + opts;
  }
  if (categorySelect instanceof HTMLSelectElement) {
    categorySelect.innerHTML = opts;
  }
}

async function loadApprovedItems() {
  if (!(el("workshop-grid") instanceof HTMLElement)) return;
  const query = state.filter ? `?category=${encodeURIComponent(state.filter)}` : "";
  const data = await fetchJson(`/api/workshop${query}`);
  renderWorkshopItems(Array.isArray(data.items) ? data.items : []);
}

async function loadMineItems() {
  if (!state.me?.username) {
    renderMineItems([]);
    return;
  }
  const data = await fetchJson("/api/workshop/mine");
  renderMineItems(Array.isArray(data.items) ? data.items : []);
}

async function loadMe() {
  try {
    const data = await fetchJson("/api/auth/me");
    state.me = data.user || null;
  } catch {
    state.me = null;
  }
  syncAuthHint();
}

async function uploadWorkshopFile(file, draftId, kind) {
  const buffer = await file.arrayBuffer();
  const data = await fetchJson(`/api/workshop/upload?draftId=${encodeURIComponent(draftId)}&kind=${kind}`, {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "x-file-name": encodeURIComponent(file.name),
    },
    body: buffer,
  });
  return data.attachment || null;
}

function bindEvents() {
  const filterSelect = el("workshop-filter");
  const categorySelect = el("workshop-category");
  const form = el("workshop-form");
  const fileImages = el("workshop-images");
  const fileNbt = el("workshop-file-nbt");
  const titleInput = el("workshop-title");
  const descriptionInput = el("workshop-description");
  const addLinkButton = el("workshop-link-add");

  if (
    !(filterSelect instanceof HTMLSelectElement) ||
    !(categorySelect instanceof HTMLSelectElement) ||
    !(form instanceof HTMLFormElement) ||
    !(fileImages instanceof HTMLInputElement) ||
    !(titleInput instanceof HTMLInputElement) ||
    !(descriptionInput instanceof HTMLTextAreaElement) ||
    !(addLinkButton instanceof HTMLButtonElement)
  ) {
    return;
  }

  filterSelect.addEventListener("change", async () => {
    state.filter = filterSelect.value || "";
    await loadApprovedItems();
  });

  addLinkButton.addEventListener("click", () => createExternalLinkRow());

  window.addEventListener("site:auth-changed", async (event) => {
    const nextUser = event instanceof CustomEvent ? event.detail?.user || null : null;
    state.me = nextUser;
    syncAuthHint();
    await loadMineItems();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.me?.username) {
      showToast("请先登录后再投稿创意工坊内容。", false);
      return;
    }

    const imageFiles = fileImages.files ? Array.from(fileImages.files) : [];
    const nbtFile = (fileNbt instanceof HTMLInputElement && fileNbt.files?.[0]) || null;
    if (!titleInput.value.trim() || !descriptionInput.value.trim()) {
      showToast("请先填写作品名称和描述介绍。", false);
      return;
    }
    if (imageFiles.length === 0) {
      showToast("请至少上传一张作品图片。", false);
      return;
    }
    if (imageFiles.length > 8) {
      showToast("最多上传 8 张图片。", false);
      return;
    }
    if (imageFiles.some((f) => f.size > 10 * 1024 * 1024)) {
      showToast("单张图片不能超过 10MB。", false);
      return;
    }
    // 官网只提供在线预览:NBT 文件与站外下载链接均为必填。
    if (!nbtFile) {
      showToast("请上传 NBT 结构文件(仅用于在线预览)。", false);
      return;
    }
    const downloadUrlInput = el("workshop-download-url");
    const downloadUrl = downloadUrlInput instanceof HTMLInputElement ? downloadUrlInput.value.trim() : "";
    if (!/^https?:\/\/\S+/i.test(downloadUrl)) {
      showToast("请填写有效的站外下载链接(以 http:// 或 https:// 开头)。", false);
      return;
    }

    const externalLinks = [{ label: "下载地址", url: downloadUrl }, ...collectExternalLinks()];
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton instanceof HTMLButtonElement) submitButton.disabled = true;

    try {
      showToast("图片上传中…", true);
      const draftId = createDraftId();
      const images = [];
      for (const f of imageFiles) {
        const att = await uploadWorkshopFile(f, draftId, "image");
        if (att) images.push(att);
      }
      const files = { images };
      if (nbtFile) files.nbt = await uploadWorkshopFile(nbtFile, draftId, "nbt");

      showToast("投稿提交中…", true);
      await postJson("/api/workshop", {
        draftId,
        title: titleInput.value.trim(),
        category: categorySelect.value,
        description: descriptionInput.value.trim(),
        files,
        externalLinks,
      });

      form.reset();
      if (state.categories[0]) {
        categorySelect.value = state.categories[0].key;
      }
      const links = el("workshop-links");
      if (links instanceof HTMLElement) links.innerHTML = "";
      ensureAtLeastOneLinkRow();
      await Promise.all([loadApprovedItems(), loadMineItems()]);
      showToast("投稿已提交，等待管理员审核。", true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), false);
    } finally {
      if (submitButton instanceof HTMLButtonElement) submitButton.disabled = false;
    }
  });
}

function setupFilePickers() {
  const form = el("workshop-form");
  document.querySelectorAll("[data-filepick-for]").forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const id = btn.dataset.filepickFor || "";
    const input = document.getElementById(id);
    const nameEl = document.querySelector(`[data-filepick-name="${id}"]`);
    if (!(input instanceof HTMLInputElement)) return;

    const empty = nameEl instanceof HTMLElement ? nameEl.dataset.filepickEmpty || "未选择文件" : "";
    const render = () => {
      if (!(nameEl instanceof HTMLElement)) return;
      const files = input.files ? Array.from(input.files) : [];
      if (files.length === 0) {
        nameEl.textContent = empty;
        nameEl.classList.remove("is-selected");
        nameEl.removeAttribute("title");
        return;
      }
      const names = files.map((f) => f.name);
      const text = files.length === 1 ? names[0] : `已选择 ${files.length} 个文件：${names.join("，")}`;
      nameEl.textContent = text;
      nameEl.title = names.join("\n");
      nameEl.classList.add("is-selected");
    };

    btn.addEventListener("click", () => input.click());
    input.addEventListener("change", render);
    render();
  });

  // 表单重置(投稿成功后 form.reset())时,把文件名标签一起复位。
  if (form instanceof HTMLFormElement) {
    form.addEventListener("reset", () => {
      // reset 后 input.files 在下一帧才清空,延后再渲染。
      setTimeout(() => {
        document.querySelectorAll("[data-filepick-name]").forEach((nameEl) => {
          if (!(nameEl instanceof HTMLElement)) return;
          nameEl.textContent = nameEl.dataset.filepickEmpty || "未选择文件";
          nameEl.classList.remove("is-selected");
          nameEl.removeAttribute("title");
        });
      }, 0);
    });
  }
}

async function boot() {
  await waitForPageTransition;
  await Promise.all([loadCategories(), loadMe()]);
  ensureAtLeastOneLinkRow();
  bindEvents();
  setupFilePickers();
  await Promise.all([loadApprovedItems(), loadMineItems()]);
}

await boot();
