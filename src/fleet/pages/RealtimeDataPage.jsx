import { useState } from "react";
import { PageHeader, DataGrid } from "../components.jsx";
import { buildRealtimeGroups } from "../data.js";

// 对应 TSP 单车监控的 7 类数据标签。
export function RealtimeDataPage({ vehicle, onBack }) {
  const groups = buildRealtimeGroups(vehicle);
  const tabs = Object.keys(groups);
  const [tab, setTab] = useState(tabs[0]);
  const [paused, setPaused] = useState(false);

  return (
    <section className="fleet-detail-page" aria-label="单车实时数据">
      <PageHeader
        title="实时数据"
        subtitle={vehicle.plate}
        onBack={onBack}
        action={(
          <button type="button" className={`fleet-header-text-action ${paused ? "active" : ""}`} onClick={() => setPaused((value) => !value)}>
            {paused ? "已停止" : "刷新中"}
          </button>
        )}
      />
      <div className="fleet-detail-body fleet-realtime-body">
        <section className="fleet-realtime-vehicle">
          <b>{vehicle.plate}</b>
          <span>{vehicle.model} · {paused ? "已停止刷新" : "30 秒自动刷新"} · 更新于 {vehicle.updatedAt}</span>
        </section>

        {/* 关键指标先给可视化，再给完整字段表 */}
        <section className="fleet-gauge-row" aria-label="关键指标">
          <div>
            <span>SOC</span>
            <div className="fleet-gauge-track"><i style={{ width: `${vehicle.soc ?? 0}%` }} className={vehicle.soc !== null && vehicle.soc <= vehicle.socThreshold ? "low" : ""} /></div>
            <b>{vehicle.soc === null ? "—" : `${vehicle.soc}%`}</b>
          </div>
          <div>
            <span>车速</span>
            <div className="fleet-gauge-track"><i style={{ width: `${Math.min(100, (vehicle.speed / 90) * 100)}%` }} className="speed" /></div>
            <b>{vehicle.speed} km/h</b>
          </div>
        </section>

        <nav className="fleet-realtime-tabs scrollable" aria-label="实时数据分类">
          {tabs.map((item) => (
            <button key={item} type="button" className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>
          ))}
        </nav>

        <DataGrid
          rows={groups[tab]}
          highlightKey={(label, value) => tab === "报警数据" && label === "当前报警" && value !== "无"}
        />
      </div>
    </section>
  );
}
