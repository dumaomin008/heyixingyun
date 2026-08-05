import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader, RangeTabs, EmptyState } from "../components.jsx";
import { FleetSpotMap, FleetTripTrackMap } from "../maps.jsx";
import { FLEET_TODAY, fleetChargingLogs, fleetDrivingLogs, getTrackSegments } from "../data.js";

const DRIVING_RANGES = ["今日", "近 7 天", "近 30 天"];

function dateOffset(date, offset) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + offset);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function DrivingLogPage({ vehicle, vehicles = [vehicle], onBack, onOpenTrip, todayOnly = false }) {
  const [range, setRange] = useState(DRIVING_RANGES[1]);
  const [customStart, setCustomStart] = useState(dateOffset(FLEET_TODAY, -6));
  const [customEnd, setCustomEnd] = useState(FLEET_TODAY);
  const [keyword, setKeyword] = useState("");
  const vehicleById = useMemo(() => new Map(vehicles.map((item) => [item.id, item])), [vehicles]);
  const normalizedKeyword = keyword.trim().toLowerCase();
  const vehicleId = todayOnly ? "all" : vehicle.id;
  const rangeLabel = range === "custom" ? "自定义" : range;
  const matchesRange = (log) => {
    const day = log.startAt.slice(0, 10);
    if (range === "今日") return day === FLEET_TODAY;
    if (range === "近 7 天") return day >= dateOffset(FLEET_TODAY, -6) && day <= FLEET_TODAY;
    if (range === "近 30 天") return day >= dateOffset(FLEET_TODAY, -29) && day <= FLEET_TODAY;
    return day >= customStart && day <= customEnd;
  };
  const todaySummary = useMemo(() => {
    const vehicleIds = new Set(vehicles.map((item) => item.id));
    const todayLogs = fleetDrivingLogs.filter((log) => vehicleIds.has(log.vehicleId) && log.startAt.startsWith(FLEET_TODAY) && log.mileage > 0);
    return {
      mileage: Number(todayLogs.reduce((total, log) => total + log.mileage, 0).toFixed(1)),
      trips: todayLogs.length,
      vehicles: new Set(todayLogs.map((log) => log.vehicleId)).size,
    };
  }, [vehicles]);
  const logs = fleetDrivingLogs
    .filter((log) => {
      const target = vehicleById.get(log.vehicleId);
      // 今日汇总仅展示当前组织范围内能匹配到车辆档案的日志，
      // 避免跨范围日志因缺少车辆信息而出现无车牌卡片。
      const matchesVehicle = todayOnly ? Boolean(target) : log.vehicleId === vehicleId;
      const matchesKeyword = !normalizedKeyword || `${target?.plate ?? ""}${target?.vin ?? ""}`.toLowerCase().includes(normalizedKeyword);
      return matchesVehicle && matchesKeyword && (todayOnly ? log.startAt.startsWith(FLEET_TODAY) : matchesRange(log));
    })
    .sort((left, right) => right.endAt.localeCompare(left.endAt));

  return (
    <section className="fleet-detail-page fleet-driving-log-page" aria-label="行车日志">
      <PageHeader title={todayOnly ? "今日行车日志" : "行车日志"} onBack={onBack} />
      <div className="fleet-detail-body fleet-log-body">
        {todayOnly ? (
          <><section className="fleet-today-driving-summary" aria-label="今日行车汇总"><span>总里程 <b>{todaySummary.mileage.toLocaleString()}<small>km</small></b></span><i aria-hidden="true">·</i><span>共 <b>{todaySummary.trips}</b> 次行程</span><i aria-hidden="true">·</i><span>涉及 <b>{todaySummary.vehicles}</b> 辆车</span></section><label className="fleet-list-search"><Search aria-hidden="true" /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索车牌 / VIN" /></label></>
        ) : <>
          <section className="fleet-log-custom-range" aria-label="自定义时间筛选">
            <span>自定义时间</span>
            <label><input type="date" value={customStart} max={customEnd} onInput={(event) => { setCustomStart(event.currentTarget.value); setRange("custom"); }} onChange={(event) => { setCustomStart(event.target.value); setRange("custom"); }} /></label>
            <i>至</i>
            <label><input type="date" value={customEnd} min={customStart} max={FLEET_TODAY} onInput={(event) => { setCustomEnd(event.currentTarget.value); setRange("custom"); }} onChange={(event) => { setCustomEnd(event.target.value); setRange("custom"); }} /></label>
          </section>
          <RangeTabs options={DRIVING_RANGES} value={range} onChange={setRange} />
          <p className="fleet-log-count">{rangeLabel} · 共 {logs.length} 条记录</p>
        </>}
        {logs.length ? logs.map((log) => (
          <section key={log.id} className={`fleet-log-card ${todayOnly ? "fleet-today-driving-card" : ""}`}>
            <div className="fleet-log-card-title"><b>{todayOnly ? vehicleById.get(log.vehicleId)?.plate ?? "—" : `开始 ${log.startAt}`}</b><span>{log.mileage} km</span></div>
            <p>{log.start} → {log.end}</p>
            <div className="fleet-log-card-footer">
              {todayOnly ? <small className="fleet-driving-time-range"><span>开始 {log.startAt}</span><span>结束 {log.endAt}</span><span>SOC消耗 {log.energy}</span></small> : <small>结束 {log.endAt} · SOC消耗 {log.energy}</small>}
              <button type="button" onClick={() => onOpenTrip(vehicleById.get(log.vehicleId) ?? vehicle, log)}>查看轨迹</button>
            </div>
          </section>
        )) : <EmptyState title={todayOnly ? "今日暂无车辆行驶数据" : "暂无行车记录"} hint={todayOnly ? "当前筛选条件下没有有效行程" : "该车在所选时间范围内没有行程"} />}
      </div>
    </section>
  );
}

