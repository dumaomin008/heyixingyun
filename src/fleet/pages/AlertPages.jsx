import { useState } from "react";
import { PageHeader, EmptyState, SocBar } from "../components.jsx";
import { SOC_THRESHOLDS } from "../data.js";
import { ALERT_TYPES, alertCoreInfo, alertDescription, alertLabel, alertTone, mapSafetyAlertTone } from "../alerts.js";
import { getVehiclePrimaryStatus, getVehicleSecondaryStatus } from "../vehicle-status.js";

// 预警中心按故障、离线超时、SOC 的风险等级接收已排序预警，支持标记已处理。
export function AlertCenterPage({ alerts, onBack, onOpenVehicle, onHandle }) {
  const [filter, setFilter] = useState("全部");
  const visible = alerts.filter((vehicle) => filter === "全部" || vehicle.alert === filter);

  return (
    <section className="fleet-detail-page" aria-label="预警中心">
      <PageHeader title="预警中心" onBack={onBack} />
      <div className="fleet-detail-body fleet-alert-list-body">
        <section className="fleet-alert-filter" aria-label="预警分类">
          {["全部", ...ALERT_TYPES].map((item) => (
            <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>
          ))}
        </section>
        <p className="fleet-alert-list-intro">共 {visible.length} 辆车辆需要关注</p>
        {visible.length ? visible.map((vehicle) => {
          const core = alertCoreInfo(vehicle);
          return <article key={vehicle.id} className="fleet-alert-card">
            <button type="button" className="fleet-alert-open" onClick={() => onOpenVehicle(vehicle)}>
              <span className={alertTone(vehicle.alert)}>{alertLabel(vehicle.alert)}</span>
              <b>{vehicle.plate}</b>
              <small>{vehicle.model}</small>
              <p>{alertDescription(vehicle)}</p>
              <dl className="fleet-alert-core-info">
                <div><dt>预警等级</dt><dd className={core.level === "紧急" ? "emergency" : "general"}>{core.level}</dd></div>
                <div><dt>持续时长</dt><dd>{core.duration}</dd></div>
                <div><dt>车辆状态</dt><dd>{core.vehicleStatus}</dd></div>
              </dl>
            </button>
            <button type="button" className="fleet-alert-handle" onClick={() => onHandle(vehicle.id)}>标记已处理</button>
          </article>;
        }) : <EmptyState title="当前没有待处理预警" hint="已处理的预警不会在此显示" />}
      </div>
    </section>
  );
}

const SAFETY_FILTERS = ["全部", "紧急", "SOC 过低", "行驶中停留", "围栏内停留"];

// 地图入口对应的独立安全告警页：事件口径而非车辆口径，同车多项风险分别保留。
export function SafetyAlertPage({ alerts, acknowledgedIds, onBack, onOpenAlert, onAcknowledge }) {
  const [filter, setFilter] = useState("全部");
  const visibleAlerts = alerts.filter((alert) => filter === "全部" || alert.level === filter || alert.type === filter);
  const pendingCount = alerts.filter((alert) => !acknowledgedIds.includes(alert.id)).length;

  return (
    <section className="fleet-detail-page fleet-safety-alert-page" aria-label="安全告警">
      <PageHeader title="安全告警" subtitle="地图实时风险" onBack={onBack} showBackLabel />
      <div className="fleet-detail-body fleet-safety-alert-body">
        <section className="fleet-alert-filter" aria-label="安全告警筛选">
          {SAFETY_FILTERS.map((item) => (
            <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>
          ))}
        </section>
        <p className="fleet-safety-alert-intro">发生中 {alerts.length} 条 · 待知悉 {pendingCount} 条 · 涉及 {new Set(alerts.map((alert) => alert.vehicle.id)).size} 车</p>
        {visibleAlerts.length ? visibleAlerts.map((alert) => {
          const acknowledged = acknowledgedIds.includes(alert.id);
          const vehicleStatus = getVehicleSecondaryStatus(alert.vehicle) ?? getVehiclePrimaryStatus(alert.vehicle);
          return (
            <article key={alert.id} className={`fleet-safety-alert-card ${mapSafetyAlertTone(alert)} ${alert.level === "紧急" ? "urgent" : "general"}`}>
              <button type="button" className="fleet-safety-alert-open" onClick={() => onOpenAlert(alert)}>
                <div><b>{alert.vehicle.plate}</b><em>{alert.type}</em>{acknowledged && <i>已知悉</i>}</div>
                <p>{alert.description}</p>
                <dl>
                  <div><dt>等级</dt><dd>{alert.level}</dd></div>
                  <div><dt>持续时长</dt><dd>{alert.duration}</dd></div>
                  <div><dt>车辆状态</dt><dd>{vehicleStatus}</dd></div>
                </dl>
              </button>
              <button type="button" className={acknowledged ? "acknowledged" : ""} disabled={acknowledged} onClick={() => onAcknowledge(alert.id)}>{acknowledged ? "已知悉" : "知悉"}</button>
            </article>
          );
        }) : <EmptyState title="暂无符合条件的安全告警" hint="可切换筛选条件查看其他发生中事件" />}
      </div>
    </section>
  );
}

// SOC 过低车辆：对齐 TSP 同名页面的字段与阈值筛选。
export function SocAlertPage({ vehicles, onBack, onOpenVehicle }) {
  const [threshold, setThreshold] = useState("全部");
  const [keyword, setKeyword] = useState("");

  const list = vehicles.filter((vehicle) => {
    if (vehicle.soc === null || vehicle.soc > vehicle.socThreshold) return false;
    if (threshold !== "全部" && vehicle.socThreshold !== Number(threshold)) return false;
    const key = keyword.trim().toLowerCase();
    return !key || `${vehicle.plate}${vehicle.vin}${vehicle.model}`.toLowerCase().includes(key);
  });

  return (
    <section className="fleet-detail-page" aria-label="SOC 过低车辆">
      <PageHeader title="SOC 过低车辆" subtitle="低电量预警" onBack={onBack} />
      <div className="fleet-detail-body fleet-log-body">
        <label className="fleet-list-search">
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索车牌 / VIN / 车型" />
        </label>
        <section className="fleet-log-filter" aria-label="SOC 阈值">
          {["全部", ...SOC_THRESHOLDS].map((item) => (
            <button key={item} type="button" className={String(threshold) === String(item) ? "active" : ""} onClick={() => setThreshold(item)}>
              {item === "全部" ? "全部阈值" : `${item}%`}
            </button>
          ))}
        </section>
        <p className="fleet-log-count">共 {list.length} 辆车辆低于阈值</p>
        {list.length ? list.map((vehicle) => (
          <button key={vehicle.id} type="button" className="fleet-soc-card" onClick={() => onOpenVehicle(vehicle)}>
            <div className="fleet-soc-card-top">
              <b>{vehicle.plate}</b>
              <em>阈值 {vehicle.socThreshold}%</em>
            </div>
            <p className="fleet-vehicle-card-vin">{vehicle.vin}</p>
            <SocBar soc={vehicle.soc} threshold={vehicle.socThreshold} />
            <div className="fleet-soc-card-meta">
              <span>{vehicle.model}</span>
              <span>{vehicle.registerCity}</span>
              <span>提醒于 {vehicle.alertStartAt ?? "—"}</span>
            </div>
          </button>
        )) : <EmptyState title="暂无低电量车辆" hint="所有车辆电量均高于阈值" />}
      </div>
    </section>
  );
}
