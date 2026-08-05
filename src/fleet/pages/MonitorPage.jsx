import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BatteryMedium,
  ChevronDown,
  CloudSun,
  Clock3,
  Crosshair,
  Gauge,
  Layers3,
  MapPin,
  PhoneCall,
  PlugZap,
  Search,
  ShieldAlert,
  Truck,
  UserRound,
  Weight,
} from "lucide-react";
import { FleetMapCanvas } from "../maps.jsx";
import { PrimaryPageHeader, StatusPill } from "../components.jsx";
import { StationNavigationSheet, StationQuickCard } from "./StationListPage.jsx";
import { getVehiclePrimaryStatus, getVehicleSecondaryStatus } from "../vehicle-status.js";
import { FLEET_TODAY, fleetDrivingLogs } from "../data.js";

// TSP 车辆状态与 TMS 任务状态组成两套独立筛选，最终按“且”关系过滤。
const VEHICLE_FILTERS = [
  { id: "all", label: "全部", tone: "all" },
  { id: "在线", label: "在线", tone: "online" },
  { id: "离线", label: "离线", tone: "offline" },
  { id: "从未上线", label: "从未上线", tone: "never" },
];
const TASK_FILTERS = [
  { id: "all", label: "所有", tone: "all" },
  { id: "有任务", label: "有任务", tone: "active" },
  { id: "待运输", label: "待运输", tone: "pending" },
  { id: "无任务", label: "无任务", tone: "none" },
];

function tmsTaskTone(status) {
  if (status === "有任务") return "active";
  if (status === "待运输") return "pending";
  if (status === "无任务") return "none";
  if (status === "停运") return "suspended";
  return "";
}

// 安全告警地图入口留待下一期启用；当前先保留事件口径与列表能力，避免影响后续恢复。
const SHOW_MAP_SAFETY_ALERT_ENTRY = false;

