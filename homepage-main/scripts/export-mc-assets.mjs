// P5:从 minecraft-assets 包导出 1.21.8 的方块/模型元数据 + 纹理 PNG。
// 产物:
//   src/generated/mc-blocks.js          (元数据,打进 worker bundle,供 NBT 渲染解析)
//   public/vendor/mc/1.21.8/blocks/*.png (静态纹理,Pages CDN 提供)
// 用法:node scripts/export-mc-assets.mjs
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync, cpSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const VERSION = "1.21.8";
const ma = require("minecraft-assets")(VERSION);

// 1) 元数据
const meta = { blocks: ma.blocks, blocksModels: ma.blocksModels };
mkdirSync("src/generated", { recursive: true });
writeFileSync("src/generated/mc-blocks.js", `export default ${JSON.stringify(meta)};\n`, "utf-8");
const metaSize = (JSON.stringify(meta).length / 1024).toFixed(0);
console.log(`✓ src/generated/mc-blocks.js (${metaSize} KB, blocks=${Object.keys(ma.blocks).length}, models=${Object.keys(ma.blocksModels).length})`);

// 2) 纹理 PNG
const pkgRoot = path.dirname(require.resolve("minecraft-assets/package.json"));
const blocksDir = path.join(pkgRoot, "minecraft-assets", "data", VERSION, "blocks");
const destDir = path.join("public", "vendor", "mc", VERSION, "blocks");
if (!existsSync(blocksDir)) {
  console.error("✘ 纹理目录不存在:", blocksDir);
  process.exit(1);
}
mkdirSync(destDir, { recursive: true });
cpSync(blocksDir, destDir, { recursive: true });
const count = readdirSync(destDir).filter((f) => f.endsWith(".png")).length;
console.log(`✓ ${destDir} (${count} textures)`);

// 3) three.js 库(NBT 预览 nbt-viewer.js 用):复制到 public/vendor/three
const threeBuild = path.join("node_modules", "three", "build");
const threeDest = path.join("public", "vendor", "three");
mkdirSync(threeDest, { recursive: true });
let threeCopied = 0;
for (const f of ["three.module.js", "three.core.js", "three.module.min.js", "three.core.min.js"]) {
  const src = path.join(threeBuild, f);
  if (existsSync(src)) { cpSync(src, path.join(threeDest, f)); threeCopied++; }
}
console.log(`✓ ${threeDest} (${threeCopied} three.js files)`);
