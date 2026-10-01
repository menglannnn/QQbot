const waitForPageTransition =
  window.__SITE_PAGE_TRANSITION_DONE instanceof Promise
    ? window.__SITE_PAGE_TRANSITION_DONE
    : Promise.resolve();
function el(id) {
  return document.getElementById(id);
}

function createDraftId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID().replaceAll("-", "");
  }
  return `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function showToast(message, ok) {
  if (message && window.siteToast) window.siteToast(message, ok ? "success" : "error");
  const toast = el("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle("is-show", Boolean(message));
  toast.style.borderColor = ok ? "rgba(34,197,94,0.35)" : "rgba(245,158,11,0.35)";
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error((data.error || `HTTP ${res.status}`) + (data.ref ? `(错误码 ${data.ref})` : ""));
  return data;
}

async function uploadFeedbackFile(kind, draftId, file) {
  const res = await fetch(`/api/feedback/upload?kind=${encodeURIComponent(kind)}&draftId=${encodeURIComponent(draftId)}`, {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "x-file-name": encodeURIComponent(file.name || ""),
    },
    body: await file.arrayBuffer(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error((data.error || `HTTP ${res.status}`) + (data.ref ? `(错误码 ${data.ref})` : ""));
  return data.attachment || null;
}

function summarizeFiles(files, emptyText, unitLabel) {
  if (!Array.isArray(files) || files.length === 0) return emptyText;
  const names = files.slice(0, 3).map((file) => file.name).join("，");
  const extra = files.length > 3 ? ` 等 ${files.length}${unitLabel}` : "";
  return `已选择：${names}${extra}`;
}

function isAcceptedImage(file) {
  return file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(file.name || "");
}

function validatePickedFile(kind, file) {
  if (!(file instanceof File)) return "文件无效";
  if (!file.name) return "文件名不能为空";
  if (kind === "image") {
    if (!isAcceptedImage(file)) return `${file.name} 不是支持的图片格式`;
    if (file.size > 10 * 1024 * 1024) return `${file.name} 超过 10MB`;
    return "";
  }
  if (file.size > 20 * 1024 * 1024) return `${file.name} 超过 20MB`;
  return "";
}

function mergePickedFiles(current, incoming) {
  const map = new Map();
  [...current, ...incoming].forEach((file) => {
    const key = `${file.name}_${file.size}_${file.lastModified}`;
    if (!map.has(key)) map.set(key, file);
  });
  return [...map.values()];
}

function formatFeedbackDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function renderMyFeedback(items) {
  const list = el("feedback-mine-list");
  if (!list) return;
  if (!Array.isArray(items) || items.length === 0) {
    list.innerHTML =
      '<div class="history__item"><div class="history__left"><div class="history__name">还没有反馈记录</div>' +
      '<div class="hint">提交反馈后会显示在这里。</div></div></div>';
    return;
  }
  list.innerHTML = items
    .map((item) => {
      const typeLabel = item.type === "bug" ? "Bug 反馈" : "建议";
      const statusLabel = item.resolved ? "已处理" : "待处理";
      const statusColor = item.resolved ? "#16a34a" : "#d97706";
      const date = formatFeedbackDate(item.createdAt);
      const title = String(item.title || "（无标题）");
      const content = String(item.content || "");
      const esc = (s) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const versions = [item.gameVersion, item.modVersion].filter(Boolean).join(" / ");
      const attach = (item.images?.length || 0) + (item.files?.length || 0);
      const metaBits = [
        `<span>${typeLabel}</span>`,
        date ? `<span>${esc(date)}</span>` : "",
        versions ? `<span>${esc(versions)}</span>` : "",
        attach ? `<span>附件 ${attach}</span>` : "",
        `<span style="color:${statusColor};font-weight:700;">${statusLabel}</span>`,
      ].filter(Boolean).join("");
      return (
        '<div class="history__item history__item--stack">' +
        '<div class="history__left">' +
        `<div class="history__name">${esc(title)}</div>` +
        (content ? `<div class="hint" style="white-space:pre-wrap;">${esc(content)}</div>` : "") +
        `<div class="history__meta">${metaBits}</div>` +
        "</div></div>"
      );
    })
    .join("");
}

async function loadMyFeedback() {
  const section = el("feedback-mine-section");
  if (!section) return;
  try {
    const res = await fetch("/api/feedback/mine", { cache: "no-store" });
    if (res.status === 401) {
      section.hidden = true;
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    renderMyFeedback(data.items || []);
  } catch {
    section.hidden = true;
  }
}

const form = el("form");
const typeInput = el("feedback-type");
const titleInput = el("title-input");
const contentInput = el("content-input");
const titleLabel = el("title-label");
const contentLabel = el("content-label");
const bugFields = el("bug-fields");
const bugImageDropzone = el("bug-image-dropzone");
const bugImageInput = el("bug-image-input");
const bugImagePick = el("bug-image-pick");
const bugImagePicked = el("bug-image-picked");
const bugFileDropzone = el("bug-file-dropzone");
const bugFileInput = el("bug-file-input");
const bugFilePick = el("bug-file-pick");
const bugFilePicked = el("bug-file-picked");

const state = {
  draftId: createDraftId(),
  images: [],
  files: [],
};

function syncTypeView() {
  const type = typeInput.value === "bug" ? "bug" : "suggestion";
  const isBug = type === "bug";
  bugFields.hidden = !isBug;
  titleLabel.textContent = isBug ? "Bug 标题" : "标题";
  titleInput.placeholder = isBug ? "一句话概括这个 Bug" : "一句话概括你的建议";
  contentLabel.textContent = isBug ? "Bug 描述和复现方法" : "您想提出什么样的建议，什么样的修改";
  contentInput.placeholder = isBug
    ? "请写清楚出现了什么问题、如何复现、你原本期望看到什么结果"
    : "例如：希望新增什么功能、调整什么设计、为什么这样改会更合适";
}

function renderPickedFiles() {
  bugImagePicked.textContent = summarizeFiles(state.images, "未选择图片", "张图片");
  bugFilePicked.textContent = summarizeFiles(state.files, "未选择文件", "个文件");
}

function handlePickedFiles(kind, fileList) {
  const validFiles = [];
  const errors = [];
  for (const file of Array.from(fileList || [])) {
    const error = validatePickedFile(kind, file);
    if (error) {
      errors.push(error);
      continue;
    }
    validFiles.push(file);
  }

  if (kind === "image") {
    state.images = mergePickedFiles(state.images, validFiles);
  } else {
    state.files = mergePickedFiles(state.files, validFiles);
  }
  renderPickedFiles();

  if (errors.length > 0) {
    showToast(errors.join("；"), false);
  } else if (validFiles.length > 0) {
    showToast(`已加入 ${validFiles.length} 个${kind === "image" ? "图片" : "文件"}`, true);
  }
}

function bindDropzone(dropzone, input, kind) {
  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("is-over");
  });
  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("is-over");
  });
  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-over");
    const files = event.dataTransfer?.files;
    if (files?.length) handlePickedFiles(kind, files);
  });
  input.addEventListener("change", () => {
    if (input.files?.length) handlePickedFiles(kind, input.files);
    input.value = "";
  });
}

async function uploadSelectedFiles(kind, files) {
  const uploaded = [];
  for (const file of files) {
    const attachment = await uploadFeedbackFile(kind, state.draftId, file);
    if (attachment) uploaded.push(attachment);
  }
  return uploaded;
}

function resetFormState() {
  form.reset();
  state.draftId = createDraftId();
  state.images = [];
  state.files = [];
  typeInput.value = "suggestion";
  syncTypeView();
  renderPickedFiles();
}

await waitForPageTransition;

typeInput.addEventListener("change", syncTypeView);
bugImagePick.addEventListener("click", () => bugImageInput.click());
bugFilePick.addEventListener("click", () => bugFileInput.click());
bindDropzone(bugImageDropzone, bugImageInput, "image");
bindDropzone(bugFileDropzone, bugFileInput, "file");
syncTypeView();
renderPickedFiles();
void loadMyFeedback();
window.addEventListener("site:auth-changed", () => void loadMyFeedback());

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fd = new FormData(form);
  const type = String(fd.get("type") || "suggestion");
  const payload = {
    draftId: state.draftId,
    type,
    title: String(fd.get("title") || ""),
    content: String(fd.get("content") || ""),
    gameVersion: String(fd.get("gameVersion") || ""),
    modVersion: String(fd.get("modVersion") || ""),
    contact: String(fd.get("contact") || ""),
    images: [],
    files: [],
  };

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = true;

  try {
    if (type === "bug") {
      showToast("正在上传附件…", true);
      payload.images = await uploadSelectedFiles("image", state.images);
      payload.files = await uploadSelectedFiles("file", state.files);
    }
    await postJson("/api/feedback", payload);
    resetFormState();
    showToast("提交成功，感谢反馈！", true);
    void loadMyFeedback();
  } catch (err) {
    showToast(`提交失败：${err instanceof Error ? err.message : String(err)}`, false);
  } finally {
    if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = false;
  }
});
