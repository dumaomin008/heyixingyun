import { useLayoutEffect, useRef, useState } from "react";
import {
  Activity,
  BatteryMedium,
  ChevronDown,
  ChevronRight,
  Clock3,
  ClipboardList,
  Crosshair,
  Gauge,
  MapPin,
  PhoneCall,
  PlugZap,
  Route,
  Search,
  Truck,
  UserRound,
} from "lucide-react";
import { FleetMapCanvas } from "../maps.jsx";
import { PrimaryPageHeader, StatusPill } from "../components.jsx";
import { StationNavigationSheet, StationQuickCard } from "./StationListPage.jsx";

// 筛选口径与 TSP 监测分析页一致：全部 / 在线 / 离线 / 从未上线。
const FILTERS = [
  { id: "all", label: "全部", tone: "all" },
  { id: "在线", label: "在线", tone: "online" },
  { id: "离线", label: "离线", tone: "offline" },
  { id: "从未上线", label: "从未上线", tone: "never" },
];

export function MonitorPage({
  vehicles,
  allVehicles,
  stations,
  selectedVehicle,
  filter,
  keyword,
  lastRefreshedAt,
  onFilterChange,
  onKeywordChange,
  onVehicleSelect,
  onOpenVehicle,
  onOpenPage,
  onOpenStationList,
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
  const hasVisibleCard = Boolean(selectedStation || (vehicles.length && selectedVehicle && panelVisible));

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
      setToolbarBottom(Math.max(82, Math.round(monitorBounds.bottom - panelBounds.top + 8)));
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

  function countOf(id) {
    if (id === "all") return allVehicles.length;
    return allVehicles.filter((vehicle) => vehicle.onlineStatus === id).length;
  }

  const plateItems = allVehicles.filter((vehicle) => {
    const statusMatch = filter === "all" || vehicle.onlineStatus === filter;
    const key = keyword.trim().toLowerCase();
    const keywordMatch = !key || `${vehicle.plate}${vehicle.trailerPlate}${vehicle.driverName}${vehicle.vin}`.toLowerCase().includes(key);
    return statusMatch && keywordMatch;
  });

  function handleStatusFilter(nextFilter) {
    if (filter === nextFilter && plateListOpen) {
      setPlateListOpen(false);
      return;
    }
    onFilterChange(nextFilter);
    setPlateListOpen(true);
  }

  function handlePlateSelect(vehicle) {
    setPlateListOpen(false);
    setSelectedStation(null);
    if (vehicle.onlineStatus === "从未上线") {
      onOpenVehicle(vehicle);
      return;
    }
    onVehicleSelect(vehicle.id);
    setPanelVisible(true);
  }

  return (
    <section ref={monitorRef} className="fleet-monitor-page" aria-label="车辆监控">
      <PrimaryPageHeader title="监控" className="fleet-monitor-title" />
      <FleetMapCanvas
        vehicles={vehicles}
        selectedId={selectedVehicle?.id}
        stations={stations}
        selectedStationId={selectedStation?.id}
        isInfoPanelVisible={panelVisible && Boolean(selectedVehicle) && !selectedStation}
        onVehicleClick={(vehicleId) => {
          setSelectedStation(null);
          onVehicleSelect(vehicleId);
          setPanelVisible(true);
        }}
        onStationClick={(stationId) => {
          const station = stations.find((item) => item.id === stationId);
          if (!station) return;
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

      <nav className="fleet-monitor-status-tabs" aria-label="车辆状态筛选">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? "active" : ""}
            aria-pressed={filter === item.id}
            onClick={() => handleStatusFilter(item.id)}
          >
            <i className={item.tone} /><span>{item.label}</span><b>{countOf(item.id)}</b>
          </button>
        ))}
      </nav>

      {plateListOpen && (
        <section className="fleet-monitor-plate-list" aria-label={`${filter === "all" ? "全部" : filter}车辆列表`}>
          <header><span>{filter === "all" ? "全部车辆" : `${filter}车辆`}</span><b>{plateItems.length} 辆</b></header>
          <div>
            {plateItems.length ? plateItems.map((vehicle) => (
              <button key={vehicle.id} type="button" onClick={() => handlePlateSelect(vehicle)}>
                <span><b>{vehicle.plate}</b><small>{vehicle.driverName} · {vehicle.trailerPlate}</small></span>
                <StatusPill status={vehicle.onlineStatus} />
              </button>
            )) : <p>暂无符合条件的车辆</p>}
          </div>
          <button type="button" className="fleet-monitor-plate-list-close" onClick={() => setPlateListOpen(false)}>收起车辆列表 <ChevronDown aria-hidden="true" /></button>
        </section>
      )}

      <div
        className={`fleet-map-toolbar ${hasVisibleCard ? "is-docked-to-card" : ""}`}
        style={toolbarBottom === null ? undefined : { "--fleet-toolbar-bottom": `${toolbarBottom}px` }}
      >
        <span className="fleet-refresh-stamp">更新于 {lastRefreshedAt}</span>
        <button type="button" className="fleet-location-button fleet-station-list-trigger" aria-label="场站列表" onClick={onOpenStationList}>
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
      ) : vehicles.length && selectedVehicle ? (
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
              <b>{selectedVehicle.drivingStatus}</b>
            </div>
            <button type="button" className="fleet-source-detail-link" onClick={() => onOpenVehicle(selectedVehicle)}>
              详情 <ChevronRight aria-hidden="true" />
            </button>
          </div>

          <p className="fleet-panel-vin">VIN {selectedVehicle.vin}</p>

          <div className="fleet-source-assignment" aria-label="车辆当前任务人员">
            <div><span><Truck aria-hidden="true" />挂车车牌</span><b>{selectedVehicle.trailerPlate}</b></div>
            <div><span><UserRound aria-hidden="true" />当前司机</span><b>{selectedVehicle.driverName}</b></div>
          </div>

          <dl className="fleet-source-metrics">
            <div><Truck aria-hidden="true" /><dd><b>{selectedVehicle.onlineStatus}</b><span>在线状态</span></dd></div>
            <div><BatteryMedium aria-hidden="true" /><dd><b>{selectedVehicle.soc === null ? "—" : `${selectedVehicle.soc}%`}</b><span>剩余电量 (SOC)</span></dd></div>
            <div><Gauge aria-hidden="true" /><dd><b>{selectedVehicle.speed || 0} km/h</b><span>当前速度</span></dd></div>
            <div><Activity aria-hidden="true" /><dd><b>{selectedVehicle.totalMileage.toLocaleString()}</b><span>总里程 (km)</span></dd></div>
          </dl>

          <div className="fleet-source-location">
            <MapPin aria-hidden="true" />
            <p>{selectedVehicle.location}</p>
            <span><Clock3 aria-hidden="true" />{selectedVehicle.updatedAt}</span>
          </div>

          <div className="fleet-command-row fleet-source-command-row" aria-label="车辆快捷入口">
            <button type="button" onClick={() => onOpenPage("realtime-data", selectedVehicle)}>
              <Activity aria-hidden="true" /><span>单车监控</span>
            </button>
            <button type="button" onClick={() => onOpenPage("track", selectedVehicle)}>
              <Route aria-hidden="true" /><span>历史轨迹</span>
            </button>
            <button type="button" onClick={() => onOpenPage("vehicle-tasks", selectedVehicle)}>
              <ClipboardList aria-hidden="true" /><span>任务单</span>
            </button>
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
