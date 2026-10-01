// 把 src/index.js(Hono 应用)打包成 dist/index.js,作为 Workers(+静态资源)入口。
import { build } from "esbuild";

// Workers 运行时(nodejs_compat)提供的 Node 内建模块。裸引用(prismarine-nbt 依赖)重写为 node: 前缀并外置。
const NODE_BUILTINS = new Set([
  "assert", "async_hooks", "buffer", "crypto", "diagnostics_channel", "events", "net",
  "path", "process", "stream", "string_decoder", "url", "util", "zlib", "tls", "dns",
]);
const nodeCompatPlugin = {
  name: "node-builtins-external",
  setup(b) {
    b.onResolve({ filter: /^(node:)?[a-z_]+$/ }, (args) => {
      const bare = args.path.replace(/^node:/, "");
      if (NODE_BUILTINS.has(bare)) return { path: `node:${bare}`, external: true };
      return null;
    });
  },
};

await build({
  entryPoints: ["src/index.js"],
  outfile: "dist/index.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "esnext",
  sourcemap: true,
  conditions: ["workerd", "worker", "browser", "import", "module", "default"],
  mainFields: ["module", "browser", "main"],
  external: ["cloudflare:*", "node:*"],
  plugins: [nodeCompatPlugin],
  // CJS 依赖(prismarine-nbt)用 require("node:zlib") 等;用 createRequire 提供顶层 require,
  // esbuild 的 __require 会委托给它(解决 "Dynamic require not supported")。
  banner: {
    js: [
      "import { createRequire as __nsukCreateRequire } from 'node:module';",
      "const require = __nsukCreateRequire('file:///worker');",
    ].join("\n"),
  },
  logLevel: "info",
});

console.log("✓ built dist/index.js");
