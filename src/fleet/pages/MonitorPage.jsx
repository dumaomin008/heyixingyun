import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Activity,
  BatteryMedium,
  ChevronDown,
  CloudSun,
  Crosshair,
  Gauge,
  Layers3,
  ListFilter,
  MapPin,
  PhoneCall,
  PlugZap,
  Search,
  ShieldAlert,
  Truck,
  UserRound,
  Weight,
  X,
} from "lucide-react";
import { FleetMapCanvas } from "../maps.jsx";
import { PrimaryPageHeader } from "../components.jsx";
import { StationNavigationSheet, StationQuickCard } from "./StationListPage.jsx";
import { getVehiclePrimaryStatus, getVehicleSecondaryStatus } from "../vehicle-status.js";
import { FLEET_TODAY, fleetDrivingLogs } from "../data.js";

// TMS 任务状态为外层入口；车辆状态只保留调度最需要处置的四种状态。
const VEHICLE_STATUS_FILTERS = [
  { id: "all", label: "全部", kind: "all" },
  { id: "行驶中", label: "行驶中", kind: "runtime" },
  { id: "驻车静止", label: "驻车中", kind: "runtime" },
  { id: "充电中", label: "充电中", kind: "runtime" },
  { id: "离线", label: "离线", kind: "offline" },
];
const TASK_FILTERS = [
  { id: "all", label: "全部", tone: "all" },
  // 数据层仍以“有任务”标识执行中任务，界面统一采用更直观的“运输中”。
  { id: "有任务", label: "运输中", tone: "active" },
  { id: "待运输", label: "待运输", tone: "pending" },
  { id: "无任务", label: "无任务", tone: "none" },
  { id: "停运", label: "停运", tone: "suspended" },
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
  const searchInputRef = useRef(null);
  // 进入监控页默认保持纯地图，车辆信息仅在用户主动选择车辆后出现。
  const [panelVisible, setPanelVisible] = useState(false);
  const [plateListOpen, setPlateListOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null);
  const [navigationStation, setNavigationStation] = useState(null);
  const [toolbarBottom, setToolbarBottom] = useState(null);
  const [vehicleMarkersVisible, setVehicleMarkersVisible] = useState(true);
  const [stationMarkersVisible, setStationMarkersVisible] = useState(true);
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const [selectedVehicleStatuses, setSelectedVehicleStatuses] = useState([]);
  const [searchResultCategory, setSearchResultCategory] = useState("all");
  const matchesSelectedVehicleStatus = (vehicle) => selectedVehicleStatuses.length === 0
    || selectedVehicleStatuses.some((status) => (
      status === "离线" ? vehicle.onlineStatus === "离线" : getVehicleSecondaryStatus(vehicle) === status
    ));
  const statusFilteredVehicles = vehicles.filter(matchesSelectedVehicleStatus);
  const activeSelectedVehicle = statusFilteredVehicles.find((vehicle) => vehicle.id === selectedVehicle?.id) ?? null;
  const hasVisibleCard = Boolean(selectedStation || (statusFilteredVehicles.length && activeSelectedVehicle && panelVisible));

  // 车辆状态改为本页可多选的二级条件，避免复用旧的单选联网状态造成冲突。
  useEffect(() => {
    if (filter !== "all") onFilterChange("all");
  }, [filter, onFilterChange]);

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
  }, [hasVisibleCard, selectedStation, activeSelectedVehicle?.id]);

  const keywordKey = keyword.trim().toLowerCase();
  const isSearchPreviewOpen = Boolean(keywordKey);
  const matchesKeyword = (vehicle) => !keywordKey
    || `${vehicle.plate}${vehicle.trailerPlate}${vehicle.driverName}${vehicle.vin}`.toLowerCase().includes(keywordKey);
  const matchesTaskFilter = (vehicle, value = taskFilter) => value === "all" || vehicle.tmsTaskStatus === value;

  const plateItems = allVehicles.filter((vehicle) => (
    matchesTaskFilter(vehicle) && matchesSelectedVehicleStatus(vehicle) && matchesKeyword(vehicle)
  ));
  const taskFilterCounts = TASK_FILTERS.reduce((counts, item) => {
    counts[item.id] = allVehicles.filter((vehicle) => (
      matchesSelectedVehicleStatus(vehicle) && (item.id === "all" || vehicle.tmsTaskStatus === item.id)
    )).length;
    return counts;
  }, {});
  const stationSearchItems = stations.filter((station) => (
    `${station.name}${station.shortName ?? ""}${station.address ?? ""}`.toLowerCase().includes(keywordKey)
  ));
  const previewVehicles = plateItems.slice(0, 3);
  const previewStations = stationSearchItems.slice(0, 3);
  const vehicleSearchCount = plateItems.length;
  const stationSearchCount = stationSearchItems.length;
  const searchResultCount = vehicleSearchCount + stationSearchCount;
  const showVehicleResults = searchResultCategory === "all" || searchResultCategory === "vehicle";
  const showStationResults = searchResultCategory === "all" || searchResultCategory === "station";
  const selectedTaskFilter = TASK_FILTERS.find((item) => item.id === taskFilter) ?? TASK_FILTERS[0];
  const selectedVehicleStatus = selectedVehicleStatuses.length === 1
    ? VEHICLE_STATUS_FILTERS.find((item) => item.id === selectedVehicleStatuses[0])?.label
    : selectedVehicleStatuses.length > 1 ? `已选 ${selectedVehicleStatuses.length} 种状态` : "全部";
  const plateListTitle = selectedVehicleStatuses.length === 0 && taskFilter === "all"
    ? "全部车辆"
    : `${selectedVehicleStatus} · ${selectedTaskFilter.label}`;
  const advancedFilterBadge = selectedVehicleStatuses.length;
  const hasAdvancedFilter = advancedFilterBadge > 0;
  const visibleLayerCount = Number(vehicleMarkersVisible) + Number(stationMarkersVisible);
  const layerButtonLabel = visibleLayerCount === 2
    ? "地图图层，车辆点位和充电场站均已显示"
    : visibleLayerCount === 1
      ? "地图图层，已显示 1 个图层"
      : "地图图层，所有图层已隐藏";
  const pendingSafetyAlertCount = safetyAlerts.filter((alert) => !acknowledgedSafetyAlertIds.includes(alert.id)).length;
  const safetyAlertTone = safetyAlerts.some((alert) => alert.level === "紧急") ? "urgent" : "general";
  const safetyAlertBadge = safetyAlerts.length > 99 ? "99+" : safetyAlerts.length;
  const todayMileage = activeSelectedVehicle
    ? Number(fleetDrivingLogs
      .filter((log) => log.vehicleId === activeSelectedVehicle.id && log.startAt.startsWith(FLEET_TODAY))
      .reduce((total, log) => total + log.mileage, 0)
      .toFixed(1))
    : 0;

  function handleTaskFilter(nextFilter) {
    if (taskFilter === nextFilter && plateListOpen) {
      setPlateListOpen(false);
      return;
    }
    onTaskFilterChange(nextFilter);
    setPlateListOpen(true);
  }

  function toggleVehicleStatusFilter(status) {
    if (status === "all") {
      setSelectedVehicleStatuses([]);
      return;
    }
    setSelectedVehicleStatuses((current) => (
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status]
    ));
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

  function handleSearchVehicleSelect(vehicle) {
    handlePlateSelect(vehicle);
    onKeywordChange("");
  }

  function handleSearchStationSelect(station) {
    setLayerPanelOpen(false);
    setPlateListOpen(false);
    setStationMarkersVisible(true);
    setSelectedStation(station);
    setPanelVisible(false);
    onKeywordChange("");
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
        vehicles={statusFilteredVehicles}
        selectedId={activeSelectedVehicle?.id}
        stations={stations}
        selectedStationId={selectedStation?.id}
        showVehicleMarkers={vehicleMarkersVisible}
        showStationMarkers={stationMarkersVisible}
        isInfoPanelVisible={panelVisible && Boolean(activeSelectedVehicle) && !selectedStation}
        onMapBlankClick={() => {
          setLayerPanelOpen(false);
          setAdvancedFilterOpen(false);
        }}
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

      <div className="fleet-monitor-search" role="search">
        <Search aria-hidden="true" />
        <input
          ref={searchInputRef}
          value={keyword}
          onChange={(event) => {
            setAdvancedFilterOpen(false);
            onKeywordChange(event.target.value);
          }}
          placeholder="搜索车辆、司机或充电场站"
          aria-label="搜索车辆、司机或充电场站"
        />
        {keyword && (
          <button
            type="button"
            className="fleet-monitor-search-clear"
            aria-label="清空搜索内容"
            onClick={() => {
              onKeywordChange("");
              searchInputRef.current?.focus();
            }}
          ><X aria-hidden="true" /></button>
        )}
      </div>

      <section className={`fleet-monitor-filter-console ${isSearchPreviewOpen ? "is-search-previewing" : ""}`} aria-label="地图组合筛选">
        <nav className="fleet-monitor-business-tabs" aria-label="任务状态筛选">
          {TASK_FILTERS.map((item) => (
            <button key={item.id} type="button" className={taskFilter === item.id ? "active" : ""} aria-label={`${item.label}，${taskFilterCounts[item.id]} 辆`} aria-pressed={taskFilter === item.id} onClick={() => handleTaskFilter(item.id)}><span>{item.label}</span><b aria-hidden="true">{taskFilterCounts[item.id]}</b></button>
          ))}
          <button
            type="button"
            className={`fleet-monitor-advanced-trigger ${advancedFilterOpen || hasAdvancedFilter ? "active" : ""}`}
            aria-label={hasAdvancedFilter ? `车辆状态筛选，已选择 ${advancedFilterBadge} 项条件` : "车辆状态筛选"}
            aria-expanded={advancedFilterOpen}
            aria-controls="fleet-monitor-advanced-filter"
            onClick={() => setAdvancedFilterOpen((open) => !open)}
          >
            <ListFilter aria-hidden="true" />
            {hasAdvancedFilter && <b aria-hidden="true" />}
          </button>
        </nav>
        {advancedFilterOpen && (
          <section id="fleet-monitor-advanced-filter" className="fleet-monitor-advanced-filter" aria-label="车辆状态高级筛选">
            <header><b>车辆状态</b></header>
            <div className="fleet-monitor-advanced-filter-group">
              <div>
                {VEHICLE_STATUS_FILTERS.map((item) => {
                  const isActive = item.id === "all"
                    ? selectedVehicleStatuses.length === 0
                    : selectedVehicleStatuses.includes(item.id);
                  return <button key={item.id} type="button" className={isActive ? "active runtime" : ""} aria-pressed={isActive} onClick={() => toggleVehicleStatusFilter(item.id)}>{item.label}</button>;
                })}
              </div>
            </div>
            <p>行驶、驻车和充电状态均自动限定为在线车辆</p>
          </section>
        )}
      </section>

      {isSearchPreviewOpen && (
        <section className="fleet-monitor-search-results" aria-label="搜索结果" aria-live="polite">
          <header><span>搜索结果</span><b>匹配 {searchResultCount} 项</b></header>
          <nav className="fleet-monitor-search-category-tabs" aria-label="搜索结果分类">
            <button type="button" className={searchResultCategory === "all" ? "active" : ""} aria-pressed={searchResultCategory === "all"} onClick={() => setSearchResultCategory("all")}>全部 <b>{searchResultCount}</b></button>
            <button type="button" className={searchResultCategory === "vehicle" ? "active vehicle" : "vehicle"} aria-pressed={searchResultCategory === "vehicle"} onClick={() => setSearchResultCategory("vehicle")}>车辆 <b>{vehicleSearchCount}</b></button>
            <button type="button" className={searchResultCategory === "station" ? "active station" : "station"} aria-pressed={searchResultCategory === "station"} onClick={() => setSearchResultCategory("station")}>充电场站 <b>{stationSearchCount}</b></button>
          </nav>
          {searchResultCount ? (
            <div className="fleet-monitor-search-result-groups">
              {showVehicleResults && previewVehicles.length > 0 && (
                <section className="fleet-monitor-search-result-group" aria-label="车辆结果">
                  <h2><img src="/fleet-assets/dispatch-van.png" alt="" aria-hidden="true" />车辆</h2>
                  <div>
                    {previewVehicles.map((vehicle) => (
                      <button key={vehicle.id} type="button" onClick={() => handleSearchVehicleSelect(vehicle)}>
                        <span><b>{vehicle.plate}</b><small>{vehicle.driverName || "未分配司机"} · {getVehicleSecondaryStatus(vehicle) ?? getVehiclePrimaryStatus(vehicle)}</small></span>
                        <em>{vehicle.trailerPlate || "未绑定挂车"}</em>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {showStationResults && previewStations.length > 0 && (
                <section className="fleet-monitor-search-result-group station" aria-label="充电场站结果">
                  <h2><i aria-hidden="true"><PlugZap /></i>充电场站</h2>
                  <div>
                    {previewStations.map((station) => (
                      <button key={station.id} type="button" onClick={() => handleSearchStationSelect(station)}>
                        <span><b>{station.name}</b><small>{station.address || "位置信息暂无"}</small></span>
                        <strong><b>{station.distance.text}</b><small>{station.priceText}</small></strong>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : <p className="fleet-monitor-search-empty">未找到匹配的车辆或充电场站</p>}
          {searchResultCount > 0 && ((searchResultCategory === "vehicle" && vehicleSearchCount === 0) || (searchResultCategory === "station" && stationSearchCount === 0)) && <p className="fleet-monitor-search-empty compact">当前分类暂无匹配结果</p>}
        </section>
      )}

      {plateListOpen && (
        <section className="fleet-monitor-plate-list" aria-label={`${plateListTitle}列表`}>
          <header><span>{plateListTitle}</span><b>{plateItems.length} 辆</b></header>
          <div>
            {plateItems.length ? plateItems.map((vehicle) => (
              <button key={vehicle.id} type="button" onClick={() => handlePlateSelect(vehicle)}>
                <img src="/fleet-assets/dispatch-van.png" alt="" aria-hidden="true" />
                <span>{vehicle.plate} - {vehicle.trailerPlate} - {vehicle.driverName}</span>
              </button>
            )) : <p>暂无符合条件的车辆</p>}
          </div>
          <button type="button" className="fleet-monitor-plate-list-close" onClick={() => setPlateListOpen(false)}>收起车辆列表 <ChevronDown aria-hidden="true" /></button>
        </section>
      )}

      <div
        className={`fleet-map-toolbar ${hasVisibleCard ? "is-docked-to-card" : ""} ${hasVisibleCard && toolbarBottom === null ? "is-measuring" : ""} ${plateListOpen || isSearchPreviewOpen ? "is-filtering" : ""}`}
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
      ) : vehicleMarkersVisible && statusFilteredVehicles.length && activeSelectedVehicle && panelVisible ? (
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
              <i className={`fleet-status-dot ${activeSelectedVehicle.onlineStatus === "在线" ? "online" : activeSelectedVehicle.onlineStatus === "离线" ? "offline" : "never"}`} />
              <h2>{activeSelectedVehicle.plate}</h2>
              <span className="fleet-vehicle-panel-state-tags">
                <b>{getVehicleSecondaryStatus(activeSelectedVehicle) ?? getVehiclePrimaryStatus(activeSelectedVehicle)}</b>
                {activeSelectedVehicle.tmsTaskStatus && <span className={`fleet-tms-state ${tmsTaskTone(activeSelectedVehicle.tmsTaskStatus)}`}>{activeSelectedVehicle.tmsTaskStatus}</span>}
              </span>
            </div>
            <div className="fleet-vehicle-weather" aria-label="当前天气：多云，24 摄氏度">
              <CloudSun aria-hidden="true" />
              <span><b>24°</b><small>多云</small></span>
            </div>
          </div>

          <p className="fleet-panel-vin">VIN {activeSelectedVehicle.vin}</p>

          <div className="fleet-source-assignment" aria-label="车辆当前任务人员">
            <div><span><Truck aria-hidden="true" />挂车车牌</span><b>{activeSelectedVehicle.trailerPlate}</b></div>
            <div><span><UserRound aria-hidden="true" />当前司机</span><b>{activeSelectedVehicle.driverName}</b></div>
          </div>

          <dl className="fleet-source-metrics">
            <div><Weight aria-hidden="true" /><dd><b>{activeSelectedVehicle.vehicleWeight ?? "—"}{activeSelectedVehicle.vehicleWeight !== undefined && <small> t</small>}</b><span>车重</span></dd></div>
            <div><BatteryMedium aria-hidden="true" /><dd><b>{activeSelectedVehicle.soc === null ? "—" : `${activeSelectedVehicle.soc}%`}</b><span>剩余电量 (SOC)</span></dd></div>
            <div><Gauge aria-hidden="true" /><dd><b>{activeSelectedVehicle.speed || 0} km/h</b><span>当前速度</span></dd></div>
            <div><Activity aria-hidden="true" /><dd><b>{todayMileage.toLocaleString()} <small>km</small></b><span>今日里程</span></dd></div>
          </dl>

          <div className="fleet-source-location">
            <MapPin aria-hidden="true" />
            <p>{activeSelectedVehicle.location}</p>
          </div>

          <div className="fleet-command-row fleet-source-command-row fleet-source-call-only" aria-label="车辆快捷入口">
            <a href={`tel:${activeSelectedVehicle.ownerPhone}`} aria-label={`拨打 ${activeSelectedVehicle.plate} 联系人电话 ${activeSelectedVehicle.ownerPhone}`}>
              <PhoneCall aria-hidden="true" /><span>打电话</span>
            </a>
          </div>
        </section>
      ) : (!vehicleMarkersVisible || !statusFilteredVehicles.length || !activeSelectedVehicle) ? (
        <section className="fleet-empty-state">
          <b>暂无符合条件的车辆</b>
          <span>请调整筛选条件或搜索关键字</span>
        </section>
      ) : null}
      {navigationStation && <StationNavigationSheet station={navigationStation} onClose={() => setNavigationStation(null)} onToast={onToast} />}
    </section>
  );
}
