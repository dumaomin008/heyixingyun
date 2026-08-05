import { useMemo, useState } from "react";
import { Search, Truck, UserRound } from "lucide-react";
import { PageHeader, EmptyState } from "../components.jsx";
import { getVehiclePrimaryStatus, getVehicleSecondaryStatus, vehiclePrimaryTone, vehicleSecondaryTone } from "../vehicle-status.js";

const PAGE_SIZE = 20;
const VEHICLE_STATUS_FILTERS = [
  ["all", "全部"],
  ["online", "在线"],
  ["offline", "离线"],
  ["driving", "行驶中"],
  ["charging", "充电中"],
];
const TMS_STATUS_FILTERS = ["全部", "有任务", "待运输", "无任务", "停运"];
function matchesStatus(vehicle, status) {
  if (status === "all") return true;
  if (status === "online") return vehicle.onlineStatus === "在线";
  if (status === "offline") return vehicle.onlineStatus === "离线";
  if (status === "driving") return getVehicleSecondaryStatus(vehicle) === "行驶中";
  if (status === "charging") return getVehicleSecondaryStatus(vehicle) === "充电中";
  return true;
}

function tmsTone(status) {
  if (status === "有任务") return "active";
  if (status === "待运输") return "pending";
  if (status === "无任务") return "none";
  if (status === "停运") return "suspended";
  return "";
}

function sortVehicles(vehicles, status) {
  return [...vehicles].sort((left, right) => {
    if (status === "offline") {
      const leftAbnormal = left.offlineDurationHours >= 24 ? 1 : 0;
      const rightAbnormal = right.offlineDurationHours >= 24 ? 1 : 0;
      return rightAbnormal - leftAbnormal || (right.offlineDurationHours ?? 0) - (left.offlineDurationHours ?? 0);
    }
    if (status === "all") {
      const order = { "在线": 0, "离线": 1, "从未上线": 2 };
      return (order[left.onlineStatus] ?? 9) - (order[right.onlineStatus] ?? 9);
    }
    return 0;
  });
}

export function VehicleListPage({ vehicles, onBack, onOpenVehicle, title = "车辆列表", initialFilter = "all", showFilters = false }) {
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [vehicleStatus, setVehicleStatus] = useState(initialFilter);
  const [tmsStatus, setTmsStatus] = useState("全部");
  const status = showFilters ? vehicleStatus : initialFilter;

  const filtered = useMemo(() => {
    const key = keyword.trim().toLowerCase();
    const matches = vehicles.filter((vehicle) => {
      const matchKey = !key || `${vehicle.plate}${vehicle.vin}`.toLowerCase().includes(key);
      const matchStatus = matchesStatus(vehicle, status);
      const matchTmsStatus = !showFilters || tmsStatus === "全部" || vehicle.tmsTaskStatus === tmsStatus;
      return matchKey && matchStatus && matchTmsStatus;
    });
    return sortVehicles(matches, status);
  }, [vehicles, keyword, status, tmsStatus, showFilters]);

  const pageItems = filtered.slice(0, page * PAGE_SIZE);

  function updateFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  function loadMoreOnReachBottom(event) {
    const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 72) {
      setPage((current) => current * PAGE_SIZE < filtered.length ? current + 1 : current);
    }
  }

  return (
    <section className="fleet-detail-page fleet-vehicle-list-page" aria-label={title}>
      <PageHeader
        title={title}
        onBack={onBack}
      />
      <div className="fleet-detail-body fleet-list-body" onScroll={loadMoreOnReachBottom}>
        {showFilters && <section className="fleet-vehicle-filter-panel" aria-label="车辆双行筛选">
          <nav aria-label="TSP 车辆状态筛选">
            <strong>TSP状态</strong>
            {VEHICLE_STATUS_FILTERS.map(([value, label]) => <button key={value} type="button" className={vehicleStatus === value ? "active" : undefined} aria-pressed={vehicleStatus === value} onClick={() => updateFilter(setVehicleStatus, value)}>{label}</button>)}
          </nav>
          <nav aria-label="TMS 任务状态筛选">
            <strong>TMS任务</strong>
            {TMS_STATUS_FILTERS.map((value) => <button key={value} type="button" className={tmsStatus === value ? "active" : undefined} aria-pressed={tmsStatus === value} onClick={() => updateFilter(setTmsStatus, value)}>{value}</button>)}
          </nav>
        </section>}
        <label className="fleet-list-search">
          <Search aria-hidden="true" />
          <input
            value={keyword}
            onChange={(event) => updateFilter(setKeyword, event.target.value)}
            placeholder="搜索车牌 / VIN"
          />
        </label>

        {pageItems.length ? pageItems.map((vehicle) => {
          const primaryStatus = getVehiclePrimaryStatus(vehicle);
          const secondaryStatus = getVehicleSecondaryStatus(vehicle);
          return (
          <button key={vehicle.id} type="button" className={`fleet-vehicle-card ${vehicle.onlineStatus === "离线" && vehicle.offlineDurationHours >= 24 ? "abnormal-offline" : ""}`} onClick={() => onOpenVehicle(vehicle)}>
            <div className="fleet-vehicle-card-top">
              <span className="fleet-vehicle-card-identity">
                <b>{vehicle.plate}</b>
                {secondaryStatus && <span className={`fleet-vehicle-secondary-state ${vehicleSecondaryTone(secondaryStatus)}`}>{secondaryStatus}</span>}
                {vehicle.tmsTaskStatus && <span className={`fleet-tms-state ${tmsTone(vehicle.tmsTaskStatus)}`}>{vehicle.tmsTaskStatus}</span>}
              </span>
              <span className="fleet-vehicle-card-tags">
                <span className={`fleet-vehicle-state ${vehiclePrimaryTone(primaryStatus)}`}>{primaryStatus}</span>
              </span>
            </div>
            <p className="fleet-vehicle-card-vin"><b>{vehicle.model}</b><span>{vehicle.vin}</span></p>
            <div className="fleet-vehicle-card-meta">
              <span>SOC {vehicle.soc === null ? "—" : `${vehicle.soc}%`}</span>
              <span>{vehicle.totalMileage.toLocaleString()} km</span>
              <span>{vehicle.location}</span>
            </div>
            <div className="fleet-vehicle-card-assignment">
              <span><Truck aria-hidden="true" /><small>挂车车牌</small><b>{vehicle.trailerPlate}</b></span>
              <span><UserRound aria-hidden="true" /><small>当前司机</small><b>{vehicle.driverName}</b></span>
            </div>
            {vehicle.onlineStatus === "离线" && <p className="fleet-vehicle-offline-duration">已离线 {vehicle.offlineDurationHours} 小时</p>}
          </button>
          );
        }) : <EmptyState title="没有符合条件的车辆" hint="请调整搜索或筛选条件" />}

        {pageItems.length > 0 && pageItems.length < filtered.length && <p className="fleet-vehicle-load-more">继续上拉加载更多</p>}
      </div>
    </section>
  );
}
