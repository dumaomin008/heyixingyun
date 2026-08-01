export const ALERT_TYPES = ["SOC 过低", "离线超时", "车辆故障"];

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

export function alertCoreInfo(vehicle) {
  const level = vehicle.alert === "车辆故障" || (vehicle.alert === "SOC 过低" && vehicle.soc <= 15) || (vehicle.alert === "离线超时" && vehicle.offlineDurationHours >= 48)
    ? "紧急"
    : "一般";
  const vehicleStatus = vehicle.chargingStatus === "充电中"
    ? "充电中"
    : vehicle.drivingStatus === "行驶中"
      ? "行驶中"
      : "静止";
  return { level, duration: alertDuration(vehicle.alertStartAt), vehicleStatus };
}
