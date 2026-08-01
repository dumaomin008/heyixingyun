import { useEffect, useMemo, useState } from "react";
import { House, ListTodo, Truck, UserRound } from "lucide-react";
import {
  countByStatus,
  fleetVehicles as seedVehicles,
  getTodaySummary,
} from "./data.js";
import { HomePage } from "./pages/HomePage.jsx";
import { DispatchPage } from "./pages/DispatchPage.jsx";
import { MonitorPage } from "./pages/MonitorPage.jsx";
import { ProfilePage, MonitoredVehicleEditor } from "./pages/ProfilePage.jsx";
import { VehicleListPage } from "./pages/VehicleListPage.jsx";
import { VehicleDetailPage } from "./pages/VehicleDetailPage.jsx";
import { RealtimeDataPage } from "./pages/RealtimeDataPage.jsx";
import { TrackPlaybackPage } from "./pages/TrackPlaybackPage.jsx";
import { ChargingLogPage, ChargingSpotPage, DrivingLogPage, TripTrackPage } from "./pages/LogPages.jsx";
import { AlertCenterPage, SocAlertPage } from "./pages/AlertPages.jsx";
import { DailyReportPage, RawDataPage } from "./pages/ReportPages.jsx";
import { VehicleTaskPage } from "./pages/VehicleTaskPage.jsx";
import { defaultScopeSelection, scopeMatchesVehicle } from "./scope.js";
import { sortAlerts } from "./alerts.js";
import { getFleetStations } from "./stations.js";
import { StationListPage } from "./pages/StationListPage.jsx";
import "./fleet.css";

const TABS = [
  { id: "home", label: "首页", Icon: House },
  { id: "dispatch", label: "调度", Icon: ListTodo },
  { id: "monitor", label: "监控", Icon: Truck },
  { id: "profile", label: "我的", Icon: UserRound },
];

