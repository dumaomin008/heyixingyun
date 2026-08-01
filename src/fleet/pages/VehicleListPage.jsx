import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, Truck, UserRound } from "lucide-react";
import { PageHeader, Pagination, SocBar, StatusPill, EmptyState } from "../components.jsx";
import { alertLabel, alertTone } from "../alerts.js";

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ["全部", "在线", "离线", "从未上线"];

export function VehicleListPage({ vehicles, onBack, onOpenVehicle, title = "车辆列表", onlyFollowed = false }) {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("全部");
  const [model, setModel] = useState("全部");
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);

  const models = useMemo(() => ["全部", ...new Set(vehicles.map((item) => item.model))], [vehicles]);

  const filtered = useMemo(() => {
    const key = keyword.trim().toLowerCase();
    return vehicles.filter((vehicle) => {
      const matchKey = !key || `${vehicle.plate}${vehicle.trailerPlate}${vehicle.driverName}${vehicle.vin}${vehicle.model}`.toLowerCase().includes(key);
      const matchStatus = status === "全部" || vehicle.onlineStatus === status;
      const matchModel = model === "全部" || vehicle.model === model;
      return matchKey && matchStatus && matchModel;
    });
  }, [vehicles, keyword, status, model]);

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function updateFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  return (
    <section className="fleet-detail-page" aria-label={title}>
      <PageHeader
        title={title}
        subtitle={onlyFollowed ? "监控车辆" : "全量车辆档案"}
        onBack={onBack}
        action={(
          <button type="button" className="fleet-header-action" aria-label="筛选" onClick={() => setFilterOpen((value) => !value)}>
            <SlidersHorizontal aria-hidden="true" />
          </button>
        )}
      />
      <div className="fleet-detail-body fleet-list-body">
        <label className="fleet-list-search">
          <Search aria-hidden="true" />
          <input
            value={keyword}
            onChange={(event) => updateFilter(setKeyword, event.target.value)}
            placeholder="搜索车牌 / 挂车 / 司机 / VIN"
          />
        </label>

        {filterOpen && (
          <section className="fleet-list-filters" aria-label="筛选条件">
            <div>
              <span>车辆状态</span>
              <div>
                {STATUS_OPTIONS.map((item) => (
                  <button key={item} type="button" className={status === item ? "active" : ""} onClick={() => updateFilter(setStatus, item)}>{item}</button>
                ))}
              </div>
            </div>
            <div>
              <span>车型</span>
              <div>
                {models.map((item) => (
                  <button key={item} type="button" className={model === item ? "active" : ""} onClick={() => updateFilter(setModel, item)}>{item}</button>
                ))}
              </div>
            </div>
          </section>
        )}

        <p className="fleet-log-count">共 {filtered.length} 辆车辆{filtered.length > PAGE_SIZE ? ` · 每页 ${PAGE_SIZE} 条` : ""}</p>

        {pageItems.length ? pageItems.map((vehicle) => (
          <button key={vehicle.id} type="button" className="fleet-vehicle-card" onClick={() => onOpenVehicle(vehicle)}>
            <div className="fleet-vehicle-card-top">
              <b>{vehicle.plate}</b>
              <StatusPill status={vehicle.onlineStatus} />
            </div>
            <p className="fleet-vehicle-card-vin">{vehicle.vin}</p>
            <div className="fleet-vehicle-card-meta">
              <span>{vehicle.model}</span>
              <span>{vehicle.totalMileage.toLocaleString()} km</span>
            </div>
            <div className="fleet-vehicle-card-assignment">
              <span><Truck aria-hidden="true" /><small>挂车车牌</small><b>{vehicle.trailerPlate}</b></span>
              <span><UserRound aria-hidden="true" /><small>当前司机</small><b>{vehicle.driverName}</b></span>
            </div>
            <div className="fleet-vehicle-card-soc">
              <SocBar soc={vehicle.soc} threshold={vehicle.socThreshold} />
              {vehicle.alert && <em className={alertTone(vehicle.alert)}>{alertLabel(vehicle.alert)}</em>}
            </div>
          </button>
        )) : <EmptyState title="没有符合条件的车辆" hint="请调整搜索或筛选条件" />}

        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
      </div>
    </section>
  );
}
