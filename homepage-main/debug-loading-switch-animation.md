# Debug Session: loading-switch-animation [OPEN]

## 症状
- 点击切换后，只是闪了一下加载界面。
- 预期应为：点击后滑动进入 -> 转一圈 -> 滑动离开。

## 当前假设
1. 点击事件触发后，动画状态被过早重置。
2. 加载层样式在同一帧被连续覆盖，导致仅闪现。
3. 动画事件没有正确触发，后续阶段未继续执行。
4. 页面切换或卸载时机过早，导致动画尚未完成就被移除。

## 计划
1. 定位切换按钮、加载层、动画状态机代码。
2. 只增加运行时日志，记录点击、状态切换、类名变化、动画事件。
3. 请你复现一次，读取日志确认根因。
4. 基于证据做最小修复，并再次验证。

## 新证据
- 用户控制台出现 `net::ERR_ABORTED http://localhost:3000/download/main/...zip` 与 `net::ERR_ABORTED http://localhost:3000/api/debug/event`。
- `public/assets/app.js` 生成的站内下载按钮是普通 `<a href="/download/...">`，没有 `download` 或 `data-no-transition="1"`。
- `public/assets/site.js` 的 `isTransitionableLink()` 只排除了带 `download` 属性的链接，因此会把 `/download/...` 误判成跨页切换链接并执行 `preventDefault()` + `navigateWithTransition()`。
- 该误判会在下载时强行播放切换层，并在页面卸载阶段中止调试上报请求，因此控制台同时出现两个 `ERR_ABORTED`。

## 当前修复
- `public/assets/site.js` 已排除 `/download/` 与常见非文档资源链接，不再对下载类请求播放页面切换动画。
- `public/assets/app.js` 已给站内下载按钮补上 `data-no-transition="1"`，让按钮不再被切换拦截，同时继续保持服务端 `Content-Disposition` 的原有下载行为。

## 运行时结论
- 日志已确认真实跨页点击会命中 `click:transitionable`。
- 但之后没有出现 `navigate:prepare / pageTransition:show / pageTransition:spin`，而是直接进入 `navigate:reduced-motion`。
- 说明当前预览环境下 `prefers-reduced-motion: reduce` 为真，导致页面切换动画在导航前被整段短路，不是 CSS 动画阶段闪退。

## 追加修复
- `public/assets/site.js` 已移除页面切换动画对 `prefers-reduced-motion` 的直接短路，确保跨页切换仍会执行“滑入 -> 转圈 -> 滑出”链路。
- 新日志表明 JS 状态机已完整跑通：`navigate:prepare -> pageTransition:show -> pageTransition:spin -> navigate:fire -> entryTransition:start -> hide/leave/hidden` 全部存在。
- 但 `overlay:transition* / overlay:animation*` 仍然为 0，继续证明不是 JS 问题，而是样式层没有真正触发过渡/动画事件。
- 已在 `public/assets/styles.css` 的 `@media (prefers-reduced-motion: reduce)` 中给 `.page-transition` 单独恢复过渡与 spinner 动画，让其它动效仍保持 reduced-motion 行为。
- 用户反馈“切到另一个页面会卡一下再继续转”，日志对应为：新页 `pageTransition:show` 后要再等 `PAGE_TRANSITION_ENTER_MS(520ms)` 才开始 `pageTransition:spin`。
- 已将新页入场阶段改为 `show` 后立即 `spin`，并把隐藏时机改为 `PAGE_TRANSITION_SPIN_MS + PAGE_TRANSITION_HOLD_MS`，保持总展示时长不变但去掉中间停顿。
- 用户再次反馈“还是会卡”，结合 HTML 结构确认：各页的 `site.js` 都放在 `body` 底部，意味着新页虽然很快进入 `entryTransition:start`，但在模块执行前仍存在一个首屏接管空窗。
- 已在所有带 `#page-transition` 的 HTML 页面里，把一个同步桥接脚本插到加载层后面；只要检测到 `sessionStorage.page-transition-pending`，就会在页面解析早期立刻显示并旋转 overlay。
- `public/assets/site.js` 的 `runEntryTransition()` 也已支持“续播模式”：如果新页一开始就已经是 `is-spinning` 状态，则直接续播并等待隐藏，不再重新 `show/spin` 一次导致重置。
- 最新日志已出现 `entryTransition:continued`，说明桥接与续播都已生效；“卡一下”不再是 overlay 没接上，而更像新页页面脚本初始化抢占主线程。
- 已在 `public/assets/app.js`、`developer.js`、`feedback.js`、`gallery.js`、`admin.js` 顶部增加 `waitForPageTransition`，并统一等待 `window.__SITE_PAGE_TRANSITION_DONE` 后再启动页面初始化。
- `public/assets/site.js` 现在会在切换层显示时标记 busy、隐藏完成时 resolve；这样页面私有脚本会在 overlay 退场后再跑，避免转圈过程被页面初始化卡顿打断。
