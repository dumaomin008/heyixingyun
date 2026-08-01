// ============================================================
// 车队长小程序 - 演示数据集
// 依据《TSP平台功能梳理分析文档》与《小程序车辆监控功能需求文档》构建。
// 车辆状态覆盖 在线 / 离线 / 从未上线 三态，便于验证筛选、分页与预警口径。
// ============================================================

export const SOC_THRESHOLDS = [15, 30];

export const FLEET_PROFILE = {
  name: "李建国",
  role: "车队长",
  org: "云南钦圣新能源科技有限公司",
  team: "玉溪运营车队",
};

const MODELS = ["创维重卡 430", "创维牵引车 410", "创维载货车 380", "创维自卸车 460"];
const CITIES = ["玉溪市", "昆明市", "曲靖市", "红河州"];
const COLORS = ["深空灰", "珍珠白", "极光蓝", "曜石黑"];
const LEVELS = ["长续航版", "标准版", "高配版"];
const CHANNELS = ["云南新绿核租赁", "中车金融", "自有资产", "招银汽车金融"];
const DEALERS = ["玉溪创维新能源体验中心", "昆明创维重卡销售中心", "曲靖新能源商用车服务站"];
const DRIVERS = ["张建华", "李海峰", "王志强", "赵文军", "陈晓东", "刘俊杰", "杨志伟", "周建国"];

const LOCATIONS = [
  "玉溪市红塔区研和街道",
  "玉溪红塔研和物流园",
  "玉溪市红塔区九龙路",
  "玉溪市红塔区北城街道",
  "玉溪市高新区货运停车场",
  "玉溪市江川区大街街道",
  "昆明市晋宁区宝峰街道",
  "昆明市呈贡区吴家营",
  "昆明市安宁市草铺街道",
  "曲靖市麒麟区西城街道",
  "红河州开远市灵泉街道",
  "玉溪市通海县秀山街道",
];

// 以玉溪为中心向外扩散，保证地图点位真实分散又不越出云南中部。
const BASE_LNG = 102.545;
const BASE_LAT = 24.337;

function pick(list, index) {
  return list[index % list.length];
}

