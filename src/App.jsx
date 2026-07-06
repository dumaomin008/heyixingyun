import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const AMAP_KEY = "2e9013c7c076a1baec170c986d477a8b";
let amapLoaderPromise;

const pricePeriods = [
  { start: "00:00", end: "08:00", price: "0.76 元/度" },
  { start: "08:00", end: "18:00", price: "0.88 元/度" },
  { start: "18:00", end: "24:00", price: "0.82 元/度" },
];

const stayDurations = [
  { start: "00:00", end: "08:00", duration: "40 分钟" },
  { start: "08:00", end: "18:00", duration: "50 分钟" },
  { start: "18:00", end: "24:00", duration: "45 分钟" },
];

const stationPositions = {
  ST001: { left: "38%", top: "51%" },
  ST002: { left: "63%", top: "43%" },
  ST003: { left: "22%", top: "35%" },
  ST004: { left: "74%", top: "60%" },
  ST005: { left: "18%", top: "64%" },
};

const routePoints = {
  vehicle: [102.545, 24.337],
  pickup: [102.72, 24.54],
  dropoff: [102.34, 24.08],
};

const routePaths = {
  travelled: [
    routePoints.dropoff,
    [102.39, 24.16],
    [102.45, 24.235],
    [102.505, 24.295],
    routePoints.vehicle,
  ],
  remaining: [
    routePoints.vehicle,
    [102.61, 24.34],
    [102.66, 24.405],
    [102.695, 24.475],
    routePoints.pickup,
  ],
};

const stageRoutes = {
  toPickup: {
    travelledBase: routePaths.travelled,
    active: routePaths.remaining,
    startProgress: 0,
    speed: 0.000005,
  },
  toDropoff: {
    travelledBase: [],
    active: [
      routePoints.pickup,
      [102.695, 24.475],
      [102.66, 24.405],
      [102.61, 24.34],
      [102.545, 24.28],
      [102.48, 24.22],
      [102.42, 24.15],
      routePoints.dropoff,
    ],
    startProgress: 0,
    speed: 0.000005,
  },
};

const MAP_VEHICLE_ZOOM = 13.2;
const MAP_VEHICLE_PADDING = [210, 80, 90, 40];
const MAP_ROUTE_PADDING = [196, 88, 40, 72];
const MAP_OVERVIEW_MAX_ZOOM = 13;
const MAP_OVERVIEW_MIN_ZOOM = 11.5;
const MAP_LOW_SOC_MAX_ZOOM = 12.5;
const MAP_NO_LOCATION_MAX_ZOOM = 11;
const MAP_TASK_OVERVIEW_MAX_ZOOM = 13;
const VEHICLE_MARKER_SIZE = 44;

const taskStages = {
  toPickup: {
    label: "前往装货点",
    helper: "展示车辆、装货点、卸货点、已走轨迹和剩余路线",
    destination: "云南省玉溪市红塔区研和街道",
    action: "离开装货点",
    next: "toDropoff",
  },
  toDropoff: {
    label: "前往卸货点",
    helper: "路线切换为装货点到卸货点，继续自动刷新",
    destination: "云南省玉溪市江川区大街街道",
    action: "离开卸货点",
    next: "completed",
  },
  completed: {
    label: "任务完成",
    helper: "任务路线和轨迹已清除，仅展示车辆当前位置与正常场站",
    destination: "暂无进行中任务",
    action: "重新去运输",
    next: "toPickup",
  },
};

const initialStations = [
  {
    id: "ST001",
    code: "CS000236",
    name: "玉溪红塔研和重卡充电站",
    shortName: "研和重卡站",
    address: "云南省玉溪市红塔区研和街道物流园区旁",
    province: "云南省",
    city: "玉溪市",
    district: "红塔区",
    lng: 102.5068,
    lat: 24.3078,
    priceText: "0.82 元/度",
    capacityText: "50 吨",
    pileCount: 6,
    availablePiles: 6,
    totalPiles: 6,
    drivingKm: 8.6,
    straightKm: 7.8,
    durationMin: 16,
    routeNearbyFlag: true,
    speedLabel: "快充",
    status: "正常",
    validation: "已校验",
    remark: "靠近研和物流园，货车通道宽，场内可停靠重卡；夜间照明充足，入口限高 4.5m。",
    updatedAt: "2026-07-05 11:20",
  },
  {
    id: "ST002",
    code: "CS000235",
    name: "红塔区九龙池物流充电站",
    shortName: "九龙池站",
    address: "云南省玉溪市红塔区九龙路货运停车区",
    province: "云南省",
    city: "玉溪市",
    district: "红塔区",
    lng: 102.5436,
    lat: 24.3864,
    priceText: "0.88 元/度",
    capacityText: "49 吨",
    pileCount: 5,
    availablePiles: 3,
    totalPiles: 5,
    drivingKm: 9.8,
    straightKm: 8.4,
    durationMin: 14,
    routeNearbyFlag: true,
    speedLabel: "快充",
    status: "正常",
    validation: "已校验",
    remark: "靠近主城区北侧货运停车区，进站需从辅道右转，重车掉头空间充足。",
    updatedAt: "2026-07-05 11:08",
  },
  {
    id: "ST003",
    code: "CS000234",
    name: "玉溪北城货运补能站",
    shortName: "北城补能站",
    address: "云南省玉溪市红塔区北城街道玉丰路旁",
    province: "云南省",
    city: "玉溪市",
    district: "红塔区",
    lng: 102.5358,
    lat: 24.4246,
    priceText: "暂无价格",
    capacityText: "45 吨",
    pileCount: 4,
    availablePiles: 2,
    totalPiles: 4,
    drivingKm: null,
    straightKm: 13.2,
    durationMin: 22,
    routeNearbyFlag: false,
    speedLabel: "快充",
    status: "正常",
    validation: "待补价格",
    remark: "北向任务可就近补能，入口较窄，建议低速进站，场内可临停。",
    updatedAt: "2026-07-05 09:12",
  },
  {
    id: "ST004",
    code: "CS000233",
    name: "江川大街公共充电站",
    shortName: "江川大街站",
    address: "云南省玉溪市江川区大街街道星云路",
    province: "云南省",
    city: "玉溪市",
    district: "江川区",
    lng: 102.6846,
    lat: 24.2956,
    priceText: "0.76 元/度",
    capacityText: "暂无承载量",
    pileCount: 2,
    availablePiles: 0,
    totalPiles: 2,
    drivingKm: 18.4,
    straightKm: 15.8,
    durationMin: 31,
    routeNearbyFlag: false,
    speedLabel: "慢充",
    status: "停用",
    validation: "重卡风险",
    remark: "乘用车场地为主，重卡进出需现场确认。",
    updatedAt: "2026-07-05 10:30",
  },
  {
    id: "ST005",
    code: "CS000232",
    name: "峨山小街货运充电站",
    shortName: "峨山小街站",
    address: "云南省玉溪市峨山县小街街道货运通道旁",
    province: "云南省",
    city: "玉溪市",
    district: "峨山县",
    lng: 102.4188,
    lat: 24.2054,
    priceText: "0.91 元/度",
    capacityText: "55 吨",
    pileCount: 6,
    availablePiles: 4,
    totalPiles: 6,
    drivingKm: 24.7,
    straightKm: 21.9,
    durationMin: 38,
    routeNearbyFlag: false,
    speedLabel: "快充",
    status: "正常",
    validation: "已校验",
    remark: "靠近峨山货运通道，适合南向任务中途补能。",
    updatedAt: "2026-07-05 10:05",
  },
];

const initialFeedback = [
  {
    id: "FB20260705001",
    stationId: "ST004",
    stationName: "江川大街公共充电站",
    type: "重卡无法进入",
    remark: "入口较窄，建议后台停用或标注风险。",
    driver: "DR001",
    vehicle: "云A12345",
    task: "TK20260705001",
    status: "待处理",
    submittedAt: "2026-07-05 10:26",
    handler: "",
  },
  {
    id: "FB20260705002",
    stationId: "ST003",
    stationName: "玉溪北城货运补能站",
    type: "价格不一致",
    remark: "现场价格显示和小程序不同。",
    driver: "DR014",
    vehicle: "云A90872",
    task: "TK20260705007",
    status: "处理中",
    submittedAt: "2026-07-05 11:02",
    handler: "运营-李",
  },
];

const context = {
  plateNo: "云A12345",
  trailerPlateNo: "云A1234挂",
  driverId: "DR001",
  taskId: "TK20260705001",
  phoneLocation: "手机定位可用",
  vehicleLocation: "车辆定位 42 秒前",
};

const mapConfigDefault = {
  rankLimit: 3,
  lowSocThreshold: 30,
  criticalSocThreshold: 15,
  autoRefreshSeconds: 30,
  manualRefreshCooldownSeconds: 10,
};

function mapStationPriceLabel(station) {
  if (station.priceText.includes("暂无")) return "暂无价格";
  const match = station.priceText.match(/([\d.]+)/);
  return match ? `${match[1]}元/度` : station.priceText;
}

function buildStationMarkerHtml(station, selected) {
  return `
    <button type="button" draggable="false" data-station-id="${station.id}" class="map-charge-marker ${selected ? "selected" : ""} ${station.distanceType === "none" ? "no-location" : ""}" aria-label="${station.name}，${mapStationPriceLabel(station)}，${station.distanceText}">
      <span class="charge-pin"><b>⚡</b></span>
      <span class="charge-info-card">
        <b class="charge-price">${mapStationPriceLabel(station)}</b>
        <small class="charge-distance">${station.distanceText}</small>
      </span>
    </button>
  `;
}

