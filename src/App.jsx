import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const AMAP_KEY = "2e9013c7c076a1baec170c986d477a8b";
let amapLoaderPromise;

const priceTypeOptions = ["尖", "峰", "平", "谷"];

function createPricePeriod(overrides = {}) {
  return { priceType: "平", start: "00:00", end: "23:00", price: "", ...overrides };
}

function createStayDuration(overrides = {}) {
  return { start: "00:00", end: "23:59", durationMin: "", ...overrides };
}

function parseTimeToMinutes(value) {
  const [hour, minute] = String(value || "0:0").split(":").map(Number);
  return hour * 60 + minute;
}

function isTimeInRange(start, end, minutes) {
  const startMin = parseTimeToMinutes(start);
  const endMin = parseTimeToMinutes(end);
  if (endMin <= startMin) {
    return minutes >= startMin || minutes < endMin;
  }
  return minutes >= startMin && minutes < endMin;
}

function derivePriceText(periods = []) {
  const valid = periods.filter((period) => String(period.price).trim());
  if (!valid.length) return "暂无价格";
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const active = valid.find((period) => isTimeInRange(period.start, period.end, nowMinutes));
  const price = active?.price || valid[0].price;
  return `${price} 元/度`;
}

function deriveStayDurationText(durations = []) {
  const valid = durations.filter((item) => String(item.durationMin).trim());
  if (!valid.length) return "—";
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const active = valid.find((item) => isTimeInRange(item.start, item.end, nowMinutes));
  const minutes = active?.durationMin || valid[0].durationMin;
  return `${minutes} 分钟`;
}

function syncStationStatusFields(enabledStatus, currentAccountStatus = "已登录") {
  if (enabledStatus === "启用") {
    const accountStatus = ["已停用", "未开通"].includes(currentAccountStatus) ? "已登录" : currentAccountStatus;
    return {
      enabledStatus: "启用",
      status: "正常",
      openStatus: "已开通",
      accountStatus,
    };
  }
  return {
    enabledStatus: "停用",
    status: "停用",
    openStatus: "未开通",
    accountStatus: "已停用",
  };
}

const stationPositions = {
  ST001: { left: "38%", top: "51%" },
  ST002: { left: "63%", top: "43%" },
  ST003: { left: "22%", top: "35%" },
  ST004: { left: "74%", top: "60%" },
  ST005: { left: "18%", top: "64%" },
};

const vehiclePosition = [102.545, 24.337];
const DRIVER_LOCATION_MODE = "vehicle";

const MAP_VEHICLE_ZOOM = 13.2;
const MAP_VEHICLE_PADDING = [100, 80, 90, 40];
const MAP_OVERVIEW_MAX_ZOOM = 13;
const MAP_OVERVIEW_MIN_ZOOM = 11.5;
const MAP_NO_LOCATION_MAX_ZOOM = 11;
const VEHICLE_MARKER_SIZE = 44;

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
    routeNearbyFlag: false,
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
    routeNearbyFlag: false,
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
].map((station, index) => {
  const seedPrice = station.priceText?.includes("暂无") ? "" : (station.priceText?.match(/[\d.]+/)?.[0] || "");
  const pricePeriods = [
    { priceType: "平", start: "00:00", end: "23:00", price: seedPrice },
    ...(index === 0 ? [{ priceType: "尖", start: "23:00", end: "00:00", price: "0.95" }] : []),
  ];
  const stayDurations = [
    { start: "00:00", end: "08:00", durationMin: 40 },
    { start: "08:00", end: "18:00", durationMin: 50 },
    { start: "18:00", end: "24:00", durationMin: 45 },
  ];
  return {
    areaType: ["点", "点", "区域", "行政区域", "点"][index] ?? "点",
    stationType: "充电站",
    shipReceiveType: "收/发货",
    department: "玉溪运营部",
    shareMode: ["全局", "部门", "个人", "全局", "部门"][index] ?? "全局",
    radius: 500,
    settlementEntity: "玉溪物流能源有限公司",
    openStatus: station.status === "停用" ? "未开通" : "已开通",
    account: "tms_yx_ops",
    editor: "张运营",
    autoCode: `YX${String(index + 1).padStart(3, "0")}`,
    enabledStatus: station.status === "正常" ? "启用" : "停用",
    accountStatus: ["已登录", "已登录", "未登录", "已停用", "未开通"][index] ?? "已登录",
    ...station,
    pricePeriods,
    stayDurations,
    priceText: derivePriceText(pricePeriods),
    stayDurationText: deriveStayDurationText(stayDurations),
  };
});

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
};