export function MonitorPage({
  vehicles,
  allVehicles,
  stations,
  selectedVehicle,
  filter,
  taskFilter,
  keyword,
  safetyAlerts,
  safetyAlertSelection,
  stationSelection,
  lastRefreshedAt,
  onFilterChange,
  onTaskFilterChange,
  onKeywordChange,
  onVehicleSelect,
  onOpenStationList,
  onOpenSafetyAlerts,
  onStationSelectionConsumed,
  onSafetyAlertSelectionConsumed,
  acknowledgedSafetyAlertIds,
  onToast,
  onRefresh,
}) {
  const monitorRef = useRef(null);
  const vehiclePanelRef = useRef(null);
  const stationPanelRef = useRef(null);
  const [panelVisible, setPanelVisible] = useState(true);
  const [plateListOpen, setPlateListOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null);
  const [navigationStation, setNavigationStation] = useState(null);
  const [toolbarBottom, setToolbarBottom] = useState(null);
  const [vehicleMarkersVisible, setVehicleMarkersVisible] = useState(true);
  const [stationMarkersVisible, setStationMarkersVisible] = useState(true);
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const hasVisibleCard = Boolean(selectedStation || (vehicles.length && selectedVehicle && panelVisible));

  useEffect(() => {
    if (!stationSelection) return;
    setStationMarkersVisible(true);
    setLayerPanelOpen(false);
    setPlateListOpen(false);
    setSelectedStation(stationSelection);
    setPanelVisible(false);
    onStationSelectionConsumed();
  }, [stationSelection, onStationSelectionConsumed]);

  useEffect(() => {
    if (!safetyAlertSelection) return;
    setLayerPanelOpen(false);
    setPlateListOpen(false);
    setSelectedStation(null);
    setVehicleMarkersVisible(true);
    onVehicleSelect(safetyAlertSelection.vehicle.id);
    setPanelVisible(true);
    onSafetyAlertSelectionConsumed();
  }, [safetyAlertSelection, onSafetyAlertSelectionConsumed, onVehicleSelect]);

  useLayoutEffect(() => {
    if (!hasVisibleCard) {
      setToolbarBottom(null);
      return undefined;
    }

    const panel = selectedStation ? stationPanelRef.current : vehiclePanelRef.current;
    const monitor = monitorRef.current;
    if (!panel || !monitor) return undefined;

    const updateToolbarPosition = () => {
      const monitorBounds = monitor.getBoundingClientRect();
      const panelBounds = panel.getBoundingClientRect();
      // Keep the tool group just above the sheet's upper-right corner, whatever its content height.
      setToolbarBottom(Math.max(82, Math.round(monitorBounds.bottom - panelBounds.top + 16)));
    };

    updateToolbarPosition();
    const observer = new ResizeObserver(updateToolbarPosition);
    observer.observe(panel);
    observer.observe(monitor);
    window.addEventListener("resize", updateToolbarPosition);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateToolbarPosition);
    };
  }, [hasVisibleCard, selectedStation, selectedVehicle?.id]);

  const keywordKey = keyword.trim().toLowerCase();
  const matchesKeyword = (vehicle) => !keywordKey
    || `${vehicle.plate}${vehicle.trailerPlate}${vehicle.driverName}${vehicle.vin}`.toLowerCase().includes(keywordKey);
  const matchesVehicleFilter = (vehicle, value = filter) => value === "all" || vehicle.onlineStatus === value;
  const matchesTaskFilter = (vehicle, value = taskFilter) => value === "all" || vehicle.tmsTaskStatus === value;

  const plateItems = allVehicles.filter((vehicle) => (
    matchesVehicleFilter(vehicle) && matchesTaskFilter(vehicle) && matchesKeyword(vehicle)
  ));
  const selectedVehicleFilter = VEHICLE_FILTERS.find((item) => item.id === filter) ?? VEHICLE_FILTERS[0];
  const selectedTaskFilter = TASK_FILTERS.find((item) => item.id === taskFilter) ?? TASK_FILTERS[0];
  const plateListTitle = filter === "all" && taskFilter === "all"
    ? "全部车辆"
    : `${selectedVehicleFilter.label} · ${selectedTaskFilter.label}`;
  const visibleLayerCount = Number(vehicleMarkersVisible) + Number(stationMarkersVisible);
  const layerButtonLabel = visibleLayerCount === 2
    ? "地图图层，车辆点位和充电场站均已显示"
    : visibleLayerCount === 1
      ? "地图图层，已显示 1 个图层"
      : "地图图层，所有图层已隐藏";
  const alertLevelByVehicle = useMemo(() => safetyAlerts.reduce((levels, alert) => ({
    ...levels,
    [alert.vehicle.id]: levels[alert.vehicle.id] === "紧急" || alert.level === "紧急" ? "紧急" : "一般",
  }), {}), [safetyAlerts]);
  const pendingSafetyAlertCount = safetyAlerts.filter((alert) => !acknowledgedSafetyAlertIds.includes(alert.id)).length;
  const safetyAlertTone = safetyAlerts.some((alert) => alert.level === "紧急") ? "urgent" : "general";
  const safetyAlertBadge = safetyAlerts.length > 99 ? "99+" : safetyAlerts.length;
  const todayMileage = selectedVehicle
    ? Number(fleetDrivingLogs
      .filter((log) => log.vehicleId === selectedVehicle.id && log.startAt.startsWith(FLEET_TODAY))
      .reduce((total, log) => total + log.mileage, 0)
      .toFixed(1))
    : 0;

  function handleFilterOption(group, nextFilter) {
    const isCurrent = group === "vehicle"
      ? filter === nextFilter && taskFilter === "all"
      : taskFilter === nextFilter && filter === "all";
    if (isCurrent && plateListOpen) {
      setPlateListOpen(false);
      return;
    }
    if (group === "vehicle") {
      onFilterChange(nextFilter);
      onTaskFilterChange("all");
    } else {
      onFilterChange("all");
      onTaskFilterChange(nextFilter);
    }
    setPlateListOpen(true);
  }

  function handleAllFilters() {
    if (filter === "all" && taskFilter === "all" && plateListOpen) {
      setPlateListOpen(false);
      return;
    }
    onFilterChange("all");
    onTaskFilterChange("all");
    setPlateListOpen(true);
  }

  function handlePlateSelect(vehicle) {
    setPlateListOpen(false);
    setSelectedStation(null);
    setVehicleMarkersVisible(true);
    if (vehicle.onlineStatus === "从未上线") {
      onVehicleSelect(vehicle.id);
      setPanelVisible(false);
      return;
    }
    onVehicleSelect(vehicle.id);
    setPanelVisible(true);
  }

  function toggleVehicleLayer() {
    if (vehicleMarkersVisible) {
      setPanelVisible(false);
      setPlateListOpen(false);
    }
    setVehicleMarkersVisible((visible) => !visible);
  }

  function toggleStationLayer() {
    if (stationMarkersVisible) setSelectedStation(null);
    setStationMarkersVisible((visible) => !visible);
  }

  return (
    <section ref={monitorRef} className="fleet-monitor-page" aria-label="车辆监控">
      <PrimaryPageHeader title="监控" className="fleet-monitor-title" />
      <FleetMapCanvas
        vehicles={vehicles}
        selectedId={selectedVehicle?.id}
        stations={stations}
        selectedStationId={selectedStation?.id}
        showVehicleMarkers={vehicleMarkersVisible}
        showStationMarkers={stationMarkersVisible}
        alertLevels={alertLevelByVehicle}
        isInfoPanelVisible={panelVisible && Boolean(selectedVehicle) && !selectedStation}
        onMapBlankClick={() => setLayerPanelOpen(false)}
        onVehicleClick={(vehicleId) => {
          setPlateListOpen(false);
          setSelectedStation(null);
          onVehicleSelect(vehicleId);
          setPanelVisible(true);
        }}
        onStationClick={(stationId) => {
          const station = stations.find((item) => item.id === stationId);
          if (!station) return;
          setPlateListOpen(false);
          setSelectedStation(station);
          setPanelVisible(false);
        }}
      />
      <div className="map-fade" />

      <label className="fleet-monitor-search">
          <Search aria-hidden="true" />
          <input
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            placeholder="搜索车牌 / 挂车 / 当前司机"
          />
      </label>

      <section className="fleet-monitor-filter-console" aria-label="地图组合筛选">
        <nav className="fleet-monitor-filter-flat" aria-label="车辆与任务状态筛选">
          <button type="button" className={filter === "all" && taskFilter === "all" ? "active all" : "all"} aria-pressed={filter === "all" && taskFilter === "all"} onClick={handleAllFilters}>全部</button>
          <button type="button" className={filter === "在线" && taskFilter === "all" ? "active vehicle" : "vehicle"} aria-pressed={filter === "在线" && taskFilter === "all"} onClick={() => handleFilterOption("vehicle", "在线")}>在线</button>
          <button type="button" className={filter === "离线" && taskFilter === "all" ? "active vehicle" : "vehicle"} aria-pressed={filter === "离线" && taskFilter === "all"} onClick={() => handleFilterOption("vehicle", "离线")}>离线</button>
          <button type="button" className={taskFilter === "有任务" && filter === "all" ? "active task" : "task"} aria-pressed={taskFilter === "有任务" && filter === "all"} onClick={() => handleFilterOption("task", "有任务")}>有任务</button>
          <button type="button" className={taskFilter === "待运输" && filter === "all" ? "active task" : "task"} aria-pressed={taskFilter === "待运输" && filter === "all"} onClick={() => handleFilterOption("task", "待运输")}>待运输</button>
          <button type="button" className={taskFilter === "无任务" && filter === "all" ? "active task" : "task"} aria-pressed={taskFilter === "无任务" && filter === "all"} onClick={() => handleFilterOption("task", "无任务")}>无任务</button>
        </nav>
      </section>

      {plateListOpen && (
        <section className="fleet-monitor-plate-list" aria-label={`${plateListTitle}列表`}>
          <header><span>{plateListTitle}</span><b>{plateItems.length} 辆</b></header>
          <div>
            {plateItems.length ? plateItems.map((vehicle) => (
              <button key={vehicle.id} type="button" onClick={() => handlePlateSelect(vehicle)}>
                <span><b>{vehicle.plate}</b><small>{vehicle.driverName} · {vehicle.trailerPlate} · {vehicle.tmsTaskStatus}</small></span>
                <StatusPill status={vehicle.onlineStatus} />
              </button>
            )) : <p>暂无符合条件的车辆</p>}
          </div>
          <button type="button" className="fleet-monitor-plate-list-close" onClick={() => setPlateListOpen(false)}>收起车辆列表 <ChevronDown aria-hidden="true" /></button>
        </section>
      )}

      <div
        className={`fleet-map-toolbar ${hasVisibleCard ? "is-docked-to-card" : ""} ${hasVisibleCard && toolbarBottom === null ? "is-measuring" : ""} ${plateListOpen ? "is-filtering" : ""}`}
        style={toolbarBottom === null ? undefined : { "--fleet-toolbar-bottom": `${toolbarBottom}px` }}
      >
        <span className="fleet-refresh-stamp">更新于 {lastRefreshedAt}</span>
        {SHOW_MAP_SAFETY_ALERT_ENTRY && safetyAlerts.length > 0 && (
          <aside className="fleet-map-safety-control" aria-label="安全告警">
            <button
              type="button"
            className={`fleet-map-safety-trigger ${safetyAlertTone}`}
            aria-label={`安全告警，发生中 ${safetyAlerts.length} 条，待知悉 ${pendingSafetyAlertCount} 条`}
              onClick={onOpenSafetyAlerts}
            >
              <ShieldAlert aria-hidden="true" />
              <b aria-hidden="true">{safetyAlertBadge}</b>
            </button>
          </aside>
        )}
        {layerPanelOpen && (
          <section id="fleet-map-layer-panel" className="fleet-map-layer-panel" aria-label="地图图层">
            <header><Layers3 aria-hidden="true" /><span>地图图层</span></header>
            <button type="button" role="switch" aria-checked={vehicleMarkersVisible} onClick={toggleVehicleLayer}>
              <span><Truck aria-hidden="true" />车辆点位</span><b>{vehicleMarkersVisible ? "开启" : "关闭"}</b>
            </button>
            <button type="button" role="switch" aria-checked={stationMarkersVisible} onClick={toggleStationLayer}>
              <span><PlugZap aria-hidden="true" />充电场站</span><b>{stationMarkersVisible ? "开启" : "关闭"}</b>
            </button>
          </section>
        )}
        <button
          type="button"
          className={`fleet-location-button fleet-map-layer-trigger layer-count-${visibleLayerCount}`}
          aria-label={layerButtonLabel}
          aria-expanded={layerPanelOpen}
          aria-controls="fleet-map-layer-panel"
          onClick={() => setLayerPanelOpen((open) => !open)}
        >
          <Layers3 aria-hidden="true" />
          {visibleLayerCount === 1 && <b aria-hidden="true">1</b>}
        </button>
        <button type="button" className="fleet-location-button fleet-station-list-trigger" aria-label="场站列表" onClick={() => { setStationMarkersVisible(true); onOpenStationList(); }}>
          <PlugZap aria-hidden="true" />
        </button>
        <button type="button" className="fleet-location-button" aria-label="刷新车辆位置" onClick={onRefresh}>
          <Crosshair aria-hidden="true" />
        </button>
      </div>

      {selectedStation ? (
        <StationQuickCard
          station={selectedStation}
          panelRef={stationPanelRef}
          onClose={() => {
            setSelectedStation(null);
            setPanelVisible(false);
          }}
          onNavigate={() => setNavigationStation(selectedStation)}
          onCopy={() => onToast("已复制地址")}
        />
      ) : vehicleMarkersVisible && vehicles.length && selectedVehicle ? (
        <section ref={vehiclePanelRef} className={`fleet-vehicle-panel fleet-source-vehicle-panel ${panelVisible ? "is-visible" : "is-dismissed"}`} aria-label="已选车辆信息">
          <button
            type="button"
            className="fleet-panel-expand-toggle"
            aria-label="向下收起车辆信息"
            onClick={() => setPanelVisible(false)}
          >
            <i aria-hidden="true" />
            <ChevronDown aria-hidden="true" />
          </button>
          <div className="fleet-vehicle-panel-heading">
            <div className="fleet-vehicle-panel-title">
              <i className={`fleet-status-dot ${selectedVehicle.onlineStatus === "在线" ? "online" : selectedVehicle.onlineStatus === "离线" ? "offline" : "never"}`} />
              <h2>{selectedVehicle.plate}</h2>
              <span className="fleet-vehicle-panel-state-tags">
                <b>{getVehicleSecondaryStatus(selectedVehicle) ?? getVehiclePrimaryStatus(selectedVehicle)}</b>
                {selectedVehicle.tmsTaskStatus && <span className={`fleet-tms-state ${tmsTaskTone(selectedVehicle.tmsTaskStatus)}`}>{selectedVehicle.tmsTaskStatus}</span>}
              </span>
            </div>
            <div className="fleet-vehicle-weather" aria-label="当前天气：多云，24 摄氏度">
              <CloudSun aria-hidden="true" />
              <span><b>24°</b><small>多云</small></span>
            </div>
          </div>

          <p className="fleet-panel-vin">VIN {selectedVehicle.vin}</p>

          <div className="fleet-source-assignment" aria-label="车辆当前任务人员">
            <div><span><Truck aria-hidden="true" />挂车车牌</span><b>{selectedVehicle.trailerPlate}</b></div>
            <div><span><UserRound aria-hidden="true" />当前司机</span><b>{selectedVehicle.driverName}</b></div>
          </div>

          <dl className="fleet-source-metrics">
            <div><Weight aria-hidden="true" /><dd><b>{selectedVehicle.vehicleWeight ?? "—"}{selectedVehicle.vehicleWeight !== undefined && <small> t</small>}</b><span>车重</span></dd></div>
            <div><BatteryMedium aria-hidden="true" /><dd><b>{selectedVehicle.soc === null ? "—" : `${selectedVehicle.soc}%`}</b><span>剩余电量 (SOC)</span></dd></div>
            <div><Gauge aria-hidden="true" /><dd><b>{selectedVehicle.speed || 0} km/h</b><span>当前速度</span></dd></div>
            <div><Activity aria-hidden="true" /><dd><b>{todayMileage.toLocaleString()} <small>km</small></b><span>今日里程</span></dd></div>
          </dl>

          <div className="fleet-source-location">
            <MapPin aria-hidden="true" />
            <p>{selectedVehicle.location}</p>
            <span><Clock3 aria-hidden="true" />{selectedVehicle.updatedAt}</span>
          </div>

          <div className="fleet-command-row fleet-source-command-row fleet-source-call-only" aria-label="车辆快捷入口">
            <a href={`tel:${selectedVehicle.ownerPhone}`} aria-label={`拨打 ${selectedVehicle.plate} 联系人电话 ${selectedVehicle.ownerPhone}`}>
              <PhoneCall aria-hidden="true" /><span>打电话</span>
            </a>
          </div>
        </section>
      ) : (
        <section className="fleet-empty-state">
          <b>暂无符合条件的车辆</b>
          <span>请调整筛选条件或搜索关键字</span>
        </section>
      )}
      {navigationStation && <StationNavigationSheet station={navigationStation} onClose={() => setNavigationStation(null)} onToast={onToast} />}
    </section>
  );
}