// 用确定性伪随机替代 Math.random，保证每次刷新数据一致，便于视觉与回归比对。
function seeded(index, salt) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function buildVehicle(index) {
  const seq = index + 1;
  const r1 = seeded(index, 1);
  const r2 = seeded(index, 2);
  const r3 = seeded(index, 3);
  const r4 = seeded(index, 4);

  // 前 24 辆在线，25~30 离线，31 起从未上线，保证三态都有足量样本。
  let onlineStatus = "在线";
  if (index >= 24 && index < 30) onlineStatus = "离线";
  if (index >= 30) onlineStatus = "从未上线";

  // 阈值按车辆配置下发：一部分车队要求 15% 才告警，一部分 30% 就告警。
  const LOW_SOC_15 = [5, 11, 26];
  const LOW_SOC_30 = [8, 17, 21, 28];
  const socThreshold = LOW_SOC_15.includes(index) ? 15 : LOW_SOC_30.includes(index) ? 30 : (r4 > 0.5 ? 30 : 15);

  // 指定车辆压到阈值以下，保证两档阈值在预警页都有样本可验证。
  let soc;
  if (onlineStatus === "从未上线") soc = null;
  else if (LOW_SOC_15.includes(index)) soc = Math.round(7 + r1 * 8);
  else if (LOW_SOC_30.includes(index)) soc = Math.round(18 + r1 * 11);
  else soc = Math.round(34 + r1 * 58);

  const driving = onlineStatus === "在线" && r2 > 0.42;
  const charging = onlineStatus === "在线" && !driving && r3 > 0.72;
  const speed = driving ? Math.round(18 + r3 * 52) : 0;

  const plateSeq = String(1000 + Math.round(r4 * 8900)).padStart(4, "0");
  const trailerSeq = String(1000 + Math.round(r2 * 8900)).padStart(4, "0");
  const vinSeq = String(2000 + seq * 37).padStart(6, "0");

  const drivingStatus = onlineStatus === "在线"
    ? (driving ? "行驶中" : "已停车")
    : onlineStatus === "离线" ? "状态未知" : "未激活";
  const chargingStatus = onlineStatus === "在线"
    ? (charging ? "充电中" : "未充电")
    : onlineStatus === "离线" ? "状态未知" : "未激活";

  // 默认车队保留一辆连续离线超过 24 小时的样本，便于验证异常离线处置。
  const offlineDurationHours = onlineStatus === "离线"
    ? (index === 24 ? 28 : Math.round(1 + r4 * 46))
    : null;
  const hasVehicleFault = onlineStatus === "在线" && [10, 19].includes(index);
  const faultCode = hasVehicleFault ? `P0A${70 + index}` : null;

  let updatedAt = "刚刚";
  if (onlineStatus === "在线") {
    const minutes = Math.round(r1 * 4);
    updatedAt = minutes === 0 ? "刚刚" : `${minutes} 分钟前`;
  } else if (onlineStatus === "离线") {
    updatedAt = `${Math.round(28 + r2 * 300)} 分钟前`;
  } else {
    updatedAt = "从未上报";
  }

  // 预警按风险等级覆盖：故障 > 离线超时 > SOC 过低。
  let alert = null;
  if (onlineStatus === "在线" && soc !== null && soc <= socThreshold) alert = "SOC 过低";
  if (onlineStatus === "离线" && offlineDurationHours >= 24) alert = "离线超时";
  if (hasVehicleFault) alert = "车辆故障";

  // 归属按照后台部门树分布；默认一车队仍覆盖在线、离线和从未上线样本。
  const scope = index < 12 || index === 24 || index === 30
    ? { organizationId: "yunnan-lifu", departmentId: "yunnan-qinsheng", fleetId: "qinsheng-team-1" }
    : index < 24 || index === 25 || index === 26
      ? { organizationId: "yunnan-lifu", departmentId: "yunnan-qinsheng", fleetId: "qinsheng-team-2" }
      : index === 27 || index === 28
        ? { organizationId: "yunnan-lifu", departmentId: "finance", fleetId: null }
        : index === 29
          ? { organizationId: "yunnan-lifu", departmentId: "sales", fleetId: null }
          : index === 31 || index === 32
            ? { organizationId: "heavy-truck-test", departmentId: "test-default", fleetId: null }
            : { organizationId: "wotong", departmentId: "wotong-default", fleetId: null };

  return {
    id: `FV${String(seq).padStart(3, "0")}`,
    ...scope,
    plate: `云F·A${plateSeq}`,
    trailerPlate: `云F·挂${trailerSeq}`,
    driverName: onlineStatus === "从未上线" ? "未分配司机" : pick(DRIVERS, index),
    vin: `LJ1EKB3F6N${vinSeq}`,
    model: pick(MODELS, index),
    modelCode: `YFZ${4250 + (index % 4) * 60}BEV`,
    configCode: `SWD-${pick(LEVELS, index).slice(0, 2)}-${200 + index}`,
    level: pick(LEVELS, index),
    color: pick(COLORS, index),
    batteryCode: `BP${String(90000 + seq * 13)}`,
    motorCode: `MT${String(70000 + seq * 29)}`,
    producedAt: `2025-${String(1 + (index % 12)).padStart(2, "0")}-${String(1 + (index % 27)).padStart(2, "0")}`,
    registeredAt: `2026-${String(1 + (index % 6)).padStart(2, "0")}-${String(3 + (index % 24)).padStart(2, "0")}`,
    registerCity: pick(CITIES, index),
    profileUpdatedAt: "2026-07-28 09:12",
    lng: Number((BASE_LNG + (r1 - 0.5) * 0.42).toFixed(6)),
    lat: Number((BASE_LAT + (r2 - 0.5) * 0.34).toFixed(6)),
    onlineStatus,
    soc,
    speed,
    totalMileage: Math.round(20000 + r3 * 168000),
    hevMileage: 0,
    drivingStatus,
    chargingStatus,
    gear: driving ? "D" : onlineStatus === "在线" ? "P" : "—",
    updatedAt,
    offlineDuration: offlineDurationHours === null ? "—" : `${offlineDurationHours} 小时`,
    offlineDurationHours,
    faultCode,
    location: onlineStatus === "从未上线" ? "暂无定位" : pick(LOCATIONS, index),
    socThreshold,
    alertStartAt: alert === "SOC 过低" ? "2026-07-31 09:24" : alert ? "2026-07-31 07:48" : null,
    alert,
    financeChannel: pick(CHANNELS, index),
    dealer: pick(DEALERS, index),
    invoiceNo: `FP2026${String(100000 + seq * 7)}`,
    iccid: `898604${String(200000000000 + seq * 37)}`,
    ownerPhone: `138${String(10000000 + seq * 1237).slice(0, 8)}`,
    taskOrders: [0, 1].map((taskIndex) => ({
      id: `T${String(202608010000 + seq * 10 + taskIndex)}`,
      status: taskIndex === 0 && driving ? "运输中" : "待发车",
      loadAddress: pick(LOCATIONS, index + taskIndex),
      unloadAddress: pick(LOCATIONS, index + taskIndex + 4),
      planAt: `2026-08-0${1 + taskIndex} ${taskIndex === 0 ? "08:30" : "14:00"}`,
    })),
    machineVersion: `V2.${3 + (index % 4)}.1`,
    tboxVersion: `T4.${1 + (index % 3)}.7`,
  };
}