const mapConfigDefault = {
  rankLimit: 3,
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

function buildVehicleMarkerHtml() {
  return `
    <div class="map-vehicle-alert" aria-label="当前位置">
      <span class="vehicle-pin">
        <svg class="vehicle-pin-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="7.2" r="3.4" fill="currentColor" />
          <path d="M6.5 20.2c.9-3.8 3.2-5.7 5.5-5.7s4.6 1.9 5.5 5.7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
        </svg>
      </span>
    </div>
  `;
}

function isMapOverlayTarget(target) {
  return Boolean(target?.closest?.(".map-charge-marker, .map-vehicle-alert"));
}

function readAppPath() {
  const { hash, pathname } = window.location;
  if (hash.length > 1) {
    return hash.startsWith("#/") ? hash.slice(1) : `/${hash.slice(1)}`;
  }
  if (pathname && pathname !== "/" && pathname !== "/index.html") {
    return pathname;
  }
  return "/";
}

function navigate(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const nextHash = `#${normalized}`;
  if (window.location.hash === nextHash) {
    window.dispatchEvent(new Event("hashchange"));
    return;
  }
  window.location.hash = normalized;
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

function navigateToStationFeedback(stationId, backPath = "/driver") {
  sessionStorage.setItem("driverFeedbackBack", backPath);
  navigate(`/driver/station/${stationId}/feedback`);
}

function navigateFromStationFeedbackBack() {
  const backPath = sessionStorage.getItem("driverFeedbackBack") || "/driver";
  sessionStorage.removeItem("driverFeedbackBack");
  navigate(backPath);
}

function parseDriverStationPath(path) {
  const match = path.match(/^\/driver\/station\/([^/]+)(?:\/feedback)?$/);
  if (!match) {
    return { stationId: "", isDetailPage: false, isFeedbackPage: false };
  }
  return {
    stationId: match[1],
    isDetailPage: !path.endsWith("/feedback"),
    isFeedbackPage: path.endsWith("/feedback"),
  };
}

const driverFeedbackTypeOptions = [
  "场站无法充电",
  "充电桩故障",
  "排队严重",
  "重卡无法进入",
  "地址/定位不准",
  "价格不一致",
  "场站信息不准确",
  "其他问题",
];

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
  rankCount,
  vehicleMarker,
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

  if (!fitTargets.length) return;

  fitMapWithZoomClamp(map, fitTargets, padding, MAP_OVERVIEW_MAX_ZOOM, MAP_OVERVIEW_MIN_ZOOM);
}

export function App() {
  const [path, setPath] = useState(readAppPath);
  const [stations, setStations] = useState(initialStations);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [mapConfig, setMapConfig] = useState(mapConfigDefault);

  useEffect(() => {
    const syncPath = () => setPath(readAppPath());
    const { hash, pathname } = window.location;
    if (!hash && pathname && pathname !== "/" && pathname !== "/index.html") {
      window.location.replace(`/#${pathname}`);
      return undefined;
    }
    window.addEventListener("hashchange", syncPath);
    return () => window.removeEventListener("hashchange", syncPath);
  }, []);

  const shared = {
    stations,
    setStations,
    feedback,
    setFeedback,
    mapConfig,
    setMapConfig,
  };

  if (path.startsWith("/admin")) {
    return <AdminApp path={path} {...shared} />;
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
        <p className="eyebrow">TMS 场站地图 · 第一期</p>
        <h1>司机端场站地图原型</h1>
        <p>
          基于 PRD 构建司机端地图找站与 PC 后台维护闭环。你可以维护场站、
          地图配置、导航失败和反馈处理状态，观察两端联动。
        </p>
        <div className="launch-actions">
          <button className="primary-btn" onClick={() => navigate("/driver")}>打开司机端 H5</button>
          <button className="secondary-btn" onClick={() => navigate("/admin/stations")}>打开运营后台</button>
        </div>
      </section>
    </main>
  );
}

function DriverApp({
  path = "/driver",
  stations,
  setFeedback,
  mapConfig,
}) {
  const locationMode = DRIVER_LOCATION_MODE;
  const isListPage = path === "/driver/list";
  const { stationId: detailStationId, isDetailPage, isFeedbackPage } = parseDriverStationPath(path);
  const isMapVisible = !isListPage && !isDetailPage && !isFeedbackPage;

  const driverStations = useMemo(() => sortStations(stations, locationMode), [stations, locationMode]);
  const runtimeStations = useMemo(() => driverStations.map((station) => getStationRuntime(station, locationMode)), [driverStations, locationMode]);
  const ranked = runtimeStations.slice(0, mapConfig.rankLimit);
  const [vehicleZoomMode, setVehicleZoomMode] = useState("street");
  const [followVehicle, setFollowVehicle] = useState(true);
  const [recenterTick, setRecenterTick] = useState(0);
  const [selectedId, setSelectedId] = useState(runtimeStations[0]?.id ?? stations[0].id);
  const [panel, setPanel] = useState("collapsed");
  const [toast, setToast] = useState("");
  const selected = runtimeStations.find((station) => station.id === selectedId) ?? runtimeStations[0];
  const handleMapBlankClick = useCallback(() => setPanel("collapsed"), []);
  const handleAmapStationClick = useCallback((stationId) => {
    setSelectedId(stationId);
    setPanel("station");
    setFollowVehicle(false);
  }, []);
  const handleMapUserInteract = useCallback(() => setFollowVehicle(false), []);

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
    if (!isMapVisible) return;
    setVehicleZoomMode("street");
    setFollowVehicle(true);
  }, [isMapVisible]);

  function showToast(text) {
    setToast(text);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 2600);
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
            vehicleZoomMode={vehicleZoomMode}
            followVehicle={followVehicle}
            recenterTick={recenterTick}
            locationMode={locationMode}
            mapConfig={mapConfig}
            mapActive={isMapVisible}
            onBlankClick={handleMapBlankClick}
            onStationClick={handleAmapStationClick}
            onUserMapInteract={handleMapUserInteract}
          />
          <div className="map-fade" />

          <header className="driver-map-header" onClick={(event) => event.stopPropagation()}>
            <h1>场站地图</h1>
          </header>

          <div className="map-tools" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="map-tool-btn"
              aria-label="定位"
              onClick={() => {
                setVehicleZoomMode("street");
                setFollowVehicle(true);
                setRecenterTick((tick) => tick + 1);
                showToast("已回到当前位置");
              }}
            >
              <LocateIcon />
            </button>
            <button
              type="button"
              className="map-tool-btn map-tool-btn-charge"
              aria-label="去充电"
              onClick={() => navigate("/driver/list")}
            >
              <ChargeIcon />
            </button>
          </div>

          {panel === "station" && selected && (
            <div onClick={(event) => event.stopPropagation()}>
              <StationPanel
                station={selected}
                onNavigate={() => setPanel("navigate")}
                onDetails={() => {
                  setPanel("collapsed");
                  navigateToStationDetail(selected.id, "/driver");
                }}
                onCopy={() => showToast("已复制地址")}
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
            mapConfig={mapConfig}
          />
        )}

        {isDetailPage && (
          <DriverStationDetailPage
            stationId={detailStationId}
            stations={stations}
          />
        )}

        {isFeedbackPage && (
          <DriverStationFeedbackPage
            stationId={detailStationId}
            stations={stations}
            setFeedback={setFeedback}
          />
        )}
      </section>
    </main>
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
    overlaysRef,
    vehiclePosition,
    programmaticMoveRef,
    locationMode,
    rankCount,
    vehicleZoomMode,
  },
) {
  const overlays = overlaysRef.current;
  if (!map || !AMap || !overlays.length) return;

  const vehicleMarker = overlays.find((overlay) => overlay.getExtData?.() === "vehicle");

  programmaticMoveRef.current = true;
  window.setTimeout(() => {
    programmaticMoveRef.current = false;
  }, 800);

  if (vehicleZoomMode === "street") {
    recenterOnVehicle(map, vehiclePosition, MAP_VEHICLE_PADDING, MAP_VEHICLE_ZOOM);
    return;
  }

  fitChargingOverview(map, overlays, {
    padding: MAP_VEHICLE_PADDING,
    locationMode,
    rankCount,
    vehicleMarker,
  });
}

function syncMapOverlaysRef(overlaysRef, stationMarkersRef, vehicleMarkerRef) {
  overlaysRef.current = [
    ...stationMarkersRef.current.map((item) => item.marker),
    ...(vehicleMarkerRef.current ? [vehicleMarkerRef.current] : []),
  ];
}

