import { useState } from "react";
import { Activity, ClipboardList, Database, PlugZap, Route, Star } from "lucide-react";
import { PageHeader, StatusPill } from "../components.jsx";
import { FleetSpotMap } from "../maps.jsx";
import { fleetDrivingLogs } from "../data.js";
import { alertDescription, alertLabel } from "../alerts.js";

const TABS = ["实时信息", "基本信息", "最近行程"];

// 对应 TSP 端「车辆状态卡」：把单车监控、基本档案、行车日志整合到一页。
export function VehicleDetailPage({ vehicle, isFollowed, onBack, onOpenPage, onToggleFollow }) {
  const [tab, setTab] = useState("实时信息");
  const recentTrips = fleetDrivingLogs.filter((log) => log.vehicleId === vehicle.id).slice(0, 5);
  const locatable = vehicle.onlineStatus !== "从未上线";

  return (
    <section className="fleet-detail-page" aria-label={`${vehicle.plate}车辆详情`}>
      <PageHeader
        title="车辆详情"
        subtitle={vehicle.plate}
        onBack={onBack}
        action={(
          <button
            type="button"
            className={`fleet-header-action ${isFollowed ? "active" : ""}`}
            aria-label={isFollowed ? "取消关注" : "关注车辆"}
            onClick={onToggleFollow}
          >
            <Star aria-hidden="true" fill={isFollowed ? "currentColor" : "none"} />
          </button>
        )}
      />
      <div className="fleet-detail-body">
        <section className="fleet-detail-hero">
          <div>
            <span><StatusPill status={vehicle.onlineStatus} /> {vehicle.updatedAt}</span>
            <h2>{vehicle.plate}</h2>
            <p>{vehicle.model}</p>
          </div>
          <strong className={vehicle.soc !== null && vehicle.soc <= vehicle.socThreshold ? "low" : ""}>
            {vehicle.soc === null ? "—" : vehicle.soc}<small>{vehicle.soc === null ? "" : "%"}</small>
          </strong>
        </section>

        <nav className="fleet-realtime-tabs" aria-label="车辆信息分类">
          {TABS.map((item) => (
            <button key={item} type="button" className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>
          ))}
        </nav>

        {tab === "实时信息" && (
          <>
            <section className="fleet-detail-section">
              <dl className="fleet-detail-grid">
                <div><dt>车辆状态</dt><dd>{vehicle.drivingStatus}</dd></div>
                <div><dt>充电状态</dt><dd>{vehicle.chargingStatus}</dd></div>
                <div><dt>当前车速</dt><dd>{vehicle.onlineStatus === "在线" ? `${vehicle.speed} km/h` : "—"}</dd></div>
                <div><dt>当前档位</dt><dd>{vehicle.gear}</dd></div>
                <div><dt>累计里程</dt><dd>{vehicle.totalMileage.toLocaleString()} km</dd></div>
                <div><dt>SOC</dt><dd>{vehicle.soc === null ? "—" : `${vehicle.soc}%`}</dd></div>
                <div><dt>数据采集</dt><dd>{vehicle.updatedAt}</dd></div>
                <div><dt>VIN</dt><dd className="mono">{vehicle.vin}</dd></div>
              </dl>
            </section>
            <section className="fleet-detail-section">
              <h2>当前位置</h2>
              <p className="fleet-detail-location">{vehicle.location}</p>
              {locatable
                ? <FleetSpotMap lng={vehicle.lng} lat={vehicle.lat} label={vehicle.plate} />
                : <p className="fleet-detail-hint">该车尚未上报定位数据。</p>}
            </section>
          </>
        )}

        {tab === "基本信息" && (
          <section className="fleet-detail-section">
            <dl className="fleet-detail-grid">
              <div><dt>公告型号</dt><dd>{vehicle.modelCode}</dd></div>
              <div><dt>整车配置代码</dt><dd className="mono">{vehicle.configCode}</dd></div>
              <div><dt>车型</dt><dd>{vehicle.model}</dd></div>
              <div><dt>配置级别</dt><dd>{vehicle.level}</dd></div>
              <div><dt>颜色</dt><dd>{vehicle.color}</dd></div>
              <div><dt>电池包编码</dt><dd className="mono">{vehicle.batteryCode}</dd></div>
              <div><dt>电机编码</dt><dd className="mono">{vehicle.motorCode}</dd></div>
              <div><dt>生产日期</dt><dd>{vehicle.producedAt}</dd></div>
              <div><dt>上牌日期</dt><dd>{vehicle.registeredAt}</dd></div>
              <div><dt>上牌城市</dt><dd>{vehicle.registerCity}</dd></div>
              <div><dt>车机版本</dt><dd>{vehicle.machineVersion}</dd></div>
              <div><dt>TBOX 版本</dt><dd>{vehicle.tboxVersion}</dd></div>
              <div><dt>ICCID</dt><dd className="mono">{vehicle.iccid}</dd></div>
              <div><dt>更新时间</dt><dd>{vehicle.profileUpdatedAt}</dd></div>
            </dl>
          </section>
        )}

        {tab === "最近行程" && (
          <section className="fleet-detail-section">
            {recentTrips.length ? recentTrips.map((log) => (
              <article key={log.id} className="fleet-log-card">
                <div className="fleet-log-card-title"><b>{log.startAt}</b><span>{log.mileage} km</span></div>
                <p>{log.start} → {log.end}</p>
                <div className="fleet-log-card-footer">
                  <small>结束 {log.endAt} · 能耗 {log.energy}</small>
                  <button type="button" onClick={() => onOpenPage("trip-track", vehicle, log)}>查看轨迹</button>
                </div>
              </article>
            )) : <p className="fleet-detail-hint">该车暂无行程记录。</p>}
          </section>
        )}

        <section className="fleet-detail-actions" aria-label="车辆能力入口">
          <button type="button" onClick={() => onOpenPage("realtime-data", vehicle)}>
            <Activity aria-hidden="true" /><b>实时数据</b><span>整车、电机、定位、极值、报警</span>
          </button>
          <button type="button" onClick={() => onOpenPage("track", vehicle)}>
            <Route aria-hidden="true" /><b>历史轨迹</b><span>查询与回放车辆行驶路线</span>
          </button>
          <button type="button" onClick={() => onOpenPage("driving-logs", vehicle)}>
            <ClipboardList aria-hidden="true" /><b>行车日志</b><span>查看近期行程与里程</span>
          </button>
          <button type="button" onClick={() => onOpenPage("charging-logs", vehicle)}>
            <PlugZap aria-hidden="true" /><b>充电日志</b><span>查看 SOC 与充电量变化</span>
          </button>
          <button type="button" onClick={() => onOpenPage("daily-report", vehicle)}>
            <ClipboardList aria-hidden="true" /><b>单车日报表</b><span>行驶、能耗、充电指标</span>
          </button>
          <button type="button" onClick={() => onOpenPage("raw-data", vehicle)}>
            <Database aria-hidden="true" /><b>明细数据</b><span>关键报文字段查询</span>
          </button>
        </section>

        {vehicle.alert && (
          <section className="fleet-detail-alert">
            <b>{alertLabel(vehicle.alert)}</b>
            <span>{alertDescription(vehicle)}</span>
          </section>
        )}
      </div>
    </section>
  );
}