export const fleetVehicles = Array.from({ length: 34 }, (_, index) => buildVehicle(index));

export function countByStatus(vehicles) {
  return {
    total: vehicles.length,
    online: vehicles.filter((item) => item.onlineStatus === "在线").length,
    offline: vehicles.filter((item) => item.onlineStatus === "离线").length,
    never: vehicles.filter((item) => item.onlineStatus === "从未上线").length,
  };
}

// ---------- 行车日志 ----------
function buildDrivingLogs() {
  const logs = [];
  fleetVehicles.forEach((vehicle, vIndex) => {
    if (vehicle.onlineStatus === "从未上线") return;
    const count = 2 + (vIndex % 3);
    for (let i = 0; i < count; i += 1) {
      const r = seeded(vIndex * 7 + i, 11);
      const day = 31 - i;
      const startHour = 7 + Math.round(r * 9);
      const durationMin = 45 + Math.round(r * 120);
      const endHour = startHour + Math.floor((durationMin + 20) / 60);
      logs.push({
        id: `DL${vehicle.id}-${i}`,
        vehicleId: vehicle.id,
        startAt: `2026-07-${String(day).padStart(2, "0")} ${String(startHour).padStart(2, "0")}:${String(Math.round(r * 55)).padStart(2, "0")}`,
        endAt: `2026-07-${String(day).padStart(2, "0")} ${String(Math.min(23, endHour)).padStart(2, "0")}:${String(Math.round(r * 45) + 10).padStart(2, "0")}`,
        mileage: Number((32 + r * 96).toFixed(1)),
        energy: `${Math.round(9 + r * 24)}%`,
        start: pick(LOCATIONS, vIndex + i),
        end: pick(LOCATIONS, vIndex + i + 3),
      });
    }
  });
  return logs;
}

export const fleetDrivingLogs = buildDrivingLogs();

// ---------- 充电日志 ----------
function buildChargingLogs() {
  const logs = [];
  fleetVehicles.forEach((vehicle, vIndex) => {
    if (vehicle.onlineStatus === "从未上线") return;
    const count = 1 + (vIndex % 2);
    for (let i = 0; i < count; i += 1) {
      const r = seeded(vIndex * 5 + i, 23);
      const startSoc = Math.round(14 + r * 26);
      const endSoc = Math.min(98, startSoc + Math.round(38 + r * 42));
      const minutes = 48 + Math.round(r * 74);
      const day = 31 - i;
      logs.push({
        id: `CL${vehicle.id}-${i}`,
        vehicleId: vehicle.id,
        startAt: `2026-07-${String(day).padStart(2, "0")} ${String(18 + i).padStart(2, "0")}:${String(Math.round(r * 50)).padStart(2, "0")}`,
        endAt: `2026-07-${String(day).padStart(2, "0")} ${String(19 + i).padStart(2, "0")}:${String(Math.round(r * 40) + 12).padStart(2, "0")}`,
        duration: `${Math.floor(minutes / 60)} 小时 ${String(minutes % 60).padStart(2, "0")} 分`,
        durationHours: Number((minutes / 60).toFixed(2)),
        startSoc,
        endSoc,
        electricity: `${(96 + r * 92).toFixed(1)} kWh`,
        location: pick(["玉溪红塔研和重卡充电站", "红塔区九龙池物流充电站", "昆明晋宁宝峰快充站", "曲靖麒麟商用车充电站"], vIndex + i),
        lng: Number((BASE_LNG + (seeded(vIndex + i, 31) - 0.5) * 0.3).toFixed(6)),
        lat: Number((BASE_LAT + (seeded(vIndex + i, 37) - 0.5) * 0.24).toFixed(6)),
      });
    }
  });
  return logs;
}

export const fleetChargingLogs = buildChargingLogs();