function AmapCanvas({
  stations,
  selectedId,
  vehicleZoomMode,
  followVehicle,
  recenterTick,
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
  const vehicleMarkerRef = useRef(null);
  const stationMarkersRef = useRef([]);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const programmaticMoveRef = useRef(false);
  const followVehicleRef = useRef(followVehicle);
  const vehicleZoomModeRef = useRef(vehicleZoomMode);
  const mapActiveRef = useRef(mapActive);
  const recenterTickRef = useRef(recenterTick);
  followVehicleRef.current = followVehicle;
  vehicleZoomModeRef.current = vehicleZoomMode;
  mapActiveRef.current = mapActive;
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
          center: vehiclePosition,
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
      position: vehiclePosition,
      zIndex: 170,
      offset: new AMap.Pixel(-VEHICLE_MARKER_SIZE / 2, -VEHICLE_MARKER_SIZE / 2),
      extData: "vehicle",
      content: buildVehicleMarkerHtml(),
    });
    vehicleMarkerRef.current = vehicleMarker;
    map.add(vehicleMarker);
    syncMapOverlaysRef(overlaysRef, stationMarkersRef, vehicleMarkerRef);
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
        offset: new AMap.Pixel(-36, -84),
        extData: "station",
        content: buildStationMarkerHtml(station, selectedIdRef.current === station.id),
      });
      map.add(marker);
      return { id: station.id, station, marker };
    });

    stationMarkersRef.current = nextMarkers;
    syncMapOverlaysRef(overlaysRef, stationMarkersRef, vehicleMarkerRef);
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
    if (loadState !== "ready" || !overlaysReady || !map || !AMap || !overlaysRef.current.length || !mapActive) return;
    if (vehicleZoomMode === "street" && !followVehicle) return;

    applyMapView(map, AMap, {
      overlaysRef,
      vehiclePosition,
      programmaticMoveRef,
      locationMode,
      rankCount: mapConfig.rankLimit,
      vehicleZoomMode,
    });
  }, [loadState, overlaysReady, followVehicle, recenterTick, vehicleZoomMode, locationMode, mapConfig, mapActive]);

  return (
    <div className="amap-layer">
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

function StationPanel({ station, onNavigate, onDetails, onCopy, onClose }) {
  return (
    <section className="station-panel">
      <button type="button" className="grabber" aria-label="收起场站卡片" onClick={onClose} />
      <h2 className="station-panel-title">{station.name}</h2>
      <dl className="station-card-info">
        <div className="station-card-info-item">
          <dt>距离</dt>
          <dd>{station.distanceText}</dd>
        </div>
        <div className="station-card-info-item">
          <dt>当前电价</dt>
          <dd>{station.priceText}</dd>
        </div>
        <div className="station-card-info-item station-card-info-address">
          <dt>地址</dt>
          <dd>{station.address}</dd>
        </div>
        <div className="station-card-info-item">
          <dt>承载量</dt>
          <dd>{station.capacityText}</dd>
        </div>
        <div className="station-card-info-item">
          <dt>充电桩</dt>
          <dd>{station.totalPiles} 台</dd>
        </div>
      </dl>
      <div className="station-actions">
        <button type="button" className="primary-btn" onClick={onNavigate}>导航</button>
        <button type="button" className="secondary-btn" onClick={onDetails}>详情</button>
        <button type="button" className="secondary-btn" onClick={onCopy}>复制地址</button>
      </div>
    </section>
  );
}

function DriverStationListPage({ stations, mapConfig }) {
  const locationMode = DRIVER_LOCATION_MODE;
  const driverStations = useMemo(() => sortStations(stations, locationMode), [stations, locationMode]);
  const runtimeStations = useMemo(() => driverStations.map((station) => getStationRuntime(station, locationMode)), [driverStations, locationMode]);
  const ranked = runtimeStations.slice(0, mapConfig.rankLimit);
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
    const distanceMatch = station.distanceValue == null || station.distanceValue <= distanceLimit;
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
              <select value={distance} aria-label="距离筛选" onChange={(event) => setDistance(event.target.value)}>
                {["10km", "20km", "50km"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
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

function DriverStationDetailPage({ stationId, stations }) {
  const locationMode = DRIVER_LOCATION_MODE;
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
          <StationDetailContent station={station} />
        ) : (
          <div className="driver-empty-state">
            <p>未找到该场站，可能已停用或不存在。</p>
            <button className="secondary-btn" type="button" onClick={navigateFromStationDetailBack}>返回</button>
          </div>
        )}
      </div>
      {station && (
        <div className="driver-detail-actions">
          <button type="button" className="primary-btn" onClick={() => setNavStation(station)}>导航</button>
          <button type="button" className="secondary-btn" onClick={() => showToast("已复制地址")}>复制地址</button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => navigateToStationFeedback(station.id, `/driver/station/${station.id}`)}
          >
            问题反馈
          </button>
        </div>
      )}
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

function DriverStationFeedbackPage({ stationId, stations, setFeedback }) {
  const locationMode = DRIVER_LOCATION_MODE;
  const driverStations = useMemo(() => sortStations(stations, locationMode), [stations, locationMode]);
  const runtimeStations = useMemo(() => driverStations.map((station) => getStationRuntime(station, locationMode)), [driverStations, locationMode]);
  const station = runtimeStations.find((item) => item.id === stationId);
  const [feedbackType, setFeedbackType] = useState("重卡无法进入");
  const [feedbackRemark, setFeedbackRemark] = useState("");
  const [toast, setToast] = useState("");

  function showToast(text) {
    setToast(text);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 2600);
  }

  function submitFeedback() {
    if (!station) return;
    setFeedback((items) => [
      {
        id: `FB${Date.now()}`,
        stationId: station.id,
        stationName: station.name,
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
    showToast(`反馈已同步至后台：${feedbackType}`);
    window.setTimeout(() => navigateFromStationFeedbackBack(), 900);
  }

  return (
    <div className="driver-list-page driver-page-overlay" aria-label="问题反馈">
      <header className="driver-page-header">
        <button type="button" className="page-back" aria-label="返回" onClick={navigateFromStationFeedbackBack}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1>问题反馈</h1>
      </header>
      <div className="driver-list-page-body driver-feedback-page-body">
        {station ? (
          <article className="driver-feedback-form">
            <div className="feedback-context">
              <span>{station.name}</span>
              <small>{context.driverId} · {context.plateNo} · {context.taskId}</small>
            </div>
            <label className="form-label" htmlFor="driver-feedback-type">反馈类型</label>
            <select
              id="driver-feedback-type"
              value={feedbackType}
              onChange={(event) => setFeedbackType(event.target.value)}
            >
              {driverFeedbackTypeOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <label className="form-label" htmlFor="driver-feedback-remark">备注</label>
            <textarea
              id="driver-feedback-remark"
              value={feedbackRemark}
              onChange={(event) => setFeedbackRemark(event.target.value)}
              placeholder="补充现场情况，例如入口限高、现场价格、排队情况"
              rows={5}
            />
            <button className="primary-btn full" type="button" onClick={submitFeedback}>提交反馈并同步后台</button>
          </article>
        ) : (
          <div className="driver-empty-state">
            <p>未找到该场站，可能已停用或不存在。</p>
            <button className="secondary-btn" type="button" onClick={navigateFromStationFeedbackBack}>返回</button>
          </div>
        )}
      </div>
      <nav className="driver-tabs">
        {["首页", "地图", "我的"].map((item) => (
          <button
            key={item}
            type="button"
            className={item === "地图" ? "active" : ""}
            onClick={() => item === "地图" && navigate("/driver")}
          >
            {item}
          </button>
        ))}
      </nav>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function LocateIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" opacity="0.45" />
    </svg>
  );
}

function ChargeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M13 2 6 14h6l-1 8 7-12h-6l1-8z"
        fill="currentColor"
      />
    </svg>
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

function StationDetailContent({ station }) {
  const mapPinStyle = stationPositions[station.id] ?? { left: "50%", top: "48%" };
  const pileCount = station.totalPiles ?? station.pileCount ?? "—";
  const pricePeriods = (station.pricePeriods || []).filter((period) => String(period.price).trim());
  const stayDurations = (station.stayDurations || []).filter((period) => String(period.durationMin).trim());

  return (
    <article className="station-detail">
      <section className="detail-section">
        <h2 className="detail-section-title">基础信息</h2>
        <dl className="detail-field-list">
          <div className="detail-field">
            <dt>场站名称</dt>
            <dd>{station.name}</dd>
          </div>
          <div className="detail-field">
            <dt>地址</dt>
            <dd>{station.address}</dd>
          </div>
          <div className="detail-field">
            <dt>所属省份 / 所属城市 / 所属区</dt>
            <dd>{station.province} / {station.city} / {station.district}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section">
        <h2 className="detail-section-title">地图预览</h2>
        <div className="detail-map-preview">
          <img src="/assets/driver-map-yuxi.png" alt={`${station.name}点位预览`} />
          <span className="detail-map-pin" style={mapPinStyle} aria-hidden="true">📍</span>
          <div className="detail-map-coords">
            <span>经度 {station.lng}</span>
            <span>纬度 {station.lat}</span>
          </div>
        </div>
      </section>

      <section className="detail-section">
        <h2 className="detail-section-title">核心信息</h2>
        <dl className="detail-field-list detail-field-grid">
          <div className="detail-field">
            <dt>当前时段电价</dt>
            <dd>{station.priceText}</dd>
          </div>
          <div className="detail-field">
            <dt>距离</dt>
            <dd>{station.distanceText}</dd>
          </div>
          <div className="detail-field">
            <dt>承载量</dt>
            <dd>{station.capacityText}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section">
        <h2 className="detail-section-title">充电信息</h2>
        <dl className="detail-field-list">
          <div className="detail-field">
            <dt>充电桩数量</dt>
            <dd>{pileCount} 台</dd>
          </div>
        </dl>
        <h3 className="detail-subsection-title">完整分时段电价</h3>
        {pricePeriods.length ? (
          <ul className="detail-kv-list">
            {pricePeriods.map((period) => (
              <li className="detail-kv-row" key={`${period.priceType}-${period.start}-${period.end}`}>
                <span>{period.priceType} {period.start}-{period.end}</span>
                <b>{period.price} 元/度</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="detail-empty-hint">暂无分时电价</p>
        )}
      </section>

      <section className="detail-section">
        <h2 className="detail-section-title">停留信息</h2>
        <h3 className="detail-subsection-title">标准停留时长</h3>
        {stayDurations.length ? (
          <ul className="detail-kv-list">
            {stayDurations.map((period) => (
              <li className="detail-kv-row" key={`${period.start}-${period.end}`}>
                <span>{period.start}-{period.end}</span>
                <b>{period.durationMin} 分钟</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="detail-empty-hint">暂无标准停留时长</p>
        )}
      </section>

      <section className="detail-section">
        <h2 className="detail-section-title">备注</h2>
        <p className="detail-remark">{station.remark?.trim() || "暂无说明"}</p>
      </section>
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

const siteMainColumns = [
  "序号", "区域名称", "区域编号", "区域类型", "类型", "收/发货类型", "所属部门", "共享模式", "半径", "经度", "纬度", "位置",
];
const siteScrollColumns = [
  "所属省份", "所属城市", "所属区", "备注", "开通状态", "账号", "修改人", "修改时间", "启用状态", "结算主体",
];
const siteChargeColumns = [
  "承载量（吨）", "充电桩数量", "电价", "标准停留时长",
];

function parseAdminRoute(path) {
  const rest = path.replace(/^\/admin\/?/, "");
  if (!rest || rest === "stations") return { page: "stations" };
  if (rest === "stations/feedback") return { page: "feedback" };
  if (rest === "stations/new") return { page: "form", mode: "new" };
  const editMatch = rest.match(/^stations\/edit\/(.+)$/);
  if (editMatch) return { page: "form", mode: "edit", id: editMatch[1] };
  if (rest === "map-settings") return { page: "map-settings" };
  return { page: "stations" };
}

function adminNavigate(subPath) {
  navigate(subPath ? `/admin/${subPath}` : "/admin/stations");
}

const adminMenuGroups = [
  {
    key: "basic",
    label: "基础信息",
    children: [{ key: "stations", label: "站点管理", path: "stations" }],
  },
  {
    key: "rules",
    label: "规则设置",
    children: [{ key: "map-settings", label: "场站地图设置", path: "map-settings" }],
  },
];

function adminPageTitle(route) {
  if (route.page === "feedback") return "查看反馈";
  if (route.page === "form") return route.mode === "new" ? "新增 / 修改站点" : "新增 / 修改站点";
  if (route.page === "map-settings") return "场站地图设置";
  return "站点管理";
}

function AdminApp({
  path = "/admin",
  stations,
  setStations,
  feedback,
  setFeedback,
  mapConfig,
  setMapConfig,
}) {
  const route = parseAdminRoute(path);
  const [banner, setBanner] = useState("");
  const [menuOpen, setMenuOpen] = useState({ basic: true, rules: true });

  function showBanner(text) {
    setBanner(text);
    window.clearTimeout(showBanner.timer);
    showBanner.timer = window.setTimeout(() => setBanner(""), 3200);
  }

  const breadcrumbs = buildAdminBreadcrumbs(route);
  const pageTitle = adminPageTitle(route);

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-brand">
          <span>TMS</span>
          <b>运输管理系统</b>
        </div>
        <button className="admin-header-link" type="button" onClick={() => navigate("/driver")}>预览司机端</button>
      </header>
      <div className="admin-body">
        <aside className="admin-sidebar">
          {adminMenuGroups.map((group) => (
            <div className="admin-menu-group" key={group.key}>
              <button
                type="button"
                className="admin-menu-group-toggle"
                onClick={() => setMenuOpen((current) => ({ ...current, [group.key]: !current[group.key] }))}
              >
                <span>{group.label}</span>
                <i>{menuOpen[group.key] ? "▾" : "▸"}</i>
              </button>
              {menuOpen[group.key] && group.children.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={isAdminMenuActive(route, item.path) ? "active" : ""}
                  onClick={() => adminNavigate(item.path)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <section className="admin-main">
          <AdminTop title={pageTitle} breadcrumbs={breadcrumbs} />
          {banner && <div className="admin-banner">{banner}</div>}
          {route.page === "stations" && (
            <SiteManagementList stations={stations} setStations={setStations} showBanner={showBanner} />
          )}
          {route.page === "feedback" && (
            <SiteFeedbackList feedback={feedback} setFeedback={setFeedback} showBanner={showBanner} />
          )}
          {route.page === "form" && (
            <SiteFormPage
              mode={route.mode}
              stationId={route.id}
              stations={stations}
              setStations={setStations}
              showBanner={showBanner}
            />
          )}
          {route.page === "map-settings" && (
            <MapConfigPanel mapConfig={mapConfig} setMapConfig={setMapConfig} showBanner={showBanner} />
          )}
        </section>
      </div>
    </main>
  );
}

function isAdminMenuActive(route, menuPath) {
  if (menuPath === "stations") {
    return route.page === "stations" || route.page === "feedback" || route.page === "form";
  }
  if (menuPath === "map-settings") return route.page === "map-settings";
  return false;
}

function buildAdminBreadcrumbs(route) {
  if (route.page === "feedback") {
    return [
      { label: "基础信息" },
      { label: "站点管理", action: () => adminNavigate("stations") },
      { label: "查看反馈", current: true },
    ];
  }
  if (route.page === "form") {
    return [
      { label: "基础信息" },
      { label: "站点管理", action: () => adminNavigate("stations") },
      { label: "新增 / 修改", current: true },
    ];
  }
  if (route.page === "map-settings") {
    return [
      { label: "规则设置" },
      { label: "场站地图设置", current: true },
    ];
  }
  return [
    { label: "基础信息" },
    { label: "站点管理", current: true },
  ];
}

function AdminTop({ title, breadcrumbs }) {
  return (
    <header className="admin-top">
      <nav className="admin-breadcrumb" aria-label="面包屑">
        {breadcrumbs.map((item, index) => (
          <span key={`${item.label}-${index}`}>
            {index > 0 && <i>/</i>}
            {item.action ? (
              <button type="button" onClick={item.action}>{item.label}</button>
            ) : (
              <span className={item.current ? "current" : ""}>{item.label}</span>
            )}
          </span>
        ))}
      </nav>
      <h1>{title}</h1>
    </header>
  );
}

const siteFilterDefaults = {
  name: "",
  code: "",
  areaTypes: [],
  department: "",
  shareModes: [],
  shipReceiveType: "",
  statuses: [],
  settlementEntity: "",
};

const areaTypeOptions = ["点", "区域", "行政区域"];
const shareModeOptions = ["全局", "部门", "个人"];
const statusOptions = ["未开通", "未登录", "已登录", "已停用"];

function FilterMultiSelect({ label, value, options, onChange, placeholder = "请选择" }) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const rootRef = useRef(null);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const visibleOptions = options.filter((option) => option.includes(keyword.trim()));
  const allSelected = visibleOptions.length > 0 && visibleOptions.every((option) => value.includes(option));
  const displayText = value.length === 0 ? placeholder : value.join("、");

  function toggleOption(option) {
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
  }

  function toggleAll() {
    if (allSelected) {
      onChange(value.filter((item) => !visibleOptions.includes(item)));
      return;
    }
    onChange([...new Set([...value, ...visibleOptions])]);
  }

  return (
    <div className="filter-multiselect" ref={rootRef}>
      <span className="filter-multiselect-label">{label}</span>
      <button type="button" className={`filter-multiselect-trigger ${open ? "open" : ""}`} onClick={() => setOpen((current) => !current)}>
        <span className={value.length === 0 ? "placeholder" : ""}>{displayText}</span>
        <i>{open ? "▴" : "▾"}</i>
      </button>
      {open && (
        <div className="filter-multiselect-panel">
          <div className="filter-multiselect-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="请输入关键字搜索"
            />
          </div>
          <div className="filter-multiselect-options">
            <button type="button" className="filter-multiselect-option" onClick={toggleAll}>
              <input type="checkbox" readOnly tabIndex={-1} checked={allSelected} />
              <span>全选</span>
            </button>
            {visibleOptions.map((option) => (
              <button
                type="button"
                key={option}
                className="filter-multiselect-option"
                onClick={() => toggleOption(option)}
              >
                <input type="checkbox" readOnly tabIndex={-1} checked={value.includes(option)} />
                <span>{option}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SiteManagementList({ stations, setStations, showBanner }) {
  const [filters, setFilters] = useState(siteFilterDefaults);
  const [appliedFilters, setAppliedFilters] = useState(siteFilterDefaults);

  function deleteStation(station) {
    setStations((items) => items.filter((item) => item.id !== station.id));
    showBanner(`已删除：${station.name}`);
  }

  function toggleStationStatus(station) {
    const isEnabled = (station.enabledStatus || (station.status === "正常" ? "启用" : "停用")) === "启用";
    const nextEnabled = isEnabled ? "停用" : "启用";
    const statusFields = syncStationStatusFields(nextEnabled, station.accountStatus);
    setStations((items) => items.map((item) => (
      item.id === station.id
        ? {
          ...item,
          ...statusFields,
          updatedAt: "2026-07-07 10:30",
          editor: "张运营",
        }
        : item
    )));
    showBanner(`${station.name} 已${nextEnabled}`);
  }

  const filtered = useMemo(() => stations.filter((station) => {
    if (appliedFilters.name && !station.name.includes(appliedFilters.name)) return false;
    if (appliedFilters.code && !station.code.includes(appliedFilters.code)) return false;
    if (appliedFilters.areaTypes.length > 0 && !appliedFilters.areaTypes.includes(station.areaType)) return false;
    if (appliedFilters.department && station.department !== appliedFilters.department) return false;
    if (appliedFilters.shareModes.length > 0 && !appliedFilters.shareModes.includes(station.shareMode)) return false;
    if (appliedFilters.shipReceiveType && station.shipReceiveType !== appliedFilters.shipReceiveType) return false;
    if (appliedFilters.statuses.length > 0 && !appliedFilters.statuses.includes(station.accountStatus)) return false;
    if (appliedFilters.settlementEntity && !station.settlementEntity.includes(appliedFilters.settlementEntity)) return false;
    return true;
  }), [stations, appliedFilters]);

  function renderSiteCell(station, index, column) {
    switch (column) {
      case "序号":
        return index + 1;
      case "区域名称":
        return station.name;
      case "区域编号":
        return station.code;
      case "区域类型":
        return station.areaType;
      case "类型":
        return station.stationType;
      case "收/发货类型":
        return station.shipReceiveType;
      case "所属部门":
        return station.department;
      case "共享模式":
        return station.shareMode;
      case "半径":
        return station.radius;
      case "经度":
        return station.lng;
      case "纬度":
        return station.lat;
      case "位置":
        return <span className="cell-address">{station.address}</span>;
      case "所属省份":
        return station.province;
      case "所属城市":
        return station.city;
      case "所属区":
        return station.district;
      case "备注":
        return station.remark ? <span className="cell-remark">{station.remark}</span> : "—";
      case "开通状态":
        return station.openStatus;
      case "账号":
        return station.account;
      case "修改人":
        return station.editor;
      case "修改时间":
        return station.updatedAt;
      case "启用状态":
        return <span className={`status ${station.enabledStatus === "启用" ? "ok" : "off"}`}>{station.enabledStatus}</span>;
      case "结算主体":
        return station.settlementEntity;
      case "承载量（吨）":
        return station.capacityText.replace(" 吨", "");
      case "充电桩数量":
        return station.totalPiles;
      case "电价":
        return station.priceText;
      case "标准停留时长":
        return station.stayDurationText;
      default:
        return "—";
    }
  }

  return (
    <section className="site-management">
      <article className="table-card">
        <header className="table-toolbar">
          <p className="table-desc">继续用于维护平台站点基础数据。本期充电场站地图功能复用该页面中的充电场站数据，司机端仅展示满足条件的正常充电场站。</p>
          <div className="table-toolbar-actions">
            <button className="secondary-btn" type="button" onClick={() => adminNavigate("stations/feedback")}>查看反馈</button>
            <button className="secondary-btn" type="button" onClick={() => showBanner("Excel 导入失败：分时电价未覆盖 00:00-24:00")}>导入</button>
            <button className="primary-btn" type="button" onClick={() => adminNavigate("stations/new")}>新增</button>
          </div>
        </header>

        <form
          className="filter-form"
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedFilters({ ...filters });
          }}
        >
          <label><span>区域名称</span><input placeholder="站点/场站名称" value={filters.name} onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))} /></label>
          <label><span>区域编号</span><input value={filters.code} onChange={(e) => setFilters((f) => ({ ...f, code: e.target.value }))} /></label>
          <FilterMultiSelect
            label="区域类型"
            value={filters.areaTypes}
            options={areaTypeOptions}
            onChange={(areaTypes) => setFilters((f) => ({ ...f, areaTypes }))}
          />
          <label>
            <span>所属部门</span>
            <select value={filters.department} onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}>
              <option value="">全部</option>
              <option value="玉溪运营部">玉溪运营部</option>
            </select>
          </label>
          <FilterMultiSelect
            label="共享模式"
            value={filters.shareModes}
            options={shareModeOptions}
            onChange={(shareModes) => setFilters((f) => ({ ...f, shareModes }))}
          />
          <label>
            <span>收/发货类型</span>
            <select value={filters.shipReceiveType} onChange={(e) => setFilters((f) => ({ ...f, shipReceiveType: e.target.value }))}>
              <option value="">全部</option>
              <option value="收/发货">收/发货</option>
            </select>
          </label>
          <FilterMultiSelect
            label="状态"
            value={filters.statuses}
            options={statusOptions}
            onChange={(statuses) => setFilters((f) => ({ ...f, statuses }))}
          />
          <label><span>结算主体</span><input value={filters.settlementEntity} onChange={(e) => setFilters((f) => ({ ...f, settlementEntity: e.target.value }))} /></label>
          <div className="filter-form-actions">
            <button type="button" className="secondary-btn" onClick={() => { setFilters(siteFilterDefaults); setAppliedFilters(siteFilterDefaults); }}>重置</button>
            <button type="submit" className="primary-btn">查询</button>
          </div>
        </form>

        <div className="table-scroll-wrap">
          <table className="site-table">
            <thead>
              <tr>
                {siteMainColumns.map((label) => (
                  <th
                    key={`main-${label}`}
                    className={label === "序号" ? "sticky-col" : label === "区域名称" ? "sticky-col-2" : ""}
                  >
                    {label}
                  </th>
                ))}
                {siteScrollColumns.map((label) => <th key={`scroll-${label}`}>{label}</th>)}
                {siteChargeColumns.map((label) => <th key={`charge-${label}`}>{label}</th>)}
                <th className="sticky-col-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((station, index) => {
                const isEnabled = (station.enabledStatus || (station.status === "正常" ? "启用" : "停用")) === "启用";
                return (
                <tr key={station.id}>
                  {siteMainColumns.map((column) => (
                    <td
                      key={`${station.id}-${column}`}
                      className={column === "序号" ? "sticky-col" : column === "区域名称" ? "sticky-col-2" : column === "位置" ? "cell-address" : ""}
                    >
                      {renderSiteCell(station, index, column)}
                    </td>
                  ))}
                  {siteScrollColumns.map((column) => (
                    <td key={`${station.id}-${column}`}>{renderSiteCell(station, index, column)}</td>
                  ))}
                  {siteChargeColumns.map((column) => (
                    <td key={`${station.id}-${column}`}>{renderSiteCell(station, index, column)}</td>
                  ))}
                  <td className="sticky-col-right row-actions">
                    <div className="row-actions-inner">
                      <button type="button" className="link-btn" onClick={() => adminNavigate(`stations/edit/${station.id}`)}>修改</button>
                      <button
                        type="button"
                        className={isEnabled ? "link-btn warn" : "link-btn"}
                        onClick={() => toggleStationStatus(station)}
                      >
                        {isEnabled ? "停用" : "启用"}
                      </button>
                      <button type="button" className="link-btn danger" onClick={() => deleteStation(station)}>删除</button>
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
        <footer className="table-footer">共 {filtered.length} 条</footer>
      </article>
    </section>
  );
}

function SiteFeedbackList({ feedback, setFeedback, showBanner }) {
  function updateStatus(id, status) {
    setFeedback((items) => items.map((item) => (
      item.id === id ? { ...item, status, handler: "运营-王" } : item
    )));
    showBanner(`反馈已更新为：${status}`);
  }

  return (
    <section className="site-feedback-page">
      <article className="table-card">
        <header className="table-toolbar">
          <p className="table-desc">司机端提交的场站相关反馈。</p>
          <div className="table-toolbar-actions">
            <button className="secondary-btn" type="button" onClick={() => adminNavigate("stations")}>返回站点管理</button>
          </div>
        </header>
        <table className="feedback-table">
          <thead>
            <tr>
              <th>序号</th>
              <th>反馈编号</th>
              <th>反馈类型</th>
              <th>反馈内容</th>
              <th>关联场站</th>
              <th>车辆</th>
              <th>任务编号</th>
              <th>提交时间</th>
              <th>处理人</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {feedback.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>{item.id}</td>
                <td><span className="tag">{item.type}</span></td>
                <td className="cell-remark">{item.remark}</td>
                <td>{item.stationName}</td>
                <td>{item.vehicle}</td>
                <td>{item.task}</td>
                <td>{item.submittedAt}</td>
                <td>{item.handler || "—"}</td>
                <td><span className={`validate ${item.status === "已处理" ? "done" : ""}`}>{item.status}</span></td>
                <td className="row-actions">
                  <button type="button" onClick={() => updateStatus(item.id, "处理中")}>处理</button>
                  <button type="button" onClick={() => updateStatus(item.id, "已处理")}>完成</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}

const emptySiteForm = {
  name: "",
  autoCode: "",
  code: "",
  areaType: "点",
  stationType: "充电站",
  shipReceiveType: "收/发货",
  capacityText: "",
  department: "玉溪运营部",
  shareMode: "全局",
  radius: 500,
  pricePeriods: [createPricePeriod()],
  totalPiles: 4,
  stayDurations: [createStayDuration({ durationMin: 60 })],
  settlementEntity: "玉溪物流能源有限公司",
  lng: "",
  lat: "",
  address: "",
  province: "云南省",
  city: "玉溪市",
  district: "",
  remark: "",
  status: "正常",
  accountStatus: "已登录",
  enabledStatus: "启用",
  openStatus: "已开通",
  account: "tms_yx_ops",
  editor: "张运营",
  validation: "待校验",
  availablePiles: 4,
  pileCount: 4,
  shortName: "",
  drivingKm: null,
  straightKm: null,
  durationMin: 20,
  routeNearbyFlag: false,
  speedLabel: "快充",
  updatedAt: "2026-07-07 10:30",
};

function SiteFormPage({ mode, stationId, stations, setStations, showBanner }) {
  const existing = mode === "edit" ? stations.find((item) => item.id === stationId) : null;
  const [form, setForm] = useState(() => (
    existing
      ? {
        ...existing,
        capacityTon: existing.capacityText.replace(/[^\d.]/g, "") || "",
        enabledStatus: existing.enabledStatus || (existing.status === "正常" ? "启用" : "停用"),
        pricePeriods: existing.pricePeriods?.length ? existing.pricePeriods : [createPricePeriod()],
        stayDurations: existing.stayDurations?.length ? existing.stayDurations : [createStayDuration({ durationMin: 45 })],
      }
      : { ...emptySiteForm, capacityTon: "" }
  ));

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updatePricePeriod(index, key, value) {
    setForm((current) => ({
      ...current,
      pricePeriods: current.pricePeriods.map((period, itemIndex) => (
        itemIndex === index ? { ...period, [key]: value } : period
      )),
    }));
  }

  function updateStayDuration(index, key, value) {
    setForm((current) => ({
      ...current,
      stayDurations: current.stayDurations.map((period, itemIndex) => (
        itemIndex === index ? { ...period, [key]: value } : period
      )),
    }));
  }

  function addPricePeriod() {
    setForm((current) => ({
      ...current,
      pricePeriods: [...current.pricePeriods, createPricePeriod()],
    }));
  }

  function removePricePeriod(index) {
    setForm((current) => ({
      ...current,
      pricePeriods: current.pricePeriods.length > 1
        ? current.pricePeriods.filter((_, itemIndex) => itemIndex !== index)
        : current.pricePeriods,
    }));
  }

  function addStayDuration() {
    setForm((current) => ({
      ...current,
      stayDurations: [...current.stayDurations, createStayDuration()],
    }));
  }

  function removeStayDuration(index) {
    setForm((current) => ({
      ...current,
      stayDurations: current.stayDurations.length > 1
        ? current.stayDurations.filter((_, itemIndex) => itemIndex !== index)
        : current.stayDurations,
    }));
  }

  function updateEnabledStatus(enabledStatus) {
    setForm((current) => ({
      ...current,
      ...syncStationStatusFields(enabledStatus, current.accountStatus),
    }));
  }

  function handleSave() {
    if (!form.name.trim()) {
      showBanner("请填写站点名称");
      return;
    }
    if (!form.capacityTon) {
      showBanner("承载量为必填项");
      return;
    }
    if (!form.lng || !form.lat) {
      showBanner("请维护经纬度，用于地图展示与导航");
      return;
    }
    if (!form.pricePeriods.some((period) => String(period.price).trim())) {
      showBanner("请至少维护一条充电价格");
      return;
    }
    if (!form.totalPiles) {
      showBanner("请填写充电桩数量");
      return;
    }
    if (!form.stayDurations.some((period) => String(period.durationMin).trim())) {
      showBanner("请至少维护一条标准停留时长");
      return;
    }

    const pricePeriods = form.pricePeriods.map((period) => ({
      ...period,
      price: String(period.price).trim(),
    }));
    const stayDurations = form.stayDurations.map((period) => ({
      ...period,
      durationMin: Number(period.durationMin),
    }));
    const priceText = derivePriceText(pricePeriods);
    const stayDurationText = deriveStayDurationText(stayDurations);
    const statusFields = syncStationStatusFields(form.enabledStatus, form.accountStatus);

    const payload = {
      ...form,
      ...statusFields,
      pricePeriods,
      stayDurations,
      priceText,
      stayDurationText,
      shortName: form.shortName || form.name.slice(0, 6),
      capacityText: `${form.capacityTon} 吨`,
      pileCount: Number(form.totalPiles),
      availablePiles: Number(form.availablePiles ?? form.totalPiles),
      lng: Number(form.lng),
      lat: Number(form.lat),
      radius: Number(form.radius),
      totalPiles: Number(form.totalPiles),
      updatedAt: "2026-07-07 10:30",
      editor: "张运营",
      validation: priceText.includes("暂无") ? "待补价格" : "已校验",
    };

    if (mode === "edit" && existing) {
      setStations((items) => items.map((item) => (item.id === existing.id ? { ...item, ...payload } : item)));
      showBanner(`${form.name} 已保存`);
      adminNavigate("stations");
      return;
    }

    const newId = `ST${String(stations.length + 1).padStart(3, "0")}`;
    setStations((items) => [...items, {
      ...payload,
      id: newId,
      code: form.code || `CS${String(stations.length + 236).padStart(6, "0")}`,
    }]);
    showBanner("新站点已创建");
    adminNavigate("stations");
  }

  return (
    <section className="site-form-page">
      <article className="operation-card site-form-card">
        <header className="site-form-head">
          <p className="table-desc">沿用现有地图标注能力，运营人员可通过地图标注或经纬度字段维护站点位置。司机端使用经纬度进行地图点位展示、距离计算和外部导航。</p>
          <div className="table-toolbar-actions">
            <button className="secondary-btn" type="button" onClick={() => adminNavigate("stations")}>取消</button>
            <button className="primary-btn" type="button" onClick={handleSave}>保存</button>
          </div>
        </header>

        <div className="site-form-layout">
          <div className="site-form-fields">
            <div className="form-grid">
              <label><span>名称 <em>*</em></span><input value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="司机端展示为场站名称" /></label>
              <label><span>自编号</span><input value={form.autoCode} onChange={(e) => updateField("autoCode", e.target.value)} /></label>
              <label>
                <span>类型</span>
                <select value={form.stationType} onChange={(e) => updateField("stationType", e.target.value)}>
                  <option value="充电站">充电站</option>
                  <option value="换电站">换电站</option>
                  <option value="物流园">物流园</option>
                </select>
              </label>
              <label>
                <span>启用状态 <em>*</em></span>
                <select value={form.enabledStatus} onChange={(e) => updateEnabledStatus(e.target.value)}>
                  <option value="启用">启用</option>
                  <option value="停用">停用</option>
                </select>
              </label>
              <p className="form-field-hint span-2">停用后司机端地图与列表不再展示该场站，列表中的开通状态、启用状态会同步更新。</p>
              <label><span>承载量 <em>*</em></span><input value={form.capacityTon} onChange={(e) => updateField("capacityTon", e.target.value)} placeholder="必填，单位：吨" /></label>
              <label>
                <span>所属部门</span>
                <select value={form.department} onChange={(e) => updateField("department", e.target.value)}>
                  <option value="玉溪运营部">玉溪运营部</option>
                </select>
              </label>
              <label>
                <span>共享模式</span>
                <select value={form.shareMode} onChange={(e) => updateField("shareMode", e.target.value)}>
                  <option value="全局">全局</option>
                  <option value="部门">部门</option>
                  <option value="个人">个人</option>
                </select>
              </label>
              <label><span>半径</span><input type="number" value={form.radius} onChange={(e) => updateField("radius", e.target.value)} placeholder="后台保留，司机端第一期不使用" /></label>

              <div className="period-editor span-2">
                <div className="period-editor-head">
                  <span>充电价格 <em>*</em></span>
                  <button type="button" className="period-add-btn" onClick={addPricePeriod} aria-label="添加充电价格">+</button>
                </div>
                <div className="period-editor-rows">
                  {form.pricePeriods.map((period, index) => (
                    <div className="period-editor-row" key={`price-${index}`}>
                      <select value={period.priceType} onChange={(e) => updatePricePeriod(index, "priceType", e.target.value)}>
                        {priceTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                      <input type="time" value={period.start} onChange={(e) => updatePricePeriod(index, "start", e.target.value)} />
                      <span className="period-range-sep">至</span>
                      <input type="time" value={period.end} onChange={(e) => updatePricePeriod(index, "end", e.target.value)} />
                      <div className="period-value-input">
                        <input type="number" step="0.01" min="0" value={period.price} onChange={(e) => updatePricePeriod(index, "price", e.target.value)} placeholder="0.8" />
                        <i>元</i>
                      </div>
                      <button type="button" className="period-remove-btn" onClick={() => removePricePeriod(index)} aria-label="删除充电价格">×</button>
                    </div>
                  ))}
                </div>
              </div>

              <label className="period-single-field">
                <span>充电桩数量 <em>*</em></span>
                <div className="period-value-input">
                  <input type="number" min="1" value={form.totalPiles} onChange={(e) => updateField("totalPiles", e.target.value)} />
                  <i>台</i>
                </div>
              </label>

              <div className="period-editor span-2">
                <div className="period-editor-head">
                  <span>标准停留时长 <em>*</em></span>
                  <button type="button" className="period-add-btn" onClick={addStayDuration} aria-label="添加标准停留时长">+</button>
                </div>
                <div className="period-editor-rows">
                  {form.stayDurations.map((period, index) => (
                    <div className="period-editor-row stay-row" key={`stay-${index}`}>
                      <input type="time" value={period.start} onChange={(e) => updateStayDuration(index, "start", e.target.value)} />
                      <span className="period-range-sep">至</span>
                      <input type="time" value={period.end} onChange={(e) => updateStayDuration(index, "end", e.target.value)} />
                      <div className="period-value-input">
                        <input type="number" min="1" value={period.durationMin} onChange={(e) => updateStayDuration(index, "durationMin", e.target.value)} placeholder="60" />
                        <i>min</i>
                      </div>
                      <button type="button" className="period-remove-btn" onClick={() => removeStayDuration(index)} aria-label="删除标准停留时长">×</button>
                    </div>
                  ))}
                </div>
              </div>

              <label><span>结算主体名称</span><input value={form.settlementEntity} onChange={(e) => updateField("settlementEntity", e.target.value)} /></label>
              <label><span>经度 <em>*</em></span><input value={form.lng} onChange={(e) => updateField("lng", e.target.value)} /></label>
              <label><span>纬度 <em>*</em></span><input value={form.lat} onChange={(e) => updateField("lat", e.target.value)} /></label>
              <label className="span-2"><span>位置</span><input value={form.address} onChange={(e) => updateField("address", e.target.value)} placeholder="地址展示、复制地址、导航使用" /></label>
              <label><span>所属省份</span><input value={form.province} onChange={(e) => updateField("province", e.target.value)} /></label>
              <label><span>所属城市</span><input value={form.city} onChange={(e) => updateField("city", e.target.value)} /></label>
              <label><span>所属区</span><input value={form.district} onChange={(e) => updateField("district", e.target.value)} /></label>
              <label className="span-2"><span>备注</span><textarea rows={3} value={form.remark} onChange={(e) => updateField("remark", e.target.value)} placeholder="详情页展示为进站说明 / 注意事项" /></label>
            </div>
          </div>

          <aside className="site-form-map">
            <h3>地图标注</h3>
            <div className="map-annotate-panel">
              <img src="/assets/driver-map-yuxi.png" alt="站点地图标注" />
              {form.lng && form.lat && (
                <span className="map-pin" style={{ left: "52%", top: "48%" }} aria-hidden="true">📍</span>
              )}
              {form.radius && <span className="map-radius-circle" aria-hidden="true" />}
              <div className="map-radius-hint">
                <b>半径范围 {form.radius}m</b>
                <small>后台保留地图范围展示；司机端第一期不使用半径做场站范围展示、到站识别或充电状态判断</small>
              </div>
            </div>
            <div className="map-coord-preview">
              <span>经度 {form.lng || "—"}</span>
              <span>纬度 {form.lat || "—"}</span>
            </div>
          </aside>
        </div>
      </article>
    </section>
  );
}

function MapConfigPanel({ mapConfig, setMapConfig, showBanner }) {
  const fields = [
    ["rankLimit", "距离排名数量", 1, 10, "个"],
    ["manualRefreshCooldownSeconds", "手动刷新限制时间", 5, 60, "秒"],
  ];
  return (
    <section className="operation-card config-card">
      <p className="table-desc">配置司机端地图展示相关规则。</p>
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
      <button className="primary-btn" type="button" onClick={() => showBanner("地图配置已保存，发布同步后司机端刷新生效")}>保存配置</button>
    </section>
  );
}
