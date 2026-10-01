// NBT 预览:sanitize + 结构渲染模型抽取。忠实移植 server.js。
// 纹理:返回静态 URL /vendor/mc/1.21.8/blocks/<key>.png(由 scripts/export-mc-assets.mjs 导出)。
// 若存在生成的元数据(src/generated/mc-blocks.json)则用模型解析,否则按方块名兜底。
// 构建期由 scripts/export-mc-assets.mjs 覆盖为真实元数据;默认 stub 为 null(兜底按名取图)
import MC from "../generated/mc-blocks.js";

const TEX_BASE = "/vendor/mc/1.21.8/blocks";
const AIR = new Set(["air", "cave_air", "void_air", "structure_void"]);
const RENDER_BLOCK_LIMIT = 25000;
const TRANSPARENT_RE = /(glass|ice|leaves|slime|honey|water|barrier|chain|lantern|door|trapdoor|pane|vine|sculk_sensor)/i;

// ---------- 纯 JS NBT 解析(零依赖,避免 prismarine-nbt 的 eval)----------
const DECODER = new TextDecoder();
class Reader {
  constructor(u8) { this.d = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); this.o = 0; }
  u8() { return this.d.getUint8(this.o++); }
  i8() { return this.d.getInt8(this.o++); }
  i16() { const v = this.d.getInt16(this.o); this.o += 2; return v; }
  u16() { const v = this.d.getUint16(this.o); this.o += 2; return v; }
  i32() { const v = this.d.getInt32(this.o); this.o += 4; return v; }
  i64() { const v = this.d.getBigInt64(this.o); this.o += 8; return v; }
  f32() { const v = this.d.getFloat32(this.o); this.o += 4; return v; }
  f64() { const v = this.d.getFloat64(this.o); this.o += 8; return v; }
  str() {
    const len = this.u16();
    const bytes = new Uint8Array(this.d.buffer, this.d.byteOffset + this.o, len);
    this.o += len;
    return DECODER.decode(bytes);
  }
}
const MAX_ARRAY_ELEMENTS = 4_194_304; // 上界,防恶意长度导致 OOM/崩溃
const MAX_NBT_DEPTH = 512;            // 递归深度上界,防爆栈
function arrayLen(r) {
  const n = r.i32();
  if (n < 0 || n > MAX_ARRAY_ELEMENTS) throw new Error("nbt array length out of range");
  return n;
}
function readPayload(r, type, depth = 0) {
  if (depth > MAX_NBT_DEPTH) throw new Error("nbt nesting too deep");
  switch (type) {
    case 1: return r.i8();
    case 2: return r.i16();
    case 3: return r.i32();
    case 4: return r.i64();
    case 5: return r.f32();
    case 6: return r.f64();
    case 7: { const n = arrayLen(r); const a = new Array(n); for (let i = 0; i < n; i++) a[i] = r.i8(); return a; }
    case 8: return r.str();
    case 9: { const it = r.u8(); const n = arrayLen(r); const a = new Array(n); for (let i = 0; i < n; i++) a[i] = readPayload(r, it, depth + 1); return a; }
    case 10: { const o = {}; for (;;) { const t = r.u8(); if (t === 0) break; const name = r.str(); o[name] = readPayload(r, t, depth + 1); } return o; }
    case 11: { const n = arrayLen(r); const a = new Array(n); for (let i = 0; i < n; i++) a[i] = r.i32(); return a; }
    case 12: { const n = arrayLen(r); const a = new Array(n); for (let i = 0; i < n; i++) a[i] = r.i64(); return a; }
    default: throw new Error("unknown nbt tag " + type);
  }
}
function parseNbtBytes(u8) {
  const r = new Reader(u8);
  if (r.u8() !== 10) throw new Error("root not compound");
  r.str(); // 根名
  return readPayload(r, 10);
}
async function gunzip(arrayBuffer) {
  const ds = new DecompressionStream("gzip");
  const stream = new Response(arrayBuffer).body.pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
// 入口:处理 gzip,返回 simplified 树
export async function parseNbtBuffer(arrayBuffer) {
  let u8 = new Uint8Array(arrayBuffer);
  if (u8.length >= 2 && u8[0] === 0x1f && u8[1] === 0x8b) u8 = await gunzip(arrayBuffer);
  return parseNbtBytes(u8);
}

// ---------- preview sanitize ----------
export function sanitizeNbtPreviewValue(value, depth = 0) {
  if (depth > 32) return "[Depth limit]";
  if (typeof value === "bigint") return `${value}n`;
  if (Array.isArray(value)) return value.slice(0, 512).map((v) => sanitizeNbtPreviewValue(v, depth + 1));
  if (value && typeof value === "object") {
    const out = {};
    let count = 0;
    for (const [k, v] of Object.entries(value)) {
      if (count >= 512) break;
      out[k] = sanitizeNbtPreviewValue(v, depth + 1);
      count++;
    }
    return out;
  }
  return value;
}

// ---------- 纹理 ----------
function normKey(v) {
  return String(v ?? "").replace(/^minecraft:/, "").replace(/^blocks?\//, "")
    .replace(/^textures\/blocks?\//, "").replace(/\.png$/, "");
}
function normModelKey(v) {
  return String(v ?? "").replace(/^minecraft:/, "").replace(/^models\//, "").replace(/^blocks?\//, "").replace(/\.json$/, "");
}
function resolveModelTextures(modelKey, seen = new Set()) {
  if (!MC) return {};
  const key = normModelKey(modelKey);
  if (!key || seen.has(key)) return {};
  seen.add(key);
  const model = MC.blocksModels?.[key];
  if (!model) return {};
  const parent = model.parent ? resolveModelTextures(model.parent, seen) : {};
  return { ...parent, ...(model.textures || {}) };
}
function resolveTexRef(map, key, depth = 0) {
  if (depth > 12) return "";
  const v = map?.[key];
  if (!v) return "";
  if (String(v).startsWith("#")) return resolveTexRef(map, String(v).slice(1), depth + 1);
  return normKey(v);
}
function texUrl(key) {
  return key ? `${TEX_BASE}/${encodeURIComponent(key)}.png` : "";
}
function buildTextureSet(blockName) {
  const name = normKey(blockName);
  if (!name) return null;
  let map = {}, direct = "";
  if (MC) {
    const entry = MC.blocks?.[name];
    map = resolveModelTextures(entry?.model || name);
    direct = normKey(entry?.texture);
  }
  const pick = (...cands) => {
    for (const cand of cands) {
      const k = resolveTexRef(map, cand);
      if (k) return k;
    }
    return direct || name; // 兜底:方块名当纹理名
  };
  const side = pick("side", "north", "south", "west", "east", "all", "texture", "particle", "end", "top", "bottom");
  const top = pick("top", "up", "end", "all", "texture", "side", "particle", "bottom");
  const bottom = pick("bottom", "down", "end", "all", "texture", "side", "particle", "top");
  const front = pick("front", "north", "side", "all", "texture", "particle", "top");
  return {
    top: texUrl(top), bottom: texUrl(bottom), side: texUrl(side),
    front: texUrl(front), back: texUrl(side), left: texUrl(side), right: texUrl(side),
    transparent: TRANSPARENT_RE.test(name),
  };
}

// ---------- 渲染模型 ----------
function numList(v) {
  if (!Array.isArray(v) || v.length < 3) return null;
  const out = v.slice(0, 3).map((n) => Number(n));
  if (out.some((n) => !Number.isFinite(n))) return null;
  return out.map((n) => Math.max(0, Math.trunc(n)));
}
function paletteEntries(preview) {
  if (Array.isArray(preview?.palette)) return preview.palette;
  if (Array.isArray(preview?.palettes?.[0])) return preview.palettes[0];
  return [];
}
export function extractWorkshopRenderModel(preview) {
  const size = numList(preview?.size);
  const blocksRaw = preview?.blocks;
  const paletteRaw = paletteEntries(preview);
  if (!size || !Array.isArray(blocksRaw) || !blocksRaw.length || !paletteRaw.length) return null;

  const palette = paletteRaw.map((entry, i) => {
    const name = (entry?.Name || entry?.name || `palette:${i}`).trim?.() || `palette:${i}`;
    return { index: i, name, textures: buildTextureSet(name) };
  });
  const isAir = (i) => AIR.has(normKey(palette[i]?.name));

  const blocks = [];
  let solidBlockCount = 0;
  for (const raw of blocksRaw) {
    const state = Math.trunc(Number(raw?.state));
    const pos = numList(raw?.pos);
    if (!Number.isFinite(state) || state < 0 || state >= palette.length || !pos) continue;
    if (isAir(state)) continue;
    solidBlockCount++;
    if (blocks.length >= RENDER_BLOCK_LIMIT) continue;
    blocks.push({ x: pos[0], y: pos[1], z: pos[2], state, name: palette[state]?.name || `palette:${state}` });
  }
  return {
    size, palette, paletteSize: palette.length,
    totalBlockCount: blocksRaw.length, solidBlockCount, renderedBlockCount: blocks.length,
    omittedBlockCount: Math.max(0, solidBlockCount - blocks.length),
    entityCount: preview?.entities?.length || 0,
    blocks,
  };
}
