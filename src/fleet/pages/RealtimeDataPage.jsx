import { useState } from "react";
import { BatteryCharging, ClipboardList, Route, Truck, UserRound } from "lucide-react";
import { PageHeader, DataGrid } from "../components.jsx";
import { buildRealtimeGroups, FLEET_TODAY, fleetDrivingLogs } from "../data.js";
import { getVehiclePrimaryStatus, getVehicleSecondaryStatus, vehiclePrimaryTone, vehicleSecondaryTone } from "../vehicle-status.js";

const REALTIME_TAB_ORDER = ["整车数据", "电池储能", "驱动电机", "报警数据", "定位数据", "极值数据"];

// 对应 TSP 单车监控的 7 类数据标签。
export function RealtimeDataPage({ vehicle, onBack, onOpenPage }) {
  const groups = buildRealtimeGroups(vehicle);
  const tabs = REALTIME_TAB_ORDER.filter((item) => groups[item]);
  const [tab, setTab] = useState(tabs[0]);
  const primaryStatus = getVehiclePrimaryStatus(vehicle);
  const secondaryStatus = getVehicleSecondaryStatus(vehicle);
  const displayStatus = secondaryStatus ?? primaryStatus;
  const statusTone = secondaryStatus ? vehicleSecondaryTone(secondaryStatus) : vehiclePrimaryTone(primaryStatus);
  const todayMileage = Number(fleetDrivingLogs
    .filter((log) => log.vehicleId === vehicle.id && log.startAt.startsWith(FLEET_TODAY))
    .reduce((total, log) => total + log.mileage, 0)
    .toFixed(1));
  const speed = primaryStatus === "在线" ? vehicle.speed : null;
  // TMS 未接入或接口异常时不占用 TSP 单车监控的核心空间。
  const hasTmsBusinessInfo = vehicle.tmsAvailable !== false
    && !vehicle.tmsLoadError
    && Boolean(vehicle.trailerPlate || vehicle.driverName || vehicle.tmsTaskStatus);
  const tmsTone = vehicle.tmsTaskStatus === "有任务"
    ? "active"
    : vehicle.tmsTaskStatus === "待运输"
      ? "pending"
      : vehicle.tmsTaskStatus === "无任务"
        ? "none"
        : "suspended";
  const taskOrderNo = ["有任务", "待运输"].includes(vehicle.tmsTaskStatus)
    ? vehicle.taskOrders?.[0]?.id
    : null;

  return (
    <section className="fleet-detail-page" aria-label="单车实时数据">
      <PageHeader
        title="单车监控"
        onBack={onBack}
      />
      <div className="fleet-detail-body fleet-realtime-body">
        <section className="fleet-realtime-status-overview" aria-label="车辆状态概览">
          <div className="fleet-realtime-status-main">
            <h2>{vehicle.plate}</h2>
            <span className={`fleet-realtime-status-tag ${statusTone}`}>{displayStatus}</span>
          </div>
          <time>最后更新 · {vehicle.updatedAt}</time>
          {hasTmsBusinessInfo && (
            <div className="fleet-realtime-tms-inline" aria-label="TMS 业务信息">
              <span><Truck aria-hidden="true" /><small>挂车车牌</small><b>{vehicle.trailerPlate || "—"}</b></span>
              <span><UserRound aria-hidden="true" /><small>所属司机</small><b>{vehicle.driverName || "—"}</b></span>
              <span><ClipboardList aria-hidden="true" /><small>{taskOrderNo ? "任务单号" : "任务状态"}</small><b className={taskOrderNo ? "task-order" : tmsTone}>{taskOrderNo || vehicle.tmsTaskStatus || "—"}</b></span>
            </div>
          )}
        </section>

        <section className="fleet-core-metrics" aria-label="核心运营指标">
          <article>
            <span>剩余电量（SOC）</span>
            <b>{vehicle.soc === null ? "—" : `${vehicle.soc}%`}</b>
            <div className="fleet-core-soc-track" aria-hidden="true"><i style={{ width: `${vehicle.soc ?? 0}%` }} className={vehicle.soc !== null && vehicle.soc <= vehicle.socThreshold ? "low" : ""} /></div>
          </article>
          <article>
            <span>当前车速</span>
            <b>{speed === null ? "—" : `${speed} km/h`}</b>
          </article>
          <article>
            <span>今日行驶里程</span>
            <b>{todayMileage.toLocaleString()} <small>km</small></b>
          </article>
          <article>
            <span>累计总里程</span>
            <b>{vehicle.totalMileage.toLocaleString()} <small>km</small></b>
          </article>
        </section>

        <nav className="fleet-realtime-quick-actions" aria-label="单车高频功能">
          <button type="button" onClick={() => onOpenPage("track", vehicle)}><Route aria-hidden="true" /><span>历史轨迹</span></button>
          <button type="button" onClick={() => onOpenPage("driving-logs", vehicle)}><Route aria-hidden="true" /><span>行车日志</span></button>
          <button type="button" onClick={() => onOpenPage("charging-logs", vehicle)}><BatteryCharging aria-hidden="true" /><span>充电日志</span></button>
        </nav>

        <section className="fleet-realtime-details" aria-label="明细数据">
          <header><b>明细数据</b><span>深度排查</span></header>
          <nav className="fleet-realtime-tabs scrollable" aria-label="实时数据分类">
            {tabs.map((item) => (
              <button key={item} type="button" className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>
            ))}
          </nav>

          <DataGrid
            rows={groups[tab]}
            highlightKey={(label, value) => tab === "报警数据" && label === "当前报警" && value !== "无"}
          />
        </section>
      </div>
    </section>
  );
}
