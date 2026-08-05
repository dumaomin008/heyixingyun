# 合一星运 项目长期笔记

## 项目定位
TMS（运输管理）原型仓库，名义包名 `tmswebdemo`。三端共存于一个 Vite + React 19 单页应用，hash 路由分发：
- `/#/driver` → 司机端 H5（iPhone 17 逻辑分辨率 402×874，`.phone-frame` 含边框 422×894）
- `/#/fleet` → 车队长端交互原型（最终交付形态是 uni-app 微信小程序，H5 仅原型）
- `/#/admin*` → iframe 嵌入 `public/admin/index.html`，即从 `/Users/dmm/Desktop/环线/` 同步来的原生 JS 后台

## 技术栈与运行
- 前端：React 19 + Vite 6 + lucide-react，源码集中在 `src/App.jsx`（约 1900 行）与 `src/styles.css`（约 7100 行）
- 后台 API：`admin-server/server.js`，纯 Node 零依赖 HTTP 服务，默认端口 3100（`ADMIN_API_PORT`）
- 数据持久化：`data/app.json`（fences 68 / trips 12 / tripSummaries 12 / districts 2 / stations 5），`admin-server/db.js` 读写
- `npm run dev` = `scripts/dev.mjs`，同时拉起 admin API 与 Vite；Vite 把 `/api` 代理到 API 端口
- `npm run sync:admin -- /Users/dmm/Desktop/环线` 从只读源同步后台副本并做补丁改写
- 地图：高德，key 硬编码在 `src/App.jsx` 顶部 `AMAP_KEY`

## 关键 API
`/api/health`、`/api/fences`(CRUD)、`/api/trips`、`/api/trip-details`、`/api/fare-settings`、`/api/districts`、`/api/stations`（本地扩展，见 `admin-server/station-routes.js`）

## 车队长端现状（原型）
`FleetLeaderApp` 内含：监控地图 / 首页概览 / 我的、车辆详情、告警列表、轨迹回放、行车与充电日志、实时数据页。mock 数据 `fleetVehicles`（6 台，云F 车牌，玉溪红塔区一带）。
产品路线规划见 `车队长小程序产品路线规划.md`：阶段 0 数据基线 → MVP 监控闭环 → 迭代一追溯 → 迭代二异常管理 → 迭代三经营分析。

## 硬约束（详见 AGENTS.md）
- `/Users/dmm/Desktop/环线/` 是只读源，禁止修改
- 司机端保留；电子围栏/地址池/识别规则配置页已移除，圈统计报表只展示结果
- 车队长 MVP 范围：首页概览 → 监控地图/搜索 → 车辆信息窗 → 车辆实时详情 + SOC 过低/离线预警；轨迹、日志、日报等归入后续迭代
- 车队长监控页视觉基准图：`/Users/dmm/.codex/generated_images/019f700c-0a9c-7cf2-b900-b41881d0519e/exec-75be81c1-439f-4eb1-b3ce-a0b7cfd43847.png`

## 其他
- `design-qa.md` 记录视觉走查结论（后台 shell 还原、车队长监控方案一，均 passed）
- git 历史仅 2 次提交，最新 `1e5a53a`
