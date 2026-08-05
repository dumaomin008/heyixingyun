import { useEffect, useMemo, useState } from "react";
import { House, Truck, UserRound } from "lucide-react";
import {
  countByStatus,
  fleetVehicles as seedVehicles,
  getTodaySummary,
} from "./data.js";
import { HomePage } from "./pages/HomePage.jsx";
import { MonitorPage } from "./pages/MonitorPage.jsx";
import { ProfilePage } from "./pages/ProfilePage.jsx";
import { VehicleListPage } from "./pages/VehicleListPage.jsx";
import { RealtimeDataPage } from "./pages/RealtimeDataPage.jsx";
import { TrackPlaybackPage } from "./pages/TrackPlaybackPage.jsx";
import { ChargingLogPage, ChargingSpotPage, DrivingLogPage, TripTrackPage } from "./pages/LogPages.jsx";
import { AlertCenterPage, SafetyAlertPage, SocAlertPage } from "./pages/AlertPages.jsx";
import { DailyReportPage, RawDataPage } from "./pages/ReportPages.jsx";
import { VehicleTaskPage } from "./pages/VehicleTaskPage.jsx";
import { defaultScopeSelection, scopeMatchesVehicle } from "./scope.js";
import { getMapSafetyAlerts, sortAlerts } from "./alerts.js";
import { getFleetStations } from "./stations.js";
import { StationListPage } from "./pages/StationListPage.jsx";
import "./fleet.css";

const TABS = [
  { id: "home", label: "首页", Icon: House },
  { id: "monitor", label: "监控", Icon: Truck },
  { id: "profile", label: "我的", Icon: UserRound },
];