// ---------- 轨迹分段与轨迹点 ----------
// 每个分段是一次有效行驶时段，轨迹点带时间/速度/SOC，供回放联动面板取值。
function buildTrackSegments(vehicleId) {
  const base = fleetDrivingLogs.filter((log) => log.vehicleId === vehicleId).slice(0, 3);
  return base.map((log, segIndex) => {
    const pointCount = 12;
    const seedBase = segIndex * 17 + vehicleId.length;
    const points = Array.from({ length: pointCount }, (_, i) => {
      const t = i / (pointCount - 1);
      const wobble = (seeded(seedBase + i, 41) - 0.5) * 0.012;
      const startMinutes = Number(log.startAt.slice(11, 13)) * 60 + Number(log.startAt.slice(14, 16));
      const totalMinutes = 105;
      const atMinutes = startMinutes + Math.round(t * totalMinutes);
      return {
        lng: Number((BASE_LNG - 0.06 + t * 0.14 + wobble).toFixed(6)),
        lat: Number((BASE_LAT - 0.04 + t * 0.11 + wobble * 0.8).toFixed(6)),
        time: `${String(Math.floor(atMinutes / 60) % 24).padStart(2, "0")}:${String(atMinutes % 60).padStart(2, "0")}`,
        speed: Math.round(24 + seeded(seedBase + i, 43) * 46),
        soc: Math.max(6, Math.round(72 - t * 22 - seeded(seedBase + i, 47) * 4)),
        voltage: Number((598 + seeded(seedBase + i, 53) * 26).toFixed(1)),
        current: Number((28 + seeded(seedBase + i, 59) * 64).toFixed(1)),
        motorSpeed: Math.round(900 + seeded(seedBase + i, 61) * 1600),
        motorTemp: Math.round(42 + seeded(seedBase + i, 67) * 26),
        alarm: seeded(seedBase + i, 71) > 0.93 ? "电池温度偏高" : "无",
      };
    });
    return {
      id: `${vehicleId}-SEG${segIndex + 1}`,
      label: `${log.startAt.slice(11)} - ${log.endAt.slice(11)}`,
      date: log.startAt.slice(0, 10),
      mileage: log.mileage,
      duration: "1 小时 45 分",
      points,
    };
  });
}

export function getTrackSegments(vehicleId) {
  const segments = buildTrackSegments(vehicleId);
  return segments.length ? segments : buildTrackSegments("FV001");
}

// ---------- 单车日报表 ----------
export function getDailyReports(vehicleId) {
  return Array.from({ length: 7 }, (_, i) => {
    const r = seeded(vehicleId.length * 3 + i, 83);
    const mileage = Number((86 + r * 210).toFixed(1));
    const trips = 2 + Math.round(r * 5);
    const drivingHours = Number((2.4 + r * 5.2).toFixed(1));
    return {
      date: `2026-07-${String(31 - i).padStart(2, "0")}`,
      mileage,
      trips,
      drivingHours,
      activeHours: Number((drivingHours + 1.2 + r * 2).toFixed(1)),
      maxTripMileage: Number((mileage / trips * 1.4).toFixed(1)),
      avgSpeed: Number((mileage / drivingHours).toFixed(1)),
      energyPer100km: Number((92 + r * 34).toFixed(1)),
      maxEnergyPerCharge: Number((128 + r * 62).toFixed(1)),
      chargeTimes: 1 + Math.round(r * 2),
      chargeHours: Number((1.1 + r * 2.4).toFixed(1)),
      chargeElectricity: Number((132 + r * 168).toFixed(1)),
      maxChargeHours: Number((0.9 + r * 1.6).toFixed(1)),
      maxChargeElectricity: Number((96 + r * 88).toFixed(1)),
      maxMileagePerCharge: Number((178 + r * 96).toFixed(1)),
      lastUploadAt: `2026-07-${String(31 - i).padStart(2, "0")} 23:${String(40 + Math.round(r * 18)).padStart(2, "0")}`,
    };
  });
}

// ---------- 明细数据（原始报文精简） ----------
export function getRawMessages(vehicleId) {
  const vehicle = fleetVehicles.find((item) => item.id === vehicleId) ?? fleetVehicles[0];
  return Array.from({ length: 12 }, (_, i) => {
    const r = seeded(i, 97);
    const minute = 58 - i * 5;
    return {
      id: `MSG-${vehicleId}-${i}`,
      collectedAt: `2026-07-31 14:${String(Math.max(0, minute)).padStart(2, "0")}:${String(Math.round(r * 59)).padStart(2, "0")}`,
      vin: vehicle.vin,
      speed: Math.round(r * 68),
      soc: Math.max(6, Math.round((vehicle.soc ?? 50) - i * 0.6)),
      voltage: Number((602 + r * 22).toFixed(1)),
      current: Number((22 + r * 68).toFixed(1)),
      mileage: vehicle.totalMileage - i * 3,
      status: r > 0.9 ? "异常" : "正常",
    };
  });
}

// ---------- 今日运营汇总 ----------
const TODAY = "2026-07-31";

