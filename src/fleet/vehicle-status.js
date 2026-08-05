// 联网状态与运行状态分层：二级状态只对在线车辆生效。
export function getVehiclePrimaryStatus(vehicle) {
  return vehicle.onlineStatus === "在线" || vehicle.onlineStatus === "离线"
    ? vehicle.onlineStatus
    : "从未上线";
}

export function getVehicleSecondaryStatus(vehicle) {
  if (getVehiclePrimaryStatus(vehicle) !== "在线") return null;
  if (vehicle.chargingStatus === "充电中") return "充电中";
  if (vehicle.drivingStatus === "行驶中" || Number(vehicle.speed) > 0) return "行驶中";
  return "驻车静止";
}

export function vehiclePrimaryTone(status) {
  return status === "在线" ? "online" : status === "离线" ? "offline" : "never";
}

export function vehicleSecondaryTone(status) {
  return status === "充电中" ? "charging" : status === "行驶中" ? "driving" : "parked";
}
