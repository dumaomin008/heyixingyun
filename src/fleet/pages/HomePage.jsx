import { useState } from "react";
import { Activity, BatteryCharging, FileText, Gauge, Map, PackageCheck, Route, Truck } from "lucide-react";
import { ScopeHeader } from "../components.jsx";
import { alertCoreInfo, alertDescription, alertLabel, alertTone } from "../alerts.js";

const OPERATING_STATS = [
  { value: "1,214", label: "近30日总车次" },
  { value: "235", label: "待派车车次" },
  { value: "2", label: "待运输车次" },
  { value: "21", label: "运输中车次" },
  { value: "956", label: "已完成车次" },
];

const DELIVERY_RATES = [
  ["07.26", 100],
  ["07.27", 100],
  ["07.29", 100],
  ["07.30", 100],
];

export function HomePage({ counts, summary, alerts, vehicles, scopeSelection, onScopeChange, onQuickAction, onOpenAlerts, onOpenVehicle }) {
  const [analysis, setAnalysis] = useState("operation");

  return (
    <section className="fleet-content-page fleet-home-page" aria-label="首页">
      <ScopeHeader title="首页" scopeSelection={scopeSelection} onScopeChange={onScopeChange} />

      <div className="fleet-page-body fleet-home-body">
        <nav className="fleet-home-analysis-tabs" aria-label="首页分析维度">
          <button type="button" className={analysis === "operation" ? "active" : undefined} onClick={() => setAnalysis("operation")}>运输经营分析</button>
          <button type="button" className={analysis === "vehicle" ? "active" : undefined} onClick={() => setAnalysis("vehicle")}>车辆运行分析</button>
        </nav>

        {analysis === "operation" ? <OperationAnalysis counts={counts} /> : (
          <VehicleAnalysis
            counts={counts}
            summary={summary}
            alerts={alerts}
            vehicles={vehicles}
            onQuickAction={onQuickAction}
            onOpenAlerts={onOpenAlerts}
            onOpenVehicle={onOpenVehicle}
          />
        )}
      </div>
    </section>
  );
}

function OperationAnalysis({ counts }) {
  const scopeRatio = counts.total / 34;
  const metrics = OPERATING_STATS.map((item) => ({ ...item, value: Math.round(Number(item.value.replace(/,/g, "")) * scopeRatio).toLocaleString() }));
  return <>
    <section className="fleet-home-business-hero" aria-label="运输经营指标">
      <div className="fleet-home-trip-stats">{metrics.map((item) => <div key={item.label}><b>{item.value}</b><span>{item.label}</span></div>)}</div>
    </section>
    <section className="fleet-home-data-card" aria-labelledby="home-shipment-title">
      <div className="fleet-home-section-heading"><div><span>业务报表</span><h2 id="home-shipment-title">昨日发货量 <small>（t）</small></h2></div></div>
      <div className="fleet-home-empty-chart"><PackageCheck aria-hidden="true" /><b>暂无发货量数据</b><span>接入运单后将在此展示昨日发货趋势</span></div>
    </section>
    <section className="fleet-home-data-card fleet-home-rate-card" aria-labelledby="home-rate-title">
      <div className="fleet-home-section-heading"><div><span>履约质量</span><h2 id="home-rate-title">任务单及时送达率 <small>（%）</small></h2></div></div>
      <ol className="fleet-home-rate-list" aria-label="任务单及时送达率">{DELIVERY_RATES.map(([date, rate]) => <li key={date}><div><b>{rate}</b><span>%</span></div><meter min="0" max="100" value={rate} aria-label={`${date} 及时送达率 ${rate}%`} /><time>{date}</time></li>)}</ol>
    </section>
  </>;
}

