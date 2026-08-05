import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
// 车队长端已拆分为独立模块，便于后续迁移到 uni-app 微信小程序。
import { FleetLeaderApp } from "./fleet/FleetLeaderApp.jsx";

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

  useEffect(() => {
    let active = true;
    fetch("/api/stations")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("加载站点失败"))))
      .then((items) => {
        if (active && Array.isArray(items) && items.length) setStations(items);
      })
      .catch(() => {
        // The driver prototype remains available when the local admin API is offline.
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const syncPath = () => setPath(readAppPath());
    const { hash, pathname } = window.location;
    if (!hash && pathname && pathname !== "/" && pathname !== "/index.html") {
      window.location.replace("/#/admin");
      return undefined;
    }
    window.addEventListener("hashchange", syncPath);
    return () => window.removeEventListener("hashchange", syncPath);
  }, []);

  const shared = { stations, setStations, mapConfig: mapConfigDefault };
  if (path.startsWith("/driver")) return <DriverApp path={path} {...shared} />;
  if (path.startsWith("/fleet")) return <FleetLeaderApp />;
  return <AdminSourceFrame path={path} />;
}

function AdminSourceFrame({ path }) {
  const adminHash = path === "/admin/cycles"
    ? "circle-report"
    : path === "/admin/stations"
      ? "station-management"
      : "fence-list";
  return (
    <main className="admin-source-stage">
      <iframe title="TMS 运输管理后台" src={`/admin/index.html#${adminHash}`} />
    </main>
  );
}


function DriverApp({
  path = "/driver",
  stations,
  mapConfig,
}) {
  const locationMode = DRIVER_LOCATION_MODE;
  const [showStationList, setShowStationList] = useState(path === "/driver/list");
  const isMapVisible = !showStationList;

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
    if (path === "/driver/list") {
      setShowStationList(true);
      navigate("/driver");
    }
  }, [path]);

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
    const legacyDetailMatch = path.match(/^\/driver\/station\/([^/]+)$/);
    if (legacyDetailMatch) {
      returnToDriverMap({ selectedId: legacyDetailMatch[1], panel: "station" });
    }
  }, [path]);

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
              onClick={() => setShowStationList(true)}
            >
              <ChargeIcon />
            </button>
          </div>

          {panel === "station" && selected && (
            <div onClick={(event) => event.stopPropagation()}>
              <StationPanel
                station={selected}
                onNavigate={() => setPanel("navigate")}
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

        {showStationList && (
          <DriverStationListPage
            stations={stations}
            mapConfig={mapConfig}
            onClose={() => setShowStationList(false)}
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

function StationPanel({ station, onNavigate, onCopy, onClose }) {
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
          <dt>充电桩</dt>
          <dd>{station.totalPiles} 台</dd>
        </div>
      </dl>
      <div className="station-actions">
        <button type="button" className="primary-btn" onClick={onNavigate}>导航</button>
        <button type="button" className="secondary-btn" onClick={onCopy}>复制地址</button>
      </div>
    </section>
  );
}

function DriverStationListPage({ stations, mapConfig, onClose }) {
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
    <div
      className="driver-list-page driver-page-overlay"
      aria-label="场站列表"
      onClick={(event) => event.stopPropagation()}
    >
          <header className="driver-page-header">
            <button type="button" className="page-back" aria-label="返回" onClick={onClose}>
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
                    <div className="driver-list-main">
                      <b>{rank > 0 && <em>{rank}</em>}{station.name}</b>
                      <small>{station.distanceText}｜当前 {station.priceText}｜充电桩 {station.totalPiles} 台</small>
                      <small>{station.address}</small>
                    </div>
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
                type="button"
                className={item === "地图" ? "active" : ""}
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