function isMapOverlayTarget(target) {
  return Boolean(target?.closest?.(".map-charge-marker, .map-vehicle-alert, .map-task-marker"));
}

function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function navigateToStationDetail(stationId, backPath = "/driver/list") {
  sessionStorage.setItem("driverDetailBack", backPath);
  navigate(`/driver/station/${stationId}`);
}

function navigateFromStationDetailBack() {
  const backPath = sessionStorage.getItem("driverDetailBack") || "/driver/list";
  sessionStorage.removeItem("driverDetailBack");
  navigate(backPath);
}

function returnToDriverMap({ selectedId, panel } = {}) {
  if (selectedId) {
    sessionStorage.setItem("driverSelectedId", selectedId);
  }
  if (panel) {
    sessionStorage.setItem("driverPanel", panel);
  }
  navigate("/driver");
}

function loadAmap() {
  if (window.AMap) {
    return Promise.resolve(window.AMap);
  }
  if (amapLoaderPromise) {
    return amapLoaderPromise;
  }

  amapLoaderPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("amap-js-sdk");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.AMap));
      existing.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.id = "amap-js-sdk";
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.Scale,AMap.ToolBar`;
    script.async = true;
    script.onload = () => resolve(window.AMap);
    script.onerror = () => reject(new Error("高德地图脚本加载失败"));
    document.head.appendChild(script);
  });

  return amapLoaderPromise;
}

function getStationRuntime(station, locationMode) {
  if (locationMode === "none") {
    return { ...station, distanceType: "none", distanceValue: null, distanceText: "定位后可查看" };
  }
  if (station.drivingKm == null) {
    return { ...station, distanceType: "straight", distanceValue: station.straightKm, distanceText: `约${station.straightKm}km` };
  }
  const drift = locationMode === "phone" ? 0.6 : 0;
  const value = Number((station.drivingKm + drift).toFixed(1));
  return { ...station, distanceType: "driving", distanceValue: value, distanceText: `${value}km` };
}

function sortStations(stations, locationMode) {
  const visible = stations.filter((station) => station.status === "正常" && station.lng && station.lat);
  if (locationMode === "none") {
    return [...visible].sort((a, b) => `${a.province}${a.city}${a.name}`.localeCompare(`${b.province}${b.city}${b.name}`));
  }
  return visible.sort((a, b) => getStationRuntime(a, locationMode).distanceValue - getStationRuntime(b, locationMode).distanceValue);
}

function getFullRoutePath(taskStage) {
  const stage = stageRoutes[taskStage];
  if (!stage) return [];
  if (stage.travelledBase?.length) {
    return [...stage.travelledBase.slice(0, -1), ...stage.active];
  }
  return stage.active;
}

function fitMapWithZoomClamp(map, overlays, padding, maxZoom, minZoom) {
  if (!overlays.length) return;
  map.setFitView(overlays, false, padding, maxZoom);
  if (minZoom != null) {
    const zoom = map.getZoom();
    if (zoom < minZoom) {
      map.setZoom(minZoom);
    }
  }
}

function fitChargingOverview(map, overlays, {
  padding,
  locationMode,
  taskStage,
  rankCount,
  vehicleMarker,
  lowSoc,
}) {
  const stationMarkers = overlays.filter((overlay) => overlay.getExtData?.() === "station");

  if (locationMode === "none") {
    fitMapWithZoomClamp(
      map,
      stationMarkers.length ? stationMarkers : overlays,
      padding,
      MAP_NO_LOCATION_MAX_ZOOM,
      MAP_OVERVIEW_MIN_ZOOM,
    );
    return;
  }

  const fitTargets = [];
  if (vehicleMarker) fitTargets.push(vehicleMarker);
  fitTargets.push(...stationMarkers.slice(0, rankCount));

  if (isTaskRunning(taskStage)) {
    const routeOverlays = overlays.filter((overlay) => {
      const type = overlay.getExtData?.();
      return type === "route" || type === "task";
    });
    fitTargets.push(...routeOverlays);
  }

  if (!fitTargets.length) return;

  const maxZoom = lowSoc
    ? MAP_LOW_SOC_MAX_ZOOM
    : isTaskRunning(taskStage)
      ? MAP_TASK_OVERVIEW_MAX_ZOOM
      : MAP_OVERVIEW_MAX_ZOOM;

  fitMapWithZoomClamp(map, fitTargets, padding, maxZoom, MAP_OVERVIEW_MIN_ZOOM);
}

function fitRouteOverview(map, AMap, taskStage, overlays, padding) {
  const fullPath = getFullRoutePath(taskStage);
  const taskMarkers = overlays.filter((overlay) => overlay.getExtData?.() === "task");

  if (fullPath.length < 2) {
    const routeOverlays = overlays.filter((overlay) => {
      const type = overlay.getExtData?.();
      return type === "route" || type === "task";
    });
    if (routeOverlays.length) {
      map.setFitView(routeOverlays, false, padding, 12);
    }
    return;
  }

  const fitLine = new AMap.Polyline({
    path: fullPath,
    strokeOpacity: 0,
    strokeWeight: 1,
    zIndex: 1,
  });
  const fitOverlays = [...taskMarkers, fitLine];
  map.add(fitLine);
  map.setFitView(fitOverlays, false, padding, 12);
  map.remove(fitLine);
}

function isTaskRunning(stage) {
  return stage === "toPickup" || stage === "toDropoff";
}

function pathSegmentLength(start, end) {
  return Math.hypot(end[0] - start[0], end[1] - start[1]);
}

function pathTotalLength(points) {
  return points.slice(0, -1).reduce((total, point, index) => total + pathSegmentLength(point, points[index + 1]), 0);
}

function interpolateAlongPath(points, progress) {
  const clamped = Math.min(1, Math.max(0, progress));
  const total = pathTotalLength(points);
  if (total === 0) return points[0];

  const target = total * clamped;
  let walked = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const segment = pathSegmentLength(start, end);
    if (walked + segment >= target) {
      const ratio = (target - walked) / segment;
      return [start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio];
    }
    walked += segment;
  }

  return points[points.length - 1];
}

function buildRouteGeometry(fullPath, progress) {
  const position = interpolateAlongPath(fullPath, progress);
  const travelled = [fullPath[0]];
  const total = pathTotalLength(fullPath);
  const target = total * Math.min(1, Math.max(0, progress));
  let walked = 0;
  let splitIndex = fullPath.length - 1;

  for (let index = 0; index < fullPath.length - 1; index += 1) {
    const segment = pathSegmentLength(fullPath[index], fullPath[index + 1]);
    if (walked + segment >= target) {
      travelled.push(position);
      splitIndex = index + 1;
      break;
    }
    travelled.push(fullPath[index + 1]);
    walked += segment;
  }

  if (travelled.length === 1 || (travelled[travelled.length - 1][0] !== position[0] || travelled[travelled.length - 1][1] !== position[1])) {
    travelled.push(position);
  }

  const remaining = [position, ...fullPath.slice(splitIndex)];

  return { vehiclePosition: position, travelled, remaining };
}

function getRouteGeometry(taskStage, routeProgress) {
  if (!isTaskRunning(taskStage)) {
    return {
      vehiclePosition: routePoints.dropoff,
      travelled: [],
      remaining: [],
    };
  }

  const stage = stageRoutes[taskStage];
  const activeGeometry = buildRouteGeometry(stage.active, routeProgress);

  if (!stage.travelledBase.length) {
    return activeGeometry;
  }

  return {
    vehiclePosition: activeGeometry.vehiclePosition,
    travelled: [...stage.travelledBase.slice(0, -1), ...activeGeometry.travelled],
    remaining: activeGeometry.remaining,
  };
}

export function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [stations, setStations] = useState(initialStations);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [mapConfig, setMapConfig] = useState(mapConfigDefault);
  const [taskStage, setTaskStage] = useState("toPickup");
  const [locationMode, setLocationMode] = useState("vehicle");
  const [soc, setSoc] = useState(28);
  const [lastSync, setLastSync] = useState("13:40:18");

  window.onpopstate = () => setPath(window.location.pathname);

  const shared = {
    stations,
    setStations,
    feedback,
    setFeedback,
    mapConfig,
    setMapConfig,
    taskStage,
    setTaskStage,
    locationMode,
    setLocationMode,
    soc,
    setSoc,
    lastSync,
    setLastSync,
  };

  if (path.startsWith("/admin")) {
    return <AdminApp {...shared} />;
  }

  if (path.startsWith("/driver")) {
    return <DriverApp path={path} {...shared} />;
  }

  return <LaunchHub />;
}

function LaunchHub() {
  return (
    <main className="launch">
      <section className="launch-panel">
        <p className="eyebrow">TMS 场站路线规划 · 第一期</p>
        <h1>业务状态型交互原型</h1>
        <p>
          基于 PRD 构建司机端地图找站与 PC 后台维护闭环。你可以切换定位、任务、SOC、场站启停、
          地图配置、导航失败和反馈处理状态，观察两端联动。
        </p>
        <div className="launch-actions">
          <button className="primary-btn" onClick={() => navigate("/driver")}>打开司机端 H5</button>
          <button className="secondary-btn" onClick={() => navigate("/admin")}>打开运营后台</button>
        </div>
      </section>
    </main>
  );
}

function DriverApp({
  path = "/driver",
  stations,
  feedback,
  setFeedback,
  mapConfig,
  taskStage,
  setTaskStage,
  locationMode,
  setLocationMode,
  soc,
  setSoc,
  lastSync,
  setLastSync,
}) {
  const isListPage = path === "/driver/list";
  const isDetailPage = path.startsWith("/driver/station/");
  const detailStationId = isDetailPage ? path.slice("/driver/station/".length) : "";
  const isMapVisible = !isListPage && !isDetailPage;

  const driverStations = useMemo(() => sortStations(stations, locationMode), [stations, locationMode]);
  const runtimeStations = useMemo(() => driverStations.map((station) => getStationRuntime(station, locationMode)), [driverStations, locationMode]);
  const ranked = locationMode === "none" ? [] : runtimeStations.slice(0, mapConfig.rankLimit);
  const [mapView, setMapView] = useState("vehicle");
  const [vehicleZoomMode, setVehicleZoomMode] = useState("street");
  const [followVehicle, setFollowVehicle] = useState(true);
  const [recenterTick, setRecenterTick] = useState(0);
  const [routeProgress, setRouteProgress] = useState(stageRoutes.toPickup.startProgress);
  const [selectedId, setSelectedId] = useState(runtimeStations[0]?.id ?? stations[0].id);
  const [panel, setPanel] = useState("collapsed");
  const [toast, setToast] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [feedbackType, setFeedbackType] = useState("重卡无法进入");
  const [feedbackRemark, setFeedbackRemark] = useState("");
  const selected = runtimeStations.find((station) => station.id === selectedId) ?? runtimeStations[0];
  const task = taskStages[taskStage];
  const severity = soc <= mapConfig.criticalSocThreshold ? "critical" : soc <= mapConfig.lowSocThreshold ? "low" : "ok";
  const handleMapBlankClick = useCallback(() => setPanel("collapsed"), []);
  const handleAmapStationClick = useCallback((stationId) => {
    setSelectedId(stationId);
    setPanel("station");
    setFollowVehicle(false);
  }, []);
  const handleMapUserInteract = useCallback(() => setFollowVehicle(false), []);

  const routeGeometry = useMemo(
    () => getRouteGeometry(taskStage, routeProgress),
    [taskStage, routeProgress],
  );

  useEffect(() => {
    const pendingPanel = sessionStorage.getItem("driverPanel");
    const pendingSelectedId = sessionStorage.getItem("driverSelectedId");
    if (pendingPanel || pendingSelectedId) {
      if (pendingSelectedId) {
        setSelectedId(pendingSelectedId);
      }
      if (pendingPanel) {
        setPanel(pendingPanel);
      }
      sessionStorage.removeItem("driverPanel");
      sessionStorage.removeItem("driverSelectedId");
    }
  }, []);

  useEffect(() => {
    setRouteProgress(stageRoutes[taskStage]?.startProgress ?? 1);
  }, [taskStage]);

  useEffect(() => {
    if (!isTaskRunning(taskStage)) return undefined;

    const stage = stageRoutes[taskStage];
    let frameId = 0;
    let lastTime = performance.now();

    function tick(now) {
      const delta = now - lastTime;
      lastTime = now;
      setRouteProgress((current) => Math.min(1, current + stage.speed * delta));
      frameId = window.requestAnimationFrame(tick);
    }

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [taskStage]);

  function showToast(text) {
    setToast(text);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 2600);
  }

  function syncData() {
    if (cooldown) {
      showToast(`刷新太频繁，请等待 ${mapConfig.manualRefreshCooldownSeconds} 秒限制结束`);
      return;
    }
    setRefreshing(true);
    setCooldown(true);
    showToast("正在同步车辆定位、SOC、任务路线、场站与排名");
    window.setTimeout(() => {
      setRefreshing(false);
      setLastSync("13:41:06");
      setSoc((value) => Math.max(12, value - 2));
      showToast(`刷新完成：正常场站 ${driverStations.length} 个，排名 ${ranked.length || "无定位"} 个`);
    }, 850);
    window.setTimeout(() => setCooldown(false), 2200);
  }

  function submitDriverFeedback() {
    setFeedback((items) => [
      {
        id: `FB${Date.now()}`,
        stationId: selected.id,
        stationName: selected.name,
        type: feedbackType,
        remark: feedbackRemark || "司机未填写备注",
        driver: context.driverId,
        vehicle: context.plateNo,
        task: context.taskId,
        status: "待处理",
        submittedAt: "2026-07-05 13:41",
        handler: "",
      },
      ...items,
    ]);
    setPanel("station");
    setFeedbackRemark("");
    showToast(`反馈已同步至后台：${feedbackType}`);
  }

  function advanceTask() {
    setTaskStage(task.next);
    showToast(task.next === "completed" ? "任务已完成，路线和轨迹已清除" : "任务状态已切换，地图路线已刷新");
  }

  return (
    <main className="driver-stage">
      <section className="phone-frame driver-phone-stack" aria-label="司机端H5小程序演示">
        <div
          className={`driver-map ${isMapVisible ? "" : "driver-map-suspended"}`}
          aria-hidden={!isMapVisible}
          onClick={(event) => {
            if (!isMapVisible) return;
            if (isMapOverlayTarget(event.target)) return;
            if (panel === "station") setPanel("collapsed");
          }}
        >
          <AmapCanvas
            stations={runtimeStations}
            selectedId={selectedId}
            taskStage={taskStage}
            mapView={mapView}
            vehicleZoomMode={vehicleZoomMode}
            followVehicle={followVehicle}
            recenterTick={recenterTick}
            routeGeometry={routeGeometry}
            soc={soc}
            locationMode={locationMode}
            mapConfig={mapConfig}
            mapActive={isMapVisible}
            onBlankClick={handleMapBlankClick}
            onStationClick={handleAmapStationClick}
            onUserMapInteract={handleMapUserInteract}
          />
          <div className="map-fade" />

          <header className="driver-topbar" onClick={(event) => event.stopPropagation()}>
            <button className="top-tool" onClick={() => setPanel("more")}>状态</button>
          </header>

          <section className={`vehicle-card ${severity}`} onClick={(event) => event.stopPropagation()}>
            <div className="plate-row">
              <span className="truck-mark">T</span>
              <span><b>主车</b>{context.plateNo}</span>
              <span><b>挂车</b>{context.trailerPlateNo}</span>
            </div>
            <div className="vehicle-grid">
              <div>
                <strong>SOC <em>{soc}%</em></strong>
                <span className="battery-line"><i style={{ width: `${soc}%` }} /></span>
              </div>
              <div className={taskStage === "completed" ? "vehicle-task-idle" : ""}>
                {taskStage !== "completed" && <strong>{task.label}</strong>}
                <p>{task.destination}</p>
              </div>
            </div>
          </section>

          {severity !== "ok" && selected && (
            <button className={`battery-prompt ${severity}`} onClick={(event) => { event.stopPropagation(); setSelectedId(ranked[0]?.id ?? selected.id); setPanel("station"); }}>
              <span>{severity === "critical" ? "严重低电" : "低电提醒"}</span>
              <b>{locationMode === "none" ? "定位不可用，先查看全部正常场站" : "建议前往最近的充电站点进行补能"}</b>
              <strong>去充电</strong>
            </button>
          )}

          <div className="map-tools" onClick={(event) => event.stopPropagation()}>
            <button onClick={() => {
              setMapView("vehicle");
              setVehicleZoomMode("street");
              setFollowVehicle(true);
              setRecenterTick((tick) => tick + 1);
              showToast(locationMode === "vehicle" ? "已回到车辆当前位置" : "已回到手机定位");
            }}>定位</button>
            <button className={cooldown ? "disabled" : ""} onClick={syncData}>{refreshing ? "刷新中" : "刷新"}</button>
            <button onClick={() => {
              if (!isTaskRunning(taskStage)) {
                showToast("当前无进行中任务路线");
                return;
              }
              setFollowVehicle(false);
              setMapView("route");
              setRecenterTick((tick) => tick + 1);
              showToast("已展示任务路线全貌");
            }}>全程</button>
            <button onClick={() => navigate("/driver/list")}>列表</button>
          </div>

          {panel === "station" && selected && (
            <div onClick={(event) => event.stopPropagation()}>
              <StationPanel
                station={selected}
                rank={ranked.findIndex((item) => item.id === selected.id) + 1}
                onNavigate={() => setPanel("navigate")}
                onDetails={() => {
                  setPanel("collapsed");
                  navigateToStationDetail(selected.id, "/driver");
                }}
                onFeedback={() => setPanel("feedback")}
                onCopy={() => showToast("已复制场站名称和地址")}
                onClose={() => setPanel("collapsed")}
              />
            </div>
          )}
          {panel === "navigate" && selected && (
            <NavigationSheet
              station={selected}
              onClose={() => setPanel("station")}
              onCopy={() => showToast("导航失败处理：已复制场站地址")}
              showToast={showToast}
            />
          )}
          {panel === "feedback" && selected && (
            <DriverSheet title="问题反馈" onClose={() => setPanel("station")}>
              <div className="feedback-context">
                <span>{selected.name}</span>
                <small>{context.driverId} · {context.plateNo} · {context.taskId}</small>
              </div>
              <label className="form-label">反馈类型</label>
              <select value={feedbackType} onChange={(event) => setFeedbackType(event.target.value)}>
                {["场站无法充电", "充电桩故障", "排队严重", "重卡无法进入", "地址/定位不准", "价格不一致", "场站信息不准确", "其他问题"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <label className="form-label">备注</label>
              <textarea value={feedbackRemark} onChange={(event) => setFeedbackRemark(event.target.value)} placeholder="补充现场情况，例如入口限高、现场价格、排队情况" />
              <button className="primary-btn full" onClick={submitDriverFeedback}>提交反馈并同步后台</button>
            </DriverSheet>
          )}
          {panel === "more" && (
            <DriverSheet title="业务状态调试" onClose={() => setPanel("collapsed")}>
              <div className="state-switcher">
                <p><b>定位来源</b><small>车辆定位超过 1 分钟时降级到手机定位；两者失败进入无定位模式。</small></p>
                <div className="choice-grid">
                  {[
                    ["vehicle", "车辆定位", context.vehicleLocation],
                    ["phone", "手机定位", context.phoneLocation],
                    ["none", "无定位", "距离和排名隐藏"],
                  ].map(([key, label, helper]) => (
                    <button key={key} className={locationMode === key ? "active" : ""} onClick={() => setLocationMode(key)}>
                      <b>{label}</b><span>{helper}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="state-switcher">
                <p><b>任务状态</b><small>{task.helper}</small></p>
                <button className="secondary-btn full" onClick={advanceTask}>{task.action}</button>
              </div>
              <div className="state-switcher">
                <p><b>SOC 状态</b><small>后台阈值：低电 {mapConfig.lowSocThreshold}% / 严重 {mapConfig.criticalSocThreshold}%</small></p>
                <input type="range" min="10" max="90" value={soc} onChange={(event) => setSoc(Number(event.target.value))} />
              </div>
              <div className="sync-list">
                <p><b>最后同步</b><span>{lastSync}</span></p>
                <p><b>推荐排名数量</b><span>{locationMode === "none" ? "无定位不排名" : `前 ${mapConfig.rankLimit} 名`}</span></p>
                <p><b>自动刷新</b><span>{isTaskRunning(taskStage) ? `${mapConfig.autoRefreshSeconds} 秒` : "任务完成后关闭"}</span></p>
                <p><b>反馈记录</b><span>{feedback.length} 条</span></p>
              </div>
            </DriverSheet>
          )}

          <nav className="driver-tabs" onClick={(event) => event.stopPropagation()}>
            {["首页", "地图", "我的"].map((item) => (
              <button key={item} className={item === "地图" ? "active" : ""}>{item}</button>
            ))}
          </nav>

          {toast && <div className="toast">{toast}</div>}
        </div>

        {isListPage && (
          <DriverStationListPage
            stations={stations}
            locationMode={locationMode}
            mapConfig={mapConfig}
          />
        )}

        {isDetailPage && (
          <DriverStationDetailPage
            stationId={detailStationId}
            stations={stations}
            locationMode={locationMode}
          />
        )}
      </section>
    </main>
  );
}

function RouteOverlay({ stage }) {
  return (
    <div className={`route-overlay ${stage}`} aria-hidden="true">
      <span className="track-line" />
      <span className="remain-line" />
      <span className="truck-dot" />
    </div>
  );
}

function resolveMapCenter(position) {
  if (!position) return null;
  if (Array.isArray(position)) return position;
  if (typeof position.getLng === "function") {
    return [position.getLng(), position.getLat()];
  }
  return [position.lng ?? position[0], position.lat ?? position[1]];
}

function getMapContainer(map) {
  return map?.getContainer?.() || map?.getDiv?.() || null;
}

function getPaddedViewportCenter(container, padding) {
  const [top, bottom, left, right] = padding;
  return {
    x: left + (container.clientWidth - left - right) / 2,
    y: top + (container.clientHeight - top - bottom) / 2,
  };
}

function alignVehicleToPaddedCenter(map, vehiclePosition, padding, duration = 0) {
  const center = resolveMapCenter(vehiclePosition);
  if (!map || !center) return;

  const container = getMapContainer(map);
  if (!container) {
    map.panTo(center, duration);
    return;
  }

  const anchor = getPaddedViewportCenter(container, padding);
  const pixel = map.lngLatToContainer(center);
  const dx = anchor.x - pixel.x;
  const dy = anchor.y - pixel.y;

  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

  map.panBy(dx, dy, duration);
}

function panMapWithVehicleDelta(map, lastPosition, currentPosition) {
  const last = resolveMapCenter(lastPosition);
  const current = resolveMapCenter(currentPosition);
  if (!map || !last || !current) return false;

  const lastPixel = map.lngLatToContainer(last);
  const currPixel = map.lngLatToContainer(current);
  const dx = lastPixel.x - currPixel.x;
  const dy = lastPixel.y - currPixel.y;

  if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) return false;

  map.panBy(dx, dy, 0);
  return true;
}

function recenterOnVehicle(map, vehiclePosition, padding, zoom) {
  const center = resolveMapCenter(vehiclePosition);
  if (!map || !center) return;

  map.setZoom(zoom, true, 0);
  alignVehicleToPaddedCenter(map, center, padding, 0);
}

function applyMapView(
  map,
  AMap,
  {
    mapView,
    taskStage,
    overlaysRef,
    vehiclePosition,
    programmaticMoveRef,
    locationMode,
    rankCount,
    lowSoc,
    vehicleZoomMode,
  },
) {
  const overlays = overlaysRef.current;
  if (!map || !AMap || !overlays.length) return;

  const stationMarkers = overlays.filter((overlay) => overlay.getExtData?.() === "station");
  const vehicleMarker = overlays.find((overlay) => overlay.getExtData?.() === "vehicle");

  programmaticMoveRef.current = true;
  window.setTimeout(() => {
    programmaticMoveRef.current = false;
  }, 800);

  if (mapView === "route" && isTaskRunning(taskStage)) {
    fitRouteOverview(map, AMap, taskStage, overlays, MAP_ROUTE_PADDING);
    return;
  }

  if (mapView === "stations" && stationMarkers.length) {
    map.setFitView(stationMarkers, false, MAP_VEHICLE_PADDING, 13);
    return;
  }

  if (vehicleZoomMode === "street") {
    recenterOnVehicle(map, vehiclePosition, MAP_VEHICLE_PADDING, MAP_VEHICLE_ZOOM);
    return;
  }

  fitChargingOverview(map, overlays, {
    padding: MAP_VEHICLE_PADDING,
    locationMode,
    taskStage,
    rankCount,
    vehicleMarker,
    lowSoc,
  });
}

function syncMapOverlaysRef(overlaysRef, stationMarkersRef, vehicleMarkerRef, routeOverlaysRef) {
  overlaysRef.current = [
    ...stationMarkersRef.current.map((item) => item.marker),
    ...(vehicleMarkerRef.current ? [vehicleMarkerRef.current] : []),
    ...routeOverlaysRef.current,
  ];
}

function createRouteOverlays(AMap, routeGeometry) {
  const pickupMarker = new AMap.Marker({
    position: routePoints.pickup,
    zIndex: 110,
    offset: new AMap.Pixel(-20, -20),
    extData: "task",
    content: '<div class="map-task-marker pickup"><span class="task-pin">装</span></div>',
  });
  const dropoffMarker = new AMap.Marker({
    position: routePoints.dropoff,
    zIndex: 110,
    offset: new AMap.Pixel(-20, -20),
    extData: "task",
    content: '<div class="map-task-marker dropoff"><span class="task-pin">卸</span></div>',
  });
  const travelledHalo = new AMap.Polyline({
    path: routeGeometry.travelled,
    strokeColor: "#F8FAFC",
    strokeWeight: 12,
    strokeOpacity: 0.9,
    lineJoin: "round",
    zIndex: 72,
    extData: "route",
  });
  const travelledLine = new AMap.Polyline({
    path: routeGeometry.travelled,
    strokeColor: "#5B5CF6",
    strokeWeight: 6,
    strokeOpacity: 0.88,
    strokeStyle: "dashed",
    strokeDasharray: [12, 10],
    showDir: true,
    lineJoin: "round",
    zIndex: 82,
    extData: "route",
  });
  const remainingHalo = new AMap.Polyline({
    path: routeGeometry.remaining,
    strokeColor: "#F8FAFC",
    strokeWeight: 12,
    strokeOpacity: 0.9,
    lineJoin: "round",
    zIndex: 71,
    extData: "route",
  });
  const remainingLine = new AMap.Polyline({
    path: routeGeometry.remaining,
    strokeColor: "#5B5CF6",
    strokeWeight: 6,
    strokeOpacity: 0.92,
    strokeStyle: "solid",
    showDir: true,
    lineJoin: "round",
    zIndex: 81,
    extData: "route",
  });

  return {
    overlays: [pickupMarker, dropoffMarker, travelledHalo, travelledLine, remainingHalo, remainingLine],
    lines: { travelledHalo, travelledLine, remainingHalo, remainingLine },
  };
}

function AmapCanvas({
  stations,
  selectedId,
  taskStage,
  mapView,
  vehicleZoomMode,
  followVehicle,
  recenterTick,
  routeGeometry,
  soc,
  locationMode,
  mapConfig,
  mapActive = true,
  onBlankClick,
  onStationClick,
  onUserMapInteract,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const routeOverlaysRef = useRef([]);
  const vehicleMarkerRef = useRef(null);
  const stationMarkersRef = useRef([]);
  const routeLinesRef = useRef({});
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const programmaticMoveRef = useRef(false);
  const lastFollowPositionRef = useRef(null);
  const routeGeometryRef = useRef(routeGeometry);
  const followVehicleRef = useRef(followVehicle);
  const mapViewRef = useRef(mapView);
  const vehicleZoomModeRef = useRef(vehicleZoomMode);
  const mapActiveRef = useRef(mapActive);
  const taskStageRef = useRef(taskStage);
  const recenterTickRef = useRef(recenterTick);
  routeGeometryRef.current = routeGeometry;
  followVehicleRef.current = followVehicle;
  mapViewRef.current = mapView;
  vehicleZoomModeRef.current = vehicleZoomMode;
  mapActiveRef.current = mapActive;
  taskStageRef.current = taskStage;
  recenterTickRef.current = recenterTick;
  const onBlankClickRef = useRef(onBlankClick);
  const onStationClickRef = useRef(onStationClick);
  const onUserMapInteractRef = useRef(onUserMapInteract);
  onBlankClickRef.current = onBlankClick;
  onStationClickRef.current = onStationClick;
  onUserMapInteractRef.current = onUserMapInteract;
  const [loadState, setLoadState] = useState("loading");
  const [overlaysReady, setOverlaysReady] = useState(false);

  const stationLayoutKey = useMemo(
    () => stations.map((station) => `${station.id}:${station.lng}:${station.lat}`).join("|"),
    [stations],
  );

  useEffect(() => {
    let cancelled = false;

    loadAmap()
      .then((AMap) => {
        if (cancelled || !containerRef.current) return;
        const map = new AMap.Map(containerRef.current, {
          center: routePoints.vehicle,
          zoom: 11.2,
          viewMode: "2D",
          resizeEnable: true,
          animateEnable: false,
          mapStyle: "amap://styles/whitesmoke",
          features: ["bg", "road", "building", "point"],
        });
        map.addControl(new AMap.Scale());
        map.addControl(new AMap.ToolBar({ position: { right: "10px", bottom: "148px" } }));
        map.setPitch?.(0);
        map.on("click", (event) => {
          const target = event.originEvent?.target;
          if (isMapOverlayTarget(target)) return;
          onBlankClickRef.current();
        });
        map.on("dragstart", () => {
          if (!programmaticMoveRef.current) onUserMapInteractRef.current?.();
        });
        mapRef.current = map;
        window.requestAnimationFrame(() => {
          map.resize?.();
        });
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapActive || loadState !== "ready") return;
    const map = mapRef.current;
    window.requestAnimationFrame(() => {
      map?.resize?.();
    });
  }, [mapActive, loadState]);

  useEffect(() => {
    const container = containerRef.current;
    const map = mapRef.current;
    if (loadState !== "ready" || !container || !map) return undefined;

    const disableMapDrag = () => {
      map.setStatus?.({ dragEnable: false });
    };

    const enableMapDrag = () => {
      map.setStatus?.({ dragEnable: true });
    };

    const onOverlayPointerDown = (event) => {
      if (!isMapOverlayTarget(event.target)) return;
      disableMapDrag();
    };

    const onOverlayClick = (event) => {
      const marker = event.target.closest?.(".map-charge-marker[data-station-id]");
      if (!marker) return;
      event.stopPropagation();
      onStationClickRef.current(marker.dataset.stationId);
    };

    const releaseEvents = ["mouseup", "pointerup", "touchend", "pointercancel"];

    container.addEventListener("mousedown", onOverlayPointerDown, true);
    container.addEventListener("touchstart", onOverlayPointerDown, { capture: true, passive: true });
    container.addEventListener("click", onOverlayClick);
    releaseEvents.forEach((name) => window.addEventListener(name, enableMapDrag, true));

    return () => {
      container.removeEventListener("mousedown", onOverlayPointerDown, true);
      container.removeEventListener("touchstart", onOverlayPointerDown, true);
      container.removeEventListener("click", onOverlayClick);
      releaseEvents.forEach((name) => window.removeEventListener(name, enableMapDrag, true));
      enableMapDrag();
    };
  }, [loadState]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = window.AMap;
    if (loadState !== "ready" || !map || !AMap || vehicleMarkerRef.current) return;

    const vehicleMarker = new AMap.Marker({
      position: routeGeometry.vehiclePosition,
      zIndex: 170,
      offset: new AMap.Pixel(-VEHICLE_MARKER_SIZE / 2, -VEHICLE_MARKER_SIZE / 2),
      extData: "vehicle",
      content: `
        <div class="map-vehicle-alert" aria-label="当前车辆">
          <span class="vehicle-pin"><b>🚗</b></span>
        </div>
      `,
    });
    vehicleMarkerRef.current = vehicleMarker;
    map.add(vehicleMarker);
    syncMapOverlaysRef(overlaysRef, stationMarkersRef, vehicleMarkerRef, routeOverlaysRef);
    setOverlaysReady(true);
  }, [loadState]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = window.AMap;
    if (loadState !== "ready" || !map || !AMap) return;

    const nextIds = new Set(stations.map((station) => station.id));
    const existingById = new Map(stationMarkersRef.current.map((item) => [item.id, item]));

    stationMarkersRef.current
      .filter((item) => !nextIds.has(item.id))
      .forEach(({ marker }) => map.remove(marker));

    const nextMarkers = stations.map((station) => {
      const existing = existingById.get(station.id);
      if (existing) {
        existing.station = station;
        existing.marker.setPosition([station.lng, station.lat]);
        return existing;
      }

      const marker = new AMap.Marker({
        position: [station.lng, station.lat],
        title: station.name,
        zIndex: selectedIdRef.current === station.id ? 160 : 140,
        offset: new AMap.Pixel(-42, -72),
        extData: "station",
        content: buildStationMarkerHtml(station, selectedIdRef.current === station.id),
      });
      map.add(marker);
      return { id: station.id, station, marker };
    });

    stationMarkersRef.current = nextMarkers;
    syncMapOverlaysRef(overlaysRef, stationMarkersRef, vehicleMarkerRef, routeOverlaysRef);
  }, [loadState, stationLayoutKey]);

  useEffect(() => {
    stationMarkersRef.current.forEach(({ id, station, marker }) => {
      const selected = id === selectedId;
      marker.setContent(buildStationMarkerHtml(station, selected));
      marker.setzIndex(selected ? 160 : 140);
    });
  }, [stations, selectedId, locationMode]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = window.AMap;
    if (loadState !== "ready" || !map || !AMap) return;

    if (routeOverlaysRef.current.length) {
      map.remove(routeOverlaysRef.current);
      routeOverlaysRef.current = [];
      routeLinesRef.current = {};
    }

    if (isTaskRunning(taskStage)) {
      const { overlays, lines } = createRouteOverlays(AMap, routeGeometry);
      routeOverlaysRef.current = overlays;
      routeLinesRef.current = lines;
      map.add(overlays);
    }

    syncMapOverlaysRef(overlaysRef, stationMarkersRef, vehicleMarkerRef, routeOverlaysRef);
  }, [loadState, taskStage]);

  useEffect(() => {
    lastFollowPositionRef.current = null;
  }, [followVehicle, recenterTick, mapView, vehicleZoomMode]);

  useEffect(() => {
    if (loadState !== "ready") return undefined;

    let frameId = 0;

    function tick() {
      const map = mapRef.current;
      const vehicleMarker = vehicleMarkerRef.current;
      const geo = routeGeometryRef.current;
      if (map && vehicleMarker && geo) {
        const center = resolveMapCenter(geo.vehiclePosition);
        const { travelledHalo, travelledLine, remainingHalo, remainingLine } = routeLinesRef.current;

        vehicleMarker.setPosition(geo.vehiclePosition);

        if (travelledHalo && travelledLine && remainingHalo && remainingLine) {
          travelledHalo.setPath(geo.travelled);
          travelledLine.setPath(geo.travelled);
          remainingHalo.setPath(geo.remaining);
          remainingLine.setPath(geo.remaining);
        }

        const shouldFollow =
          mapActiveRef.current &&
          mapViewRef.current === "vehicle" &&
          vehicleZoomModeRef.current === "street" &&
          followVehicleRef.current &&
          isTaskRunning(taskStageRef.current);

        if (shouldFollow && center) {
          const last = lastFollowPositionRef.current;
          programmaticMoveRef.current = true;
          if (!last) {
            alignVehicleToPaddedCenter(map, center, MAP_VEHICLE_PADDING, 0);
          } else {
            panMapWithVehicleDelta(map, last, center);
          }
          programmaticMoveRef.current = false;
          lastFollowPositionRef.current = center;
        } else if (!shouldFollow) {
          lastFollowPositionRef.current = null;
        }
      }

      frameId = window.requestAnimationFrame(tick);
    }

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [loadState]);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = window.AMap;
    if (loadState !== "ready" || !overlaysReady || !map || !AMap || !overlaysRef.current.length || !mapActive) return;
    if (mapView === "vehicle" && !followVehicle) return;

    const lowSoc = soc <= mapConfig.lowSocThreshold;
    applyMapView(map, AMap, {
      mapView,
      taskStage,
      overlaysRef,
      vehiclePosition: routeGeometry.vehiclePosition,
      programmaticMoveRef,
      locationMode,
      rankCount: mapConfig.rankLimit,
      lowSoc,
      vehicleZoomMode,
    });
  }, [loadState, overlaysReady, mapView, taskStage, followVehicle, recenterTick, vehicleZoomMode, locationMode, soc, mapConfig]);

  return (
    <div className={`amap-layer ${mapView === "route" ? "route-overview" : ""}`}>
      <div ref={containerRef} className="amap-container" />
      {loadState === "loading" && <div className="amap-status">正在加载高德地图</div>}
      {loadState === "error" && (
        <div className="amap-status error">
          高德地图加载失败，请检查网络、Key 或 Web 端服务配置
        </div>
      )}
    </div>
  );
}

function StationPanel({ station, rank, onNavigate, onDetails, onFeedback, onCopy, onClose }) {
  return (
    <section className="station-panel">
      <button className="grabber" aria-label="收起场站卡片" onClick={onClose} />
      <div className="station-heading">
        <span className="bolt-dot">电</span>
        <div>
          <h2>{station.name}</h2>
          <div className="pills">
            {rank > 0 && <span>距离第 {rank} 名</span>}
            <span>{station.speedLabel} 空闲 {station.availablePiles}/{station.totalPiles}</span>
            <span>{station.distanceType === "straight" ? "直线距离降级" : "驾车距离"}</span>
            <span>{station.routeNearbyFlag ? "路线附近" : "需绕行判断"}</span>
          </div>
        </div>
      </div>
      <div className="address-row">
        <p>{station.address}</p>
        <button onClick={onCopy}>复制</button>
      </div>
      <div className="station-meta">
        <span><b>距你 {station.distanceText}</b><small>{station.durationMin}分钟 · 当前 {station.priceText}</small></span>
        <span><b>{station.capacityText}</b><small>承载量</small></span>
        <span><b>{station.totalPiles} 台</b><small>充电桩</small></span>
      </div>
      <div className="station-actions">
        <button className="primary-btn" onClick={onNavigate}>导航</button>
        <button className="secondary-btn" onClick={onDetails}>详情</button>
        <button className="secondary-btn" onClick={onFeedback}>反馈</button>
      </div>
    </section>
  );
}

function DriverStationListPage({ stations, locationMode, mapConfig }) {
  const driverStations = useMemo(() => sortStations(stations, locationMode), [stations, locationMode]);
  const runtimeStations = useMemo(() => driverStations.map((station) => getStationRuntime(station, locationMode)), [driverStations, locationMode]);
  const ranked = locationMode === "none" ? [] : runtimeStations.slice(0, mapConfig.rankLimit);
  const [keyword, setKeyword] = useState("");
  const [province, setProvince] = useState("全部省份");
  const [city, setCity] = useState("全部城市");
  const [distance, setDistance] = useState("50km");
  const provinces = ["全部省份", ...new Set(runtimeStations.map((station) => station.province))];
  const cities = ["全部城市", ...new Set(runtimeStations.filter((station) => province === "全部省份" || station.province === province).map((station) => station.city))];
  const filtered = runtimeStations.filter((station) => {
    const textMatch = `${station.name}${station.address}`.includes(keyword);
    const provinceMatch = province === "全部省份" || station.province === province;
    const cityMatch = city === "全部城市" || station.city === city;
    const distanceLimit = distance === "全部距离" ? Infinity : Number(distance.replace("km", ""));
    const distanceMatch = locationMode === "none" || station.distanceValue == null || station.distanceValue <= distanceLimit;
    return textMatch && provinceMatch && cityMatch && distanceMatch;
  });
  const [navStation, setNavStation] = useState(null);
  const [toast, setToast] = useState("");

  function showToast(text) {
    setToast(text);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 2600);
  }

  return (
    <div className="driver-list-page driver-page-overlay" aria-label="场站列表">
          <header className="driver-page-header">
            <button type="button" className="page-back" aria-label="返回" onClick={() => navigate("/driver")}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h1>场站列表</h1>
          </header>
          <div className="driver-list-page-body">
            <div className="driver-filters">
              <label className="driver-search-field">
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="搜索场站名称"
                />
                <span className="driver-search-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
                    <path d="M16.2 16.2L20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </span>
              </label>
              <select value={province} aria-label="省份筛选" onChange={(event) => { setProvince(event.target.value); setCity("全部城市"); }}>
                {provinces.map((item) => (
                  <option key={item} value={item}>{item === "全部省份" ? "全部省" : item}</option>
                ))}
              </select>
              <select value={city} aria-label="城市筛选" onChange={(event) => setCity(event.target.value)}>
                {cities.map((item) => (
                  <option key={item} value={item}>{item === "全部城市" ? "全部市" : item}</option>
                ))}
              </select>
              <select value={distance} aria-label="距离筛选" onChange={(event) => setDistance(event.target.value)} disabled={locationMode === "none"}>
                {["10km", "20km", "50km"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            {locationMode === "none" && <p className="inline-warning">无定位模式下距离筛选不可用，列表按省市和场站名称排序。</p>}
            <div className="driver-list">
              {filtered.map((station) => {
                const rank = ranked.findIndex((item) => item.id === station.id) + 1;
                return (
                  <div key={station.id} className="driver-list-row">
                    <button
                      type="button"
                      className="driver-list-main"
                      onClick={() => navigateToStationDetail(station.id, "/driver/list")}
                    >
                      <b>{rank > 0 && <em>{rank}</em>}{station.name}</b>
                      <small>{station.distanceText}｜当前 {station.priceText}｜承载量 {station.capacityText}｜充电桩 {station.totalPiles} 台</small>
                      <small>{station.address}</small>
                    </button>
                    <button
                      type="button"
                      className="driver-list-nav-btn"
                      aria-label={`导航至${station.name}`}
                      onClick={() => setNavStation(station)}
                    >
                      <NavIcon />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <nav className="driver-tabs">
            {["首页", "地图", "我的"].map((item) => (
              <button
                key={item}
                className={item === "地图" ? "active" : ""}
                onClick={() => item === "地图" && navigate("/driver")}
              >
                {item}
              </button>
            ))}
          </nav>
          {navStation && (
            <>
              <button type="button" className="driver-sheet-backdrop" aria-label="关闭导航选择" onClick={() => setNavStation(null)} />
              <NavigationSheet
                station={navStation}
                onClose={() => setNavStation(null)}
                onCopy={() => showToast("已复制地址")}
                showToast={showToast}
              />
            </>
          )}
          {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function DriverStationDetailPage({ stationId, stations, locationMode }) {
  const driverStations = useMemo(() => sortStations(stations, locationMode), [stations, locationMode]);
  const runtimeStations = useMemo(() => driverStations.map((station) => getStationRuntime(station, locationMode)), [driverStations, locationMode]);
  const station = runtimeStations.find((item) => item.id === stationId);
  const [navStation, setNavStation] = useState(null);
  const [toast, setToast] = useState("");

  function showToast(text) {
    setToast(text);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 2600);
  }

  return (
    <div className="driver-list-page driver-page-overlay" aria-label="场站详情">
          <header className="driver-page-header">
            <button type="button" className="page-back" aria-label="返回" onClick={navigateFromStationDetailBack}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h1>场站详情</h1>
          </header>
          <div className="driver-list-page-body driver-detail-page-body">
            {station ? (
              <StationDetailContent
                station={station}
                onNavigate={() => setNavStation(station)}
                onCopy={() => showToast("已复制地址")}
                onFeedback={() => returnToDriverMap({ selectedId: station.id, panel: "feedback" })}
              />
            ) : (
              <div className="driver-empty-state">
                <p>未找到该场站，可能已停用或不存在。</p>
                <button className="secondary-btn" onClick={navigateFromStationDetailBack}>返回</button>
              </div>
            )}
          </div>
          <nav className="driver-tabs">
            {["首页", "地图", "我的"].map((item) => (
              <button
                key={item}
                className={item === "地图" ? "active" : ""}
                onClick={() => item === "地图" && navigate("/driver")}
              >
                {item}
              </button>
            ))}
          </nav>
          {navStation && (
            <>
              <button type="button" className="driver-sheet-backdrop" aria-label="关闭导航选择" onClick={() => setNavStation(null)} />
              <NavigationSheet
                station={navStation}
                onClose={() => setNavStation(null)}
                onCopy={() => showToast("已复制地址")}
                showToast={showToast}
              />
            </>
          )}
          {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function NavIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.2 20.1 19.3l-.9.5L12 17.1 4.8 19.8l-.9-.5L12 2.2z"
        fill="currentColor"
      />
    </svg>
  );
}

function StationDetailContent({ station, onNavigate, onCopy, onFeedback }) {
  return (
    <article className="details-block">
      <h3>{station.name}</h3>
      <p>{station.address}</p>
      <div className="mini-map-card">
        <img src="/assets/driver-map-yuxi.png" alt={`${station.name}点位预览`} />
        <span>当前场站点位预览</span>
      </div>
      <div className="info-grid">
        <span><b>{station.priceText}</b>当前电价</span>
        <span><b>{station.distanceText}</b>距离</span>
        <span><b>{station.capacityText}</b>承载量</span>
        <span><b>{station.totalPiles} 台</b>充电桩</span>
      </div>
      <h4>分时电价</h4>
      {pricePeriods.map((period) => (
        <p className="kv" key={period.start}>{period.start}-{period.end}<b>{period.price}</b></p>
      ))}
      <h4>标准停留时长</h4>
      {stayDurations.map((period) => (
        <p className="kv" key={period.start}>{period.start}-{period.end}<b>{period.duration}</b></p>
      ))}
      <h4>进站说明</h4>
      <p>{station.remark}</p>
      <div className="sheet-actions sticky-actions">
        <button className="primary-btn" onClick={onNavigate}>导航</button>
        <button className="secondary-btn" onClick={onCopy}>复制地址</button>
        <button className="secondary-btn" onClick={onFeedback}>问题反馈</button>
      </div>
    </article>
  );
}

function NavigationSheet({ station, onClose, onCopy, showToast }) {
  const [failedApp, setFailedApp] = useState("");
  function choose(name) {
    if (name === "百度地图") {
      setFailedApp(name);
      showToast("百度地图拉起失败，请重新选择或复制地址");
      return;
    }
    setFailedApp("");
    showToast(`已拉起${name}，目的地：${station.shortName}`);
    onClose();
  }
  return (
    <DriverSheet title="选择导航地图" onClose={onClose}>
      <div className="nav-choice">
        {["高德地图", "百度地图", "腾讯地图"].map((name) => (
          <button key={name} className={failedApp === name ? "failed" : ""} onClick={() => choose(name)}>
            <b>{name}</b>
            <span>{failedApp === name ? "未安装或拉起失败" : `导航至 ${station.shortName}`}</span>
          </button>
        ))}
      </div>
      {failedApp && (
        <div className="nav-fallback">
          <p>外部地图拉起失败，可重新选择地图或复制地址。</p>
          <button className="secondary-btn full" onClick={onCopy}>复制地址</button>
        </div>
      )}
    </DriverSheet>
  );
}

function DriverSheet({ title, children, onClose }) {
  return (
    <section className="driver-sheet" onClick={(event) => event.stopPropagation()}>
      <header>
        <h2>{title}</h2>
        <button onClick={onClose}>关闭</button>
      </header>
      {children}
    </section>
  );
}

function AdminApp({
  stations,
  setStations,
  feedback,
  setFeedback,
  mapConfig,
  setMapConfig,
  taskStage,
  setTaskStage,
  locationMode,
  setLocationMode,
  soc,
  setSoc,
  lastSync,
  setLastSync,
}) {
  const [section, setSection] = useState("overview");
  const [selectedId, setSelectedId] = useState(stations[0].id);
  const [banner, setBanner] = useState("已加载 PRD 第一期业务状态原型");
  const selected = stations.find((station) => station.id === selectedId) ?? stations[0];
  const unresolved = feedback.filter((item) => item.status !== "已处理").length;

  function showBanner(text) {
    setBanner(text);
    window.clearTimeout(showBanner.timer);
    showBanner.timer = window.setTimeout(() => setBanner(""), 3200);
  }

  function toggleStation(station) {
    setStations((items) => items.map((item) => (
      item.id === station.id ? { ...item, status: item.status === "正常" ? "停用" : "正常", updatedAt: "2026-07-05 13:42" } : item
    )));
    showBanner(`${station.shortName} 已${station.status === "正常" ? "停用" : "启用"}，司机端刷新后同步${station.status === "正常" ? "隐藏" : "展示"}`);
  }

  function publishSync() {
    setLastSync("13:42:28");
    showBanner("配置与场站数据已发布同步，司机端可立即预览");
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand">
          <span>重</span>
          <div><b>重卡充电 TMS</b><small>运营管理平台</small></div>
        </div>
        {[
          ["overview", "运营总览"],
          ["stations", "场站管理"],
          ["price", "分时电价"],
          ["stay", "标准停留"],
          ["feedback", "反馈管理"],
          ["config", "地图配置"],
          ["contract", "联动数据"],
        ].map(([key, label]) => (
          <button key={key} className={section === key ? "active" : ""} onClick={() => setSection(key)}>
            {label}
            {key === "feedback" && unresolved > 0 && <small>{unresolved}</small>}
          </button>
        ))}
        <div className="system-state">
          <b>系统状态</b>
          <span>正常运行</span>
          <strong>{lastSync}</strong>
          <small>2026-07-05</small>
        </div>
      </aside>

      <section className="admin-main">
        <AdminTop title={section === "overview" ? "运营总览" : adminTitle(section)} onPublish={publishSync} />
        {banner && <div className="admin-banner">{banner}</div>}
        {section === "overview" && (
          <AdminOverview
            stations={stations}
            feedback={feedback}
            mapConfig={mapConfig}
            setSection={setSection}
            taskStage={taskStage}
            setTaskStage={setTaskStage}
            locationMode={locationMode}
            setLocationMode={setLocationMode}
            soc={soc}
            setSoc={setSoc}
          />
        )}
        {section === "stations" && (
          <StationManagement
            stations={stations}
            selected={selected}
            setSelectedId={setSelectedId}
            toggleStation={toggleStation}
            setStations={setStations}
            showBanner={showBanner}
          />
        )}
        {section === "config" && <ConfigPanel mapConfig={mapConfig} setMapConfig={setMapConfig} showBanner={showBanner} />}
        {section === "feedback" && <FeedbackPanel feedback={feedback} setFeedback={setFeedback} showBanner={showBanner} />}
        {section !== "overview" && section !== "stations" && section !== "config" && section !== "feedback" && (
          <SimpleModule section={section} selected={selected} />
        )}
      </section>
    </main>
  );
}

function adminTitle(section) {
  return {
    stations: "场站管理",
    price: "分时电价",
    stay: "标准停留",
    feedback: "反馈管理",
    config: "地图配置",
    contract: "联动数据",
  }[section];
}

function AdminTop({ title, onPublish }) {
  return (
    <header className="admin-top">
      <div>
        <h1>{title}</h1>
        <p>充电场站路线规划运营指挥台</p>
      </div>
      <div className="top-actions">
        <button className="secondary-btn" onClick={() => navigate("/driver")}>预览司机端</button>
        <button className="primary-btn" onClick={onPublish}>发布同步</button>
      </div>
    </header>
  );
}

function AdminOverview({
  stations,
  feedback,
  mapConfig,
  setSection,
  taskStage,
  setTaskStage,
  locationMode,
  setLocationMode,
  soc,
  setSoc,
}) {
  const normal = stations.filter((station) => station.status === "正常").length;
  const warningCount = stations.filter((item) => item.validation !== "已校验").length;
  return (
    <>
      <section className="overview-grid">
        <Metric title="可展示正常场站" value={`${normal}/${stations.length}`} helper="状态正常且经纬度完整" tone="success" />
        <Metric title="SOC 当前状态" value={`${soc}%`} helper={`低/临界 ${mapConfig.lowSocThreshold}% / ${mapConfig.criticalSocThreshold}%`} tone={soc <= mapConfig.lowSocThreshold ? "warning" : "success"} />
        <Metric title="任务路线状态" value={taskStages[taskStage].label} helper={isTaskRunning(taskStage) ? `自动刷新每 ${mapConfig.autoRefreshSeconds} 秒` : "无运输中自动刷新"} />
        <Metric title="待处理反馈" value={`${feedback.filter((item) => item.status !== "已处理").length}`} helper={`数据质量预警 ${warningCount} 项`} tone="warning" />
      </section>
      <section className="admin-two-col">
        <article className="operation-card">
          <header>
            <h2>司机端联动预览</h2>
            <button onClick={() => navigate("/driver")}>查看司机端</button>
          </header>
          <div className="route-preview">
            <img src="/assets/driver-map-yuxi.png" alt="司机端地图联动预览" />
            <div className="route-alert">
              <b>{soc <= mapConfig.lowSocThreshold ? "低电找站触发" : "SOC 正常"}</b>
              <span>{context.plateNo} · {taskStages[taskStage].label}</span>
              <small>正常场站 {normal} 个 · 距离排名前 {mapConfig.rankLimit} 名</small>
            </div>
          </div>
          <div className="overview-stats">
            <span><b>{stations.length}</b>场站总数</span>
            <span><b>{normal}</b>司机端展示</span>
            <span><b>{feedback.length}</b>今日反馈</span>
            <span><b>{mapConfig.rankLimit}</b>推荐排名</span>
          </div>
        </article>
        <article className="operation-card">
          <header>
            <h2>业务状态控制台</h2>
            <button onClick={() => setSection("config")}>编辑配置</button>
          </header>
          <div className="admin-control-group">
            <label>定位来源</label>
            <div className="admin-segments">
              {[
                ["vehicle", "车辆"],
                ["phone", "手机"],
                ["none", "无定位"],
              ].map(([key, label]) => (
                <button key={key} className={locationMode === key ? "active" : ""} onClick={() => setLocationMode(key)}>{label}</button>
              ))}
            </div>
          </div>
          <div className="admin-control-group">
            <label>任务阶段</label>
            <div className="admin-segments three">
              {Object.entries(taskStages).map(([key, item]) => (
                <button key={key} className={taskStage === key ? "active" : ""} onClick={() => setTaskStage(key)}>{item.label}</button>
              ))}
            </div>
          </div>
          <div className="admin-control-group">
            <label>SOC：{soc}%</label>
            <input type="range" min="10" max="90" value={soc} onChange={(event) => setSoc(Number(event.target.value))} />
          </div>
          <ConfigPreview label="距离优先推荐场站数量" value={`${mapConfig.rankLimit} 个`} percent={`${mapConfig.rankLimit * 10}%`} />
          <ConfigPreview label="自动刷新频率" value={`${mapConfig.autoRefreshSeconds} 秒`} percent="42%" />
        </article>
      </section>
      <section className="admin-two-col compact">
        <FeedbackPanel feedback={feedback.slice(0, 4)} compact />
        <DataWarnings stations={stations} />
      </section>
    </>
  );
}

function Metric({ title, value, helper, tone }) {
  return (
    <article className={`metric ${tone ?? ""}`}>
      <span />
      <div>
        <p>{title}</p>
        <h2>{value}</h2>
        <small>{helper}</small>
      </div>
    </article>
  );
}

function ConfigPreview({ label, value, percent }) {
  return (
    <div className="config-preview">
      <p><b>{label}</b><span>{value}</span></p>
      <div><i style={{ width: percent }} /></div>
    </div>
  );
}

function StationManagement({ stations, selected, setSelectedId, toggleStation, setStations, showBanner }) {
  function completePrice() {
    setStations((items) => items.map((item) => item.id === selected.id ? { ...item, priceText: item.priceText.includes("暂无") ? "0.83 元/度" : item.priceText, validation: "已校验" } : item));
    showBanner(`${selected.shortName} 的价格和校验状态已更新`);
  }

  return (
    <section className="station-management">
      <article className="table-card">
        <header className="table-toolbar">
          <div>
            <h2>场站列表</h2>
            <p>司机端仅展示正常状态且经纬度完整的充电场站。</p>
          </div>
          <div>
            <input placeholder="搜索场站名称/编码/地址" />
            <button className="secondary-btn" onClick={() => showBanner("Excel 导入失败：分时电价未覆盖 00:00-24:00")}>Excel 导入</button>
            <button className="primary-btn" onClick={() => showBanner("新增场站表单已进入字段校验流程")}>新增场站</button>
          </div>
        </header>
        <table>
          <thead>
            <tr>
              <th>场站名称</th>
              <th>状态</th>
              <th>当前电价</th>
              <th>承载量</th>
              <th>充电桩</th>
              <th>省/市</th>
              <th>校验状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((station) => (
              <tr key={station.id} className={selected.id === station.id ? "selected-row" : ""}>
                <td><b>{station.name}</b><small>{station.code}</small></td>
                <td><span className={`status ${station.status === "正常" ? "ok" : "off"}`}>{station.status}</span></td>
                <td>{station.priceText}</td>
                <td>{station.capacityText}</td>
                <td>{station.availablePiles}/{station.totalPiles}</td>
                <td>{station.province}<small>{station.city}</small></td>
                <td><span className={`validate ${station.validation === "已校验" ? "" : "warn"}`}>{station.validation}</span></td>
                <td>
                  <button onClick={() => setSelectedId(station.id)}>查看</button>
                  <button onClick={() => toggleStation(station)}>{station.status === "正常" ? "停用" : "启用"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
      <aside className="detail-drawer">
        <h2>场站详情</h2>
        <h3>{selected.name}</h3>
        <span className={`status ${selected.status === "正常" ? "ok" : "off"}`}>{selected.status}</span>
        <div className="drawer-section">
          <p><b>地址</b>{selected.address}</p>
          <p><b>经纬度</b>{selected.lng}, {selected.lat}</p>
          <p><b>承载量</b>{selected.capacityText}</p>
          <p><b>充电桩</b>{selected.totalPiles} 台，空闲 {selected.availablePiles} 台</p>
          <p><b>数据更新时间</b>{selected.updatedAt}</p>
        </div>
        <h4>字段校验</h4>
        <div className="validation-list">
          <span className={selected.lng && selected.lat ? "pass" : "fail"}>经纬度必填</span>
          <span className={selected.priceText.includes("暂无") ? "fail" : "pass"}>价格必填</span>
          <span className={selected.capacityText.includes("暂无") ? "fail" : "pass"}>承载量完整</span>
        </div>
        <div className="drawer-actions">
          <button className="secondary-btn" onClick={completePrice}>补全并校验</button>
          <button className="primary-btn" onClick={() => toggleStation(selected)}>{selected.status === "正常" ? "停用场站" : "启用场站"}</button>
        </div>
        <h4>司机端 API 返回示例</h4>
        <pre>{JSON.stringify({
          stationId: selected.id,
          stationName: selected.name,
          currentPriceText: selected.priceText,
          distanceType: selected.drivingKm == null ? "straight" : "driving",
          capacityText: selected.capacityText,
          pileCount: selected.totalPiles,
          stationStatus: selected.status,
        }, null, 2)}</pre>
      </aside>
    </section>
  );
}

function ConfigPanel({ mapConfig, setMapConfig, showBanner }) {
  const fields = [
    ["rankLimit", "距离排名数量", 1, 10, "个"],
    ["lowSocThreshold", "SOC 低电提醒阈值", 10, 60, "%"],
    ["criticalSocThreshold", "严重低电阈值", 5, 30, "%"],
    ["autoRefreshSeconds", "运输中自动刷新频率", 10, 120, "秒"],
    ["manualRefreshCooldownSeconds", "手动刷新限制时间", 5, 60, "秒"],
  ];
  return (
    <section className="operation-card config-card">
      <h2>地图展示配置</h2>
      <p>配置会影响司机端地图点位排名、低电提醒、刷新限制和运输中自动刷新状态。</p>
      {fields.map(([key, label, min, max, unit]) => (
        <label className="range-row" key={key}>
          <span>{label}</span>
          <input
            type="range"
            min={min}
            max={max}
            value={mapConfig[key]}
            onChange={(event) => setMapConfig((config) => ({ ...config, [key]: Number(event.target.value) }))}
          />
          <b>{mapConfig[key]} {unit}</b>
        </label>
      ))}
      <button className="primary-btn" onClick={() => showBanner("地图配置已保存，发布同步后司机端刷新生效")}>保存配置</button>
    </section>
  );
}

function FeedbackPanel({ feedback, setFeedback, compact, showBanner }) {
  function updateStatus(id, status) {
    if (!setFeedback) return;
    setFeedback((items) => items.map((item) => item.id === id ? { ...item, status, handler: "运营-王" } : item));
    showBanner?.(`反馈已更新为：${status}`);
  }

  return (
    <article className="operation-card">
      <header>
        <h2>反馈待处理队列</h2>
        {!compact && <button>导出</button>}
      </header>
      <table className="small-table">
        <thead>
          <tr><th>类型</th><th>反馈内容</th><th>场站/车辆</th><th>状态</th><th>操作</th></tr>
        </thead>
        <tbody>
          {feedback.map((item) => (
            <tr key={item.id}>
              <td><span className="tag">{item.type}</span></td>
              <td>{item.remark}</td>
              <td>{item.stationName}<small>{item.vehicle} · {item.task}</small></td>
              <td><span className={`validate ${item.status === "已处理" ? "done" : ""}`}>{item.status}</span></td>
              <td>
                {setFeedback ? (
                  <>
                    <button onClick={() => updateStatus(item.id, "处理中")}>处理</button>
                    <button onClick={() => updateStatus(item.id, "已处理")}>完成</button>
                  </>
                ) : (
                  <button>查看</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function DataWarnings({ stations }) {
  const warnings = stations.filter((item) => item.validation !== "已校验");
  return (
    <article className="operation-card">
      <header><h2>场站数据质量预警</h2><button>查看说明</button></header>
      <div className="warning-strip">
        <span><b>{stations.filter((item) => item.priceText.includes("暂无")).length}</b>待补价格</span>
        <span><b>{stations.filter((item) => item.status === "停用").length}</b>停用场站</span>
        <span><b>{warnings.length}</b>需复核</span>
      </div>
      <table className="small-table">
        <tbody>
          {warnings.map((station) => (
            <tr key={station.id}><td>{station.name}</td><td>{station.validation}</td><td><button>查看</button></td></tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function SimpleModule({ section, selected }) {
  const title = adminTitle(section);
  return (
    <section className="operation-card simple-module">
      <h2>{title}</h2>
      <p>该模块使用与场站管理相同的数据契约，演示第一期后台维护能力。</p>
      {section === "price" && pricePeriods.map((period) => (
        <p className="kv" key={period.start}>{period.start}-{period.end}<b>{period.price}</b></p>
      ))}
      {section === "stay" && stayDurations.map((period) => (
        <p className="kv" key={period.start}>{period.start}-{period.end}<b>{period.duration}</b></p>
      ))}
      {section === "contract" && (
        <pre>{JSON.stringify({
          stationId: selected.id,
          stationName: selected.name,
          address: selected.address,
          province: selected.province,
          city: selected.city,
          district: selected.district,
          longitude: selected.lng,
          latitude: selected.lat,
          currentPriceText: selected.priceText,
          pricePeriodList: pricePeriods,
          distanceValue: selected.drivingKm,
          distanceType: selected.drivingKm == null ? "straight" : "driving",
          locationSource: "vehicle / phone / none",
          capacityText: selected.capacityText,
          pileCount: selected.totalPiles,
          stationStatus: selected.status,
        }, null, 2)}</pre>
      )}
    </section>
  );
}
