# TMS Web Demo

司机端 H5 小程序演示 + PC 运营后台演示，基于同一份 mock 数据模拟场站、分时电价、地图配置和司机反馈联动。

## 演示入口

- `/driver`：司机端 H5，小程序体验复刻现有 iOS 原型。
- `/admin`：运营后台，包含运营总览、场站管理、配置、反馈和联动数据。
- `/`：入口选择页。

## 本地运行

```bash
npm install
npm run dev
```

## Netlify 部署

如果 GitHub 仓库里保留当前目录结构，在 Netlify 新建站点时使用：

- Base directory: `TMSWebDemo`
- Build command: `npm run build`
- Publish directory: `TMSWebDemo/dist`

如果只把 `TMSWebDemo` 单独作为仓库根目录：

- Base directory: 留空
- Build command: `npm run build`
- Publish directory: `dist`

`netlify.toml` 已配置 SPA fallback，刷新 `/driver` 和 `/admin` 不会 404。

## 数据联动

当前 mock 数据集中在 `src/App.jsx`：

- `initialStations`：后台维护的场站基础信息，司机端只展示状态为“正常”的场站。
- `pricePeriods`：分时电价。
- `stayDurations`：标准停留时长。
- `mapConfigDefault`：距离排名、SOC 阈值、刷新频率。
- `initialFeedback`：司机端反馈，后台反馈队列读取同一份数据。

后续接真实后台时，优先把这些 mock 数据替换为 API 请求，不需要重做页面结构。