function VehicleAnalysis({ counts, summary, alerts, vehicles, onQuickAction, onOpenAlerts, onOpenVehicle }) {
  const onlineVehicles = vehicles.filter((vehicle) => vehicle.onlineStatus === "在线");
  // 离线口径为当前非在线车辆（含从未上线）；异常离线仅统计连续离线达 24 小时的车辆。
  const offlineVehicles = vehicles.filter((vehicle) => vehicle.onlineStatus !== "在线");
  const abnormalOfflineCount = offlineVehicles.filter((vehicle) => vehicle.onlineStatus === "离线" && vehicle.offlineDurationHours >= 24).length;
  const drivingCount = vehicles.filter((vehicle) => vehicle.drivingStatus === "行驶中").length;
  const chargingCount = vehicles.filter((vehicle) => vehicle.chargingStatus === "充电中").length;
  const averageSoc = onlineVehicles.length ? Math.round(onlineVehicles.reduce((total, vehicle) => total + vehicle.soc, 0) / onlineVehicles.length) : 0;
  const onlineRate = counts.total ? Math.round((counts.online / counts.total) * 100) : 0;
  return <>
    <section className="fleet-home-vehicle-radar" aria-label="车辆运行分析">
      <div className="fleet-home-radar-metrics">
        <button type="button" onClick={() => onQuickAction("vehicle-list")}><span>在管车辆</span><b>{counts.total}</b><small>辆</small></button>
        <button type="button" onClick={() => onQuickAction("monitor")}><span>在线</span><b className="online">{counts.online}</b><small>辆</small></button>
        <button type="button" onClick={() => onQuickAction("vehicle-list")} aria-label={`离线 ${offlineVehicles.length} 辆${abnormalOfflineCount ? `，${abnormalOfflineCount} 辆异常离线` : ""}`}>
          <span>离线</span><b className={abnormalOfflineCount ? "warning" : "muted"}>{offlineVehicles.length}</b><small>{abnormalOfflineCount ? <em>{abnormalOfflineCount} 异常</em> : "辆"}</small>
        </button>
        <button type="button" onClick={() => onQuickAction("driving-logs")}><span>行驶中</span><b className="online">{drivingCount}</b><small>辆</small></button>
        <button type="button" onClick={() => onQuickAction("charging-logs")}><span>充电中</span><b className="muted">{chargingCount}</b><small>辆</small></button>
      </div>
      <div className="fleet-home-analysis-actions">
        <button type="button" onClick={() => onQuickAction("monitor")}><Activity aria-hidden="true" /><span>车辆在线率<b>{onlineRate}<small> %</small></b></span></button>
        <button type="button" onClick={() => onQuickAction("vehicle-list")}><Gauge aria-hidden="true" /><span>平均 SOC<b>{averageSoc}<small> %</small></b></span></button>
        <button type="button" onClick={() => onQuickAction("driving-logs")}><Route aria-hidden="true" /><span>今日行驶<b>{summary.mileage.toLocaleString()}<small> km</small></b></span></button>
        <button type="button" onClick={() => onQuickAction("charging-logs")}><BatteryCharging aria-hidden="true" /><span>今日充电<b>{summary.electricity.toLocaleString()}<small> kWh</small></b></span></button>
      </div>
      <p>数据来源于TSP车联网平台</p>
    </section>
    <section className="fleet-home-insight-grid" aria-label="监控快捷分析">
      <button type="button" onClick={() => onQuickAction("charging-logs")}><BatteryCharging aria-hidden="true" /><span><b>充电记录</b><small>查看充电记录与效率</small></span></button>
      <button type="button" onClick={() => onQuickAction("daily-report")}><FileText aria-hidden="true" /><span><b>单车日报</b><small>查看运营指标统计</small></span></button>
      <button type="button" onClick={() => onQuickAction("monitor")}><Map aria-hidden="true" /><span><b>实时地图</b><small>定位全部在线车辆</small></span></button>
      <button type="button" onClick={() => onQuickAction("vehicle-list")}><Truck aria-hidden="true" /><span><b>车辆列表</b><small>查询全量车辆状态</small></span></button>
    </section>
    <section className="fleet-alert-preview fleet-home-alert-preview">
      <header><div><h2>最新预警 <small>· 待处置 {alerts.length} 条</small></h2></div><button type="button" onClick={onOpenAlerts}>全部预警</button></header>
      {alerts.length ? alerts.slice(0, 3).map((vehicle) => <HomeAlertRow key={vehicle.id} vehicle={vehicle} onOpen={() => onOpenVehicle(vehicle)} />) : <p className="fleet-alert-empty">当前没有待处理预警</p>}
    </section>
  </>;
}

function HomeAlertRow({ vehicle, onOpen }) {
  const core = alertCoreInfo(vehicle);
  return <button type="button" className="fleet-alert-row" onClick={onOpen}>
    <span className={alertTone(vehicle.alert)}>{alertLabel(vehicle.alert)}</span>
    <div className="fleet-alert-row-content">
      <b>{vehicle.plate}</b>
      <small>{alertDescription(vehicle)}</small>
      <p className="fleet-alert-core-info compact"><em className={core.level === "紧急" ? "emergency" : "general"}>{core.level}</em><span>{core.duration}</span><span>{core.vehicleStatus}</span></p>
    </div>
  </button>;
}
