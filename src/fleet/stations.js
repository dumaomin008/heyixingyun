export function stationPriceLabel(station) {
  const text = String(station.priceText || "").trim();
  if (text) return text.replace(/\s+/g, "");
  const price = String(station.price || "").trim();
  return price ? `${price}元/度` : "暂无价格";
}

export function stationDistance(station) {
  const drivingKm = Number(station.drivingKm);
  if (station.drivingKm != null && station.drivingKm !== "" && Number.isFinite(drivingKm) && drivingKm >= 0) {
    return { type: "driving", value: drivingKm, text: `${drivingKm}km` };
  }
  const straightKm = Number(station.straightKm);
  if (Number.isFinite(straightKm) && straightKm >= 0) {
    return { type: "straight", value: straightKm, text: `约${straightKm}km` };
  }
  return { type: "none", value: Infinity, text: "定位后可查看" };
}

// 与司机端一致：只展示状态正常且有有效坐标的场站，并按距离排序。
export function getFleetStations(stations) {
  return stations
    .filter((station) => station.status === "正常" && Number.isFinite(Number(station.lng)) && Number.isFinite(Number(station.lat)))
    .map((station) => ({
      ...station,
      lng: Number(station.lng),
      lat: Number(station.lat),
      priceText: stationPriceLabel(station),
      distance: stationDistance(station),
    }))
    .sort((left, right) => left.distance.value - right.distance.value);
}
