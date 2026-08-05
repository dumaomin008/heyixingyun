const stationSeed = require("./station-seed");

function cloneSeed() {
  return JSON.parse(JSON.stringify(stationSeed));
}

function ensureStations(data) {
  if (!Array.isArray(data.stations)) {
    data.stations = cloneSeed();
    return true;
  }
  return false;
}

function deriveStation(station) {
  const enabledStatus = station.enabledStatus || (station.status === "正常" ? "启用" : "停用");
  const status = enabledStatus === "启用" ? "正常" : "停用";
  const periods = Array.isArray(station.pricePeriods) ? station.pricePeriods : [];
  const price = periods.find((item) => String(item.price || "").trim());
  const stays = Array.isArray(station.stayDurations) ? station.stayDurations : [];
  const stay = stays.find((item) => String(item.durationMin || "").trim());
  return {
    ...station,
    enabledStatus,
    status,
    openStatus: enabledStatus === "启用" ? "已开通" : "未开通",
    accountStatus: enabledStatus === "启用" ? (station.accountStatus === "已停用" ? "已登录" : (station.accountStatus || "已登录")) : "已停用",
    pileCount: Number(station.totalPiles || station.pileCount || 0),
    totalPiles: Number(station.totalPiles || station.pileCount || 0),
    availablePiles: Number(station.availablePiles || 0),
    lng: Number(station.lng),
    lat: Number(station.lat),
    radius: Number(station.radius || 0),
    priceText: price ? `${price.price} 元/度` : "暂无价格",
    stayDurationText: stay ? `${stay.durationMin} 分钟` : "—",
  };
}

function nextId(stations) {
  const max = stations.reduce((current, item) => Math.max(current, Number(String(item.id || "").replace(/\D/g, "")) || 0), 0);
  return `ST${String(max + 1).padStart(3, "0")}`;
}

async function handle({ pathname, method, res, db, sendJson, readBody, nowStr }) {
  if (!pathname.startsWith("/api/stations")) return false;
  const data = db.readAll();
  const seeded = ensureStations(data);
  if (seeded) db.writeAll(data);
  const stations = data.stations;

  if (pathname === "/api/stations" && method === "GET") return sendJson(res, 200, stations);
  if (pathname === "/api/stations" && method === "POST") {
    const body = await readBody();
    const station = deriveStation({
      ...body,
      id: nextId(stations),
      code: body.code || `CS${String(236 + stations.length).padStart(6, "0")}`,
      editor: "张运营",
      updatedAt: nowStr(),
    });
    stations.unshift(station);
    db.writeAll(data);
    return sendJson(res, 201, station);
  }

  const match = /^\/api\/stations\/([^/]+)$/.exec(pathname);
  if (!match) return sendJson(res, 404, { error: "Not Found" });
  const id = decodeURIComponent(match[1]);
  const index = stations.findIndex((station) => station.id === id);
  if (index < 0) return sendJson(res, 404, { error: "站点不存在" });
  if (method === "PUT") {
    const body = await readBody();
    const station = deriveStation({ ...stations[index], ...body, id, editor: "张运营", updatedAt: nowStr() });
    stations[index] = station;
    db.writeAll(data);
    return sendJson(res, 200, station);
  }
  if (method === "DELETE") {
    const deleted = stations.splice(index, 1)[0];
    db.writeAll(data);
    return sendJson(res, 200, { ok: true, deleted: deleted.id });
  }
  return sendJson(res, 405, { error: "Method Not Allowed" });
}

module.exports = { handle };
