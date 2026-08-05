import { getVehiclePrimaryStatus, getVehicleSecondaryStatus } from "./vehicle-status.js";

export const ALERT_TYPES = ["SOC 过低", "离线超时", "车辆故障"];

const SAFETY_ALERT_META = {
  "SOC 过低": { tone: "soc", priority: 3 },
  "行驶中停留": { tone: "driving-dwell", priority: 2 },
  "围栏内停留": { tone: "fence-dwell", priority: 1 },
};

const ALERT_META = {
  "SOC 过低": { label: "SOC 过低", tone: "soc", priority: 1 },
  "离线超时": { label: "离线超时", tone: "timeout", priority: 2 },
  "车辆故障": { label: "故障报警", tone: "fault", priority: 3 },
};

export function alertTone(alert) {
  return ALERT_META[alert]?.tone ?? "soc";
}

export function alertLabel(alert) {
  return ALERT_META[alert]?.label ?? alert;
}

export function alertPriority(alert) {
  return ALERT_META[alert]?.priority ?? 0;
}

export function sortAlerts(vehicles) {
  return [...vehicles].sort((left, right) => {
    const urgencyDifference = Number(alertCoreInfo(right).level === "紧急") - Number(alertCoreInfo(left).level === "紧急");
    const priorityDifference = alertPriority(right.alert) - alertPriority(left.alert);
    return urgencyDifference || priorityDifference || String(left.alertStartAt ?? "").localeCompare(String(right.alertStartAt ?? "")) || left.plate.localeCompare(right.plate);
  });
}

export function alertDescription(vehicle) {
  if (vehicle.alert === "SOC 过低") return `当前 SOC ${vehicle.soc}% / 阈值 ${vehicle.socThreshold}% · ${vehicle.location}`;
  if (vehicle.alert === "离线超时") return `已连续离线 ${vehicle.offlineDuration} · 最后上报 ${vehicle.updatedAt}`;
  if (vehicle.alert === "车辆故障") return `检测到故障码 ${vehicle.faultCode ?? "—"} · ${vehicle.location}`;
  return "暂无预警详情";
}

function alertDuration(alertStartAt) {
  const startedAt = Date.parse(String(alertStartAt ?? "").replace(" ", "T"));
  if (!Number.isFinite(startedAt)) return "已持续 —";
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - startedAt) / 60000));
  const days = Math.floor(elapsedMinutes / 1440);
  const hours = Math.floor((elapsedMinutes % 1440) / 60);
  if (days) return `已持续 ${days}d${hours ? ` ${hours}h` : ""}`;
  if (hours) return `已持续 ${hours}h`;
  return `已持续 ${Math.max(1, elapsedMinutes)}min`;
}

function durationFromMinutes(minutes) {
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(safeMinutes / 60);
  const rest = safeMinutes % 60;
  return hours ? `${hours}h${rest ? `${rest}min` : ""}` : `${Math.max(1, rest)}min`;
}

// 监控地图采用“告警事件”而非“告警车辆”统计，同一车辆的低电量和停留
// 可同时存在，安全员才不会因为一个问题覆盖另一个问题而漏处置。
export function getMapSafetyAlerts(vehicles) {
  const alerts = [];
  vehicles.forEach((vehicle) => {
    if (vehicle.alert === "SOC 过低") {
      const level = vehicle.soc <= 15 ? "紧急" : "一般";
      alerts.push({
        id: `soc-${vehicle.id}`,
        type: "SOC 过低",
        level,
        vehicle,
        startedAt: vehicle.alertStartAt,
        duration: alertDuration(vehicle.alertStartAt),
        description: `当前 SOC ${vehicle.soc}% / 阈值 ${vehicle.socThreshold}% · ${vehicle.location}`,
      });
    }

    if (vehicle.dwellAlert) {
      const detail = vehicle.dwellAlert;
      const threshold = durationFromMinutes(detail.thresholdMinutes);
      const duration = durationFromMinutes(detail.durationMinutes);
      const place = detail.type === "围栏内停留" ? `${detail.fenceName}（${detail.taskStage}）` : detail.taskStage;
      alerts.push({
        id: `dwell-${vehicle.id}-${detail.type}`,
        type: detail.type,
        level: detail.level,
        vehicle,
        startedAt: detail.startAt,
        duration: `已持续 ${duration}`,
        description: `${place}停留 ${duration} / 阈值 ${threshold} · ${vehicle.location}`,
      });
    }
  });

  return alerts.sort((left, right) => (
    Number(right.level === "紧急") - Number(left.level === "紧急")
    || SAFETY_ALERT_META[right.type].priority - SAFETY_ALERT_META[left.type].priority
    || String(left.startedAt).localeCompare(String(right.startedAt))
  ));
}

export function mapSafetyAlertTone(alert) {
  return SAFETY_ALERT_META[alert.type]?.tone ?? "soc";
}

export function alertCoreInfo(vehicle) {
  const level = vehicle.alert === "车辆故障" || (vehicle.alert === "SOC 过低" && vehicle.soc <= 15) || (vehicle.alert === "离线超时" && vehicle.offlineDurationHours >= 48)
    ? "紧急"
    : "一般";
  const vehicleStatus = getVehicleSecondaryStatus(vehicle) ?? getVehiclePrimaryStatus(vehicle);
  return { level, duration: alertDuration(vehicle.alertStartAt), vehicleStatus };
}
