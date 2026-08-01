import { useState } from "react";
import { PageHeader, RangeTabs, EmptyState } from "../components.jsx";
import { FleetSpotMap, FleetTripTrackMap } from "../maps.jsx";
import { fleetChargingLogs, fleetDrivingLogs, getTrackSegments } from "../data.js";

const RANGES = ["近 7 天", "近 30 天", "自定义"];

export function DrivingLogPage({ vehicle, onBack, onOpenTrip }) {
  const [range, setRange] = useState(RANGES[0]);
  const logs = fleetDrivingLogs.filter((log) => log.vehicleId === vehicle.id);

  return (
    <section className="fleet-detail-page" aria-label="行车日志">
      <PageHeader title="行车日志" subtitle={vehicle.plate} onBack={onBack} />
      <div className="fleet-detail-body fleet-log-body">
        <RangeTabs options={RANGES} value={range} onChange={setRange} />
        <p className="fleet-log-count">{vehicle.plate} · {range} · 共 {logs.length} 条记录</p>
        {logs.length ? logs.map((log) => (
          <section key={log.id} className="fleet-log-card">
            <div className="fleet-log-card-title"><b>{log.startAt}</b><span>{log.mileage} km</span></div>
            <p>{log.start} → {log.end}</p>
            <div className="fleet-log-card-footer">
              <small>结束 {log.endAt} · 能耗 {log.energy}</small>
              <button type="button" onClick={() => onOpenTrip(log)}>查看轨迹</button>
            </div>
          </section>
        )) : <EmptyState title="暂无行车记录" hint="该车在所选时间范围内没有行程" />}
      </div>
    </section>
  );
}

export function ChargingLogPage({ vehicle, onBack, onOpenSpot }) {
  const [range, setRange] = useState(RANGES[0]);
  const logs = fleetChargingLogs.filter((log) => log.vehicleId === vehicle.id);

  return (
    <section className="fleet-detail-page" aria-label="充电日志">
      <PageHeader title="充电日志" subtitle={vehicle.plate} onBack={onBack} />
      <div className="fleet-detail-body fleet-log-body">
        <RangeTabs options={RANGES} value={range} onChange={setRange} />
        <p className="fleet-log-count">{vehicle.plate} · {range} · 共 {logs.length} 条记录</p>
        {logs.length ? logs.map((log) => (
          <section key={log.id} className="fleet-log-card">
            <div className="fleet-log-card-title"><b>{log.startAt}</b><span>{log.electricity}</span></div>
            <p>{log.location}</p>
            <div className="fleet-charging-metrics">
              <span>SOC {log.startSoc}%</span><i>→</i><span>SOC {log.endSoc}%</span>
            </div>
            <div className="fleet-log-card-footer">
              <small>结束 {log.endAt} · 充电时长 {log.duration}</small>
              <button type="button" onClick={() => onOpenSpot(log)}>位置查看</button>
            </div>
          </section>
        )) : <EmptyState title="暂无充电记录" hint="该车在所选时间范围内没有充电" />}
      </div>
    </section>
  );
}

// 单次行程轨迹：从行车日志或最近行程进入，静态展示不带播放。
export function TripTrackPage({ vehicle, log, onBack }) {
  const segments = getTrackSegments(vehicle.id);
  const segment = segments[0];
  return (
    <section className="fleet-detail-page" aria-label="行程轨迹">
      <PageHeader title="行程轨迹" subtitle={vehicle.plate} onBack={onBack} />
      <div className="fleet-detail-body">
        <section className="fleet-detail-section">
          <dl className="fleet-detail-grid">
            <div><dt>开始时间</dt><dd>{log?.startAt ?? "—"}</dd></div>
            <div><dt>结束时间</dt><dd>{log?.endAt ?? "—"}</dd></div>
            <div><dt>行驶里程</dt><dd>{log?.mileage ?? "—"} km</dd></div>
            <div><dt>能耗</dt><dd>{log?.energy ?? "—"}</dd></div>
          </dl>
          <p className="fleet-detail-location">{log?.start} → {log?.end}</p>
          <FleetTripTrackMap points={segment?.points ?? []} />
        </section>
      </div>
    </section>
  );
}

// 充电位置：充电日志的地图弹层。
export function ChargingSpotPage({ vehicle, log, onBack }) {
  return (
    <section className="fleet-detail-page" aria-label="充电位置">
      <PageHeader title="充电位置" subtitle={vehicle.plate} onBack={onBack} />
      <div className="fleet-detail-body">
        <section className="fleet-detail-section">
          <dl className="fleet-detail-grid">
            <div><dt>充电开始</dt><dd>{log?.startAt ?? "—"}</dd></div>
            <div><dt>充电结束</dt><dd>{log?.endAt ?? "—"}</dd></div>
            <div><dt>充电时长</dt><dd>{log?.duration ?? "—"}</dd></div>
            <div><dt>充电量</dt><dd>{log?.electricity ?? "—"}</dd></div>
            <div><dt>开始 SOC</dt><dd>{log?.startSoc}%</dd></div>
            <div><dt>结束 SOC</dt><dd>{log?.endSoc}%</dd></div>
          </dl>
          <p className="fleet-detail-location">{log?.location}</p>
          {log && <FleetSpotMap lng={log.lng} lat={log.lat} label={log.location} tone="charge" />}
        </section>
      </div>
    </section>
  );
}
