const baseStations = [
  { id: "ST001", code: "CS000236", name: "玉溪红塔研和重卡充电站", shortName: "研和重卡站", address: "云南省玉溪市红塔区研和街道物流园区旁", province: "云南省", city: "玉溪市", district: "红塔区", lng: 102.5068, lat: 24.3078, totalPiles: 6, availablePiles: 6, drivingKm: 8.6, straightKm: 7.8, durationMin: 16, speedLabel: "快充", status: "正常", validation: "已校验", remark: "靠近研和物流园，货车通道宽，场内可停靠重卡；夜间照明充足，入口限高 4.5m。", updatedAt: "2026-07-05 11:20", price: "0.82", peakPrice: "0.95" },
  { id: "ST002", code: "CS000235", name: "红塔区九龙池物流充电站", shortName: "九龙池站", address: "云南省玉溪市红塔区九龙路货运停车区", province: "云南省", city: "玉溪市", district: "红塔区", lng: 102.5436, lat: 24.3864, totalPiles: 5, availablePiles: 3, drivingKm: 9.8, straightKm: 8.4, durationMin: 14, speedLabel: "快充", status: "正常", validation: "已校验", remark: "靠近主城区北侧货运停车区，进站需从辅道右转，重车掉头空间充足。", updatedAt: "2026-07-05 11:08", price: "0.88" },
  { id: "ST003", code: "CS000234", name: "玉溪北城货运补能站", shortName: "北城补能站", address: "云南省玉溪市红塔区北城街道玉丰路旁", province: "云南省", city: "玉溪市", district: "红塔区", lng: 102.5358, lat: 24.4246, totalPiles: 4, availablePiles: 2, drivingKm: null, straightKm: 13.2, durationMin: 22, speedLabel: "快充", status: "正常", validation: "待补价格", remark: "北向任务可就近补能，入口较窄，建议低速进站，场内可临停。", updatedAt: "2026-07-05 09:12", price: "" },
  { id: "ST004", code: "CS000233", name: "江川大街公共充电站", shortName: "江川大街站", address: "云南省玉溪市江川区大街街道星云路", province: "云南省", city: "玉溪市", district: "江川区", lng: 102.6846, lat: 24.2956, totalPiles: 2, availablePiles: 0, drivingKm: 18.4, straightKm: 15.8, durationMin: 31, speedLabel: "慢充", status: "停用", validation: "重卡风险", remark: "乘用车场地为主，重卡进出需现场确认。", updatedAt: "2026-07-05 10:30", price: "0.76" },
  { id: "ST005", code: "CS000232", name: "峨山小街货运充电站", shortName: "峨山小街站", address: "云南省玉溪市峨山县小街街道货运通道旁", province: "云南省", city: "玉溪市", district: "峨山县", lng: 102.4188, lat: 24.2054, totalPiles: 6, availablePiles: 4, drivingKm: 24.7, straightKm: 21.9, durationMin: 38, speedLabel: "快充", status: "正常", validation: "已校验", remark: "靠近峨山货运通道，适合南向任务中途补能。", updatedAt: "2026-07-05 10:05", price: "0.91" },
];

function makeStation(station, index) {
  const pricePeriods = [
    { priceType: "平", start: "00:00", end: "23:00", price: station.price || "" },
    ...(station.peakPrice ? [{ priceType: "尖", start: "23:00", end: "00:00", price: station.peakPrice }] : []),
  ];
  const stayDurations = [
    { start: "00:00", end: "08:00", durationMin: 40 },
    { start: "08:00", end: "18:00", durationMin: 50 },
    { start: "18:00", end: "24:00", durationMin: 45 },
  ];
  return {
    ...station,
    areaType: ["点", "点", "区域", "行政区域", "点"][index] || "点",
    stationType: "充电站",
    shipReceiveType: "收/发货",
    department: "玉溪运营部",
    shareMode: ["全局", "部门", "个人", "全局", "部门"][index] || "全局",
    radius: 500,
    settlementEntity: "玉溪物流能源有限公司",
    openStatus: station.status === "正常" ? "已开通" : "未开通",
    account: "tms_yx_ops",
    editor: "张运营",
    autoCode: `YX${String(index + 1).padStart(3, "0")}`,
    enabledStatus: station.status === "正常" ? "启用" : "停用",
    accountStatus: ["已登录", "已登录", "未登录", "已停用", "未开通"][index] || "已登录",
    pileCount: station.totalPiles,
    routeNearbyFlag: false,
    pricePeriods,
    stayDurations,
    priceText: station.price ? `${station.price} 元/度` : "暂无价格",
    stayDurationText: "50 分钟",
  };
}

module.exports = baseStations.map(makeStation);
