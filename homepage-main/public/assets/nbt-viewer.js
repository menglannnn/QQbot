import * as THREE from "/vendor/three/three.module.js";

function el(id) {
  return document.getElementById(id);
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败：${res.status}`);
  return data;
}

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

function setMeta(parts) {
  const metaEl = el("nbt-meta");
  if (!(metaEl instanceof HTMLElement)) return;
  metaEl.innerHTML = "";
  for (const part of parts) {
    const node = document.createElement("span");
    node.textContent = part;
    metaEl.appendChild(node);
  }
}

function setStageStatus(text, visible = true) {
  const statusEl = el("nbt-stage-status");
  if (!(statusEl instanceof HTMLElement)) return;
  statusEl.textContent = text;
  statusEl.hidden = !visible;
}

function hashString(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function colorForBlock(name) {
  const key = String(name || "").toLowerCase();
  const hash = hashString(key);
  const vary = ((hash % 19) - 9) / 100;

  const presets = [
    [["grass", "slime", "emerald", "lime", "moss", "leaves", "vine", "bamboo", "cactus"], 0x4f9b49],
    [["water", "ice", "packed_ice", "blue_ice", "prismarine"], 0x4b83d1],
    [["lava", "magma", "fire"], 0xd76a25],
    [["sand", "birch", "end_stone", "bone"], 0xd7c27d],
    [["oak", "spruce", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "crimson", "warped", "planks", "log", "wood"], 0x8b5a34],
    [["deepslate", "basalt", "blackstone", "obsidian", "coal"], 0x3e434d],
    [["stone", "cobblestone", "andesite", "diorite", "granite", "tuff", "gravel", "smooth_stone"], 0x8b8f97],
    [["brick", "terracotta", "red_sandstone", "nether", "red_nether"], 0xb85f45],
    [["quartz", "calcite", "snow", "white_wool", "white_concrete"], 0xe5e7eb],
    [["glass", "sea_lantern", "lantern", "glowstone", "shroomlight"], 0xe2d6a8],
    [["copper", "cut_copper"], 0xc27a46],
    [["gold"], 0xd9b646],
    [["diamond"], 0x52d4d8],
    [["amethyst", "purpur"], 0x986bc7],
  ];

  let base = 0x7f8a96;
  for (const [needles, color] of presets) {
    if (needles.some((needle) => key.includes(needle))) {
      base = color;
      break;
    }
  }

  const c = new THREE.Color(base);
  c.offsetHSL(0, 0, vary);
  return c;
}

function createFallbackMaterial(name) {
  return new THREE.MeshStandardMaterial({
    color: colorForBlock(name),
    roughness: 0.95,
    metalness: 0.02,
  });
}

function createTextureLoader() {
  const loader = new THREE.TextureLoader();
  const cache = new Map();

  function configureTexture(texture) {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestMipmapNearestFilter;
    texture.generateMipmaps = true;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    if ("colorSpace" in texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
    } else if ("encoding" in texture) {
      texture.encoding = THREE.sRGBEncoding;
    }
    texture.needsUpdate = true;
    return texture;
  }

  return {
    async load(url) {
      if (!url) return null;
      if (!cache.has(url)) {
        cache.set(
          url,
          new Promise((resolve) => {
            loader.load(
              url,
              (texture) => resolve(configureTexture(texture)),
              undefined,
              () => resolve(null),
            );
          }),
        );
      }
      return cache.get(url);
    },
    dispose() {
      for (const promise of cache.values()) {
        Promise.resolve(promise).then((texture) => texture?.dispose?.()).catch(() => {});
      }
      cache.clear();
    },
  };
}

async function createMaterialsForTextureSet(textureLoader, textureSet, blockName) {
  const transparent = Boolean(textureSet?.transparent);
  const urls = {
    right: textureSet?.right || textureSet?.side || "",
    left: textureSet?.left || textureSet?.side || "",
    top: textureSet?.top || textureSet?.side || "",
    bottom: textureSet?.bottom || textureSet?.side || "",
    front: textureSet?.front || textureSet?.side || "",
    back: textureSet?.back || textureSet?.side || "",
  };
  const textures = await Promise.all([
    textureLoader.load(urls.right),
    textureLoader.load(urls.left),
    textureLoader.load(urls.top),
    textureLoader.load(urls.bottom),
    textureLoader.load(urls.front),
    textureLoader.load(urls.back),
  ]);
  if (textures.every((item) => !item)) {
    return createFallbackMaterial(blockName);
  }
  return textures.map((texture) => {
    if (!texture) return createFallbackMaterial(blockName);
    return new THREE.MeshStandardMaterial({
      map: texture,
      transparent,
      alphaTest: transparent ? 0.15 : 0,
      roughness: 1,
      metalness: 0,
    });
  });
}

function createViewer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  if ("outputColorSpace" in renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
  const root = new THREE.Group();
  const textureLoader = createTextureLoader();
  scene.add(root);

  const hemi = new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 1.2);
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
  const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
  keyLight.position.set(1.5, 2.4, 1.8);
  fillLight.position.set(-1.2, 1.1, -1.5);
  scene.add(hemi, keyLight, fillLight);

  const grid = new THREE.GridHelper(10, 10, 0x36506a, 0x243447);
  grid.material.transparent = true;
  grid.material.opacity = 0.4;
  scene.add(grid);

  const controls = {
    yaw: -0.7,
    pitch: 0.75,
    distance: 28,
    dragging: false,
    lastX: 0,
    lastY: 0,
    autoRotate: true,
  };
  let defaultDistance = controls.distance;

  const target = new THREE.Vector3(0, 0, 0);

  function applyCamera() {
    const pitch = clamp(controls.pitch, 0.12, Math.PI / 2 - 0.08);
    const radius = Math.max(4, controls.distance);
    camera.position.set(
      target.x + radius * Math.cos(pitch) * Math.sin(controls.yaw),
      target.y + radius * Math.sin(pitch),
      target.z + radius * Math.cos(pitch) * Math.cos(controls.yaw),
    );
    camera.lookAt(target);
  }

  function resize() {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  canvas.addEventListener("pointerdown", (event) => {
    controls.dragging = true;
    controls.autoRotate = false;
    controls.lastX = event.clientX;
    controls.lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!controls.dragging) return;
    const dx = event.clientX - controls.lastX;
    const dy = event.clientY - controls.lastY;
    controls.lastX = event.clientX;
    controls.lastY = event.clientY;
    controls.yaw -= dx * 0.008;
    controls.pitch = clamp(controls.pitch - dy * 0.008, 0.12, Math.PI / 2 - 0.08);
  });

  function stopDragging(event) {
    if (!controls.dragging) return;
    controls.dragging = false;
    if (event && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  canvas.addEventListener("pointerup", stopDragging);
  canvas.addEventListener("pointercancel", stopDragging);
  canvas.addEventListener("pointerleave", stopDragging);

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      controls.autoRotate = false;
      const next = controls.distance * (event.deltaY > 0 ? 1.1 : 0.9);
      controls.distance = clamp(next, 4, 300);
    },
    { passive: false },
  );

  let resizeObserver = null;
  if ("ResizeObserver" in window) {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas);
  } else {
    window.addEventListener("resize", resize);
  }

  const clock = new THREE.Clock();
  function renderLoop() {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (controls.autoRotate) {
      controls.yaw += dt * 0.25;
    }
    applyCamera();
    resize();
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(renderLoop);

  function clearRoot() {
    for (const child of [...root.children]) {
      root.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) {
          child.material.forEach((item) => item.dispose?.());
        } else {
          child.material?.dispose?.();
        }
      }
    }
  }

  async function mountRenderModel(renderModel) {
    clearRoot();
    if (!renderModel || !Array.isArray(renderModel.blocks) || renderModel.blocks.length === 0) {
      grid.visible = false;
      return false;
    }

    const [sx, sy, sz] = Array.isArray(renderModel.size) ? renderModel.size : [1, 1, 1];
    const maxDim = Math.max(sx, sy, sz, 4);
    grid.visible = true;
    grid.scale.setScalar(Math.max(maxDim * 1.8, 8) / 10);
    grid.position.set(0, -sy / 2, 0);
    const offsetX = -(sx - 1) / 2;
    const offsetY = -(sy - 1) / 2;
    const offsetZ = -(sz - 1) / 2;
    const paletteByState = new Map(
      (Array.isArray(renderModel.palette) ? renderModel.palette : []).map((entry) => [Number(entry.index), entry]),
    );
    const groupedBlocks = new Map();
    for (const block of renderModel.blocks) {
      const paletteEntry = paletteByState.get(Number(block.state)) || { name: block.name, textures: null };
      const groupKey = JSON.stringify({
        state: block.state,
        name: paletteEntry.name || block.name,
        textures: paletteEntry.textures || null,
      });
      if (!groupedBlocks.has(groupKey)) {
        groupedBlocks.set(groupKey, {
          paletteEntry,
          blocks: [],
        });
      }
      groupedBlocks.get(groupKey).blocks.push(block);
    }

    for (const group of groupedBlocks.values()) {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const materials = await createMaterialsForTextureSet(
        textureLoader,
        group.paletteEntry?.textures || null,
        group.paletteEntry?.name || "",
      );
      const mesh = new THREE.InstancedMesh(geometry, materials, group.blocks.length);
      const matrix = new THREE.Matrix4();
      for (let index = 0; index < group.blocks.length; index += 1) {
        const block = group.blocks[index];
        matrix.makeTranslation(block.x + offsetX, block.y + offsetY, block.z + offsetZ);
        mesh.setMatrixAt(index, matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      root.add(mesh);
    }

    defaultDistance = clamp(maxDim * 2.1, 8, 220);
    controls.distance = defaultDistance;
    controls.yaw = -0.7;
    controls.pitch = 0.75;
    controls.autoRotate = true;
    return true;
  }

  return {
    mountRenderModel,
    resetView() {
      controls.yaw = -0.7;
      controls.pitch = 0.75;
      controls.distance = defaultDistance;
      controls.autoRotate = true;
    },
    dispose() {
      renderer.setAnimationLoop(null);
      clearRoot();
      textureLoader.dispose();
      renderer.dispose();
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener("resize", resize);
    },
  };
}

function buildMetaParts(data) {
  const renderModel = data.renderModel;
  const parts = [
    `文件：${data.fileName || "未知"}`,
    `编码：${data.type || "auto"}`,
    `来源：创意工坊`,
  ];
  if (renderModel?.size) {
    parts.push(`尺寸：${renderModel.size.join(" x ")}`);
  }
  if (Number.isFinite(renderModel?.renderedBlockCount)) {
    parts.push(`已渲染方块：${renderModel.renderedBlockCount}`);
  }
  if (Number.isFinite(renderModel?.omittedBlockCount) && renderModel.omittedBlockCount > 0) {
    parts.push(`未绘制：${renderModel.omittedBlockCount}`);
  }
  return parts;
}

async function boot() {
  const metaEl = el("nbt-meta");
  const contentEl = el("nbt-content");
  const rawLink = el("nbt-raw-link");
  const canvas = el("nbt-canvas");
  const resetButton = el("nbt-reset-view");
  if (
    !(metaEl instanceof HTMLElement) ||
    !(contentEl instanceof HTMLElement) ||
    !(rawLink instanceof HTMLAnchorElement) ||
    !(canvas instanceof HTMLCanvasElement) ||
    !(resetButton instanceof HTMLButtonElement)
  ) {
    return;
  }

  const viewer = createViewer(canvas);
  resetButton.addEventListener("click", () => viewer.resetView());

  const params = new URLSearchParams(window.location.search);
  const fileUrl = params.get("url") || "";
  if (!fileUrl) {
    setMeta(["未提供 NBT 文件地址"]);
    setStageStatus("请从创意工坊作品卡片上的 NBT Viewer 入口打开。", true);
    contentEl.textContent = "请从创意工坊作品卡片上的 NBT Viewer 入口打开。";
    return;
  }

  rawLink.href = fileUrl;
  rawLink.hidden = false;

  try {
    const data = await fetchJson(`/api/workshop/nbt-preview?url=${encodeURIComponent(fileUrl)}`);
    setMeta(buildMetaParts(data));
    contentEl.textContent = formatJson(data.preview ?? {});

    const ok = await viewer.mountRenderModel(data.renderModel);
    if (ok) {
      if (data.renderModel?.omittedBlockCount > 0) {
        setStageStatus(`已生成 3D 预览。为保证流畅度，仅绘制前 ${data.renderModel.renderedBlockCount} 个非空气方块。`, true);
      } else {
        setStageStatus("", false);
      }
    } else {
      setStageStatus("这个 NBT 文件里没有可直接渲染的结构方块数据，下面仍可查看原始内容。", true);
    }
  } catch (error) {
    setMeta(["NBT 预览加载失败"]);
    setStageStatus("3D 预览加载失败", true);
    contentEl.textContent = error instanceof Error ? error.message : String(error);
  }
}

await boot();
