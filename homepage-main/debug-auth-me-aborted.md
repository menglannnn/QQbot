# [OPEN] auth-me-aborted

## 症状
- 浏览器请求 `http://localhost:3000/api/auth/me` 出现 `net::ERR_ABORTED`

## 假设
- 假设 1：本地服务没有稳定运行，导致请求在连接阶段被中断
- 假设 2：前端页面切换或脚本主动取消了 `/api/auth/me` 请求
- 假设 3：服务端在处理 `/api/auth/me` 时抛错，连接被异常终止
- 假设 4：浏览器扩展、缓存或重复导航导致该请求被浏览器层中断

## 计划
- 先复现并收集运行时证据
- 只添加调试埋点，不先改业务逻辑
- 根据日志确认根因后再做最小修复

## 证据
- `site.js:loadCurrentUser:start`：首页确实发起了 `/api/auth/me`
- `server.js:/api/auth/me:start`：服务端已收到该请求
- `site.js:loadCurrentUser:response`：前端已收到 `200 OK`

## 初步结论
- 假设 1 否定：服务未宕掉，接口成功返回
- 假设 2 暂未直接命中：当前证据未显示 fetch 在前端抛出异常
- 假设 3 否定：服务端未在 `/api/auth/me` 处理阶段异常断开
- 假设 4 当前最可能：预览页切换、刷新或浏览器层导航中断导致 DevTools 记为 `ERR_ABORTED`
