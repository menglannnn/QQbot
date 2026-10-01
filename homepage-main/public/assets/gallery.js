const waitForPageTransition =
  window.__SITE_PAGE_TRANSITION_DONE instanceof Promise
    ? window.__SITE_PAGE_TRANSITION_DONE
    : Promise.resolve();
function el(id) {
  return document.getElementById(id);
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
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

  function render() {
    const item = items[index];
    if (!item) return;
    img.src = item.url;
    img.alt = item.title || item.fileName || "";
    caption.textContent = item.title || item.fileName || "";
  }

  function open(list, startIndex) {
    items = list;
    index = Math.max(0, Math.min(startIndex, items.length - 1));
    modal.hidden = false;
    render();
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

  return { open };
}

function renderTabs(container, categories, active, onPick) {
  container.innerHTML = "";
  const tabs = [{ key: "", label: "全部" }, ...categories.map((c) => ({ key: c, label: c }))];
  for (const t of tabs) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `tab${t.key === active ? " is-active" : ""}`;
    btn.textContent = t.key === "" ? "全部" : `📸 ${t.label}`;
    btn.addEventListener("click", () => onPick(t.key));
    container.appendChild(btn);
  }
}

function renderGallery(container, list, modalApi) {
  container.innerHTML = "";
  if (list.length === 0) {
    container.innerHTML =
      `<div class="muted">暂无图片（把图片放入 public/uploads/gallery/&lt;分类&gt;）</div>`;
    return;
  }

  list.forEach((item, idx) => {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.innerHTML = `<img loading="lazy" src="${item.url}" alt="${item.title || ""}" /><div class="tile__cap">${item.title || item.fileName || ""}</div>`;
    tile.addEventListener("click", () => modalApi.open(list, idx));
    container.appendChild(tile);
  });
}

async function main() {
  const tabs = el("tabs");
  const gallery = el("gallery");
  const modalApi = setupModal();

  let categories = [];
  try {
    const data = await fetchJson("/api/gallery/categories");
    categories = Array.isArray(data.categories) ? data.categories : [];
  } catch {
    categories = [];
  }

  let active = "";

  async function load(category) {
    active = category;
    renderTabs(tabs, categories, active, load);

    let images = [];
    if (active === "") {
      const perCat = await Promise.all(
        categories.map(async (c) => {
          try {
            const data = await fetchJson(`/api/gallery?category=${encodeURIComponent(c)}`);
            const list = Array.isArray(data.images) ? data.images : [];
            return list.map((x) => ({ ...x, title: x.fileName }));
          } catch {
            return [];
          }
        }),
      );
      images = perCat.flat();
    } else {
      try {
        const data = await fetchJson(`/api/gallery?category=${encodeURIComponent(active)}`);
        images = Array.isArray(data.images) ? data.images : [];
      } catch {
        images = [];
      }
      images = images.map((x) => ({ ...x, title: x.fileName }));
    }

    renderGallery(gallery, images, modalApi);
  }

  await load(active);
}

await waitForPageTransition;
await main();
