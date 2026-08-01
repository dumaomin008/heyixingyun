import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { FleetTrackCanvas } from "../maps.jsx";
import { getTrackSegments } from "../data.js";

const RANGES = ["今天", "近 3 天", "近 7 天"];
const SPEEDS = [1, 2, 4, 10];
const LINK_TABS = ["整车数据", "驱动电机", "定位数据", "报警数据", "极值数据"];

// 回放联动面板：按当前播放点取值，对应 TSP 车辆轨迹页底部数据区。
function linkedRows(tab, point) {
  if (!point) return [];
  switch (tab) {
    case "整车数据":
      return [["车速", `${point.speed} km/h`], ["SOC", `${point.soc}%`], ["总电压", `${point.voltage} V`], ["总电流", `${point.current} A`]];
    case "驱动电机":
      return [["电机转速", `${point.motorSpeed} rpm`], ["电机温度", `${point.motorTemp} °C`], ["电机状态", point.speed > 0 ? "驱动" : "待机"], ["控制器温度", `${Math.round(point.motorTemp * 0.86)} °C`]];
    case "定位数据":
      return [["经度", point.lng.toFixed(6)], ["纬度", point.lat.toFixed(6)], ["时间", point.time], ["定位状态", "有效定位"]];
    case "报警数据":
      return [["当前报警", point.alarm], ["报警等级", point.alarm === "无" ? "正常" : "二级"], ["故障码", "无"], ["通讯状态", "正常"]];
    default:
      return [["最高单体电压", "3.71 V"], ["最低单体电压", "3.68 V"], ["最高温度", `${point.motorTemp - 12} °C`], ["最低温度", `${point.motorTemp - 20} °C`]];
  }
}

export function TrackPlaybackPage({ vehicle, onBack }) {
  const segments = useMemo(() => getTrackSegments(vehicle.id), [vehicle.id]);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [range, setRange] = useState("今天");
  const [linkTab, setLinkTab] = useState(LINK_TABS[0]);
  const [panelOpen, setPanelOpen] = useState(true);

  const segment = segments[segmentIndex] ?? segments[0];
  const points = segment?.points ?? [];
  const pointIndex = points.length ? Math.min(points.length - 1, Math.round(progress * (points.length - 1))) : 0;
  const currentPoint = points[pointIndex];

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => {
      setProgress((current) => {
        const next = current + 0.03 * speed;
        if (next >= 1) {
          setPlaying(false);
          return 1;
        }
        return next;
      });
    }, 420);
    return () => window.clearInterval(timer);
  }, [playing, speed]);

  function resetPlayback() {
    setProgress(0);
    setPlaying(false);
  }

  function switchSegment(index) {
    setSegmentIndex(index);
    resetPlayback();
  }

  return (
    <section className="fleet-track-page" aria-label={`${vehicle.plate}历史轨迹`}>
      <FleetTrackCanvas points={points} progress={progress} />
      <div className="map-fade" />

      <header className="fleet-track-header">
        <button type="button" className="page-back" aria-label="返回车辆详情" onClick={onBack}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div><span>{vehicle.plate}</span><h1>历史轨迹</h1></div>
      </header>

      <section className="fleet-track-filter">
        {RANGES.map((item) => (
          <button key={item} type="button" className={range === item ? "active" : ""} onClick={() => { setRange(item); resetPlayback(); }}>{item}</button>
        ))}
      </section>

      {/* 有效行驶时段分段列表 */}
      <section className="fleet-track-segments" aria-label="有效行驶时段">
        <span className="fleet-track-segment-count">共 {segments.length} 个时段</span>
        <div>
          {segments.map((item, index) => (
            <button key={item.id} type="button" className={index === segmentIndex ? "active" : ""} onClick={() => switchSegment(index)}>
              <b>{item.label}</b><span>{item.mileage} km</span>
            </button>
          ))}
        </div>
      </section>

      <section className="fleet-track-panel">
        <div className="fleet-track-meta">
          <span>{segment?.date} {segment?.label}</span>
          <b>{segment?.mileage} km</b>
        </div>
        <input
          className="fleet-track-range"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={progress}
          aria-label="轨迹播放进度"
          onChange={(event) => { setProgress(Number(event.target.value)); setPlaying(false); }}
        />
        <div className="fleet-track-time">
          <span>当前 {currentPoint?.time ?? "--:--"}</span>
          <span>{segment?.duration}</span>
        </div>
        <div className="fleet-track-controls">
          <button type="button" onClick={resetPlayback} aria-label="重置"><RotateCcw aria-hidden="true" />重置</button>
          <button type="button" className="fleet-track-play" onClick={() => setPlaying((value) => !value)}>
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            {playing ? "暂停" : progress >= 1 ? "重新播放" : progress > 0 ? "继续" : "开始回放"}
          </button>
          <select value={speed} aria-label="轨迹播放倍速" onChange={(event) => setSpeed(Number(event.target.value))}>
            {SPEEDS.map((item) => <option key={item} value={item}>{item}x</option>)}
          </select>
        </div>

        <button type="button" className="fleet-track-panel-toggle" onClick={() => setPanelOpen((value) => !value)}>
          {panelOpen ? "收起联动数据" : "展开联动数据"}
        </button>

        {panelOpen && (
          <div className="fleet-track-linked">
            <nav aria-label="联动数据分类">
              {LINK_TABS.map((item) => (
                <button key={item} type="button" className={linkTab === item ? "active" : ""} onClick={() => setLinkTab(item)}>{item}</button>
              ))}
            </nav>
            <dl>
              {linkedRows(linkTab, currentPoint).map(([label, value]) => (
                <div key={label} className={label === "当前报警" && value !== "无" ? "alarm" : undefined}>
                  <dt>{label}</dt><dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>
    </section>
  );
}