export function ChargingLogPage({ vehicle, vehicles = [vehicle], onBack, onOpenSpot, todayOnly = false }) {
  const [range, setRange] = useState(DRIVING_RANGES[1]);
  const [customStart, setCustomStart] = useState(dateOffset(FLEET_TODAY, -6));
  const [customEnd, setCustomEnd] = useState(FLEET_TODAY);
  const [keyword, setKeyword] = useState("");
  const vehicleByVin = useMemo(() => new Map(vehicles.map((item) => [item.vin, item])), [vehicles]);
  const normalizedKeyword = keyword.trim().toLowerCase();
  const rangeLabel = range === "custom" ? "自定义" : range;
  const matchesRange = (log) => {
    const day = log.startAt.slice(0, 10);
    if (range === "今日") return day === FLEET_TODAY;
    if (range === "近 7 天") return day >= dateOffset(FLEET_TODAY, -6) && day <= FLEET_TODAY;
    if (range === "近 30 天") return day >= dateOffset(FLEET_TODAY, -29) && day <= FLEET_TODAY;
    return day >= customStart && day <= customEnd;
  };
  const logs = fleetChargingLogs
    .filter((log) => {
      const target = vehicleByVin.get(log.vin);
      const matchesVehicle = todayOnly ? Boolean(target) : log.vehicleId === vehicle.id;
      const matchesKeyword = !normalizedKeyword || `${target?.plate ?? ""}${target?.vin ?? ""}`.toLowerCase().includes(normalizedKeyword);
      return matchesVehicle && matchesKeyword && (todayOnly ? log.startAt.startsWith(FLEET_TODAY) : matchesRange(log));
    })
    .sort((left, right) => right.endAt.localeCompare(left.endAt));
  const todaySummary = useMemo(() => {
    const vehicleIds = new Set(vehicles.map((item) => item.id));
    const todayLogs = fleetChargingLogs.filter((log) => vehicleIds.has(log.vehicleId) && log.startAt.startsWith(FLEET_TODAY));
    return {
      electricity: Number(todayLogs.reduce((total, log) => total + Number.parseFloat(log.electricity), 0).toFixed(1)),
      sessions: todayLogs.length,
      vehicles: new Set(todayLogs.map((log) => log.vehicleId)).size,
    };
  }, [vehicles]);

  function openChargingLocation(log) {
    const target = vehicleByVin.get(log.vin) ?? vehicle;
    onOpenSpot(target, log);
  }

  function handleCardKeyDown(event, log) {
    if (!todayOnly || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    openChargingLocation(log);
  }

  return (
    <section className="fleet-detail-page fleet-charging-log-page" aria-label="充电日志">
      <PageHeader title={todayOnly ? "今日充电日志" : "充电日志"} onBack={onBack} />
      <div className="fleet-detail-body fleet-log-body">
        {todayOnly ? (
          <><section className="fleet-today-driving-summary" aria-label="今日充电汇总"><span>总充电量 <b>{todaySummary.electricity.toLocaleString()}<small>kWh</small></b></span><i aria-hidden="true">·</i><span>共 <b>{todaySummary.sessions}</b> 次充电</span><i aria-hidden="true">·</i><span>涉及 <b>{todaySummary.vehicles}</b> 辆车</span></section><label className="fleet-list-search"><Search aria-hidden="true" /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索车牌 / VIN" /></label></>
        ) : <>
          <section className="fleet-log-custom-range" aria-label="自定义时间筛选">
            <span>自定义时间</span>
            <label><input type="date" value={customStart} max={customEnd} onInput={(event) => { setCustomStart(event.currentTarget.value); setRange("custom"); }} onChange={(event) => { setCustomStart(event.target.value); setRange("custom"); }} /></label>
            <i>至</i>
            <label><input type="date" value={customEnd} min={customStart} max={FLEET_TODAY} onInput={(event) => { setCustomEnd(event.currentTarget.value); setRange("custom"); }} onChange={(event) => { setCustomEnd(event.target.value); setRange("custom"); }} /></label>
          </section>
          <RangeTabs options={DRIVING_RANGES} value={range} onChange={setRange} />
          <p className="fleet-log-count">{rangeLabel} · 共 {logs.length} 条记录</p>
        </>}
        {logs.length ? logs.map((log) => (
          <section
            key={log.id}
            className={`fleet-log-card ${todayOnly ? "fleet-today-driving-card fleet-today-charging-card" : ""}`}
            role={todayOnly ? "button" : undefined}
            tabIndex={todayOnly ? 0 : undefined}
            aria-label={todayOnly ? `${vehicleByVin.get(log.vin)?.plate}，充电量 ${log.electricity}，查看充电位置` : undefined}
            onClick={todayOnly ? () => openChargingLocation(log) : undefined}
            onKeyDown={(event) => handleCardKeyDown(event, log)}
          >
            <div className="fleet-log-card-title"><b>{todayOnly ? vehicleByVin.get(log.vin)?.plate : `开始 ${log.startAt}`}</b><span>{log.electricity}</span></div>
            <p>{log.location || "位置信息暂无"}</p>
            {!todayOnly && <div className="fleet-charging-metrics">
              <span>SOC {log.startSoc}%</span><i>→</i><span>SOC {log.endSoc}%</span>
            </div>}
            <div className="fleet-log-card-footer">
              {todayOnly ? <small className="fleet-charging-time-range"><span>开始 {log.startAt}</span><span>结束 {log.endAt}</span><span>SOC {log.startSoc}% → {log.endSoc}% · 充电时长 {log.duration.replace(/\s+/g, "")}</span></small> : <small>结束 {log.endAt} · 充电时长 {log.duration}</small>}
              {todayOnly && <button type="button" onClick={(event) => { event.stopPropagation(); openChargingLocation(log); }}>位置查看</button>}
            </div>
          </section>
        )) : <EmptyState title={todayOnly ? "今日暂无车辆充电数据" : "暂无充电记录"} hint={todayOnly ? "当前筛选条件下没有充电记录" : "该车在所选时间范围内没有充电"} />}
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
            <div><dt>SOC消耗</dt><dd>{log?.energy ?? "—"}</dd></div>
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
          <p className="fleet-detail-location">{log?.location || "位置信息暂无"}</p>
          {log && <FleetSpotMap lng={log.lng} lat={log.lat} label={log.location || "位置信息暂无"} tone="charge" />}
        </section>
      </div>
    </section>
  );
}
