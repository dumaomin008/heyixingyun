import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { FleetTrackCanvas } from "../maps.jsx";
import { FLEET_TODAY, getTrackSegments } from "../data.js";
import { PageHeader } from "../components.jsx";

const RANGES = ["今天", "近 3 天", "近 7 天", "自定义"];
const SPEEDS = [1, 2, 4];

function toDate(value) {
  const parsed = new Date(value?.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toInputValue(value) {
  return value ? value.slice(0, 16).replace(" ", "T") : "";
}

function rangeDurationMinutes(startAt, endAt) {
  const start = toDate(startAt);
  const end = toDate(endAt);
  return start && end ? Math.max(0, Math.round((end - start) / 60000)) : 0;
}

function formatDuration(minutes) {
  const total = Math.max(0, Math.round(minutes));
  return `${Math.floor(total / 60)}h${total % 60}m`;
}

function formatDurationClock(minutes) {
  const total = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function shortTime(value) {
  return value?.slice(11, 16) ?? "--:--";
}

function shortLocation(value) {
  return value
    ?.replace(/玉溪市|玉溪|红塔区|红塔|高新区|峨山市?/g, "")
    .slice(-8) ?? "位置信息暂无";
}

export function TrackPlaybackPage({ vehicle, initialSelection, onBack }) {
  const segments = useMemo(() => getTrackSegments(vehicle.id), [vehicle.id]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(() => {
    try {
      const saved = Number(window.localStorage.getItem("fleet-track-playback-speed"));
      return SPEEDS.includes(saved) ? saved : 1;
    } catch {
      return 1;
    }
  });
  const [progress, setProgress] = useState(0);
  const [range, setRange] = useState("今天");
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [fitViewRequest, setFitViewRequest] = useState(0);
  const appliedInitialSelection = useRef("");

  const visibleSegments = useMemo(() => {
    if (range === "今天") return segments.filter((item) => item.date === FLEET_TODAY);

    if (range === "近 3 天" || range === "近 7 天") {
      const latest = Math.max(...segments.map((item) => toDate(item.endAt)?.getTime() ?? 0));
      const days = range === "近 3 天" ? 3 : 7;
      const cutoff = new Date(latest);
      cutoff.setHours(0, 0, 0, 0);
      cutoff.setDate(cutoff.getDate() - (days - 1));
      return segments.filter((item) => (toDate(item.endAt)?.getTime() ?? 0) >= cutoff.getTime());
    }

    const start = customStart ? new Date(customStart) : null;
    const end = customEnd ? new Date(customEnd) : null;
    return segments.filter((item) => {
      const segmentStart = toDate(item.startAt);
      const segmentEnd = toDate(item.endAt);
      if (!segmentStart || !segmentEnd) return false;
      return (!start || segmentEnd >= start) && (!end || segmentStart <= end);
    });
  }, [customEnd, customStart, range, segments]);

  const segment = visibleSegments.find((item) => item.id === selectedSegmentId) ?? visibleSegments[0];
  const totalMileage = Number(visibleSegments.reduce((total, item) => total + item.mileage, 0).toFixed(1));
  const totalDuration = visibleSegments.reduce((total, item) => total + rangeDurationMinutes(item.startAt, item.endAt), 0);

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

  useEffect(() => {
    try {
      window.localStorage.setItem("fleet-track-playback-speed", String(speed));
    } catch {
      // 无痕模式或小程序 WebView 不可写缓存时保持本次会话选择即可。
    }
  }, [speed]);

  useEffect(() => {
    // 从行车日志带入的精确时段优先于默认的全量自定义范围，
    // 避免首帧初始化把已锁定的单条行程重新扩展为所有行程。
    if (initialSelection?.logId || customStart || customEnd || !segments.length) return;
    const ordered = [...segments].sort((left, right) => left.startAt.localeCompare(right.startAt));
    setCustomStart(toInputValue(ordered[0].startAt));
    setCustomEnd(toInputValue(ordered[ordered.length - 1].endAt));
  }, [customEnd, customStart, initialSelection?.logId, segments]);

  useEffect(() => {
    if (!segment || selectedSegmentId === segment.id) return;
    setSelectedSegmentId(segment.id);
    setProgress(0);
    setPlaying(false);
  }, [segment, selectedSegmentId]);

  useEffect(() => {
    if (!initialSelection?.logId) return;
    const selectionKey = `${initialSelection.logId}-${initialSelection.customStart ?? ""}-${initialSelection.customEnd ?? ""}`;
    if (appliedInitialSelection.current === selectionKey) return;
    const target = segments.find((item) => item.logId === initialSelection.logId);
    if (!target) return;
    appliedInitialSelection.current = selectionKey;
    setRange("自定义");
    setCustomStart(toInputValue(initialSelection.customStart ?? target.startAt));
    setCustomEnd(toInputValue(initialSelection.customEnd ?? target.endAt));
    setSelectedSegmentId(target.id);
    setProgress(0);
    setPlaying(false);
    setFitViewRequest((value) => value + 1);
  }, [initialSelection, segments]);

  function resetPlayback() {
    setProgress(0);
    setPlaying(false);
  }

  function switchSegment(id) {
    setSelectedSegmentId(id);
    resetPlayback();
    setFitViewRequest((value) => value + 1);
  }

  function selectRange(nextRange) {
    setRange(nextRange);
    resetPlayback();
  }

  return (
    <section className={`fleet-track-page ${range === "自定义" ? "is-custom-range" : ""}`} aria-label={`${vehicle.plate}历史轨迹`}>
      <FleetTrackCanvas
        points={points}
        segments={visibleSegments}
        selectedSegmentId={segment?.id}
        progress={progress}
        fitViewRequest={fitViewRequest}
      />
      <div className="map-fade" />

      <PageHeader
        title="历史轨迹"
        onBack={onBack}
      />

      <section className="fleet-track-filter">
        {RANGES.map((item) => (
          <button key={item} type="button" className={range === item ? "active" : ""} onClick={() => selectRange(item)}>{item}</button>
        ))}
      </section>

      {range === "自定义" && (
        <section className="fleet-track-custom-range" aria-label="自定义时间范围">
          <label>开始<input type="datetime-local" value={customStart} onChange={(event) => { setCustomStart(event.target.value); resetPlayback(); }} /></label>
          <span>至</span>
          <label>结束<input type="datetime-local" value={customEnd} onChange={(event) => { setCustomEnd(event.target.value); resetPlayback(); }} /></label>
        </section>
      )}

      <section className="fleet-track-summary" aria-label="当前时间范围运营汇总">
        共 {visibleSegments.length} 段行程 · 总里程 {totalMileage}km · 总行驶时长 {formatDuration(totalDuration)}
      </section>

      <section className="fleet-track-panel">
        <section className="fleet-track-trip-section" aria-label={`行程时段，共 ${visibleSegments.length} 段`}>
          {visibleSegments.length > 3 && <p className="fleet-track-trip-scroll-hint"><b>共 {visibleSegments.length} 段行程</b><span>左右滑动查看</span></p>}
          <div className="fleet-track-trip-carousel">
            {visibleSegments.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === segment?.id ? "active" : ""}
                aria-pressed={item.id === segment?.id}
                onClick={() => switchSegment(item.id)}
              >
                <span className="fleet-track-trip-card-head">{shortTime(item.startAt)} - {shortTime(item.endAt)}</span>
                <span className="fleet-track-trip-card-metrics">{item.mileage}km · SOC消耗{item.energy}</span>
                <span className="fleet-track-trip-card-location">{shortLocation(item.start)} → {shortLocation(item.end)}</span>
              </button>
            ))}
            {!visibleSegments.length && <span className="fleet-track-trip-empty">当前时间范围暂无行程</span>}
          </div>
        </section>
        <div className="fleet-track-meta">
          <span>{segment?.date} {segment?.label}</span>
          <b>{segment ? `${segment.mileage} km` : "—"}</b>
        </div>
        <p className="fleet-track-route-address">
          <span>起点：{segment?.start ?? "—"}</span><i aria-hidden="true">|</i><span>终点：{segment?.end ?? "—"}</span>
        </p>
        <input
          className="fleet-track-range"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={progress}
          disabled={!points.length}
          aria-label="轨迹播放进度"
          onChange={(event) => { setProgress(Number(event.target.value)); setPlaying(false); }}
        />
        <div className="fleet-track-time">
          <span>当前时间 {currentPoint?.time ?? "--:--"}</span>
          <span>总时长 {segment ? formatDurationClock(rangeDurationMinutes(segment.startAt, segment.endAt)) : "--:--"}</span>
        </div>
        <div className="fleet-track-controls">
          <button type="button" onClick={resetPlayback} aria-label="重置" disabled={!points.length}><RotateCcw aria-hidden="true" />重置</button>
          <button type="button" className="fleet-track-play" disabled={!points.length} onClick={() => setPlaying((value) => !value)}>
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            {playing ? "暂停" : progress >= 1 ? "重新播放" : progress > 0 ? "继续" : "开始回放"}
          </button>
          <select value={speed} aria-label="轨迹播放倍速" onChange={(event) => setSpeed(Number(event.target.value))}>
            {SPEEDS.map((item) => <option key={item} value={item}>{item}x</option>)}
          </select>
        </div>

      </section>
    </section>
  );
}