export function getTodaySummary(vehicles) {
  const scopedVehicleIds = new Set(vehicles.map((vehicle) => vehicle.id));
  const todayDriving = fleetDrivingLogs.filter((log) => scopedVehicleIds.has(log.vehicleId) && log.startAt.startsWith(TODAY));
  const todayCharging = fleetChargingLogs.filter((log) => scopedVehicleIds.has(log.vehicleId) && log.startAt.startsWith(TODAY));
  return {
    mileage: Number(todayDriving.reduce((sum, log) => sum + log.mileage, 0).toFixed(1)),
    electricity: Number(todayCharging.reduce((sum, log) => sum + Number.parseFloat(log.electricity), 0).toFixed(1)),
    alertCount: vehicles.filter((item) => item.alert).length,
  };
}

// ---------- 单车 7 类实时数据 ----------
export function buildRealtimeGroups(vehicle) {
  const online = vehicle.onlineStatus === "在线";
  const na = vehicle.onlineStatus === "从未上线" ? "未激活" : "—";
  const socText = vehicle.soc === null ? na : `${vehicle.soc}%`;
  return {
    "整车数据": [
      ["车速", online ? `${vehicle.speed} km/h` : na],
      ["SOC", socText],
      ["累计里程", `${vehicle.totalMileage.toLocaleString()} km`],
      ["当前档位", vehicle.gear],
      ["车辆状态", vehicle.drivingStatus],
      ["充电状态", vehicle.chargingStatus],
      ["总电压", online ? "612.4 V" : na],
      ["总电流", online ? (vehicle.chargingStatus === "充电中" ? "-186.2 A" : "42.8 A") : na],
    ],
    "驱动电机": [
      ["电机转速", online ? `${1200 + vehicle.speed * 24} rpm` : na],
      ["电机转矩", online ? `${(vehicle.speed * 4.6).toFixed(1)} N·m` : na],
      ["电机温度", online ? "58 °C" : na],
      ["控制器温度", online ? "49 °C" : na],
      ["控制器输入电压", online ? "608.2 V" : na],
      ["控制器直流母线电流", online ? "38.6 A" : na],
      ["电机状态", online ? (vehicle.speed > 0 ? "驱动" : "待机") : na],
      ["电机序号", vehicle.motorCode],
    ],
    "发动机": [
      ["动力类型", "纯电动"],
      ["发动机状态", "不适用"],
      ["曲轴转速", "不适用"],
      ["燃料消耗率", "不适用"],
      ["说明", "纯电动车型无发动机数据上报"],
    ],
    "定位数据": [
      ["定位状态", online ? "有效定位" : vehicle.onlineStatus === "离线" ? "最后定位" : "未定位"],
      ["经度", vehicle.onlineStatus === "从未上线" ? na : vehicle.lng.toFixed(6)],
      ["纬度", vehicle.onlineStatus === "从未上线" ? na : vehicle.lat.toFixed(6)],
      ["当前位置", vehicle.location],
      ["方向角", online ? "东北 42°" : na],
      ["海拔", online ? "1632 m" : na],
      ["采集时间", vehicle.updatedAt],
    ],
    "极值数据": [
      ["最高单体电压", online ? "3.71 V" : na],
      ["最低单体电压", online ? "3.68 V" : na],
      ["最高电压电池子系统号", online ? "1" : na],
      ["最低电压电池子系统号", online ? "3" : na],
      ["最高温度", online ? "32 °C" : na],
      ["最低温度", online ? "27 °C" : na],
      ["最高温度探针序号", online ? "12" : na],
      ["最低温度探针序号", online ? "4" : na],
    ],
    "报警数据": [
      ["当前报警", vehicle.alert || "无"],
      ["报警等级", vehicle.alert ? (vehicle.alert === "SOC 过低" ? "二级" : "一级") : "正常"],
      ["报警标志位", vehicle.alert ? "0x0004" : "0x0000"],
      ["故障码总数", vehicle.alert ? "1" : "0"],
      ["可充电储能装置故障", "无"],
      ["驱动电机故障", "无"],
      ["最后上报", vehicle.updatedAt],
      ["通讯状态", vehicle.onlineStatus],
    ],
    "储能装置": [
      ["电池包编码", vehicle.batteryCode],
      ["总电压", online ? "612.4 V" : na],
      ["总电流", online ? (vehicle.chargingStatus === "充电中" ? "-186.2 A" : "42.8 A") : na],
      ["剩余电量 SOC", socText],
      ["单体电池总数", "216"],
      ["电池温度探针总数", "24"],
      ["平均温度", online ? "29 °C" : na],
      ["绝缘电阻", online ? "1860 kΩ" : na],
    ],
  };
}