export function FleetLeaderApp() {
  const [vehicles, setVehicles] = useState(seedVehicles);
  const [activeTab, setActiveTab] = useState("monitor");
  const [filter, setFilter] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState(seedVehicles[0].id);
  const [lastRefreshedAt, setLastRefreshedAt] = useState("刚刚");
  const [handledAlertIds, setHandledAlertIds] = useState([]);
  const [followedIds, setFollowedIds] = useState(["FV001", "FV003"]);
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [toast, setToast] = useState("");
  const [scopeSelection, setScopeSelection] = useState(defaultScopeSelection);
  const [stations, setStations] = useState([]);

  // 页面栈：支持从任意入口进入车辆详情后逐级返回。
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
      const keywordMatch = !key || `${vehicle.plate}${vehicle.trailerPlate}${vehicle.driverName}${vehicle.vin}${vehicle.model}`.toLowerCase().includes(key);
      return statusMatch && keywordMatch;
    });
  }, [scopedVehicles, filter, keyword]);

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
  const followedVehicles = scopedVehicles.filter((vehicle) => followedIds.includes(vehicle.id));

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
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const content = document.querySelector(".fleet-detail-body, .fleet-page-body");
        if (content) content.scrollTop = 0;
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, top?.page]);

  function pushPage(page, vehicle, payload) {
    setStack((current) => [...current, { page, vehicle: vehicle ?? null, payload: payload ?? null }]);
  }

  function popPage() {
    setStack((current) => current.slice(0, -1));
  }

  function openVehicleDetail(vehicle) {
    setSelectedId(vehicle.id);
    pushPage("vehicle-detail", vehicle);
  }

  function handleQuickAction(id) {
    if (id === "monitor") {
      setActiveTab("monitor");
      return;
    }
    if (id === "driving-logs" || id === "charging-logs" || id === "daily-report") {
      // 这三个入口以当前选中车辆为默认对象，未选中时回落到第一辆车。
      pushPage(id, selectedVehicle ?? scopedVehicles[0]);
      return;
    }
    pushPage(id);
  }

  function handleBusinessAction(id, label) {
    if (id === "alerts") {
      pushPage("alerts");
      return;
    }
    if (id === "vehicle-list") {
      pushPage("vehicle-list");
      return;
    }
    if (id === "charging") {
      pushPage("charging-logs", selectedVehicle ?? scopedVehicles[0]);
      return;
    }
    setToast(`「${label}」入口已保留，等待业务模块接入`);
  }

  function toggleFollow(vehicleId) {
    setFollowedIds((current) => current.includes(vehicleId)
      ? current.filter((id) => id !== vehicleId)
      : [...current, vehicleId]);
  }

  function saveMonitoredVehicle(vehicleId, form) {
    setVehicles((current) => current.map((vehicle) => vehicle.id === vehicleId ? { ...vehicle, ...form } : vehicle));
    setEditingVehicle(null);
    setToast("监控车辆信息已更新");
  }

  function renderStackPage() {
    if (!top) return null;
    const vehicle = top.vehicle ?? selectedVehicle ?? scopedVehicles[0] ?? vehicles[0];

    switch (top.page) {
      case "vehicle-list":
        return <VehicleListPage vehicles={scopedVehicles} onBack={popPage} onOpenVehicle={openVehicleDetail} />;
      case "monitored-vehicles":
        return <VehicleListPage vehicles={followedVehicles} title="监控车辆" onlyFollowed onBack={popPage} onOpenVehicle={openVehicleDetail} />;
      case "vehicle-detail":
        return (
          <VehicleDetailPage
            vehicle={vehicle}
            isFollowed={followedIds.includes(vehicle.id)}
            onBack={popPage}
            onToggleFollow={() => toggleFollow(vehicle.id)}
            onOpenPage={(page, target, payload) => pushPage(page, target ?? vehicle, payload)}
          />
        );
      case "realtime-data":
        return <RealtimeDataPage vehicle={vehicle} onBack={popPage} />;
      case "track":
        return <TrackPlaybackPage vehicle={vehicle} onBack={popPage} />;
      case "vehicle-tasks":
        return <VehicleTaskPage vehicle={vehicle} onBack={popPage} />;
      case "driving-logs":
        return <DrivingLogPage vehicle={vehicle} onBack={popPage} onOpenTrip={(log) => pushPage("trip-track", vehicle, log)} />;
      case "charging-logs":
        return <ChargingLogPage vehicle={vehicle} onBack={popPage} onOpenSpot={(log) => pushPage("charging-spot", vehicle, log)} />;
      case "trip-track":
        return <TripTrackPage vehicle={vehicle} log={top.payload} onBack={popPage} />;
      case "charging-spot":
        return <ChargingSpotPage vehicle={vehicle} log={top.payload} onBack={popPage} />;
      case "alerts":
        return (
          <AlertCenterPage
            alerts={alerts}
            onBack={popPage}
            onOpenVehicle={openVehicleDetail}
            onHandle={(id) => setHandledAlertIds((current) => [...current, id])}
          />
        );
      case "soc-alerts":
        return <SocAlertPage vehicles={vehicles} onBack={popPage} onOpenVehicle={openVehicleDetail} />;
      case "daily-report":
        return <DailyReportPage vehicle={vehicle} onBack={popPage} />;
      case "raw-data":
        return <RawDataPage vehicle={vehicle} onBack={popPage} />;
      case "station-list":
        return <StationListPage stations={fleetStations} onBack={popPage} onToast={setToast} />;
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
              keyword={keyword}
              lastRefreshedAt={lastRefreshedAt}
              onFilterChange={setFilter}
              onKeywordChange={setKeyword}
              onVehicleSelect={setSelectedId}
              onOpenVehicle={openVehicleDetail}
              onOpenPage={(page, target) => pushPage(page, target)}
              onOpenStationList={() => pushPage("station-list")}
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
              onOpenAlerts={() => pushPage("alerts")}
              onOpenVehicle={openVehicleDetail}
            />
          )}
          {activeTab === "dispatch" && (
            <DispatchPage
              onBusinessAction={handleBusinessAction}
            />
          )}
          {activeTab === "profile" && (
            <ProfilePage
              followedVehicles={followedVehicles}
              subscriptionEnabled={subscriptionEnabled}
              onToggleSubscription={() => setSubscriptionEnabled((value) => !value)}
              onOpenVehicle={openVehicleDetail}
              onOpenPage={(page) => pushPage(page)}
              onEditVehicle={setEditingVehicle}
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

          {editingVehicle && (
            <MonitoredVehicleEditor
              vehicle={editingVehicle}
              onClose={() => setEditingVehicle(null)}
              onSave={saveMonitoredVehicle}
            />
          )}

          {toast && <div className="fleet-toast" role="status">{toast}</div>}
        </main>
      </section>
    </main>
  );
}