export function FleetLeaderApp() {
  const vehicles = seedVehicles;
  const [activeTab, setActiveTab] = useState("monitor");
  const [filter, setFilter] = useState("all");
  const [taskFilter, setTaskFilter] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState(seedVehicles[0].id);
  const [lastRefreshedAt, setLastRefreshedAt] = useState("刚刚");
  const [handledAlertIds, setHandledAlertIds] = useState([]);
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);
  const [toast, setToast] = useState("");
  const [scopeSelection, setScopeSelection] = useState(defaultScopeSelection);
  const [stations, setStations] = useState([]);
  const [mapStationSelection, setMapStationSelection] = useState(null);
  const [mapSafetyAlertSelection, setMapSafetyAlertSelection] = useState(null);
  const [acknowledgedSafetyAlertIds, setAcknowledgedSafetyAlertIds] = useState([]);

  // 页面栈：支持从任意入口进入二级页面后逐级返回。
  const [stack, setStack] = useState([]);
  const top = stack[stack.length - 1] ?? null;

  const scopedVehicles = useMemo(
    () => vehicles.filter((vehicle) => scopeMatchesVehicle(vehicle, scopeSelection)),
    [vehicles, scopeSelection],
  );
  const counts = useMemo(() => countByStatus(scopedVehicles), [scopedVehicles]);
  const summary = useMemo(() => getTodaySummary(scopedVehicles), [scopedVehicles]);

  const visibleVehicles = useMemo(() => {
    const key = keyword.trim().toLowerCase();
    return scopedVehicles.filter((vehicle) => {
      const statusMatch = filter === "all" || vehicle.onlineStatus === filter;
      const taskMatch = taskFilter === "all" || vehicle.tmsTaskStatus === taskFilter;
      const keywordMatch = !key || `${vehicle.plate}${vehicle.trailerPlate}${vehicle.driverName}${vehicle.vin}${vehicle.model}`.toLowerCase().includes(key);
      return statusMatch && taskMatch && keywordMatch;
    });
  }, [scopedVehicles, filter, taskFilter, keyword]);

  const mapVehicles = useMemo(
    () => visibleVehicles.filter((vehicle) => vehicle.onlineStatus !== "从未上线"),
    [visibleVehicles],
  );

  const selectedVehicle = mapVehicles.find((vehicle) => vehicle.id === selectedId) ?? mapVehicles[0] ?? null;
  const fleetStations = useMemo(() => getFleetStations(stations), [stations]);
  const alerts = useMemo(
    () => sortAlerts(scopedVehicles.filter((vehicle) => vehicle.alert && !handledAlertIds.includes(vehicle.id))),
    [scopedVehicles, handledAlertIds],
  );
  const mapSafetyAlerts = useMemo(() => getMapSafetyAlerts(scopedVehicles), [scopedVehicles]);

  useEffect(() => {
    let active = true;
    fetch("/api/stations")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("加载场站失败"))))
      .then((items) => {
        if (active && Array.isArray(items)) setStations(items);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (mapVehicles.length && !mapVehicles.some((vehicle) => vehicle.id === selectedId)) {
      setSelectedId(mapVehicles[0].id);
    }
  }, [mapVehicles, selectedId]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // 二级页与底部 Tab 切换时始终从首屏开始，避免地图页操作后继承旧滚动位置。
  useEffect(() => {
    if (!top) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return undefined;
    }
    let secondFrame;
    const resetViewportScroll = () => window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const lockViewportScroll = () => {
      if (window.scrollY !== 0) resetViewportScroll();
    };
    // 二级页自身使用独立滚动容器，外层页面不能因地图或焦点重排而发生滚动。
    window.addEventListener("scroll", lockViewportScroll, { passive: true });
    const frame = window.requestAnimationFrame(() => {
      resetViewportScroll();
      secondFrame = window.requestAnimationFrame(() => {
        // 点击底部信息窗的快捷入口后，浏览器会在首帧补做一次焦点滚动；第二帧再归零，保证返回栏始终露出。
        resetViewportScroll();
        const content = document.querySelector(".fleet-detail-body, .fleet-page-body");
        if (content) content.scrollTop = 0;
      });
    });
    // 某些浏览器及异步地图会在首屏渲染后继续滚动此前的聚焦元素；在入场动画内短暂复位，确保页头不被裁切。
    const scrollRecovery = window.setInterval(resetViewportScroll, 60);
    const stopScrollRecovery = window.setTimeout(() => window.clearInterval(scrollRecovery), 620);
    return () => {
      window.cancelAnimationFrame(frame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      window.clearInterval(scrollRecovery);
      window.clearTimeout(stopScrollRecovery);
      window.removeEventListener("scroll", lockViewportScroll);
    };
  }, [activeTab, top?.page]);

  function pushPage(page, vehicle, payload) {
    setStack((current) => [...current, { page, vehicle: vehicle ?? null, payload: payload ?? null }]);
  }

  function popPage() {
    setStack((current) => current.slice(0, -1));
  }

  function focusVehicleOnMonitor(vehicle) {
    setSelectedId(vehicle.id);
    setStack([]);
    setActiveTab("monitor");
  }

  function handleQuickAction(id) {
    if (id === "monitor") {
      setActiveTab("monitor");
      return;
    }
    if (id === "driving-logs") {
      pushPage(id, selectedVehicle ?? scopedVehicles[0], { todayOnly: true });
      return;
    }
    if (id === "today-charging-logs") {
      pushPage("charging-logs", selectedVehicle ?? scopedVehicles[0], { todayOnly: true });
      return;
    }
    if (id === "vehicle-list") {
      pushPage("vehicle-list", null, { showFilters: true });
      return;
    }
    if (id === "charging-logs" || id === "daily-report") {
      // 这三个入口以当前选中车辆为默认对象，未选中时回落到第一辆车。
      pushPage(id, selectedVehicle ?? scopedVehicles[0]);
      return;
    }
    pushPage(id);
  }

  // 车辆运行分析的五项指标共用车辆列表页，仅传入标题和默认状态筛选。
  function openVehicleList(initialFilter = "all", title = "车辆列表") {
    pushPage("vehicle-list", null, { initialFilter, title, showFilters: false });
  }

  function handleBusinessAction(id, label) {
    if (id === "alerts") {
      pushPage("alerts");
      return;
    }
    if (id === "vehicle-list") {
      pushPage("vehicle-list", null, { showFilters: true });
      return;
    }
    if (id === "charging") {
      pushPage("charging-logs", selectedVehicle ?? scopedVehicles[0]);
      return;
    }
    setToast(`「${label}」入口已保留，等待业务模块接入`);
  }

  function renderStackPage() {
    if (!top) return null;
    const vehicle = top.vehicle ?? selectedVehicle ?? scopedVehicles[0] ?? vehicles[0];

    switch (top.page) {
      case "vehicle-list":
        return <VehicleListPage vehicles={scopedVehicles} title={top.payload?.title ?? "车辆列表"} initialFilter={top.payload?.initialFilter ?? "all"} showFilters={Boolean(top.payload?.showFilters)} onBack={popPage} onOpenVehicle={focusVehicleOnMonitor} />;
      case "realtime-data":
        return <RealtimeDataPage vehicle={vehicle} onBack={popPage} onOpenPage={(page, target) => pushPage(page, target ?? vehicle)} />;
      case "track":
        return <TrackPlaybackPage vehicle={vehicle} initialSelection={top.payload} onBack={popPage} />;
      case "vehicle-tasks":
        return <VehicleTaskPage vehicle={vehicle} onBack={popPage} />;
      case "driving-logs":
        return <DrivingLogPage vehicle={vehicle} vehicles={scopedVehicles} todayOnly={Boolean(top.payload?.todayOnly)} onBack={popPage} onOpenTrip={(target, log) => pushPage("track", target, { logId: log.id, customStart: log.startAt, customEnd: log.endAt })} />;
      case "charging-logs":
        return <ChargingLogPage vehicle={vehicle} vehicles={scopedVehicles} todayOnly={Boolean(top.payload?.todayOnly)} onBack={popPage} onOpenSpot={(target, log) => pushPage("charging-spot", target, log)} />;
      case "trip-track":
        return <TripTrackPage vehicle={vehicle} log={top.payload} onBack={popPage} />;
      case "charging-spot":
        return <ChargingSpotPage vehicle={vehicle} log={top.payload} onBack={popPage} />;
      case "alerts":
        return (
          <AlertCenterPage
            alerts={alerts}
            onBack={popPage}
            onOpenVehicle={focusVehicleOnMonitor}
            onHandle={(id) => setHandledAlertIds((current) => [...current, id])}
          />
        );
      case "safety-alerts":
        return (
          <SafetyAlertPage
            alerts={mapSafetyAlerts}
            acknowledgedIds={acknowledgedSafetyAlertIds}
            onBack={popPage}
            onAcknowledge={(id) => setAcknowledgedSafetyAlertIds((ids) => [...ids, id])}
            onOpenAlert={(alert) => {
              setMapSafetyAlertSelection(alert);
              popPage();
            }}
          />
        );
      case "soc-alerts":
        return <SocAlertPage vehicles={vehicles} onBack={popPage} onOpenVehicle={focusVehicleOnMonitor} />;
      case "daily-report":
        return <DailyReportPage vehicle={vehicle} onBack={popPage} />;
      case "raw-data":
        return <RawDataPage vehicle={vehicle} onBack={popPage} />;
      case "station-list":
        return (
          <StationListPage
            stations={fleetStations}
            onBack={popPage}
            onToast={setToast}
            onSelectStation={(station) => {
              setMapStationSelection(station);
              popPage();
            }}
          />
        );
      default:
        return null;
    }
  }

  return (
    <main className="driver-stage">
      <section className="phone-frame driver-phone-stack fleet-leader-phone" aria-label="车队长 H5 小程序演示">
        <main className="fleet-leader-surface" aria-label="车队长工作台">
          {activeTab === "monitor" && (
            <MonitorPage
              vehicles={mapVehicles}
              allVehicles={scopedVehicles}
              stations={fleetStations}
              selectedVehicle={selectedVehicle}
              filter={filter}
              taskFilter={taskFilter}
              keyword={keyword}
              safetyAlerts={mapSafetyAlerts}
              safetyAlertSelection={mapSafetyAlertSelection}
              stationSelection={mapStationSelection}
              lastRefreshedAt={lastRefreshedAt}
              onFilterChange={setFilter}
              onTaskFilterChange={setTaskFilter}
              onKeywordChange={setKeyword}
              onVehicleSelect={setSelectedId}
              onOpenStationList={() => pushPage("station-list")}
              onOpenSafetyAlerts={() => pushPage("safety-alerts")}
              onStationSelectionConsumed={() => setMapStationSelection(null)}
              onSafetyAlertSelectionConsumed={() => setMapSafetyAlertSelection(null)}
              acknowledgedSafetyAlertIds={acknowledgedSafetyAlertIds}
              onToast={setToast}
              onRefresh={() => setLastRefreshedAt("刚刚")}
            />
          )}
          {activeTab === "home" && (
            <HomePage
              counts={counts}
              summary={summary}
              alerts={alerts}
              vehicles={scopedVehicles}
              scopeSelection={scopeSelection}
              onScopeChange={setScopeSelection}
              onQuickAction={handleQuickAction}
              onOpenVehicleList={openVehicleList}
              onBusinessAction={handleBusinessAction}
              onOpenAlerts={() => pushPage("alerts")}
              onOpenVehicle={focusVehicleOnMonitor}
            />
          )}
          {activeTab === "profile" && (
            <ProfilePage
              subscriptionEnabled={subscriptionEnabled}
              onToggleSubscription={() => setSubscriptionEnabled((value) => !value)}
            />
          )}

          <nav className="driver-tabs fleet-leader-tabs" aria-label="车队长导航">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className={activeTab === id ? "active" : undefined}
                aria-current={activeTab === id ? "page" : undefined}
                onClick={() => { setStack([]); setActiveTab(id); }}
              >
                <Icon aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>

          {renderStackPage()}

          {toast && <div className="fleet-toast" role="status">{toast}</div>}
        </main>
      </section>
    </main>
  );
}
