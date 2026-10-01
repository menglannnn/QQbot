# [OPEN] 页面切换加载层卡顿调试

## Session
- sessionId: `page-transition-stutter`
- 日期: `2026-06-06`
- 症状: 页面切换时加载层已经出现滑动和转动，但切到新页面会短暂停一下再继续。

## 当前假设
1. 新页首屏阶段仍有同步重任务，占用了主线程，导致 spinner 动画在文档切换后短暂停顿。
2. 新页顶部桥接脚本与 `site.js` 的接管时序仍存在一次状态重置，导致 overlay 连续性被打断。
3. 纯色遮罩或 `.page-transition` 的样式还没有完整生效，浏览器在切页后触发了一次重绘抖动。
4. 各页面入口脚本里等待切换完成的逻辑不一致，某些页面仍在 overlay 退场前启动重模块。
5. 当前浏览器实际命中了旧缓存资源，导致页面之间混用了不同版本的切换逻辑。

## 计划
1. 先核对当前 `site.js`、`styles.css`、`app.js`、`developer.js`、`admin.js` 等入口脚本现状。
2. 再检查诊断结果与页面资源版本引用是否一致。
3. 只在证据明确后再做最小修复。

## 证据
- 现有调试日志 `trae-debug-log-loading-switch-animation.ndjson` 显示，目标页 `pageTransition:show` 到 `hideScheduled` 常见持续时间约 `2603ms ~ 3123ms`。
- 当前样式里 `.page-transition.is-spinning .page-transition__spinner circle` 仅配置了 `pageTransitionSpin 0.72s linear 1`，也就是只转一圈。
- 由此可证伪/确认：即使 JS 状态机和 bridge 都接上了，spinner 仍会在 overlay 可见期间提前停住，视觉上就会出现“卡一下再继续/停一下”。
- 同时检查到所有页面仍在引用 `styles.css?v=20260606-05`，说明样式层修复可能没有稳定命中浏览器缓存。

## 已修复
1. 将 spinner 动画从单次播放改为可见期间持续播放。
2. 给 spinner 补 `will-change`，减少动画期间的样式抖动。
3. 将所有页面的 `styles.css` 版本统一提升到 `v=20260606-08`，避免继续命中旧缓存。
