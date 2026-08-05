import { getStore } from "@netlify/blobs";
import initialData from "../../data/app.json" with { type: "json" };
import stationSeed from "../../admin-server/station-seed.js";

const STORE_NAME = "tms-admin-data";
const STORE_KEY = "app.json";
const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const config = { path: "/api/*" };

function nowStr() {
  const date = new Date();
  const part = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())} ${part(date.getHours())}:${part(date.getMinutes())}:${part(date.getSeconds())}`;
}

function json(status, payload) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    throw new Error("请求体必须是有效 JSON");
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDataStore() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

async function readData() {
  const store = getDataStore();
  let data = await store.get(STORE_KEY, { type: "json", consistency: "strong" });
  if (data) return { store, data };

  const seed = clone(initialData);
  const result = await store.set(STORE_KEY, JSON.stringify(seed), { onlyIfNew: true });
  if (result.modified) return { store, data: seed };

  data = await store.get(STORE_KEY, { type: "json", consistency: "strong" });
  return { store, data: data || seed };
}

function writeData(store, data) {
  return store.set(STORE_KEY, JSON.stringify(data));
}

function findFence(data, code) {
  return (data.fences || []).find((item) => item.code === code);
}

function nextFenceCode(fences) {
  const max = (fences || []).reduce((current, fence) => {
    const match = /^F-(\d+)$/.exec(fence.code || "");
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `F-${String(max + 1).padStart(7, "0")}`;
}

function buildTripSummaries(data) {
  const originalByCode = Object.fromEntries((data.tripSummaries || []).map((row) => [row[0], row]));
  const metric = (value) => (typeof value === "number" ? value : "—");
  const taskCount = (value) => {
    const parsed = Number.parseInt(String(value || "").replace(/[^\d]/g, ""), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return (data.trips || []).map((trip) => {
    const original = originalByCode[trip.code] || [];
    const analysis = trip.timeAnalysis || {};
    return [
      trip.code,
      original[1] || trip.vehicle || "—",
      trip.driver || original[2] || "—",
      trip.startActual || trip.startPool || "—",
      trip.endActual || trip.endPool || "—",
      trip.status || original[5] || "p",
      trip.startTime || "—",
      trip.endTime || "—",
      trip.totalDuration || "—",
      metric(analysis.loading?.h),
      metric(analysis.unloading?.h),
      metric(analysis.driving?.h),
      metric(analysis.charging?.h),
      taskCount(trip.taskCount),
      trip.mileage || "—",
      trip.endType || "—",
    ];
  });
}

function districtFencesByTripRole(data, type) {
  const isStart = type === "开始片区";
  const fields = isStart ? ["startActual", "startPool"] : ["endActual", "endPool"];
  const expectedRole = isStart ? "发货区域" : "收货区域";
  const names = new Set();
  (data.trips || []).forEach((trip) => {
    fields.some((field) => {
      if (trip[field] && trip[field] !== "—") {
        names.add(trip[field]);
        return true;
      }
      return false;
    });
  });
  const fences = data.fences || [];
  const matched = fences.filter((fence) => names.has(fence.name) && String(fence.ioType || "").includes(expectedRole));
  return matched.length ? matched : fences.filter((fence) => String(fence.ioType || "").includes(expectedRole));
}

function seedDistricts(data) {
  const source = [
    { id: "D-YN-001", name: "云南趟次开始片区", type: "开始片区", owner: "李调度", note: "云南趟次起点装卸范围" },
    { id: "D-YN-003", name: "云南趟次结束片区", type: "结束片区", owner: "王磊", note: "云南趟次终点装卸范围" },
  ];
  data.districts = source.map((district) => {
    const fences = districtFencesByTripRole(data, district.type);
    return {
      ...district,
      fenceCodes: fences.map((fence) => fence.code),
      fenceNames: fences.map((fence) => fence.name),
      updated: nowStr(),
    };
  });
  return data.districts;
}

function ensureStations(data) {
  if (Array.isArray(data.stations)) return false;
  data.stations = clone(stationSeed);
  return true;
}

function deriveStation(station) {
  const enabledStatus = station.enabledStatus || (station.status === "正常" ? "启用" : "停用");
  const periods = Array.isArray(station.pricePeriods) ? station.pricePeriods : [];
  const price = periods.find((item) => String(item.price || "").trim());
  const stays = Array.isArray(station.stayDurations) ? station.stayDurations : [];
  const stay = stays.find((item) => String(item.durationMin || "").trim());
  return {
    ...station,
    enabledStatus,
    status: enabledStatus === "启用" ? "正常" : "停用",
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

function nextStationId(stations) {
  const max = stations.reduce((current, station) => Math.max(current, Number(String(station.id || "").replace(/\D/g, "")) || 0), 0);
  return `ST${String(max + 1).padStart(3, "0")}`;
}

function normalizedPath(pathname) {
  return pathname.startsWith("/.netlify/functions/api")
    ? `/api${pathname.slice("/.netlify/functions/api".length)}`
    : pathname;
}

async function handleStations({ pathname, method, request, data, store }) {
  const seeded = ensureStations(data);
  if (seeded) await writeData(store, data);
  const stations = data.stations;

  if (pathname === "/api/stations" && method === "GET") return json(200, stations);
  if (pathname === "/api/stations" && method === "POST") {
    const body = await readBody(request);
    const station = deriveStation({
      ...body,
      id: nextStationId(stations),
      code: body.code || `CS${String(236 + stations.length).padStart(6, "0")}`,
      editor: "张运营",
      updatedAt: nowStr(),
    });
    stations.unshift(station);
    await writeData(store, data);
    return json(201, station);
  }

  const match = /^\/api\/stations\/([^/]+)$/.exec(pathname);
  if (!match) return json(404, { error: "Not Found" });
  const id = decodeURIComponent(match[1]);
  const index = stations.findIndex((station) => station.id === id);
  if (index < 0) return json(404, { error: "站点不存在" });
  if (method === "PUT") {
    const body = await readBody(request);
    const station = deriveStation({ ...stations[index], ...body, id, editor: "张运营", updatedAt: nowStr() });
    stations[index] = station;
    await writeData(store, data);
    return json(200, station);
  }
  if (method === "DELETE") {
    const deleted = stations.splice(index, 1)[0];
    await writeData(store, data);
    return json(200, { ok: true, deleted: deleted.id });
  }
  return json(405, { error: "Method Not Allowed" });
}

export default async function handler(request) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: JSON_HEADERS });

  try {
    const url = new URL(request.url);
    const pathname = normalizedPath(url.pathname);
    const method = request.method;
    const { store, data } = await readData();

    if (pathname === "/api/health" && method === "GET") return json(200, { ok: true, time: nowStr(), storage: "netlify-blobs" });

    if (pathname === "/api/fences" && method === "GET") {
      let list = (data.fences || []).slice();
      const filters = [
        ["name", "name"], ["code", "code"], ["type", "type"], ["dept", "dept"], ["cat", "cat"],
        ["share", "share"], ["ioType", "ioType"], ["status", "enableStatus"], ["role", "role"],
      ];
      filters.forEach(([queryKey, field]) => {
        const value = url.searchParams.get(queryKey);
        if (value && value !== "全部") list = list.filter((fence) => String(fence[field] || "").includes(value));
      });
      return json(200, list);
    }

    if (pathname === "/api/fences" && method === "POST") {
      const body = await readBody(request);
      const code = (body.code && String(body.code).trim()) || nextFenceCode(data.fences);
      if (findFence(data, code)) return json(409, { error: `围栏编码已存在: ${code}` });
      const timestamp = nowStr();
      const fence = {
        name: "", code, type: "点", cat: "", ioType: "", dept: "云南钦圣新能源科技有限公司",
        share: "部门", role: "不参与趟次", radius: 500, lng: "", lat: "", location: "", prov: "", city: "", dist: "", remark: "",
        openStatus: "已开通", account: "李调度", modifier: "李调度", modifyTime: timestamp, enableStatus: "启用", settleBody: "",
        loadTime: 0, unloadTime: 0, emptyType: "", allowance: 0, highway: "", ...body,
        code, modifier: "李调度", modifyTime: timestamp,
      };
      data.fences = data.fences || [];
      data.fences.unshift(fence);
      await writeData(store, data);
      return json(201, fence);
    }

    const fenceMatch = /^\/api\/fences\/(.+)$/.exec(pathname);
    if (fenceMatch && ["GET", "PUT", "DELETE"].includes(method)) {
      const code = decodeURIComponent(fenceMatch[1]);
      const fence = findFence(data, code);
      if (!fence) return json(404, { error: "围栏不存在" });
      if (method === "GET") return json(200, fence);
      if (method === "PUT") {
        const body = await readBody(request);
        const updated = { ...fence, ...body, code: fence.code, modifier: "李调度", modifyTime: nowStr() };
        data.fences[data.fences.indexOf(fence)] = updated;
        await writeData(store, data);
        return json(200, updated);
      }
      data.fences = data.fences.filter((item) => item.code !== code);
      await writeData(store, data);
      return json(200, { ok: true, deleted: code });
    }

    if (pathname === "/api/trips" && method === "GET") return json(200, buildTripSummaries(data));
    const tripMatch = /^\/api\/trips\/(.+)$/.exec(pathname);
    if (tripMatch && method === "GET") {
      const trip = (data.trips || []).find((item) => item.code === decodeURIComponent(tripMatch[1]));
      return trip ? json(200, trip) : json(404, { error: "趟次不存在" });
    }
    if (pathname === "/api/trip-details" && method === "GET") return json(200, data.trips || []);

    if (pathname === "/api/fare-settings" && method === "GET") {
      const settings = data.fareSettings || { driverRate: 0.2 };
      if (typeof settings.driverRate !== "number") settings.driverRate = 0.2;
      return json(200, settings);
    }
    if (pathname === "/api/fare-settings" && method === "PUT") {
      const body = await readBody(request);
      const rate = Number(body.driverRate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 1) return json(400, { error: "driverRate 必须为 0~1 之间的小数" });
      data.fareSettings = { driverRate: rate };
      await writeData(store, data);
      return json(200, data.fareSettings);
    }

    if (pathname === "/api/districts" && method === "GET") {
      if (Array.isArray(data.districts) && data.districts.length) return json(200, data.districts);
      const districts = seedDistricts(data);
      await writeData(store, data);
      return json(200, districts);
    }
    if (pathname === "/api/districts" && method === "PUT") {
      const body = await readBody(request);
      if (!Array.isArray(body)) return json(400, { error: "districts 必须为数组" });
      data.districts = body;
      await writeData(store, data);
      return json(200, { ok: true });
    }

    if (pathname.startsWith("/api/stations")) return handleStations({ pathname, method, request, data, store });
    return json(404, { error: `Not Found: ${pathname}` });
  } catch (error) {
    return json(500, { error: String(error?.message || error) });
  }
}
