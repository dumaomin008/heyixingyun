/* TMS 多角色工作台：独立菜单与页面，不改写既有业务模块状态。 */
(function () {
  'use strict';

  var STORAGE_KEY = 'tms-workbench-v1';
  var SEED_VER = 7;
  var PAGE_SIZE = 20;
  var ORG = '云南钦圣新能源科技有限公司 / 一车队（云南钦圣）';
  var TODAY = '2026-09-09';
  var DEPT = '云南钦圣新能源科技有限公司';

  var ROLES = [
    { id: 'all', page: 'workbench-home', name: '综合', title: '综合工作台', crumb: '综合工作台' },
    { id: 'dispatch', page: 'workbench-dispatch', name: '调度', title: '调度工作台', crumb: '调度工作台' },
    { id: 'stat', page: 'workbench-stat', name: '统计', title: '统计工作台', crumb: '统计工作台' },
    { id: 'fleet', page: 'workbench-fleet', name: '运力', title: '运力工作台', crumb: '运力工作台' },
    { id: 'safety', page: 'workbench-safety', name: '安全', title: '安全工作台', crumb: '安全工作台' },
    { id: 'ops', page: 'workbench-ops', name: '运营', title: '运营工作台', crumb: '运营工作台' },
    { id: 'manager', page: 'workbench-manager', name: '管理', title: '管理工作台', crumb: '管理工作台' }
  ];
  var AUTH_KEY = 'tms-admin-auth-v1';
  var ACCOUNTS = [
    { id: 'dispatch', name: '杜发财', title: '调度员', desc: '日常工作入口：待办、派车、监控与告警', home: 'workbench-dispatch', screen: 'auto' },
    { id: 'stat', name: '王核验', title: '统计员', desc: '磅单审核与运输数据完整性', home: 'workbench-stat', screen: '' },
    { id: 'fleet', name: '陈运力', title: '运力管理员', desc: '司机、牵引车、挂车可用状态', home: 'workbench-fleet', screen: '' },
    { id: 'safety', name: '刘安', title: '安全员', desc: '超速、离线与安全事件闭环', home: 'workbench-safety', screen: '' },
    { id: 'ops', name: '赵运营', title: '运营人员', desc: '线路时效与经营异常', home: 'workbench-ops', screen: '' },
    { id: 'manager', name: '周总', title: '管理者', desc: '重大运营、安全与决策事项', home: 'workbench-manager', screen: 'optional' }
  ];

  var TODO_JUMP = {
    '待派单': 'task-order-management',
    '预派待转正式': 'task-order-management',
    '未知卸货地待确认': 'waybill-management',
    '待审核磅单': 'weigh-point-audit',
    '时间节点缺失': 'weigh-point-audit',
    '数据修正': 'weigh-point-audit'
  };

  var PLATES = ['云A·D8021', '云A·E1936', '云A·F4470', '云A·G2288', '云A·H6612', '云A·J3058', '云A·K4419'];
  var DRIVERS = ['李宏俊', '王磊', '马旺', '张建华', '陈志远', '刘副驾', '赵明'];
  var ROUTES = [
    '大开门水渣装货地 → 尖峰水泥厂（卸货地）',
    '尖峰水泥场（装货地） → 景洪水泥卸货网点',
    '大勐龙铁精粉装货地 → 杨武铁精粉下货点',
    '普洱市宁洱天恒水泥厂 → 景洪水泥卸货点'
  ];

  var listState = { page: 1, type: '', role: '', status: '待处理', keyword: '', level: '', category: '', read: '' };
  var boardState = { kind: '', title: '', from: 'workbench-home', node: '' };
  var dispatchTodoTab = 'all';
  var dispatchDrawerMode = 'formal';
  var dispatchDrawerDir = 'task';
  var dispatchAssignTaskId = '';
  var dispatchAssignPick = '';
  var dispatchTodoPri = '';
  var dispatchTodoQ = '';
  var dispatchAlertType = 'all';
  var dispatchAlertStatus = 'open';
  var dispatchAlertLevel = '';
  var dispatchAlertQ = '';
  var dispatchAlertPulse = true;
  var dispatchCapacityFilter = '';
  var dispatchCapacityQ = '';
  var dispatchGlobalQ = '';
  var dispatchHit = '';
  var dispatchAlertHandleId = '';
  var highlightPage = '';
  var store = null;
  var dispatchMap = null;
  var dispatchMapSatellite = null;
  var dispatchMapBaseLayers = null;
  var dispatchVehicleCluster = null;
  var dispatchStationCluster = null;
  var dispatchTrafficLayer = null;
  var vmMapNeedsOverviewFit = true;
  var vmOverviewCamera = null;
  var mapFilter = { q: '', vehicle: 'all', status: 'all', route: 'all', satellite: false, fullscreen: false };
  var selectedPlate = '';
  var vmHoveredPlate = '';
  // 可视化大屏暂时只保留车辆监控，旧分类实现保留在文件中便于后续恢复。
  var dcTab = 'monitor';
  var stTrendKind = 'task';
  var stKpiRange = 'today';
  var stGoods = 'all';
  var stDay = 'today';
  var selectedTaskId = '';
  var vmState = {
    taskStatus: 'transporting', taskRoute: 'all', project: 'yx', fleet: 'all', org: 'yx-dept', orgOpen: false, kpi: '',
    vehicleStatus: 'all', vehicleRuntimeStatuses: [], vehicleRuntimeOpen: false,
    leftCollapsed: false, leftScroll: 0,
    page: 1, detail: 'live', q: '', satellite: false,
    layerOpen: false, selectedSite: '',
    opsOpen: false, overviewCollapsed: false,
    warningOpen: false, warningTab: 'all', warningScope: 'active', selectedWarning: '', warningPulse: true,
    warningTickerIndex: 0, warningTickerHover: false,
    warningDetailTab: 'overview', warningPlate: '', warningQ: '', warningScroll: 0, warningOrigin: null,
    layers: {
      executing: true,
      load: false,
      waiting: false,
      idle: false,
      offline: false,
      station: false,
      fence: false,
      traffic: true
    }
  };
  var VM_ORG_TREE = [
    { id: 'all', name: '合一星运（全部组织）', short: '全部组织', path: '全公司数据', level: 0, project: 'all', fleet: 'all', count: 144 },
    { id: 'yn-center', name: '云南钦圣新能源有限公司', short: '云南钦圣新能源有限公司', path: '合一星运 / 云南钦圣新能源有限公司', level: 1, project: 'yx', fleet: 'all', count: 144 },
    { id: 'yx-dept', name: '玉溪新能源事业部', short: '玉溪新能源事业部', path: '云南钦圣新能源有限公司 / 玉溪新能源事业部', level: 2, project: 'yx', fleet: 'all', count: 144 },
    { id: 'fleet-a', name: 'A车队', short: 'A车队', path: '玉溪新能源事业部 / A车队', level: 3, project: 'yx', fleet: 'A车队', count: 72 },
    { id: 'fleet-b', name: 'B车队', short: 'B车队', path: '玉溪新能源事业部 / B车队', level: 3, project: 'yx', fleet: 'B车队', count: 72 }
  ];
  var VM_WARNINGS = [
    { id: 'vw-bill', status: 'active', cat: 'fulfillment', type: '卸货磅单未上传', plate: '云A·F4470', site: '北城', time: '09:57', duration: '持续 26min', reason: '离开北城卸货区 26min，仍未上传卸货磅单', facts: ['09:42 离开北城卸货地', '卸货磅单：未上传'] },
    { id: 'vw-stop', status: 'active', cat: 'running', type: '停车预警', plate: '云A·D8021', site: '', time: '09:48', duration: '持续 42min', reason: '非业务区域持续停车 42min', facts: ['当前位置：昆磨高速辅路', '车辆速度：0 km/h', '不在装卸货点或充电站范围'] },
    { id: 'vw-site', status: 'active', cat: 'site', type: '区域停留预警', plate: '云A10103', site: '北城', time: '09:42', duration: '持续 1h16min', reason: '北城卸货区停留 1h16min，尚未离开', facts: ['08:26 到达北城卸货区', '当前仍在卸货区域', '停留时长：1h16min'] },
    { id: 'vw-speed', status: 'active', cat: 'running', type: '车速预警', plate: '云A·E1936', site: '', time: '09:42', duration: '持续 2min', reason: '当前车速 86km/h，已持续 2min', facts: ['当前速度：86 km/h', '持续时间：2min'] },
    { id: 'vw-soc', status: 'active', cat: 'energy', type: 'SOC预警', plate: '云A·D8021', site: '', time: '09:38', duration: '持续 34min', reason: '当前 SOC 18%，电量偏低', facts: ['当前 SOC：18%', '当前任务：运输中'] },
    { id: 'vw-fatigue', status: 'active', cat: 'running', type: '司机疲劳驾驶', plate: '云A·K4419', site: '', time: '10:18', duration: '持续 4h12min', reason: '连续驾驶 4h12min，尚未休息', facts: ['连续驾驶时长：4h12min', '当前状态：仍在行驶中，尚未开始休息'] },
    { id: 'vw-r1', status: 'recovered', cat: 'site', type: '区域停留预警', plate: '云A66666', site: '昆钢', time: '08:32', recoveredAt: '09:06', duration: '已恢复', reason: '车辆离开充电站后自动恢复', facts: ['08:32 触发预警', '09:06 离开充电站', '09:06 自动恢复'] },
    { id: 'vw-r2', status: 'recovered', cat: 'running', type: '停车预警', plate: '云A12345', site: '', time: '07:51', recoveredAt: '08:09', duration: '已恢复', reason: '车辆恢复正常行驶后自动恢复', facts: ['07:51 触发预警', '08:09 恢复正常行驶', '08:09 自动恢复'] },
    { id: 'vw-r3', status: 'recovered', cat: 'fulfillment', type: '卸货磅单未上传', plate: '云A10104', site: '研和', time: '07:20', recoveredAt: '07:31', duration: '已恢复', reason: '司机补传卸货磅单后自动恢复', facts: ['07:05 离开卸货地', '07:20 触发预警', '07:31 上传磅单并自动恢复'] },
    { id: 'vw-r4', status: 'recovered', cat: 'running', type: '司机疲劳驾驶', plate: '云A·H6612', site: '', time: '06:40', recoveredAt: '07:05', duration: '已恢复', reason: '司机休息后自动恢复', facts: ['06:40 触发预警', '06:45 停靠服务区开始休息', '07:05 休息后自动恢复'] }
  ];
  var raState = {
    tab: 'all', q: '', selected: '昆钢 → 北城', trend: 'ton', rank: 'rate', compose: 'load',
    day: '7d', goods: 'all', metric: 'ton', sort: 'ton', sortOpen: false, netFull: false
  };
  var axState = {
    tab: 'all', q: '', sort: 'new', selected: 'ax1', detail: 'event', mapType: 'all', trend: 'hour',
    layers: { vehicle: true, route: true, fence: false, mark: true }, layerOpen: false
  };
  var AX_KIND = {
    timeout: { name: '超时', label: '超时异常', color: '#ef4444', tint: '#fef2f2' },
    stay: { name: '停滞', label: '停滞异常', color: '#fa8c16', tint: '#fff7ed' },
    deviate: { name: '偏航', label: '偏航异常', color: '#7c3aed', tint: '#f5f3ff' },
    soc: { name: '低SOC', label: '低SOC异常', color: '#f59e0b', tint: '#fffbeb' },
    fence: { name: '围栏', label: '电子围栏异常', color: '#38bdf8', tint: '#e0f2fe' },
    data: { name: '数据', label: '数据异常', color: '#1d4ed8', tint: '#eff6ff' }
  };
  var AX_EVENTS = [
    { id: 'ax1', kind: 'timeout', plate: '云A12345', title: '装货超时', loc: '昆钢（装货区）', site: '昆钢', task: 'Y20260904000018', value: '超时 96 min', time: '12:18', driver: '张三', phone: '13808718888', route: '昆钢 → 北城', soc: 62, team: '云南车队', model: '重卡 · 换电', from: '昆钢', to: '北城', t: 0.08, updated: TODAY + ' 13:28:36' },
    { id: 'ax2', kind: 'timeout', plate: '云A·K4419', title: '装货超时', loc: '昆钢（装货区）', site: '昆钢', task: 'Y20260904000027', value: '超时 58 min', time: '12:40', driver: '赵明', phone: '13808710027', route: '昆钢 → 北城', soc: 88, team: '云南车队', model: '重卡 · 换电', from: '昆钢', to: '北城', t: 0.1, updated: TODAY + ' 13:10:00' },
    { id: 'ax3', kind: 'timeout', plate: '云A·L7720', title: '卸货超时', loc: '北城（卸货区）', site: '北城', task: 'Y20260904000028', value: '超时 42 min', time: '12:55', driver: '周强', phone: '13808710028', route: '大开门 → 北城', soc: 59, team: '云南车队', model: '重卡 · 换电', from: '大开门', to: '北城', t: 0.92, updated: TODAY + ' 13:20:00' },
    { id: 'ax4', kind: 'stay', plate: '云A·E1936', title: '卸货停滞', loc: '研和（卸货区）', site: '研和', task: 'Y20260904000022', value: '停滞 38 min', time: '13:05', driver: '王磊', phone: '13808710022', route: '大开门 → 研和', soc: 54, team: '云南车队', model: '重卡 · 换电', from: '大开门', to: '研和', t: 0.86, updated: TODAY + ' 13:05:00' },
    { id: 'ax5', kind: 'stay', plate: '云A·N3341', title: '装货停滞', loc: '大开门（装货区）', site: '大开门', task: 'Y20260904000030', value: '停滞 45 min', time: '12:32', driver: '郑浩', phone: '13808710030', route: '大开门 → 研和', soc: 77, team: '云南车队', model: '重卡 · 换电', from: '大开门', to: '研和', t: 0.08, updated: TODAY + ' 13:02:00' },
    { id: 'ax6', kind: 'stay', plate: '云A·J3058', title: '行驶停滞', loc: 'G8511 昆磨高速', site: '昆钢', task: 'Y20260904000026', value: '停滞 28 min', time: '13:01', driver: '刘副驾', phone: '13808710026', route: '大开门 → 研和', soc: 66, team: '云南车队', model: '重卡 · 换电', from: '大开门', to: '研和', t: 0.44, updated: TODAY + ' 13:01:00' },
    { id: 'ax7', kind: 'stay', plate: '云A·P5526', title: '卸货停滞', loc: '北城（卸货区）', site: '北城', task: 'Y20260904000031', value: '停滞 33 min', time: '12:48', driver: '孙伟', phone: '13808710031', route: '昆钢 → 北城', soc: 63, team: '云南车队', model: '重卡 · 换电', from: '昆钢', to: '北城', t: 0.88, updated: TODAY + ' 12:48:00' },
    { id: 'ax8', kind: 'deviate', plate: '云A·F4470', title: '偏离线路', loc: '昆钢 → 北城', site: '北城', task: 'Y20260904000023', value: '偏航 23 km', time: '12:58', driver: '马旺', phone: '13808710023', route: '昆钢 → 北城', soc: 48, team: '云南车队', model: '重卡 · 换电', from: '昆钢', to: '北城', t: 0.22, updated: TODAY + ' 12:58:00' },
    { id: 'ax9', kind: 'deviate', plate: '云A·M1188', title: '偏离线路', loc: '大开门 → 研和', site: '大开门', task: 'Y20260904000029', value: '偏航 12 km', time: '12:22', driver: '吴磊', phone: '13808710029', route: '昆钢 → 研和', soc: 22, team: '云南车队', model: '重卡 · 换电', from: '大开门', to: '研和', t: 0.31, updated: TODAY + ' 12:22:00' },
    { id: 'ax10', kind: 'soc', plate: '云A·D8021', title: '电量过低', loc: '昆钢 → 研和', site: '研和', task: 'Y20260904000021', value: 'SOC 18%', time: '12:51', driver: '李宏俊', phone: '13808710021', route: '昆钢 → 研和', soc: 18, team: '云南车队', model: '重卡 · 换电', from: '昆钢', to: '研和', t: 0.38, updated: TODAY + ' 12:51:00' },
    { id: 'ax11', kind: 'soc', plate: '云A·G2288', title: '电量过低', loc: '大开门充电站', site: '大开门', task: 'Y20260904000024', value: 'SOC 16%', time: '13:08', driver: '张建华', phone: '13808710024', route: '大开门 → 北城', soc: 16, team: '云南车队', model: '重卡 · 换电', from: '大开门', to: '北城', t: 0.18, updated: TODAY + ' 13:08:00' },
    { id: 'ax12', kind: 'soc', plate: '云A·H6612', title: '电量过低', loc: '昆钢 → 研和', site: '研和', task: 'Y20260904000025', value: 'SOC 19%', time: '12:40', driver: '陈志远', phone: '13808710025', route: '昆钢 → 研和', soc: 19, team: '云南车队', model: '重卡 · 换电', from: '昆钢', to: '研和', t: 0.58, updated: TODAY + ' 12:40:00' },
    { id: 'ax13', kind: 'soc', plate: '云A88888', title: '电量过低', loc: '玉溪服务区', site: '研和', task: 'Y20260904000040', value: 'SOC 15%', time: '11:56', driver: '冯二', phone: '13808710040', route: '昆钢 → 研和', soc: 15, team: '云南车队', model: '重卡 · 换电', from: '昆钢', to: '研和', t: 0.64, updated: TODAY + ' 11:56:00' },
    { id: 'ax14', kind: 'fence', plate: '云A·Q8801', title: '围栏外停留', loc: '昆钢厂区外侧', site: '昆钢', task: 'Y20260904000041', value: '越界 1 次', time: '12:10', driver: '钱七', phone: '13808710041', route: '昆钢 → 北城', soc: 71, team: '云南车队', model: '重卡 · 换电', from: '昆钢', to: '北城', t: 0.12, updated: TODAY + ' 12:10:00' },
    { id: 'ax15', kind: 'data', plate: '云A·R2208', title: '定位漂移', loc: '研和附近', site: '研和', task: 'Y20260904000042', value: '漂移 3 次', time: '13:15', driver: '孙八', phone: '13808710042', route: '大开门 → 研和', soc: 64, team: '云南车队', model: '重卡 · 换电', from: '大开门', to: '研和', t: 0.7, updated: TODAY + ' 13:15:00' }
  ];
  var AX_TOP = [
    { plate: '云A12345', n: 5, kind: 'timeout' },
    { plate: '云A·E1936', n: 4, kind: 'stay' },
    { plate: '云A·F4470', n: 3, kind: 'deviate' },
    { plate: '云A·D8021', n: 3, kind: 'soc' },
    { plate: '云A·K4419', n: 3, kind: 'timeout' },
    { plate: '云A·G2288', n: 2, kind: 'soc' },
    { plate: '云A·H6612', n: 2, kind: 'soc' },
    { plate: '云A·N3341', n: 2, kind: 'stay' },
    { plate: '云A·J3058', n: 1, kind: 'stay' },
    { plate: '云A·P5526', n: 1, kind: 'stay' }
  ];
  var AX_HOUR = [
    { h: '08', timeout: 0, stay: 1, deviate: 0, soc: 1, fence: 0, data: 0 },
    { h: '09', timeout: 1, stay: 0, deviate: 0, soc: 0, fence: 0, data: 0 },
    { h: '10', timeout: 0, stay: 1, deviate: 1, soc: 1, fence: 0, data: 0 },
    { h: '11', timeout: 1, stay: 1, deviate: 0, soc: 1, fence: 1, data: 0 },
    { h: '12', timeout: 1, stay: 1, deviate: 1, soc: 1, fence: 0, data: 0 },
    { h: '13', timeout: 0, stay: 0, deviate: 0, soc: 0, fence: 0, data: 1 }
  ];
  var VM_PAGE = 10;
  var VM_CACHE = null;
  var VM_TASK_CACHE = null;
  var VM_STATIONS = [
    { name: '大开门充电站', pos: [102.43, 24.292], price: '¥0.82', distance: '1.8km' },
    { name: '研和充电站', pos: [102.56, 24.30], price: '¥0.76', distance: '3.2km' },
    { name: '北城充电站', pos: [102.70, 25.07], price: '¥0.89', distance: '6.5km' },
    { name: '昆钢充电站', pos: [102.49, 24.905], price: '¥0.79', distance: '4.6km' }
  ];
  var VM_ST = {
    run: { name: '行驶中', color: '#22c55e', bg: '#ecfdf3', icon: '#16a34a' },
    load: { name: '装货中', color: '#f59e0b', bg: '#fff7ed', icon: '#ea580c' },
    unload: { name: '卸货中', color: '#ef4444', bg: '#fef2f2', icon: '#dc2626' },
    charge: { name: '充电中', color: '#2563eb', bg: '#eff6ff', icon: '#2563eb' },
    idle: { name: '空闲', color: '#0ea5e9', bg: '#f0f9ff', icon: '#38bdf8' },
    offline: { name: '离线', color: '#64748b', bg: '#f1f5f9', icon: '#94a3b8' },
    waiting: { name: '待执行', color: '#f59e0b', bg: '#fff7ed', icon: '#d97706' },
    ready: { name: '待运输', color: '#67c6e9', bg: '#ecfeff', icon: '#0891b2' },
    done: { name: '已完成', color: '#7c3aed', bg: '#f3e8ff', icon: '#7e22ce' }
  };
  var dcQueueIds = null;
  var dcQueueSeed = 12;
  var AMAP_KEY = '2e9013c7c076a1baec170c986d477a8b';
  var SITE_POS = {
    '大开门水渣装货地': [102.42, 24.28],
    '尖峰水泥厂（卸货地）': [102.55, 24.36],
    '尖峰水泥场（装货地）': [102.52, 24.35],
    '景洪水泥卸货网点': [100.80, 22.01],
    '大勐龙铁精粉装货地': [100.72, 21.58],
    '杨武铁精粉下货点': [101.88, 24.12],
    '普洱市宁洱天恒水泥厂': [101.05, 23.07],
    '景洪水泥卸货点': [100.82, 22.05],
    '昆钢': [102.478, 24.919],
    '北城': [102.712, 25.087],
    '大开门': [102.42, 24.28],
    '研和': [102.548, 24.289]
  };
  var DC_SITES = {
    '昆钢': [102.478, 24.919],
    '北城': [102.712, 25.087],
    '大开门': [102.42, 24.28],
    '研和': [102.548, 24.289]
  };
  var DC_LINES = [['昆钢', '北城'], ['大开门', '研和'], ['昆钢', '研和']];
  var DC_QUEUE = [
    { start: '昆钢', end: '北城', cargo: '煤炭', weight: '32t', depart: '今天 14:30', wait: 26, tag: '普通任务', extra: '' },
    { start: '昆钢', end: '研和', cargo: '水泥', weight: '34t', depart: '今天 14:40', wait: 24, tag: '普通任务', extra: '' },
    { start: '大开门', end: '北城', cargo: '水渣', weight: '32t', depart: '今天 14:50', wait: 22, tag: '普通任务', extra: '未知卸货点' },
    { start: '昆钢', end: '北城', cargo: '煤炭', weight: '30t', depart: '今天 15:00', wait: 18, tag: '普通任务', extra: '' },
    { start: '研和', end: '昆钢', cargo: '水泥', weight: '34t', depart: '今天 15:10', wait: 16, tag: '通用派单', extra: '' },
    { start: '大开门', end: '研和', cargo: '水渣', weight: '32t', depart: '今天 15:20', wait: 14, tag: '普通任务', extra: '' },
    { start: '昆钢', end: '大开门', cargo: '煤炭', weight: '28t', depart: '今天 15:30', wait: 12, tag: '普通任务', extra: '未知卸货点' },
    { start: '北城', end: '研和', cargo: '水泥', weight: '34t', depart: '今天 15:40', wait: 10, tag: '普通任务', extra: '' },
    { start: '昆钢', end: '北城', cargo: '煤炭', weight: '32t', depart: '今天 16:00', wait: 8, tag: '普通任务', extra: '' },
    { start: '大开门', end: '北城', cargo: '水渣', weight: '31t', depart: '今天 16:10', wait: 7, tag: '通用派单', extra: '' },
    { start: '研和', end: '北城', cargo: '水泥', weight: '34t', depart: '今天 16:20', wait: 5, tag: '普通任务', extra: '' },
    { start: '昆钢', end: '研和', cargo: '煤炭', weight: '32t', depart: '今天 16:30', wait: 4, tag: '普通任务', extra: '' }
  ];
  var DC_ALERTS = [
    { plate: '云A12345', kind: 'timeout', type: '超时', value: '96 min', desc: '装货点停留超时（昆钢）', time: '13:12' },
    { plate: '云A·E1936', kind: 'stay', type: '停滞', value: '38 min', desc: '卸货区长时间未移动', time: '13:05' },
    { plate: '云A·F4470', kind: 'deviate', type: '偏航', value: '23 km', desc: '偏离计划线路', time: '12:58' },
    { plate: '云A·D8021', kind: 'soc', type: '低SOC', value: '18%', desc: '电量低于 20%', time: '12:51' },
    { plate: '云A·H6612', kind: 'offline', type: '离线', value: '2h', desc: '执行中最后定位超时', time: '12:40' }
  ];
  var DC_FLEET = [
    { name: '运输中', n: 32, pct: 53, color: '#22c55e' },
    { name: '装货中', n: 6, pct: 10, color: '#2563eb' },
    { name: '卸货中', n: 5, pct: 8, color: '#86efac' },
    { name: '充电中', n: 8, pct: 13, color: '#38bdf8' },
    { name: '空闲', n: 7, pct: 12, color: '#94a3b8' },
    { name: '离线', n: 2, pct: 3, color: '#64748b' }
  ];
  var DC_ROUTES = [
    { name: '昆钢 → 北城', run: 12, done: 32, abnormal: 1, rate: 73 },
    { name: '大开门 → 研和', run: 10, done: 22, abnormal: 2, rate: 69 },
    { name: '昆钢 → 研和', run: 9, done: 14, abnormal: 1, rate: 61 },
    { name: '大开门 → 北城', run: 7, done: 8, abnormal: 1, rate: 53 }
  ];
  try {
    sessionStorage.removeItem('wbDcTabV2');
  } catch (e) {}

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n, w) {
    var s = String(n);
    while (s.length < w) s = '0' + s;
    return s;
  }
  function toast(msg) {
    if (typeof showAppToast === 'function') showAppToast(msg);
    else window.alert(msg);
  }
  function nowStr() {
    var d = new Date();
    return TODAY + ' ' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2);
  }
  function taskCode(seq) { return 'Y2026090203' + pad(seq, 6); }
  function accountById(id) {
    return ACCOUNTS.filter(function (a) { return a.id === id; })[0] || null;
  }
  function getAuth() {
    try {
      var raw = localStorage.getItem(AUTH_KEY);
      var data = raw ? JSON.parse(raw) : null;
      if (!data || !accountById(data.id)) return null;
      return data;
    } catch (e) { return null; }
  }
  function setAuth(acc) {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ id: acc.id, name: acc.name, title: acc.title, at: nowStr() }));
  }
  function clearAuth() {
    try { localStorage.removeItem(AUTH_KEY); } catch (e) {}
  }
  function currentAccount() {
    var auth = getAuth();
    return auth ? accountById(auth.id) : null;
  }
  function canSeeScreen() {
    var acc = currentAccount();
    return !!(acc && (acc.screen === 'auto' || acc.screen === 'optional'));
  }
  function roleLanding(acc) {
    if (!acc) return 'login';
    return acc.screen === 'auto' ? 'dispatch-screen' : acc.home;
  }
  function roleName(id) {
    var hit = ROLES.filter(function (r) { return r.id === id; })[0];
    return hit ? hit.name : id;
  }
  function badge(text, cls) { return '<span class="badge ' + (cls || 'badge-gray') + '">' + esc(text) + '</span>'; }
  function priBadge(p) {
    if (p === '高' || p === 'P0') return badge('高', 'badge-error');
    if (p === '中' || p === 'P1') return badge('中', 'badge-warning');
    return badge('低', 'badge-gray');
  }
  function statusBadge(s) {
    if (s === '新告警') return badge(s, 'badge-error');
    if (s === '待处理' || s === '待确认') return badge(s, 'badge-warning');
    if (s === '处理中') return badge(s, 'badge-primary');
    if (s === '已完成' || s === '已关闭' || s === '已恢复' || s === '已处理') return badge(s, 'badge-success');
    if (s === '已取消' || s === '已忽略') return badge(s, 'badge-gray');
    return badge(s, 'badge-info');
  }
  function alertGradeBadge(lv) {
    if (lv === '高') return badge('高', 'badge-error');
    if (lv === '中') return badge('中', 'badge-warning');
    return badge(lv || '中', 'badge-info');
  }
  function levelBadge(lv) {
    if (lv === '严重') return badge('严重', 'badge-error');
    if (lv === '重要') return badge('重要', 'badge-warning');
    return badge('提醒', 'badge-info');
  }
  function linkBtn(label, fn) {
    return '<button class="btn btn-text" type="button" onclick="' + fn + '">' + label + '</button>';
  }

  function icon(kind) {
    var paths = {
      list: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5"/>',
      alert: '<path d="M10.3 4.3L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
      truck: '<path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
      check: '<path d="M9 11l2 2 4-4"/><circle cx="12" cy="12" r="9"/>',
      user: '<circle cx="12" cy="8" r="3"/><path d="M5 19a7 7 0 0 1 14 0"/>',
      bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
      chart: '<path d="M4 19V5M4 19h16"/><path d="M8 16V9M12 16V6M16 16v-5"/>'
    };
    return '<span class="kpi-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + (paths[kind] || paths.list) + '</svg></span>';
  }

  function makeTodo(cfg) {
    return {
      id: cfg.id,
      type: cfg.type,
      title: cfg.title,
      bizType: cfg.bizType,
      bizNo: cfg.bizNo,
      priority: cfg.priority,
      role: cfg.role,
      owner: cfg.owner || roleName(cfg.role) + '岗',
      org: DEPT,
      createdAt: cfg.createdAt || (TODAY + ' 08:12:00'),
      dueAt: cfg.dueAt || '',
      status: '待处理',
      source: cfg.source || '系统',
      finishedAt: '',
      extra: cfg.extra || ''
    };
  }
  function makeAlert(cfg) {
    return {
      id: cfg.id,
      category: cfg.category,
      type: cfg.type,
      title: cfg.title,
      objectType: cfg.objectType,
      objectNo: cfg.objectNo,
      level: cfg.level,
      role: cfg.role,
      status: '待确认',
      duration: cfg.duration || '',
      detectedAt: cfg.detectedAt || (TODAY + ' 07:40:00'),
      extra: cfg.extra || ''
    };
  }
  function makeMsg(cfg) {
    return {
      id: cfg.id,
      title: cfg.title,
      content: cfg.content,
      time: cfg.time,
      read: !!cfg.read,
      bizNo: cfg.bizNo || ''
    };
  }

  function seedTodos() {
    var rows = [];
    var i;
    for (i = 1; i <= 32; i++) {
      rows.push(makeTodo({
        id: 'TD-P' + pad(i, 3),
        type: '待派单',
        title: '任务待正式派单',
        bizType: '任务单',
        bizNo: taskCode(i),
        priority: '中',
        role: 'dispatch',
        extra: ROUTES[i % ROUTES.length]
      }));
    }
    [['001', '云A·D8021 / 李宏俊', '高'], ['002', '云A·E1936 / 王磊', '高'], ['003', '云A·F4470 / 马旺', '中'], ['004', '云A·G2288 / 张建华', '中']].forEach(function (row) {
      rows.push(makeTodo({
        id: 'TD-PRE' + row[0],
        type: '预派待转正式',
        title: '当前任务已结束，预派待转正式',
        bizType: '任务单',
        bizNo: 'YP-20260909-' + row[0],
        priority: row[2],
        role: 'dispatch',
        extra: row[1] + ' · ' + ROUTES[Number(row[0]) % ROUTES.length]
      }));
    });
    [['001', 'Y2026090203000033'], ['002', 'Y2026090203000038']].forEach(function (row) {
      rows.push(makeTodo({
        id: 'TD-UL' + row[0],
        type: '未知卸货地待确认',
        title: '区域卸货任务待确认具体卸货点',
        bizType: '运单',
        bizNo: row[1],
        priority: '中',
        role: 'dispatch',
        extra: '收货区域：景洪水泥卸货网点'
      }));
    });
    for (i = 1; i <= 8; i++) {
      rows.push(makeTodo({
        id: 'TD-WB' + pad(i, 3),
        type: '待审核磅单',
        title: (i % 2 ? '装货' : '卸货') + '磅单待审核',
        bizType: '磅单',
        bizNo: 'WB-20260909-' + pad(i, 3),
        priority: i <= 2 ? '高' : '中',
        role: 'stat',
        extra: PLATES[i % PLATES.length] + ' · 净重 ' + (33 + (i % 3)) + '.2 t'
      }));
    }
    for (i = 1; i <= 5; i++) {
      rows.push(makeTodo({
        id: 'TD-TM' + pad(i, 3),
        type: '时间节点缺失',
        title: '已完成任务缺少必填时间节点',
        bizType: '任务单',
        bizNo: taskCode(90 + i),
        priority: '中',
        role: 'stat',
        extra: ['装货离开时间', '卸货到达时间', '卸货离开时间', '装货到达时间', '卸货离开时间'][i - 1] + '为空'
      }));
    }
    [['001', '装货离开早于装货到达'], ['002', '人工净重与系统净重差 0.18 t'], ['003', '驾驶员信息与派单不一致']].forEach(function (row) {
      rows.push(makeTodo({
        id: 'TD-FX' + row[0],
        type: '数据修正',
        title: '任务数据待修正',
        bizType: '任务单',
        bizNo: taskCode(110 + Number(row[0])),
        priority: '中',
        role: 'stat',
        extra: row[1]
      }));
    });
    rows.push(makeTodo({ id: 'TD-FL001', type: '运力异常处理', title: '李宏俊驾驶证将于 7 日内到期', bizType: '司机', bizNo: 'DRV-李宏俊', priority: '高', role: 'fleet', extra: '到期日 2026-09-16' }));
    rows.push(makeTodo({ id: 'TD-FL002', type: '运力异常处理', title: '云A·G2288 行驶证已过期', bizType: '牵引车', bizNo: '云A·G2288', priority: '高', role: 'fleet', extra: '过期日 2026-09-01' }));
    rows.push(makeTodo({ id: 'TD-FL003', type: '运力异常处理', title: '维修车辆云A·K4419 仍被预派占用', bizType: '牵引车', bizNo: '云A·K4419', priority: '高', role: 'fleet', extra: '预派任务 YP-20260909-006' }));
    rows.push(makeTodo({ id: 'TD-FL004', type: '运力异常处理', title: '牵引车云A·J3058 无可用司机', bizType: '牵引车', bizNo: '云A·J3058', priority: '中', role: 'fleet' }));
    rows.push(makeTodo({ id: 'TD-SF001', type: '安全事件处理', title: '云A·D8021 超速持续 1 分钟，已转安全事件', bizType: '安全事件', bizNo: 'SE-20260909-001', priority: '高', role: 'safety', extra: '车速 96 km/h · 宁洱至景洪段' }));
    rows.push(makeTodo({ id: 'TD-SF002', type: '安全事件处理', title: '云A·F4470 执行中离线超过 60 分钟', bizType: '安全事件', bizNo: 'SE-20260909-002', priority: '高', role: 'safety', extra: '最后定位 景洪东风镇' }));
    rows.push(makeTodo({ id: 'TD-OP001', type: '重大运营异常跟进', title: '宁洱天恒→景洪水泥线今日异常率 28%，需管理层关注', bizType: '线路', bizNo: 'SR-宁洱-景洪', priority: '高', role: 'ops', extra: '今日完成 11 单，异常 3 单' }));
    return rows;
  }

  function seedAlerts() {
    var rows = [];
    function add(n, type, category, role, level, objectType, title, duration) {
      rows.push(makeAlert({
        id: 'AL-' + pad(rows.length + 1, 3),
        category: category,
        type: type,
        title: title,
        objectType: objectType,
        objectNo: objectType === '任务单' ? taskCode(n) : (objectType === '车辆' ? PLATES[n % PLATES.length] : DRIVERS[n % DRIVERS.length]),
        level: level,
        role: role,
        duration: duration
      }));
    }
    add(33, '派单后未发车', '运输', 'dispatch', '提醒', '任务单', '正式派单后超过 30 分钟未开始', '38 分钟');
    add(34, '派单后未发车', '运输', 'dispatch', '提醒', '任务单', '正式派单后超过 30 分钟未开始', '41 分钟');
    add(35, '派单后未发车', '运输', 'dispatch', '重要', '任务单', '正式派单后超过 60 分钟未开始', '73 分钟');
    add(42, '装货等待超时', '运输', 'dispatch', '提醒', '任务单', '装货等待超过 60 分钟', '68 分钟');
    add(43, '装货等待超时', '运输', 'dispatch', '提醒', '任务单', '装货等待超过 60 分钟', '71 分钟');
    add(44, '装货等待超时', '运输', 'dispatch', '重要', '任务单', '装货等待超过 120 分钟', '128 分钟');
    add(45, '装货等待超时', '运输', 'dispatch', '重要', '任务单', '装货等待超过 120 分钟', '136 分钟');
    add(46, '装货等待超时', '运输', 'dispatch', '严重', '任务单', '装货等待超过 180 分钟', '192 分钟');
    add(50, '卸货等待超时', '运输', 'dispatch', '提醒', '任务单', '卸货等待超过 60 分钟', '66 分钟');
    add(51, '卸货等待超时', '运输', 'dispatch', '重要', '任务单', '卸货等待超过 120 分钟', '124 分钟');
    add(52, '任务执行超时', '运输', 'dispatch', '提醒', '任务单', '超过预计完成时间 30 分钟', '36 分钟');
    add(53, '任务执行超时', '运输', 'dispatch', '提醒', '任务单', '超过预计完成时间 30 分钟', '42 分钟');
    add(54, '任务执行超时', '运输', 'dispatch', '重要', '任务单', '超过预计完成时间 60 分钟', '74 分钟');
    add(55, '任务执行超时', '运输', 'dispatch', '重要', '任务单', '超过预计完成时间 60 分钟', '81 分钟');
    add(91, '四时间节点缺失', '数据', 'stat', '重要', '任务单', '已完成任务缺少装货离开时间', '');
    add(92, '四时间节点缺失', '数据', 'stat', '重要', '任务单', '已完成任务缺少卸货到达时间', '');
    add(93, '四时间节点缺失', '数据', 'stat', '提醒', '任务单', '已完成任务缺少卸货离开时间', '');
    add(94, '四时间节点缺失', '数据', 'stat', '提醒', '任务单', '已完成任务缺少装货到达时间', '');
    add(95, '四时间节点缺失', '数据', 'stat', '提醒', '任务单', '已完成任务缺少卸货离开时间', '');
    add(111, '时间顺序异常', '数据', 'stat', '重要', '任务单', '装货离开早于装货到达', '');
    add(112, '时间顺序异常', '数据', 'stat', '重要', '任务单', '卸货到达早于装货离开', '');
    add(113, '毛皮净重异常', '数据', 'stat', '重要', '任务单', '毛重小于皮重', '');
    add(114, '毛皮净重异常', '数据', 'stat', '提醒', '任务单', '人工净重与系统净重差 0.18 t', '');
    add(115, '装卸重量差异常', '数据', 'stat', '重要', '任务单', '装卸净重差异率 5.6%', '');
    add(3, '执行车辆离线', '运力', 'fleet', '提醒', '车辆', '执行中车辆最后定位超过 15 分钟', '18 分钟');
    add(4, '执行车辆离线', '运力', 'fleet', '重要', '车辆', '执行中车辆最后定位超过 30 分钟', '36 分钟');
    add(5, '执行车辆离线', '运力', 'safety', '严重', '车辆', '执行中车辆最后定位超过 60 分钟', '71 分钟');
    add(0, '证件到期', '运力', 'fleet', '重要', '司机', '驾驶证将于 7 日内到期', '');
    add(1, '证件到期', '运力', 'fleet', '严重', '车辆', '行驶证已过期', '');
    add(2, '证件到期', '运力', 'fleet', '提醒', '司机', '从业资格证将于 30 日内到期', '');
    add(3, '证件到期', '运力', 'fleet', '提醒', '车辆', '保险将于 30 日内到期', '');
    add(0, '超速', '安全', 'safety', '严重', '车辆', '车速 96 km/h 持续超过 1 分钟', '1 分钟');
    add(2, '超速', '安全', 'safety', '重要', '车辆', '车速 92 km/h 持续超过 1 分钟', '2 分钟');
    add(0, 'SOC偏低', '运力', 'dispatch', '重要', '车辆', '执行中车辆 SOC 低于 30%，仅提示不禁派', '');
    add(5, 'SOC偏低', '运力', 'dispatch', '重要', '车辆', '执行中车辆 SOC 低于 20%，仅提示不禁派', '');
    rows.push(makeAlert({ id: 'AL-RT001', category: '经营', type: '线路异常', title: '宁洱天恒→景洪水泥今日异常率 28%', objectType: '线路', objectNo: 'SR-宁洱-景洪', level: '重要', role: 'ops', extra: '完成 11 / 异常 3' }));
    rows.push(makeAlert({ id: 'AL-CG001', category: '经营', type: '装卸点拥堵', title: '尖峰水泥厂装货点同时等待 4 车，平均等待 78 分钟', objectType: '电子围栏', objectNo: 'F-尖峰水泥厂', level: '重要', role: 'ops', extra: '已同步调度与运营' }));
    return rows;
  }

  function seedMessages() {
    return [
      makeMsg({ id: 'MG001', title: '任务已完成', content: taskCode(120) + ' 已完成，司机李宏俊。', time: TODAY + ' 13:22:18', read: false, bizNo: taskCode(120) }),
      makeMsg({ id: 'MG002', title: '司机上传磅单', content: '云A·D8021 上传卸货磅单 WB-20260909-001。', time: TODAY + ' 12:48:03', read: false, bizNo: 'WB-20260909-001' }),
      makeMsg({ id: 'MG003', title: '预派任务被修改', content: 'YP-20260909-003 预派司机由马旺调整为陈志远。', time: TODAY + ' 11:16:40', read: false, bizNo: 'YP-20260909-003' }),
      makeMsg({ id: 'MG004', title: '车辆恢复在线', content: '云A·H6612 已重新上线，离线告警自动恢复。', time: TODAY + ' 10:05:12', read: true, bizNo: '云A·H6612' }),
      makeMsg({ id: 'MG005', title: '任务已完成', content: taskCode(121) + ' 已完成，司机王磊。', time: TODAY + ' 09:41:55', read: true, bizNo: taskCode(121) }),
      makeMsg({ id: 'MG006', title: '司机上传磅单', content: '云A·E1936 上传装货磅单 WB-20260909-002。', time: TODAY + ' 09:12:08', read: true, bizNo: 'WB-20260909-002' }),
      makeMsg({ id: 'MG007', title: '正式派单成功', content: taskCode(36) + ' 已派 云A·F4470 / 马旺。', time: TODAY + ' 08:28:19', read: true, bizNo: taskCode(36) }),
      makeMsg({ id: 'MG008', title: '磅单审核通过', content: 'WB-20260908-018 审核通过，数据有效。', time: TODAY + ' 08:11:02', read: true, bizNo: 'WB-20260908-018' })
    ];
  }

  function seedBoard() {
    var executing = [];
    var i;
    for (i = 33; i <= 73; i++) {
      executing.push({
        no: taskCode(i),
        plate: PLATES[i % PLATES.length],
        driver: DRIVERS[i % DRIVERS.length],
        route: ROUTES[i % ROUTES.length],
        node: i % 3 === 0 ? '卸货' : (i % 3 === 1 ? '装货' : '行驶'),
        status: i <= 63 ? '待执行' : '待运输',
        eta: TODAY + ' ' + pad(14 + (i % 6), 2) + ':' + pad((i * 7) % 60, 2) + ':00',
        soc: String(18 + (i % 70)) + '%'
      });
    }
    var liveNodes = [];
    for (i = 0; i < 4; i++) liveNodes.push('装货');
    for (i = 0; i < 15; i++) liveNodes.push('行驶');
    for (i = 0; i < 5; i++) liveNodes.push('卸货');
    liveNodes.forEach(function (node, idx) {
      var n = 74 + idx;
      executing.push({
        no: taskCode(n),
        plate: PLATES[n % PLATES.length],
        driver: DRIVERS[n % DRIVERS.length],
        route: ROUTES[n % ROUTES.length],
        node: node,
        status: '运输中',
        eta: TODAY + ' ' + pad(14 + (n % 6), 2) + ':' + pad((n * 7) % 60, 2) + ':00',
        soc: String(18 + (n % 70)) + '%'
      });
    });
    var drivers = [];
    for (i = 0; i < 12; i++) {
      drivers.push({ name: DRIVERS[i % DRIVERS.length] + (i > 6 ? String(i - 5) : ''), phone: '1380871' + pad(20 + i, 4), status: '可用', cert: i === 8 ? '即将到期' : '有效' });
    }
    var vehicles = [];
    for (i = 0; i < 9; i++) {
      vehicles.push({ plate: PLATES[i % PLATES.length], trailer: '云A·挂' + pad(8021 + i, 4), status: '可用', soc: String(42 + i * 5) + '%', maintain: '正常' });
    }
    var trailers = [];
    for (i = 0; i < 7; i++) trailers.push({ no: '云A·挂' + pad(8021 + i, 4), status: '可用', bind: PLATES[i % PLATES.length] });
    var finished = [];
    for (i = 1; i <= 18; i++) {
      finished.push({
        no: taskCode(200 + i),
        plate: PLATES[i % PLATES.length],
        driver: DRIVERS[i % DRIVERS.length],
        route: ROUTES[i % ROUTES.length],
        finishAt: TODAY + ' ' + pad(6 + i, 2) + ':' + pad((i * 11) % 60, 2) + ':18',
        ton: 34
      });
    }
    var releasing = [
      { driver: '李宏俊', truck: '云A·D8021', task: taskCode(80), node: '卸货', eta: TODAY + ' 15:20:00', soc: '22%', preassign: '是', next: 'YP-20260909-001' },
      { driver: '王磊', truck: '云A·E1936', task: taskCode(81), node: '行驶', eta: TODAY + ' 15:48:00', soc: '41%', preassign: '是', next: 'YP-20260909-002' },
      { driver: '马旺', truck: '云A·F4470', task: taskCode(82), node: '装货', eta: TODAY + ' 16:10:00', soc: '63%', preassign: '否', next: '—' },
      { driver: '张建华', truck: '云A·G2288', task: taskCode(83), node: '卸货', eta: TODAY + ' 16:26:00', soc: '28%', preassign: '否', next: '—' },
      { driver: '陈志远', truck: '云A·H6612', task: taskCode(84), node: '行驶', eta: TODAY + ' 16:55:00', soc: '55%', preassign: '是', next: 'YP-20260909-004' },
      { driver: '赵明', truck: '云A·J3058', task: taskCode(85), node: '卸货', eta: TODAY + ' 17:12:00', soc: '19%', preassign: '否', next: '—' }
    ];
    return { executing: executing, drivers: drivers, vehicles: vehicles, trailers: trailers, finished: finished, releasing: releasing };
  }

  function defaultState() {
    return {
      ver: SEED_VER,
      updatedAt: TODAY + ' 14:26:08',
      todos: seedTodos(),
      alerts: seedAlerts(),
      messages: seedMessages(),
      logs: [],
      board: seedBoard(),
      dispatchDesk: { todoStatus: {}, alertStatus: {}, ignoreReason: {}, viewed: false }
    };
  }

  function loadState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.ver === SEED_VER && parsed.todos && parsed.alerts) {
          if (!parsed.board) parsed.board = seedBoard();
          return parsed;
        }
      }
    } catch (e) {}
    return defaultState();
  }
  function saveState() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch (e) {}
  }
  function addLog(obj, type, before, after, reason) {
    store.logs.unshift({
      object: obj,
      type: type,
      before: before || '',
      after: after || '',
      user: '李调度',
      time: nowStr(),
      reason: reason || ''
    });
    store.logs = store.logs.slice(0, 80);
  }

  function openTodos(role) {
    return store.todos.filter(function (t) {
      if (t.status === '已完成' || t.status === '已取消') return false;
      if (role && role !== 'all' && t.role !== role) {
        if (!(role === 'manager' && t.type === '重大运营异常跟进')) return false;
        if (role === 'manager') return true;
        if (role === 'ops' && t.type === '重大运营异常跟进') return true;
        return false;
      }
      return true;
    });
  }
  function alertVisibleTo(role, a) {
    if (!role || role === 'all') return true;
    if (a.role === role) return true;
    if (role === 'fleet' && a.type === '执行车辆离线') return true;
    if (role === 'safety' && (a.type === '执行车辆离线' || a.type === '超速')) return true;
    if (role === 'dispatch' && (a.type === '执行车辆离线' || a.type === 'SOC偏低')) return true;
    if (role === 'manager' && a.level === '严重') return true;
    if (role === 'ops' && a.category === '经营') return true;
    return false;
  }
  function openAlerts(role) {
    return store.alerts.filter(function (a) {
      if (a.status === '已关闭' || a.status === '已恢复') return false;
      return alertVisibleTo(role, a);
    });
  }
  function countBy(list, key, val) {
    return list.filter(function (x) { return x[key] === val; }).length;
  }
  function taskStats() {
    var stats = { pending: 32, execute: 31, wait: 10, running: 30, done: 102, all: 205 };
    if (typeof window.toGetRecords === 'function') {
      stats = { pending: 0, execute: 0, wait: 0, running: 0, done: 0, all: 0 };
      window.toGetRecords().forEach(function (r) {
        stats.all += 1;
        if (r.status === '待调度') stats.pending += 1;
        else if (r.status === '待执行') stats.execute += 1;
        else if (r.status === '待运输') stats.wait += 1;
        else if (r.status === '运输中') stats.running += 1;
        else if (r.status === '已完成') stats.done += 1;
      });
    }
    return stats;
  }
  function metrics() {
    var todos = openTodos('all');
    var alerts = openAlerts('all');
    var ts = taskStats();
    return {
      pendingTodos: todos.filter(function (t) { return t.status === '待处理'; }).length,
      doingTodos: todos.filter(function (t) { return t.status === '处理中'; }).length,
      severe: countBy(alerts, 'level', '严重'),
      important: countBy(alerts, 'level', '重要'),
      info: countBy(alerts, 'level', '提醒'),
      dispatchTodo: openTodos('dispatch').length,
      dispatchPending: ts.pending,
      inTransit: ts.running,
      todayTasks: ts.pending + ts.execute + ts.wait + ts.running + store.board.finished.length,
      preassign: countBy(openTodos('dispatch'), 'type', '预派待转正式'),
      unloadConfirm: countBy(openTodos('dispatch'), 'type', '未知卸货地待确认'),
      executing: ts.execute + ts.wait + ts.running,
      finishedToday: store.board.finished.length,
      drivers: store.board.drivers.length,
      vehicles: store.board.vehicles.length,
      trailers: store.board.trailers.length,
      weigh: countBy(openTodos('stat'), 'type', '待审核磅单'),
      timeMissing: countBy(openTodos('stat'), 'type', '时间节点缺失'),
      timeAbnormal: countBy(openAlerts('stat'), 'type', '时间顺序异常'),
      weightAbnormal: openAlerts('stat').filter(function (a) { return a.type === '毛皮净重异常' || a.type === '装卸重量差异常'; }).length,
      fixTodo: countBy(openTodos('stat'), 'type', '数据修正'),
      fleetTodo: openTodos('fleet').length,
      safetyTodo: openTodos('safety').length,
      safetyOpen: openTodos('safety').length,
      opsTodo: openTodos('ops').length,
      managerTodo: openTodos('manager').length,
      unread: store.messages.filter(function (m) { return !m.read; }).length,
      completeness: '82%'
    };
  }

  function breadcrumb(current, extra) {
    var html = '<div class="breadcrumb"><a href="javascript:void(0)" onclick="WB.go(\'workbench-home\')">工作台</a><span class="sep">/</span><span class="current">' + esc(current) + '</span>';
    if (extra) html += '<span class="sep">/</span><span class="current">' + esc(extra) + '</span>';
    return html + '</div>';
  }
  function pageHead(title, sub, actions) {
    var m = metrics();
    return '<div class="page-header"><div><div class="page-title">' + esc(title) + '</div>'
      + '<div class="wb-meta"><span>组织 <b>' + esc(ORG) + '</b></span><span>日期 <b>' + TODAY + '</b></span><span>数据更新时间 <b id="wbUpdatedAt">' + esc(store.updatedAt) + '</b></span>'
      + (sub ? '<span>' + sub + '</span>' : '') + '</div></div>'
      + '<div class="page-actions">' + (actions || '')
      + '<button class="btn btn-default" type="button" onclick="WB.refresh()">刷新</button></div></div>';
  }
  function kpiCard(label, value, unit, foot, cls, iconName, action, staticCard) {
    var tag = staticCard ? 'div' : 'button';
    var extra = staticCard ? ' is-static' : '';
    var click = staticCard ? '' : ' onclick="' + action + '"';
    return '<' + tag + ' class="kpi-card ' + cls + extra + '" type="button"' + click + '>'
      + '<div class="kpi-top"><span class="kpi-label">' + esc(label) + '</span>' + icon(iconName) + '</div>'
      + '<div class="kpi-value">' + esc(String(value)) + (unit ? '<span class="unit">' + esc(unit) + '</span>' : '') + '</div>'
      + (foot ? '<div class="kpi-foot">' + foot + '</div>' : '')
      + '</' + tag + '>';
  }

  function panelTable(title, allAction, heads, bodyRows, emptyText) {
    return '<section class="table-section"><div class="table-toolbar"><div class="left"><span class="detail-section-title">' + esc(title) + '</span></div>'
      + '<div class="right">' + (allAction || '') + '</div></div>'
      + '<div class="table-wrap"><table class="data-table"><thead><tr>' + heads.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>'
      + (bodyRows || '<tr><td colspan="' + heads.length + '"><div class="empty-state"><b>' + esc(emptyText || '暂无数据') + '</b></div></td></tr>')
      + '</tbody></table></div></section>';
  }

  function todoRows(list, limit) {
    var rows = list.slice().sort(function (a, b) {
      var pw = { '高': 0, '中': 1, '低': 2 };
      if (pw[a.priority] !== pw[b.priority]) return pw[a.priority] - pw[b.priority];
      return a.createdAt < b.createdAt ? 1 : -1;
    });
    if (limit) rows = rows.slice(0, limit);
    if (!rows.length) return '';
    return rows.map(function (t) {
      return '<tr><td>' + priBadge(t.priority) + '</td><td><button class="btn btn-text" type="button" onclick="WB.detail(\'todo\',\'' + t.id + '\')">' + esc(t.title) + '</button></td>'
        + '<td class="col-mono">' + esc(t.bizNo) + '</td><td>' + statusBadge(t.status) + '</td>'
        + '<td class="row-actions">' + linkBtn('立即处理', 'WB.handle(\'' + t.id + '\')') + '</td></tr>';
    }).join('');
  }
  function alertRows(list, limit) {
    var order = { '严重': 0, '重要': 1, '提醒': 2 };
    var rows = list.slice().sort(function (a, b) { return order[a.level] - order[b.level]; });
    if (limit) rows = rows.slice(0, limit);
    if (!rows.length) return '';
    return rows.map(function (a) {
      return '<tr><td>' + levelBadge(a.level) + '</td><td><button class="btn btn-text" type="button" onclick="WB.detail(\'alert\',\'' + a.id + '\')">' + esc(a.title) + '</button></td>'
        + '<td class="col-mono">' + esc(a.objectNo) + '</td><td>' + esc(a.duration || '—') + '</td>'
        + '<td class="row-actions">' + linkBtn('去处理', 'WB.handleAlert(\'' + a.id + '\')') + '</td></tr>';
    }).join('');
  }

  function shortcut(label, sub, page) {
    return '<button class="wb-shortcut" type="button" onclick="WB.go(\'' + page + '\')"><b>' + esc(label) + '</b><span>' + esc(sub) + '</span></button>';
  }
  function shortcutNav(label, sub, page) {
    return '<button class="wb-shortcut" type="button" onclick="WB.jump(\'' + page + '\')"><b>' + esc(label) + '</b><span>' + esc(sub) + '</span></button>';
  }
  function shortcutAction(label, sub, action) {
    return '<button class="wb-shortcut" type="button" onclick="' + action + '"><b>' + esc(label) + '</b><span>' + esc(sub) + '</span></button>';
  }

  function splitTodoAlert(role, todoTitle, alertTitle) {
    var todos = openTodos(role);
    var alerts = openAlerts(role);
    var m = metrics();
    return '<div class="wb-split">'
      + panelTable(todoTitle, '<button class="toolbar-btn" type="button" onclick="WB.openTodos(\'' + role + '\')">查看全部</button>',
        ['优先级', '待办标题', '业务单号', '状态', '操作'], todoRows(todos, 6), '当前没有待办')
      + panelTable(alertTitle, '<button class="toolbar-btn" type="button" onclick="WB.openAlerts(\'' + role + '\')">查看全部</button>',
        ['等级', '告警标题', '对象', '持续', '操作'], alertRows(alerts, 6), '当前没有未恢复告警')
      + '</div>'
      + (role === 'all' ? '<p class="wb-muted" style="margin:-8px 0 16px;">待处理 ' + m.pendingTodos + ' · 处理中 ' + m.doingTodos + '　｜　严重 ' + m.severe + ' · 重要 ' + m.important + ' · 提醒 ' + m.info + '</p>' : '');
  }

  function highestPri(items) {
    if (items.some(function (t) { return t.priority === '高'; })) return '高';
    if (items.some(function (t) { return t.priority === '中'; })) return '中';
    return items.length ? '低' : '';
  }
  function highestLevel(items) {
    if (items.some(function (a) { return a.level === '严重'; })) return '严重';
    if (items.some(function (a) { return a.level === '重要'; })) return '重要';
    if (items.some(function (a) { return a.level === '提醒'; })) return '提醒';
    return '';
  }
  function socCell(soc) {
    var n = parseInt(soc, 10);
    if (n < 15) return badge(soc, 'badge-error');
    if (n < 30) return badge(soc, 'badge-warning');
    return esc(soc);
  }
  function releasingAction(r) {
    if (r.next && r.next !== '—') {
      var todo = store.todos.filter(function (t) {
        return t.type === '预派待转正式' && t.bizNo === r.next && t.status !== '已完成' && t.status !== '已取消';
      })[0];
      if (todo) return linkBtn('转正式', 'WB.handle(\'' + todo.id + '\')');
      return linkBtn('查看预派', 'WB.openTodos(\'dispatch\',\'预派待转正式\')');
    }
    return linkBtn('安排下一任务', 'WB.jumpTaskTab(\'dispatch\')');
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dcSitePos(name) { return DC_SITES[name] || SITE_POS[name] || [102.72, 24.88]; }
  function dcAlong(a, b, t) {
    var pa = dcSitePos(a);
    var pb = dcSitePos(b);
    return [lerp(pa[0], pb[0], t), lerp(pa[1], pb[1], t)];
  }
  function dcSpreadPoint(a, b, t, seed, span) {
    var pa = dcSitePos(a);
    var pb = dcSitePos(b);
    var base = dcAlong(a, b, t);
    var dx = pb[0] - pa[0];
    var dy = pb[1] - pa[1];
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var lanePattern = [-0.64, 0.42, 0.78, -0.36, 1, -1, 0.2, -0.82, 0.62, -0.16];
    var forwardPattern = [-0.7, 0.35, -0.2, 0.75, -0.45, 0.15, 0.55, -0.65, 0.25, 0];
    var index = Math.abs(Number(seed) || 0);
    var lateral = lanePattern[index % lanePattern.length] * (span || 0.14);
    var forward = forwardPattern[index % forwardPattern.length] * 0.024;
    return [
      base[0] + (-dy / len) * lateral + (dx / len) * forward,
      base[1] + (dx / len) * lateral + (dy / len) * forward
    ];
  }
  function vmRoutePath(from, to, seed) {
    var start = dcSitePos(from);
    var end = dcSitePos(to);
    var dx = end[0] - start[0];
    var dy = end[1] - start[1];
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var normalX = -dy / len;
    var normalY = dx / len;
    var routeSeed = Math.abs(Number(seed) || 0);
    var direction = routeSeed % 2 ? 1 : -1;
    var amplitude = Math.min(.035, Math.max(.014, len * .12));
    var points = [];
    for (var i = 0; i <= 10; i++) {
      var t = i / 10;
      var curve = Math.sin(Math.PI * t) * amplitude * direction
        + Math.sin(Math.PI * 2 * t) * amplitude * .28;
      points.push([
        lerp(start[0], end[0], t) + normalX * curve,
        lerp(start[1], end[1], t) + normalY * curve
      ]);
    }
    return points;
  }
  function vmRoutePoint(path, progress) {
    if (!path || !path.length) return null;
    var p = Math.max(0, Math.min(1, Number(progress) || 0));
    var scaled = p * (path.length - 1);
    var index = Math.min(path.length - 2, Math.floor(scaled));
    var part = scaled - index;
    return [
      lerp(path[index][0], path[index + 1][0], part),
      lerp(path[index][1], path[index + 1][1], part)
    ];
  }
  function dispatchVehicles() {
    var rows = [
      { plate: '云A12345', driver: '张三', phone: '13808718888', task: 'Y20260904000018', route: '昆钢 → 北城', node: '行驶', status: '运输中', soc: '62%', eta: TODAY + ' 15:32:00', kind: 'run', dist: '42', from: '昆钢', to: '北城', t: 0.48 },
      { plate: '云A·D8021', driver: '李宏俊', phone: '13808710021', task: 'Y20260904000021', route: '昆钢 → 研和', node: '行驶', status: '运输中', soc: '71%', eta: TODAY + ' 16:10:00', kind: 'run', dist: '36', from: '昆钢', to: '研和', t: 0.38 },
      { plate: '云A·E1936', driver: '王磊', phone: '13808710022', task: 'Y20260904000022', route: '大开门 → 研和', node: '卸货', status: '停滞', soc: '54%', eta: TODAY + ' 15:48:00', kind: 'stop', dist: '6', from: '大开门', to: '研和', t: 0.86 },
      { plate: '云A·F4470', driver: '马旺', phone: '13808710023', task: 'Y20260904000023', route: '昆钢 → 北城', node: '行驶', status: '异常', soc: '48%', eta: TODAY + ' 16:02:00', kind: 'abnormal', dist: '23', from: '昆钢', to: '北城', t: 0.22 },
      { plate: '云A·G2288', driver: '张建华', phone: '13808710024', task: 'Y20260904000024', route: '大开门 → 北城', node: '充电', status: '充电中', soc: '28%', eta: TODAY + ' 16:40:00', kind: 'charge', dist: '51', from: '大开门', to: '北城', t: 0.31 },
      { plate: '云A·H6612', driver: '陈志远', phone: '13808710025', task: 'Y20260904000025', route: '昆钢 → 研和', node: '行驶', status: '离线', soc: '41%', eta: TODAY + ' 17:05:00', kind: 'offline', dist: '44', from: '昆钢', to: '研和', t: 0.58 },
      { plate: '云A·J3058', driver: '刘副驾', phone: '13808710026', task: 'Y20260904000026', route: '大开门 → 研和', node: '行驶', status: '运输中', soc: '66%', eta: TODAY + ' 15:55:00', kind: 'run', dist: '19', from: '大开门', to: '研和', t: 0.44 },
      { plate: '云A·K4419', driver: '赵明', phone: '13808710027', task: 'Y20260904000027', route: '昆钢 → 北城', node: '装货', status: '停滞', soc: '88%', eta: TODAY + ' 14:50:00', kind: 'stop', dist: '58', from: '昆钢', to: '北城', t: 0.1 },
      { plate: '云A·L7720', driver: '周强', phone: '13808710028', task: 'Y20260904000028', route: '大开门 → 北城', node: '行驶', status: '运输中', soc: '59%', eta: TODAY + ' 16:22:00', kind: 'run', dist: '33', from: '大开门', to: '北城', t: 0.62 },
      { plate: '云A·M1188', driver: '吴磊', phone: '13808710029', task: 'Y20260904000029', route: '昆钢 → 研和', node: '充电', status: '充电中', soc: '22%', eta: TODAY + ' 16:50:00', kind: 'charge', dist: '40', from: '昆钢', to: '研和', t: 0.72 },
      { plate: '云A·N3341', driver: '郑浩', phone: '13808710030', task: 'Y20260904000030', route: '大开门 → 研和', node: '行驶', status: '运输中', soc: '77%', eta: TODAY + ' 15:40:00', kind: 'run', dist: '14', from: '大开门', to: '研和', t: 0.28 },
      { plate: '云A·P5526', driver: '孙伟', phone: '13808710031', task: 'Y20260904000031', route: '昆钢 → 北城', node: '行驶', status: '运输中', soc: '63%', eta: TODAY + ' 15:28:00', kind: 'run', dist: '29', from: '昆钢', to: '北城', t: 0.71 }
    ];
    return rows.map(function (r) {
      var p = dcAlong(r.from, r.to, r.t);
      r.lng = p[0];
      r.lat = p[1];
      return r;
    });
  }
  function filteredDispatchVehicles() {
    return dispatchVehicles().filter(function (v) {
      if (mapFilter.q) {
        var q = mapFilter.q;
        var siteHit = Object.keys(DC_SITES).some(function (name) { return name.indexOf(q) >= 0; });
        if (!siteHit && (v.plate + v.driver + v.task + v.route).indexOf(q) < 0) return false;
      }
      if (mapFilter.vehicle === 'run' && v.kind !== 'run') return false;
      if (mapFilter.vehicle === 'stop' && v.kind !== 'stop') return false;
      if (mapFilter.vehicle === 'charge' && v.kind !== 'charge') return false;
      if (mapFilter.vehicle === 'abnormal' && v.kind !== 'abnormal' && v.kind !== 'offline') return false;
      if (mapFilter.status === 'run' && v.kind !== 'run') return false;
      if (mapFilter.status === 'stop' && v.kind !== 'stop') return false;
      if (mapFilter.status === 'abnormal' && v.kind !== 'abnormal' && v.kind !== 'offline') return false;
      if (mapFilter.route !== 'all' && v.route !== mapFilter.route) return false;
      return true;
    });
  }
  function vmMeta(st) { return VM_ST[st] || VM_ST.run; }
  function vmOrgCurrent() {
    return VM_ORG_TREE.filter(function (node) { return node.id === vmState.org; })[0] || VM_ORG_TREE[2];
  }
  function vmVehicleInScope(vehicle) {
    if (!vehicle) return false;
    if (vmState.project !== 'all' && vehicle.projectId !== vmState.project) return false;
    if (vmState.fleet !== 'all' && vehicle.fleet !== vmState.fleet) return false;
    return true;
  }
  function vmOrgTreeHtml() {
    var current = vmOrgCurrent();
    return '<div class="vm-org-switcher">'
      + '<button class="vm-org-trigger" type="button" aria-haspopup="tree" aria-expanded="' + vmState.orgOpen + '" onclick="WB.vmToggleOrg(event)">'
      + '<i class="vm-org-icon">' + dcSvg('<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6M8 10h.01M12 10h.01M16 10h.01"/>') + '</i>'
      + '<span><b id="vmOrgName">' + esc(current.short) + '</b><small id="vmOrgPath">' + esc(current.path) + '</small></span>'
      + '<i class="vm-org-caret"></i></button>'
      + '<div class="vm-org-panel" id="vmOrgPanel" role="tree"' + (vmState.orgOpen ? '' : ' hidden') + ' onclick="event.stopPropagation()">'
      + '<header><div><b>组织与部门</b><span>选择后全屏数据同步更新</span></div><em>今日任务</em></header>'
      + VM_ORG_TREE.map(function (node) {
        var branch = node.level < 3 ? '<i class="vm-tree-branch">' + dcSvg('<path d="m9 18 6-6-6-6"/>') + '</i>' : '<i class="vm-tree-dot"></i>';
        var caption = node.level === 0 ? '含下级全部部门' : node.level === 1 ? '运营中心' : node.level === 2 ? '事业部汇总' : '车队执行数据';
        return '<button type="button" role="treeitem" aria-selected="' + (node.id === current.id) + '" class="vm-org-node level-' + node.level + (node.id === current.id ? ' is-on' : '') + '" data-org-id="' + node.id + '" onclick="WB.vmSelectOrg(\'' + node.id + '\')">'
          + branch + '<span><b>' + esc(node.name) + '</b><small>' + esc(caption) + '</small></span><em>' + node.count + '</em>'
          + dcSvg('<path d="m5 12 4 4L19 6"/>') + '</button>';
      }).join('')
      + '<footer>当前数据范围：<b id="vmOrgFooter">' + esc(current.path) + '</b></footer></div></div>';
  }
  function vmScopedTasks() {
    return vmTasks().filter(function (task) {
      if (vmState.project !== 'all' && task.projectId !== vmState.project) return false;
      if (vmState.fleet !== 'all' && task.fleet !== vmState.fleet) return false;
      if (vmState.taskRoute !== 'all' && task.route !== vmState.taskRoute) return false;
      return true;
    });
  }
  function vmOpsSummary() {
    var tasks = vmScopedTasks();
    return {
      tasks: tasks,
      pendingDispatch: tasks.filter(function (task) { return task.businessStatus === 'pending_dispatch'; }).length,
      pendingExecute: tasks.filter(function (task) { return task.businessStatus === 'pending_execute'; }).length,
      pendingTransport: tasks.filter(function (task) { return task.businessStatus === 'pending_transport'; }).length,
      transporting: tasks.filter(function (task) { return task.businessStatus === 'transporting'; }).length,
      completed: tasks.filter(function (task) { return task.businessStatus === 'completed'; }).length,
      executing: tasks.filter(function (task) { return task.businessStatus === 'transporting'; }).length,
      done: tasks.filter(function (task) { return task.businessStatus === 'completed'; }).length,
      waiting: tasks.filter(function (task) { return ['pending_dispatch', 'pending_execute', 'pending_transport'].indexOf(task.businessStatus) >= 0; }).length,
      driving: tasks.filter(function (task) { return task.node === 'run'; }).length,
      operation: tasks.filter(function (task) { return task.node === 'load' || task.node === 'unload'; }).length
    };
  }
  function vmKpi() {
    var summary = vmOpsSummary();
    var dailyCore = vmOpsDailyCore();
    var vehicleCounts = vmVehicleCounts();
    var scopeRatio = vmState.fleet === 'A车队' ? .52 : vmState.fleet === 'B车队' ? .48 : 1;
    var routeMileage = {
      '昆钢 → 北城': { transport: 1186, empty: 112 },
      '昆钢 → 研和': { transport: 846, empty: 104 },
      '大开门 → 研和': { transport: 694, empty: 102 },
      '大开门 → 北城': { transport: 665, empty: 180 }
    };
    var selectedMileage = routeMileage[vmState.taskRoute];
    var transportMileage = selectedMileage
      ? Math.round(selectedMileage.transport * scopeRatio)
      : Math.round(3391 * scopeRatio);
    var emptyMileage = selectedMileage
      ? Math.round(selectedMileage.empty * scopeRatio)
      : Math.round(498 * scopeRatio);
    var fleetAssets = vmFleetAssetCounts();
    var taskVehicles = vehicleCounts.has_task;
    var averageVehicleMileage = Math.round((transportMileage + emptyMileage) / Math.max(1, taskVehicles));
    return [
      { group: 'vehicle', groupName: '车辆态势', name: '任务车辆', value: taskVehicles + ' 辆', meta: '当前有运输任务', tint: 'operating', icon: 'operating', desc: '当前有运输任务的车辆数' },
      { group: 'vehicle', groupName: '车辆态势', name: '无任务车辆', value: vehicleCounts.no_task + ' 辆', meta: '可关注闲置风险', tint: 'no-task', icon: 'noTask', desc: '当前没有运输任务且不在待运输状态的车辆数' },
      { group: 'result', groupName: '经营结果', name: '今日完成货量', value: Math.round(dailyCore.cargo).toLocaleString() + ' t', meta: summary.completed + ' 个任务单已完成', tint: 'cargo', icon: 'cargo', desc: '今日已复审通过的卸货净重合计，完成任务单作为辅助信息' },
      { group: 'result', groupName: '经营结果', name: '平均运输时长', value: (dailyCore.averageDuration / 60).toFixed(1) + ' h', meta: '装货离场至卸货离场', tint: 'duration', icon: 'duration', desc: '已完成任务从装货离场到卸货离场的平均时长' },
      { group: 'result', groupName: '经营结果', name: '今日运输里程', value: transportMileage.toLocaleString() + ' km', meta: '载货行驶', tint: 'mileage', icon: 'mileage', desc: '今日载货运输里程' },
      { group: 'result', groupName: '经营结果', name: '今日空驶里程', value: emptyMileage.toLocaleString() + ' km', meta: '无货行驶', tint: 'empty-mileage', icon: 'emptyMileage', desc: '今日空驶里程' },
      { group: 'result', groupName: '经营结果', name: '单车平均里程', value: averageVehicleMileage + ' km', meta: '按 ' + taskVehicles + ' 辆任务车辆', tint: 'average', icon: 'average', desc: '今日运输里程与空驶里程合计除以当前范围内的任务车辆数' },
      { group: 'vehicle', groupName: '车辆态势', name: '牵引车 / 挂车', pair: [{ label: '牵引车', value: fleetAssets.tractors }, { label: '挂车', value: fleetAssets.trailers }], meta: vmOrgCurrent().short, tint: 'fleet', icon: 'fleet', desc: '当前组织与线路范围内的牵引车数量与挂车数量' }
    ];
  }
  function vmKpiIcon(kind) {
    var paths = {
      task: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>',
      executing: '<path d="M3 7h11v10H3zM14 11h5l2 3v3h-7"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
      waiting: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      done: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
      rate: '<path d="M12 3a9 9 0 1 1-9 9"/><path d="M12 3v9h9"/>',
      cargo: '<path d="M4 8 12 4l8 4-8 4-8-4Z"/><path d="m4 12 8 4 8-4M4 16l8 4 8-4"/>',
      duration: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      mileage: '<path d="M4 17a8 8 0 0 1 16 0"/><path d="m12 17 4-5"/><path d="M7 17h10"/>',
      emptyMileage: '<path d="M4 17a8 8 0 0 1 16 0"/><path d="m12 17 2-6"/><path d="M7 17h10"/>',
      average: '<path d="M4 19h16M6 15l3-4 3 2 5-7"/><circle cx="17" cy="6" r="2"/>',
      fleet: '<path d="M3 13h18M5 13l2-5h10l2 5M6 13v4M18 13v4"/><circle cx="8" cy="18" r="2"/><circle cx="16" cy="18" r="2"/>',
      operating: '<path d="M3 7h11v10H3zM14 11h5l2 3v3h-7"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
      noTask: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
      driving: '<path d="M3 12h18M5 12l2-5h10l2 5M6 12v5M18 12v5"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/>',
      operation: '<path d="M4 20V9l8-5 8 5v11M8 20v-7h8v7M8 16h8"/>'
    };
    return dcSvg(paths[kind] || paths.task);
  }
  function vmTruckSvg() {
    return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.2 8h10.4v8.4H3.2z"/><path d="M13.6 11.2h4.3L20.6 14v2.4h-7V11.2z"/><circle cx="7.1" cy="17.2" r="1.55"/><circle cx="17.2" cy="17.2" r="1.55"/></svg>';
  }
  function vmMaskPhone(phone) {
    var s = String(phone || '');
    return s.length >= 11 ? s.slice(0, 3) + '****' + s.slice(-4) : s;
  }
  function vmRouteDirection(from, to) {
    if (!from || !to) return '—';
    return (from === '北城' || from === '研和') ? '下行' : '上行';
  }
  function vmMake(st, plate, i) {
    var routes = [['昆钢', '北城'], ['大开门', '研和'], ['昆钢', '研和'], ['大开门', '北城']];
    var pair = routes[i % routes.length];
    var drivers = ['李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑一', '冯二', '陈三'];
    var soc = st === 'charge' ? 18 + (i % 8) * 9 : (st === 'unload' ? 28 + (i % 5) * 6 : 52 + (i % 9) * 4);
    if (soc > 96) soc = 96;
    var hh = 13 - (i % 6);
    var mm = pad((12 + i * 7) % 60, 2);
    var loc = st === 'load' ? pair[0] + ' · 装货区'
      : st === 'unload' ? pair[1] + ' · 卸货区'
      : st === 'charge' ? pair[0] + ' · 充电站'
      : st === 'idle' ? '玉溪 · 停车场'
      : st === 'offline' ? '—'
      : pair[0] + ' → ' + pair[1];
    return {
      plate: plate,
      trailer: '云A·挂' + pad(8011 + (i % 80), 4),
      st: st,
      driver: drivers[i % drivers.length],
      phone: '1380871' + pad(200 + i, 4),
      vin: 'LZW' + pad(2000000000000 + i, 13).slice(-13),
      team: '云南车队',
      projectId: 'yx',
      project: '玉溪新能源运输项目',
      fleet: i % 2 ? 'B车队' : 'A车队',
      model: '重卡 · 换电',
      route: pair[0] + ' → ' + pair[1],
      loc: loc,
      soc: soc,
      range: Math.round(soc * 4.61),
      speed: st === 'run' ? 48 + (i % 28) : 0,
      realtimeMileage: Number((68240 + i * 137.6).toFixed(1)),
      todayMileage: 86 + (i % 47) + (i % 3) * 12,
      averageEnergyConsumption: Number((124.6 + (i % 9) * 3.2).toFixed(1)),
      vehicleWeight: Number((18.2 + (i % 9) * 1.6 + (st === 'run' || st === 'load' || st === 'unload' ? 28 : 0)).toFixed(1)),
      time: st === 'offline' ? '昨天 18:' + mm : '今天 ' + pad(hh, 2) + ':' + mm,
      from: pair[0],
      to: pair[1],
      fromLabel: pair[0] + '（装货地）',
      toLabel: pair[1] + '（卸货地）',
      departWait: st === 'run' ? '已发车 ' + (2 + i % 4) + 'h ' + (10 + i % 40) + 'min' : (st === 'load' ? '已等待 ' + (20 + i % 40) + ' min' : '—'),
      departTime: '今天 ' + pad(Math.max(6, hh - 3), 2) + ':' + mm,
      eta: pad(hh + 2, 2) + ':' + mm,
      remain: st === 'run' ? 12 + (i % 40) : 0,
      addr: st === 'offline' ? '最后定位已超时' : '云南省玉溪市红塔区 G8511 昆磨高速',
      updated: TODAY + ' ' + pad(hh, 2) + ':' + mm + ':00',
      t: 0.16 + (i % 8) * 0.09,
      cargo: ['煤炭', '水泥', '水渣', '矿石'][i % 4],
      customer: ['云南绿色钢城物流', '玉溪恒运供应链', '云岭新材'][i % 3],
      weight: (30 + i % 5) + 't',
      todayTrips: 1 + (i % 4),
      todayDrive: (3 + i % 5) + 'h ' + pad(8 + i % 43, 2) + 'min',
      preassign: (st === 'idle' || st === 'offline') ? '暂无预派' : (i % 3 === 0 ? '已预派下一任务' : '暂无预派'),
      chargeStart: '今天 ' + pad(Math.max(6, hh - 1), 2) + ':' + mm,
      chargeDelta: '+' + (18 + i % 26) + '%',
      task: 'Y20260904000' + pad(40 + i, 3),
      waybill: 'YD20260904' + pad(118 + i, 6),
      direction: vmRouteDirection(pair[0], pair[1])
    };
  }
  function monitorVehicles() {
    if (VM_CACHE) return VM_CACHE;
    var named = [
      vmMake('run', '云A12345', 0),
      vmMake('unload', '云A·F4470', 1),
      vmMake('run', '云A·E1936', 2),
      vmMake('unload', '云A·D8021', 3),
      vmMake('idle', '云A66666', 4),
      vmMake('offline', '云B67890', 5),
      vmMake('run', '云A·K4419', 6)
    ];
    named[0] = Object.assign(named[0], {
      driver: '张三', phone: '13808711234', vin: 'LZW1234567890123', soc: 62, range: 286, speed: 68,
      trailer: '云A·挂8011', realtimeMileage: 68426.8, todayMileage: 128, averageEnergyConsumption: 136.4, vehicleWeight: 49.6, waybill: 'YD20260904000118', direction: '上行',
      loc: '昆钢 → 北城', route: '昆钢 → 北城', time: '今天 13:12', from: '昆钢', to: '北城',
      fromLabel: '昆钢（装货地）', toLabel: '北城（卸货地）',
      departWait: '已发车 3h 26min', departTime: '今天 09:46', eta: '15:32', remain: 42,
      addr: '云南省玉溪市红塔区 G8511 昆磨高速', updated: TODAY + ' 13:28:36',
      t: 0.48, cargo: '煤炭', weight: '32t', task: 'Y20260904000018', team: '云南车队', model: '重卡 · 换电',
      nextTask: '北城 → 昆钢 · 水渣'
    });
    named[1] = Object.assign(named[1], {
      driver: '马旺', phone: '13808710201', vin: 'LZW2000000000001', trailer: '云A·挂8023',
      loc: '北城 · 卸货区', route: '昆钢 → 北城', fleet: 'B车队', customer: '玉溪恒运供应链',
      cargo: '煤炭', weight: '34.0 t', expectedWeight: '34.0 t', waybill: 'YD202609130092',
      soc: 63, range: 290, time: '今天 12:19', speed: 0, from: '昆钢', to: '北城', eta: '14:26', remain: 2, t: 0.92,
      updated: TODAY + ' 12:19:00', task: 'RW202609130092', scene: '预计 11 min 释放'
    });
    named[2] = Object.assign(named[2], { driver: '王磊', trailer: '云A·挂8022', loc: '北城 → 研和', route: '北城 → 研和', soc: 41, range: 189, time: '今天 14:12', speed: 54, from: '北城', to: '研和', eta: '15:48', remain: 36, t: 0.52, scene: '已预派下一任务', direction: '下行' });
    named[3] = Object.assign(named[3], { driver: '李宏俊', trailer: '云A·挂8021', loc: '研和 · 卸货区', route: '昆钢 → 研和', soc: 22, range: 101, time: '今天 14:08', speed: 0, from: '昆钢', to: '研和', eta: '15:20', remain: 4, t: 0.9, scene: '已预派下一任务' });
    named[4] = Object.assign(named[4], { loc: '玉溪 · 停车场', soc: 92, time: '今天 11:05', speed: 0, from: '大开门', to: '研和', preassign: '暂无预派' });
    named[5] = Object.assign(named[5], {
      loc: '研和服务区北侧', addr: '云南省玉溪市红塔区昆磨高速研和服务区北侧',
      soc: 41, time: '昨天 18:22', updated: '2026-09-08 18:22:16', speed: 0, from: '昆钢', to: '研和'
    });
    named[6] = Object.assign(named[6], {
      driver: '赵明', phone: '13808710027', vin: 'LZW4419000000027', soc: 58, range: 248, speed: 72,
      loc: '昆钢 → 北城', route: '昆钢 → 北城', time: '今天 14:30', from: '昆钢', to: '北城',
      fromLabel: '昆钢（装货地）', toLabel: '北城（卸货地）',
      departWait: '已连续驾驶 4h12min', departTime: '今天 10:18', eta: '16:05', remain: 58,
      addr: '云南省玉溪市红塔区 G8511 昆磨高速', updated: TODAY + ' 14:30:12',
      t: 0.36, cargo: '水泥', weight: '34t', task: 'Y20260904000027', team: '云南车队', model: '重卡 · 换电',
      scene: '连续驾驶已满 4 小时，须休息'
    });
    var need = { run: 34, load: 6, unload: 3, idle: 12, offline: 1 };
    var extra = [];
    var n = 10101;
    var used = { '云A12345': 1, '云A56789': 1, '云A88888': 1, '云A66666': 1, '云A99999': 1, '云B67890': 1, '云A·K4419': 1 };
    Object.keys(need).forEach(function (st) {
      for (var i = 0; i < need[st]; i++) {
        while (used['云A' + n]) n++;
        extra.push(vmMake(st, '云A' + n, extra.length + 7));
        used['云A' + n] = 1;
        n++;
      }
    });
    VM_CACHE = named.concat(extra).map(function (r, i) {
      r.runtimeStatus = r.st === 'offline' ? 'offline'
        : r.st === 'idle' && i % 4 === 0 ? 'charging'
        : r.st === 'run' && i !== 0 && i % 7 === 0 ? 'parked'
        : r.st === 'run' ? 'driving'
        : 'parked';
      if (r.runtimeStatus === 'parked') r.speed = 0;
      if (r.runtimeStatus === 'charging') {
        r.speed = 0;
        r.loc = r.from + ' · 充电站';
        r.addr = r.from + '充电站';
      }
      var p = dcSpreadPoint(r.from, r.to, r.t, i, r.st === 'run' ? 0.17 : 0.08);
      r.lng = p[0];
      r.lat = p[1];
      if (r.st === 'load') { var a = dcSitePos(r.from); r.lng = a[0] + 0.008; r.lat = a[1] - 0.006; }
      if (r.st === 'unload') { var b = dcSitePos(r.to); r.lng = b[0] - 0.008; r.lat = b[1] + 0.006; }
      if (r.runtimeStatus === 'charging') { var c = dcSitePos(r.from); r.lng = c[0] + 0.018; r.lat = c[1] - 0.014; }
      if (r.st === 'idle') { var d = dcSitePos(r.from); r.lng = d[0] - 0.02; r.lat = d[1] - 0.02; }
      if (r.st === 'offline') { var e = dcSitePos(r.from); r.lng = e[0] + 0.045; r.lat = e[1] + 0.03; }
      return r;
    });
    return VM_CACHE;
  }
  function vmTasks() {
    if (VM_TASK_CACHE) return VM_TASK_CACHE;
    var vehicles = monitorVehicles();
    var tasks = [];
    var goods = ['煤炭', '水泥', '水渣', '矿石'];
    function addTask(i, businessStatus, node, vehicle) {
      var status = businessStatus === 'transporting' ? 'executing' : businessStatus === 'completed' ? 'done' : 'waiting';
      var assigned = businessStatus !== 'pending_dispatch';
      var pair = DC_LINES[i % DC_LINES.length];
      if (i === 0) pair = DC_LINES[0];
      var progress = i === 0 ? 0.48 : (node === 'load' ? 0.04 : (node === 'unload' || status === 'done' ? 0.94 : 0.22 + (i % 7) * 0.09));
      var spread = node === 'run' ? 0.18
        : ((node === 'load' || node === 'unload' || status === 'done') ? 0.04 : 0.14);
      var pos = dcSpreadPoint(pair[0], pair[1], progress, i, spread);
      var minute = pad((18 + i * 7) % 60, 2);
      var nodeLabel = businessStatus === 'pending_dispatch' ? '待派车'
        : businessStatus === 'pending_execute' ? '待执行'
        : businessStatus === 'pending_transport' ? '待运输'
        : node === 'run' ? '运输中' : node === 'load' ? '装货中' : node === 'unload' ? '卸货中' : '已完成';
      var nodeText = node === 'run' ? ('已行驶 ' + (18 + i % 46) + ' km')
        : node === 'load' ? ('进入' + pair[0] + '装货区')
        : node === 'unload' ? ('进入' + pair[1] + '卸货区')
        : businessStatus === 'pending_dispatch' ? '等待安排车辆与司机'
        : businessStatus === 'pending_transport' ? '车辆已就绪，等待开始运输'
        : status === 'waiting' ? '已派车，等待执行' : '卸货完成';
      var eta = status === 'done' ? '已完成' : status === 'waiting' ? ('要求发车 ' + pad(15 + i % 4, 2) + ':' + minute) : ('预计 ' + pad(15 + i % 3, 2) + ':' + minute);
      var remain = status === 'done' ? 0 : status === 'waiting' ? 52 + i % 31 : Math.max(2, Math.round((1 - progress) * (62 + i % 24)));
      var soc = Math.max(18, Math.min(96, vehicle.soc - (i % 5) * 2));
      var routeDistance = { '昆钢 → 北城': 74, '大开门 → 研和': 99, '昆钢 → 研和': 94 };
      var routeName = pair[0] + ' → ' + pair[1];
      var eventBase = (6 + i % 4) * 60 + Number(minute);
      function eventTime(offset) {
        var total = eventBase + offset;
        return pad(Math.floor(total / 60) % 24, 2) + ':' + pad(total % 60, 2);
      }
      tasks.push({
        id: i === 0 ? 'RW202609130028' : 'RW20260913' + pad(28 + i, 4),
        waybill: i === 0 ? 'YD202609130028' : 'YD20260913' + pad(28 + i, 4),
        taskType: i % 11 === 5 ? '装货空驶单' : '直达任务单',
        direction: vmRouteDirection(pair[0], pair[1]),
        businessStatus: businessStatus,
        assigned: assigned,
        monitorStatus: status,
        node: node,
        nodeLabel: nodeLabel,
        nodeText: nodeText,
        nodeTime: status === 'waiting' ? '—' : pad(9 + i % 6, 2) + ':' + minute,
        plate: assigned ? vehicle.plate : '',
        driver: assigned ? vehicle.driver : '待分配',
        phone: assigned ? vehicle.phone : '',
        vehicleStatus: vehicle.st,
        projectId: vehicle.projectId,
        project: vehicle.project,
        fleet: vehicle.fleet,
        customer: vehicle.customer,
        route: routeName,
        from: pair[0],
        to: pair[1],
        cargo: vehicle.cargo || goods[i % goods.length],
        weight: vehicle.weight || ((30 + i % 6) + 't'),
        expectedWeight: vehicle.expectedWeight || vehicle.weight || ((30 + i % 6) + '.0 t'),
        loadWeight: status === 'waiting' ? '待上传' : (31.6 + (i % 5) * .4).toFixed(1) + ' t',
        unloadWeight: status === 'done' ? (31.2 + (i % 5) * .4).toFixed(1) + ' t' : '待确认',
        cargoDiff: status === 'done' ? (0.4 + (i % 3) * .1).toFixed(1) + ' t' : '待确认',
        weighStatus: status === 'waiting' ? '未上传' : status === 'done' ? '复审通过' : (i % 3 === 0 ? '待初审' : '运输中，待上传'),
        dispatchAt: assigned ? eventTime(0) : '—',
        acceptAt: assigned ? eventTime(8) : '—',
        startAt: status === 'waiting' ? '—' : eventTime(32),
        loadArrive: status === 'waiting' ? '—' : eventTime(58),
        loadLeave: (node === 'run' || node === 'unload' || status === 'done') ? eventTime(104) : '—',
        unloadArrive: (node === 'unload' || status === 'done') ? eventTime(260) : '—',
        unloadLeave: status === 'done' ? eventTime(305) : '—',
        finishAt: status === 'done' ? eventTime(314) : '—',
        transportKm: status === 'done' ? Math.max(1, (routeDistance[routeName] || 86) + (i % 5 - 2) * 2) : null,
        stopCount: status === 'waiting' ? 0 : i % 4,
        stopMinutes: status === 'waiting' ? 0 : (i % 4) * 12,
        preassign: assigned ? vehicle.preassign : '暂无',
        nextTask: assigned && vehicle.preassign.indexOf('已预派') >= 0 ? pair[1] + ' → ' + pair[0] + ' · ' + goods[(i + 1) % goods.length] : '暂无',
        emptyLink: i % 3 === 0 ? '上一任务后衔接空驶 ' + (8 + i % 17) + ' km' : '无衔接空驶单',
        soc: soc,
        eta: eta,
        remain: remain,
        lng: pos[0],
        lat: pos[1],
        t: progress
      });
    }
    var index = 0;
    for (var pd = 0; pd < 45; pd++, index++) addTask(index, 'pending_dispatch', 'dispatch', vehicles[index % vehicles.length]);
    for (var pe = 0; pe < 45; pe++, index++) addTask(index, 'pending_execute', 'waiting', vehicles[index % vehicles.length]);
    var pendingTransportVehicles = vehicles.filter(function (vehicle) { return vehicle.st === 'idle'; }).slice(0, 2);
    for (var pt = 0; pt < 2; pt++, index++) addTask(index, 'pending_transport', 'ready', pendingTransportVehicles[pt]);
    for (var tr = 0; tr < 18; tr++, index++) addTask(index, 'transporting', tr < 12 ? 'run' : (tr < 15 ? 'load' : 'unload'), vehicles[index % vehicles.length]);
    for (var co = 0; co < 34; co++, index++) addTask(index, 'completed', 'done', vehicles[index % vehicles.length]);
    tasks.forEach(function (task) {
      if (task.plate === '云A·F4470' && task.businessStatus === 'transporting') {
        task.id = 'RW202609130092';
        task.waybill = 'YD202609130092';
        task.taskType = '直达任务单';
        task.cargo = '煤炭';
        task.weight = '34.0 t';
        task.expectedWeight = '34.0 t';
        task.customer = '玉溪恒运供应链';
      }
    });
    VM_TASK_CACHE = tasks;
    return VM_TASK_CACHE;
  }
  function vmTaskCounts() {
    var summary = vmOpsSummary();
    return {
      all: summary.tasks.length,
      pending_dispatch: summary.pendingDispatch,
      pending_execute: summary.pendingExecute,
      pending_transport: summary.pendingTransport,
      transporting: summary.transporting,
      completed: summary.completed,
      driving: summary.driving,
      operation: summary.operation
    };
  }
  function vmTaskFiltered() {
    return vmScopedTasks().filter(function (task) {
      if (['pending_dispatch', 'pending_execute', 'pending_transport', 'transporting', 'completed'].indexOf(vmState.taskStatus) >= 0
        && task.businessStatus !== vmState.taskStatus) return false;
      if (vmState.taskStatus === 'driving' && task.node !== 'run') return false;
      if (vmState.taskStatus === 'operation' && ['load', 'unload'].indexOf(task.node) < 0) return false;
      if (vmState.q && (task.id + task.plate + task.driver + task.route).indexOf(vmState.q) < 0) return false;
      return true;
    });
  }
  function vmVehicleTaskFallback(vehicle) {
    if (!vehicle || !vehicle.task || !vehicle.from || !vehicle.to
      || ['run', 'load', 'unload'].indexOf(vehicle.st) < 0) return null;
    var nodeLabels = { run: '运输中', load: '装货中', unload: '卸货中' };
    var nodeTexts = {
      run: '已行驶 ' + Math.max(1, Math.round((Number(vehicle.t) || .5) * 66)) + ' km',
      load: '进入' + vehicle.from + '装货区',
      unload: '进入' + vehicle.to + '卸货区'
    };
    return {
      id: vehicle.task,
      waybill: vehicle.waybill,
      taskType: '直达任务单',
      direction: vehicle.direction || vmRouteDirection(vehicle.from, vehicle.to),
      businessStatus: 'transporting',
      assigned: true,
      monitorStatus: 'executing',
      node: vehicle.st,
      nodeLabel: nodeLabels[vehicle.st],
      nodeText: nodeTexts[vehicle.st],
      nodeTime: vehicle.time,
      plate: vehicle.plate,
      driver: vehicle.driver,
      phone: vehicle.phone,
      vehicleStatus: vehicle.st,
      projectId: vehicle.projectId,
      project: vehicle.project,
      fleet: vehicle.fleet,
      customer: vehicle.customer,
      route: vehicle.route || (vehicle.from + ' → ' + vehicle.to),
      from: vehicle.from,
      to: vehicle.to,
      cargo: vehicle.cargo,
      weight: vehicle.weight,
      expectedWeight: vehicle.weight,
      loadWeight: vehicle.st === 'load' ? '待上传' : '32.0 t',
      unloadWeight: '待确认',
      cargoDiff: '待确认',
      weighStatus: vehicle.st === 'load' ? '未上传' : '运输中，待上传',
      dispatchAt: '07:12',
      acceptAt: '07:20',
      startAt: '07:42',
      loadArrive: '08:18',
      loadLeave: vehicle.st === 'load' ? '—' : '09:02',
      unloadArrive: vehicle.st === 'unload' ? vehicle.time : '—',
      unloadLeave: '—',
      finishAt: '—',
      stopCount: 1,
      stopMinutes: 12,
      preassign: vehicle.preassign,
      nextTask: vmVehicleNextTask(vehicle),
      emptyLink: '无衔接空驶单',
      soc: vehicle.soc,
      eta: vehicle.eta,
      remain: vehicle.remain,
      lng: vehicle.lng,
      lat: vehicle.lat,
      t: vehicle.t
    };
  }
  function vmVehicleNextTask(vehicle) {
    if (!vehicle || !vehicle.preassign || vehicle.preassign.indexOf('已预派') < 0) return '暂无';
    if (vehicle.nextTask) return vehicle.nextTask;
    if (vehicle.to && vehicle.from) return vehicle.to + ' → ' + vehicle.from;
    return '已预派，任务信息待同步';
  }
  function vmTaskForVehicle(vehicle) {
    if (!vehicle || vehicle.st === 'offline') return null;
    var pendingTransport = vmTasks().filter(function (task) {
      return task.assigned && task.plate === vehicle.plate && task.businessStatus === 'pending_transport';
    })[0];
    if (pendingTransport && (vehicle.st === 'idle' || vmState.vehicleStatus === 'pending_transport')) return pendingTransport;
    if (vehicle.st === 'idle') return null;
    var priority = { transporting: 0, pending_transport: 1, pending_execute: 2, completed: 3 };
    var candidates = vmTasks().filter(function (task) {
      return task.assigned && task.plate === vehicle.plate && task.businessStatus !== 'pending_dispatch';
    });
    if (['run', 'load', 'unload'].indexOf(vehicle.st) >= 0) {
      candidates = candidates.filter(function (task) { return task.businessStatus === 'transporting'; });
    } else if (vehicle.st === 'charge') {
      candidates = candidates.filter(function (task) {
        return ['pending_execute', 'pending_transport', 'transporting'].indexOf(task.businessStatus) >= 0;
      });
    }
    var currentTask = candidates.sort(function (a, b) {
      var aPriority = Object.prototype.hasOwnProperty.call(priority, a.businessStatus) ? priority[a.businessStatus] : 9;
      var bPriority = Object.prototype.hasOwnProperty.call(priority, b.businessStatus) ? priority[b.businessStatus] : 9;
      return aPriority - bPriority;
    })[0];
    return currentTask || vmVehicleTaskFallback(vehicle);
  }
  function vmVehicleBaseRows() {
    return monitorVehicles().filter(function (vehicle) {
      if (!vmVehicleInScope(vehicle)) return false;
      if (vmState.taskRoute !== 'all' && vehicle.route !== vmState.taskRoute) return false;
      return true;
    });
  }
  function vmVehicleMatchesStatus(vehicle, status) {
    if (status === 'has_task') return ['run', 'load', 'unload'].indexOf(vehicle.st) >= 0;
    if (status === 'pending_transport') return vmTasks().some(function (task) {
      return task.assigned && task.plate === vehicle.plate && task.businessStatus === 'pending_transport';
    });
    if (status === 'no_task') return vehicle.st === 'idle' && !vmVehicleMatchesStatus(vehicle, 'pending_transport');
    if (status === 'stopped') return vehicle.st === 'offline';
    return true;
  }
  function vmVehicleStatusName(vehicle) {
    if (vmVehicleMatchesStatus(vehicle, 'pending_transport')) return '待运输';
    if (vehicle.st === 'idle') return '无任务';
    if (vehicle.st === 'offline') return '停运';
    if (['run', 'load', 'unload'].indexOf(vehicle.st) >= 0) return '运输中';
    return vmMeta(vehicle.st).name;
  }
  function vmVehicleStatusTone(vehicle) {
    if (vmVehicleMatchesStatus(vehicle, 'pending_transport')) return 'ready';
    if (vehicle.st === 'idle') return 'idle';
    if (vehicle.st === 'offline') return 'offline';
    return 'run';
  }
  function vmVehicleRuntimeStatus(vehicle) {
    if (!vehicle) return 'offline';
    if (vehicle.runtimeStatus) return vehicle.runtimeStatus;
    if (vehicle.st === 'offline') return 'offline';
    if (vehicle.st === 'charge') return 'charging';
    if (vehicle.st === 'run' && Number(vehicle.speed) > 0) return 'driving';
    return 'parked';
  }
  function vmVehicleRuntimeName(vehicle) {
    var labels = { driving: '行驶中', parked: '驻车静止', charging: '充电中', offline: '离线' };
    return labels[vmVehicleRuntimeStatus(vehicle)] || '驻车静止';
  }
  function vmVehicleRuntimeTone(vehicle) {
    var tones = { driving: 'run', parked: 'idle', charging: 'charge', offline: 'offline' };
    return tones[vmVehicleRuntimeStatus(vehicle)] || 'idle';
  }
  function vmVehicleMatchesRuntime(vehicle) {
    var selected = vmState.vehicleRuntimeStatuses || [];
    return !selected.length || selected.indexOf(vmVehicleRuntimeStatus(vehicle)) >= 0;
  }
  function vmVehicleMatchesQuery(vehicle, query) {
    if (!query) return true;
    var task = vmTaskForVehicle(vehicle);
    return [vehicle.plate, vehicle.driver, vehicle.fleet, vehicle.route, vehicle.loc, task && task.id]
      .join(' ').toLowerCase().indexOf(query) >= 0;
  }
  function vmVehicleCounts() {
    var rows = vmVehicleBaseRows();
    return {
      all: rows.length,
      has_task: rows.filter(function (vehicle) { return vmVehicleMatchesStatus(vehicle, 'has_task'); }).length,
      pending_transport: rows.filter(function (vehicle) { return vmVehicleMatchesStatus(vehicle, 'pending_transport'); }).length,
      no_task: rows.filter(function (vehicle) { return vmVehicleMatchesStatus(vehicle, 'no_task'); }).length,
      stopped: rows.filter(function (vehicle) { return vmVehicleMatchesStatus(vehicle, 'stopped'); }).length
    };
  }
  function vmFleetAssetCounts() {
    var rows = vmVehicleBaseRows();
    var seen = Object.create(null);
    var trailers = 0;
    rows.forEach(function (vehicle) {
      var no = String(vehicle.trailer || '').trim();
      if (!no || seen[no]) return;
      seen[no] = true;
      trailers += 1;
    });
    return { tractors: rows.length, trailers: trailers };
  }
  function vmVehicleRuntimeCounts() {
    var rows = vmVehicleBaseRows().filter(function (vehicle) {
      return vmVehicleMatchesStatus(vehicle, vmState.vehicleStatus);
    });
    return {
      all: rows.length,
      driving: rows.filter(function (vehicle) { return vmVehicleRuntimeStatus(vehicle) === 'driving'; }).length,
      parked: rows.filter(function (vehicle) { return vmVehicleRuntimeStatus(vehicle) === 'parked'; }).length,
      charging: rows.filter(function (vehicle) { return vmVehicleRuntimeStatus(vehicle) === 'charging'; }).length,
      offline: rows.filter(function (vehicle) { return vmVehicleRuntimeStatus(vehicle) === 'offline'; }).length
    };
  }
  function vmVehicleFiltered() {
    var query = String(vmState.q || '').toLowerCase();
    return vmVehicleBaseRows().filter(function (vehicle) {
      if (!vmVehicleMatchesStatus(vehicle, vmState.vehicleStatus)) return false;
      if (!vmVehicleMatchesRuntime(vehicle)) return false;
      return vmVehicleMatchesQuery(vehicle, query);
    });
  }
  function vmSelectedTask() {
    var list = vmTasks();
    var selectedById = selectedTaskId
      ? list.filter(function (task) { return task.id === selectedTaskId; })[0]
      : null;
    if (selectedById) return selectedById;
    return selectedPlate ? vmTaskForVehicle(vmSelected()) : null;
  }
  function vmTaskHasRouteContext(task) {
    return !!task && task.assigned
      && ['pending_transport', 'transporting', 'completed'].indexOf(task.businessStatus) >= 0;
  }
  function vmClearTaskSelection() {
    selectedPlate = '';
    selectedTaskId = '';
    vmHoveredPlate = '';
    vmState.detail = 'live';
    vmState.selectedSite = '';
    vmState.layers.load = false;
    vmState.layers.fence = false;
  }
  function vmApplyTaskStatusMap(status) {
    var next = status || 'transporting';
    var waiting = ['pending_execute', 'pending_transport'].indexOf(next) >= 0;
    vmState.layers.executing = true;
    vmState.layers.waiting = waiting;
    vmState.layers.load = false;
    vmState.layers.idle = false;
    vmState.layers.offline = false;
    vmState.layers.station = false;
    vmState.layers.fence = false;
    vmState.selectedSite = '';
  }
  function vmResetDefaultMapState() {
    vmDismissWarningWorkspace();
    vmState.taskStatus = 'transporting';
    vmState.vehicleStatus = 'all';
    vmState.vehicleRuntimeStatuses = [];
    vmState.vehicleRuntimeOpen = false;
    vmState.taskRoute = 'all';
    vmState.kpi = '';
    vmState.q = '';
    vmState.page = 1;
    vmState.layerOpen = false;
    vmState.opsOpen = false;
    vmState.overviewCollapsed = false;
    vmState.satellite = false;
    vmState.selectedSite = '';
    vmApplyTaskStatusMap(vmState.taskStatus);
    vmState.layers.traffic = true;
    vmClearTaskSelection();
    vmOverviewCamera = null;
    vmMapNeedsOverviewFit = true;
  }
  function vmRememberOverviewCamera() {
    if (!dispatchMap || selectedTaskId || selectedPlate) return;
    var center = dispatchMap.getCenter ? dispatchMap.getCenter() : null;
    var zoom = dispatchMap.getZoom ? dispatchMap.getZoom() : null;
    if (!center || typeof zoom !== 'number') return;
    vmOverviewCamera = {
      zoom: zoom,
      center: [typeof center.getLng === 'function' ? center.getLng() : center.lng,
        typeof center.getLat === 'function' ? center.getLat() : center.lat]
    };
  }
  function vmOverviewPadding() {
    var stage = document.querySelector('.vm-map-stage');
    var left = document.getElementById('vmLeftPanel');
    var top = 106;
    var leftGap = 318;
    if (stage && left) {
      var stageRect = stage.getBoundingClientRect();
      var leftRect = left.getBoundingClientRect();
      top = Math.max(96, Math.round(leftRect.top - stageRect.top + 10));
      leftGap = Math.max(286, Math.round(leftRect.right - stageRect.left + 18));
    }
    return [top, 42, 44, leftGap];
  }
  function vmMercatorY(lat) {
    var limited = Math.max(-85, Math.min(85, Number(lat) || 0));
    var sin = Math.sin(limited * Math.PI / 180);
    return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
  }
  function vmMercatorLat(y) {
    return Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;
  }
  function vmFitMapPoints(points, padding, maxZoom) {
    if (!dispatchMap || !points || !points.length) return;
    if (points.length === 1) {
      dispatchMap.setZoomAndCenter(maxZoom || 12, points[0]);
      return;
    }
    var stage = document.querySelector('.vm-map-stage');
    var rect = stage ? stage.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
    var top = padding[0] || 0;
    var right = padding[1] || 0;
    var bottom = padding[2] || 0;
    var left = padding[3] || 0;
    var width = Math.max(220, rect.width - left - right);
    var height = Math.max(180, rect.height - top - bottom);
    var xs = points.map(function (point) { return (Number(point[0]) + 180) / 360; });
    var ys = points.map(function (point) { return vmMercatorY(point[1]); });
    var minX = Math.min.apply(Math, xs);
    var maxX = Math.max.apply(Math, xs);
    var minY = Math.min.apply(Math, ys);
    var maxY = Math.max.apply(Math, ys);
    var spanX = Math.max(0.000001, maxX - minX);
    var spanY = Math.max(0.000001, maxY - minY);
    var zoomX = Math.log(width / (256 * spanX)) / Math.LN2;
    var zoomY = Math.log(height / (256 * spanY)) / Math.LN2;
    var zoom = Math.max(5, Math.min(maxZoom || 11, Math.floor(Math.min(zoomX, zoomY) * 10) / 10));
    var world = 256 * Math.pow(2, zoom);
    var centerX = (minX + maxX) / 2 - (left - right) / (2 * world);
    var centerY = (minY + maxY) / 2 - (top - bottom) / (2 * world);
    dispatchMap.setZoomAndCenter(zoom, [centerX * 360 - 180, vmMercatorLat(centerY)]);
  }
  function vmScheduleOverviewFit(AMap) {
    if (!vmMapNeedsOverviewFit || !dispatchMap || !AMap || selectedTaskId || selectedPlate) return;
    vmMapNeedsOverviewFit = false;
    var vehicles = vmMapVehicles().filter(function (vehicle) {
      return Number.isFinite(vehicle.lng) && Number.isFinite(vehicle.lat);
    });
    if (!vehicles.length) {
      dispatchMap.setZoomAndCenter(10, [102.56, 24.72]);
      return;
    }
    vmFitMapPoints(vehicles.map(function (vehicle) { return [vehicle.lng, vehicle.lat]; }), vmOverviewPadding(), 11);
  }
  function vmRestoreOverviewMap(useRememberedCamera) {
    if (useRememberedCamera && dispatchMap && vmOverviewCamera) {
      dispatchMap.setZoomAndCenter(vmOverviewCamera.zoom, vmOverviewCamera.center);
      vmOverviewCamera = null;
      vmMapNeedsOverviewFit = false;
      return;
    }
    vmOverviewCamera = null;
    vmMapNeedsOverviewFit = true;
  }
  function vmFocusTaskMap(task, AMap) {
    if (!dispatchMap || !task || !AMap || !task.assigned) return;
    if (!vmTaskHasRouteContext(task)) {
      var taskVehicle = vmMapVehicles().filter(function (vehicle) { return vehicle.plate === task.plate; })[0];
      if (taskVehicle) dispatchMap.setZoomAndCenter(12, [taskVehicle.lng, taskVehicle.lat]);
      return;
    }
    var from = dcSitePos(task.from);
    var to = dcSitePos(task.to);
    var routePoint = vmRoutePoint(vmRoutePath(task.from, task.to, task.id.slice(-2)), task.t || 0);
    window.setTimeout(function () {
      if (!dispatchMap || selectedTaskId !== task.id) return;
      vmFitMapPoints([from, to, routePoint], [106, 374, 44, 318], 12);
    }, 60);
  }
  function vmVisibleRows() {
    return vmVehicleFiltered();
  }
  function vmMapVehicles() {
    var visible = vmVehicleFiltered().map(function (vehicle) {
      var task = vmTaskForVehicle(vehicle);
      if (!task) return vehicle;
      var mapLng = vehicle.lng;
      var mapLat = vehicle.lat;
      if (['run', 'load', 'unload'].indexOf(vehicle.st) >= 0 && task.monitorStatus === 'executing') {
        mapLng = task.lng;
        mapLat = task.lat;
      }
      return Object.assign({}, vehicle, {
        route: task.route,
        from: task.from,
        to: task.to,
        lng: mapLng,
        lat: mapLat,
        soc: task.soc,
        remain: task.remain,
        task: task.id,
        businessStatus: task.businessStatus,
        mapStatus: task.monitorStatus
      });
    });
    if (selectedPlate) visible = visible.filter(function (vehicle) { return vehicle.plate === selectedPlate; });
    return visible;
  }
  function vmSiteKind(name) {
    var selectedTask = vmSelectedTask();
    if (selectedTask) {
      if (name === selectedTask.from) return 'load';
      if (name === selectedTask.to) return 'unload';
    }
    var isOrigin = DC_LINES.some(function (pair) { return pair[0] === name; });
    return isOrigin ? 'load' : 'unload';
  }
  function vmSiteVehicleCount(name) {
    return monitorVehicles().filter(function (v) {
      if (!vmVehicleInScope(v)) return false;
      if (v.st === 'load') return v.from === name;
      if (v.st === 'unload') return v.to === name;
      if (v.st === 'charge') return v.from === name;
      return false;
    }).length;
  }
  function vmSiteMarkerHtml(name) {
    var kind = vmSiteKind(name);
    var selectedTask = vmSelectedTask();
    var context = '';
    if (selectedTask && selectedTask.businessStatus === 'pending_transport') {
      context = name === selectedTask.from ? ' · 车辆就绪' : '';
    }
    var selected = vmState.selectedSite === name ? ' is-selected' : '';
    return '<button type="button" class="vm-site-marker is-' + kind + selected + '" aria-label="' + esc(name) + (kind === 'load' ? '装货点' : '卸货点') + '">'
      + '<i>' + (kind === 'load' ? '装' : '卸') + '</i>'
      + '<span><b>' + esc(shortSite(name)) + '</b><small>' + (kind === 'load' ? '装货点' : '卸货点') + context + '</small></span></button>';
  }
  function vmVehicleClusterHtml(count, clusterRows) {
    var vehicles = (clusterRows || []).map(function (row) { return row && row.vehicle; }).filter(Boolean);
    var stages = [
      { id: 'run', status: 'driving', name: '行驶中' },
      { id: 'idle', status: 'parked', name: '驻车静止' },
      { id: 'charge', status: 'charging', name: '充电中' },
      { id: 'offline', status: 'offline', name: '离线' }
    ].map(function (stage) {
      return Object.assign({}, stage, {
        count: vehicles.filter(function (vehicle) { return vmVehicleRuntimeStatus(vehicle) === stage.status; }).length
      });
    }).filter(function (stage) { return stage.count > 0; });
    var warningCount = vehicles.filter(function (vehicle) {
      return vmWarningsForPlate(vehicle.plate, true).length > 0;
    }).length;
    var stageText = stages.map(function (stage) { return stage.name + stage.count + '辆'; }).join('，');
    var aria = count + '辆运输车辆聚合点' + (stageText ? '，车辆状态包含' + stageText : '')
      + (warningCount ? '，其中' + warningCount + '辆存在当前预警' : '');
    var details = stages.map(function (stage) {
      return '<span class="is-' + stage.id + '"><i></i>' + esc(stage.name) + '<b>' + stage.count + '</b></span>';
    }).join('');
    return '<button type="button" class="vm-map-cluster' + (warningCount ? ' has-warning' : '') + '" aria-label="' + aria + '">'
      + '<span class="vm-cluster-count"><b>' + count + '</b><i>辆</i></span>'
      + (warningCount ? '<span class="vm-cluster-alert" aria-hidden="true">' + warningCount + '</span>' : '')
      + '<span class="vm-cluster-hover" aria-hidden="true"><strong>' + count + '辆运输车辆</strong><span class="vm-cluster-stages">' + details + '</span>'
      + (warningCount ? '<em>' + warningCount + '辆存在当前预警</em>' : '<em class="is-safe">当前无运输预警</em>')
      + '<small>点击继续放大</small></span></button>';
  }
  function vmLegendHtml() {
    var selectedTask = vmSelectedTask();
    if (!selectedPlate) {
      return '<span class="is-cluster">车辆聚合</span><span class="is-vehicle">单车</span><span class="is-warning">当前预警</span>';
    }
    var html = '<span class="is-run">行驶中</span><span class="is-load">装货中</span><span class="is-unload">卸货中</span><span class="is-charge">充电中</span>';
    if (vmState.layers.waiting) {
      var waitingLabel = selectedTask && selectedTask.monitorStatus === 'waiting'
        ? selectedTask.nodeLabel : (vmState.taskStatus === 'pending_transport' ? '待运输' : '待执行');
      html += '<span class="is-idle">' + esc(waitingLabel) + '</span>';
    }
    if (vmState.layers.idle) html += '<span class="is-idle">空闲</span>';
    if (vmState.layers.offline) html += '<span class="is-offline">离线</span>';
    if ((selectedTask && vmTaskHasRouteContext(selectedTask)) || vmState.taskRoute !== 'all') html += '<span class="is-dash">规划路线</span>';
    return html;
  }
  function vmStationIconHtml() {
    return dcSvg('<path d="M12 22v-5M9 7V2M15 7V2M6 13a6 6 0 0 0 12 0V7H6v6z"/>');
  }
  function vmStationMarkerHtml(station) {
    return '<button type="button" class="vm-station-marker" aria-label="' + esc(station.name) + '，' + esc(station.price) + '，' + esc(station.distance) + '"><span>'
      + vmStationIconHtml() + '</span><b>' + esc(station.price) + '</b><small>' + esc(station.distance) + '</small></button>';
  }
  function vmStationClusterHtml(count) {
    return '<button type="button" class="vm-station-cluster" aria-label="' + count + ' 个充电场站聚合点"><span>' + vmStationIconHtml() + '</span><b>' + count + '</b></button>';
  }
  function vmSelected() {
    var list = monitorVehicles();
    return list.filter(function (v) { return v.plate === selectedPlate; })[0] || null;
  }
  function vmWarningById(id) {
    return VM_WARNINGS.filter(function (warning) { return warning.id === id; })[0] || null;
  }
  function vmWarningInScope(warning) {
    var vehicle = monitorVehicles().filter(function (row) { return row.plate === warning.plate; })[0];
    return !vehicle || vmVehicleInScope(vehicle);
  }
  function vmScopedWarnings() {
    return VM_WARNINGS.filter(vmWarningInScope);
  }
  function vmWarningMinutes(warning) {
    if (!warning || warning.status === 'recovered') return 0;
    var value = String(warning.duration || '');
    var hour = value.match(/(\d+)h/);
    var minute = value.match(/(\d+)min/);
    return (hour ? parseInt(hour[1], 10) * 60 : 0) + (minute ? parseInt(minute[1], 10) : 0);
  }
  function vmWarningTask(warning) {
    if (!warning) return null;
    var vehicle = vmWarningVehicle(warning);
    return vmTaskForVehicle(vehicle) || vmTasks().filter(function (item) { return item.plate === warning.plate; })[0] || null;
  }
  function vmWarningVehicle(warning) {
    if (!warning) return null;
    return monitorVehicles().filter(function (item) { return item.plate === warning.plate; })[0] || null;
  }
  function vmWarningRows() {
    var query = String(vmState.warningQ || '').trim().toLowerCase();
    return vmScopedWarnings().filter(function (warning) {
      if (warning.status !== vmState.warningScope) return false;
      if (vmState.warningPlate && warning.plate !== vmState.warningPlate) return false;
      if (vmState.warningTab !== 'all' && warning.cat !== vmState.warningTab) return false;
      if (!query) return true;
      var task = vmWarningTask(warning);
      var vehicle = vmWarningVehicle(warning);
      return [warning.type, warning.plate, warning.reason, warning.site,
        task && task.driver, vehicle && vehicle.driver].join(' ').toLowerCase().indexOf(query) >= 0;
    }).sort(function (a, b) {
      if (vmState.warningScope === 'active') return vmWarningMinutes(b) - vmWarningMinutes(a);
      return String(b.recoveredAt || b.time).localeCompare(String(a.recoveredAt || a.time));
    });
  }
  function vmWarningsForPlate(plate, activeOnly) {
    return VM_WARNINGS.filter(function (warning) {
      if (warning.plate !== plate) return false;
      return !activeOnly || warning.status === 'active';
    });
  }
  function vmActiveWarningCount() {
    return vmScopedWarnings().filter(function (warning) { return warning.status === 'active'; }).length;
  }
  function vmWarningTickerRows() {
    return vmScopedWarnings().filter(function (warning) { return warning.status === 'active'; }).sort(function (a, b) {
      return vmWarningMinutes(b) - vmWarningMinutes(a);
    });
  }
  function vmWarningTickerHtml() {
    var rows = vmWarningTickerRows();
    var count = rows.length;
    var pulse = vmState.warningPulse ? ' is-new' : '';
    if (!count) {
      return '<section class="dc-card vm-alert-carousel vm-warning-indicator is-active' + pulse + '" id="vmAlertCarousel" aria-label="运输预警">'
        + '<header class="vm-alert-carousel-hd">'
        + '<button type="button" class="vm-alert-carousel-title" onclick="WB.vmToggleWarnings(true)" aria-label="打开运输预警中心，当前 0 条">'
        + '<i>' + dcSvg('<path d="M10.3 4.3 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>') + '</i>'
        + '<span><em>运输预警</em><b>0</b></span></button></header>'
        + '<div class="vm-alert-carousel-empty">当前组织范围内没有进行中的运输预警</div></section>';
    }
    var index = ((vmState.warningTickerIndex % count) + count) % count;
    var warning = rows[index];
    var high = ['fulfillment', 'energy'].indexOf(warning.cat) >= 0 || warning.type.indexOf('车速') >= 0 || warning.type.indexOf('疲劳') >= 0;
    return '<section class="dc-card vm-alert-carousel vm-warning-indicator is-active' + pulse + '" id="vmAlertCarousel" aria-label="运输预警轮播" onmouseenter="WB.vmWarningTickerHover(true)" onmouseleave="WB.vmWarningTickerHover(false)">'
      + '<header class="vm-alert-carousel-hd">'
      + '<button type="button" class="vm-alert-carousel-title" onclick="WB.vmToggleWarnings(true)" aria-label="打开运输预警中心，当前 ' + count + ' 条">'
      + '<i>' + dcSvg('<path d="M10.3 4.3 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>') + '</i>'
      + '<span><em>运输预警</em><b>' + count + '</b></span></button>'
      + '<div class="vm-alert-carousel-tools">'
      + '<button type="button" class="vm-alert-carousel-all" onclick="WB.vmToggleWarnings(true)" aria-label="查看全部运输预警">全部</button></div></header>'
      + '<button type="button" class="vm-alert-carousel-main" onclick="WB.vmOpenWarningFromTicker(\'' + warning.id + '\')">'
      + '<i class="is-' + warning.cat + '">' + vmWarningIcon(warning.cat) + '</i>'
      + '<span><em>' + (high ? '高等级' : '中等级') + '</em><b>' + esc(warning.type) + '</b>'
      + '<small>' + esc(warning.plate) + (warning.site ? ' · ' + esc(warning.site) : '') + '</small>'
      + '<small>' + esc(warning.reason) + ' · ' + esc(warning.duration) + '</small></span>'
      + '<strong>查看 ›</strong></button></section>';
  }
  function vmIsHomeRight() {
    return !vmState.warningOpen && !vmState.selectedSite && !vmSelected() && !vmSelectedTask();
  }
  function vmHasLinkedDetail() {
    return !vmState.warningOpen && !vmState.selectedSite && (!!vmSelected() || !!vmSelectedTask());
  }
  function vmOverviewDocked() {
    return vmIsHomeRight() && vmState.overviewCollapsed;
  }
  function vmWarningTickerOnMap() {
    return vmHasLinkedDetail() || vmOverviewDocked();
  }
  function paintVmWarningTicker() {
    var host = document.getElementById('vmWarningTickerHost');
    if (host) host.innerHTML = vmWarningTickerOnMap() ? vmWarningTickerHtml() : '';
    var dock = document.getElementById('vmAlertCarousel');
    if (!dock) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = vmWarningTickerHtml();
    if (wrap.firstChild) dock.replaceWith(wrap.firstChild);
  }
  function vmCanRotateWarningTicker() {
    return vmIsHomeRight() || vmHasLinkedDetail();
  }
  function startVmWarningTicker() {
    if (window.__vmWarningTicker) clearInterval(window.__vmWarningTicker);
    window.__vmWarningTicker = null;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    window.__vmWarningTicker = setInterval(function () {
      if (app.currentPage !== 'dispatch-screen' || !vmCanRotateWarningTicker() || vmState.warningTickerHover || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
      var rows = vmWarningTickerRows();
      if (rows.length < 2) return;
      vmState.warningTickerIndex = (vmState.warningTickerIndex + 1) % rows.length;
      paintVmWarningTicker();
    }, 5200);
  }
  function vmRememberWarningOrigin() {
    if (vmState.warningOpen || vmState.warningOrigin) return;
    vmState.warningOrigin = {
      plate: selectedPlate,
      taskId: selectedTaskId,
      detail: vmState.detail,
      page: vmState.page,
      q: vmState.q,
      taskStatus: vmState.taskStatus,
      vehicleStatus: vmState.vehicleStatus,
      vehicleRuntimeStatuses: (vmState.vehicleRuntimeStatuses || []).slice(),
      taskRoute: vmState.taskRoute,
      kpi: vmState.kpi,
      selectedSite: vmState.selectedSite
    };
  }
  function vmDismissWarningWorkspace() {
    vmState.warningOpen = false;
    vmState.selectedWarning = '';
    vmState.warningDetailTab = 'overview';
    vmState.warningPlate = '';
    vmState.warningOrigin = null;
  }
  function vmRestoreWarningOrigin() {
    var origin = vmState.warningOrigin;
    if (origin) {
      selectedPlate = origin.plate;
      selectedTaskId = origin.taskId;
      vmState.detail = origin.detail;
      vmState.page = origin.page;
      vmState.q = origin.q;
      vmState.taskStatus = origin.taskStatus;
      vmState.vehicleStatus = origin.vehicleStatus || 'all';
      vmState.vehicleRuntimeStatuses = (origin.vehicleRuntimeStatuses || []).slice();
      vmState.vehicleRuntimeOpen = false;
      vmState.taskRoute = origin.taskRoute;
      vmState.kpi = origin.kpi;
      vmState.selectedSite = origin.selectedSite;
    }
    vmDismissWarningWorkspace();
  }
  function pendingTasks() {
    if (typeof window.toGetRecords === 'function') {
      return window.toGetRecords().filter(function (r) { return r.status === '待调度'; });
    }
    return [];
  }
  function dcQueue() {
    var real = pendingTasks();
    var live = {};
    real.forEach(function (r) { live[r.id] = r; });
    if (!dcQueueIds) {
      dcQueueIds = real.slice(0, 12).map(function (r, i) { return { id: r.id, i: i }; });
      dcQueueSeed = dcQueueIds.length || 12;
    }
    dcQueueIds = dcQueueIds.filter(function (item) { return !!live[item.id]; });
    return dcQueueIds.map(function (item) {
      var t = DC_QUEUE[item.i] || DC_QUEUE[DC_QUEUE.length - 1];
      return {
        id: item.id,
        start: t.start,
        end: t.end,
        cargo: t.cargo,
        weight: t.weight,
        depart: t.depart,
        wait: t.wait,
        tag: t.tag,
        extra: t.extra
      };
    });
  }
  function dcKpi() {
    var pending = dcQueue().length;
    var dispatched = Math.max(0, dcQueueSeed - pending);
    return {
      tasks: 126,
      pending: pending,
      run: 38 + dispatched,
      done: 76,
      alert: 5,
      cars: 7,
      rate: '60.3'
    };
  }
  function dcSvg(d) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + d + '</svg>';
  }
  function dcSpark(cls, heights) {
    return '<div class="dc-spark ' + cls + '">' + heights.map(function (h) {
      return '<i style="height:' + h + '%"></i>';
    }).join('') + '</div>';
  }
  function dcTrendSvg() {
    var tasks = [4, 3, 2, 3, 5, 8, 14, 22, 28, 26, 24, 22, 20, 21, 24, 27, 25, 22, 18, 14, 10, 8, 6, 5];
    var done = [1, 1, 1, 2, 3, 5, 9, 14, 18, 20, 19, 18, 16, 17, 19, 21, 20, 18, 14, 11, 8, 6, 4, 3];
    var w = 360;
    var h = 132;
    var padL = 8;
    var padB = 22;
    var padT = 8;
    var max = 32;
    var bw = (w - padL * 2) / 24;
    var bars = tasks.map(function (n, i) {
      var bh = n / max * (h - padB - padT);
      var x = padL + i * bw + 1.5;
      var y = h - padB - bh;
      return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (bw - 3).toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="1.5" fill="#5b9bf5"/>';
    }).join('');
    var pts = done.map(function (n, i) {
      var x = padL + i * bw + bw / 2;
      var y = h - padB - n / max * (h - padB - padT);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    var labels = [0, 6, 12, 18, 23].map(function (hh) {
      var x = padL + hh * bw + bw / 2;
      return '<text x="' + x.toFixed(1) + '" y="' + (h - 6) + '" text-anchor="middle" fill="#8e8e99" font-size="10">' + (hh < 10 ? '0' : '') + hh + '</text>';
    }).join('');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="dc-trend-svg">' + bars
      + '<polyline fill="none" stroke="#22c55e" stroke-width="2" points="' + pts + '"/>'
      + '<circle cx="' + (padL + 15 * bw + bw / 2).toFixed(1) + '" cy="' + (h - padB - 21 / max * (h - padB - padT)).toFixed(1) + '" r="3" fill="#22c55e"/>'
      + labels + '</svg>';
  }
  function dcLogo() {
    return '<svg class="dc-logo" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="18" fill="#1b4b9b"/><path d="M7 14h13v9H7z" fill="#fff"/><path d="M20 17h4.2l3.3 3.2V23H20v-6z" fill="#fff"/><circle cx="12" cy="24.2" r="2.1" fill="#fff"/><circle cx="24.2" cy="24.2" r="2.1" fill="#fff"/><circle cx="12" cy="24.2" r="1" fill="#1b4b9b"/><circle cx="24.2" cy="24.2" r="1" fill="#1b4b9b"/></svg>';
  }
  function dcQueueHtml() {
    var rows = dcQueue();
    if (!rows.length) {
      return '<div class="dc-empty">' + dcSvg('<path d="M3 7h11v10H3z"/><path d="M14 11h5l3 3v3h-8"/><circle cx="7" cy="20" r="2"/><circle cx="18" cy="20" r="2"/>')
        + '<b>当前没有待调度任务</b></div>';
    }
    return rows.map(function (r) {
      var extra = r.extra ? '<span class="dc-tag is-w">' + esc(r.extra) + '</span>' : '';
      var tagCls = r.tag === '通用派单' ? 'is-g' : 'is-n';
      return '<article class="dc-task"><div class="dc-task-top"><b>' + esc(r.start) + ' → ' + esc(r.end) + '</b>'
        + '<div class="dc-tags"><span class="dc-tag ' + tagCls + '">' + esc(r.tag) + '</span>' + extra + '</div></div>'
        + '<div class="dc-task-cargo">' + esc(r.cargo) + ' / ' + esc(r.weight) + '</div>'
        + '<div class="dc-task-foot"><span>要求发车 ' + esc(r.depart) + '</span>'
        + '<span class="dc-wait">等待 ' + r.wait + ' min</span>'
        + '<button class="dc-dispatch" type="button" onclick="WB.dispatchNow(\'' + r.id + '\')">派车</button></div></article>';
    }).join('');
  }
  function dcAlertHtml() {
    var icons = {
      timeout: '<path d="M12 8v5l3 2"/><circle cx="12" cy="12" r="9"/>',
      stay: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 1.5"/>',
      deviate: '<path d="M4 19l7-14 3 7 7 2-17 5z"/>',
      soc: '<rect x="7" y="7" width="12" height="14" rx="2"/><path d="M11 3h2M12 11v4"/>',
      offline: '<path d="M12 18h.01"/><path d="M8 14a6 6 0 0 1 8 0M5 11a10 10 0 0 1 14 0"/>'
    };
    return DC_ALERTS.map(function (a) {
      return '<button class="dc-alert is-' + a.kind + '" type="button" onclick="WB.locatePlate(\'' + a.plate + '\')">'
        + '<i>' + dcSvg(icons[a.kind] || icons.timeout) + '</i>'
        + '<div class="dc-alert-main"><b>' + esc(a.plate) + '<span class="dc-alert-kind">' + esc(a.type) + '</span></b><span>' + esc(a.desc) + '</span></div>'
        + '<div class="dc-alert-aside"><strong>' + esc(a.value) + '</strong><time>' + esc(a.time) + '</time></div></button>';
    }).join('');
  }
  function dcDonutHtml() {
    var total = 60;
    var angle = 0;
    var stops = [];
    DC_FLEET.forEach(function (s) {
      var next = angle + s.n / total * 360;
      stops.push(s.color + ' ' + angle + 'deg ' + next + 'deg');
      angle = next;
    });
    var legend = DC_FLEET.map(function (s) {
      return '<li><i style="background:' + s.color + '"></i><span>' + esc(s.name) + '</span><b>' + s.n + '</b><em>' + s.pct + '%</em></li>';
    }).join('');
    return '<div class="dc-donut-wrap"><div class="dc-donut" style="background:conic-gradient(' + stops.join(',') + ')"><strong>60<small>总车辆</small></strong></div>'
      + '<ul class="dc-donut-legend">' + legend + '</ul></div>';
  }
  function dcRouteRows() {
    return DC_ROUTES.map(function (r) {
      return '<tr><td>' + esc(r.name) + '</td><td class="num">' + r.run + '</td><td class="num">' + r.done + '</td><td class="num">' + r.abnormal + '</td>'
        + '<td><div class="dc-mini-bar"><span><i style="width:' + r.rate + '%"></i></span><b>' + r.rate + '%</b></div></td></tr>';
    }).join('');
  }
  function dcClockText() {
    var d = new Date();
    var week = '日一二三四五六';
    return TODAY + ' ' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2) + ' 星期' + week[d.getDay()];
  }
  function startDcClock() {
    var el = document.getElementById('dcClock');
    if (!el) return;
    el.textContent = dcClockText();
    if (window.__dcClock) clearInterval(window.__dcClock);
    window.__dcClock = setInterval(function () {
      var node = document.getElementById('dcClock');
      if (node) node.textContent = dcClockText();
    }, 1000);
    if (window.__vmWarningPulse) clearTimeout(window.__vmWarningPulse);
    if (vmState.warningPulse) {
      window.__vmWarningPulse = setTimeout(function () {
        vmState.warningPulse = false;
        var indicator = document.getElementById('vmAlertCarousel') || document.querySelector('.vm-warning-indicator');
        if (indicator) indicator.classList.remove('is-new');
      }, 4000);
    }
    startVmWarningTicker();
  }
  function setChrome() {
    var page = app.currentPage;
    var isScreen = page === 'dispatch-screen';
    var isLogin = page === 'login';
    document.body.classList.toggle('dc-open', isScreen);
    document.body.classList.toggle('login-open', isLogin);
    if (!isScreen && window.__dcClock) {
      clearInterval(window.__dcClock);
      window.__dcClock = null;
    }
    if (!isScreen && window.__vmWarningTicker) {
      clearInterval(window.__vmWarningTicker);
      window.__vmWarningTicker = null;
    }
    paintTopbarUser();
  }
  function paintTopbarUser() {
    var acc = currentAccount();
    var nameEl = document.querySelector('.topbar-user .user-name');
    var avatarEl = document.querySelector('.topbar-user .avatar');
    if (nameEl) nameEl.textContent = acc ? acc.name : '未登录';
    if (avatarEl) avatarEl.textContent = acc ? acc.name.slice(0, 1) : '?';
    var host = document.querySelector('.topbar-user');
    if (host && !host.__wbBound) {
      host.__wbBound = true;
      host.style.cursor = 'pointer';
      host.setAttribute('tabindex', '0');
      host.addEventListener('click', function (e) {
        e.stopPropagation();
        WB.toggleUserMenu(e);
      });
    }
  }
  function pendingTaskHtml() {
    var rows = pendingTasks();
    var unload = {};
    openTodos('dispatch').forEach(function (t) {
      if (t.type === '未知卸货地待确认') unload[t.bizNo] = true;
    });
    var waits = [26, 22, 18, 15, 12, 9, 7, 5, 4, 3];
    if (!rows.length) return '<div class="empty-state"><b>当前没有待调度任务</b></div>';
    return rows.slice(0, 8).map(function (r, i) {
      var wait = waits[i] || 3;
      var tag = unload[r.code] ? '未知卸货点' : (r.type === '装货空驶单' ? '空驶任务' : '普通任务');
      var tagCls = tag === '未知卸货点' ? 'badge-warning' : (tag === '空驶任务' ? 'badge-info' : 'badge-primary');
      var start = String(r.startArea || '').replace(/（.*?）/g, '');
      var end = String(r.endArea || '').replace(/（.*?）/g, '');
      var hh = 14 + (i % 3);
      var mm = pad((20 + i * 7) % 60, 2);
      return '<article class="wb-task-card">'
        + '<div class="wb-task-card-top"><b>' + esc(start) + ' → ' + esc(end) + '</b>' + badge(tag, tagCls) + '</div>'
        + '<div class="wb-task-card-meta"><span>' + esc(r.cargoName) + ' / ' + esc(r.dispatchWeight || '34') + ' t</span>'
        + '<span>要求发车 ' + hh + ':' + mm + '</span></div>'
        + '<div class="wb-task-card-foot"><em class="' + (wait >= 20 ? 'is-late' : '') + '">等待 ' + wait + ' min</em>'
        + '<button class="btn btn-primary btn-sm" type="button" onclick="WB.dispatchNow(\'' + r.id + '\')">派车</button></div></article>';
    }).join('');
  }
  function dispatchUrgentStrip() {
    var urgent = openTodos('dispatch').filter(function (t) { return t.priority === '高'; });
    if (!urgent.length) return '';
    return '<div class="wb-urgent-strip">' + urgent.map(function (t) {
      return '<button type="button" onclick="WB.handle(\'' + t.id + '\')">' + priBadge(t.priority) + '<span>' + esc(t.title) + '</span></button>';
    }).join('') + '</div>';
  }
  function alertFeedKind(a) {
    if (a.type === '执行车辆离线') return 'offline';
    if (a.type === 'SOC偏低') return 'soc';
    if (a.level === '严重' || a.type.indexOf('超时') >= 0) return 'timeout';
    return 'stay';
  }
  function dispatchAlertFeed() {
    var order = { '严重': 0, '重要': 1, '提醒': 2 };
    var alerts = openAlerts('dispatch').slice().sort(function (a, b) { return order[a.level] - order[b.level]; }).slice(0, 5);
    if (!alerts.length) return '<div class="empty-state"><b>当前没有未恢复告警</b></div>';
    return alerts.map(function (a) {
      return '<button class="wb-alert-item is-' + alertFeedKind(a) + '" type="button" onclick="WB.locateAlert(\'' + a.id + '\')">'
        + '<i></i><div><b>' + esc(a.objectNo) + '</b><span>' + esc(a.title) + '</span></div>'
        + '<em>' + esc(a.duration || a.detectedAt.slice(11, 16)) + '</em></button>';
    }).join('');
  }
  function vehicleStatusModel() {
    var exec = store.board.executing;
    var run = exec.filter(function (r) { return r.node === '行驶'; }).length;
    var load = exec.filter(function (r) { return r.node === '装货'; }).length;
    var unload = exec.filter(function (r) { return r.node === '卸货'; }).length;
    var idle = store.board.vehicles.length;
    var offline = openAlerts('dispatch').filter(function (a) { return a.type === '执行车辆离线'; }).length;
    var total = run + load + unload + idle + offline;
    return [
      { name: '运输中', n: run, color: 'var(--c-success)' },
      { name: '装货', n: load, color: 'var(--c-warning)' },
      { name: '卸货', n: unload, color: '#f59e0b' },
      { name: '空闲', n: idle, color: 'var(--c-primary)' },
      { name: '离线', n: offline, color: 'var(--c-text-3)' },
      { total: total }
    ];
  }
  function vehicleDonutHtml() {
    var model = vehicleStatusModel();
    var totalItem = model.pop();
    var total = totalItem.total || 1;
    var angle = 0;
    var stops = [];
    model.forEach(function (s) {
      var next = angle + s.n / total * 360;
      stops.push(s.color + ' ' + angle + 'deg ' + next + 'deg');
      angle = next;
    });
    var legend = model.map(function (s) {
      return '<li><i style="background:' + s.color + '"></i><span>' + esc(s.name) + '</span><b>' + s.n + '</b><em>' + Math.round(s.n / total * 100) + '%</em></li>';
    }).join('');
    return '<div class="wb-donut-wrap"><div class="wb-donut" style="background:conic-gradient(' + stops.join(',') + ')"><strong>' + total + '<small>台</small></strong></div>'
      + '<ul class="wb-donut-legend">' + legend + '</ul></div>';
  }
  function routeOpsRows() {
    var grouped = {};
    store.board.executing.forEach(function (r) {
      if (!grouped[r.route]) grouped[r.route] = { run: 0, abnormal: 0, done: 0 };
      grouped[r.route].run += 1;
    });
    store.board.finished.forEach(function (r) {
      if (!grouped[r.route]) grouped[r.route] = { run: 0, abnormal: 0, done: 0 };
      grouped[r.route].done += 1;
    });
    openAlerts('dispatch').forEach(function (a) {
      var hit = store.board.executing.filter(function (r) { return r.no === a.objectNo || r.plate === a.objectNo; })[0];
      if (hit && grouped[hit.route]) grouped[hit.route].abnormal += 1;
    });
    return Object.keys(grouped).map(function (name) {
      var r = grouped[name];
      var rate = r.done + r.run ? Math.round(r.done / (r.done + r.run) * 100) : 0;
      return '<tr><td>' + esc(name) + '</td><td class="col-num">' + r.run + '</td><td class="col-num">' + r.done + '</td><td class="col-num">' + r.abnormal + '</td>'
        + '<td><div class="wb-mini-bar"><span><i style="width:' + rate + '%"></i></span><b>' + rate + '%</b></div></td></tr>';
    }).join('');
  }
  function hourBarsHtml() {
    var hours = [6, 8, 14, 22, 28, 18, 12, 9, 7, 5, 3, 2];
    var done = [1, 3, 6, 10, 14, 12, 8, 6, 4, 3, 2, 1];
    return hours.map(function (n, i) {
      return '<span class="wb-hour"><i style="height:' + Math.round(n / 28 * 100) + '%"></i><b style="height:' + Math.round(done[i] / 28 * 100) + '%"></b></span>';
    }).join('');
  }
  function mapPopupHtml(v) {
    if (!v) return '';
    var st = v.kind === 'run' ? '运输中' : (v.kind === 'charge' ? '充电中' : (v.kind === 'stop' ? '停滞' : (v.kind === 'offline' ? '离线' : '异常')));
    return '<div class="dc-popup"><div class="dc-popup-hd"><b>' + esc(v.plate) + '</b><span class="dc-st">' + esc(st) + '</span></div>'
      + '<dl><div><dt>司机</dt><dd>' + esc(v.driver) + '</dd></div><div><dt>电话</dt><dd><a href="tel:' + esc(v.phone || '') + '">' + esc(v.phone || '—') + '</a></dd></div>'
      + '<div class="full"><dt>线路</dt><dd>' + esc(v.route) + '</dd></div>'
      + '<div><dt>任务单号</dt><dd>' + esc(v.task) + '</dd></div><div><dt>距目的地</dt><dd>' + esc(v.dist) + ' km</dd></div>'
      + '<div><dt>预计到达</dt><dd>' + esc(v.eta.slice(11, 16)) + '</dd></div></dl>'
      + '<div class="dc-soc"><span>SOC</span><span class="dc-soc-track"><i style="width:' + parseInt(v.soc, 10) + '%"></i></span><b>' + esc(v.soc) + '</b></div></div>';
  }
  function shortSite(name) {
    return String(name).replace(/水渣装货地|铁精粉装货地|（装货地）|（卸货地）|水泥厂|卸货网点|卸货点/g, '').replace(/普洱市宁洱天恒/, '宁洱');
  }
  function destroyDispatchMap() {
    if (dispatchVehicleCluster && dispatchVehicleCluster.setMap) {
      try { dispatchVehicleCluster.setMap(null); } catch (e) {}
    }
    if (dispatchStationCluster && dispatchStationCluster.setMap) {
      try { dispatchStationCluster.setMap(null); } catch (e) {}
    }
    dispatchVehicleCluster = null;
    dispatchStationCluster = null;
    if (dispatchTrafficLayer && dispatchTrafficLayer.setMap) {
      try { dispatchTrafficLayer.setMap(null); } catch (e) {}
    }
    dispatchTrafficLayer = null;
    if (dispatchMap && dispatchMap.destroy) {
      try { dispatchMap.destroy(); } catch (e) {}
    }
    dispatchMap = null;
    dispatchMapSatellite = null;
    dispatchMapBaseLayers = null;
  }
  function loadAmap() {
    if (window.AMap) return Promise.resolve(window.AMap);
    if (window.__wbAmapLoader) return window.__wbAmapLoader;
    window.__wbAmapLoader = new Promise(function (resolve, reject) {
      var existing = document.getElementById('amap-js-sdk');
      if (existing) {
        existing.addEventListener('load', function () { resolve(window.AMap); });
        existing.addEventListener('error', reject);
        return;
      }
      var script = document.createElement('script');
      script.id = 'amap-js-sdk';
      script.src = 'https://webapi.amap.com/maps?v=2.0&key=' + AMAP_KEY + '&plugin=AMap.Scale,AMap.ToolBar,AMap.MarkerCluster';
      script.async = true;
      script.onload = function () { resolve(window.AMap); };
      script.onerror = function () { reject(new Error('amap')); };
      document.head.appendChild(script);
    });
    return window.__wbAmapLoader;
  }
  function renderDispatchFallback(el) {
    if (!el) return;
    function xy(lng, lat) {
      return {
        left: ((lng - 102.32) / 0.48) * 100,
        top: ((25.18 - lat) / 1.05) * 100
      };
    }
    var html = '';
    var monitor = dcTab === 'monitor';
    var fallbackTask = monitor ? vmSelectedTask() : null;
    var fallbackRoute = monitor
      ? (fallbackTask ? fallbackTask.route : (vmState.taskRoute !== 'all' ? vmState.taskRoute : '')) : '';
    var fallbackLines = monitor
      ? DC_LINES.filter(function (pair) { return fallbackRoute && pair[0] + ' → ' + pair[1] === fallbackRoute; })
      : DC_LINES;
    fallbackLines.forEach(function (pair) {
      var a = xy(DC_SITES[pair[0]][0], DC_SITES[pair[0]][1]);
      var b = xy(DC_SITES[pair[1]][0], DC_SITES[pair[1]][1]);
      var dx = b.left - a.left;
      var dy = b.top - a.top;
      var len = Math.sqrt(dx * dx + dy * dy);
      var ang = Math.atan2(dy, dx) * 180 / Math.PI;
      html += '<i class="dc-map-line" style="left:' + a.left + '%;top:' + a.top + '%;width:' + len + '%;transform:rotate(' + ang + 'deg)"></i>';
    });
    if (!monitor || vmState.layers.load) {
      var fallbackSites = monitor && fallbackTask
        ? [fallbackTask.from, fallbackTask.to] : Object.keys(DC_SITES);
      html += fallbackSites.filter(function (name, index, list) { return list.indexOf(name) === index; }).map(function (name) {
        var p = xy(DC_SITES[name][0], DC_SITES[name][1]);
        return '<span class="dc-map-site" style="left:' + p.left + '%;top:' + p.top + '%">' + esc(name) + '</span>';
      }).join('');
    }
    var fallbackVehicles = dcTab === 'monitor' ? vmMapVehicles() : filteredDispatchVehicles();
    html += fallbackVehicles.map(function (v) {
      var p = xy(v.lng, v.lat);
      return '<button class="dc-map-dot is-' + (v.kind || v.st) + (selectedPlate === v.plate ? ' is-on' : '') + '" type="button" style="left:' + p.left + '%;top:' + p.top + '%" onclick="WB.locatePlate(\'' + v.plate + '\')"></button>';
    }).join('');
    el.innerHTML = '<div class="dc-map-fallback">' + html + '</div>';
    paintMapPopup();
  }
  function paintMapPopup() {
    var box = document.getElementById('wbMapPopup');
    if (!box) return;
    if (dcTab === 'monitor' || dcTab === 'alert') { box.hidden = true; return; }
    var v = dispatchVehicles().filter(function (x) { return x.plate === selectedPlate; })[0];
    box.hidden = !v;
    box.innerHTML = v ? mapPopupHtml(v) : '';
  }
  function refreshDispatchMarkers(AMap) {
    if (!dispatchMap || !AMap) return;
    if (dispatchVehicleCluster && dispatchVehicleCluster.setMap) {
      try { dispatchVehicleCluster.setMap(null); } catch (e) {}
    }
    if (dispatchStationCluster && dispatchStationCluster.setMap) {
      try { dispatchStationCluster.setMap(null); } catch (e) {}
    }
    dispatchVehicleCluster = null;
    dispatchStationCluster = null;
    dispatchMap.clearMap();
    if (dcTab === 'alert') {
      refreshAlertMarkers(AMap);
      return;
    }
    var monitor = dcTab === 'monitor';
    var L = vmState.layers;
    var selectedTask = monitor ? vmSelectedTask() : null;
    if (monitor && AMap.TileLayer && AMap.TileLayer.Traffic) {
      if (!dispatchTrafficLayer) {
        try { dispatchTrafficLayer = new AMap.TileLayer.Traffic({ zIndex: 8, opacity: .72 }); } catch (e) { dispatchTrafficLayer = null; }
      }
      if (dispatchTrafficLayer && dispatchTrafficLayer.setMap) {
        try { dispatchTrafficLayer.setMap(L.traffic ? dispatchMap : null); } catch (e) {}
      }
    }
    var activeRoute = monitor
      ? (selectedTask && vmTaskHasRouteContext(selectedTask)
        ? selectedTask.route : (vmState.taskRoute !== 'all' ? vmState.taskRoute : '')) : '';
    if (monitor && L.fence) {
      var fenceSites = vmState.selectedSite ? [vmState.selectedSite]
        : (selectedTask ? [selectedTask.from, selectedTask.to] : Object.keys(DC_SITES));
      fenceSites.forEach(function (name) {
        dispatchMap.add(new AMap.Circle({
          center: DC_SITES[name],
          radius: 2200,
          fillColor: '#3b82f6',
          fillOpacity: 0.09,
          strokeColor: '#67b7ff',
          strokeOpacity: 0.82,
          strokeWeight: 1.5,
          strokeStyle: 'dashed'
        }));
      });
    }
    var visibleLines = monitor
      ? (selectedTask && vmTaskHasRouteContext(selectedTask)
        ? [[selectedTask.from, selectedTask.to]]
        : DC_LINES.filter(function (pair) { return activeRoute && pair[0] + ' → ' + pair[1] === activeRoute; }))
      : DC_LINES;
    visibleLines.forEach(function (pair, routeIndex) {
      var routeName = pair[0] + ' → ' + pair[1];
      var routePath = vmRoutePath(pair[0], pair[1], selectedTask ? selectedTask.id.slice(-2) : routeIndex);
      dispatchMap.add(new AMap.Polyline({
        path: routePath,
        strokeColor: monitor ? '#60a5fa' : '#3b82f6',
        strokeWeight: monitor ? 4 : 3,
        strokeStyle: 'dashed',
        strokeDasharray: [12, 10],
        strokeOpacity: monitor ? .92 : .9,
        lineJoin: 'round',
        lineCap: 'round'
      }));
    });
    if (!monitor || L.load) {
      var siteNames = monitor && selectedTask
        ? [selectedTask.from, selectedTask.to] : Object.keys(DC_SITES);
      siteNames.filter(function (name, index, list) { return list.indexOf(name) === index; }).forEach(function (name) {
        var liftReadyOrigin = selectedTask && selectedTask.businessStatus === 'pending_transport' && name === selectedTask.from;
        var siteMarker = new AMap.Marker({
          position: DC_SITES[name],
          offset: new AMap.Pixel(-18, monitor ? (liftReadyOrigin ? -66 : -18) : -10),
          zIndex: liftReadyOrigin ? 260 : 220,
          content: monitor ? vmSiteMarkerHtml(name) : '<span class="dc-map-site-pin">' + esc(name) + '</span>'
        });
        if (monitor) {
          siteMarker.on('click', function () {
            vmState.selectedSite = name;
            vmState.opsOpen = false;
            vmDismissWarningWorkspace();
            vmState.layers.fence = true;
            paintVmLayerControl();
            paintVmRightPanel();
            refreshDispatchMarkers(AMap);
          });
        }
        dispatchMap.add(siteMarker);
      });
    }
    if (monitor && L.station) {
      var stationPoints = VM_STATIONS.map(function (station) {
        return { lnglat: station.pos, weight: 1, station: station };
      });
      dispatchStationCluster = new AMap.MarkerCluster(dispatchMap, stationPoints, {
        gridSize: 56,
        maxZoom: 13,
        renderClusterMarker: function (context) {
          var size = context.count >= 10 ? 52 : 46;
          context.marker.setContent(vmStationClusterHtml(context.count));
          context.marker.setOffset(new AMap.Pixel(-size / 2, -size / 2));
          context.marker.on('click', function (event) {
            dispatchMap.setZoomAndCenter(Math.min(14, dispatchMap.getZoom() + 1.5), event.lnglat || context.marker.getPosition());
          });
        },
        renderMarker: function (context) {
          var station = context.data && context.data[0] && context.data[0].station;
          if (!station) return;
          context.marker.setContent(vmStationMarkerHtml(station));
          context.marker.setOffset(new AMap.Pixel(-25, -42));
        }
      });
    }
    var list = monitor ? vmMapVehicles() : filteredDispatchVehicles();
    if (monitor) vmScheduleOverviewFit(AMap);
    function selectVehicle(plate) {
      vmRememberOverviewCamera();
      vmHoveredPlate = '';
      selectedPlate = plate;
      if (monitor) {
        vmState.opsOpen = false;
        var markerVehicle = monitorVehicles().filter(function (vehicle) { return vehicle.plate === selectedPlate; })[0];
        var markerTask = vmTaskForVehicle(markerVehicle);
        if (markerTask) {
          selectedTaskId = markerTask.id;
        } else selectedTaskId = '';
        var markerVehicleIndex = vmVehicleFiltered().findIndex(function (vehicle) { return vehicle.plate === selectedPlate; });
        if (markerVehicleIndex >= 0) vmState.page = Math.floor(markerVehicleIndex / VM_PAGE) + 1;
        vmState.layers.load = vmTaskHasRouteContext(markerTask);
        vmState.layers.fence = false;
        vmState.selectedSite = '';
        vmState.detail = 'live';
        paintVmPanels();
        paintVmLayerControl();
        refreshDispatchMarkers(AMap);
        if (markerTask) vmFocusTaskMap(markerTask, AMap);
      } else {
        paintMapPopup();
        refreshDispatchMarkers(AMap);
      }
    }
    if (!monitor) {
      var points = list.map(function (v) {
        var html = '<button class="dc-map-dot is-' + v.kind + (selectedPlate === v.plate ? ' is-on' : '') + '" type="button"></button>';
        var marker = new AMap.Marker({
          position: [v.lng, v.lat],
          offset: new AMap.Pixel(-8, -8),
          extData: v.plate,
          content: html
        });
        marker.on('click', function () { selectVehicle(marker.getExtData()); });
        return marker;
      });
      dispatchMap.add(points);
      paintMapPopup();
      return;
    }
    var emphasizedPlate = selectedPlate || vmHoveredPlate;
    var selectedVehicle = list.filter(function (v) { return v.plate === emphasizedPlate; });
    var clusteredVehicles = list.filter(function (v) { return v.plate !== emphasizedPlate; });
    selectedVehicle.forEach(function (v) {
      var marker = new AMap.Marker({
        position: [v.lng, v.lat],
        offset: new AMap.Pixel(-23, -23),
        extData: v.plate,
        zIndex: 300,
        content: vmPinHtml(v, true)
      });
      marker.on('click', function () { selectVehicle(marker.getExtData()); });
      marker.on('mouseover', function () { vmPaintTaskRowHover(v.plate, true); });
      marker.on('mouseout', function () { vmPaintTaskRowHover(v.plate, false); });
      dispatchMap.add(marker);
    });
    if (clusteredVehicles.length) {
      var vehiclePoints = clusteredVehicles.map(function (v) {
        return { lnglat: [v.lng, v.lat], weight: 1, vehicle: v };
      });
      dispatchVehicleCluster = new AMap.MarkerCluster(dispatchMap, vehiclePoints, {
        gridSize: 88,
        renderClusterMarker: function (context) {
          var size = 46;
          var clusterRows = context.clusterData || context.data || [];
          context.marker.setContent(vmVehicleClusterHtml(context.count, clusterRows));
          context.marker.setOffset(new AMap.Pixel(-size / 2, -size / 2));
          context.marker.on('click', function (event) {
            dispatchMap.setZoomAndCenter(Math.min(15, dispatchMap.getZoom() + 1.5), event.lnglat || context.marker.getPosition());
          });
        },
        renderMarker: function (context) {
          var vehicle = context.data && context.data[0] && context.data[0].vehicle;
          if (!vehicle) return;
          context.marker.setContent(vmPinHtml(vehicle, true));
          context.marker.setOffset(new AMap.Pixel(-23, -20));
          if (context.marker.setExtData) context.marker.setExtData(vehicle.plate);
          context.marker.on('click', function () { selectVehicle(vehicle.plate); });
          context.marker.on('mouseover', function () { vmPaintTaskRowHover(vehicle.plate, true); });
          context.marker.on('mouseout', function () { vmPaintTaskRowHover(vehicle.plate, false); });
        }
      });
    }
  }
  function applyDispatchMapStyle(AMap) {
    if (!dispatchMap || !AMap) return;
    var layers = [];
    var useSatellite = dcTab === 'monitor' ? false : mapFilter.satellite;
    if (dispatchMapSatellite === useSatellite) return;
    if (useSatellite && AMap.TileLayer) {
      layers.push(new AMap.TileLayer.Satellite());
      if (dcTab !== 'monitor' && AMap.TileLayer.RoadNet) layers.push(new AMap.TileLayer.RoadNet());
    } else if (dispatchMapSatellite === true) {
      if (dispatchMapBaseLayers && dispatchMapBaseLayers.length) {
        layers = dispatchMapBaseLayers.slice();
      } else if (AMap.TileLayer) {
        layers.push(new AMap.TileLayer());
      }
    }
    if (layers.length) dispatchMap.setLayers(layers);
    if (!useSatellite) {
      try { dispatchMap.setMapStyle('amap://styles/darkblue'); } catch (e) {}
    }
    dispatchMapSatellite = useSatellite;
  }
  function initDispatchMap() {
    var el = document.getElementById('wbDispatchMap');
    if (!el) {
      destroyDispatchMap();
      return;
    }
    destroyDispatchMap();
    var q = document.getElementById('wbMapQ');
    var vh = document.getElementById('wbMapVehicle');
    var st = document.getElementById('wbMapStatus');
    var rt = document.getElementById('wbMapRoute');
    if (q) q.value = mapFilter.q;
    if (vh) vh.value = mapFilter.vehicle;
    if (st) st.value = mapFilter.status;
    if (rt) rt.value = mapFilter.route;
    if (!selectedPlate && dcTab !== 'monitor') selectedPlate = '云A12345';
    var vs = document.getElementById('vmSearch');
    if (vs) vs.value = vmState.q;
    loadAmap().then(function (AMap) {
      if (app.currentPage !== 'dispatch-screen') return;
      el = document.getElementById('wbDispatchMap');
      if (!el) return;
      dispatchMap = new AMap.Map(el, {
        zoom: 10,
        center: [102.56, 24.72],
        mapStyle: 'amap://styles/darkblue',
        viewMode: '2D',
        resizeEnable: true,
        animateEnable: false,
        features: ['bg', 'road', 'building', 'point'],
        logo: false
      });
      vmMapNeedsOverviewFit = !selectedTaskId && !selectedPlate;
      try {
        dispatchMapBaseLayers = dispatchMap.getLayers ? dispatchMap.getLayers().slice() : null;
      } catch (e) {
        dispatchMapBaseLayers = null;
      }
      dispatchMap.on('click', function () {
        if (!vmState.layerOpen) return;
        vmState.layerOpen = false;
        var control = document.querySelector('.vm-layer-control');
        var panel = document.getElementById('vmLayerPanel');
        var trigger = document.querySelector('.vm-layer-trigger');
        if (control) control.classList.remove('is-open');
        if (panel) panel.hidden = true;
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      });
      applyDispatchMapStyle(AMap);
      refreshDispatchMarkers(AMap);
      setTimeout(function () {
        if (dispatchMap && dispatchMap.resize) dispatchMap.resize();
      }, 80);
    }).catch(function () {
      renderDispatchFallback(document.getElementById('wbDispatchMap'));
    });
  }

  function renderHome() {
    var m = metrics();
    var roleCards = ROLES.filter(function (r) { return r.id !== 'all'; }).map(function (r) {
      var n = openTodos(r.id).length;
      var a = openAlerts(r.id).filter(function (x) { return x.level === '严重'; }).length;
      return '<button class="wb-role-card" type="button" onclick="WB.go(\'' + r.page + '\')"><span class="wb-role-name">' + esc(r.name) + '</span><strong>' + n + '</strong><em>待办　严重告警 ' + a + '</em></button>';
    }).join('');
    return '<div class="content-area page-standard wb-page">'
      + breadcrumb('综合工作台')
      + pageHead('综合工作台', '合并各岗位关键事项，不堆叠全部卡片', '')
      + '<div class="kpi-row wb-kpi-6">'
      + kpiCard('待处理待办', m.pendingTodos, '', '处理中 ' + m.doingTodos, 'k2', 'list', 'WB.openTodos(\'all\')')
      + kpiCard('严重告警', m.severe, '', '重要 ' + m.important, 'k6', 'alert', 'WB.openAlerts(\'all\',\'严重\')')
      + kpiCard('待派任务', m.dispatchPending, '', '与任务单待派车一致', 'k1', 'truck', 'WB.openTodos(\'dispatch\',\'待派单\')')
      + kpiCard('待审磅单', m.weigh, '', '进入磅单信息明细', 'k5', 'check', 'WB.openTodos(\'stat\',\'待审核磅单\')')
      + kpiCard('执行中任务', m.executing, '', '待执行 / 待运输 / 运输中', 'k3', 'chart', 'WB.board(\'executing\')')
      + kpiCard('重大事项', m.managerTodo, '', '仅管理层决策项', 'k4', 'bolt', 'WB.openTodos(\'manager\')')
      + '</div>'
      + splitTodoAlert('all', '我的待办', '重要告警')
      + '<div class="wb-block-title"><div class="page-title" style="font-size:15px;">各岗位积压</div></div>'
      + '<div class="wb-role-grid">' + roleCards + '</div>'
      + '<section class="table-section"><div class="table-toolbar"><div class="left"><span class="detail-section-title">快捷入口</span></div></div><div style="padding:16px;">'
      + '<div class="wb-shortcuts">'
      + shortcut('调度工作台', '待办、告警与运力', 'workbench-dispatch')
      + shortcut('统计工作台', '磅单与数据完整性', 'workbench-stat')
      + shortcut('运力工作台', '人车挂可用状态', 'workbench-fleet')
      + shortcut('安全工作台', '风险事件闭环', 'workbench-safety')
      + shortcut('运营工作台', '线路与时效', 'workbench-ops')
      + shortcut('管理工作台', '经营驾驶舱', 'workbench-manager')
      + '</div></div></section></div>';
  }

  function stMoreBtn() {
    return '<button class="st-more" type="button" onclick="WB.stMore()">更多 <span>›</span></button>';
  }
  function stDelta(text, tone) {
    var raw = String(text || '');
    var up = raw.charAt(0) !== '-';
    var num = raw.replace(/^[+-]/, '');
    return '<em class="st-delta ' + (up ? 'is-up' : 'is-down') + ' is-' + tone + '">' + (up ? '↑' : '↓') + ' ' + esc(num) + '</em>';
  }
  function stTabs(items, cur, fn) {
    return '<div class="st-tabs">' + items.map(function (it) {
      return '<button type="button" class="' + (cur === it.id ? 'is-on' : '') + '" onclick="' + fn + '(\'' + it.id + '\')">' + esc(it.name) + '</button>';
    }).join('') + '</div>';
  }
  function stDonut(items, total, sub) {
    var angle = 0;
    var stops = [];
    items.forEach(function (s) {
      var next = angle + s.n / total * 360;
      stops.push(s.color + ' ' + angle + 'deg ' + next + 'deg');
      angle = next;
    });
    var legend = items.map(function (s) {
      return '<li><i style="background:' + s.color + '"></i><span>' + esc(s.name) + '</span><b>' + s.n + '</b><em>' + s.pct + '%</em></li>';
    }).join('');
    return '<div class="st-donut-wrap"><div class="st-donut" style="background:conic-gradient(' + stops.join(',') + ')"><strong>' + total + '<small>' + esc(sub) + '</small></strong></div>'
      + '<ul class="st-donut-legend">' + legend + '</ul></div>';
  }
  function stTrendSvg() {
    var labels = ['08-28', '08-29', '08-30', '08-31', '09-01', '09-02', '09-03'];
    var a;
    var b;
    var rate = [90, 87, 92, 92, 90, 93, 92];
    var max = 150;
    var yTicks = [0, 50, 100, 150];
    if (stTrendKind === 'ton') {
      a = [720, 810, 760, 880, 920, 840, 980];
      b = [640, 720, 700, 820, 860, 780, 900];
      max = 1200;
      yTicks = [0, 400, 800, 1200];
    } else if (stTrendKind === 'run') {
      a = [30, 32, 28, 35, 36, 34, 38];
      b = [26, 29, 25, 32, 33, 31, 35];
      max = 50;
      yTicks = [0, 15, 30, 50];
    } else {
      a = [98, 110, 102, 118, 124, 108, 126];
      b = [88, 96, 94, 108, 112, 100, 116];
    }
    var w = 560;
    var h = 176;
    var padL = 36;
    var padR = 36;
    var padT = 10;
    var padB = 26;
    var innerW = w - padL - padR;
    var innerH = h - padT - padB;
    var slot = innerW / 7;
    var barW = 9;
    function yv(v) { return padT + innerH - (v / max) * innerH; }
    function yr(v) { return padT + innerH - (v / 100) * innerH; }
    var grid = yTicks.map(function (t) {
      var y = yv(t);
      return '<line x1="' + padL + '" y1="' + y + '" x2="' + (w - padR) + '" y2="' + y + '" stroke="#eef0f4" stroke-width="1"/>'
        + '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" text-anchor="end" fill="#9aa0ab" font-size="9">' + t + '</text>';
    }).join('');
    var rTicks = [0, 50, 100].map(function (t) {
      return '<text x="' + (w - padR + 6) + '" y="' + (yr(t) + 3) + '" fill="#9aa0ab" font-size="9">' + t + '%</text>';
    }).join('');
    var bars = '';
    var pts = [];
    labels.forEach(function (lab, i) {
      var cx = padL + slot * i + slot / 2;
      var x1 = cx - barW - 1;
      var x2 = cx + 1;
      var h1 = innerH - (yv(a[i]) - padT);
      var h2 = innerH - (yv(b[i]) - padT);
      bars += '<rect x="' + x1 + '" y="' + yv(a[i]) + '" width="' + barW + '" height="' + Math.max(1, h1) + '" rx="2" fill="#3b82f6"/>';
      bars += '<rect x="' + x2 + '" y="' + yv(b[i]) + '" width="' + barW + '" height="' + Math.max(1, h2) + '" rx="2" fill="#22c55e"/>';
      pts.push(cx + ',' + yr(rate[i]));
      bars += '<text x="' + cx + '" y="' + (h - 8) + '" text-anchor="middle" fill="#9aa0ab" font-size="9">' + lab + '</text>';
    });
    var last = pts[pts.length - 1].split(',');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="st-chart-svg" preserveAspectRatio="none">' + grid + rTicks + bars
      + '<polyline fill="none" stroke="#f59e0b" stroke-width="2" points="' + pts.join(' ') + '"/>'
      + '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="3.2" fill="#f59e0b" stroke="#fff" stroke-width="1.5"/>'
      + '</svg>';
  }
  function stEffSvg() {
    var nodes = ['昆钢', '北城', '大开门', '研和'];
    var series = [
      { name: '装货时长', color: '#2563eb', vals: [1.2, 1.0, 1.4, 1.1] },
      { name: '行驶时长', color: '#38bdf8', vals: [2.8, 2.4, 3.1, 2.6] },
      { name: '卸货时长', color: '#22c55e', vals: [0.9, 1.1, 1.0, 0.8] },
      { name: '充电时长', color: '#a78bfa', vals: [0.6, 0.5, 0.8, 0.7] }
    ];
    var w = 640;
    var h = 148;
    var padL = 32;
    var padR = 8;
    var padT = 8;
    var padB = 22;
    var innerW = w - padL - padR;
    var innerH = h - padT - padB;
    var max = 6;
    var groupW = innerW / 4;
    var barW = 11;
    var gap = 3;
    var cluster = series.length * barW + (series.length - 1) * gap;
    var grid = [0, 2, 4, 6].map(function (t) {
      var y = padT + innerH - (t / max) * innerH;
      return '<line x1="' + padL + '" y1="' + y + '" x2="' + (w - padR) + '" y2="' + y + '" stroke="#eef0f4"/>'
        + '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" text-anchor="end" fill="#9aa0ab" font-size="9">' + t + '</text>';
    }).join('');
    var bars = '';
    nodes.forEach(function (name, gi) {
      var gx = padL + groupW * gi + (groupW - cluster) / 2;
      series.forEach(function (s, si) {
        var x = gx + si * (barW + gap);
        var bh = (s.vals[gi] / max) * innerH;
        var y = padT + innerH - bh;
        bars += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + Math.max(2, bh) + '" rx="2" fill="' + s.color + '"/>';
      });
      bars += '<text x="' + (padL + groupW * gi + groupW / 2) + '" y="' + (h - 6) + '" text-anchor="middle" fill="#6b7280" font-size="11">' + name + '</text>';
    });
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="st-chart-svg" preserveAspectRatio="none">' + grid + bars + '</svg>';
  }
  function stBldg(x, y, fill, fill2, roof) {
    return '<g transform="translate(' + x + ',' + y + ')">'
      + '<ellipse cx="22" cy="42" rx="26" ry="7" fill="rgba(37,99,235,.12)"/>'
      + '<polygon points="22,0 46,13 22,26 0,13" fill="' + roof + '"/>'
      + '<polygon points="0,13 22,26 22,48 0,35" fill="' + fill + '"/>'
      + '<polygon points="22,26 46,13 46,35 22,48" fill="' + fill2 + '"/>'
      + '<rect x="7" y="30" width="7" height="9" rx="1" fill="rgba(255,255,255,.5)"/>'
      + '<rect x="28" y="30" width="7" height="9" rx="1" fill="rgba(255,255,255,.28)"/>'
      + '</g>';
  }
  function stFlowSvg() {
    return '<svg class="st-flow-svg" viewBox="0 0 820 400" preserveAspectRatio="xMidYMid meet">'
      + '<defs>'
      + '<linearGradient id="stGround" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7e7f8"/><stop offset="1" stop-color="#eef5fb"/></linearGradient>'
      + '<marker id="stArrB" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0l10 5-10 5z" fill="#3b82f6"/></marker>'
      + '<marker id="stArrR" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0l10 5-10 5z" fill="#ef4444"/></marker>'
      + '<marker id="stArrO" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0l10 5-10 5z" fill="#f59e0b"/></marker>'
      + '</defs>'
      + '<rect width="820" height="400" fill="#f4f8fc"/>'
      + '<polygon points="410,36 742,176 410,316 78,176" fill="url(#stGround)" stroke="#c9d9ea" stroke-width="1.2"/>'
      + '<g stroke="#c5d6e8" stroke-width="1" fill="none" opacity=".7">'
      + '<polyline points="244,106 410,36 576,106"/>'
      + '<polyline points="160,176 410,70 660,176"/>'
      + '<polyline points="160,176 410,246 660,176"/>'
      + '<polyline points="244,246 410,316 576,246"/>'
      + '<line x1="410" y1="36" x2="410" y2="316"/>'
      + '<line x1="78" y1="176" x2="742" y2="176"/>'
      + '</g>'
      + '<g fill="none" stroke="#9bb4cc" stroke-width="13" stroke-linecap="round">'
      + '<path d="M168 188 Q 240 96 400 88"/>'
      + '<path d="M168 200 Q 410 230 652 188"/>'
      + '<path d="M424 308 Q 560 286 668 200"/>'
      + '<path d="M396 308 Q 250 250 168 200"/>'
      + '<path d="M430 88 Q 560 96 668 188"/>'
      + '</g>'
      + '<g fill="none" stroke="#f8fbff" stroke-width="7" stroke-linecap="round">'
      + '<path d="M168 188 Q 240 96 400 88"/>'
      + '<path d="M168 200 Q 410 230 652 188"/>'
      + '<path d="M424 308 Q 560 286 668 200"/>'
      + '<path d="M396 308 Q 250 250 168 200"/>'
      + '<path d="M430 88 Q 560 96 668 188"/>'
      + '</g>'
      + '<path class="st-flow-anim" d="M176 184 Q 240 96 392 90" fill="none" stroke="#3b82f6" stroke-width="2.4" marker-end="url(#stArrB)"/>'
      + '<path class="st-flow-anim" d="M176 204 Q 410 232 644 190" fill="none" stroke="#06b6d4" stroke-width="2.4" marker-end="url(#stArrB)"/>'
      + '<path class="st-flow-anim" d="M432 300 Q 560 286 656 204" fill="none" stroke="#3b82f6" stroke-width="2.4" marker-end="url(#stArrB)"/>'
      + '<path class="st-flow-anim" d="M388 300 Q 250 250 176 204" fill="none" stroke="#ef4444" stroke-width="2.4" marker-end="url(#stArrR)"/>'
      + '<path class="st-flow-anim" d="M438 90 Q 560 96 656 180" fill="none" stroke="#f59e0b" stroke-width="2.4" marker-end="url(#stArrO)"/>'
      + '<g font-size="11" font-weight="650">'
      + '<rect x="214" y="108" width="92" height="22" rx="11" fill="#fff" stroke="#dbe7f3"/><text x="260" y="123" text-anchor="middle" fill="#2563eb">12 车 | 2,420 t</text>'
      + '<rect x="364" y="214" width="92" height="22" rx="11" fill="#fff" stroke="#dbe7f3"/><text x="410" y="229" text-anchor="middle" fill="#0e7490">8 车 | 1,680 t</text>'
      + '<rect x="534" y="252" width="92" height="22" rx="11" fill="#fff" stroke="#dbe7f3"/><text x="580" y="267" text-anchor="middle" fill="#2563eb">10 车 | 2,180 t</text>'
      + '<rect x="214" y="248" width="86" height="22" rx="11" fill="#fff" stroke="#fecaca"/><text x="257" y="263" text-anchor="middle" fill="#dc2626">5 车 | 1,580 t</text>'
      + '<rect x="534" y="108" width="86" height="22" rx="11" fill="#fff" stroke="#fde68a"/><text x="577" y="123" text-anchor="middle" fill="#d97706">3 车 | 1,000 t</text>'
      + '</g>'
      + stBldg(388, 52, '#3b82f6', '#2563eb', '#93c5fd')
      + stBldg(122, 158, '#2563eb', '#1d4ed8', '#60a5fa')
      + stBldg(646, 158, '#0ea5e9', '#0284c7', '#7dd3fc')
      + stBldg(388, 268, '#6366f1', '#4f46e5', '#a5b4fc')
      + '</svg>';
  }
  function stNodeCard(node) {
    return '<article class="st-node is-' + node.status + '" style="left:' + node.left + ';top:' + node.top + '">'
      + '<header><b>' + esc(node.name) + '</b><span><i></i>' + esc(node.label) + '</span></header>'
      + '<p><em>在途</em> ' + node.run + ' <i>|</i> <em>排队</em> ' + node.queue + '</p>'
      + '<strong>' + esc(node.ton) + '</strong></article>';
  }
  function stKpiCompare() {
    if (stKpiRange === '7d') {
      return [
        { name: '运输量', val: '58,240 t', delta: '+6%', tone: 'good', spark: [42, 48, 45, 60, 55, 70, 68], cls: 'is-blue' },
        { name: '完成率', val: '91%', delta: '+2%', tone: 'good', spark: [82, 86, 88, 90, 89, 91, 91], cls: 'is-green' },
        { name: '平均时长', val: '4.4 h', delta: '-1%', tone: 'good', spark: [72, 68, 66, 62, 60, 58, 54], cls: 'is-blue' },
        { name: '异常次数', val: '28', delta: '+11%', tone: 'bad', spark: [30, 36, 32, 40, 38, 44, 48], cls: 'is-red' }
      ];
    }
    if (stKpiRange === '30d') {
      return [
        { name: '运输量', val: '246,800 t', delta: '+5%', tone: 'good', spark: [40, 44, 48, 46, 52, 58, 62], cls: 'is-blue' },
        { name: '完成率', val: '90%', delta: '+1%', tone: 'good', spark: [80, 84, 86, 88, 87, 89, 90], cls: 'is-green' },
        { name: '平均时长', val: '4.5 h', delta: '-2%', tone: 'good', spark: [78, 74, 70, 68, 64, 60, 58], cls: 'is-blue' },
        { name: '异常次数', val: '96', delta: '+9%', tone: 'bad', spark: [28, 32, 36, 34, 40, 44, 50], cls: 'is-red' }
      ];
    }
    return [
      { name: '运输量', val: '8,860 t', delta: '+8%', tone: 'good', spark: [40, 48, 44, 62, 58, 74, 80], cls: 'is-blue' },
      { name: '完成率', val: '92%', delta: '+3%', tone: 'good', spark: [78, 82, 86, 88, 90, 91, 92], cls: 'is-green' },
      { name: '平均时长', val: '4.2 h', delta: '-3%', tone: 'good', spark: [80, 74, 70, 64, 60, 56, 48], cls: 'is-blue' },
      { name: '异常次数', val: '5', delta: '+28%', tone: 'bad', spark: [24, 28, 32, 30, 38, 44, 56], cls: 'is-red' }
    ];
  }
  function renderSituationBody() {
    var ov = [
      { name: '运输任务', val: '126', delta: '+12%', tone: 'bad', icon: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5"/>', tint: 'task' },
      { name: '运输量', val: '8,860 t', delta: '+8%', tone: 'good', icon: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>', tint: 'ton' },
      { name: '在途车辆', val: '38', delta: '+5%', tone: 'good', icon: '<path d="M3 7h11v10H3z"/><path d="M14 11h5l3 3v3h-8"/><circle cx="7" cy="20" r="2"/><circle cx="18" cy="20" r="2"/>', tint: 'run' },
      { name: '完成率', val: '92%', delta: '+3%', tone: 'good', icon: '<path d="M9 11l2 2 4-4"/><circle cx="12" cy="12" r="9"/>', tint: 'ok' },
      { name: '平均运输时长', val: '4.2 h', delta: '-3%', tone: 'good', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', tint: 'time' },
      { name: '异常次数', val: '5', delta: '+28%', tone: 'bad', icon: '<path d="M10.3 4.3L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>', tint: 'alert' }
    ];
    var ovHtml = ov.map(function (x) {
      return '<div class="st-ov is-' + x.tint + '"><i>' + dcSvg(x.icon) + '</i><div><span>' + esc(x.name) + '</span><b>' + esc(x.val) + '</b></div>' + stDelta(x.delta, x.tone) + '</div>';
    }).join('');
    var region = stDonut([
      { name: '昆钢', n: 12, pct: 32, color: '#3b82f6' },
      { name: '北城', n: 10, pct: 26, color: '#22c55e' },
      { name: '大开门', n: 8, pct: 21, color: '#f59e0b' },
      { name: '研和', n: 6, pct: 16, color: '#a78bfa' },
      { name: '其他', n: 2, pct: 5, color: '#94a3b8' }
    ], 38, '在途车辆');
    var dist = stDonut([
      { name: '≤50km', n: 12, pct: 32, color: '#22c55e' },
      { name: '50-100km', n: 10, pct: 26, color: '#3b82f6' },
      { name: '100-200km', n: 8, pct: 21, color: '#38bdf8' },
      { name: '200-500km', n: 6, pct: 16, color: '#f59e0b' },
      { name: '>500km', n: 2, pct: 5, color: '#ef4444' }
    ], 38, '在途任务');
    var nodes = [
      { name: '北城', run: 10, queue: 2, ton: '2,140 t', status: 'ok', label: '正常', left: '42%', top: '3%' },
      { name: '昆钢', run: 12, queue: 4, ton: '2,680 t', status: 'busy', label: '繁忙', left: '3%', top: '34%' },
      { name: '研和', run: 8, queue: 1, ton: '1,860 t', status: 'ok', label: '正常', left: '78%', top: '34%' },
      { name: '大开门', run: 8, queue: 5, ton: '2,180 t', status: 'jam', label: '拥堵', left: '42%', top: '71%' }
    ];
    var routes = [
      { name: '昆钢 → 北城', run: 12, ton: '2,420', hours: '3.8h', rate: '96%', status: 'ok' },
      { name: '大开门 → 研和', run: 10, ton: '2,180', hours: '4.6h', rate: '91%', status: 'busy' },
      { name: '昆钢 → 研和', run: 8, ton: '1,680', hours: '5.1h', rate: '88%', status: 'ok' },
      { name: '大开门 → 北城', run: 5, ton: '1,580', hours: '4.9h', rate: '84%', status: 'jam' },
      { name: '北城 → 研和', run: 3, ton: '1,000', hours: '3.2h', rate: '97%', status: 'ok' }
    ];
    var cargo = [
      { name: '矿石', ton: '3,280 t', pct: 37, delta: '+6%', tone: 'good' },
      { name: '钢材', ton: '2,120 t', pct: 24, delta: '+4%', tone: 'good' },
      { name: '煤炭', ton: '1,780 t', pct: 20, delta: '+12%', tone: 'good' },
      { name: '焦炭', ton: '1,060 t', pct: 12, delta: '-2%', tone: 'bad' },
      { name: '其他', ton: '620 t', pct: 7, delta: '+3%', tone: 'good' }
    ];
    var routeRows = routes.map(function (r) {
      return '<tr><td>' + esc(r.name) + '</td><td class="num">' + r.run + '</td><td class="num">' + r.ton + '</td><td class="num">' + r.hours + '</td><td class="num">' + r.rate + '</td><td><i class="st-status is-' + r.status + '"></i></td></tr>';
    }).join('');
    var cargoHtml = cargo.map(function (c) {
      var on = stGoods === 'all' || stGoods === c.name;
      return '<li class="' + (on ? '' : 'is-dim') + '"><div class="st-cargo-hd"><b>' + esc(c.name) + '</b><span>' + esc(c.ton) + '</span><em>' + c.pct + '%</em>' + stDelta(c.delta, c.tone) + '</div>'
        + '<div class="st-bar"><i style="width:' + c.pct + '%"></i></div></li>';
    }).join('');
    var kpiHtml = stKpiCompare().map(function (k) {
      return '<article class="st-kpi"><div><span>' + esc(k.name) + '</span><b>' + esc(k.val) + '</b>' + stDelta(k.delta, k.tone) + '</div>' + dcSpark(k.cls, k.spark) + '</article>';
    }).join('');
    var dayLabel = stDay === '7d' ? '近7天' : (stDay === '30d' ? '近30天' : '今日');
    var turnVal = stDay === '7d' ? '58,240 t' : (stDay === '30d' ? '246,800 t' : '8,860 t');
    var turnDelta = stDay === 'today' ? '+8%' : (stDay === '7d' ? '+6%' : '+5%');
    return '<div class="st-body">'
      + '<div class="st-col st-left">'
      + '<section class="dc-card st-overview"><div class="dc-card-hd"><h3>今日整体运行概览</h3>' + stMoreBtn() + '</div>'
      + '<div class="st-ov-grid">' + ovHtml + '</div></section>'
      + '<section class="dc-card st-trend"><div class="dc-card-hd"><h3>运输趋势</h3>'
      + stTabs([{ id: 'task', name: '任务量' }, { id: 'ton', name: '运输量' }, { id: 'run', name: '在途车辆' }], stTrendKind, 'WB.stTrend')
      + '<span class="st-range">近7天</span>' + stMoreBtn() + '</div>'
      + '<div class="st-chart">' + stTrendSvg() + '</div>'
      + '<div class="st-legend"><span class="is-bar-b">新任务</span><span class="is-bar-g">已完成</span><span class="is-line">完成率</span></div></section>'
      + '<section class="dc-card st-region"><div class="dc-card-hd"><h3>区域运力分布</h3><span class="st-hd-sub">在途车辆</span>' + stMoreBtn() + '</div>'
      + region + '</section></div>'
      + '<div class="st-col st-mid">'
      + '<section class="dc-card st-flow-card"><div class="dc-card-hd"><h3>运输网络流向</h3><span class="st-hd-sub">' + esc(dayLabel) + '</span>'
      + '<div class="st-flow-tools"><select id="stDay" onchange="WB.stDay()">'
      + '<option value="today"' + (stDay === 'today' ? ' selected' : '') + '>今日</option>'
      + '<option value="7d"' + (stDay === '7d' ? ' selected' : '') + '>近7天</option>'
      + '<option value="30d"' + (stDay === '30d' ? ' selected' : '') + '>近30天</option></select>'
      + '<select id="stGoods" onchange="WB.stGoods()">'
      + '<option value="all"' + (stGoods === 'all' ? ' selected' : '') + '>全部货物</option>'
      + '<option value="矿石"' + (stGoods === '矿石' ? ' selected' : '') + '>矿石</option>'
      + '<option value="钢材"' + (stGoods === '钢材' ? ' selected' : '') + '>钢材</option>'
      + '<option value="煤炭"' + (stGoods === '煤炭' ? ' selected' : '') + '>煤炭</option>'
      + '<option value="焦炭"' + (stGoods === '焦炭' ? ' selected' : '') + '>焦炭</option></select></div></div>'
      + '<div class="st-flow">' + stFlowSvg() + nodes.map(stNodeCard).join('')
      + '<div class="st-turn"><span>' + esc(dayLabel) + '总周转量</span><b>' + esc(turnVal) + '</b>' + stDelta(turnDelta, 'good') + '</div>'
      + '<div class="st-flow-legend"><span>昆钢→北城</span><span>大开门→研和</span><span>昆钢→研和</span><span class="is-warn">大开门→北城</span><span class="is-busy">北城→研和</span></div>'
      + '</div></section>'
      + '<section class="dc-card st-eff"><div class="dc-card-hd"><h3>节点作业效率</h3><span class="st-hd-sub">时长 (小时)</span></div>'
      + '<div class="st-chart">' + stEffSvg() + '</div>'
      + '<div class="st-legend"><span class="is-load">装货时长</span><span class="is-drive">行驶时长</span><span class="is-unload">卸货时长</span><span class="is-charge">充电时长</span></div></section>'
      + '<section class="dc-card st-compare"><div class="dc-card-hd"><h3>重点指标对比</h3>'
      + stTabs([{ id: 'today', name: '今日' }, { id: '7d', name: '近7天' }, { id: '30d', name: '近30天' }], stKpiRange, 'WB.stKpiRange')
      + '</div><div class="st-kpi-grid">' + kpiHtml + '</div></section></div>'
      + '<div class="st-col st-right">'
      + '<section class="dc-card st-routes"><div class="dc-card-hd"><h3>线路运行状态</h3>' + stMoreBtn() + '</div>'
      + '<div class="st-table-wrap"><table class="st-table"><thead><tr><th>线路</th><th class="num">在途车辆</th><th class="num">运输量(t)</th><th class="num">平均时长</th><th class="num">完成率</th><th>状态</th></tr></thead><tbody>'
      + routeRows + '</tbody></table></div></section>'
      + '<section class="dc-card st-cargo"><div class="dc-card-hd"><h3>货物运输情况</h3>' + stMoreBtn() + '</div>'
      + '<ul class="st-cargo-list">' + cargoHtml + '</ul></section>'
      + '<section class="dc-card st-dist"><div class="dc-card-hd"><h3>在途任务分布</h3><span class="st-hd-sub">按剩余里程</span>' + stMoreBtn() + '</div>'
      + dist + '</section></div></div>';
  }

  function vmPinHtml(v, showLabel) {
    var on = selectedPlate === v.plate ? ' is-on' : '';
    var label = showLabel ? ' has-label' : '';
    var warning = vmWarningsForPlate(v.plate, true).length ? ' has-warning' : '';
    var statusName = vmVehicleRuntimeName(v);
    var statusTone = vmVehicleRuntimeTone(v);
    return '<button class="vm-pin is-' + statusTone + on + label + warning + '" data-vm-plate="' + esc(v.plate) + '" type="button" aria-label="' + esc(v.plate) + '，' + esc(statusName) + (warning ? '，存在当前运输预警' : '') + '"><span class="vm-pin-orbit"><img src="/fleet-assets/dispatch-van-cutout.png" alt=""></span>'
      + '<span class="vm-pin-hover" aria-hidden="true"><b>' + esc(v.plate) + '</b><small>' + esc(statusName) + '</small></span></button>';
  }
  function vmPaintTaskRowHover(plate, active) {
    document.querySelectorAll('#vmList [data-vm-plate]').forEach(function (row) {
      row.classList.toggle('is-map-hover', !!active && row.getAttribute('data-vm-plate') === plate);
    });
  }
  function vmListCardsHtml() {
    var rows = vmVisibleRows();
    var pages = Math.max(1, Math.ceil(rows.length / VM_PAGE));
    if (vmState.page > pages) vmState.page = pages;
    var slice = rows.slice((vmState.page - 1) * VM_PAGE, vmState.page * VM_PAGE);
    if (!slice.length) {
      return '<div class="vm-empty"><b>没有符合条件的车辆</b><span>试试清空搜索或切换筛选</span></div>';
    }
    return slice.map(function (vehicle) {
      var task = vmTaskForVehicle(vehicle);
      var on = selectedPlate === vehicle.plate ? ' is-on' : '';
      var statusName = vmVehicleStatusName(vehicle);
      var statusTone = vmVehicleStatusTone(vehicle);
      var runtimeStatus = vmVehicleRuntimeStatus(vehicle);
      var runtimeName = vmVehicleRuntimeName(vehicle);
      var route = task ? task.route : (vehicle.st === 'idle' ? '暂无执行任务' : vehicle.route);
      var hasTaskContext = !!task;
      var customer = hasTaskContext ? ((task && task.customer) || vehicle.customer || '—') : '—';
      var cargo = hasTaskContext ? ((task && task.cargo) || vehicle.cargo || '') : '';
      var cargoHtml = cargo
        ? '<em class="vm-cargo-tag" data-cargo="' + esc(cargo) + '">' + esc(cargo) + '</em>'
        : '<em class="vm-cargo-tag is-empty">—</em>';
      return '<button class="vm-task-row vm-vehicle-row' + on + '" type="button" data-vm-plate="' + esc(vehicle.plate) + '" onclick="WB.vmVehicleSelect(\'' + esc(vehicle.plate) + '\')" onmouseenter="WB.vmVehicleHover(\'' + esc(vehicle.plate) + '\',true)" onmouseleave="WB.vmVehicleHover(\'' + esc(vehicle.plate) + '\',false)" onfocus="WB.vmVehicleHover(\'' + esc(vehicle.plate) + '\',true)" onblur="WB.vmVehicleHover(\'' + esc(vehicle.plate) + '\',false)">'
        + '<div class="vm-task-top"><b>' + esc(vehicle.plate) + '</b><em class="vm-st is-' + statusTone + '">' + esc(statusName) + '</em></div>'
        + '<strong class="vm-task-route">' + esc(route) + '</strong>'
        + '<div class="vm-vehicle-biz-line"><span class="vm-vehicle-customer" title="' + esc(customer) + '">' + esc(customer) + '</span>' + cargoHtml + '</div>'
        + '<div class="vm-runtime-line vm-vehicle-summary-line is-' + runtimeStatus + '"><span>' + esc(vehicle.driver) + '<i></i><b>' + esc(runtimeName) + '</b></span></div></button>';
    }).join('');
  }
  function vmPagerHtml() {
    var total = vmVisibleRows().length;
    var pages = Math.max(1, Math.ceil(total / VM_PAGE));
    var cur = vmState.page;
    var btns = '';
    var pageItems = [];
    var i;
    for (i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || Math.abs(i - cur) <= 1 || (cur <= 2 && i <= 3) || (cur >= pages - 1 && i >= pages - 2)) {
        pageItems.push(i);
      } else if (pageItems[pageItems.length - 1] !== 'ellipsis') {
        pageItems.push('ellipsis');
      }
    }
    pageItems.forEach(function (item) {
      if (item === 'ellipsis') {
        btns += '<span class="vm-pg-ellipsis" aria-hidden="true">…</span>';
        return;
      }
      btns += '<button type="button" aria-label="第 ' + item + ' 页"' + (item === cur ? ' aria-current="page"' : '') + ' class="' + (item === cur ? 'is-on' : '') + '" onclick="WB.vmPage(' + item + ')">' + item + '</button>';
    });
    return '<button type="button" class="vm-pg-nav" aria-label="上一页" onclick="WB.vmPage(' + Math.max(1, cur - 1) + ')"' + (cur <= 1 ? ' disabled' : '') + '>‹</button>'
      + btns
      + '<button type="button" class="vm-pg-nav" aria-label="下一页" onclick="WB.vmPage(' + Math.min(pages, cur + 1) + ')"' + (cur >= pages ? ' disabled' : '') + '>›</button>';
  }
  function vmChartSvg(kind) {
    var w = 360;
    var h = 128;
    var padL = 28;
    var padR = 8;
    var padT = 10;
    var padB = 22;
    var xs = [0, 4, 8, 12, 16, 20];
    var labels = xs.map(function (hh) {
      var x = padL + hh / 20 * (w - padL - padR);
      return '<text x="' + x.toFixed(1) + '" y="' + (h - 6) + '" text-anchor="middle" fill="#9aa0ae" font-size="10">' + (hh < 10 ? '0' : '') + hh + ':00</text>';
    }).join('');
    function gx(max, step) {
      var out = '';
      var n;
      for (n = 0; n <= max; n += step) {
        var y = padT + (1 - n / max) * (h - padT - padB);
        out += '<line x1="' + padL + '" x2="' + (w - padR) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#eef0f4"/>'
          + '<text x="' + (padL - 6) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end" fill="#9aa0ae" font-size="10">' + n + (kind === 'soc' ? '%' : '') + '</text>';
      }
      return out;
    }
    if (kind === 'mile') {
      var drive = [8, 12, 10, 18, 42, 88, 126, 168, 142, 110, 156, 188, 164, 128, 96, 72, 54, 38, 22, 14, 8];
      var idle = [4, 6, 8, 10, 16, 22, 28, 24, 20, 18, 22, 26, 24, 20, 16, 14, 12, 10, 8, 6, 4];
      var max = 300;
      var bw = (w - padL - padR) / 21;
      var bars = drive.map(function (n, i) {
        var x = padL + i * bw + 1.2;
        var dh = n / max * (h - padT - padB);
        var ih = idle[i] / max * (h - padT - padB);
        var y1 = h - padB - dh;
        var y2 = y1 - ih;
        return '<rect x="' + x.toFixed(1) + '" y="' + y2.toFixed(1) + '" width="' + (bw - 2.4).toFixed(1) + '" height="' + ih.toFixed(1) + '" rx="1" fill="#bfdbfe"/>'
          + '<rect x="' + x.toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + (bw - 2.4).toFixed(1) + '" height="' + dh.toFixed(1) + '" rx="1" fill="#2563eb"/>';
      }).join('');
      return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="vm-chart-svg">' + gx(300, 100) + bars + labels + '</svg>';
    }
    var data = kind === 'soc'
      ? [96, 94, 93, 91, 88, 84, 80, 76, 74, 72, 70, 68, 66, 65, 64, 63, 62, 62, 62, 62, 62]
      : [0, 0, 0, 12, 28, 62, 78, 90, 72, 58, 82, 76, 70, 64, 74, 68, 52, 36, 18, 8, 0];
    var maxN = kind === 'soc' ? 100 : 120;
    var step = kind === 'soc' ? 20 : 30;
    var pts = data.map(function (n, i) {
      var x = padL + i / 20 * (w - padL - padR);
      var y = padT + (1 - n / maxN) * (h - padT - padB);
      return [x, y];
    });
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var area = line + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (h - padB) + ' L' + pts[0][0].toFixed(1) + ' ' + (h - padB) + ' Z';
    var color = kind === 'soc' ? '#22c55e' : '#2563eb';
    var fill = kind === 'soc' ? 'rgba(34,197,94,.16)' : 'rgba(37,99,235,.14)';
    var dots = pts.filter(function (_, i) { return i % 2 === 0; }).map(function (p) {
      return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.2" fill="#fff" stroke="' + color + '" stroke-width="1.6"/>';
    }).join('');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="vm-chart-svg">' + gx(maxN, step)
      + '<path d="' + area + '" fill="' + fill + '"/>'
      + '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2"/>'
      + dots + labels + '</svg>';
  }
  function vmTruckArt() {
    return '<svg class="vm-truck-art" viewBox="0 0 220 120" aria-hidden="true">'
      + '<defs><linearGradient id="vmSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8f1fb"/><stop offset="1" stop-color="#f7fafc"/></linearGradient>'
      + '<linearGradient id="vmBody" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#e8edf3"/></linearGradient></defs>'
      + '<rect width="220" height="120" rx="10" fill="url(#vmSky)"/>'
      + '<rect x="0" y="92" width="220" height="28" fill="#eef2f6"/>'
      + '<rect x="18" y="48" width="92" height="44" rx="6" fill="url(#vmBody)" stroke="#d5dde6"/>'
      + '<path d="M110 58h42l22 18v16H110V58z" fill="url(#vmBody)" stroke="#d5dde6"/>'
      + '<rect x="118" y="64" width="28" height="16" rx="3" fill="#94a3b8" opacity=".45"/>'
      + '<rect x="28" y="56" width="22" height="14" rx="2" fill="#64748b" opacity=".28"/>'
      + '<rect x="56" y="56" width="22" height="14" rx="2" fill="#64748b" opacity=".28"/>'
      + '<rect x="84" y="56" width="16" height="14" rx="2" fill="#64748b" opacity=".28"/>'
      + '<circle cx="48" cy="94" r="11" fill="#1f2937"/><circle cx="48" cy="94" r="5" fill="#e5e7eb"/>'
      + '<circle cx="148" cy="94" r="11" fill="#1f2937"/><circle cx="148" cy="94" r="5" fill="#e5e7eb"/>'
      + '<rect x="168" y="78" width="8" height="6" rx="1" fill="#ef4444"/>'
      + '</svg>';
  }
  function vmVehicleWorkload(vehicle) {
    var seed = String(vehicle.plate || '').split('').reduce(function (sum, char) { return sum + char.charCodeAt(0); }, 0);
    var labels = ['09/03', '09/04', '09/05', '09/06', '09/07', '09/08', '今日'];
    return labels.map(function (label, index) {
      var trips = index === 6 ? Number(vehicle.todayTrips || 0) : 1 + ((seed + index * 3) % 4);
      var ton = trips ? trips * (30 + ((seed + index) % 5)) : 0;
      return { label: label, trips: trips, ton: ton };
    });
  }
  function vmVehicleWorkloadChartHtml(vehicle) {
    var rows = vmVehicleWorkload(vehicle);
    var maxTon = Math.max.apply(Math, rows.map(function (row) { return row.ton; })) || 1;
    return rows.map(function (row) {
      var height = Math.max(8, Math.round(row.ton / maxTon * 100));
      return '<div class="vm-workload-bar" aria-label="' + row.label + '，运输 ' + row.ton + ' 吨，' + row.trips + ' 个任务单">'
        + '<b>' + row.ton + '</b><i><span style="height:' + height + '%"><em>' + row.trips + '单</em></span></i><small>' + row.label + '</small></div>';
    }).join('');
  }
  function vmWeighbillWeight(value) {
    var amount = parseFloat(value);
    return Number.isFinite(amount) ? amount.toFixed(1) + ' t' : '—';
  }
  function vmWeighbillHtml(task) {
    var loadNet = parseFloat(task.loadWeight);
    var unloadNet = parseFloat(task.unloadWeight);
    var hasLoad = Number.isFinite(loadNet);
    var hasUnload = Number.isFinite(unloadNet);
    var loadGross = task.loadGrossWeight || (hasLoad ? (loadNet + 16.8).toFixed(1) + ' t' : '—');
    var unloadGross = task.unloadGrossWeight || (hasUnload ? (unloadNet + 16.8).toFixed(1) + ' t' : '—');
    var loadTare = task.loadTareWeight || (hasLoad ? (parseFloat(loadGross) - loadNet).toFixed(1) + ' t' : '—');
    var unloadTare = task.unloadTareWeight || (hasUnload ? (parseFloat(unloadGross) - unloadNet).toFixed(1) + ' t' : '—');
    function card(title, tone, gross, tare, net) {
      return '<section class="vm-weighbill-card is-' + tone + '"><header><div><b>' + title + '</b></div></header>'
        + '<div class="vm-weighbill-values"><div><span>毛重</span><b>' + esc(vmWeighbillWeight(gross)) + '</b></div>'
        + '<div><span>皮重</span><b>' + esc(vmWeighbillWeight(tare)) + '</b></div>'
        + '<div><span>净重</span><b>' + esc(vmWeighbillWeight(net)) + '</b></div></div></section>';
    }
    return '<div class="vm-weighbill-list">'
      + card('装货磅单', hasLoad ? 'ready' : 'pending', loadGross, loadTare, task.loadWeight)
      + card('卸货磅单', hasUnload ? 'ready' : 'pending', unloadGross, unloadTare, task.unloadWeight) + '</div>';
  }
  function vmWarningPublicFacts(warning) {
    return (warning.facts || []).filter(function (fact) {
      return !/阈值|后台规则|规则阈值|默认\s*\d+\s*min/.test(String(fact || ''));
    });
  }
  function vmWarningFocusHtml(warning) {
    if (!warning) return '';
    var recovered = warning.status === 'recovered';
    var facts = vmWarningPublicFacts(warning).map(function (fact) { return '<li>' + esc(fact) + '</li>'; }).join('');
    return '<section class="vm-vehicle-warning-focus is-' + warning.status + '">'
      + '<header><span>' + (recovered ? '已恢复' : '预警中') + '</span><time>' + esc(warning.duration) + '</time></header>'
      + '<h4>' + esc(warning.type) + '</h4>'
      + '<p>' + esc(warning.reason) + '</p>'
      + (facts ? '<ul>' + facts + '</ul>' : '')
      + '</section>';
  }
  function vmPinnedWarnings(vehicle, selectedWarning) {
    if (selectedWarning) return [selectedWarning];
    if (!vehicle) return [];
    return vmWarningsForPlate(vehicle.plate, true).sort(function (a, b) {
      return vmWarningMinutes(b) - vmWarningMinutes(a);
    });
  }
  function vmVehicleWarningsSectionHtml(vehicle, selectedWarning) {
    var warnings = vmWarningsForPlate(vehicle.plate, true);
    if (selectedWarning && !warnings.some(function (item) { return item.id === selectedWarning.id; })) {
      warnings = [selectedWarning].concat(warnings);
    }
    var visible = selectedWarning ? warnings : warnings.slice(0, 2);
    var list = visible.length ? visible.map(function (item) {
      var selected = selectedWarning && item.id === selectedWarning.id;
      var facts = selected && item.facts && item.facts.length
        ? '<ul>' + item.facts.map(function (fact) { return '<li>' + esc(fact) + '</li>'; }).join('') + '</ul>'
        : '';
      return '<button type="button" class="vm-vehicle-warning is-' + item.cat + (selected ? ' is-selected is-expanded' : '') + '" onclick="WB.vmWarningSelect(\'' + item.id + '\')">'
        + '<i>' + vmWarningIcon(item.cat) + '</i><span><b>' + esc(item.type) + '</b><em>' + esc(item.reason) + '</em>' + facts + '</span><time>' + esc(item.duration) + '</time></button>';
    }).join('') : '<div class="vm-vehicle-warning-empty"><i></i><span><b>当前无运输预警</b></span></div>';
    var more = warnings.length
      ? '<button type="button" onclick="WB.vmOpenPlateWarnings(\'' + esc(vehicle.plate) + '\')">查看全部 ' + warnings.length + ' 条</button>'
      : '';
    return '<section class="vm-vehicle-warnings"><header><div><b>当前运输预警</b><span>仅展示该车实时预警</span></div>' + more + '</header><div>' + list + '</div></section>';
  }
  function vmVehicleInsightHtml(options) {
    options = options || {};
    var warning = options.warning || null;
    var vehicle = vmSelected() || (warning ? vmWarningVehicle(warning) : null);
    if (!vehicle) return warning ? vmWarningPanelHtml() : vmDetailHtml();
    var task = vmSelectedTask();
    var businessName = vmVehicleStatusName(vehicle);
    var workload = vmVehicleWorkload(vehicle);
    var weekTon = workload.reduce(function (sum, row) { return sum + row.ton; }, 0);
    var weekTrips = workload.reduce(function (sum, row) { return sum + row.trips; }, 0);
    var hasCurrentTask = vmVehicleMatchesStatus(vehicle, 'has_task') || vmVehicleMatchesStatus(vehicle, 'pending_transport');
    var currentTask = task ? task.id : (hasCurrentTask ? vehicle.task : '暂无执行任务');
    var currentRoute = task ? task.route : vehicle.route;
    var currentLocation = vehicle.loc;
    if (currentLocation === currentRoute && vehicle.addr) {
      currentLocation = vehicle.addr.replace(/^云南省玉溪市红塔区\s*/, '');
    }
    var currentNode = task ? task.nodeLabel : businessName;
    var nextTask = task && task.nextTask && task.nextTask !== '暂无' ? task.nextTask : '暂无后续任务';
    var activeDetail = hasCurrentTask ? vmState.detail : 'live';
    var tabDefs = [
      { id: 'task', name: '任务概览', disabled: !hasCurrentTask },
      { id: 'nodes', name: '节点时间', disabled: !hasCurrentTask },
      { id: 'bill', name: '磅单信息', disabled: !hasCurrentTask },
      { id: 'live', name: '车辆状态', disabled: false }
    ];
    var tabs = tabDefs.map(function (tab) {
      return '<button type="button" class="' + (activeDetail === tab.id ? 'is-on' : '') + '"' + (tab.disabled
        ? ' disabled aria-disabled="true" title="当前车辆暂无运输任务"'
        : ' onclick="WB.vmDetail(\'' + tab.id + '\')"') + '>' + tab.name + '</button>';
    }).join('');
    var currentTaskData = task || {
      id: currentTask, taskType: '直达任务单', nodeLabel: currentNode, cargo: vehicle.cargo, weight: vehicle.weight, expectedWeight: vehicle.weight,
      waybill: vehicle.waybill, direction: vehicle.direction || vmRouteDirection(vehicle.from, vehicle.to),
      route: currentRoute, project: vehicle.project, fleet: vehicle.fleet, customer: vehicle.customer,
      driver: vehicle.driver, eta: vehicle.eta, nodeTime: vehicle.time, nodeText: vehicle.loc, remain: vehicle.remain,
      soc: vehicle.soc, monitorStatus: hasCurrentTask ? 'executing' : 'waiting', t: vehicle.t, nextTask: nextTask,
      weighStatus: hasCurrentTask ? '运输中，待上传' : '暂无任务', loadArrive: '08:18', loadLeave: '09:02',
      unloadArrive: '—', unloadLeave: '—', dispatchAt: '07:12', acceptAt: '07:20', startAt: '07:42', finishAt: '—',
      loadWeight: hasCurrentTask ? '32.0 t' : '—', unloadWeight: '待确认', cargoDiff: '待确认', stopCount: 1,
      stopMinutes: 12, emptyLink: '无衔接空驶单'
    };
    var lifecycle = [
      ['调度派单', currentTaskData.dispatchAt], ['司机接单', currentTaskData.acceptAt],
      ['开始运输', currentTaskData.startAt], ['到达装货点', currentTaskData.loadArrive],
      ['离开装货点', currentTaskData.loadLeave], ['到达卸货点', currentTaskData.unloadArrive],
      ['离开卸货点', currentTaskData.unloadLeave], ['运输完成', currentTaskData.finishAt]
    ];
    var pinnedWarnings = vmPinnedWarnings(vehicle, warning);
    var warningFocusHtml = pinnedWarnings.map(vmWarningFocusHtml).join('');
    var warningHtml = vmVehicleWarningsSectionHtml(vehicle, warning);
    var tabBody = '';
    if (activeDetail === 'task') {
      tabBody = '<section class="vm-detail-section"><dl class="vm-kv">'
        + '<div><dt>任务单号</dt><dd class="mono">' + esc(currentTaskData.id) + '</dd></div><div><dt>任务单类型</dt><dd>' + esc(currentTaskData.taskType || '直达任务单') + '</dd></div>'
        + '<div><dt>客户</dt><dd>' + esc(currentTaskData.customer) + '</dd></div>'
        + '<div><dt>货物 / 派单吨位</dt><dd>' + esc(currentTaskData.cargo) + ' / ' + esc(currentTaskData.expectedWeight || currentTaskData.weight) + '</dd></div><div><dt>分段线路</dt><dd>' + esc(currentTaskData.route) + '</dd></div>'
        + '<div><dt>运单号</dt><dd class="mono">' + esc(currentTaskData.waybill || '—') + '</dd></div><div><dt>流向</dt><dd>' + esc(currentTaskData.direction || '—') + '</dd></div></dl></section>';
    } else if (activeDetail === 'nodes') {
      var currentNodeIndex = lifecycle.findIndex(function (item) { return !item[1] || item[1] === '—'; });
      var lifecycleHtml = lifecycle.map(function (item, index) {
        var done = !!item[1] && item[1] !== '—';
        var current = !done && index === currentNodeIndex;
        return '<li class="' + (done ? 'is-done' : current ? 'is-current' : '') + '"><i></i><div><b>' + item[0] + '</b><span>' + esc(done ? item[1] : (current ? '当前待完成' : '待发生')) + '</span></div></li>';
      }).join('');
      tabBody = '<ol class="vm-lifecycle">' + lifecycleHtml + '</ol>';
    } else if (activeDetail === 'bill') {
      tabBody = vmWeighbillHtml(currentTaskData);
    } else {
      var realtimeMileageText = vehicle.realtimeMileage != null
        ? Number(vehicle.realtimeMileage).toLocaleString('zh-CN', { maximumFractionDigits: 1 })
        : '—';
      var todayMileageText = Number(vehicle.todayMileage != null ? vehicle.todayMileage : 0).toLocaleString('zh-CN', { maximumFractionDigits: 1 });
      var averageEnergyText = vehicle.averageEnergyConsumption != null
        ? Number(vehicle.averageEnergyConsumption).toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        : '—';
      var vehicleWeightText = vehicle.vehicleWeight != null ? Number(vehicle.vehicleWeight).toLocaleString('zh-CN', { maximumFractionDigits: 1 }) : '—';
      tabBody = '<div class="vm-vehicle-facts is-seven"><div><span>SOC</span><b>' + vehicle.soc + '%</b></div><div><span>当前速度</span><b>' + vehicle.speed + '<small> km/h</small></b></div><div><span>实时里程</span><b>' + realtimeMileageText + (realtimeMileageText === '—' ? '' : '<small> km</small>') + '</b></div><div><span>今日里程</span><b>' + todayMileageText + '<small> km</small></b></div><div><span>剩余续航里程</span><b>' + vehicle.range + '<small> km</small></b></div><div><span>车重</span><b>' + vehicleWeightText + (vehicleWeightText === '—' ? '' : '<small> t</small>') + '</b></div><div><span>平均电耗</span><b>' + averageEnergyText + (averageEnergyText === '—' ? '' : '<small> kWh/100km</small>') + '</b></div></div>'
        + (pinnedWarnings.length ? '' : warningHtml);
    }
    var backHtml = warning
      ? '<button type="button" class="vm-workspace-back vm-review-back" onclick="WB.vmWarningBack()"><span aria-hidden="true">‹</span><b>返回列表</b></button>'
      : '';
    var closeHtml = warning
      ? '<button type="button" class="vm-close" onclick="WB.vmWarningClose()" aria-label="关闭运输预警中心">×</button>'
      : '<button type="button" class="vm-close" onclick="WB.vmClose()" aria-label="关闭车辆详情">×</button>';
    return '<section class="dc-card vm-vehicle-insight' + (warning ? ' is-warning-detail' : '') + '" id="' + (warning ? 'vmWarnings' : 'vmDetail') + '">'
      + '<header class="vm-vehicle-insight-hd">' + backHtml + '<i class="vm-row-ico is-' + vehicle.st + '">' + vmTruckSvg() + '</i><div><b>' + esc(vehicle.plate) + '<small> / ' + esc(vehicle.trailer || '挂车未绑定') + '</small></b><span>' + esc(vehicle.driver) + ' · ' + esc(vehicle.phone || '电话未录入') + ' · ' + esc(vehicle.fleet) + '</span><em class="vm-vehicle-vin">VIN ' + esc(vehicle.vin || '—') + '</em></div>'
      + closeHtml + '</header>'
      + '<div class="vm-vehicle-insight-body">'
      + '<section class="vm-vehicle-now"><div><span>当前位置</span><b title="' + esc(currentLocation) + '">' + esc(currentLocation) + '</b><em>定位时间：' + esc(vehicle.updated) + '</em></div></section>'
      + warningFocusHtml
      + '<section class="vm-vehicle-workload is-pinned"><header><div><b>近7日运输量</b><span>每日运输吨数 · 柱内为任务单</span></div><strong>' + weekTon + '<small> t</small><em>' + weekTrips + ' 单</em></strong></header><div class="vm-workload-chart">' + vmVehicleWorkloadChartHtml(vehicle) + '</div></section>'
      + '<nav class="vm-dtabs vm-vehicle-dtabs" aria-label="' + (warning ? '预警详情视图' : '车辆详情视图') + '">' + tabs + '</nav><div class="vm-vehicle-tab-content">' + tabBody + '</div>'
      + '</div></section>';
  }
  function vmDetailHtml() {
    var v = vmSelected();
    var task = vmSelectedTask();
    if (!v && !task) {
      return '<div class="vm-detail-empty">' + vmTruckSvg() + '<b>选择一条任务查看详情</b><span>点击左侧列表或地图点位</span></div>';
    }
    var meta = v ? vmMeta(v.st) : { name: '待派车' };
    var detailStatus = task ? task.nodeLabel : meta.name;
    var detailStatusClass = task ? (task.businessStatus || task.node) : v.st;
    var tabDefs = [
      { id: 'task', name: '任务概览' },
      { id: 'nodes', name: '节点时间' },
      { id: 'bill', name: '磅单信息' },
      { id: 'live', name: '车辆状态', disabled: !v }
    ];
    var tabs = tabDefs.map(function (t) {
      return '<button type="button" class="' + (vmState.detail === t.id ? 'is-on' : '') + '"' + (t.disabled ? ' disabled aria-disabled="true" title="分配车辆后可查看"' : ' onclick="WB.vmDetail(\'' + t.id + '\')"') + '>' + esc(t.name) + '</button>';
    }).join('');
    var body = '';
    var footer = '';
    var activeWarnings = v ? vmWarningsForPlate(v.plate, true) : [];
    var currentTask = task || {
      id: v.task, taskType: '直达任务单', nodeLabel: meta.name, cargo: v.cargo, weight: v.weight, expectedWeight: v.weight,
      waybill: v.waybill, direction: v.direction || vmRouteDirection(v.from, v.to),
      route: v.route, project: v.project, fleet: v.fleet, customer: v.customer,
      driver: v.driver, eta: v.eta, nodeTime: '—', nodeText: '任务执行中', remain: v.remain,
      soc: v.soc, monitorStatus: 'executing', t: v.t, preassign: v.preassign, nextTask: '暂无',
      weighStatus: '运输中，待上传', loadArrive: '08:18', loadLeave: '09:02', unloadArrive: '—', unloadLeave: '—',
      dispatchAt: '07:12', acceptAt: '07:20', startAt: '07:42', finishAt: '—',
      loadWeight: '32.0 t', unloadWeight: '待确认', cargoDiff: '待确认', stopCount: 1, stopMinutes: 12,
      emptyLink: '无衔接空驶单'
    };
    if (vmState.detail === 'live') {
      if (!v) {
        body = '<div class="vm-unassigned-state"><b>车辆尚未分配</b><span>完成车辆与司机分配后，此处展示实时 SOC、速度、位置与当前任务占用。</span></div>';
      } else {
        var health = v.st === 'offline'
        ? '<div class="vm-health is-offline"><span>定位已中断</span><b>最后在线 ' + esc(v.time) + '</b><em>地图位置为最后有效定位，仅供异常排查参考</em></div>'
        : '<div class="vm-health"><span>车辆在线</span><b>' + esc(meta.name) + '</b><em>定位更新时间 ' + esc(v.updated) + '</em></div>';
        body = health
        + '<div class="vm-hero"><dl><div><dt>牵引车</dt><dd>' + esc(v.model) + '</dd></div>'
        + '<div><dt>司机</dt><dd>' + esc(v.driver) + ' <a href="tel:' + esc(v.phone) + '">' + esc(vmMaskPhone(v.phone)) + '</a></dd></div>'
        + '<div><dt>所属车队</dt><dd>' + esc(v.fleet) + '</dd></div>'
        + '<div><dt>VIN</dt><dd class="mono">' + esc(v.vin) + '</dd></div></dl></div>'
        + '<div class="vm-metrics"><div><span>SOC</span><b>' + v.soc + '%</b><i class="vm-soc"><em style="width:' + v.soc + '%"></em></i></div>'
        + '<div><span>剩余续航里程</span><b>' + v.range + ' <small>km</small></b></div>'
        + '<div><span>当前速度</span><b>' + v.speed + ' <small>km/h</small></b></div></div>'
        + '<dl class="vm-kv vm-vehicle-work"><div><dt>今日完成任务单</dt><dd>' + v.todayTrips + ' 单</dd></div><div><dt>今日累计行驶</dt><dd>' + esc(v.todayDrive) + '</dd></div><div><dt>当前任务占用</dt><dd>' + esc(currentTask.nodeLabel) + '</dd></div><div><dt>下一预派任务</dt><dd>' + esc(currentTask.nextTask || v.preassign) + '</dd></div>'
        + (v.st === 'charge' ? '<div><dt>本次充电</dt><dd>' + esc(v.chargeStart) + ' 开始 · SOC ' + esc(v.chargeDelta) + '</dd></div>' : '') + '</dl>'
        + '<div class="vm-trip"><div class="vm-node is-from"><i></i><div><b>' + esc(v.fromLabel) + '</b><span>' + esc(v.departWait) + '</span></div><time>' + esc(v.departTime) + '</time></div>'
        + '<div class="vm-node is-to"><i></i><div><b>' + esc(v.toLabel) + '</b><span>预计到达 <strong>' + esc(v.eta) + '</strong>　剩余 ' + v.remain + ' km</span></div><time>今天 ' + esc(v.eta) + '</time></div></div>'
        + '<div class="vm-loc"><div><span>车辆位置</span><b>' + esc(v.addr) + '</b><em>更新时间：' + esc(v.updated) + '</em></div>'
        + '<button type="button" class="vm-ghost" onclick="WB.vmFocus()">查看大图</button></div>'
        + '<div class="vm-impact"><span>下一任务影响</span><b>' + (v.soc <= 25 ? '低电量，建议释放后优先补能' : '按计划前往大开门装货，预计不受影响') + '</b></div>';
      }
    } else if (vmState.detail === 'task') {
      body = '<section class="vm-detail-section"><dl class="vm-kv">'
        + '<div><dt>任务单号</dt><dd class="mono">' + esc(currentTask.id) + '</dd></div>'
        + '<div><dt>任务单类型</dt><dd>' + esc(currentTask.taskType || '直达任务单') + '</dd></div>'
        + '<div><dt>客户</dt><dd>' + esc(currentTask.customer) + '</dd></div>'
        + '<div><dt>货物 / 派单吨位</dt><dd>' + esc(currentTask.cargo) + ' / ' + esc(currentTask.expectedWeight || currentTask.weight) + '</dd></div>'
        + '<div><dt>分段线路</dt><dd>' + esc(currentTask.route) + '</dd></div>'
        + '<div><dt>运单号</dt><dd class="mono">' + esc(currentTask.waybill || '—') + '</dd></div>'
        + '<div><dt>流向</dt><dd>' + esc(currentTask.direction || '—') + '</dd></div></dl></section>';
    } else if (vmState.detail === 'nodes') {
      var lifecycleNodes = [
        ['调度派单', currentTask.dispatchAt],
        ['司机接单', currentTask.acceptAt],
        ['开始运输', currentTask.startAt],
        ['到达装货点', currentTask.loadArrive],
        ['离开装货点', currentTask.loadLeave],
        ['到达卸货点', currentTask.unloadArrive],
        ['离开卸货点', currentTask.unloadLeave],
        ['运输完成', currentTask.finishAt]
      ];
      var currentNodeIndex = lifecycleNodes.findIndex(function (item) { return !item[1] || item[1] === '—'; });
      var lifecycleHtml = lifecycleNodes.map(function (item, index) {
        var done = !!item[1] && item[1] !== '—';
        var current = !done && index === currentNodeIndex;
        var time = done ? item[1] : (current ? '当前待完成' : '待发生');
        return '<li class="' + (done ? 'is-done' : current ? 'is-current' : '') + '"><i></i><div><b>' + item[0] + '</b><span>' + esc(time) + '</span></div></li>';
      }).join('');
      body = '<ol class="vm-lifecycle">' + lifecycleHtml + '</ol>';
    } else if (vmState.detail === 'bill') {
      body = vmWeighbillHtml(currentTask);
    }
    return '<div class="vm-detail-hd"><i class="vm-row-ico is-' + (v ? v.st : 'waiting') + '">' + vmTruckSvg() + '</i><div class="vm-detail-title"><b>' + esc(currentTask.id) + '</b>'
      + '<span>' + esc(v ? v.plate + ' / ' + (v.trailer || '挂车未绑定') + ' · ' + v.driver + ' · ' + (v.phone || '电话未录入') : '车辆与司机待分配') + '</span></div>'
      + '<em class="vm-st is-' + detailStatusClass + '">' + esc(detailStatus) + '</em>'
      + (activeWarnings.length && v ? '<button type="button" class="vm-detail-warning-badge" onclick="WB.vmOpenPlateWarnings(\'' + esc(v.plate) + '\')">' + activeWarnings.length + '条预警</button>' : '')
      + '<button type="button" class="vm-close" onclick="WB.vmClose()" aria-label="关闭详情">×</button></div>'
      + '<div class="vm-detail-context"><span><small>分段线路</small><b>' + esc(currentTask.route) + '</b></span><em>' + esc(currentTask.cargo) + ' · ' + esc(currentTask.expectedWeight || currentTask.weight) + '</em></div>'
      + '<nav class="vm-dtabs">' + tabs + '</nav>'
      + '<div class="vm-detail-body">' + body + '</div>';
  }
  function vmWarningIcon(cat) {
    if (cat === 'site') return dcSvg('<path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11z"/><circle cx="12" cy="10" r="2"/>');
    if (cat === 'fulfillment') return dcSvg('<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h3"/>');
    if (cat === 'energy') return dcSvg('<path d="M13 2 6 13h6l-1 9 7-12h-6z"/>');
    return dcSvg('<path d="M3 7h11v10H3z"/><path d="M14 11h5l3 3v3h-8"/><circle cx="7" cy="20" r="2"/><circle cx="18" cy="20" r="2"/>');
  }
  function vmAlertHtml() {
    var rows = vmWarningRows();
    if (!rows.length) return '<div class="vm-warning-empty"><b>未找到匹配的预警</b><span>可调整分类或清空搜索条件</span></div>';
    return rows.map(function (warning) {
      var task = vmWarningTask(warning);
      var vehicle = vmWarningVehicle(warning);
      var driver = task ? task.driver : (vehicle ? vehicle.driver : '司机待关联');
      var route = task ? task.route : (vehicle ? vehicle.route : '暂无线路信息');
      var selected = vmState.selectedWarning === warning.id ? ' is-selected' : '';
      return '<button class="vm-alert is-' + warning.cat + ' is-' + warning.status + selected + '" type="button" onclick="WB.vmWarningSelect(\'' + warning.id + '\')">'
        + '<i>' + vmWarningIcon(warning.cat) + '</i><div class="vm-alert-copy"><div class="vm-alert-title"><b>' + esc(warning.type) + '</b><time>' + esc(warning.duration) + '</time></div>'
        + '<strong>' + esc(warning.plate) + ' · ' + esc(driver) + '</strong><span class="vm-alert-route">' + esc(route) + (task ? ' · ' + esc(task.id) : '') + '</span>'
        + '<span class="vm-alert-reason">' + esc(warning.reason) + '</span><footer><em>' + esc(warning.status === 'recovered' ? '恢复 ' + warning.recoveredAt : '触发 ' + warning.time) + '</em><b>查看详情 ›</b></footer></div></button>';
    }).join('');
  }
  function vmWarningPanelHtml() {
    return '<section class="dc-card vm-alerts is-expanded" id="vmWarnings">'
      + '<header class="vm-workspace-hd"><div><span>运输监控</span><h3>运输预警中心</h3></div>'
      + '<button type="button" class="vm-workspace-close" onclick="WB.vmWarningClose()" aria-label="关闭运输预警中心">×</button></header>'
      + (vmState.warningPlate ? '<div class="vm-warning-filter"><span>仅看车辆 <b>' + esc(vmState.warningPlate) + '</b></span><button type="button" onclick="WB.vmClearWarningPlate()">查看全部</button></div>' : '')
      + '<label class="vm-warning-search">' + dcSvg('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>') + '<input type="search" value="' + esc(vmState.warningQ) + '" placeholder="搜索车牌 / 司机" aria-label="搜索运输预警" oninput="WB.vmWarningSearch(this.value)"></label>'
      + '<div class="vm-alert-list" id="vmWarningList">' + vmAlertHtml() + '</div></section>';
  }
  function vmWarningReviewHtml() {
    var warning = vmWarningById(vmState.selectedWarning);
    if (!warning) return vmWarningPanelHtml();
    return vmVehicleInsightHtml({ warning: warning });
  }
  function vmSiteData(name) {
    var rows = {
      '昆钢': { kind: '装货点', entries: 34, current: 8, average: '48 min', longest: '1h 36min', plates: ['云A10105 · 已停留 1h 36min', '云A12345 · 已停留 42min', '云A10121 · 已停留 18min'] },
      '北城': { kind: '卸货点', entries: 29, current: 6, average: '41 min', longest: '1h 16min', plates: ['云A10103 · 已停留 1h 16min', '云A·F4470 · 已停留 38min', '云A10118 · 已停留 21min'] },
      '大开门': { kind: '装货点', entries: 22, current: 5, average: '53 min', longest: '1h 28min', plates: ['云A10111 · 已停留 1h 28min', '云A10129 · 已停留 47min', '云A66666 · 充电 36min'] },
      '研和': { kind: '卸货点', entries: 31, current: 7, average: '46 min', longest: '1h 12min', plates: ['云A·D8021 · 已停留 1h 12min', '云A10133 · 已停留 58min', '云A10109 · 已停留 26min'] }
    };
    var base = rows[name] || { kind: vmSiteKind(name) === 'load' ? '装货点' : '卸货点', entries: 18, current: vmSiteVehicleCount(name), average: '44 min', longest: '1h 08min', plates: [] };
    if (vmState.fleet === 'all') return base;
    var ratio = vmState.fleet === 'A车队' ? .52 : .48;
    var plates = base.plates.filter(function (row) {
      var plate = row.split(' · ')[0];
      var vehicle = monitorVehicles().filter(function (item) { return item.plate === plate; })[0];
      return !vehicle || vmVehicleInScope(vehicle);
    });
    return Object.assign({}, base, {
      entries: Math.max(1, Math.round(base.entries * ratio)),
      current: vmSiteVehicleCount(name),
      plates: plates
    });
  }
  function vmSiteDetailHtml() {
    var name = vmState.selectedSite;
    var site = vmSiteData(name);
    var vehicles = site.plates.map(function (row, index) {
      return '<li><span>' + esc(row) + '</span><button type="button" onclick="WB.vmOpenSiteVehicle(' + index + ')">定位</button></li>';
    }).join('');
    return '<section class="dc-card vm-site-detail">'
      + '<header class="vm-workspace-hd"><div><span>场站实时态势</span><h3>' + esc(name) + ' · ' + esc(site.kind) + '</h3></div><button type="button" class="vm-workspace-close" onclick="WB.vmSiteClose()" aria-label="关闭场站详情">×</button></header>'
      + '<div class="vm-site-body"><div class="vm-site-live"><div><span>当前场内</span><b>' + site.current + '<small> 辆</small></b></div><div><span>今日进场</span><b>' + site.entries + '<small> 辆次</small></b></div><div><span>平均停留</span><b>' + site.average + '</b></div><div><span>最长停留</span><b>' + site.longest + '</b></div></div>'
      + '<div class="vm-subsection"><header><b>场内车辆</b><span>按停留时长排序</span></header><ul class="vm-site-vehicles">' + vehicles + '</ul></div></div></section>';
  }
  function vmMileageTrendHtml(scopeRatio, summary) {
    var dates = ['09/10', '09/11', '09/12', '09/13', '09/14', '09/15', '今日'];
    var baseTransport = [3050, 3334, 3211, 3603, 3489, 3731, 3391];
    var baseEmpty = [546, 570, 514, 510, 526, 504, 498];
    var routeMileage = {
      '昆钢 → 北城': { transport: 1186, empty: 112 },
      '昆钢 → 研和': { transport: 846, empty: 104 },
      '大开门 → 研和': { transport: 694, empty: 102 },
      '大开门 → 北城': { transport: 665, empty: 180 }
    };
    var selected = routeMileage[vmState.taskRoute];
    var transportFactor = scopeRatio * (selected ? selected.transport / baseTransport[6] : 1);
    var emptyFactor = scopeRatio * (selected ? selected.empty / baseEmpty[6] : 1);
    var transport = baseTransport.map(function (value) { return Math.round(value * transportFactor); });
    var empty = baseEmpty.map(function (value) { return Math.round(value * emptyFactor); });
    var total = transport[6] + empty[6];
    var maxTotal = Math.max.apply(Math, transport.map(function (value, index) { return value + empty[index]; }));
    maxTotal = Math.max(500, Math.ceil(maxTotal / 500) * 500);
    var baseY = 98;
    var plotHeight = 84;
    function x(index) { return 32 + index * 41; }
    function h(value) { return value / maxTotal * plotHeight; }
    var grid = [0, .5, 1].map(function (ratio) {
      var gridY = 14 + ratio * plotHeight;
      return '<line x1="28" y1="' + gridY + '" x2="286" y2="' + gridY + '"/><text x="1" y="' + (gridY + 3) + '">' + Math.round(maxTotal * (1 - ratio)) + '</text>';
    }).join('');
    var bars = transport.map(function (value, index) {
      var transportHeight = h(value);
      var emptyHeight = h(empty[index]);
      return '<rect x="' + (x(index) - 8) + '" y="' + (baseY - transportHeight).toFixed(1) + '" width="16" height="' + transportHeight.toFixed(1) + '" rx="2" fill="#3eaef4"/>'
        + '<rect x="' + (x(index) - 8) + '" y="' + (baseY - transportHeight - emptyHeight).toFixed(1) + '" width="16" height="' + emptyHeight.toFixed(1) + '" rx="2" fill="#f0a856"/>'
        + '<text x="' + x(index) + '" y="116" text-anchor="middle">' + dates[index] + '</text>';
    }).join('');
    var seen = {};
    var vehicleRows = vmScopedTasks().filter(function (task) {
      return task.assigned && ['transporting', 'completed'].indexOf(task.businessStatus) >= 0;
    }).filter(function (task) {
      if (seen[task.plate]) return false;
      seen[task.plate] = true;
      return true;
    }).map(function (task) {
      var seed = Number(task.id.slice(-3)) || 0;
      var mileage = 96 + seed % 8 * 8;
      var emptyMileage = 8 + seed % 5 * 4;
      return { plate: task.plate, driver: task.driver, route: task.route, mileage: mileage, empty: emptyMileage };
    }).sort(function (a, b) { return b.mileage - a.mileage; }).slice(0, 3);
    var attention = vehicleRows.map(function (row) {
      return '<li><span><b>' + esc(row.plate) + '</b><em>' + esc(row.driver) + ' · ' + esc(row.route) + '</em></span>'
        + '<strong>' + row.mileage + '<small> km</small></strong><i>空驶 ' + row.empty + ' km</i></li>';
    }).join('');
    return '<div class="vm-mileage-core"><div><span>运输里程</span><b>' + transport[6].toLocaleString() + '<small> km</small></b></div>'
      + '<div><span>空驶里程</span><b>' + empty[6].toLocaleString() + '<small> km</small></b></div></div>'
      + '<div class="vm-mileage-chart"><svg viewBox="0 0 294 122" role="img" aria-label="近 7 日运输里程与空驶里程趋势">' + grid + bars + '</svg></div>'
      + '<div class="vm-mileage-legend"><span class="is-transport">运输里程</span><span class="is-empty">空驶里程</span><em>合计 ' + total.toLocaleString() + ' km</em></div>'
      + '<div class="vm-mileage-attention"><header><b>车辆里程关注</b><span>司机为当前任务绑定</span></header><ul>' + attention + '</ul></div>';
  }
  function vmCargoTrendHtml(scopeRatio) {
    var dates = ['09/10', '09/11', '09/12', '09/13', '09/14', '09/15', '今日'];
    var selectedRoute = vmState.taskRoute;
    var todayByCargo = vmScopedTasks().filter(function (task) {
      return task.businessStatus === 'completed' && task.weighStatus === '复审通过';
    }).reduce(function (totals, task) {
      totals[task.cargo] = (totals[task.cargo] || 0) + (parseFloat(task.unloadWeight) || 0);
      return totals;
    }, {});
    var cargo = [
      { name: '煤炭', color: '#48b8ff', values: [288, 320, 304, 352, 336, 368, 320], routes: { '昆钢 → 北城': 54, '大开门 → 研和': 16, '昆钢 → 研和': 30 } },
      { name: '水泥', color: '#8d8cff', values: [256, 288, 272, 320, 304, 336, 288], routes: { '昆钢 → 北城': 24, '大开门 → 研和': 50, '昆钢 → 研和': 26 } },
      { name: '水渣', color: '#4ed6a5', values: [240, 272, 256, 304, 288, 304, 256], routes: { '昆钢 → 北城': 18, '大开门 → 研和': 28, '昆钢 → 研和': 54 } },
      { name: '矿石', color: '#f2b35f', values: [208, 240, 224, 272, 256, 272, 224], routes: { '昆钢 → 北城': 44, '大开门 → 研和': 34, '昆钢 → 研和': 22 } }
    ].map(function (item) {
      var mainRoute = Object.keys(item.routes).sort(function (a, b) { return item.routes[b] - item.routes[a]; })[0];
      var route = selectedRoute === 'all' ? mainRoute : selectedRoute;
      var routeShare = item.routes[route] || 0;
      var factor = scopeRatio * (selectedRoute === 'all' ? 1 : routeShare / 100);
      var values = item.values.map(function (value) { return Math.round(value * factor); });
      values[values.length - 1] = Math.round(todayByCargo[item.name] || 0);
      return Object.assign({}, item, {
        route: route,
        routeShare: routeShare,
        values: values
      });
    });
    var maxValue = Math.max.apply(Math, cargo.reduce(function (all, item) { return all.concat(item.values); }, []));
    maxValue = Math.max(100, Math.ceil(maxValue / 100) * 100);
    function x(index) { return 28 + index * 44; }
    function y(value) { return 12 + (1 - value / maxValue) * 88; }
    var grid = [0, .5, 1].map(function (ratio) {
      var gridY = 12 + ratio * 88;
      var label = Math.round(maxValue * (1 - ratio));
      return '<line x1="28" y1="' + gridY + '" x2="292" y2="' + gridY + '"/><text x="2" y="' + (gridY + 3) + '">' + label + '</text>';
    }).join('');
    var paths = cargo.map(function (item) {
      var points = item.values.map(function (value, index) { return x(index) + ',' + y(value).toFixed(1); }).join(' ');
      var last = item.values[item.values.length - 1];
      return '<polyline points="' + points + '" fill="none" stroke="' + item.color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<circle cx="' + x(item.values.length - 1) + '" cy="' + y(last).toFixed(1) + '" r="3" fill="' + item.color + '" stroke="#071b2c" stroke-width="2"/>';
    }).join('');
    var xLabels = dates.map(function (date, index) {
      return '<text x="' + x(index) + '" y="120" text-anchor="middle">' + date + '</text>';
    }).join('');
    var todayTotal = cargo.reduce(function (sum, item) { return sum + item.values[6]; }, 0);
    var prevTotal = cargo.reduce(function (sum, item) { return sum + item.values[5]; }, 0);
    var totalDelta = prevTotal ? (todayTotal - prevTotal) / prevTotal * 100 : 0;
    var legend = cargo.map(function (item) {
      var today = item.values[6];
      var previous = item.values[5];
      var delta = previous ? (today - previous) / previous * 100 : 0;
      return '<li><span><i style="background:' + item.color + '"></i><b>' + esc(item.name) + '</b></span>'
        + '<strong>' + today.toLocaleString() + '<small> t</small></strong>'
        + '<em class="' + (delta >= 0 ? 'is-up' : 'is-down') + '">较昨日 ' + (delta > 0 ? '+' : '') + delta.toFixed(1) + '%</em></li>';
    }).join('');
    var routeRows = cargo.map(function (item) {
      return '<li><span><i style="background:' + item.color + '"></i>' + esc(item.name) + '</span><b>' + esc(item.route) + '</b><em>' + item.routeShare + '%</em></li>';
    }).join('');
    return '<div class="vm-cargo-summary"><span><em>今日完成货量</em><b>' + todayTotal.toLocaleString() + '<small> t</small></b></span>'
      + '<strong class="' + (totalDelta >= 0 ? 'is-up' : 'is-down') + '">较昨日 ' + (totalDelta > 0 ? '+' : '') + totalDelta.toFixed(1) + '%</strong></div>'
      + '<div class="vm-cargo-chart"><svg viewBox="0 0 304 126" role="img" aria-label="近 7 日分货物运输吨位趋势">' + grid + paths + xLabels + '</svg></div>'
      + '<ul class="vm-cargo-legend">' + legend + '</ul>'
      + '<div class="vm-cargo-route"><header><b>' + (selectedRoute === 'all' ? '主要贡献线路' : '当前线路贡献') + '</b><span>占该货物今日运输量</span></header><ul>' + routeRows + '</ul></div>';
  }
  function vmOpsDailyCore() {
    var completed = vmScopedTasks().filter(function (task) {
      return task.businessStatus === 'completed' && task.weighStatus === '复审通过';
    });
    function clockMinutes(value) {
      var match = String(value || '').match(/(\d{1,2}):(\d{2})/);
      return match ? Number(match[1]) * 60 + Number(match[2]) : null;
    }
    var cargo = completed.reduce(function (sum, task) { return sum + (parseFloat(task.unloadWeight) || 0); }, 0);
    var durations = completed.map(function (task) {
      var start = clockMinutes(task.loadLeave);
      var end = clockMinutes(task.unloadLeave);
      if (start === null || end === null) return null;
      return end >= start ? end - start : end + 1440 - start;
    }).filter(function (value) { return value !== null; });
    var mileage = completed.map(function (task) { return Number(task.transportKm); }).filter(function (value) { return value > 0; });
    var averageDuration = durations.length ? durations.reduce(function (sum, value) { return sum + value; }, 0) / durations.length : 0;
    var averageMileage = mileage.length ? mileage.reduce(function (sum, value) { return sum + value; }, 0) / mileage.length : 0;
    return {
      cargo: cargo,
      averageCargo: completed.length ? cargo / completed.length : 0,
      averageDuration: averageDuration,
      averageMileage: averageMileage
    };
  }
  function vmDailyTransportData() {
    return [
      {
        key: 'completed',
        name: '已完成',
        rows: [
          { route: '化念矿区 → 研和钢铁', cargo: '铁精粉', trips: 13, tonnage: 421.6 },
          { route: '大展工业园 → 北城建材', cargo: '水渣', trips: 10, tonnage: 318.0 },
          { route: '尖峰水泥厂 → 研和综利', cargo: '水渣', trips: 7, tonnage: 224.7 },
          { route: '矿区东采场 → 玉溪钢铁', cargo: '铁精粉', trips: 2, tonnage: 63.4 },
          { route: '杨武集散点 → 玉溪钢铁', cargo: '铁精粉', trips: 1, tonnage: 59.3 }
        ]
      },
      {
        key: 'transporting',
        name: '运输中',
        rows: [
          { route: '矿区东采场 → 玉溪钢铁', cargo: '铁精粉', trips: 9, tonnage: 286.2 },
          { route: '大展工业园 → 北城建材', cargo: '水渣', trips: 7, tonnage: 218.7 },
          { route: '尖峰水泥厂 → 研和综利', cargo: '水渣', trips: 3, tonnage: 94.2 },
          { route: '化念矿区 → 研和钢铁', cargo: '铁精粉', trips: 1, tonnage: 31.6 }
        ]
      },
      {
        key: 'pending',
        name: '待运输',
        rows: [
          { route: '矿区西采场 → 玉溪钢铁', cargo: '铁精粉', trips: 2, tonnage: 64.0 }
        ]
      }
    ].map(function (group) {
      group.totalTrips = group.rows.reduce(function (sum, row) { return sum + row.trips; }, 0);
      group.totalTonnage = group.rows.reduce(function (sum, row) { return sum + row.tonnage; }, 0);
      return group;
    });
  }
  function vmTonnage(value) {
    if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—';
    return Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  function vmOpsPanelHtml() {
    var daily = vmDailyTransportData();
    var totalTrips = daily.reduce(function (sum, group) { return sum + group.totalTrips; }, 0);
    if (vmState.overviewCollapsed) {
      return '<button type="button" class="vm-overview-rail" onclick="WB.vmToggleOverview()" aria-label="展开运输概览" title="展开运输概览">'
        + '<i aria-hidden="true">' + dcSvg('<path d="m15 18-6-6 6-6"/>') + '</i><span>运输概览</span><b>' + totalTrips + '</b></button>';
    }
    var groups = daily.map(function (group) {
      var rows = group.rows.map(function (row) {
        return '<li aria-label="' + esc('分段线路' + row.route + '，货物' + row.cargo + '，' + row.trips + '车次，' + vmTonnage(row.tonnage) + '吨') + '">'
          + '<span class="vm-daily-item-label"><b class="vm-daily-route" title="' + esc(row.route) + '">' + esc(row.route) + '</b>'
          + '<em class="vm-daily-cargo" data-cargo="' + esc(row.cargo) + '">' + esc(row.cargo) + '</em></span>'
          + '<strong class="vm-daily-item-value"><b class="vm-daily-trips">' + row.trips + '<small>车次</small></b>'
          + '<em class="vm-daily-ton">' + vmTonnage(row.tonnage) + '<small>t</small></em></strong>'
          + '</li>';
      }).join('');
      return '<section class="vm-daily-group is-' + group.key + '" aria-labelledby="vmDaily-' + group.key + '">'
        + '<header><span><i aria-hidden="true"></i><b id="vmDaily-' + group.key + '">' + group.name + '</b></span>'
        + '<span class="vm-daily-group-metrics"><strong>' + group.totalTrips + '<small>车次</small></strong><em>' + vmTonnage(group.totalTonnage) + '<small>t</small></em></span></header>'
        + '<ul>' + rows + '</ul></section>';
    }).join('');
    return '<section class="dc-card vm-ops-panel vm-daily-transport-panel is-docked">'
      + '<header class="vm-workspace-hd vm-daily-head"><div><h3>运输概览</h3></div>'
      + '<div class="vm-daily-head-actions">'
      + '<button class="vm-daily-toggle" type="button" aria-expanded="true" aria-label="收起运输概览" title="收起" onclick="WB.vmToggleOverview()">' + dcSvg('<path d="m9 18 6-6-6-6"/>') + '</button></div></header>'
      + '<div class="vm-ops-body vm-daily-body">' + groups + '</div></section>';
  }
  function vmHomeRightHtml() {
    if (vmState.overviewCollapsed) {
      return '<div class="vm-right-home is-overview-collapsed">' + vmOpsPanelHtml() + '</div>';
    }
    return '<div class="vm-right-home">' + vmOpsPanelHtml() + vmWarningTickerHtml() + '</div>';
  }
  function vmRightPanelHtml() {
    if (vmState.warningOpen) return vmState.selectedWarning ? vmWarningReviewHtml() : vmWarningPanelHtml();
    if (vmState.selectedSite) return vmSiteDetailHtml();
    if (vmSelected()) return vmVehicleInsightHtml();
    if (vmSelectedTask()) return '<section class="dc-card vm-detail" id="vmDetail">' + vmDetailHtml() + '</section>';
    return vmHomeRightHtml();
  }
  function paintVmRightPanel() {
    var right = document.getElementById('vmRightPanel');
    var root = document.querySelector('.dc-root.is-vm');
    if (!right) return;
    right.classList.toggle('is-detail-empty', false);
    right.classList.toggle('is-home', vmIsHomeRight());
    right.classList.toggle('is-overview-collapsed', vmOverviewDocked());
    if (root) root.classList.toggle('is-overview-collapsed', vmOverviewDocked());
    right.innerHTML = vmRightPanelHtml();
    paintVmWarningTicker();
  }
  function paintVmKpis() {
    var box = document.querySelector('.vm-kpis');
    if (box) box.innerHTML = vmKpisHtml();
  }
  function paintVmWarningIndicator() {
    var root = document.getElementById('vmAlertCarousel') || document.querySelector('.vm-warning-indicator');
    if (!root) return;
    var count = vmActiveWarningCount();
    var badge = root.querySelector('.vm-alert-carousel-title b, b');
    if (badge) badge.textContent = count;
    var title = root.querySelector('.vm-alert-carousel-title');
    if (title) title.setAttribute('aria-label', '打开运输预警中心，当前 ' + count + ' 条');
    root.classList.toggle('is-new', !!vmState.warningPulse);
    root.setAttribute('aria-label', '运输预警，当前 ' + count + ' 条');
  }
  function paintVmPageFullscreen() {
    var button = document.querySelector('.vm-page-fullscreen');
    if (!button) return;
    var active = !!document.fullscreenElement;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-label', active ? '退出全屏' : '进入全屏');
    button.setAttribute('title', active ? '退出全屏（Esc）' : '全屏');
    var label = button.querySelector('span');
    if (label) label.textContent = active ? '退出全屏' : '全屏';
  }
  function paintVmPanels() {
    var list = document.getElementById('vmList');
    if (list) list.innerHTML = vmListCardsHtml();
    var pager = document.getElementById('vmPager');
    if (pager) pager.innerHTML = vmPagerHtml();
    // 右侧工作区必须整体重绘，避免在新版车辆卡片容器内写入旧版任务详情结构。
    paintVmRightPanel();
    var search = document.getElementById('vmSearch');
    if (search && search.value !== vmState.q) search.value = vmState.q;
  }
  function paintVmScreen(refreshMap) {
    var left = document.getElementById('vmLeftPanel');
    if (left) {
      left.classList.toggle('is-collapsed', vmState.leftCollapsed);
      left.innerHTML = vmLeftPanelHtml();
    }
    var root = document.querySelector('.dc-root.is-vm');
    if (root) {
      root.classList.toggle('is-left-collapsed', vmState.leftCollapsed);
      root.classList.toggle('is-overview-collapsed', vmOverviewDocked());
    }
    paintVmRightPanel();
    paintVmKpis();
    paintVmWarningIndicator();
    paintVmLayerControl();
    if (refreshMap === false) return;
    if (dispatchMap && window.AMap) refreshDispatchMarkers(window.AMap);
    else renderDispatchFallback(document.getElementById('wbDispatchMap'));
  }
  function paintVmLayerControl() {
    var count = Object.keys(vmState.layers).filter(function (layer) { return !!vmState.layers[layer]; }).length;
    var trigger = document.querySelector('.vm-layer-trigger');
    if (trigger) {
      trigger.classList.toggle('has-custom', count > 2);
      var badge = trigger.querySelector('b');
      if (badge) badge.textContent = count;
    }
    document.querySelectorAll('[data-layer]').forEach(function (field) {
      field.checked = !!vmState.layers[field.getAttribute('data-layer')];
    });
    var traffic = document.querySelector('.vm-traffic-toggle');
    if (traffic) {
      traffic.classList.toggle('is-on', !!vmState.layers.traffic);
      traffic.setAttribute('aria-pressed', String(!!vmState.layers.traffic));
    }
    var legend = document.getElementById('vmLegend');
    if (legend) legend.innerHTML = vmLegendHtml();
  }
  function vmTimelineHtml() {
    var events = [
      ['13:42', '进入昆钢围栏'],
      ['14:08', '任务发车'],
      ['14:36', '短暂停留'],
      ['15:05', '偏航已恢复'],
      ['15:32', '预计到达北城']
    ];
    return events.map(function (e, i) {
      return '<span class="vm-event is-' + i + '"><i></i><b>' + e[0] + '</b><em>' + e[1] + '</em></span>';
    }).join('');
  }
  function vmLeftPanelHtml() {
    var counts = vmVehicleCounts();
    var runtimeCounts = vmVehicleRuntimeCounts();
    var selectedRuntime = vmState.vehicleRuntimeStatuses || [];
    var total = counts.all;
    var placeholder = '搜索车牌 / 司机';
    var vehicleTabs = [
      { id: 'all', name: '全部' },
      { id: 'has_task', name: '运输中' },
      { id: 'pending_transport', name: '待运输' },
      { id: 'no_task', name: '无任务' },
      { id: 'stopped', name: '停运' }
    ].map(function (tab) {
      return '<button type="button" aria-label="' + esc(tab.name) + ' ' + counts[tab.id] + '辆" aria-pressed="' + (vmState.vehicleStatus === tab.id) + '" class="' + (vmState.vehicleStatus === tab.id ? 'is-on' : '') + '" onclick="WB.vmVehicleFilter(\'' + tab.id + '\')">'
        + '<span>' + esc(tab.name) + '</span></button>';
    }).join('');
    var runtimeOptions = [
      { id: 'all', name: '全部' },
      { id: 'driving', name: '行驶中' },
      { id: 'parked', name: '驻车静止' },
      { id: 'charging', name: '充电中' },
      { id: 'offline', name: '离线' }
    ].map(function (option) {
      var on = option.id === 'all' ? !selectedRuntime.length : selectedRuntime.indexOf(option.id) >= 0;
      return '<button type="button" role="option" aria-selected="' + on + '" class="is-' + option.id + (on ? ' is-on' : '') + '" onclick="WB.vmVehicleRuntimeFilter(\'' + option.id + '\')">'
        + '<i></i><span>' + esc(option.name) + '</span><b>' + runtimeCounts[option.id] + '</b></button>';
    }).join('');
    var runtimeLabel = selectedRuntime.length ? '已选 ' + selectedRuntime.length + ' 项' : '全部';
    var runtimeFilter = '<div class="vm-runtime-filter' + (vmState.vehicleRuntimeOpen ? ' is-open' : '') + '">'
      + '<span class="vm-runtime-filter-label">车辆状态</span>'
      + '<button type="button" class="vm-runtime-trigger' + (selectedRuntime.length ? ' has-value' : '') + '" aria-haspopup="listbox" aria-expanded="' + vmState.vehicleRuntimeOpen + '" onclick="WB.vmToggleVehicleRuntime(event)"><span>' + runtimeLabel + '</span><i></i></button>'
      + '<div class="vm-runtime-panel" role="listbox" aria-label="车辆状态多选" aria-multiselectable="true"' + (vmState.vehicleRuntimeOpen ? '' : ' hidden') + ' onclick="event.stopPropagation()">'
      + runtimeOptions + '<small>可多选，与上方业务状态叠加筛选</small></div></div>';
    var routeOptions = DC_LINES.map(function (pair) {
      var route = pair[0] + ' → ' + pair[1];
      return '<option value="' + esc(route) + '"' + (vmState.taskRoute === route ? ' selected' : '') + '>' + esc(route) + '</option>';
    }).join('');
    var filters = '<div class="vm-tabs vm-task-tabs vm-vehicle-tabs">' + vehicleTabs + '</div>'
      + '<div class="vm-filter-row">' + runtimeFilter
      + '<div class="vm-route-filter"><label for="vmTaskRoute">线路</label><select id="vmTaskRoute" onchange="WB.vmTaskRoute(this.value)"><option value="all">全部线路</option>' + routeOptions + '</select></div></div>';
    if (vmState.leftCollapsed) {
      return '<button type="button" class="vm-left-rail" onclick="WB.vmToggleLeftPanel()" aria-label="展开运输车辆面板" title="展开运输车辆面板">'
        + '<i aria-hidden="true">' + dcSvg('<path d="m9 18 6-6-6-6"/>') + '</i><span>运输车辆</span><b>' + total + '</b></button>';
    }
    return '<div class="vm-monitor-head"><h3>运输车辆 <span>(' + total + ')</span></h3>'
      + '<button type="button" class="vm-left-collapse" onclick="WB.vmToggleLeftPanel()" aria-label="收起运输车辆面板" title="收起运输车辆面板">' + dcSvg('<path d="m15 18-6-6 6-6"/>') + '</button></div>'
      + '<span class="vm-sr-only" role="status" aria-live="polite">当前为运输车辆视图，共 ' + total + ' 辆</span>'
      + '<div class="vm-search' + (vmState.q ? ' has-value' : '') + '">' + dcSvg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/>')
      + '<input id="vmSearch" aria-label="' + placeholder + '" placeholder="' + placeholder + '" value="' + esc(vmState.q) + '" oninput="var hasValue=!!this.value.trim();this.parentElement.classList.toggle(\'has-value\',hasValue);this.nextElementSibling.disabled=!hasValue;WB.vmSearch(this.value)">'
      + '<button type="button" class="vm-search-clear" aria-label="清空搜索" title="清空搜索" onclick="WB.vmClearSearch()"' + (vmState.q ? '' : ' disabled') + '>' + dcSvg('<path d="m7 7 10 10M17 7 7 17"/>') + '</button></div>'
      + filters
      + '<div class="vm-list" id="vmList">' + vmListCardsHtml() + '</div>'
      + '<div class="vm-pager" id="vmPager">' + vmPagerHtml() + '</div>';
  }
  function vmKpisHtml() {
    var kpi = vmKpi();
    return kpi.map(function (x) {
      var body = x.pair
        ? '<div class="vm-kpi-pair">' + x.pair.map(function (part) {
            return '<div><span>' + esc(part.label) + '</span><b>' + esc(String(part.value)) + '</b></div>';
          }).join('') + '<em>' + esc(x.meta) + '</em></div>'
        : '<div><span>' + esc(x.name) + '</span><b>' + esc(x.value) + '</b><em>' + esc(x.meta) + '</em></div>';
      return '<div class="vm-kpi is-' + x.tint + '" title="' + esc(x.desc) + '">'
        + '<i>' + vmKpiIcon(x.icon) + '</i>' + body + '</div>';
    }).join('');
  }
  function renderMonitorBody() {
    var kpiHtml = vmKpisHtml();
    var L = vmState.layers;
    var layerItems = [
      ['executing', '运输中车辆', '行驶中、装货中与卸货中', true],
      ['load', '装卸货点', '场站与聚集数量'],
      ['waiting', '待执行车辆', '小图标、低透明度'],
      ['idle', '空闲车辆', '按需查看可派资产'],
      ['offline', '停运车辆', '显示最后定位位置'],
      ['station', '充电站', '选中充电车辆时自动开启'],
      ['fence', '电子围栏', '默认不显示边界'],
      ['traffic', '实时路况', '仅作用于当前线路']
    ];
    var activeLayerCount = layerItems.filter(function (item) { return !!L[item[0]]; }).length;
    var layerMenu = layerItems.map(function (item) {
      return '<label class="vm-layer-option' + (item[3] ? ' is-locked' : '') + '"><input type="checkbox" data-layer="' + item[0] + '"' + (L[item[0]] ? ' checked' : '') + (item[3] ? ' disabled aria-disabled="true"' : '')
        + ' onchange="WB.vmLayer(\'' + item[0] + '\', this.checked)"><span class="vm-layer-check"></span><b>' + item[1] + '</b><small>' + item[2] + '</small></label>';
    }).join('');
    return '<div class="vm-body">'
      + '<section class="vm-map-card"><div class="vm-map-stage"><div id="wbDispatchMap" class="dc-map-canvas"></div>'
      + '<section class="vm-kpis" aria-label="业务态势指标">' + kpiHtml + '</section>'
      + '<section class="dc-card vm-left' + (vmState.leftCollapsed ? ' is-collapsed' : '') + '" id="vmLeftPanel">' + vmLeftPanelHtml() + '</section>'
      + '<div class="vm-map-bar">'
      + '<button type="button" class="vm-traffic-toggle' + (L.traffic ? ' is-on' : '') + '" aria-pressed="' + L.traffic + '" onclick="WB.vmLayer(\'traffic\')"><span>实时路况</span><i aria-hidden="true"></i></button>'
      + '<div class="vm-layer-control' + (vmState.layerOpen ? ' is-open' : '') + '">'
      + '<button type="button" class="vm-layer-trigger' + (activeLayerCount > 2 ? ' has-custom' : '') + '" aria-expanded="' + vmState.layerOpen + '" aria-controls="vmLayerPanel" onclick="WB.vmToggleLayers(event)">'
      + dcSvg('<path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>') + '<span>地图图层</span><b>' + activeLayerCount + '</b></button>'
      + '<div class="vm-layer-panel" id="vmLayerPanel"' + (vmState.layerOpen ? '' : ' hidden') + '><div class="vm-layer-panel-hd"><b>地图图层</b><span>默认聚焦正在发生的运输</span></div>' + layerMenu + '</div></div>'
      + '</div>'
      + '<aside class="vm-right is-home' + (vmOverviewDocked() ? ' is-overview-collapsed' : '') + '" id="vmRightPanel">' + vmRightPanelHtml() + '</aside>'
      + '<div id="vmWarningTickerHost" class="' + (vmState.leftCollapsed ? 'is-left-collapsed' : '') + '">' + (vmWarningTickerOnMap() ? vmWarningTickerHtml() : '') + '</div>'
      + '<div class="vm-legend" id="vmLegend">' + vmLegendHtml() + '</div>'
      + '<div class="vm-zoom"><button type="button" onclick="WB.vmZoom(1)">+</button><button type="button" onclick="WB.vmZoom(-1)">−</button>'
      + '<button type="button" onclick="WB.vmFocus()" title="定位当前车">' + dcSvg('<circle cx="12" cy="12" r="3"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2"/>') + '</button></div>'
      + '</div></section></div>';
  }

  var RA_KIND = { core: '核心线路', branch: '支线线路', loop: '环线线路', custom: '自定义线路' };
  var RA_ROUTES = [
    { id: 'kg-bc', name: '昆钢 → 北城', from: '昆钢', to: '北城', kind: 'core', group: 'frequent', ton: 860, trips: 16, hours: 4.2, rate: 96.2, load: 0.8, drive: 2.6, unload: 0.5, charge: 0.3, dot: '#3b82f6' },
    { id: 'kg-yh', name: '昆钢 → 研和', from: '昆钢', to: '研和', kind: 'core', group: 'frequent', ton: 620, trips: 12, hours: 5.1, rate: 91.3, load: 1.0, drive: 3.1, unload: 0.6, charge: 0.4, dot: '#3b82f6' },
    { id: 'dk-yh', name: '大开门 → 研和', from: '大开门', to: '研和', kind: 'core', group: 'frequent', ton: 540, trips: 10, hours: 4.6, rate: 88.7, load: 1.1, drive: 2.4, unload: 0.7, charge: 0.4, dot: '#3b82f6' },
    { id: 'dk-bc', name: '大开门 → 北城', from: '大开门', to: '北城', kind: 'branch', group: 'frequent', ton: 420, trips: 8, hours: 4.9, rate: 84.1, load: 0.9, drive: 2.8, unload: 0.7, charge: 0.5, dot: '#fa8c16' },
    { id: 'bc-yx', name: '北城 → 玉溪', from: '北城', to: '玉溪', kind: 'branch', group: 'frequent', ton: 280, trips: 6, hours: 3.8, rate: 92.5, load: 0.7, drive: 2.2, unload: 0.6, charge: 0.3, dot: '#fa8c16' },
    { id: 'kg-yx', name: '昆钢 → 玉溪', from: '昆钢', to: '玉溪', kind: 'branch', group: 'frequent', ton: 180, trips: 4, hours: 6.2, rate: 81.4, load: 1.4, drive: 3.6, unload: 0.7, charge: 0.5, dot: '#52c41a' },
    { id: 'yh-yx', name: '研和 → 玉溪', from: '研和', to: '玉溪', kind: 'loop', group: 'loop', ton: 160, trips: 3, hours: 5.8, rate: 86.0, load: 1.2, drive: 3.4, unload: 0.7, charge: 0.5, dot: '#f5222d' },
    { id: 'bc-yh', name: '北城 → 研和', from: '北城', to: '研和', kind: 'loop', group: 'loop', ton: 120, trips: 3, hours: 3.2, rate: 94.8, load: 0.6, drive: 1.8, unload: 0.5, charge: 0.3, dot: '#722ed1' },
    { id: 'yx-kg', name: '玉溪 → 昆钢', from: '玉溪', to: '昆钢', kind: 'custom', group: 'custom', ton: 90, trips: 8, hours: 6.0, rate: 79.2, load: 1.1, drive: 3.5, unload: 0.8, charge: 0.6, dot: '#13c2c2' },
    { id: 'dk-yx', name: '大开门 → 玉溪', from: '大开门', to: '玉溪', kind: 'custom', group: 'custom', ton: 80, trips: 7, hours: 5.4, rate: 82.6, load: 1.0, drive: 3.2, unload: 0.7, charge: 0.5, dot: '#eb2f96' },
    { id: 'yh-bc', name: '研和 → 北城', from: '研和', to: '北城', kind: 'loop', group: 'loop', ton: 70, trips: 5, hours: 3.4, rate: 90.1, load: 0.7, drive: 1.9, unload: 0.5, charge: 0.3, dot: '#2f54eb' },
    { id: 'yx-bc', name: '玉溪 → 北城', from: '玉溪', to: '北城', kind: 'custom', group: 'custom', ton: 60, trips: 4, hours: 3.6, rate: 88.0, load: 0.8, drive: 2.0, unload: 0.5, charge: 0.3, dot: '#a0d911' }
  ];
  var RA_NODES = [
    { name: '北城', in: 16, out: 12, ton: '620 t', left: '38%', top: '6%' },
    { name: '昆钢', in: 8, out: 22, ton: '1,660 t', left: '8%', top: '38%' },
    { name: '研和', in: 22, out: 10, ton: '1,180 t', left: '48%', top: '42%' },
    { name: '大开门', in: 8, out: 18, ton: '960 t', left: '22%', top: '68%' },
    { name: '玉溪', in: 13, out: 4, ton: '440 t', left: '72%', top: '46%' }
  ];
  var RA_TREND = {
    ton: {
      '昆钢 → 北城': [110, 122, 118, 130, 126, 138, 116],
      '昆钢 → 研和': [82, 90, 86, 94, 88, 96, 84],
      '大开门 → 研和': [70, 76, 72, 80, 78, 84, 80],
      '大开门 → 北城': [52, 58, 60, 64, 62, 66, 58]
    },
    trips: {
      '昆钢 → 北城': [2, 3, 2, 3, 2, 2, 2],
      '昆钢 → 研和': [1, 2, 2, 2, 1, 2, 2],
      '大开门 → 研和': [1, 2, 1, 2, 1, 2, 1],
      '大开门 → 北城': [1, 1, 1, 2, 1, 1, 1]
    },
    time: {
      '昆钢 → 北城': [4.4, 4.3, 4.2, 4.1, 4.2, 4.0, 4.2],
      '昆钢 → 研和': [5.4, 5.3, 5.2, 5.1, 5.2, 5.0, 5.1],
      '大开门 → 研和': [4.8, 4.7, 4.6, 4.5, 4.6, 4.4, 4.6],
      '大开门 → 北城': [5.1, 5.0, 4.9, 4.8, 4.9, 4.7, 4.9]
    }
  };
  var RA_TREND_META = [
    { name: '昆钢 → 北城', color: '#3b82f6' },
    { name: '昆钢 → 研和', color: '#22c55e' },
    { name: '大开门 → 研和', color: '#f59e0b' },
    { name: '大开门 → 北城', color: '#a78bfa' }
  ];
  var RA_CARGO = [
    { name: '矿石', ton: 1214, pct: 37, color: '#3b82f6' },
    { name: '钢材', ton: 787, pct: 24, color: '#22d3ee' },
    { name: '煤炭', ton: 689, pct: 21, color: '#fb923c' },
    { name: '焦炭', ton: 361, pct: 11, color: '#a78bfa' },
    { name: '其他', ton: 229, pct: 7, color: '#94a3b8' }
  ];

  function raScale() {
    if (raState.day === 'today') return 0.18;
    if (raState.day === '30d') return 4.2;
    return 1;
  }
  function raNum(n, d) {
    var v = n * raScale();
    if (d == null) d = v >= 100 ? 0 : 1;
    var s = v.toFixed(d);
    if (d > 0) s = s.replace(/\.0$/, '');
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }
  function raInt(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function raFiltered() {
    var q = (raState.q || '').trim();
    return RA_ROUTES.filter(function (r) {
      if (raState.tab === 'frequent' && r.group !== 'frequent') return false;
      if (raState.tab === 'loop' && r.kind !== 'loop') return false;
      if (raState.tab === 'custom' && r.kind !== 'custom') return false;
      if (q && (r.name + r.from + r.to).indexOf(q) < 0) return false;
      return true;
    }).slice().sort(function (a, b) {
      if (raState.sort === 'trips') return b.trips - a.trips;
      if (raState.sort === 'hours') return a.hours - b.hours;
      return b.ton - a.ton;
    });
  }
  function raListItemsHtml() {
    var rows = raFiltered();
    if (!rows.length) {
      return '<div class="ra-empty">没有匹配的线路</div>';
    }
    return rows.map(function (r) {
      var on = raState.selected === r.name ? ' is-on' : '';
      return '<button class="ra-item' + on + '" type="button" onclick="WB.raSelect(\'' + esc(r.name) + '\')">'
        + '<i style="background:' + r.dot + '"></i>'
        + '<div class="ra-item-main"><b>' + esc(r.name) + '</b><span>' + esc(RA_KIND[r.kind]) + '</span></div>'
        + '<div class="ra-item-metrics"><b>' + raInt(r.ton) + ' t</b><span>' + r.trips + ' 单</span><em>' + r.hours.toFixed(1) + ' h</em></div>'
        + '</button>';
    }).join('');
  }
  function raKpiIcon(kind) {
    var icons = {
      list: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
      truck: '<path d="M3 7h11v10H3z"/><path d="M14 11h5l3 3v3h-8"/><circle cx="7" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/>',
      check: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 12l2 2 4-4"/>',
      clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
      box: '<path d="M3 8l9-4 9 4v10l-9 4-9-4z"/><path d="M3 8l9 4 9-4M12 12v10"/>',
      car: '<path d="M3 13l2-5h14l2 5"/><path d="M3 13h18v5H3z"/><circle cx="7.5" cy="18" r="1.6"/><circle cx="16.5" cy="18" r="1.6"/>'
    };
    return dcSvg(icons[kind]);
  }
  function raSelectHtml(id, value, options, fn) {
    return '<select id="' + id + '" onchange="' + fn + '()">' + options.map(function (o) {
      return '<option value="' + o[0] + '"' + (value === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('') + '</select>';
  }
  function raFlowColor(ton) {
    if (ton > 800) return '#3b82f6';
    if (ton >= 500) return '#22c55e';
    if (ton >= 200) return '#f59e0b';
    return '#a78bfa';
  }
  function raFlowWidth(ton) {
    if (ton > 800) return 7;
    if (ton >= 500) return 5.2;
    if (ton >= 200) return 3.6;
    return 2.2;
  }
  function raFlowLabel(r) {
    if (raState.metric === 'trips') return r.trips + ' 单';
    if (raState.metric === 'time') return r.hours.toFixed(1) + ' h';
    return raNum(r.ton, 0) + ' t';
  }
  function raPlant(x, y) {
    return '<g transform="translate(' + x + ',' + y + ')">'
      + '<ellipse cx="26" cy="50" rx="28" ry="7" fill="rgba(139,110,60,.18)"/>'
      + '<polygon points="6,30 26,18 46,30 46,48 26,58 6,48" fill="#d7b48a"/>'
      + '<polygon points="26,18 46,30 46,48 26,36" fill="#b8895c"/>'
      + '<polygon points="6,30 26,18 26,36 6,48" fill="#e8cba6"/>'
      + '<rect x="36" y="8" width="7" height="20" fill="#c49668"/>'
      + '<rect x="34" y="4" width="11" height="5" rx="1" fill="#a67c52"/>'
      + '<rect x="14" y="34" width="8" height="8" fill="rgba(90,56,24,.28)"/>'
      + '<rect x="26" y="32" width="8" height="8" fill="rgba(90,56,24,.18)"/>'
      + '<path d="M39 4c6-8 10-8 14-2" fill="none" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round" opacity=".7"/>'
      + '</g>';
  }
  function raNetSvg() {
    var flows = [
      { name: '昆钢 → 北城', d: 'M186 210 C 240 120 320 70 400 92', lx: 250, ly: 118 },
      { name: '昆钢 → 研和', d: 'M196 232 C 300 250 400 250 478 248', lx: 330, ly: 268 },
      { name: '大开门 → 研和', d: 'M318 360 C 380 330 430 280 490 262', lx: 430, ly: 328 },
      { name: '大开门 → 北城', d: 'M300 348 C 280 240 320 120 400 96', lx: 300, ly: 210 },
      { name: '北城 → 玉溪', d: 'M430 108 C 520 90 620 180 690 258', lx: 560, ly: 148 },
      { name: '昆钢 → 玉溪', d: 'M200 240 C 360 180 560 220 690 268', lx: 430, ly: 198 },
      { name: '研和 → 玉溪', d: 'M530 262 C 580 250 640 258 692 270', lx: 610, ly: 246 },
      { name: '北城 → 研和', d: 'M418 128 C 460 170 490 210 508 248', lx: 478, ly: 176 }
    ];
    var byName = {};
    RA_ROUTES.forEach(function (r) { byName[r.name] = r; });
    var markers = ['#3b82f6', '#22c55e', '#f59e0b', '#a78bfa'].map(function (c, i) {
      return '<marker id="raArr' + i + '" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0l10 5-10 5z" fill="' + c + '"/></marker>';
    }).join('');
    var colorMark = { '#3b82f6': 0, '#22c55e': 1, '#f59e0b': 2, '#a78bfa': 3 };
    var paths = flows.map(function (f) {
      var r = byName[f.name];
      if (!r) return '';
      var c = raFlowColor(r.ton);
      var w = raFlowWidth(r.ton);
      var on = raState.selected === r.name;
      var cls = 'ra-flow-line' + (on ? ' is-on' : '');
      return '<path class="' + cls + '" d="' + f.d + '" fill="none" stroke="' + c + '" stroke-width="' + (on ? w + 1.6 : w) + '" stroke-linecap="round" marker-end="url(#raArr' + colorMark[c] + ')" onclick="WB.raSelect(\'' + esc(r.name) + '\')"/>'
        + '<g class="ra-flow-lab" transform="translate(' + f.lx + ',' + f.ly + ')">'
        + '<rect x="-30" y="-11" width="60" height="20" rx="10" fill="#fff" stroke="' + c + '" stroke-opacity=".35"/>'
        + '<text x="0" y="3" text-anchor="middle" fill="' + c + '" font-size="11" font-weight="700">' + esc(raFlowLabel(r)) + '</text></g>';
    }).join('');
    return '<svg class="ra-net-svg" viewBox="0 0 860 400" preserveAspectRatio="xMidYMid meet">'
      + '<defs>'
      + '<linearGradient id="raLand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efe4cf"/><stop offset=".55" stop-color="#e6d4b4"/><stop offset="1" stop-color="#dcc6a2"/></linearGradient>'
      + '<linearGradient id="raHill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cbb68e" stop-opacity=".35"/><stop offset="1" stop-color="#b79a6a" stop-opacity=".2"/></linearGradient>'
      + markers
      + '</defs>'
      + '<rect width="860" height="400" fill="#f3f6fa"/>'
      + '<path d="M210,36 C300,8 430,12 520,40 C610,58 700,70 760,118 C810,160 830,220 808,278 C790,330 730,368 660,390 C590,410 520,392 470,360 C430,392 360,410 300,392 C240,376 190,340 160,292 C110,310 70,270 78,214 C86,164 70,120 118,86 C150,58 176,46 210,36 Z" fill="url(#raLand)" stroke="#d4c19a" stroke-width="1.4"/>'
      + '<g fill="none" stroke="#cbb890" stroke-width="1" opacity=".55">'
      + '<path d="M240 90 C 320 70 420 80 500 110"/>'
      + '<path d="M180 180 C 300 150 430 170 560 210"/>'
      + '<path d="M220 280 C 340 250 470 280 620 300"/>'
      + '<path d="M300 120 C 360 180 380 250 360 330"/>'
      + '</g>'
      + '<path d="M260 70 C 340 50 430 90 480 150 C 420 130 340 110 260 70 Z" fill="url(#raHill)"/>'
      + '<path d="M500 210 C 580 190 650 230 690 290 C 610 270 540 240 500 210 Z" fill="url(#raHill)"/>'
      + paths
      + raPlant(152, 186) + raPlant(388, 58) + raPlant(478, 220) + raPlant(276, 318) + raPlant(668, 238)
      + '</svg>';
  }
  function raTrendSvg() {
    var labels = ['08-28', '08-29', '08-30', '08-31', '09-01', '09-02', '09-03'];
    var series = RA_TREND[raState.trend] || RA_TREND.ton;
    var w = 520;
    var h = 168;
    var padL = 36;
    var padR = 12;
    var padT = 10;
    var padB = 24;
    var innerW = w - padL - padR;
    var innerH = h - padT - padB;
    var max = 0;
    RA_TREND_META.forEach(function (s) {
      (series[s.name] || []).forEach(function (v) { if (v > max) max = v; });
    });
    max = raState.trend === 'time' ? 7 : (raState.trend === 'trips' ? 4 : Math.ceil(max / 200) * 200);
    if (max < 1) max = 1;
    var ticks = raState.trend === 'time' ? [0, 2, 4, 6] : (raState.trend === 'trips' ? [0, 1, 2, 3, 4] : [0, max / 4, max / 2, max * 3 / 4, max]);
    function yv(v) { return padT + innerH - (v / max) * innerH; }
    var grid = ticks.map(function (t) {
      var y = yv(t);
      var lab = raState.trend === 'time' ? t : (t >= 100 ? String(t) : String(t));
      return '<line x1="' + padL + '" y1="' + y + '" x2="' + (w - padR) + '" y2="' + y + '" stroke="#eef0f4"/>'
        + '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" text-anchor="end" fill="#9aa0ab" font-size="9">' + lab + '</text>';
    }).join('');
    var slot = innerW / (labels.length - 1);
    var lines = RA_TREND_META.map(function (s) {
      var vals = series[s.name] || [];
      var pts = vals.map(function (v, i) {
        return (padL + slot * i) + ',' + yv(v);
      }).join(' ');
      var last = vals.length ? (padL + slot * (vals.length - 1)) : 0;
      var lastY = vals.length ? yv(vals[vals.length - 1]) : 0;
      return '<polyline fill="none" stroke="' + s.color + '" stroke-width="2.2" stroke-linejoin="round" points="' + pts + '"/>'
        + '<circle cx="' + last + '" cy="' + lastY + '" r="3.2" fill="' + s.color + '" stroke="#fff" stroke-width="1.4"/>';
    }).join('');
    var xLabels = labels.map(function (lab, i) {
      return '<text x="' + (padL + slot * i) + '" y="' + (h - 6) + '" text-anchor="middle" fill="#9aa0ab" font-size="10">' + lab + '</text>';
    }).join('');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="ra-chart-svg" preserveAspectRatio="none">' + grid + lines + xLabels + '</svg>';
  }
  function raStackSvg() {
    var rows = raFiltered().slice(0, 7);
    var w = 420;
    var h = Math.max(160, 18 + rows.length * 22);
    var padL = 86;
    var padR = 40;
    var padT = 8;
    var padB = 8;
    var innerW = w - padL - padR;
    var max = 0;
    rows.forEach(function (r) { if (r.hours > max) max = r.hours; });
    if (max < 1) max = 1;
    var segs = [
      { key: 'load', color: '#3b82f6' },
      { key: 'drive', color: '#38bdf8' },
      { key: 'unload', color: '#fa8c16' },
      { key: 'charge', color: '#a78bfa' }
    ];
    var html = '';
    rows.forEach(function (r, i) {
      var y = padT + i * 22 + 4;
      var x = padL;
      segs.forEach(function (s) {
        var bw = (r[s.key] / max) * innerW;
        html += '<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + Math.max(1.2, bw).toFixed(1) + '" height="12" rx="2" fill="' + s.color + '"/>';
        x += bw;
      });
      html += '<text x="' + (padL - 8) + '" y="' + (y + 10) + '" text-anchor="end" fill="#4b5563" font-size="10">' + esc(r.name) + '</text>';
      html += '<text x="' + (w - padR + 6) + '" y="' + (y + 10) + '" fill="#1a1a1e" font-size="11" font-weight="700">' + r.hours.toFixed(1) + '</text>';
    });
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="ra-chart-svg">' + html + '</svg>';
  }
  function raComposeHtml() {
    var key = raState.compose;
    var rows = raFiltered().slice(0, 7);
    var max = 0;
    rows.forEach(function (r) { if (r[key] > max) max = r[key]; });
    if (max < 0.1) max = 0.1;
    return rows.map(function (r) {
      var pct = Math.max(8, r[key] / max * 100);
      return '<li><span>' + esc(r.name) + '</span><div class="ra-compose-bar"><i style="width:' + pct + '%"></i></div><b>' + r[key].toFixed(1) + ' h</b></li>';
    }).join('');
  }
  function raRankRows() {
    var rows = RA_ROUTES.slice();
    if (raState.rank === 'time') rows.sort(function (a, b) { return a.hours - b.hours; });
    else if (raState.rank === 'ton') rows.sort(function (a, b) { return b.ton - a.ton; });
    else rows.sort(function (a, b) { return b.rate - a.rate; });
    return rows.slice(0, 5).map(function (r, i) {
      var medal = i < 3 ? '<b class="ra-medal is-' + (i + 1) + '">' + (i + 1) + '</b>' : '<b class="ra-medal is-n">' + (i + 1) + '</b>';
      return '<tr>'
        + '<td>' + medal + '</td>'
        + '<td>' + esc(r.name) + '</td>'
        + '<td><div class="ra-rate"><span><i style="width:' + r.rate + '%"></i></span><em>' + r.rate.toFixed(1) + '%</em></div></td>'
        + '<td class="num">' + r.hours.toFixed(1) + ' h</td>'
        + '<td class="num">' + raInt(r.ton) + ' t</td>'
        + '</tr>';
    }).join('');
  }
  function raNodeCard(n) {
    return '<article class="ra-node"><header>' + esc(n.name) + '</header>'
      + '<p>到达 ' + n.in + ' <i>|</i> 发出 ' + n.out + '</p>'
      + '<strong>' + esc(n.ton) + '</strong></article>';
  }
  function paintRaList() {
    var box = document.getElementById('raRouteList');
    if (box) box.innerHTML = raListItemsHtml();
  }
  function renderRouteAnalysisBody() {
    var listTabs = [
      { id: 'all', name: '全部' },
      { id: 'frequent', name: '常用线路' },
      { id: 'loop', name: '环线线路' },
      { id: 'custom', name: '自定义线路' }
    ].map(function (t) {
      return '<button type="button" class="' + (raState.tab === t.id ? 'is-on' : '') + '" onclick="WB.raTab(\'' + t.id + '\')">' + esc(t.name) + '</button>';
    }).join('');
    var kpis = [
      { name: '线路总数', val: '12', delta: '+9%', tone: 'good', icon: 'list', tint: 'blue' },
      { name: '总运输量', val: '3,280 t', delta: '+12%', tone: 'good', icon: 'truck', tint: 'green' },
      { name: '总完成任务单', val: '86', delta: '+8%', tone: 'good', icon: 'check', tint: 'cyan' },
      { name: '平均运输时长', val: '4.6 h', delta: '-6%', tone: 'good', icon: 'clock', tint: 'blue' },
      { name: '平均装货时长', val: '0.9 h', delta: '-8%', tone: 'good', icon: 'box', tint: 'orange' },
      { name: '平均行驶时长', val: '2.8 h', delta: '-5%', tone: 'good', icon: 'car', tint: 'yellow' }
    ].map(function (k) {
      return '<article class="ra-kpi is-' + k.tint + '"><i>' + raKpiIcon(k.icon) + '</i><div><span>' + esc(k.name) + '</span><b>' + esc(k.val) + '</b></div>' + stDelta(k.delta, k.tone) + '</article>';
    }).join('');
    var sortMenu = raState.sortOpen
      ? '<div class="ra-sort-menu">'
        + '<button type="button" class="' + (raState.sort === 'ton' ? 'is-on' : '') + '" onclick="WB.raSort(\'ton\')">按运输量</button>'
        + '<button type="button" class="' + (raState.sort === 'trips' ? 'is-on' : '') + '" onclick="WB.raSort(\'trips\')">按任务单</button>'
        + '<button type="button" class="' + (raState.sort === 'hours' ? 'is-on' : '') + '" onclick="WB.raSort(\'hours\')">按时长</button>'
        + '</div>'
      : '';
    var nodes = RA_NODES.map(function (n) {
      return '<div class="ra-node-wrap" style="left:' + n.left + ';top:' + n.top + '">' + raNodeCard(n) + '</div>';
    }).join('');
    var cargoLegend = RA_CARGO.map(function (c) {
      return '<li><i style="background:' + c.color + '"></i><span>' + esc(c.name) + '</span><em>' + c.pct + '%</em><b>' + raInt(c.ton) + ' t</b></li>';
    }).join('');
    var angle = 0;
    var stops = RA_CARGO.map(function (c) {
      var next = angle + c.pct / 100 * 360;
      var s = c.color + ' ' + angle + 'deg ' + next + 'deg';
      angle = next;
      return s;
    }).join(',');
    return '<div class="ra-body">'
      + '<aside class="dc-card ra-side">'
      + '<div class="dc-card-hd"><h3>线路列表</h3></div>'
      + '<div class="ra-search">' + dcSvg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/>')
      + '<input id="raListQ" placeholder="搜索线路名称、起止点" oninput="WB.raSearch()">'
      + '<button class="ra-filter' + (raState.sortOpen ? ' is-on' : '') + '" type="button" title="筛选排序" onclick="WB.raToggleSort()">' + dcSvg('<path d="M4 6h16M7 12h10M10 18h4"/>') + '</button>'
      + sortMenu + '</div>'
      + '<div class="ra-list-tabs">' + listTabs + '</div>'
      + '<div class="ra-list" id="raRouteList">' + raListItemsHtml() + '</div>'
      + '<button class="ra-create" type="button" onclick="WB.raCreate()">+ 新建线路</button>'
      + '</aside>'
      + '<div class="ra-main">'
      + '<div class="ra-kpis">' + kpis + '</div>'
      + '<div class="ra-grid">'
      + '<div class="ra-mid">'
      + '<section class="dc-card ra-net-card"><div class="dc-card-hd"><h3>线路网络分析</h3>'
      + '<div class="ra-tools">'
      + raSelectHtml('raDay', raState.day, [['today', '今日'], ['7d', '近7天'], ['30d', '近30天']], 'WB.raDay')
      + raSelectHtml('raGoods', raState.goods, [['all', '全部货物'], ['矿石', '矿石'], ['钢材', '钢材'], ['煤炭', '煤炭'], ['焦炭', '焦炭']], 'WB.raGoods')
      + raSelectHtml('raMetric', raState.metric, [['ton', '运输量'], ['trips', '任务单'], ['time', '时长']], 'WB.raMetric')
      + '<button class="ra-full" type="button" title="全屏" onclick="WB.raFull()">' + dcSvg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>') + '</button>'
      + '</div></div>'
      + '<div class="ra-net">' + raNetSvg() + nodes
      + '<div class="ra-net-legend"><span>运输量</span>'
      + '<em class="is-xl">&gt;800t</em><em class="is-lg">500-800t</em><em class="is-md">200-500t</em><em class="is-sm">&lt;200t</em>'
      + '</div></div></section>'
      + '<div class="ra-bottom">'
      + '<section class="dc-card ra-trend"><div class="dc-card-hd"><h3>线路运输趋势</h3>'
      + stTabs([{ id: 'ton', name: '运输量' }, { id: 'trips', name: '完成任务单' }, { id: 'time', name: '平均时长' }], raState.trend, 'WB.raTrend')
      + '</div><div class="ra-chart">' + raTrendSvg() + '</div>'
      + '<div class="ra-legend">' + RA_TREND_META.map(function (s) {
        return '<span style="--c:' + s.color + '">' + esc(s.name) + '</span>';
      }).join('') + '</div></section>'
      + '<section class="dc-card ra-stack"><div class="dc-card-hd"><h3>线路时效对比</h3></div>'
      + '<div class="ra-chart">' + raStackSvg() + '</div>'
      + '<div class="ra-legend is-stack"><span class="is-load">装货</span><span class="is-drive">行驶</span><span class="is-unload">卸货</span><span class="is-charge">充电</span></div>'
      + '</section></div></div>'
      + '<div class="ra-right">'
      + '<section class="dc-card ra-rank"><div class="dc-card-hd"><h3>线路运输效率排名</h3>'
      + stTabs([{ id: 'rate', name: '按完成率' }, { id: 'time', name: '按平均时长' }, { id: 'ton', name: '按运输量' }], raState.rank, 'WB.raRank')
      + '</div><div class="ra-table-wrap"><table class="ra-table"><thead><tr><th>#</th><th>线路</th><th>完成率</th><th>平均时长</th><th>运输量</th></tr></thead><tbody>'
      + raRankRows() + '</tbody></table></div></section>'
      + '<section class="dc-card ra-compose"><div class="dc-card-hd"><h3>运输时效构成</h3>'
      + stTabs([{ id: 'load', name: '装货时长' }, { id: 'drive', name: '行驶时长' }, { id: 'unload', name: '卸货时长' }, { id: 'charge', name: '充电时长' }], raState.compose, 'WB.raCompose')
      + '</div><ul class="ra-compose-list">' + raComposeHtml() + '</ul></section>'
      + '<section class="dc-card ra-cargo"><div class="dc-card-hd"><h3>线路运输货物分布</h3></div>'
      + '<div class="ra-donut-wrap"><div class="ra-donut" style="background:conic-gradient(' + stops + ')"><strong>3,280 t<small>总运输量</small></strong></div>'
      + '<ul class="ra-cargo-legend">' + cargoLegend + '</ul></div></section>'
      + '</div></div></div></div>';
  }

  function axEvent(id) {
    return AX_EVENTS.filter(function (x) { return x.id === (id || axState.selected); })[0] || AX_EVENTS[0];
  }
  function axPos(ev) {
    var p = dcAlong(ev.from, ev.to, ev.t);
    return { lng: p[0], lat: p[1] };
  }
  function axFiltered() {
    var q = (axState.q || '').trim();
    var rows = AX_EVENTS.filter(function (ev) {
      if (axState.tab !== 'all' && ev.kind !== axState.tab) return false;
      if (axState.mapType !== 'all' && ev.kind !== axState.mapType) return false;
      if (q && (ev.plate + ev.task + ev.driver + ev.loc + ev.title).indexOf(q) < 0) return false;
      return true;
    });
    if (axState.sort === 'long') {
      rows = rows.slice().sort(function (a, b) {
        return parseInt(b.value.replace(/\D/g, ''), 10) - parseInt(a.value.replace(/\D/g, ''), 10);
      });
    }
    return rows;
  }
  function axCount(kind) {
    return AX_EVENTS.filter(function (x) { return !kind || x.kind === kind; }).length;
  }
  function axIcon(kind) {
    var paths = {
      timeout: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5l3 2"/>',
      stay: '<rect x="8" y="8" width="3" height="8" rx="1"/><rect x="13" y="8" width="3" height="8" rx="1"/>',
      deviate: '<path d="M4 19l7-14 3 7 7 2-17 5z"/>',
      soc: '<rect x="7" y="7" width="10" height="14" rx="2"/><path d="M10 3h4M12 11v4"/>',
      fence: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
      data: '<path d="M4 19V5h16v14z"/><path d="M8 15l3-4 3 3 4-6"/>',
      warn: '<path d="M10.3 4.3L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'
    };
    return dcSvg(paths[kind] || paths.timeout);
  }
  function refreshAlertMarkers(AMap) {
    var L = axState.layers;
    var rows = axFiltered();
    if (L.fence) {
      Object.keys(DC_SITES).forEach(function (name) {
        dispatchMap.add(new AMap.Circle({
          center: DC_SITES[name],
          radius: 2200,
          fillColor: '#38bdf8',
          fillOpacity: 0.1,
          strokeColor: '#38bdf8',
          strokeOpacity: 0.65,
          strokeWeight: 1.5
        }));
      });
    }
    if (L.route) {
      DC_LINES.forEach(function (pair, i) {
        dispatchMap.add(new AMap.Polyline({
          path: [DC_SITES[pair[0]], DC_SITES[pair[1]]],
          strokeColor: i % 2 ? '#f59e0b' : '#22c55e',
          strokeWeight: 3,
          strokeOpacity: .8
        }));
      });
    }
    if (L.vehicle) {
      dispatchVehicles().forEach(function (v) {
        dispatchMap.add(new AMap.Marker({
          position: [v.lng, v.lat],
          offset: new AMap.Pixel(-6, -8),
          content: '<span class="ax-car-dot"></span>'
        }));
      });
    }
    if (L.mark) {
      var grouped = {};
      rows.forEach(function (ev) {
        if (!grouped[ev.site]) grouped[ev.site] = [];
        grouped[ev.site].push(ev);
      });
      Object.keys(grouped).forEach(function (site) {
        var list = grouped[site];
        var pos = DC_SITES[site] || axPos(list[0]);
        var kind = list[0].kind;
        var n = list.length;
        var marker = new AMap.Marker({
          position: pos,
          offset: new AMap.Pixel(-16, -16),
          extData: list[0].id,
          content: '<button class="ax-pin is-' + kind + (axEvent().site === site ? ' is-on' : '') + '" type="button">' + n + '</button>'
        });
        marker.on('click', function () {
          axState.selected = marker.getExtData();
          axState.detail = 'event';
          selectedPlate = axEvent().plate;
          app.render();
        });
        dispatchMap.add(marker);
      });
      var cur = axEvent();
      var cp = axPos(cur);
      dispatchMap.add(new AMap.Marker({
        position: [cp.lng, cp.lat],
        offset: new AMap.Pixel(-14, -14),
        content: '<span class="ax-focus is-' + cur.kind + '"></span>'
      }));
    }
  }
  function axListHtml() {
    var rows = axFiltered();
    if (!rows.length) return '<div class="ax-empty">没有匹配的异常事件</div>';
    return rows.map(function (ev) {
      var k = AX_KIND[ev.kind];
      var on = axState.selected === ev.id ? ' is-on' : '';
      return '<button class="ax-item' + on + '" type="button" onclick="WB.axSelect(\'' + ev.id + '\')">'
        + '<i class="is-' + ev.kind + '">' + axIcon(ev.kind) + '</i>'
        + '<div class="ax-item-main"><b>' + esc(ev.plate) + '<em class="ax-tag is-' + ev.kind + '">' + esc(ev.title) + '</em></b>'
        + '<span>' + esc(ev.loc) + '</span><small>' + esc(ev.task) + '</small></div>'
        + '<div class="ax-item-side"><strong class="is-' + ev.kind + '">' + esc(ev.value) + '</strong><time>' + esc(ev.time) + '</time></div>'
        + '</button>';
    }).join('');
  }
  function axTrendSvg() {
    var rows = AX_HOUR;
    var keys = ['timeout', 'stay', 'deviate', 'soc', 'fence', 'data'];
    var w = 320;
    var h = 148;
    var padL = 24;
    var padR = 8;
    var padT = 8;
    var padB = 22;
    var max = 5;
    var innerW = w - padL - padR;
    var innerH = h - padT - padB;
    var slot = innerW / rows.length;
    var grid = [0, 1, 2, 3, 4, 5].map(function (t) {
      var y = padT + innerH - (t / max) * innerH;
      return '<line x1="' + padL + '" y1="' + y + '" x2="' + (w - padR) + '" y2="' + y + '" stroke="#eef0f4"/>'
        + '<text x="' + (padL - 4) + '" y="' + (y + 3) + '" text-anchor="end" fill="#9aa0ab" font-size="9">' + t + '</text>';
    }).join('');
    var bars = '';
    rows.forEach(function (r, i) {
      var x = padL + slot * i + slot * 0.28;
      var bw = slot * 0.44;
      var y = padT + innerH;
      keys.forEach(function (key) {
        var bh = (r[key] / max) * innerH;
        if (!bh) return;
        y -= bh;
        bars += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, bh).toFixed(1) + '" fill="' + AX_KIND[key].color + '"/>';
      });
      bars += '<text x="' + (padL + slot * i + slot / 2) + '" y="' + (h - 6) + '" text-anchor="middle" fill="#9aa0ab" font-size="10">' + r.h + '</text>';
    });
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="ax-chart-svg">' + grid + bars + '</svg>';
  }
  function axTimelineHtml(ev) {
    var steps;
    if (ev.kind === 'timeout') {
      steps = [
        { t: '10:42', d: '车辆进入' + ev.site + '电子围栏', on: false },
        { t: '10:48', d: '司机开始' + (ev.title.indexOf('卸货') >= 0 ? '卸货' : '装货'), on: false },
        { t: '11:20', d: (ev.title.indexOf('卸货') >= 0 ? '卸货' : '装货') + '持续进行', on: false },
        { t: ev.time, d: '超过阈值，触发' + ev.title, on: true }
      ];
    } else if (ev.kind === 'stay') {
      steps = [
        { t: '11:12', d: '车辆到达' + ev.loc, on: false },
        { t: '11:40', d: '车速持续低于 5 km/h', on: false },
        { t: ev.time, d: '停滞超时，触发告警', on: true }
      ];
    } else if (ev.kind === 'deviate') {
      steps = [
        { t: '11:05', d: '按计划线路行驶', on: false },
        { t: ev.time, d: '偏离计划线路 ' + ev.value.replace('偏航 ', ''), on: true }
      ];
    } else if (ev.kind === 'soc') {
      steps = [
        { t: '10:20', d: 'SOC 降至 30% 预警', on: false },
        { t: ev.time, d: 'SOC 低于 20%，触发低电量异常', on: true }
      ];
    } else {
      steps = [
        { t: '11:50', d: '系统采集到异常信号', on: false },
        { t: ev.time, d: ev.title + '已确认', on: true }
      ];
    }
    return steps.map(function (s) {
      return '<li class="' + (s.on ? 'is-on' : '') + '"><time>' + esc(s.t) + '</time><span>' + esc(s.d) + '</span></li>';
    }).join('');
  }
  function axExplain(ev) {
    if (ev.kind === 'timeout') return '车辆在' + ev.loc + '停留已达阈值以上，超过装卸货时效，当前尚未完成过磅离开。';
    if (ev.kind === 'stay') return '车辆在' + ev.loc + '长时间低速或静止，可能排队、故障或等人卸货。';
    if (ev.kind === 'deviate') return '车辆偏离「' + ev.route + '」计划线路，请核对是否绕行、修路或导航偏移。';
    if (ev.kind === 'soc') return '当前电量 ' + ev.soc + '% ，低于 20% 安全阈值，存在途中亏电风险。';
    if (ev.kind === 'fence') return '车辆在电子围栏外停留，可能未按规定进出装卸区域。';
    return '定位或业务回传出现漂移/缺失，需要核对 TBOX 与任务节点时间。';
  }
  function axSuggest(ev) {
    if (ev.kind === 'timeout') return '立即联系司机确认装卸进度；若设备或排队导致延误，记录原因并评估是否改派。';
    if (ev.kind === 'stay') return '联系司机确认现场情况；超过 15 分钟无回复则下发提醒，必要时安排就近车辆支援。';
    if (ev.kind === 'deviate') return '核对导航与修路信息；确认无异常后可标记已知悉，持续偏航则通知车队长。';
    if (ev.kind === 'soc') return '引导就近充电场站补电，或改派同线路有电车辆，避免途中趴窝。';
    if (ev.kind === 'fence') return '核对围栏范围与司机打卡位置，必要时在任务单补录进出时间。';
    return '核对定位时间轴与磅单时间，数据异常不作为卸货位置证据，只作核验线索。';
  }
  function axDetailBody(ev) {
    if (axState.detail === 'track') {
      return '<div class="ax-pane"><b>轨迹回放</b><p>演示回放装货至超时时段，地图按当前异常点衔接。</p>'
        + '<button class="ax-ghost" type="button" onclick="WB.axFocus()">定位异常点</button></div>';
    }
    if (axState.detail === 'task') {
      return '<dl class="ax-kv"><div><dt>任务单号</dt><dd class="mono">' + esc(ev.task) + '</dd></div>'
        + '<div><dt>分段线路</dt><dd>' + esc(ev.route) + '</dd></div>'
        + '<div><dt>当前位置</dt><dd>' + esc(ev.loc) + '</dd></div>'
        + '<div><dt>异常类型</dt><dd>' + esc(ev.title) + '</dd></div></dl>';
    }
    if (axState.detail === 'driver') {
      return '<dl class="ax-kv"><div><dt>司机</dt><dd>' + esc(ev.driver) + '</dd></div>'
        + '<div><dt>电话</dt><dd><a href="tel:' + esc(ev.phone) + '">' + esc(vmMaskPhone(ev.phone)) + '</a></dd></div>'
        + '<div><dt>所属车队</dt><dd>' + esc(ev.team) + '</dd></div>'
        + '<div><dt>牵引车</dt><dd>' + esc(ev.model) + '</dd></div></dl>';
    }
    if (axState.detail === 'log') {
      return '<ul class="ax-log"><li><time>' + esc(ev.time) + '</time><span>系统自动生成异常事件</span></li>'
        + '<li><time>' + esc(ev.updated.slice(11, 16)) + '</time><span>调度员打开异常中心查看</span></li></ul>';
    }
    return '<div class="ax-event-grid"><ol class="ax-time">' + axTimelineHtml(ev) + '</ol>'
      + '<div class="ax-notes"><div><h4>异常说明</h4><p>' + esc(axExplain(ev)) + '</p></div>'
      + '<div><h4>处理建议</h4><p>' + esc(axSuggest(ev)) + '</p></div></div></div>';
  }
  function axDetailHtml() {
    var ev = axEvent();
    var k = AX_KIND[ev.kind];
    var tabs = [
      { id: 'event', name: '事件详情' },
      { id: 'track', name: '轨迹回放' },
      { id: 'task', name: '任务信息' },
      { id: 'driver', name: '司机信息' },
      { id: 'log', name: '处理记录' }
    ].map(function (t) {
      return '<button type="button" class="' + (axState.detail === t.id ? 'is-on' : '') + '" onclick="WB.axDetail(\'' + t.id + '\')">' + esc(t.name) + '</button>';
    }).join('');
    return '<div class="ax-detail-hd">'
      + '<img src="/fleet-assets/dispatch-van.png" alt="">'
      + '<div class="ax-detail-title"><b>' + esc(ev.plate) + '</b><span>' + esc(ev.title) + '</span></div>'
      + '<em class="ax-value is-' + ev.kind + '">' + esc(ev.value) + '</em>'
      + '<a class="ax-call" href="tel:' + esc(ev.phone) + '">联系司机</a>'
      + '<button class="ax-task" type="button" onclick="WB.axDetail(\'task\')">任务详情</button>'
      + '<button class="ax-more" type="button" onclick="WB.axMore()" title="更多">···</button></div>'
      + '<dl class="ax-meta">'
      + '<div><dt>任务单号</dt><dd class="mono">' + esc(ev.task) + '</dd></div>'
      + '<div><dt>线路</dt><dd>' + esc(ev.route) + '</dd></div>'
      + '<div><dt>当前位置</dt><dd>' + esc(ev.loc) + '</dd></div>'
      + '<div><dt>司机</dt><dd>' + esc(ev.driver) + ' ' + esc(vmMaskPhone(ev.phone)) + '</dd></div>'
      + '<div><dt>车型</dt><dd>' + esc(ev.model) + '</dd></div>'
      + '<div><dt>车队</dt><dd>' + esc(ev.team) + '</dd></div>'
      + '<div><dt>SOC</dt><dd>' + ev.soc + '%</dd></div>'
      + '<div><dt>更新时间</dt><dd>' + esc(ev.updated) + '</dd></div></dl>'
      + '<nav class="ax-dtabs">' + tabs + '</nav>'
      + '<div class="ax-detail-body">' + axDetailBody(ev) + '</div>'
      + '<div class="ax-detail-ft">'
      + '<button class="ax-done" type="button" onclick="WB.axDone()">标记为已处理</button>'
      + '<button class="ax-warn" type="button" onclick="WB.axRemind()">下发提醒</button></div>';
  }
  function paintAxList() {
    var box = document.getElementById('axList');
    if (box) box.innerHTML = axListHtml();
  }
  function renderAlertBody() {
    var total = AX_EVENTS.length;
    var kpis = [
      { id: 'all', name: '异常总数', n: total, delta: '↑ 25% 较昨日', icon: 'warn', cls: 'is-total' },
      { id: 'timeout', name: '超时异常', n: axCount('timeout'), icon: 'timeout' },
      { id: 'stay', name: '停滞异常', n: axCount('stay'), icon: 'stay' },
      { id: 'deviate', name: '偏航异常', n: axCount('deviate'), icon: 'deviate' },
      { id: 'soc', name: '低SOC异常', n: axCount('soc'), icon: 'soc' },
      { id: 'fence', name: '电子围栏异常', n: axCount('fence'), icon: 'fence' },
      { id: 'data', name: '数据异常', n: axCount('data'), icon: 'data' }
    ].map(function (k) {
      var on = (k.id === 'all' ? axState.tab === 'all' : axState.tab === k.id) ? ' is-on' : '';
      return '<button class="ax-kpi is-' + k.id + on + '" type="button" onclick="WB.axTab(\'' + (k.id === 'all' ? 'all' : k.id) + '\')">'
        + '<i>' + axIcon(k.icon) + '</i><div><b>' + k.n + '</b><span>' + esc(k.name) + '</span>'
        + (k.delta ? '<em>' + esc(k.delta) + '</em>' : '') + '</div></button>';
    }).join('');
    var listTabs = [
      { id: 'all', name: '全部' },
      { id: 'timeout', name: '超时' },
      { id: 'stay', name: '停滞' },
      { id: 'deviate', name: '偏航' },
      { id: 'soc', name: '低SOC' }
    ].map(function (t) {
      return '<button type="button" class="' + (axState.tab === t.id ? 'is-on' : '') + '" onclick="WB.axTab(\'' + t.id + '\')">'
        + esc(t.name) + ' ' + axCount(t.id === 'all' ? '' : t.id) + '</button>';
    }).join('');
    var angle = 0;
    var donutItems = [
      { kind: 'stay', pct: 27 },
      { kind: 'soc', pct: 27 },
      { kind: 'timeout', pct: 20 },
      { kind: 'deviate', pct: 13 },
      { kind: 'fence', pct: 7 },
      { kind: 'data', pct: 6 }
    ];
    var stops = donutItems.map(function (s) {
      var next = angle + s.pct / 100 * 360;
      var out = AX_KIND[s.kind].color + ' ' + angle + 'deg ' + next + 'deg';
      angle = next;
      return out;
    }).join(',');
    var legend = donutItems.map(function (s) {
      return '<li><i style="background:' + AX_KIND[s.kind].color + '"></i><span>' + esc(AX_KIND[s.kind].label) + '</span>'
        + '<em>' + s.pct + '%</em><b>' + axCount(s.kind) + '</b></li>';
    }).join('');
    var top = AX_TOP.map(function (r, i) {
      var medal = i < 3 ? '<b class="ax-medal is-' + (i + 1) + '">' + (i + 1) + '</b>' : '<b class="ax-medal is-n">' + (i + 1) + '</b>';
      return '<tr><td>' + medal + '</td><td>' + esc(r.plate) + '</td><td class="num">' + r.n + '</td>'
        + '<td><em class="ax-tag is-' + r.kind + '">' + esc(AX_KIND[r.kind].name) + '</em></td></tr>';
    }).join('');
    var L = axState.layers;
    var layerBox = axState.layerOpen
      ? '<div class="ax-layer-pop">'
        + '<label><input type="checkbox"' + (L.vehicle ? ' checked' : '') + ' onchange="WB.axLayer(\'vehicle\')">车辆位置</label>'
        + '<label><input type="checkbox"' + (L.route ? ' checked' : '') + ' onchange="WB.axLayer(\'route\')">运输线路</label>'
        + '<label><input type="checkbox"' + (L.fence ? ' checked' : '') + ' onchange="WB.axLayer(\'fence\')">电子围栏</label>'
        + '<label><input type="checkbox"' + (L.mark ? ' checked' : '') + ' onchange="WB.axLayer(\'mark\')">异常标记</label>'
        + '</div>'
      : '';
    return '<div class="ax-body">'
      + '<div class="ax-kpis">' + kpis
      + '<div class="ax-kpi is-done"><i>' + dcSvg('<path d="M9 11l2 2 4-4"/><circle cx="12" cy="12" r="9"/>') + '</i>'
      + '<div><b>11</b><span>今日已处理</span><em>处理率 73%</em><span class="ax-done-bar"><em style="width:73%"></em></span></div></div></div>'
      + '<div class="ax-grid">'
      + '<section class="dc-card ax-left"><div class="dc-card-hd"><h3>异常事件 <span>(' + total + ')</span></h3>'
      + '<button class="ax-filter" type="button" onclick="WB.axTab(\'all\')" title="筛选">' + dcSvg('<path d="M4 6h16M7 12h10M10 18h4"/>') + '</button></div>'
      + '<div class="ax-tabs">' + listTabs + '</div>'
      + '<div class="ax-tools">' + dcSvg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/>')
      + '<input id="axQ" placeholder="搜索车牌、单号、司机" oninput="WB.axSearch()">'
      + '<select id="axSort" onchange="WB.axSort()"><option value="new"' + (axState.sort === 'new' ? ' selected' : '') + '>最新优先</option>'
      + '<option value="long"' + (axState.sort === 'long' ? ' selected' : '') + '>超时最长</option></select></div>'
      + '<div class="ax-list" id="axList">' + axListHtml() + '</div></section>'
      + '<div class="ax-mid">'
      + '<section class="dc-card ax-map-card"><div class="dc-card-hd"><h3>异常分布地图</h3>'
      + '<select id="axMapType" onchange="WB.axMapType()">'
      + '<option value="all"' + (axState.mapType === 'all' ? ' selected' : '') + '>全部异常类型</option>'
      + '<option value="timeout"' + (axState.mapType === 'timeout' ? ' selected' : '') + '>超时异常</option>'
      + '<option value="stay"' + (axState.mapType === 'stay' ? ' selected' : '') + '>停滞异常</option>'
      + '<option value="deviate"' + (axState.mapType === 'deviate' ? ' selected' : '') + '>偏航异常</option>'
      + '<option value="soc"' + (axState.mapType === 'soc' ? ' selected' : '') + '>低SOC异常</option>'
      + '</select></div>'
      + '<div class="ax-map-stage"><div id="wbDispatchMap" class="dc-map-canvas"></div>'
      + '<div class="ax-map-tools">'
      + '<button type="button" class="' + (mapFilter.fullscreen ? 'is-on' : '') + '" onclick="WB.dcFullscreen()">全屏</button>'
      + '<button type="button" class="' + (axState.layerOpen ? 'is-on' : '') + '" onclick="WB.axToggleLayer()">图层</button>'
      + layerBox
      + '<div class="ax-zoom"><button type="button" onclick="WB.vmZoom(1)">+</button><button type="button" onclick="WB.vmZoom(-1)">−</button></div>'
      + '</div></div></section>'
      + '<section class="dc-card ax-detail" id="axDetail">' + axDetailHtml() + '</section>'
      + '</div>'
      + '<div class="ax-right">'
      + '<section class="dc-card ax-donut-card"><div class="dc-card-hd"><h3>异常类型占比</h3></div>'
      + '<div class="ax-donut-wrap"><div class="ax-donut" style="background:conic-gradient(' + stops + ')"><strong>15<small>异常总数</small></strong></div>'
      + '<ul class="ax-legend">' + legend + '</ul></div></section>'
      + '<section class="dc-card ax-trend"><div class="dc-card-hd"><h3>异常趋势</h3>'
      + stTabs([{ id: 'hour', name: '按小时' }, { id: 'day', name: '按天' }, { id: 'week', name: '按周' }], axState.trend, 'WB.axTrend')
      + '</div><div class="ax-chart">' + axTrendSvg() + '</div>'
      + '<div class="ax-trend-leg"><span class="is-timeout">超时</span><span class="is-stay">停滞</span><span class="is-deviate">偏航</span><span class="is-soc">低SOC</span></div></section>'
      + '<section class="dc-card ax-top"><div class="dc-card-hd"><h3>异常车辆 TOP10</h3></div>'
      + '<div class="ax-table-wrap"><table class="ax-table"><thead><tr><th>#</th><th>车牌</th><th>次数</th><th>主要异常</th></tr></thead><tbody>'
      + top + '</tbody></table></div></section>'
      + '</div></div></div>';
  }

  function renderDispatchScreen() {
    var acc = currentAccount();
    var userName = acc ? acc.name : '杜发财';
    dcTab = 'monitor';
    return '<div class="dc-root is-vm' + (vmState.leftCollapsed ? ' is-left-collapsed' : '') + (vmOverviewDocked() ? ' is-overview-collapsed' : '') + '">'
      + '<header class="dc-top">'
      + '<button class="dc-brand" type="button" title="进入系统" onclick="WB.enterWorkbench()">' + dcLogo()
      + '<span><span class="dc-brand-name">运输监控中心</span><span class="dc-brand-sub">全球新能源物流解决方案专家</span></span></button>'
      + vmOrgTreeHtml()
      + '<div class="dc-top-right"><span class="dc-clock" id="dcClock">' + esc(dcClockText()) + '</span>'
      + '<div class="vm-toolset" role="group" aria-label="大屏工具">'
      + '<button class="vm-page-refresh" type="button" onclick="WB.vmRefreshData(this)" aria-label="刷新数据" title="刷新数据">'
      + dcSvg('<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 9a7 7 0 0 1 11.8-2L20 9M4 15l2.1 2a7 7 0 0 0 11.8-2"/>') + '<span>刷新</span></button>'
      + '<button class="vm-page-fullscreen" type="button" onclick="WB.vmPageFullscreen()" aria-label="进入全屏" title="全屏">'
      + dcSvg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>') + '<span>全屏</span></button></div>'
      + '<button class="dc-enter" type="button" onclick="WB.enterWorkbench()">进入系统</button>'
      + '<button class="dc-user" type="button" onclick="WB.toggleUserMenu(event)"><span class="dc-avatar" aria-hidden="true"></span>' + esc(userName) + '<i class="dc-caret"></i></button></div></header>'
      + renderMonitorBody()
      + '</div>';
  }

  function renderDispatchCenterBody() {
    var k = dcKpi();
    var routeOpts = ['昆钢 → 北城', '大开门 → 研和', '昆钢 → 研和', '大开门 → 北城'].map(function (r) {
      return '<option value="' + esc(r) + '"' + (mapFilter.route === r ? ' selected' : '') + '>' + esc(r) + '</option>';
    }).join('');
    function sel(id, value, options) {
      return '<select id="' + id + '" onchange="WB.applyMapFilter()">' + options.map(function (o) {
        return '<option value="' + o[0] + '"' + (value === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select>';
    }
    return '<div class="dc-body">'
      + '<div class="dc-col dc-left">'
      + '<section class="dc-card dc-overview"><div class="dc-card-hd"><h3>今日调度概览</h3></div>'
      + '<div class="dc-ov-grid">'
      + '<button class="dc-ov c-task" type="button" onclick="WB.jumpTaskTab(\'all\')"><i>' + dcSvg('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5"/>') + '</i><span><em>今日任务</em><b>' + k.tasks + '</b></span></button>'
      + '<button class="dc-ov c-wait" type="button" onclick="WB.jumpTaskTab(\'dispatch\')"><i>' + dcSvg('<path d="M12 8v5l3 2"/><circle cx="12" cy="12" r="9"/>') + '</i><span><em>待调度</em><b>' + k.pending + '</b></span></button>'
      + '<button class="dc-ov c-run" type="button" onclick="WB.jumpTaskTab(\'running\')"><i>' + dcSvg('<path d="M3 7h11v10H3z"/><path d="M14 11h5l3 3v3h-8"/><circle cx="7" cy="20" r="2"/><circle cx="18" cy="20" r="2"/>') + '</i><span><em>运输中</em><b>' + k.run + '</b></span></button>'
      + '<button class="dc-ov c-done" type="button" onclick="WB.board(\'finished\')"><i>' + dcSvg('<path d="M9 11l2 2 4-4"/><circle cx="12" cy="12" r="9"/>') + '</i><span><em>已完成</em><b>' + k.done + '</b></span></button>'
      + '<button class="dc-ov c-alert" type="button" onclick="WB.dcTab(\'alert\')"><i>' + dcSvg('<path d="M10.3 4.3L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>') + '</i><span><em>异常任务</em><b>' + k.alert + '</b></span></button>'
      + '<button class="dc-ov c-car" type="button" onclick="WB.board(\'vehicles\')"><i>' + dcSvg('<path d="M3 7h11v10H3z"/><path d="M14 11h5l3 3v3h-8"/>') + '</i><span><em>可用调度车辆</em><b>' + k.cars + '</b></span></button>'
      + '</div><div class="dc-rate"><span>今日任务完成率</span><b>' + k.rate + '%</b><div class="dc-rate-bar"><i style="width:' + k.rate + '%"></i></div><em>' + k.done + ' / ' + k.tasks + '</em></div></section>'
      + '<section class="dc-card dc-queue"><div class="dc-card-hd"><h3>待调度任务</h3><span class="dc-count">(' + k.pending + ')</span></div>'
      + '<div class="dc-task-list">' + dcQueueHtml() + '</div></section></div>'
      + '<div class="dc-col dc-mid">'
      + '<section class="dc-card dc-map-card"><div class="dc-map-toolbar">'
      + '<div class="dc-search">' + dcSvg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/>')
      + '<input id="wbMapQ" placeholder="搜索车辆、任务单号、地点" oninput="WB.applyMapFilter()"></div>'
      + sel('wbMapVehicle', mapFilter.vehicle, [['all', '全部车辆'], ['run', '运输中'], ['stop', '停滞'], ['charge', '充电中'], ['abnormal', '异常']])
      + sel('wbMapStatus', mapFilter.status, [['all', '全部任务状态'], ['run', '运输中'], ['stop', '装卸停留'], ['abnormal', '异常']])
      + '<select id="wbMapRoute" onchange="WB.applyMapFilter()"><option value="all">全部线路</option>' + routeOpts + '</select>'
      + '<button class="dc-tool' + (mapFilter.satellite ? ' is-on' : '') + '" type="button" onclick="WB.dcSatellite()">' + (mapFilter.satellite ? '卫星' : '地图') + '</button>'
      + '<button class="dc-tool' + (mapFilter.fullscreen ? ' is-on' : '') + '" type="button" title="全屏" onclick="WB.dcFullscreen()">' + dcSvg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>') + '</button></div>'
      + '<div class="dc-map-stage"><div id="wbDispatchMap" class="dc-map-canvas"></div>'
      + '<div id="wbMapPopup" class="dc-map-popup"' + (selectedPlate ? '' : ' hidden') + '></div>'
      + '<div class="dc-legend"><span class="is-run">运输中</span><span class="is-stop">停滞</span><span class="is-abnormal">异常</span><span class="is-charge">充电中</span></div></div></section>'
      + '<div class="dc-mid-bottom">'
      + '<section class="dc-card"><div class="dc-card-hd"><h3>今日完成情况</h3></div><div class="dc-done">'
      + '<div class="dc-done-row"><div><b>76</b><span>今日完成</span> <em class="dc-delta is-up">+12%</em></div>' + dcSpark('is-green', [40, 55, 48, 70, 62, 88, 80]) + '</div>'
      + '<div class="dc-done-row"><div><b>126</b><span>今日任务</span> <em class="dc-delta is-up">+8%</em></div>' + dcSpark('is-blue', [50, 42, 60, 55, 72, 68, 78]) + '</div>'
      + '<div class="dc-done-row"><div><b>5</b><span>异常任务</span> <em class="dc-delta is-down">-28%</em></div>' + dcSpark('is-red', [80, 70, 62, 55, 48, 40, 32]) + '</div>'
      + '</div></section>'
      + '<section class="dc-card"><div class="dc-card-hd"><h3>线路运行情况</h3></div><div class="dc-route-table"><table><thead><tr><th>线路</th><th class="num">在途</th><th class="num">完成</th><th class="num">异常</th><th>完成率</th></tr></thead><tbody>'
      + dcRouteRows() + '</tbody></table></div></section>'
      + '<section class="dc-card"><div class="dc-card-hd"><h3>24小时任务趋势</h3></div><div class="dc-trend">' + dcTrendSvg() + '</div>'
      + '<div class="dc-trend-legend"><span>任务量</span><span class="is-line">完成</span></div></section>'
      + '</div></div>'
      + '<div class="dc-col dc-right">'
      + '<section class="dc-card dc-alerts"><div class="dc-card-hd"><h3>实时异常预警</h3><span class="dc-count">(5)</span></div>'
      + '<div class="dc-alert-list">' + dcAlertHtml() + '</div></section>'
      + '<section class="dc-card dc-fleet"><div class="dc-card-hd"><h3>车辆状态</h3><span class="dc-count">共 60 台</span></div>'
      + dcDonutHtml() + '</section></div></div>';
  }

  function ensureDispatchDesk() {
    if (!store.dispatchDesk) store.dispatchDesk = { todoStatus: {}, alertStatus: {}, ignoreReason: {}, viewed: false };
    if (!store.dispatchDesk.todoStatus) store.dispatchDesk.todoStatus = {};
    if (!store.dispatchDesk.alertStatus) store.dispatchDesk.alertStatus = {};
    if (!store.dispatchDesk.ignoreReason) store.dispatchDesk.ignoreReason = {};
    if (!store.dispatchDesk.driverPatch) store.dispatchDesk.driverPatch = {};
    if (!store.dispatchDesk.todoPatch) store.dispatchDesk.todoPatch = {};
    if (!store.dispatchDesk.capacityPatch) store.dispatchDesk.capacityPatch = {};
    if (!store.dispatchDesk.alertResult) store.dispatchDesk.alertResult = {};
    if (!store.dispatchDesk.alertNote) store.dispatchDesk.alertNote = {};
    return store.dispatchDesk;
  }

  function dispatchWaitText(min) {
    min = Number(min) || 0;
    if (min >= 60) {
      var h = Math.floor(min / 60);
      var m = min % 60;
      return m ? (h + 'h' + m + 'min') : (h + 'h');
    }
    return min + 'min';
  }

  function deskField(label, value, extraClass) {
    return '<div' + (extraClass ? ' class="' + extraClass + '"' : '') + '><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>';
  }

  function cargoLine(item) {
    if (item.cargoName && (item.cargoTon || item.cargoTon === 0)) return item.cargoName + ' · ' + item.cargoTon + '吨';
    return item.cargo || '—';
  }

  function dispatchUntilLoadText(min) {
    if (min == null || min === '') return '';
    min = Number(min);
    if (!isFinite(min)) return '';
    if (min >= 0) return '距计划时间 ' + dispatchWaitText(min);
    return '已过计划时间 ' + dispatchWaitText(Math.abs(min));
  }

  function todoFact(label, value) {
    return '<div><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>';
  }

  function dispatchTodoCards() {
    var desk = ensureDispatchDesk();
    return [
      { id: 'DT-SP001', group: 'split', type: '待拆运单', objectKind: 'order', priority: '高', taskNo: 'Y2026090201', orderNo: 'Y2026090201', route: '尖峰水泥场 → 景洪水泥卸货网点', planTon: 68, splitTon: 34, remainTon: 34, cargoName: '水泥', waitMin: 412, depart: '09:18', cargo: '水泥 68t', primary: '立即拆分', primaryAction: 'split', extra: [['订单快览', 'viewOrder']] },
      { id: 'DT-SP002', group: 'split', type: '待拆运单', objectKind: 'order', priority: '高', taskNo: 'DD202609160023', orderNo: 'DD202609160023', route: '昆钢 → 研和', planTon: 120, splitTon: 64, remainTon: 56, cargoName: '煤炭', waitMin: 268, depart: '10:30', cargo: '煤炭 120t', primary: '立即拆分', primaryAction: 'split', extra: [['订单快览', 'viewOrder']] },
      { id: 'DT-SP003', group: 'split', type: '待拆运单', objectKind: 'order', priority: '中', taskNo: 'DD2026091602', orderNo: 'DD2026091602', route: '大开门 → 研和', planTon: 68, splitTon: 0, remainTon: 68, cargoName: '铁精粉', waitMin: 196, depart: '11:20', cargo: '铁精粉 68t', primary: '立即拆分', primaryAction: 'split', extra: [['订单快览', 'viewOrder']] },
      { id: 'DT-001', group: 'dispatch', type: '待派任务', objectKind: 'task', priority: '高', taskNo: 'Y202609160001', route: '昆钢 → 北城', load: '昆钢', unload: '北城', waitMin: 374, untilLoadMin: 38, depart: '10:30', cargoName: '钢材', cargoTon: 32, cargo: '钢材 32t', primary: '立即派车', primaryAction: 'dispatch', extra: [['预派', 'preassign'], ['任务快览', 'view']] },
      { id: 'DT-002', group: 'dispatch', type: '待派任务', objectKind: 'task', priority: '高', taskNo: taskCode(2), route: '大开门 → 研和', load: '大开门', unload: '研和', waitMin: 360, untilLoadMin: 12, depart: '14:30', cargoName: '铁精粉', cargoTon: 34, cargo: '铁精粉 34t', primary: '立即派车', primaryAction: 'dispatch', extra: [['预派', 'preassign'], ['任务快览', 'view']] },
      { id: 'DT-003', group: 'dispatch', type: '待派任务', objectKind: 'task', priority: '中', taskNo: taskCode(3), route: '北城 → 研和', load: '北城', unload: '研和', waitMin: 322, untilLoadMin: 46, depart: '15:10', cargoName: '水泥', cargoTon: 34, cargo: '水泥 34t', primary: '立即派车', primaryAction: 'dispatch', extra: [['预派', 'preassign'], ['任务快览', 'view']] },
      { id: 'DT-004', group: 'dispatch', type: '待派任务', objectKind: 'task', priority: '中', taskNo: taskCode(4), route: '北城 → 昆钢', load: '北城', unload: '昆钢', waitMin: 308, untilLoadMin: 62, depart: '15:20', cargoName: '水渣', cargoTon: 32, cargo: '水渣 32t', primary: '立即派车', primaryAction: 'dispatch', extra: [['预派', 'preassign'], ['任务快览', 'view']] },
      { id: 'DT-005', group: 'dispatch', type: '待派任务', objectKind: 'task', priority: '中', taskNo: taskCode(5), route: '北城 → 大开门', load: '北城', unload: '大开门', waitMin: 286, untilLoadMin: 84, depart: '15:40', cargoName: '煤炭', cargoTon: 30, cargo: '煤炭 30t', primary: '立即派车', primaryAction: 'dispatch', extra: [['预派', 'preassign'], ['任务快览', 'view']] },
      { id: 'DT-PRE001', group: 'preassign', type: '待转正式', objectKind: 'task', priority: '中', taskNo: 'YP-20260909-003', route: '北城 → 昆钢', driver: '张三', truck: '云A12345', trailer: '云A·挂8011', waitMin: 190, depart: '14:30', cargoName: '钢材', cargoTon: 32, cargo: '钢材 32t', prevTask: '已完成', resourceReady: true, primary: '转正式派单', primaryAction: 'formalize', extra: [['调整预派', 'adjustPreassign']] },
      { id: 'DT-PRE002', group: 'preassign', type: '待转正式', objectKind: 'task', priority: '中', taskNo: 'YP-20260909-001', route: '昆钢 → 北城', driver: '李宏俊', truck: '云A·D8021', trailer: '云A·挂8021', waitMin: 164, depart: '14:42', cargoName: '煤炭', cargoTon: 32, cargo: '煤炭 32t', prevTask: '已完成', resourceReady: true, primary: '转正式派单', primaryAction: 'formalize', extra: [['调整预派', 'adjustPreassign']] },
      { id: 'DT-PRE003', group: 'preassign', type: '待转正式', objectKind: 'task', priority: '中', taskNo: 'YP-20260909-002', route: '大开门 → 研和', driver: '王磊', truck: '云A·E1936', trailer: '云A·挂8022', waitMin: 138, depart: '14:50', cargoName: '铁精粉', cargoTon: 34, cargo: '铁精粉 34t', prevTask: '已完成', resourceReady: true, primary: '转正式派单', primaryAction: 'formalize', extra: [['调整预派', 'adjustPreassign']] },
      { id: 'DT-IF001', group: 'other', type: '其他待处理', objectKind: 'task', priority: '中', taskNo: taskCode(33), route: '大开门 → 景洪水泥卸货网点', waitMin: 98, depart: '14:48', cargoName: '水泥', cargoTon: 34, cargo: '水泥 34t', reason: '区域卸货任务尚未确认具体卸货点', primary: '补充信息', primaryAction: 'confirmInfo', extra: [['任务快览', 'view']] },
      { id: 'DT-IF002', group: 'other', type: '其他待处理', objectKind: 'task', priority: '中', taskNo: taskCode(38), route: '昆钢 → 北城片区', waitMin: 81, depart: '15:05', cargoName: '煤炭', cargoTon: 32, cargo: '煤炭 32t', reason: '收货联系人与卸货预约窗口待确认', primary: '补充信息', primaryAction: 'confirmInfo', extra: [['任务快览', 'view']] }
    ].map(function (row) {
      var item = Object.assign({}, row, desk.todoPatch && desk.todoPatch[row.id] ? desk.todoPatch[row.id] : {});
      item.status = desk.todoStatus[row.id] || '待处理';
      return item;
    });
  }

  function sortDispatchTodos(a, b) {
    var gw = { split: 0, dispatch: 1, preassign: 2, other: 3 };
    var pw = { '高': 0, '中': 1, '低': 2 };
    var ga = Object.prototype.hasOwnProperty.call(gw, a.group) ? gw[a.group] : 9;
    var gb = Object.prototype.hasOwnProperty.call(gw, b.group) ? gw[b.group] : 9;
    if (ga !== gb) return ga - gb;
    var pa = Object.prototype.hasOwnProperty.call(pw, a.priority) ? pw[a.priority] : 9;
    var pb = Object.prototype.hasOwnProperty.call(pw, b.priority) ? pw[b.priority] : 9;
    if (pa !== pb) return pa - pb;
    return (b.waitMin || 0) - (a.waitMin || 0);
  }

  function visibleDispatchTodos() {
    var q = (dispatchTodoQ || '').trim().toLowerCase();
    return dispatchTodoCards().filter(function (item) {
      if (item.status !== '待处理') return false;
      if (dispatchTodoTab !== 'all' && item.group !== dispatchTodoTab) return false;
      if (dispatchTodoPri && item.priority !== dispatchTodoPri) return false;
      if (!q) return true;
      return [item.taskNo, item.orderNo, item.route, item.cargoName, item.driver, item.truck, item.reason].join(' ').toLowerCase().indexOf(q) >= 0;
    }).sort(sortDispatchTodos);
  }

  function renderDispatchTodoCard(item) {
    var extras = (item.extra || []).map(function (act) {
      return '<button type="button" onclick="WB.dispatchTodoAction(\'' + esc(act[1]) + '\',\'' + esc(item.id) + '\')">' + esc(act[0]) + '</button>';
    }).join('');
    var overdue = item.group === 'dispatch' && Number(item.untilLoadMin) < 0;
    var urgency = item.group === 'dispatch' ? dispatchUntilLoadText(item.untilLoadMin) : '';
    var title = item.route;
    var typeLabel = item.group === 'split' ? '待拆' : (item.group === 'dispatch' ? '待派' : (item.group === 'preassign' ? '待转正式' : '其他'));
    var extraLine = '';
    if (item.group === 'split') {
      extraLine = '<p class="wb-todo-meta">订单 ' + esc(item.orderNo || item.taskNo) + ' · 待拆 ' + esc(item.remainTon || 0) + '吨</p>';
    } else if (item.group === 'dispatch') {
      extraLine = '<p class="wb-todo-meta">任务 ' + esc(item.taskNo) + '</p>';
    } else if (item.group === 'preassign') {
      extraLine = '<p class="wb-todo-meta">' + esc((item.driver || '—') + ' / ' + (item.truck || '—')) + ' · ' + esc(item.resourceReady === false ? '资源尚未释放' : '资源已释放') + '</p>';
    } else {
      extraLine = '<p class="wb-todo-meta">任务 ' + esc(item.taskNo) + (item.reason ? ' · ' + esc(item.reason) : '') + '</p>';
    }
    return '<article class="wb-todo-card is-' + esc(item.group) + (overdue ? ' is-overdue' : '') + (dispatchHit === item.id ? ' is-hit' : '') + '">'
      + '<header class="wb-todo-kicker"><i class="wb-todo-dot" aria-hidden="true"></i><span>' + esc(typeLabel) + '</span>'
      + (urgency ? '<em>' + esc(urgency) + '</em>' : '') + '</header>'
      + '<strong class="wb-todo-title">' + esc(title) + '</strong>'
      + extraLine
      + '<div class="wb-todo-actions"><button class="btn btn-primary btn-sm" type="button" onclick="WB.dispatchTodoAction(\'' + esc(item.primaryAction) + '\',\'' + esc(item.id) + '\')">' + esc(item.primary) + '</button>'
      + extras + '</div></article>';
  }

  function dispatchTodoPeekHtml(item) {
    var title = item.objectKind === 'order' ? '订单快览' : '任务快览';
    var body = '';
    if (item.group === 'split') {
      body = field('订单号', item.orderNo || item.taskNo) + field('运输线路', item.route)
        + field('货物', item.cargoName || cargoLine(item)) + field('计划运输', (item.planTon || 0) + '吨')
        + field('已拆', (item.splitTon || 0) + '吨') + field('待拆', (item.remainTon || 0) + '吨');
    } else if (item.group === 'preassign') {
      body = field('预派单号', item.taskNo) + field('运输线路', item.route)
        + field('预派司机', item.driver || '—') + field('预派车辆', item.truck || '—')
        + field('前置任务', item.prevTask || '已完成') + field('资源状态', item.resourceReady === false ? '尚未释放' : '已释放')
        + field('货物', cargoLine(item)) + field('计划装货', item.depart || '—');
    } else {
      body = field('任务单号', item.taskNo) + field('运输线路', item.route)
        + field('货物', cargoLine(item)) + field('计划装货', item.depart || '—')
        + (item.untilLoadMin != null ? field('装货倒计时', dispatchUntilLoadText(item.untilLoadMin)) : '')
        + (item.reason ? '<div class="form-item full"><span class="form-label">待办原因</span><div class="form-value">' + esc(item.reason) + '</div></div>' : '');
    }
    return '<div class="modal-header"><div class="modal-title">' + esc(title) + '</div><button class="modal-close" type="button" onclick="WB.closeModal()" aria-label="关闭">×</button></div>'
      + '<div class="modal-body"><div class="form-grid">' + body + '</div></div>'
      + '<div class="modal-footer"><button class="btn btn-default" type="button" onclick="WB.closeModal()">关闭</button></div>';
  }

  function dispatchTodoActionHtml(item, action) {
    var actionNames = {
      dispatch: '立即派车', view: '任务快览', viewOrder: '订单快览', viewPreassign: '任务快览', adjustPreassign: '调整预派',
      formalize: '转正式派单', cancelPreassign: '撤回预派',
      confirmInfo: '补充信息'
    };
    var actionName = actionNames[action] || item.primary;
    var footer = '<button class="btn btn-default" type="button" onclick="WB.closeModal()">关闭</button>';
    footer += '<button class="btn btn-primary" type="button" onclick="WB.confirmDispatchTodoAction(\'' + esc(action) + '\',\'' + esc(item.id) + '\')">确认' + esc(actionName) + '</button>';
    return '<div class="modal-header"><div class="modal-title">' + esc(actionName) + '</div><button class="modal-close" type="button" onclick="WB.closeModal()" aria-label="关闭">×</button></div>'
      + '<div class="modal-body"><div class="form-grid">'
      + field('待办类型', item.type) + field('优先级', item.priority)
      + field(item.objectKind === 'order' ? '订单号' : '任务单号', item.taskNo) + field('当前状态', item.status)
      + field('运输线路', item.route) + field('货物', cargoLine(item))
      + field('司机', item.driver || '—') + field('牵引车 / 挂车', (item.truck || '—') + ' / ' + (item.trailer || '—'))
      + (item.reason ? '<div class="form-item full"><span class="form-label">待办原因</span><div class="form-value">' + esc(item.reason) + '</div></div>' : '')
      + '</div></div><div class="modal-footer">' + footer + '</div>';
  }

  function dispatchAlertCards() {
    var desk = ensureDispatchDesk();
    return [
      { id: 'DA-SP01', type: '停车预警', group: 'stop', level: '中', status: '待处理', plate: '云A·J3058', driver: '赵明', phone: '13808710026', taskNo: taskCode(85), route: '北城 → 昆钢', time: TODAY + ' 09:48:00', waitMin: 42, location: '昆磨高速辅路', metricLabel: '当前车速', metric: '0 km/h', reason: '车辆在非业务场景下持续停车已达规则阈值', facts: ['当前位置：昆磨高速辅路', '车辆速度：0 km/h', '不在装卸货点或充电站范围'] },
      { id: 'DA-SP02', type: '停车预警', group: 'stop', level: '中', status: '处理中', plate: '云A·H6612', driver: '陈志远', phone: '13808710025', taskNo: taskCode(84), route: '昆钢 → 研和', time: TODAY + ' 10:16:00', waitMin: 28, location: 'G8511 服务区外侧', metricLabel: '当前车速', metric: '0 km/h', reason: '车辆在非业务场景下持续停车已达规则阈值', facts: ['当前位置：G8511 服务区外侧', '车辆速度：0 km/h', '调度已联系司机核实'] },
      { id: 'DA-ST01', type: '区域停留预警', group: 'site', level: '中', status: '待处理', plate: '云A10103', driver: '周强', phone: '13808710028', taskNo: taskCode(28), route: '昆钢 → 北城', time: TODAY + ' 08:26:00', waitMin: 76, location: '北城卸货区', metricLabel: '停留区域', metric: '北城卸货区', reason: '车辆在卸货点停留已达规则阈值', facts: ['08:26 到达北城卸货区', '当前仍在卸货区域', '停留时长：1h16min'] },
      { id: 'DA-ST02', type: '区域停留预警', group: 'site', level: '中', status: '待处理', plate: '云A66666', driver: '冯二', phone: '13808710040', taskNo: taskCode(40), route: '大开门 → 研和', time: TODAY + ' 09:02:00', waitMin: 51, location: '大开门充电站', metricLabel: '停留区域', metric: '大开门充电站', reason: '车辆在充电站停留已达规则阈值', facts: ['09:02 进入大开门充电站', '当前仍在充电站范围', '停留时长：51 min'] },
      { id: 'DA-SD01', type: '车速预警', group: 'speed', level: '高', status: '新告警', plate: '云A·E1936', driver: '王磊', phone: '13808710022', taskNo: taskCode(81), route: '北城 → 研和', time: TODAY + ' 14:24:00', waitMin: 2, location: 'G8511 昆磨高速', metricLabel: '当前车速', metric: '86 km/h', reason: '车辆速度达到配置的异常/超速规则（阈值 80 km/h）', facts: ['当前速度：86 km/h', '预警阈值：80 km/h', '持续时间：2 min'] },
      { id: 'DA-WB01', type: '卸货后未上传磅单', group: 'weigh', level: '高', status: '新告警', plate: '云A·F4470', driver: '马旺', phone: '13808710023', taskNo: taskCode(82), route: '昆钢 → 北城', time: TODAY + ' 13:57:00', waitMin: 26, location: '北城卸货地外侧', metricLabel: '磅单状态', metric: '未上传', reason: '司机离开卸货地后超过默认 15 分钟仍未上传卸货磅单', facts: ['13:31 离开北城卸货地', '卸货磅单：未上传', '已超过默认 15 min 阈值'] },
      { id: 'DA-SC01', type: 'SOC预警', group: 'soc', level: '中', status: '待处理', plate: '云A·D8021', driver: '李宏俊', phone: '13808710021', taskNo: taskCode(80), route: '大开门 → 昆钢', time: TODAY + ' 13:52:00', waitMin: 34, location: '昆钢 → 研和途中', metricLabel: '当前 SOC', metric: '18%', reason: '车辆 SOC 低于配置阈值 20%', facts: ['当前 SOC：18%', '预警阈值：20%', '当前任务：运输中'] },
      { id: 'DA-SC02', type: 'SOC预警', group: 'soc', level: '中', status: '待处理', plate: '云A·G2288', driver: '张建华', phone: '13808710024', taskNo: taskCode(83), route: '大开门 → 北城', time: TODAY + ' 14:08:00', waitMin: 18, location: '大开门充电站附近', metricLabel: '当前 SOC', metric: '16%', reason: '车辆 SOC 低于配置阈值 20%', facts: ['当前 SOC：16%', '预警阈值：20%', '距最近充电站 2.4 km'] },
      { id: 'DA-FT01', type: '司机疲劳驾驶', group: 'fatigue', level: '高', status: '新告警', plate: '云A·K4419', driver: '赵明', phone: '13808710027', taskNo: taskCode(86), route: '昆钢 → 北城', time: TODAY + ' 10:18:00', waitMin: 252, location: 'G8511 昆磨高速', metricLabel: '连续驾驶', metric: '4h12min', reason: '连续驾驶已满 4 小时，必须休息后再继续运输', facts: ['连续驾驶时长：4h12min', '规则阈值：连续驾驶满 4 小时必须休息', '当前状态：仍在行驶中，尚未开始休息'] },
      { id: 'DA-SP99', type: '停车预警', group: 'stop', level: '中', status: '已处理', plate: '云A12345', driver: '张三', phone: '13808718888', taskNo: taskCode(18), route: '昆钢 → 北城', time: TODAY + ' 07:51:00', waitMin: 18, location: '昆钢厂区外侧', metricLabel: '当前车速', metric: '42 km/h', reason: '车辆恢复正常行驶后，调度标记已处理', facts: ['07:51 触发预警', '08:09 恢复行驶', '已记录处理结果'] },
      { id: 'DA-ST99', type: '区域停留预警', group: 'site', level: '中', status: '已忽略', plate: '云A88888', driver: '孙八', phone: '13808710042', taskNo: taskCode(42), route: '昆钢 → 研和', time: TODAY + ' 08:20:00', waitMin: 22, location: '研和卸货区', metricLabel: '停留区域', metric: '研和卸货区', reason: '现场排队卸货，确认无需进一步处理', facts: ['忽略原因：卸货排队属业务停留'] },
      { id: 'DA-FT99', type: '司机疲劳驾驶', group: 'fatigue', level: '高', status: '已处理', plate: '云A·H6612', driver: '陈志远', phone: '13808710025', taskNo: taskCode(84), route: '昆钢 → 研和', time: TODAY + ' 06:40:00', waitMin: 25, location: '玉溪服务区', metricLabel: '连续驾驶', metric: '已休息', reason: '司机完成强制休息后，调度标记已处理', facts: ['06:40 连续驾驶满 4 小时触发', '06:45 停靠服务区休息', '07:05 休息达标后恢复行驶'] }
    ].map(function (row) {
      var item = Object.assign({}, row);
      if (desk.alertStatus[row.id]) item.status = desk.alertStatus[row.id];
      if (desk.alertResult && desk.alertResult[row.id]) item.result = desk.alertResult[row.id];
      if (desk.alertNote && desk.alertNote[row.id]) item.note = desk.alertNote[row.id];
      return item;
    });
  }

  function dispatchAlertWaitLine(item) {
    return '持续 ' + dispatchWaitText(item.waitMin);
  }

  var DISPATCH_ALERT_RESULTS = ['已联系司机，情况正常', '运输异常，持续关注', '已调整运输安排', '误报', '其他'];

  function dispatchAlertActionDefs(item) {
    if (item.status === '已处理' || item.status === '已忽略') return [['快览', 'task']];
    return [['定位', 'locate'], ['联系司机', 'contact'], ['快览', 'task'], ['处理', 'handle']];
  }

  function visibleDispatchAlerts() {
    var q = (dispatchAlertQ || '').trim().toLowerCase();
    return dispatchAlertCards().filter(function (item) {
      var open = item.status === '新告警' || item.status === '待处理' || item.status === '处理中';
      if (dispatchAlertStatus === 'open' && !open) return false;
      if (dispatchAlertStatus === 'done' && item.status !== '已处理') return false;
      if (dispatchAlertStatus === 'ignored' && item.status !== '已忽略') return false;
      if (dispatchAlertType !== 'all' && item.type !== dispatchAlertType) return false;
      if (dispatchAlertLevel === '高' && item.level !== '高') return false;
      if (dispatchAlertLevel === 'mid' && item.level === '高') return false;
      if (!q) return true;
      return [item.plate, item.driver, item.taskNo, item.route].join(' ').toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) {
      var lw = { '高': 0, '中': 1 };
      var sw = { '新告警': 0, '待处理': 1, '处理中': 2, '已处理': 3, '已忽略': 4 };
      var la = Object.prototype.hasOwnProperty.call(lw, a.level) ? lw[a.level] : 9;
      var lb = Object.prototype.hasOwnProperty.call(lw, b.level) ? lw[b.level] : 9;
      if (la !== lb) return la - lb;
      var sa = Object.prototype.hasOwnProperty.call(sw, a.status) ? sw[a.status] : 9;
      var sb = Object.prototype.hasOwnProperty.call(sw, b.status) ? sw[b.status] : 9;
      if (sa !== sb) return sa - sb;
      return (b.waitMin || 0) - (a.waitMin || 0);
    });
  }

  function renderDispatchAlertCard(item) {
    var actions = dispatchAlertActionDefs(item).map(function (act) {
      var on = act[1] === 'handle' && dispatchAlertHandleId === item.id;
      var cls = act[1] === 'handle' ? ('btn btn-primary btn-sm' + (on ? ' is-on' : '')) : '';
      return '<button class="' + cls + '" type="button" onclick="WB.dispatchAlertAction(\'' + esc(act[1]) + '\',\'' + esc(item.id) + '\')">' + esc(act[0]) + '</button>';
    }).join('');
    var handle = '';
    if (dispatchAlertHandleId === item.id) {
      var opts = DISPATCH_ALERT_RESULTS.map(function (name) {
        return '<label class="wb-alert-result"><input type="radio" name="wbAlertResult" value="' + esc(name) + '"><span>' + esc(name) + '</span></label>';
      }).join('');
      handle = '<div class="wb-alert-handle">'
        + '<strong>处理结果</strong>'
        + opts
        + '<label class="wb-alert-note">备注<input id="wbAlertHandleNote" class="form-control-text" placeholder="选填；选择其他时必填"></label>'
        + '<div class="wb-alert-handle-foot"><button class="btn btn-default btn-sm" type="button" onclick="WB.cancelAlertHandle()">取消</button>'
        + '<button class="btn btn-primary btn-sm" type="button" onclick="WB.confirmAlertHandle(\'' + esc(item.id) + '\')">确认处理</button></div></div>';
    }
    return '<article class="wb-alert-card is-' + (item.level === '高' ? 'high' : 'mid') + ' is-' + esc(item.group) + (dispatchAlertHandleId === item.id ? ' is-handling' : '') + (dispatchHit === item.id ? ' is-hit' : '') + '">'
      + '<strong class="wb-alert-type"><i class="wb-alert-dot" aria-hidden="true"></i>' + esc(item.type) + '</strong>'
      + '<p class="wb-alert-who">' + esc(item.plate + ' · ' + item.driver) + '</p>'
      + '<p class="wb-alert-route">' + esc(item.route) + '</p>'
      + '<p class="wb-alert-wait">' + esc(dispatchAlertWaitLine(item)) + '</p>'
      + '<div class="wb-alert-actions">' + actions + '</div>'
      + handle + '</article>';
  }

  function dispatchDriverPhone(name) {
    var rec = dispatchDriverRecords().filter(function (row) { return row.name === name; })[0];
    if (rec && rec.phone) return rec.phone;
    var alert = dispatchAlertCards().filter(function (item) { return item.driver === name; })[0];
    return (alert && alert.phone) || '—';
  }

  function dispatchVehiclePeekHtml(row) {
    if (!row) return '';
    var statusLabel = row.status === '空闲' ? '立即可派' : row.status;
    var current = row.task && row.task !== '—' ? row.task : '暂无';
    var next = dispatchCapacityHasNext(row) ? row.nextTask : '暂无';
    return '<div class="modal-header"><div class="modal-title">车辆快览</div><button class="modal-close" type="button" onclick="WB.closeModal()" aria-label="关闭">×</button></div>'
      + '<div class="modal-body"><div class="form-grid">'
      + field('车牌', row.truck) + field('司机', row.driver)
      + field('挂车', row.trailer || '—') + field('运行状态', statusLabel)
      + field('当前位置', row.location || '—') + field('SOC', (row.soc != null ? row.soc + '%' : '—'))
      + field('当前任务', current) + field('下一任务', next)
      + '</div><p class="detail-section-sub">工作台内不嵌地图。需要看点位时再进运输监控中心。</p></div>'
      + '<div class="modal-footer"><button class="btn btn-default" type="button" onclick="WB.closeModal()">关闭</button>'
      + '<button class="btn btn-default" type="button" onclick="WB.openDriverPeek(\'' + esc(row.driver) + '\')">司机快览</button>'
      + '<button class="btn btn-primary" type="button" onclick="WB.closeModal();WB.openScreen()">去监控中心查看</button></div>';
  }

  function dispatchDriverPeekHtml(name) {
    var rec = dispatchDriverRecords().filter(function (row) { return row.name === name; })[0] || { name: name, phone: dispatchDriverPhone(name), status: '—', cert: '—', truck: '' };
    var row = dispatchCapacityRows().filter(function (item) { return item.driver === name; })[0];
    var phone = rec.phone || dispatchDriverPhone(name);
    var truck = (row && row.truck) || rec.truck || '—';
    return '<div class="modal-header"><div class="modal-title">司机快览</div><button class="modal-close" type="button" onclick="WB.closeModal()" aria-label="关闭">×</button></div>'
      + '<div class="modal-body"><div class="form-grid">'
      + field('司机', rec.name || name) + field('电话', phone)
      + field('状态', rec.status || '—') + field('证件', rec.cert || '—')
      + field('当前车辆', truck) + field('当前位置', row ? (row.location || '—') : '—')
      + field('运行状态', row ? (row.status === '空闲' ? '立即可派' : row.status) : '—')
      + field('当前任务', row && row.task && row.task !== '—' ? row.task : '暂无')
      + '</div></div>'
      + '<div class="modal-footer"><button class="btn btn-default" type="button" onclick="WB.closeModal()">关闭</button>'
      + (phone && phone !== '—' ? '<a class="btn btn-default" href="tel:' + esc(phone) + '">打电话</a>' : '')
      + (row ? '<button class="btn btn-primary" type="button" onclick="WB.openVehiclePeek(\'' + esc(row.truck) + '\')">车辆快览</button>' : '')
      + '</div>';
  }

  function dispatchLocationPeekHtml(ctx) {
    var facts = (ctx.facts || []).map(function (line) { return '<li>' + esc(line) + '</li>'; }).join('');
    return '<div class="modal-header"><div class="modal-title">车辆定位</div><button class="modal-close" type="button" onclick="WB.closeModal()" aria-label="关闭">×</button></div>'
      + '<div class="modal-body"><div class="form-grid">'
      + field('车辆', ctx.plate) + field('司机', ctx.driver || '—')
      + field('当前位置', ctx.location || '—') + field(ctx.metricLabel || '当前状态', ctx.metric || '—')
      + field('运输线路', ctx.route || '—') + field('持续时长', ctx.wait || '—')
      + (facts ? '<div class="form-item full"><span class="form-label">现场事实</span><div class="form-value"><ul class="wb-peek-facts">' + facts + '</ul></div></div>' : '')
      + '</div><p class="detail-section-sub">工作台内不嵌地图。需要看点位时再进运输监控中心。</p></div>'
      + '<div class="modal-footer"><button class="btn btn-default" type="button" onclick="WB.closeModal()">关闭</button>'
      + '<button class="btn btn-primary" type="button" onclick="WB.closeModal();WB.openScreen()">去监控中心查看</button></div>';
  }

  function dispatchAlertActionHtml(item, action) {
    if (action === 'locate' || action === 'site' || action === 'track') {
      return dispatchLocationPeekHtml({
        plate: item.plate, driver: item.driver, location: item.location, route: item.route,
        metricLabel: item.metricLabel, metric: item.metric, wait: dispatchWaitText(item.waitMin), facts: item.facts
      });
    }
    if (action === 'task') {
      return '<div class="modal-header"><div class="modal-title">任务快览</div><button class="modal-close" type="button" onclick="WB.closeModal()" aria-label="关闭">×</button></div>'
        + '<div class="modal-body"><div class="form-grid">'
        + field('任务单号', item.taskNo) + field('运输线路', item.route)
        + field('车辆', item.plate) + field('司机', item.driver)
        + field('司机电话', item.phone) + field('当前位置', item.location)
        + field(item.metricLabel || '关键指标', item.metric) + field('告警类型', item.type)
        + '</div></div><div class="modal-footer"><button class="btn btn-default" type="button" onclick="WB.closeModal()">关闭</button></div>';
    }
    return '';
  }

  function dispatchCapacityRows() {
    return [
      { driver: '周闲', truck: '云A12345', trailer: '云A·挂8011', location: '大开门停车场', status: '空闲', task: '—', taskNo: '', soc: 78, nextTask: '—', nextTaskNo: '', releasing: false },
      { driver: '钱七', truck: '云A56789', trailer: '云A·挂8012', location: '北城待命区', status: '空闲', task: '—', taskNo: '', soc: 69, nextTask: '—', nextTaskNo: '', releasing: false },
      { driver: '马旺', truck: '云A·F4470', trailer: '云A·挂8023', location: '北城卸货地', status: '卸货中', task: '昆钢 → 北城', taskNo: taskCode(82), soc: 63, nextTask: '—', nextTaskNo: '', releasing: true },
      { driver: '王磊', truck: '云A·E1936', trailer: '云A·挂8022', location: 'G8511 昆磨高速', status: '运输中', task: '北城 → 研和', taskNo: taskCode(81), soc: 41, nextTask: '昆钢 → 研和', nextTaskNo: 'YP-20260909-002', releasing: true },
      { driver: '李宏俊', truck: '云A·D8021', trailer: '云A·挂8021', location: '昆钢卸货区', status: '卸货中', task: '大开门 → 昆钢', taskNo: taskCode(80), soc: 18, nextTask: '昆钢 → 北城', nextTaskNo: 'YP-20260909-001', releasing: true },
      { driver: '张建华', truck: '云A·G2288', trailer: '云A·挂8024', location: '大开门充电站', status: '充电中', task: '大开门 → 北城', taskNo: taskCode(83), soc: 16, nextTask: '—', nextTaskNo: '', releasing: true },
      { driver: '陈志远', truck: '云A·H6612', trailer: '云A·挂8025', location: '昆磨高速辅路', status: '运输中', task: '昆钢 → 研和', taskNo: taskCode(84), soc: 55, nextTask: '大开门 → 研和', nextTaskNo: 'YP-20260909-004', releasing: false },
      { driver: '赵明', truck: '云A·J3058', trailer: '云A·挂8026', location: '昆钢厂区外侧', status: '空闲', task: '—', taskNo: '', soc: 82, nextTask: '—', nextTaskNo: '', releasing: false }
    ].map(function (row) {
      var patch = (ensureDispatchDesk().capacityPatch || {})[row.truck] || {};
      var item = Object.assign({}, row, patch);
      var op = dispatchCapacityActionOf(item);
      item.action = op.action;
      item.actionKey = op.actionKey;
      return item;
    });
  }

  function dispatchCapacityHasNext(row) {
    return !!(row.nextTask && row.nextTask !== '—' && row.nextTask !== '暂无');
  }

  function dispatchCapacityActionOf(row) {
    if (row.status === '空闲') {
      return dispatchCapacityHasNext(row)
        ? { action: '查看下一任务', actionKey: 'viewNext' }
        : { action: '派任务', actionKey: 'assign' };
    }
    if (row.status === '卸货中') {
      return dispatchCapacityHasNext(row)
        ? { action: '查看下一任务', actionKey: 'viewNext' }
        : { action: '安排下一单', actionKey: 'arrange' };
    }
    return { action: '车辆快览', actionKey: 'locate' };
  }

  function dispatchCapacityStatusHtml(status) {
    var kind = status === '空闲' ? 'idle' : (status === '运输中' || status === '行驶中' ? 'run' : (status === '充电中' ? 'charge' : 'unload'));
    var label = status === '空闲' ? '立即可派' : status;
    return '<span class="wb-capacity-status is-' + kind + '"><i aria-hidden="true"></i>' + esc(label) + '</span>';
  }

  function renderDispatchCapacityRow(row) {
    var next = dispatchCapacityHasNext(row)
      ? '<span class="wb-capacity-next is-set">' + esc(row.nextTask) + '</span>'
      : '<span class="wb-capacity-next is-none">下一任务暂无</span>';
    var rowClass = row.status === '空闲' ? ' is-idle' : (row.status === '卸货中' && !dispatchCapacityHasNext(row) ? ' is-need-next' : '');
    if (dispatchHit === row.truck) rowClass += ' is-hit';
    return '<tr class="' + rowClass.trim() + '"><td><div class="wb-capacity-identity"><button type="button" onclick="WB.openDriverPeek(\'' + esc(row.driver) + '\')"><b>' + esc(row.driver) + '</b></button><button type="button" onclick="WB.openVehiclePeek(\'' + esc(row.truck) + '\')"><span>' + esc(row.truck) + '</span></button></div></td>'
      + '<td>' + dispatchCapacityStatusHtml(row.status) + '</td>'
      + '<td><span class="wb-capacity-soc-text' + (row.soc < 30 ? ' is-low' : '') + '">SOC' + row.soc + '%</span></td>'
      + '<td>' + next + '</td>'
      + '<td><button class="btn ' + (row.actionKey === 'assign' || row.actionKey === 'arrange' ? 'btn-primary' : 'btn-default') + ' btn-sm wb-capacity-action" type="button" onclick="WB.dispatchCapacityAction(\'' + esc(row.actionKey) + '\',\'' + esc(row.truck) + '\')">' + esc(row.action) + '</button></td></tr>';
  }

  function dispatchCapacityActionHtml(row) {
    if (row.actionKey === 'locate') return dispatchVehiclePeekHtml(row);
    if (row.actionKey === 'viewNext') {
      return '<div class="modal-header"><div class="modal-title">下一任务</div><button class="modal-close" type="button" onclick="WB.closeModal()" aria-label="关闭">×</button></div>'
        + '<div class="modal-body"><div class="form-grid">'
        + field('司机', row.driver) + field('车头', row.truck)
        + field('当前状态', row.status) + field('当前位置', row.location)
        + field('当前任务', row.task) + field('SOC', row.soc + '%')
        + field('下一任务', row.nextTask) + field('任务单号', row.nextTaskNo || '—')
        + '</div></div><div class="modal-footer"><button class="btn btn-default" type="button" onclick="WB.closeModal()">关闭</button>'
        + '<button class="btn btn-primary" type="button" onclick="WB.confirmDispatchCapacityAction(\'viewNext\',\'' + esc(row.truck) + '\')">转正式派单</button></div>';
    }
    return '';
  }

  function dispatchTaskLoadPoint(item) {
    return item.load || String(item.route || '').split('→')[0].trim();
  }

  function dispatchVehicleAnchor(row) {
    if (row && row.task && row.task.indexOf('→') >= 0 && row.status !== '空闲') {
      return String(row.task.split('→').pop() || '').trim();
    }
    var loc = (row && row.location) || '';
    if (loc.indexOf('北城') >= 0) return '北城';
    if (loc.indexOf('昆钢') >= 0) return '昆钢';
    if (loc.indexOf('大开门') >= 0) return '大开门';
    if (loc.indexOf('研和') >= 0) return '研和';
    return '';
  }

  function dispatchPendingDispatchTodos() {
    return dispatchTodoCards().filter(function (item) {
      return item.group === 'dispatch' && item.status === '待处理';
    });
  }

  function dispatchReverseCandidates(row) {
    var pending = dispatchPendingDispatchTodos();
    var anchor = dispatchVehicleAnchor(row);
    var matched = pending.filter(function (item) { return dispatchTaskLoadPoint(item) === anchor; });
    if (matched.length) return matched;
    return pending.slice().sort(function (a, b) { return (b.waitMin || 0) - (a.waitMin || 0); });
  }

  function dispatchReverseTaskOptionHtml(item) {
    var on = item.id === dispatchAssignTaskId;
    return '<label class="wb-assign-option' + (on ? ' is-on' : '') + '">'
      + '<input type="radio" name="wbReversePick" value="' + esc(item.id) + '"' + (on ? ' checked' : '') + ' onchange="WB.pickReverseTask(this.value)">'
      + '<span>' + esc(item.route) + '</span></label>';
  }

  function dispatchReverseHtml(row) {
    var tasks = dispatchReverseCandidates(row);
    var title = dispatchDrawerMode === 'preassign' ? '车找任务 · 下一任务' : '车找任务';
    var confirm = dispatchDrawerMode === 'preassign' ? '确认预派' : '确认派单';
    var nextText = dispatchCapacityHasNext(row) ? row.nextTask : '暂无';
    var options = tasks.map(dispatchReverseTaskOptionHtml).join('');
    var body = '<div class="wb-assign-task-head"><div class="wb-assign-route">' + esc(row.driver + ' / ' + row.truck) + '</div>'
      + '<div class="wb-assign-facts"><p>当前：' + esc(row.status) + '</p>'
      + '<p>当前任务：' + esc(row.task || '—') + '</p>'
      + '<p>下一任务：' + esc(nextText) + '</p></div></div>'
      + '<section class="wb-assign-group" aria-label="待派任务"><h3>待派任务</h3>'
      + (options || '<p class="wb-assign-empty">暂无待派任务</p>')
      + '</section>';
    var footer = '<button class="btn btn-default" type="button" onclick="WB.closeDispatchDrawer()">取消</button>'
      + '<button class="btn btn-primary" type="button" onclick="WB.confirmAssign()"' + (tasks.length ? '' : ' disabled') + '>' + confirm + '</button>';
    return '<aside class="wb-dispatch-drawer is-assign is-reverse" role="dialog" aria-modal="true" aria-labelledby="wbDispatchDrawerTitle">'
      + '<div class="wb-dispatch-drawer-head"><div><span>调度工作台</span><h2 id="wbDispatchDrawerTitle">' + esc(title) + '</h2></div>'
      + '<button type="button" class="wb-dispatch-drawer-close" onclick="WB.closeDispatchDrawer()" aria-label="关闭">×</button></div>'
      + '<div class="wb-dispatch-drawer-body">' + body + '</div>'
      + '<div class="wb-dispatch-drawer-foot">' + footer + '</div></aside>';
  }

  function openReverseDispatchDrawer(truck, mode) {
    var row = dispatchAssignRow(truck);
    if (!row) return;
    dispatchDrawerDir = 'vehicle';
    dispatchDrawerMode = mode === 'preassign' ? 'preassign' : 'formal';
    dispatchAssignPick = row.truck;
    var tasks = dispatchReverseCandidates(row);
    dispatchAssignTaskId = tasks[0] ? tasks[0].id : '';
    showDispatchDrawer(dispatchReverseHtml(row));
  }

  function dispatchAssignPools() {
    var rows = dispatchCapacityRows();
    return {
      idle: rows.filter(function (row) { return row.status === '空闲'; }),
      releasing: rows.filter(function (row) { return !!row.releasing; })
    };
  }

  function dispatchAssignRow(truck) {
    return dispatchCapacityRows().filter(function (row) { return row.truck === truck; })[0] || null;
  }

  function dispatchDrawerTask(id) {
    var pending = dispatchTodoCards().filter(function (item) {
      return (item.group === 'dispatch' || item.group === 'preassign') && item.status === '待处理';
    });
    var item = pending.filter(function (row) { return row.id === id; })[0] || pending.filter(function (row) { return row.group === 'dispatch'; })[0] || pending[0];
    if (!item) {
      return { id: 'DT-001', no: taskCode(1), route: '昆钢 → 北城', cargo: '钢材 · 32吨', depart: '10:30', remaining: '距计划装货 38min', priority: '高' };
    }
    return {
      id: item.id,
      no: item.taskNo,
      route: item.route,
      cargo: cargoLine(item),
      depart: item.depart || '14:30',
      remaining: item.untilLoadMin != null ? dispatchUntilLoadText(item.untilLoadMin) : dispatchWaitText(item.waitMin),
      remainingLabel: item.untilLoadMin != null ? '装货倒计时' : '已等待',
      priority: item.priority,
      driver: item.driver || '',
      truck: item.truck || ''
    };
  }

  function dispatchAssignOptionHtml(row, releasing) {
    var on = row.truck === dispatchAssignPick;
    var meta = releasing ? (esc(row.status) + ' · SOC ' + row.soc + '%') : ('SOC ' + row.soc + '%');
    return '<label class="wb-assign-option' + (on ? ' is-on' : '') + '">'
      + '<input type="radio" name="wbAssignPick" value="' + esc(row.truck) + '"' + (on ? ' checked' : '') + ' onchange="WB.pickAssignCapacity(this.value)">'
      + '<span>' + esc(row.driver) + ' / ' + esc(row.truck) + '</span>'
      + '<b>' + meta + '</b></label>';
  }

  function dispatchAssignHtml(task) {
    var pools = dispatchAssignPools();
    var pick = dispatchAssignRow(dispatchAssignPick) || pools.idle[0] || pools.releasing[0];
    if (pick) dispatchAssignPick = pick.truck;
    var idle = pools.idle.map(function (row) { return dispatchAssignOptionHtml(row, false); }).join('');
    var releasing = pools.releasing.map(function (row) { return dispatchAssignOptionHtml(row, true); }).join('');
    var title = dispatchDrawerMode === 'preassign' ? '任务找车 · 预派' : '任务找车';
    var confirm = dispatchDrawerMode === 'preassign' ? '确认预派' : '确认派单';
    var body = '<div class="wb-assign-task-head"><div class="wb-assign-route">' + esc(task.route) + '</div>'
      + '<p class="wb-assign-task">任务：' + esc(task.no) + '</p>'
      + (task.driver || task.truck ? '<p class="wb-assign-pre">当前预派：' + esc((task.driver || '—') + ' / ' + (task.truck || '—')) + '</p>' : '') + '</div>'
      + '<section class="wb-assign-group" aria-label="当前可用运力"><h3>当前可用运力</h3>'
      + '<h4>立即可派</h4>' + (idle || '<p class="wb-assign-empty">暂无立即可派运力</p>')
      + '<h4>即将释放</h4>' + (releasing || '<p class="wb-assign-empty">暂无即将释放运力</p>')
      + '</section>'
      + '<div class="wb-assign-fields">'
      + '<div class="form-item"><label class="form-label" for="wbAssignDriver">司机</label><input class="form-control-text" id="wbAssignDriver" value="' + esc(pick ? pick.driver : '') + '" readonly></div>'
      + '<div class="form-item"><label class="form-label" for="wbAssignTruck">牵引车</label><input class="form-control-text" id="wbAssignTruck" value="' + esc(pick ? pick.truck : '') + '" readonly></div>'
      + '<div class="form-item"><label class="form-label" for="wbAssignTrailer">挂车</label><input class="form-control-text" id="wbAssignTrailer" value="' + esc(pick ? pick.trailer : '') + '" readonly></div>'
      + '</div>';
    var footer = '<button class="btn btn-default" type="button" onclick="WB.closeDispatchDrawer()">取消</button>'
      + '<button class="btn btn-primary" type="button" onclick="WB.confirmAssign()">' + confirm + '</button>';
    return '<aside class="wb-dispatch-drawer is-assign" role="dialog" aria-modal="true" aria-labelledby="wbDispatchDrawerTitle">'
      + '<div class="wb-dispatch-drawer-head"><div><span>调度工作台</span><h2 id="wbDispatchDrawerTitle">' + esc(title) + '</h2></div>'
      + '<button type="button" class="wb-dispatch-drawer-close" onclick="WB.closeDispatchDrawer()" aria-label="关闭">×</button></div>'
      + '<div class="wb-dispatch-drawer-body">' + body + '</div>'
      + '<div class="wb-dispatch-drawer-foot">' + footer + '</div></aside>';
  }

  function openDispatchDrawer(id, mode, truck) {
    dispatchDrawerDir = 'task';
    dispatchDrawerMode = mode === 'preassign' ? 'preassign' : 'formal';
    var task = dispatchDrawerTask(id);
    dispatchAssignTaskId = task.id;
    var pools = dispatchAssignPools();
    dispatchAssignPick = truck || task.truck || (pools.idle[0] && pools.idle[0].truck) || (pools.releasing[0] && pools.releasing[0].truck) || '';
    showDispatchDrawer(dispatchAssignHtml(task));
  }

  function showDispatchDrawer(innerHtml) {
    closeDispatchMore();
    var host = document.getElementById('wbDispatchDrawerHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'wbDispatchDrawerHost';
      document.body.appendChild(host);
    }
    host.innerHTML = '<div class="wb-dispatch-drawer-overlay" id="wbDispatchDrawerOverlay">' + innerHtml + '</div>';
    var overlay = host.querySelector('#wbDispatchDrawerOverlay');
    overlay.addEventListener('click', function (e) { if (e.target === overlay) WB.closeDispatchDrawer(); });
    setTimeout(function () {
      overlay.classList.add('show');
      var close = host.querySelector('.wb-dispatch-drawer-close');
      if (close) close.focus();
    }, 0);
  }

  function dispatchQuickDrawerHtml(title, body, footer) {
    return '<aside class="wb-dispatch-drawer is-form" role="dialog" aria-modal="true" aria-labelledby="wbDispatchDrawerTitle">'
      + '<div class="wb-dispatch-drawer-head"><div><span>调度工作台</span><h2 id="wbDispatchDrawerTitle">' + esc(title) + '</h2></div>'
      + '<button type="button" class="wb-dispatch-drawer-close" onclick="WB.closeDispatchDrawer()" aria-label="关闭">×</button></div>'
      + '<div class="wb-dispatch-drawer-body">' + body + '</div>'
      + '<div class="wb-dispatch-drawer-foot">' + footer + '</div></aside>';
  }

  function dispatchTodoTabCounts() {
    var open = dispatchTodoCards().filter(function (item) { return item.status === '待处理'; });
    var split = open.filter(function (item) { return item.group === 'split'; }).length;
    var dispatch = open.filter(function (item) { return item.group === 'dispatch'; }).length;
    var preassign = open.filter(function (item) { return item.group === 'preassign'; }).length;
    var other = open.filter(function (item) { return item.group === 'other'; }).length;
    return {
      all: open.length,
      biz: split + dispatch + preassign,
      split: split,
      dispatch: dispatch,
      preassign: preassign,
      other: other,
      done: dispatchTodoCards().filter(function (item) { return item.status === '已完成'; }).length
    };
  }

  function dispatchExecStats() {
    var rows = ((store.board && store.board.executing) || []).filter(function (row) { return row.status === '运输中'; });
    var load = rows.filter(function (row) { return row.node === '装货'; }).length;
    var run = rows.filter(function (row) { return row.node === '行驶'; }).length;
    var unload = rows.filter(function (row) { return row.node === '卸货'; }).length;
    return { load: load, run: run, unload: unload, all: load + run + unload };
  }

  function dispatchCapacityStats() {
    var rows = dispatchCapacityRows();
    var idle = rows.filter(function (row) { return row.status === '空闲'; }).length;
    var releasing = rows.filter(function (row) { return !!row.releasing; }).length;
    var run = rows.filter(function (row) { return row.status === '运输中' || row.status === '行驶中'; }).length;
    var handling = rows.filter(function (row) { return row.status === '装货中' || row.status === '卸货中'; }).length;
    var noneNext = rows.filter(function (row) { return row.status !== '空闲' && !dispatchCapacityHasNext(row); }).length;
    return { idle: idle, releasing: releasing, available: idle + releasing, run: run, handling: handling, all: rows.length, noneNext: noneNext };
  }

  function visibleDispatchCapacity() {
    var q = (dispatchCapacityQ || '').trim().toLowerCase();
    return dispatchCapacityRows().filter(function (row) {
      if (dispatchCapacityFilter === 'idle') { if (row.status !== '空闲') return false; }
      else if (dispatchCapacityFilter === 'releasing') { if (!row.releasing) return false; }
      else if (dispatchCapacityFilter === 'available') { if (row.status !== '空闲' && !row.releasing) return false; }
      else if (dispatchCapacityFilter === 'run') { if (row.status !== '运输中' && row.status !== '行驶中') return false; }
      else if (dispatchCapacityFilter === 'load') { if (row.status !== '装货中' && row.status !== '卸货中') return false; }
      if (!q) return true;
      return [row.driver, row.truck, row.task, row.nextTask].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }

  function dispatchAlertOpenItems() {
    return dispatchAlertCards().filter(function (item) {
      return item.status === '新告警' || item.status === '待处理' || item.status === '处理中';
    });
  }

  function openDispatchAlertCount() {
    return dispatchAlertOpenItems().length;
  }

  function dispatchAlertLevelCounts() {
    var open = dispatchAlertOpenItems();
    var high = open.filter(function (item) { return item.level === '高'; }).length;
    return { high: high, other: open.length - high };
  }

  function closeDispatchMore() {
    var panel = document.getElementById('wbDispatchMorePanel');
    var btn = document.getElementById('wbDispatchMoreBtn');
    if (panel) panel.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function dispatchBindHtml() {
    var rows = dispatchCapacityRows();
    function options(key) {
      return rows.map(function (row) {
        return '<option value="' + esc(row[key]) + '">' + esc(row[key]) + '</option>';
      }).join('');
    }
    var body = '<p class="detail-section-sub">把常用司机绑到牵引车和挂车，派车时直接带入，不用每次重选。</p>'
      + '<div class="form-grid">'
      + '<div class="form-item"><label class="form-label" for="wbBindDriver">司机</label><select class="form-control-text" id="wbBindDriver">' + options('driver') + '</select></div>'
      + '<div class="form-item"><label class="form-label" for="wbBindTruck">牵引车</label><select class="form-control-text" id="wbBindTruck">' + options('truck') + '</select></div>'
      + '<div class="form-item"><label class="form-label" for="wbBindTrailer">挂车</label><select class="form-control-text" id="wbBindTrailer">' + options('trailer') + '</select></div>'
      + '</div>';
    var footer = '<button class="btn btn-default" type="button" onclick="WB.closeDispatchDrawer()">取消</button>'
      + '<button class="btn btn-primary" type="button" onclick="WB.confirmDriverBind()">确认绑定</button>';
    return dispatchQuickDrawerHtml('司机车辆绑定', body, footer);
  }

  function dispatchDriverRecords() {
    var patch = ensureDispatchDesk().driverPatch || {};
    var map = {};
    ((store.board && store.board.drivers) || []).forEach(function (row) {
      map[row.name] = { name: row.name, phone: row.phone, status: row.status || '可用', cert: row.cert || '有效', truck: '' };
    });
    dispatchCapacityRows().forEach(function (row) {
      if (!map[row.driver]) {
        map[row.driver] = { name: row.driver, phone: '13808710020', status: '可用', cert: '有效', truck: row.truck };
      } else {
        map[row.driver].truck = row.truck;
      }
    });
    return Object.keys(map).map(function (name) {
      var item = Object.assign({}, map[name], patch[name] || {});
      item.name = name;
      return item;
    });
  }

  function dispatchDriverQuickHtml(name) {
    var records = dispatchDriverRecords();
    var current = records.filter(function (row) { return row.name === name; })[0] || records[0];
    if (!current) {
      current = { name: '', phone: '', status: '可用', cert: '有效', truck: '' };
    }
    var opts = records.map(function (row) {
      return '<option value="' + esc(row.name) + '"' + (row.name === current.name ? ' selected' : '') + '>' + esc(row.name) + (row.truck ? ' · ' + esc(row.truck) : '') + '</option>';
    }).join('');
    var body = '<p class="detail-section-sub">只改电话、可用状态和证件提醒。复杂档案仍去司机信息页。</p>'
      + '<div class="form-grid">'
      + '<div class="form-item"><label class="form-label" for="wbDriverName">司机</label><select class="form-control-text" id="wbDriverName" onchange="WB.fillDriverQuick(this.value)">' + opts + '</select></div>'
      + '<div class="form-item"><label class="form-label" for="wbDriverPhone">电话</label><input class="form-control-text" id="wbDriverPhone" value="' + esc(current.phone || '') + '" maxlength="11"></div>'
      + '<div class="form-item"><label class="form-label" for="wbDriverStatus">状态</label><select class="form-control-text" id="wbDriverStatus"><option' + (current.status === '可用' ? ' selected' : '') + '>可用</option><option' + (current.status === '停用' ? ' selected' : '') + '>停用</option></select></div>'
      + '<div class="form-item"><label class="form-label" for="wbDriverCert">证件</label><select class="form-control-text" id="wbDriverCert"><option' + (current.cert === '有效' ? ' selected' : '') + '>有效</option><option' + (current.cert === '即将到期' ? ' selected' : '') + '>即将到期</option></select></div>'
      + '</div>';
    var footer = '<button class="btn btn-default" type="button" onclick="WB.closeDispatchDrawer()">取消</button>'
      + '<button class="btn btn-primary" type="button" onclick="WB.confirmDriverQuick()">保存</button>';
    return dispatchQuickDrawerHtml('简单司机信息维护', body, footer);
  }

  function dispatchAreaFenceNames() {
    var names = [];
    (window.__fences || []).forEach(function (fence) {
      if (fence && fence.type === '区域' && fence.name && names.indexOf(fence.name) < 0) names.push(fence.name);
    });
    if (!names.length) names = ['景洪水泥卸货网点', '北城卸货区', '昆钢装货区'];
    return names;
  }

  function dispatchFenceQuickHtml() {
    var parents = dispatchAreaFenceNames().map(function (name) {
      return '<option value="' + esc(name) + '">' + esc(name) + '</option>';
    }).join('');
    var body = '<p class="detail-section-sub">先记一个常用装卸货点，复杂边界和地图绘制请走电子围栏管理。</p>'
      + '<div class="form-grid">'
      + '<div class="form-item"><label class="form-label" for="wbFenceName">围栏名称</label><input class="form-control-text" id="wbFenceName" placeholder="如：北城 3 号卸料位"></div>'
      + '<div class="form-item"><label class="form-label" for="wbFenceType">区域类型</label><select class="form-control-text" id="wbFenceType" onchange="WB.onFenceQuickType(this.value)"><option value="点" selected>点电子围栏</option><option value="区域">区域电子围栏</option></select></div>'
      + '<div class="form-item"><label class="form-label" for="wbFenceIo">收/发货类型</label><select class="form-control-text" id="wbFenceIo"><option>发货区域</option><option selected>收货区域</option><option>收发货</option></select></div>'
      + '<div class="form-item" id="wbFenceParentItem"><label class="form-label" for="wbFenceParent">所属区域围栏</label><select class="form-control-text" id="wbFenceParent"><option value="">不关联</option>' + parents + '</select></div>'
      + '<div class="form-item"><label class="form-label" for="wbFenceAddr">地址</label><input class="form-control-text" id="wbFenceAddr" placeholder="街道 / 场站位置"></div>'
      + '</div>';
    var footer = '<button class="btn btn-default" type="button" onclick="WB.closeDispatchDrawer()">取消</button>'
      + '<button class="btn btn-primary" type="button" onclick="WB.confirmFenceQuick()">保存</button>';
    return dispatchQuickDrawerHtml('快速新增装卸货点', body, footer);
  }

  function dispatchGlobalHits(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) return { todos: [], vehicles: [], drivers: [], alerts: [] };
    var todos = [];
    dispatchTodoCards().forEach(function (item) {
      if (item.status !== '待处理') return;
      if ([item.taskNo, item.orderNo, item.route, item.driver, item.truck, item.cargoName].join(' ').toLowerCase().indexOf(q) < 0) return;
      todos.push(item);
    });
    var alerts = [];
    dispatchAlertCards().forEach(function (item) {
      if ([item.plate, item.driver, item.taskNo, item.route, item.type].join(' ').toLowerCase().indexOf(q) < 0) return;
      alerts.push(item);
    });
    var vehicles = [];
    var drivers = [];
    var seenDrivers = {};
    dispatchCapacityRows().forEach(function (row) {
      var truckHit = [row.truck, row.trailer, row.task, row.nextTask].join(' ').toLowerCase().indexOf(q) >= 0;
      var driverHit = String(row.driver || '').toLowerCase().indexOf(q) >= 0;
      if (truckHit || driverHit) vehicles.push(row);
      if (driverHit && !seenDrivers[row.driver]) {
        seenDrivers[row.driver] = 1;
        drivers.push(row);
      }
    });
    return { todos: todos.slice(0, 3), vehicles: vehicles.slice(0, 3), drivers: drivers.slice(0, 3), alerts: alerts.slice(0, 3) };
  }

  function dispatchGlobalPanelHtml() {
    var q = (dispatchGlobalQ || '').trim();
    if (!q) return '';
    var hits = dispatchGlobalHits(q);
    var total = hits.todos.length + hits.vehicles.length + hits.drivers.length + hits.alerts.length;
    if (!total) return '<p class="wb-dispatch-global-empty">没有匹配的订单、任务、车辆或司机</p>';
    function group(title, items) {
      return items ? ('<div class="wb-dispatch-global-group"><h4>' + title + '</h4>' + items + '</div>') : '';
    }
    var todos = hits.todos.map(function (item) {
      return '<button type="button" onclick="WB.openGlobalHit(\'todo\',\'' + esc(item.id) + '\')"><span>' + esc(item.type) + '</span><b>' + esc(item.route) + '</b><em>' + esc(item.orderNo || item.taskNo) + '</em></button>';
    }).join('');
    var vehicles = hits.vehicles.map(function (row) {
      return '<button type="button" onclick="WB.openGlobalHit(\'capacity\',\'' + esc(row.truck) + '\')"><span>' + esc(row.status === '空闲' ? '立即可派' : row.status) + '</span><b>' + esc(row.truck) + '</b><em>' + esc(row.driver) + '</em></button>';
    }).join('');
    var drivers = hits.drivers.map(function (row) {
      return '<button type="button" onclick="WB.openGlobalHit(\'driver\',\'' + esc(row.driver) + '\')"><span>司机</span><b>' + esc(row.driver) + '</b><em>' + esc(row.truck) + '</em></button>';
    }).join('');
    var alerts = hits.alerts.map(function (item) {
      return '<button type="button" onclick="WB.openGlobalHit(\'alert\',\'' + esc(item.id) + '\')"><span>' + esc(item.type) + '</span><b>' + esc(item.plate + ' · ' + item.driver) + '</b><em>' + esc(item.route) + '</em></button>';
    }).join('');
    return group('业务待办', todos) + group('车辆', vehicles) + group('司机', drivers) + group('运输告警', alerts);
  }

  function dispatchCoreBar() {
    var pin = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
    return '<section class="wb-dispatch-core" aria-label="快捷操作">'
      + '<span class="wb-dispatch-core-label">快捷操作</span>'
      + '<button class="wb-dispatch-link is-primary" type="button" onclick="WB.jump(\'order-create\')">+ 新建订单</button>'
      + '<button class="wb-dispatch-link" type="button" onclick="WB.openOrderSplit()">拆分运单</button>'
      + '<button class="wb-dispatch-link" type="button" onclick="WB.openDispatchDrawer()">分派任务</button>'
      + '<button class="wb-dispatch-link" type="button" onclick="WB.openScreen()">' + pin + ' 车辆监控</button>'
      + '<button class="wb-dispatch-link" type="button" onclick="WB.openDriverBind()">司机车辆绑定</button>'
      + '<div class="wb-dispatch-more">'
      + '<button class="wb-dispatch-link" id="wbDispatchMoreBtn" type="button" aria-expanded="false" aria-haspopup="true" onclick="WB.toggleDispatchMore(event)">更多 ▾</button>'
      + '<div class="wb-dispatch-more-panel" id="wbDispatchMorePanel" hidden onclick="event.stopPropagation()">'
      + '<button type="button" onclick="WB.openFenceAdd()">新增装卸货点</button>'
      + '<button type="button" onclick="WB.jump(\'fence-list\')">电子围栏管理</button>'
      + '<button type="button" onclick="WB.jump(\'contract-management\')">货物信息</button>'
      + '<button type="button" onclick="WB.jump(\'segment-route-management\')">线路信息</button>'
      + '<button type="button" onclick="WB.openDriverQuick()">司机信息</button>'
      + '<p class="wb-dispatch-more-hint">高风险，进入正式页处理</p>'
      + '<button class="is-risk" type="button" onclick="WB.jump(\'billing-rule-management\')">计费规则</button>'
      + '<button class="is-risk" type="button" onclick="WB.jump(\'billing-rule-management\')">货物单价调整</button>'
      + '</div></div></section>';
  }

  function bindDispatchDesk() {
    if (app.currentPage !== 'workbench-dispatch') return;
    if (!window.__wbDispatchSearchBound) {
      window.__wbDispatchSearchBound = true;
      document.addEventListener('click', function (e) {
        var wrap = document.querySelector('.wb-dispatch-global');
        if (wrap && wrap.contains(e.target)) return;
        var panel = document.getElementById('wbDispatchGlobalPanel');
        if (panel) panel.hidden = true;
      });
    }
    if (!dispatchAlertPulse) return;
    window.setTimeout(function () {
      dispatchAlertPulse = false;
      var btn = document.getElementById('wbDispatchAlertIndicator');
      if (btn) btn.classList.remove('is-new');
    }, 4000);
  }

  function renderDispatchStatusCard(item) {
    var detail = (item.detail || []).map(function (part, i) {
      var on = part[3] ? ' is-on' : '';
      return (i ? '<i aria-hidden="true">·</i>' : '')
        + '<button type="button" class="' + on.trim() + '" onclick="event.stopPropagation();' + part[2] + '">' + esc(part[0]) + '<b>' + esc(part[1]) + '</b></button>';
    }).join('');
    return '<article class="wb-dispatch-status is-' + item.tone + (item.on ? ' is-on' : '') + (item.pulse ? ' is-new' : '') + '"' + (item.indicator ? ' id="' + item.indicator + '"' : '') + '>'
      + '<button class="wb-dispatch-status-main" type="button" onclick="' + item.action + '"><span>' + esc(item.label) + '</span><strong>' + esc(item.value) + '</strong></button>'
      + '<div class="wb-dispatch-status-break">' + detail + '</div></article>';
  }

  function dispatchGreeting() {
    var acc = currentAccount();
    var hour = new Date().getHours();
    var hello = hour < 6 ? '凌晨好' : (hour < 11 ? '上午好' : (hour < 14 ? '中午好' : (hour < 18 ? '下午好' : '晚上好')));
    return hello + '，' + ((acc && acc.title) || '调度员');
  }

  function renderDispatch() {
    if (dispatchTodoTab === 'conflict' || dispatchTodoTab === 'confirm') dispatchTodoTab = dispatchTodoTab === 'confirm' ? 'other' : 'preassign';
    var todoCounts = dispatchTodoTabCounts();
    var visibleTodos = visibleDispatchTodos();
    var visibleAlerts = visibleDispatchAlerts();
    var allAlerts = dispatchAlertCards();
    var openAlertsN = openDispatchAlertCount();
    var alertLevels = dispatchAlertLevelCounts();
    var highNew = allAlerts.filter(function (item) { return item.level === '高' && item.status === '新告警'; }).length;
    var pulse = dispatchAlertPulse && highNew > 0;
    var cap = dispatchCapacityStats();
    var exec = dispatchExecStats();
    var statusCards = [
      {
        label: '待处理业务',
        value: todoCounts.biz,
        tone: 'warning',
        on: dispatchTodoTab === 'split' || dispatchTodoTab === 'dispatch' || dispatchTodoTab === 'preassign',
        action: 'WB.dispatchTodoTab(\'all\')',
        detail: [
          ['待拆', String(todoCounts.split), 'WB.dispatchTodoTab(\'split\')', dispatchTodoTab === 'split'],
          ['待派', String(todoCounts.dispatch), 'WB.dispatchTodoTab(\'dispatch\')', dispatchTodoTab === 'dispatch'],
          ['待转', String(todoCounts.preassign), 'WB.dispatchTodoTab(\'preassign\')', dispatchTodoTab === 'preassign']
        ]
      },
      {
        label: '执行中',
        value: exec.all,
        tone: 'purple',
        action: 'WB.dispatchExecBoard(\'\')',
        detail: [
          ['装', String(exec.load), 'WB.dispatchExecBoard(\'装货\')', false],
          ['运', String(exec.run), 'WB.dispatchExecBoard(\'行驶\')', false],
          ['卸', String(exec.unload), 'WB.dispatchExecBoard(\'卸货\')', false]
        ]
      },
      {
        label: '可用运力',
        value: cap.available,
        tone: 'success',
        on: dispatchCapacityFilter === 'idle' || dispatchCapacityFilter === 'releasing' || dispatchCapacityFilter === 'available',
        action: 'WB.focusDispatchCapacity(\'available\')',
        detail: [
          ['立即可派', String(cap.idle), 'WB.focusDispatchCapacity(\'idle\')', dispatchCapacityFilter === 'idle'],
          ['即将释放', String(cap.releasing), 'WB.focusDispatchCapacity(\'releasing\')', dispatchCapacityFilter === 'releasing']
        ]
      },
      {
        label: '待处理告警',
        value: openAlertsN,
        tone: 'critical',
        on: !!dispatchAlertLevel,
        pulse: pulse,
        indicator: 'wbDispatchAlertIndicator',
        action: 'WB.focusDispatchAlerts(\'\')',
        detail: [
          ['高', String(alertLevels.high), 'WB.focusDispatchAlerts(\'高\')', dispatchAlertLevel === '高'],
          ['其他', String(alertLevels.other), 'WB.focusDispatchAlerts(\'mid\')', dispatchAlertLevel === 'mid']
        ]
      }
    ].map(renderDispatchStatusCard).join('');
    var todoItems = visibleTodos.map(renderDispatchTodoCard).join('');
    var dispatchTabs = [
      ['all', '全部', todoCounts.all],
      ['split', '待拆运单', todoCounts.split],
      ['dispatch', '待派任务', todoCounts.dispatch],
      ['preassign', '待转正式', todoCounts.preassign],
      ['other', '其他待处理', todoCounts.other]
    ].map(function (tab) {
      return '<button class="' + (dispatchTodoTab === tab[0] ? 'active' : '') + '" type="button" aria-pressed="' + (dispatchTodoTab === tab[0]) + '" onclick="WB.dispatchTodoTab(\'' + tab[0] + '\')"><span>' + tab[1] + '</span><b>' + tab[2] + '</b></button>';
    }).join('');
    var alertItems = visibleAlerts.map(renderDispatchAlertCard).join('');
    var alertStatusTabs = [
      ['open', '未处理', openAlertsN],
      ['done', '已处理', allAlerts.filter(function (a) { return a.status === '已处理'; }).length],
      ['ignored', '已忽略', allAlerts.filter(function (a) { return a.status === '已忽略'; }).length]
    ].map(function (tab) {
      return '<button class="tab' + (dispatchAlertStatus === tab[0] ? ' active' : '') + '" type="button" onclick="WB.dispatchAlertStatus(\'' + tab[0] + '\')">' + tab[1] + '<span class="count">' + tab[2] + '</span></button>';
    }).join('');
    var alertTypes = ['全部', '停车预警', '区域停留预警', '车速预警', '卸货后未上传磅单', 'SOC预警', '司机疲劳驾驶'].map(function (name) {
      var id = name === '全部' ? 'all' : name;
      var n = name === '全部' ? openAlertsN : allAlerts.filter(function (a) { return a.type === name && (a.status === '新告警' || a.status === '待处理' || a.status === '处理中'); }).length;
      return '<button class="' + (dispatchAlertType === id ? 'active' : '') + '" type="button" onclick="WB.dispatchAlertType(\'' + esc(id) + '\')">' + name + '<b>' + n + '</b></button>';
    }).join('');
    var rel = visibleDispatchCapacity().map(renderDispatchCapacityRow).join('');
    var capTabs = [
      ['all', '全部', cap.all],
      ['idle', '立即可派', cap.idle],
      ['releasing', '即将释放', cap.releasing],
      ['run', '运输中', cap.run],
      ['load', '装卸中', cap.handling]
    ].map(function (tab) {
      var on = (!dispatchCapacityFilter && tab[0] === 'all') || dispatchCapacityFilter === tab[0];
      return '<button class="' + (on ? 'active' : '') + '" type="button" onclick="WB.focusDispatchCapacity(\'' + tab[0] + '\')">' + tab[1] + '<b>' + tab[2] + '</b></button>';
    }).join('');
    var globalHits = dispatchGlobalPanelHtml();
    window.setTimeout(bindDispatchDesk, 0);
    return '<div class="content-area page-standard wb-page wb-dispatch-v2">'
      + '<header class="page-header wb-dispatch-head"><div class="wb-dispatch-hello">' + esc(dispatchGreeting()) + '</div>'
      + '<div class="wb-dispatch-head-tools"><div class="wb-dispatch-global"><label><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>'
      + '<input id="wbDispatchGlobalQ" value="' + esc(dispatchGlobalQ) + '" placeholder="搜订单 / 任务 / 车辆 / 司机" autocomplete="off" oninput="WB.dispatchGlobalQuery(this.value)" onfocus="WB.dispatchGlobalQuery(this.value)"></label>'
      + '<div class="wb-dispatch-global-panel" id="wbDispatchGlobalPanel"' + (globalHits ? '' : ' hidden') + '>' + globalHits + '</div></div>'
      + '<button class="wb-dispatch-head-monitor" type="button" onclick="WB.openScreen()"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>车辆监控</button>'
      + '<button class="wb-dispatch-screen-link" type="button" onclick="WB.openScreen()">可视化大屏</button></div></header>'
      + '<section class="wb-dispatch-status-grid is-4 is-strip" aria-label="调度态势">' + statusCards + '</section>'
      + dispatchCoreBar()
      + '<div class="wb-dispatch-operation-grid">'
      + '<section class="table-section wb-dispatch-panel wb-dispatch-todo-panel" id="wbDispatchTodos"><div class="table-toolbar"><div class="left"><span class="detail-section-title">业务待办</span><span class="wb-panel-count">' + todoCounts.all + '</span></div><div class="right"><label class="wb-todo-pri">优先级<select onchange="WB.dispatchTodoPri(this.value)"><option value=""' + (dispatchTodoPri === '' ? ' selected' : '') + '>全部</option><option value="高"' + (dispatchTodoPri === '高' ? ' selected' : '') + '>高</option><option value="中"' + (dispatchTodoPri === '中' ? ' selected' : '') + '>中</option></select></label></div></div>'
      + '<div class="wb-dispatch-todo-tabs" role="tablist" aria-label="业务待办类型">' + dispatchTabs + '</div>'
      + '<div class="wb-dispatch-todo-scroll">' + (todoItems || '<div class="empty-state"><b>当前没有未处理的业务待办</b><p>已处理事项仍保留记录，可继续处理其他类型。</p></div>') + '</div></section>'
      + '<section class="table-section wb-dispatch-panel wb-dispatch-exception-panel" id="wbDispatchAlerts"><div class="table-toolbar"><div class="left"><span class="detail-section-title">运输告警</span><span class="wb-panel-count is-danger">' + openAlertsN + '</span></div><div class="right">' + alertStatusTabs + '</div></div>'
      + '<div class="wb-dispatch-alert-types" aria-label="告警类型">' + alertTypes + '</div>'
      + '<div class="wb-dispatch-exception-scroll">' + (alertItems || '<div class="empty-state"><b>当前没有符合条件的运输告警</b><p>同一车辆同一告警类型在持续期间只保留一条有效告警。</p></div>') + '</div></section></div>'
      + '<section class="table-section wb-capacity-panel is-strong" id="wbDispatchCapacity"><div class="table-toolbar"><div class="left"><span class="detail-section-title">当前运力</span>'
      + '<label class="wb-capacity-search"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>'
      + '<input id="wbDispatchCapacityQ" value="' + esc(dispatchCapacityQ) + '" placeholder="司机 / 车牌" oninput="WB.dispatchCapacityQuery(this.value)"></label></div>'
      + '<div class="wb-capacity-tabs">' + capTabs + '</div></div>'
      + '<div class="table-wrap"><table class="data-table wb-capacity-table is-pool"><thead><tr><th>司机 / 车辆</th><th>状态</th><th>SOC</th><th>下一任务</th><th>操作</th></tr></thead><tbody>' + (rel || '<tr><td colspan="5">没有符合筛选的运力</td></tr>') + '</tbody></table></div></section></div>';
  }

  function renderLogin() {
    var cards = ACCOUNTS.map(function (a) {
      var extra = a.screen === 'auto' ? '<em>登录后进入可视化大屏</em>' : (a.screen === 'optional' ? '<em>可打开调度大屏</em>' : '<em>进入岗位工作台</em>');
      return '<button class="wb-login-card' + (a.id === 'dispatch' ? ' is-rec' : '') + '" type="button" onclick="WB.login(\'' + a.id + '\')">'
        + '<span class="wb-login-avatar">' + esc(a.name.slice(0, 1)) + '</span>'
        + '<strong>' + esc(a.name) + '</strong>'
        + '<b>' + esc(a.title) + '</b>'
        + '<span>' + esc(a.desc) + '</span>'
        + extra
        + '</button>';
    }).join('');
    return '<div class="wb-login">'
      + '<div class="wb-login-hero">'
      + '<svg class="wb-login-art" viewBox="0 0 220 160" aria-hidden="true"><rect x="8" y="28" width="204" height="118" rx="24" fill="#EEF2FF"/><rect x="28" y="46" width="88" height="56" rx="12" fill="#fff"/><rect x="124" y="46" width="68" height="26" rx="8" fill="#DBEAFE"/><rect x="124" y="80" width="68" height="22" rx="8" fill="#FEE2E2"/><circle cx="58" cy="74" r="14" fill="#3B82F6"/><path d="M48 118c8-16 36-16 44 0" stroke="#93C5FD" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="164" cy="128" r="18" fill="#FDBA74"/><circle cx="164" cy="122" r="7" fill="#fff"/><path d="M152 142c6-8 20-8 26 0" fill="#F97316"/></svg>'
      + '<div class="wb-login-brand">合一星运</div>'
      + '<h1>选择岗位进入 TMS</h1>'
      + '<p>演示环境按角色进入。调度员登录后先看到可视化大屏；其他岗位直接进入工作台。工作台本身不改为大屏。</p>'
      + '</div>'
      + '<div class="wb-login-grid">' + cards + '</div></div>';
  }

  function renderStat() {
    var m = metrics();
    var body = openTodos('stat').map(function (t) {
      return '<tr><td>' + esc(t.type) + '</td><td class="col-mono">' + esc(t.bizNo) + '</td><td>' + esc(t.extra || t.title) + '</td><td>' + statusBadge(t.status) + '</td>'
        + '<td class="row-actions">' + linkBtn('立即处理', 'WB.handle(\'' + t.id + '\')') + '</td></tr>';
    }).join('');
    return '<div class="content-area page-standard wb-page">'
      + breadcrumb('统计工作台')
      + pageHead('统计工作台', '今天还有哪些任务数据不完整、不可信', '')
      + '<div class="kpi-row wb-kpi-6">'
      + kpiCard('待审核磅单', m.weigh, '', '司机已上传', 'k1', 'list', 'WB.openTodos(\'stat\',\'待审核磅单\')')
      + kpiCard('时间缺失任务', m.timeMissing, '', '必填时间为空', 'k2', 'alert', 'WB.openTodos(\'stat\',\'时间节点缺失\')')
      + kpiCard('时间异常任务', m.timeAbnormal, '', '顺序或超生命周期', 'k5', 'alert', 'WB.openAlerts(\'stat\',\'\',\'时间顺序异常\')')
      + kpiCard('重量异常任务', m.weightAbnormal, '', '毛皮 / 装卸差', 'k6', 'alert', 'WB.openAlerts(\'stat\',\'\',\'毛皮净重异常,装卸重量差异常\')')
      + kpiCard('待修正任务', m.fixTodo, '', '需人工改数', 'k4', 'check', 'WB.openTodos(\'stat\',\'数据修正\')')
      + kpiCard('数据完整率', m.completeness, '', '完整任务 ÷ 应校验任务', 'k3', 'chart', '', true)
      + '</div>'
      + splitTodoAlert('stat', '我的待办', '数据告警')
      + panelTable('异常任务列表', '', ['类型', '业务单号', '说明', '状态', '操作'], body || '', '当前没有异常任务')
      + '<section class="table-section"><div class="table-toolbar"><div class="left"><span class="detail-section-title">快捷入口</span></div></div><div style="padding:16px;"><div class="wb-shortcuts">'
      + shortcutNav('磅单审核', '磅单信息明细', 'weigh-point-audit')
      + shortcut('数据修正', '时间 / 驾驶员', 'workbench-todo')
      + shortcut('异常任务', '数据告警', 'workbench-alert')
      + shortcutNav('已完成任务', '任务单已完成', 'task-order-management')
      + '</div></div></section></div>';
  }

  function renderFleet() {
    var m = metrics();
    var rel = store.board.releasing.map(function (r) {
      return '<tr><td>' + esc(r.driver) + '</td><td class="col-mono">' + esc(r.truck) + '</td><td>' + esc(r.node) + '</td><td class="col-time">' + esc(r.eta) + '</td><td>' + esc(r.soc) + '</td><td>' + esc(r.preassign) + '</td></tr>';
    }).join('');
    var cert = openTodos('fleet').map(function (t) {
      return '<tr><td>' + esc(t.bizType) + '</td><td class="col-mono">' + esc(t.bizNo) + '</td><td>' + esc(t.title) + '</td><td>' + priBadge(t.priority) + '</td>'
        + '<td class="row-actions">' + linkBtn('立即处理', 'WB.handle(\'' + t.id + '\')') + '</td></tr>';
    }).join('');
    return '<div class="content-area page-standard wb-page">'
      + breadcrumb('运力工作台')
      + pageHead('运力工作台', '当前有多少人、车、挂车可用，哪些资源存在问题', '')
      + '<div class="kpi-row wb-kpi-5">'
      + kpiCard('可用司机', m.drivers, '', '证件有效且无正式冲突', 'k1', 'user', 'WB.board(\'drivers\')')
      + kpiCard('可用主车', m.vehicles, '', 'SOC 仅提示不禁派', 'k3', 'truck', 'WB.board(\'vehicles\')')
      + kpiCard('可用挂车', m.trailers, '', '非维修非停用', 'k7', 'truck', 'WB.board(\'trailers\')')
      + kpiCard('执行中', m.executing, '', '正式占用', 'k4', 'chart', 'WB.board(\'executing\')')
      + kpiCard('异常运力', m.fleetTodo, '', '证件 / 冲突 / 维修', 'k2', 'alert', 'WB.openTodos(\'fleet\')')
      + '</div>'
      + splitTodoAlert('fleet', '运力待办', '运力告警')
      + panelTable('即将释放运力', '', ['司机', '牵引车', '当前节点', '预计完成时间', 'SOC', '是否已有预派'], rel)
      + panelTable('长期未运营 / 证照 / 车辆异常', '', ['对象类型', '对象', '事项', '优先级', '操作'], cert)
      + '<section class="table-section"><div class="table-toolbar"><div class="left"><span class="detail-section-title">快捷入口</span></div></div><div style="padding:16px;"><div class="wb-shortcuts">'
      + shortcut('司机管理', '可用与证件', 'workbench-fleet')
      + shortcut('牵引车管理', '在线与维修', 'workbench-fleet')
      + shortcut('挂车管理', '绑定关系', 'workbench-fleet')
      + shortcut('运力状态', '即将释放', 'workbench-fleet')
      + '</div></div></section></div>';
  }

  function renderSafety() {
    var m = metrics();
    var riskV = [
      { plate: '云A·D8021', score: 92, reason: '超速 + 执行离线史' },
      { plate: '云A·F4470', score: 88, reason: '执行中离线 71 分钟' },
      { plate: '云A·G2288', score: 76, reason: '证件过期仍在执行' },
      { plate: '云A·E1936', score: 64, reason: '近 7 日超速 2 次' }
    ];
    var riskD = [
      { name: '李宏俊', score: 90, reason: '超速事件未关闭' },
      { name: '马旺', score: 81, reason: '长时间离线未复核' },
      { name: '张建华', score: 70, reason: '证件过期仍出车' }
    ];
    function rankRows(list, nameKey) {
      return list.map(function (r) {
        return '<tr><td class="col-mono">' + esc(r[nameKey]) + '</td><td><div class="wb-rank"><b>' + r.score + '</b><span class="wb-rank-bar"><i style="width:' + r.score + '%"></i></span></div></td><td>' + esc(r.reason) + '</td></tr>';
      }).join('');
    }
    return '<div class="content-area page-standard wb-page">'
      + breadcrumb('安全工作台')
      + pageHead('安全工作台', '当前有哪些高风险车辆、司机和安全事件需要处理', '')
      + '<div class="kpi-row wb-kpi-5">'
      + kpiCard('今日告警', openAlerts('safety').length, '', '超速 / 离线 / SOC', 'k1', 'alert', 'WB.openAlerts(\'safety\')')
      + kpiCard('严重告警', openAlerts('safety').filter(function (a) { return a.level === '严重'; }).length, '', '需立即处置', 'k6', 'bolt', 'WB.openAlerts(\'safety\',\'严重\')')
      + kpiCard('风险车辆', riskV.length, '', '按风险分排序', 'k2', 'truck', '', true)
      + kpiCard('风险司机', riskD.length, '', '按风险分排序', 'k5', 'user', '', true)
      + kpiCard('未关闭事件', m.safetyOpen, '', '待处理 / 处理中', 'k4', 'list', 'WB.openTodos(\'safety\')')
      + '</div>'
      + splitTodoAlert('safety', '安全待办', '实时高风险告警')
      + '<div class="wb-split">'
      + panelTable('风险车辆排行', '', ['车辆', '风险分', '原因'], rankRows(riskV, 'plate'))
      + panelTable('风险司机排行', '', ['司机', '风险分', '原因'], rankRows(riskD, 'name'))
      + '</div>'
      + '<section class="table-section"><div class="table-toolbar"><div class="left"><span class="detail-section-title">快捷入口</span></div></div><div style="padding:16px;"><div class="wb-shortcuts">'
      + shortcut('告警中心', '安全告警', 'workbench-alert')
      + shortcut('风险车辆', '本页排行', 'workbench-safety')
      + shortcut('风险司机', '本页排行', 'workbench-safety')
      + shortcut('安全事件', '待办闭环', 'workbench-todo')
      + '</div></div></section></div>';
  }

  function renderOps() {
    var m = metrics();
    var routes = [
      { name: '宁洱天恒 → 景洪水泥', tasks: 11, abnormal: 3, rate: '28%', wait: '96 分钟' },
      { name: '大开门 → 尖峰水泥厂', tasks: 9, abnormal: 1, rate: '11%', wait: '54 分钟' },
      { name: '尖峰水泥场 → 景洪网点', tasks: 8, abnormal: 1, rate: '13%', wait: '61 分钟' },
      { name: '大勐龙 → 杨武铁精粉', tasks: 6, abnormal: 0, rate: '0%', wait: '38 分钟' }
    ];
    var routeBody = routes.map(function (r) {
      return '<tr><td>' + esc(r.name) + '</td><td class="col-num">' + r.tasks + '</td><td class="col-num">' + r.abnormal + '</td><td>' + (Number(r.rate) >= 20 ? badge(r.rate, 'badge-error') : r.rate) + '</td><td>' + esc(r.wait) + '</td></tr>';
    }).join('');
    return '<div class="content-area page-standard wb-page">'
      + breadcrumb('运营工作台')
      + pageHead('运营工作台', '今天整体运输业务跑得怎么样，问题集中在哪', '')
      + '<div class="kpi-row wb-kpi-5">'
      + kpiCard('今日运量', '612', 't', '今日完成任务累计', 'k1', 'chart', 'WB.board(\'finished\')')
      + kpiCard('完成任务', m.finishedToday, '', '实际完成时间在今日', 'k3', 'check', 'WB.board(\'finished\')')
      + kpiCard('车辆运营率', '76%', '', '有效运输车辆 ÷ 应运营车辆', 'k4', 'truck', '', true)
      + kpiCard('平均时效', '4.2', 'h', '装货+行驶+卸货+充电', 'k7', 'chart', '', true)
      + kpiCard('异常任务率', '11%', '', '同一任务多异常只计 1', 'k2', 'alert', 'WB.openAlerts(\'ops\')')
      + '</div>'
      + splitTodoAlert('ops', '运营待办', '经营告警')
      + panelTable('线路运营表现', '', ['分段线路', '今日完成', '异常任务', '异常率', '平均装货等待'], routeBody)
      + '<div class="kpi-row" style="margin-top:0;">'
      + kpiCard('平均装货时效', '78', '分钟', '装货离开 − 装货到达', 'k5', 'chart', '', true)
      + kpiCard('平均行驶时效', '2.6', 'h', '含途中充电', 'k1', 'truck', '', true)
      + kpiCard('平均卸货时效', '41', '分钟', '卸货离开 − 卸货到达', 'k3', 'check', '', true)
      + kpiCard('平均充电时效', '48', '分钟', '任务周期内累计', 'k4', 'bolt', '', true)
      + '</div>'
      + '<section class="table-section"><div class="table-toolbar"><div class="left"><span class="detail-section-title">快捷入口</span></div></div><div style="padding:16px;"><div class="wb-shortcuts">'
      + shortcut('运营分析', '本页指标', 'workbench-ops')
      + shortcut('时效分析', '四大时效', 'workbench-ops')
      + shortcut('线路分析', '异常线路', 'workbench-ops')
      + shortcutNav('趟次统计', '报表中心', 'circle-report')
      + '</div></div></section></div>';
  }

  function renderManager() {
    var m = metrics();
    var focus = [
      { title: '宁洱—景洪线异常率 28%', level: '重要', owner: '运营' },
      { title: '云A·F4470 执行中离线超过 60 分钟', level: '严重', owner: '安全' },
      { title: '尖峰水泥厂装货点 4 车同时等待', level: '重要', owner: '运营 / 调度' }
    ].map(function (r) {
      return '<tr><td>' + esc(r.title) + '</td><td>' + levelBadge(r.level) + '</td><td>' + esc(r.owner) + '</td></tr>';
    }).join('');
    return '<div class="content-area page-standard wb-page">'
      + breadcrumb('管理工作台')
      + pageHead('经营驾驶舱', '只看重大运营、安全与需要决策的事项', '')
      + '<div class="kpi-row wb-kpi-5">'
      + kpiCard('今日运量', '612', 't', '完成任务 18', 'k1', 'chart', 'WB.board(\'finished\')')
      + kpiCard('任务完成率', '22%', '', '今日完成 / 今日应执行', 'k3', 'check', '', true)
      + kpiCard('车辆运营率', '76%', '', '较近 7 日 -6 个百分点', 'k4', 'truck', '', true)
      + kpiCard('异常任务率', '11%', '', '不展示普通待派 / 磅单', 'k2', 'alert', 'WB.openAlerts(\'manager\',\'严重\')')
      + kpiCard('重大安全风险', m.severe, '', '一级事件与严重告警', 'k6', 'bolt', 'WB.openAlerts(\'manager\',\'严重\')')
      + '</div>'
      + panelTable('重大事项', '<button class="toolbar-btn" type="button" onclick="WB.openTodos(\'manager\')">查看待办</button>', ['事项', '等级', '责任角色'], focus)
      + '<div class="wb-split">'
      + panelTable('经营趋势（今日）', '', ['指标', '今日', '近 7 日均'], '<tr><td>运量</td><td>612 t</td><td>580 t</td></tr><tr><td>运营率</td><td>76%</td><td>82%</td></tr><tr><td>异常率</td><td>11%</td><td>7%</td></tr>')
      + panelTable('重大告警', '', ['等级', '告警标题', '对象', '持续', '操作'], alertRows(openAlerts('manager').filter(function (a) { return a.level === '严重' || a.category === '经营'; }), 6), '暂无重大告警')
      + '</div>'
      + panelTable('需要关注的问题', '', ['事项', '等级', '责任角色'], focus)
      + '<section class="table-section"><div class="table-toolbar"><div class="left"><span class="detail-section-title">快捷入口</span></div></div><div style="padding:16px;"><div class="wb-shortcuts">'
      + shortcut('经营驾驶舱', '本页', 'workbench-manager')
      + shortcut('重大事项', '管理层待办', 'workbench-todo')
      + shortcut('线路分析', '运营工作台', 'workbench-ops')
      + shortcut('车队分析', '运力工作台', 'workbench-fleet')
      + '</div></div></section></div>';
  }

  function paginate(list) {
    var total = list.length;
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (listState.page > pages) listState.page = pages;
    if (listState.page < 1) listState.page = 1;
    var start = (listState.page - 1) * PAGE_SIZE;
    return { total: total, pages: pages, rows: list.slice(start, start + PAGE_SIZE), from: total ? start + 1 : 0, to: Math.min(start + PAGE_SIZE, total) };
  }
  function pager(pg) {
    var btns = '';
    var i;
    btns += '<button class="page-btn" type="button" ' + (listState.page <= 1 ? 'disabled' : 'onclick="WB.page(' + (listState.page - 1) + ')"') + '>上一页</button>';
    for (i = 1; i <= pg.pages && i <= 8; i++) {
      btns += '<button class="page-btn' + (i === listState.page ? ' active' : '') + '" type="button" onclick="WB.page(' + i + ')">' + i + '</button>';
    }
    btns += '<button class="page-btn" type="button" ' + (listState.page >= pg.pages ? 'disabled' : 'onclick="WB.page(' + (listState.page + 1) + ')"') + '>下一页</button>';
    return '<div class="pagination"><div class="pagination-info">共 ' + pg.total + ' 条，当前第 ' + pg.from + '–' + pg.to + ' 条</div><div class="pagination-controls">' + btns + '</div></div>';
  }

  function filteredTodos() {
    return store.todos.filter(function (t) {
      if (listState.role && listState.role !== 'all' && t.role !== listState.role && !(listState.role === 'manager' && t.type === '重大运营异常跟进')) return false;
      if (listState.type) {
        var types = String(listState.type).split(',');
        if (types.indexOf(t.type) < 0) return false;
      }
      if (listState.status === '未完成') {
        if (t.status === '已完成' || t.status === '已取消') return false;
      } else if (listState.status && t.status !== listState.status) return false;
      if (listState.keyword) {
        var q = listState.keyword;
        if ((t.title + t.bizNo + t.id).indexOf(q) < 0) return false;
      }
      return true;
    });
  }
  function filteredAlerts() {
    return store.alerts.filter(function (a) {
      if (listState.role && listState.role !== 'all' && !alertVisibleTo(listState.role, a)) return false;
      if (listState.level && a.level !== listState.level) return false;
      if (listState.category) {
        var cats = String(listState.category).split(',');
        if (cats.indexOf(a.type) < 0 && cats.indexOf(a.category) < 0) return false;
      }
      if (listState.status === '未恢复' && (a.status === '已关闭' || a.status === '已恢复')) return false;
      if (listState.status && listState.status !== '未恢复' && a.status !== listState.status) return false;
      if (listState.keyword && (a.title + a.objectNo + a.id).indexOf(listState.keyword) < 0) return false;
      return true;
    });
  }

  function optionHtml(values, selected) {
    return values.map(function (v) {
      var val = v === '全部' ? '' : v;
      return '<option value="' + esc(val) + '"' + (selected === val ? ' selected' : '') + '>' + esc(v) + '</option>';
    }).join('');
  }

  function renderTodoCenter() {
    if (!listState.status || ['未恢复', '已恢复', '已关闭'].indexOf(listState.status) >= 0) listState.status = '未完成';
    var list = filteredTodos();
    var pg = paginate(list);
    var body = pg.rows.map(function (t, idx) {
      return '<tr><td class="col-seq">' + (pg.from + idx) + '</td><td class="col-mono">' + esc(t.id) + '</td><td>' + esc(t.type) + '</td>'
        + '<td><button class="btn btn-text" type="button" onclick="WB.detail(\'todo\',\'' + t.id + '\')">' + esc(t.title) + '</button></td>'
        + '<td>' + esc(t.bizType) + '</td><td class="col-mono">' + esc(t.bizNo) + '</td><td>' + priBadge(t.priority) + '</td>'
        + '<td>' + esc(roleName(t.role)) + '</td><td>' + statusBadge(t.status) + '</td><td class="col-time">' + esc(t.createdAt) + '</td>'
        + '<td class="row-actions sticky-col-r">' + linkBtn('立即处理', 'WB.handle(\'' + t.id + '\')')
        + (t.status === '处理中' ? linkBtn('确认关闭', 'WB.closeTodo(\'' + t.id + '\')') : '') + '</td></tr>';
    }).join('');
    if (!pg.rows.length) {
      body = '<tr><td colspan="11"><div class="empty-state"><b>没有符合条件的待办</b><span>调整筛选条件后再查，或清空筛选查看全部待办。</span><button class="btn btn-default" type="button" onclick="WB.resetList()">清空筛选</button></div></td></tr>';
    }
    return '<div class="content-area page-standard wb-page">'
      + breadcrumb('待办中心')
      + pageHead('待办中心', '明确需要某个岗位执行真实业务操作的事项', '')
      + '<div class="filter-panel"><div class="filter-row">'
      + '<div class="filter-item"><label class="filter-label">待办类型</label><select class="filter-control" id="wbTodoType">' + optionHtml(['全部', '待派单', '预派待转正式', '未知卸货地待确认', '待审核磅单', '时间节点缺失', '数据修正', '运力异常处理', '安全事件处理', '重大运营异常跟进'], listState.type) + '</select></div>'
      + '<div class="filter-item"><label class="filter-label">责任角色</label><select class="filter-control" id="wbTodoRole">' + optionHtml(['全部', '调度', '统计', '运力', '安全', '运营', '管理'], listState.role === 'dispatch' ? '调度' : listState.role === 'stat' ? '统计' : listState.role === 'fleet' ? '运力' : listState.role === 'safety' ? '安全' : listState.role === 'ops' ? '运营' : listState.role === 'manager' ? '管理' : '') + '</select></div>'
      + '<div class="filter-item"><label class="filter-label">当前状态</label><select class="filter-control" id="wbTodoStatus">' + optionHtml(['全部', '未完成', '待处理', '处理中', '已完成'], listState.status) + '</select></div>'
      + '<div class="filter-item"><label class="filter-label">关键字</label><input class="filter-control" id="wbTodoKw" placeholder="待办编号 / 标题 / 业务单号" value="' + esc(listState.keyword) + '"></div>'
      + '</div><div class="filter-actions"><button class="btn btn-default" type="button" onclick="WB.resetList()">重置</button><button class="btn btn-primary" type="button" onclick="WB.applyList()">查询</button></div></div>'
      + '<section class="table-section"><div class="table-toolbar"><div class="left">'
      + '<button class="tab' + (listState.status === '未完成' ? ' active' : '') + '" type="button" onclick="WB.todoTab(\'未完成\')">未完成<span class="count">' + store.todos.filter(function (t) { return t.status !== '已完成' && t.status !== '已取消'; }).length + '</span></button>'
      + '<button class="tab' + (listState.status === '待处理' ? ' active' : '') + '" type="button" onclick="WB.todoTab(\'待处理\')">待处理<span class="count">' + countBy(store.todos, 'status', '待处理') + '</span></button>'
      + '<button class="tab' + (listState.status === '处理中' ? ' active' : '') + '" type="button" onclick="WB.todoTab(\'处理中\')">处理中<span class="count">' + countBy(store.todos, 'status', '处理中') + '</span></button>'
      + '<button class="tab' + (listState.status === '已完成' ? ' active' : '') + '" type="button" onclick="WB.todoTab(\'已完成\')">已完成<span class="count">' + countBy(store.todos, 'status', '已完成') + '</span></button>'
      + '</div></div><div class="table-wrap"><table class="data-table" style="min-width:1280px;"><thead><tr>'
      + '<th>序号</th><th>待办编号</th><th>待办类型</th><th>待办标题</th><th>业务类型</th><th>业务单号</th><th>优先级</th><th>责任角色</th><th>当前状态</th><th>创建时间</th><th class="sticky-col-r">操作</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>' + pager(pg) + '</section></div>';
  }

  function renderAlertCenter() {
    if (!listState.status || ['未完成', '待处理', '处理中', '已完成'].indexOf(listState.status) >= 0) listState.status = '未恢复';
    var list = filteredAlerts();
    var pg = paginate(list);
    var body = pg.rows.map(function (a, idx) {
      return '<tr><td class="col-seq">' + (pg.from + idx) + '</td><td>' + levelBadge(a.level) + '</td><td>' + esc(a.category) + '</td>'
        + '<td><button class="btn btn-text" type="button" onclick="WB.detail(\'alert\',\'' + a.id + '\')">' + esc(a.title) + '</button></td>'
        + '<td>' + esc(a.objectType) + '</td><td class="col-mono">' + esc(a.objectNo) + '</td><td>' + esc(roleName(a.role)) + '</td>'
        + '<td>' + statusBadge(a.status) + '</td><td>' + esc(a.duration || '—') + '</td><td class="col-time">' + esc(a.detectedAt) + '</td>'
        + '<td class="row-actions sticky-col-r">' + linkBtn('去处理', 'WB.handleAlert(\'' + a.id + '\')')
        + (a.status !== '已关闭' && a.status !== '已恢复' ? linkBtn('确认无异常', 'WB.ackAlert(\'' + a.id + '\')') : '') + '</td></tr>';
    }).join('');
    if (!pg.rows.length) {
      body = '<tr><td colspan="11"><div class="empty-state"><b>没有符合条件的告警</b><span>调整筛选条件后再查，或清空筛选查看全部告警。</span><button class="btn btn-default" type="button" onclick="WB.resetList()">清空筛选</button></div></td></tr>';
    }
    return '<div class="content-area page-standard wb-page">'
      + breadcrumb('告警中心')
      + pageHead('告警中心', '系统识别出的业务异常或潜在风险，不等于待办', '')
      + '<div class="filter-panel"><div class="filter-row">'
      + '<div class="filter-item"><label class="filter-label">告警类型</label><select class="filter-control" id="wbAlertType">' + optionHtml(['全部', '派单后未发车', '装货等待超时', '卸货等待超时', '任务执行超时', '四时间节点缺失', '时间顺序异常', '毛皮净重异常', '装卸重量差异常', '执行车辆离线', 'SOC偏低', '证件到期', '超速', '线路异常', '装卸点拥堵'], listState.category) + '</select></div>'
      + '<div class="filter-item"><label class="filter-label">告警等级</label><select class="filter-control" id="wbAlertLevel">' + optionHtml(['全部', '严重', '重要', '提醒'], listState.level) + '</select></div>'
      + '<div class="filter-item"><label class="filter-label">责任角色</label><select class="filter-control" id="wbAlertRole">' + optionHtml(['全部', '调度', '统计', '运力', '安全', '运营', '管理'], listState.role === 'dispatch' ? '调度' : listState.role === 'stat' ? '统计' : listState.role === 'fleet' ? '运力' : listState.role === 'safety' ? '安全' : listState.role === 'ops' ? '运营' : listState.role === 'manager' ? '管理' : '') + '</select></div>'
      + '<div class="filter-item"><label class="filter-label">关键字</label><input class="filter-control" id="wbAlertKw" placeholder="标题 / 对象 / 编号" value="' + esc(listState.keyword) + '"></div>'
      + '</div><div class="filter-actions"><button class="btn btn-default" type="button" onclick="WB.resetList()">重置</button><button class="btn btn-primary" type="button" onclick="WB.applyList()">查询</button></div></div>'
      + '<section class="table-section"><div class="table-toolbar"><div class="left">'
      + '<button class="tab' + (listState.status === '未恢复' ? ' active' : '') + '" type="button" onclick="WB.alertTab(\'未恢复\')">未恢复<span class="count">' + store.alerts.filter(function (a) { return a.status !== '已关闭' && a.status !== '已恢复'; }).length + '</span></button>'
      + '<button class="tab' + (listState.level === '严重' && listState.status === '未恢复' ? ' active' : '') + '" type="button" onclick="WB.openAlerts(\'' + (listState.role || 'all') + '\',\'严重\')">严重<span class="count">' + countBy(openAlerts('all'), 'level', '严重') + '</span></button>'
      + '<button class="tab' + (listState.status === '已恢复' ? ' active' : '') + '" type="button" onclick="WB.alertTab(\'已恢复\')">已恢复</button>'
      + '<button class="tab' + (listState.status === '已关闭' ? ' active' : '') + '" type="button" onclick="WB.alertTab(\'已关闭\')">已关闭</button>'
      + '</div></div><div class="table-wrap"><table class="data-table" style="min-width:1280px;"><thead><tr>'
      + '<th>序号</th><th>等级</th><th>分类</th><th>告警标题</th><th>对象类型</th><th>对象</th><th>责任角色</th><th>状态</th><th>持续时长</th><th>检测时间</th><th class="sticky-col-r">操作</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>' + pager(pg) + '</section></div>';
  }

  function renderMessageCenter() {
    var list = store.messages.filter(function (m) {
      if (listState.read === 'unread' && m.read) return false;
      if (listState.keyword && (m.title + m.content).indexOf(listState.keyword) < 0) return false;
      return true;
    });
    var pg = paginate(list);
    var body = pg.rows.map(function (m) {
      return '<tr><td>' + (m.read ? badge('已读', 'badge-gray') : badge('未读', 'badge-primary')) + '</td>'
        + '<td><button class="btn btn-text" type="button" onclick="WB.readMsg(\'' + m.id + '\')">' + esc(m.title) + '</button></td>'
        + '<td>' + esc(m.content) + '</td><td class="col-mono">' + esc(m.bizNo || '—') + '</td><td class="col-time">' + esc(m.time) + '</td></tr>';
    }).join('');
    if (!pg.rows.length) body = '<tr><td colspan="5"><div class="empty-state"><b>暂无消息</b></div></td></tr>';
    return '<div class="content-area page-standard wb-page">'
      + breadcrumb('消息中心')
      + pageHead('消息中心', '告诉用户发生了什么，不一定要求处理', '')
      + '<section class="table-section"><div class="table-toolbar"><div class="left">'
      + '<button class="tab' + (listState.read !== 'unread' ? ' active' : '') + '" type="button" onclick="WB.msgTab(\'\')">全部<span class="count">' + store.messages.length + '</span></button>'
      + '<button class="tab' + (listState.read === 'unread' ? ' active' : '') + '" type="button" onclick="WB.msgTab(\'unread\')">未读<span class="count">' + store.messages.filter(function (m) { return !m.read; }).length + '</span></button>'
      + '</div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>状态</th><th>标题</th><th>内容</th><th>关联对象</th><th>时间</th></tr></thead><tbody>'
      + body + '</tbody></table></div>' + pager(pg) + '</section></div>';
  }

  function renderBoard() {
    var kind = boardState.kind;
    var rows = [];
    var heads = [];
    if (kind === 'executing') {
      heads = ['任务单号', '车牌', '司机', '分段线路', '当前节点', '任务状态', '预计完成', 'SOC'];
      rows = store.board.executing.filter(function (r) {
        if (boardState.live && r.status !== '运输中') return false;
        return !boardState.node || boardState.node.split(',').indexOf(r.node) >= 0;
      }).map(function (r) {
        var nodeLabel = boardState.live
          ? (r.node === '行驶' ? '运输中' : (r.node === '装货' ? '装货中' : (r.node === '卸货' ? '卸货中' : r.node)))
          : r.node;
        return '<tr><td class="col-mono">' + esc(r.no) + '</td><td class="col-mono">' + esc(r.plate) + '</td><td>' + esc(r.driver) + '</td><td>' + esc(r.route) + '</td><td>' + esc(nodeLabel) + '</td><td>' + badge(r.status, 'badge-primary') + '</td><td class="col-time">' + esc(r.eta) + '</td><td>' + esc(r.soc) + '</td></tr>';
      });
    } else if (kind === 'finished') {
      heads = ['任务单号', '车牌', '司机', '分段线路', '完成时间', '运量(t)'];
      rows = store.board.finished.map(function (r) {
        return '<tr><td class="col-mono">' + esc(r.no) + '</td><td class="col-mono">' + esc(r.plate) + '</td><td>' + esc(r.driver) + '</td><td>' + esc(r.route) + '</td><td class="col-time">' + esc(r.finishAt) + '</td><td class="col-num">' + r.ton + '</td></tr>';
      });
    } else if (kind === 'preassign') {
      heads = ['待办类型', '标题', '业务单号', '优先级', '状态', '操作'];
      rows = store.todos.filter(function (t) {
        return t.type === '预派待转正式' && t.status !== '已完成' && t.status !== '已取消';
      }).map(function (t) {
        return '<tr><td>' + esc(t.type) + '</td><td>' + esc(t.title) + '</td><td class="col-mono">' + esc(t.bizNo) + '</td><td>' + priBadge(t.priority) + '</td><td>' + statusBadge(t.status) + '</td><td class="row-actions">' + linkBtn('立即处理', 'WB.handle(\'' + t.id + '\')') + '</td></tr>';
      });
    } else if (kind === 'drivers') {
      heads = ['司机', '电话', '状态', '证件'];
      rows = store.board.drivers.map(function (r) {
        return '<tr><td>' + esc(r.name) + '</td><td class="col-mono">' + esc(r.phone) + '</td><td>' + badge(r.status, 'badge-success') + '</td><td>' + (r.cert === '有效' ? badge(r.cert, 'badge-success') : badge(r.cert, 'badge-warning')) + '</td></tr>';
      });
    } else if (kind === 'vehicles') {
      heads = ['牵引车', '挂车', '状态', 'SOC', '维修'];
      rows = store.board.vehicles.map(function (r) {
        return '<tr><td class="col-mono">' + esc(r.plate) + '</td><td class="col-mono">' + esc(r.trailer) + '</td><td>' + badge(r.status, 'badge-success') + '</td><td>' + esc(r.soc) + '</td><td>' + esc(r.maintain) + '</td></tr>';
      });
    } else if (kind === 'releasing') {
      heads = ['牵引车', '司机', '当前任务', '当前节点', '预计释放时间', 'SOC', '预派状态', '推荐下一任务'];
      rows = store.board.releasing.map(function (r) {
        return '<tr><td class="col-mono">' + esc(r.truck) + '</td><td>' + esc(r.driver) + '</td><td class="col-mono">' + esc(r.task) + '</td><td>' + badge(r.node, r.node === '行驶' ? 'badge-primary' : 'badge-warning') + '</td><td class="col-time">' + esc(r.eta) + '</td><td>' + socCell(r.soc) + '</td><td>' + (r.preassign === '是' ? badge('已预派', 'badge-primary') : badge('未预派', 'badge-gray')) + '</td><td>' + (r.next && r.next !== '—' ? esc(r.next) : '待推荐') + '</td></tr>';
      });
    } else {
      heads = ['挂车', '状态', '当前绑定牵引车'];
      rows = store.board.trailers.map(function (r) {
        return '<tr><td class="col-mono">' + esc(r.no) + '</td><td>' + badge(r.status, 'badge-success') + '</td><td class="col-mono">' + esc(r.bind) + '</td></tr>';
      });
    }
    var pg = paginate(rows);
    var body = pg.rows.join('') || '<tr><td colspan="' + heads.length + '"><div class="empty-state"><b>暂无数据</b></div></td></tr>';
    return '<div class="content-area page-standard wb-page">'
      + breadcrumb('工作台', boardState.title)
      + '<div class="page-header"><div><div class="page-title">' + esc(boardState.title) + '</div><p class="detail-section-sub">共 ' + rows.length + ' 条，与工作台指标一致。</p></div>'
      + '<div class="page-actions"><button class="btn btn-default" type="button" onclick="WB.go(\'' + boardState.from + '\')">返回</button></div></div>'
      + '<section class="table-section"><div class="table-wrap"><table class="data-table"><thead><tr>'
      + heads.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' + body + '</tbody></table></div>' + pager(pg) + '</section></div>';
  }

  function roleSelectValue(label) {
    var map = { '调度': 'dispatch', '统计': 'stat', '运力': 'fleet', '安全': 'safety', '运营': 'ops', '管理': 'manager' };
    return map[label] || '';
  }

  function findTodo(id) { return store.todos.filter(function (t) { return t.id === id; })[0]; }
  function findAlert(id) { return store.alerts.filter(function (a) { return a.id === id; })[0]; }

  function openModal(html) {
    var host = document.getElementById('wbModalHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'wbModalHost';
      document.body.appendChild(host);
    }
    host.innerHTML = '<div class="modal-overlay show" id="wbOverlay"><div class="modal wb-modal" role="dialog" aria-modal="true">' + html + '</div></div>';
    host.querySelector('#wbOverlay').addEventListener('click', function (e) {
      if (e.target.id === 'wbOverlay') WB.closeModal();
    });
  }

  function detailHtml(kind, row) {
    if (kind === 'todo') {
      return '<div class="modal-header"><div class="modal-title">待办详情</div><button class="modal-close" type="button" onclick="WB.closeModal()" aria-label="关闭">×</button></div>'
        + '<div class="modal-body"><div class="form-grid">'
        + field('待办编号', row.id) + field('待办类型', row.type)
        + field('待办标题', row.title) + field('业务类型', row.bizType)
        + field('业务单号', row.bizNo) + field('优先级', row.priority)
        + field('责任角色', roleName(row.role)) + field('责任人', row.owner)
        + field('所属组织', row.org) + field('当前状态', row.status)
        + field('来源', row.source) + field('创建时间', row.createdAt)
        + '<div class="form-item full"><span class="form-label">说明</span><div class="form-value">' + esc(row.extra || '—') + '</div></div>'
        + '</div></div><div class="modal-footer"><button class="btn btn-default" type="button" onclick="WB.closeModal()">关闭</button>'
        + '<button class="btn btn-primary" type="button" onclick="WB.handle(\'' + row.id + '\')">立即处理</button></div>';
    }
    return '<div class="modal-header"><div class="modal-title">告警详情</div><button class="modal-close" type="button" onclick="WB.closeModal()" aria-label="关闭">×</button></div>'
      + '<div class="modal-body"><div class="form-grid">'
      + field('告警编号', row.id) + field('分类', row.category)
      + field('告警类型', row.type) + field('等级', row.level)
      + field('对象类型', row.objectType) + field('对象', row.objectNo)
      + field('责任角色', roleName(row.role)) + field('状态', row.status)
      + field('持续时长', row.duration || '—') + field('检测时间', row.detectedAt)
      + '<div class="form-item full"><span class="form-label">说明</span><div class="form-value">' + esc(row.title) + (row.extra ? '；' + esc(row.extra) : '') + '</div></div>'
      + '</div></div><div class="modal-footer"><button class="btn btn-default" type="button" onclick="WB.closeModal()">关闭</button>'
      + '<button class="btn btn-default" type="button" onclick="WB.ackAlert(\'' + row.id + '\')">确认无异常</button>'
      + '<button class="btn btn-primary" type="button" onclick="WB.handleAlert(\'' + row.id + '\')">去处理</button></div>';
  }
  function field(label, value) {
    return '<div class="form-item"><span class="form-label">' + esc(label) + '</span><div class="form-value">' + esc(value) + '</div></div>';
  }

  function processModal(id, title, hint) {
    openModal('<div class="modal-header"><div class="modal-title">' + esc(title) + '</div><button class="modal-close" type="button" onclick="WB.closeModal()" aria-label="关闭">×</button></div>'
      + '<div class="modal-body"><p class="detail-section-sub">' + esc(hint) + '</p>'
      + '<div class="form-item full" style="margin-top:12px;"><label class="form-label" for="wbReason">处理说明</label>'
      + '<textarea class="form-control-text" id="wbReason" style="height:88px;padding:8px 10px;" placeholder="填写处理结果或确认原因"></textarea></div></div>'
      + '<div class="modal-footer"><button class="btn btn-default" type="button" onclick="WB.closeModal()">取消</button>'
      + '<button class="btn btn-primary" type="button" onclick="WB.submitProcess(\'' + id + '\')">提交并关闭待办</button></div>');
  }

  function ackModal(id) {
    openModal('<div class="modal-header"><div class="modal-title">确认无异常</div><button class="modal-close" type="button" onclick="WB.closeModal()" aria-label="关闭">×</button></div>'
      + '<div class="modal-body"><p class="detail-section-sub">人工确认无异常必须填写原因，不会把“点击关闭”当成异常消失。</p>'
      + '<div class="form-item full" style="margin-top:12px;"><label class="form-label" for="wbReason">原因</label>'
      + '<textarea class="form-control-text" id="wbReason" style="height:88px;padding:8px 10px;" placeholder="例如：现场核实为地磅排队，任务仍在正常执行"></textarea></div></div>'
      + '<div class="modal-footer"><button class="btn btn-default" type="button" onclick="WB.closeModal()">取消</button>'
      + '<button class="btn btn-primary" type="button" onclick="WB.submitAck(\'' + id + '\')">确认</button></div>');
  }

  function afterChange(stay) {
    store.updatedAt = nowStr();
    saveState();
    WB.closeModal();
    if (!stay) app.render();
  }

  function bindListFilters() {
    var page = app.currentPage;
    if (page === 'workbench-todo') {
      var type = document.getElementById('wbTodoType');
      var role = document.getElementById('wbTodoRole');
      var status = document.getElementById('wbTodoStatus');
      var kw = document.getElementById('wbTodoKw');
      if (type) type.value = listState.type;
      if (role) role.value = listState.role === 'dispatch' ? '调度' : listState.role === 'stat' ? '统计' : listState.role === 'fleet' ? '运力' : listState.role === 'safety' ? '安全' : listState.role === 'ops' ? '运营' : listState.role === 'manager' ? '管理' : '';
      if (status) status.value = listState.status;
      if (kw) kw.value = listState.keyword;
    }
    if (page === 'workbench-alert') {
      var at = document.getElementById('wbAlertType');
      var lv = document.getElementById('wbAlertLevel');
      var ar = document.getElementById('wbAlertRole');
      var ak = document.getElementById('wbAlertKw');
      if (at) at.value = listState.category;
      if (lv) lv.value = listState.level;
      if (ar) ar.value = listState.role === 'dispatch' ? '调度' : listState.role === 'stat' ? '统计' : listState.role === 'fleet' ? '运力' : listState.role === 'safety' ? '安全' : listState.role === 'ops' ? '运营' : listState.role === 'manager' ? '管理' : '';
      if (ak) ak.value = listState.keyword;
    }
  }

  function enhanceNav() {
    if (app.__wbNavPatched) return;
    app.__wbNavPatched = true;
    var original = app.updateNav;
    app.updateNav = function () {
      original.call(app);
      var page = app.currentPage || '';
      var group = document.querySelector('[data-group="workbench"]');
      var map = {
        'workbench-board': highlightPage || 'workbench-home'
      };
      var active = map[page] || page;
      if (page.indexOf('workbench-') === 0) {
        document.querySelectorAll('.nav-item').forEach(function (el) {
          el.classList.toggle('active', el.getAttribute('data-page') === active);
        });
        if (group) {
          group.classList.add('open', 'has-active');
        }
      }
    };
    var origRender = app.render;
    app.render = function () {
      if (!getAuth() && app.currentPage !== 'login') app.currentPage = 'login';
      if (app.currentPage === 'dispatch-screen' && !canSeeScreen()) {
        var acc = currentAccount();
        app.currentPage = acc ? acc.home : 'login';
      }
      setChrome();
      origRender.call(app);
      paintTopbarUser();
    };
  }

  function closeUserMenu() {
    var el = document.getElementById('wbUserMenu');
    if (el) el.remove();
  }
  function closeVmOrgMenu() {
    vmState.orgOpen = false;
    var panel = document.getElementById('vmOrgPanel');
    var trigger = document.querySelector('.vm-org-trigger');
    if (panel) panel.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }
  function closeVmVehicleRuntimeMenu() {
    vmState.vehicleRuntimeOpen = false;
    var filter = document.querySelector('.vm-runtime-filter');
    var panel = document.querySelector('.vm-runtime-panel');
    var trigger = document.querySelector('.vm-runtime-trigger');
    if (filter) filter.classList.remove('is-open');
    if (panel) panel.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }
  function paintVmOrgSelector() {
    var current = vmOrgCurrent();
    var name = document.getElementById('vmOrgName');
    var path = document.getElementById('vmOrgPath');
    var footer = document.getElementById('vmOrgFooter');
    if (name) name.textContent = current.short;
    if (path) path.textContent = current.path;
    if (footer) footer.textContent = current.path;
    document.querySelectorAll('[data-org-id]').forEach(function (node) {
      var on = node.getAttribute('data-org-id') === current.id;
      node.classList.toggle('is-on', on);
      node.setAttribute('aria-selected', String(on));
    });
    closeVmOrgMenu();
  }

  window.WB = {
    go: function (page) {
      if (page === 'workbench-todo' && !listState.status) listState.status = '未完成';
      app.navigate(page);
    },
    login: function (id) {
      var acc = accountById(id);
      if (!acc) return;
      setAuth(acc);
      toast('已进入「' + acc.title + '」');
      var landing = roleLanding(acc);
      if (landing === 'dispatch-screen') vmResetDefaultMapState();
      app.navigate(landing);
    },
    logout: function () {
      closeUserMenu();
      clearAuth();
      destroyDispatchMap();
      app.navigate('login');
    },
    openScreen: function () {
      closeDispatchMore();
      closeUserMenu();
      if (!canSeeScreen()) {
        toast('当前角色不开放调度可视化大屏');
        return;
      }
      dcTab = 'monitor';
      vmResetDefaultMapState();
      try { sessionStorage.removeItem('wbDcTabV2'); } catch (e) {}
      app.navigate('dispatch-screen');
    },
    enterWorkbench: function () {
      // 暂不回调度工作台：大屏出口直接进后台业务系统（订单列表）。
      closeUserMenu();
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
      destroyDispatchMap();
      app.navigate('order-list');
    },
    toggleUserMenu: function (e) {
      if (e) e.stopPropagation();
      var existing = document.getElementById('wbUserMenu');
      if (existing) { existing.remove(); return; }
      var acc = currentAccount();
      if (!acc) return;
      var menu = document.createElement('div');
      menu.id = 'wbUserMenu';
      menu.className = 'wb-user-menu';
      var html = '<div class="wb-user-meta"><b>' + esc(acc.name) + '</b><span>' + esc(acc.title) + '</span></div>';
      if (canSeeScreen() && app.currentPage !== 'dispatch-screen') html += '<button type="button" onclick="WB.openScreen()">调度可视化大屏</button>';
      if (app.currentPage === 'dispatch-screen') html += '<button type="button" onclick="WB.enterWorkbench()">进入系统</button>';
      html += '<button type="button" onclick="WB.logout()">退出登录</button>';
      menu.innerHTML = html;
      document.body.appendChild(menu);
      var anchor = (e && e.currentTarget) || document.querySelector('.dc-user') || document.querySelector('.topbar-user');
      if (anchor) {
        var rect = anchor.getBoundingClientRect();
        menu.style.top = (rect.bottom + 8) + 'px';
        menu.style.right = Math.max(12, window.innerWidth - rect.right) + 'px';
      }
      setTimeout(function () {
        document.addEventListener('click', closeUserMenu, { once: true });
      }, 0);
    },
    jump: function (page) {
      closeDispatchMore();
      if (app.pages[page]) app.navigate(page);
      else toast('目标页面暂未接入');
    },
    openOrderSplit: function () {
      closeDispatchMore();
      app.navigate('order-list');
      window.setTimeout(function () {
        if (typeof window.setOrderListFilter === 'function') window.setOrderListFilter('pending');
      }, 0);
    },
    openFenceAdd: function () {
      showDispatchDrawer(dispatchFenceQuickHtml());
    },
    openDriverBind: function () {
      showDispatchDrawer(dispatchBindHtml());
    },
    openDriverQuick: function () {
      showDispatchDrawer(dispatchDriverQuickHtml(''));
    },
    fillDriverQuick: function (name) {
      var rec = dispatchDriverRecords().filter(function (row) { return row.name === name; })[0];
      if (!rec) return;
      var phone = document.getElementById('wbDriverPhone');
      var status = document.getElementById('wbDriverStatus');
      var cert = document.getElementById('wbDriverCert');
      if (phone) phone.value = rec.phone || '';
      if (status) status.value = rec.status || '可用';
      if (cert) cert.value = rec.cert || '有效';
    },
    onFenceQuickType: function (value) {
      var item = document.getElementById('wbFenceParentItem');
      if (item) item.hidden = value !== '点';
    },
    confirmDriverBind: function () {
      var driver = ((document.getElementById('wbBindDriver') || {}).value || '').trim();
      var truck = ((document.getElementById('wbBindTruck') || {}).value || '').trim();
      var trailer = ((document.getElementById('wbBindTrailer') || {}).value || '').trim();
      if (!driver || !truck) {
        toast('请选择司机和牵引车');
        return;
      }
      WB.closeDispatchDrawer();
      toast('已绑定 ' + driver + ' · ' + truck + (trailer ? ' / ' + trailer : ''));
    },
    confirmDriverQuick: function () {
      var name = ((document.getElementById('wbDriverName') || {}).value || '').trim();
      var phone = ((document.getElementById('wbDriverPhone') || {}).value || '').trim();
      var status = ((document.getElementById('wbDriverStatus') || {}).value || '可用').trim();
      var cert = ((document.getElementById('wbDriverCert') || {}).value || '有效').trim();
      if (!name) {
        toast('请选择司机');
        return;
      }
      if (!phone) {
        toast('请填写电话');
        return;
      }
      ensureDispatchDesk().driverPatch[name] = { phone: phone, status: status, cert: cert };
      saveState();
      WB.closeDispatchDrawer();
      toast('已更新 ' + name + ' 的司机信息');
    },
    confirmFenceQuick: function () {
      var name = ((document.getElementById('wbFenceName') || {}).value || '').trim();
      var type = ((document.getElementById('wbFenceType') || {}).value || '点').trim();
      var io = ((document.getElementById('wbFenceIo') || {}).value || '收货区域').trim();
      var addr = ((document.getElementById('wbFenceAddr') || {}).value || '').trim();
      if (!name) {
        toast('请填写围栏名称');
        return;
      }
      WB.closeDispatchDrawer();
      toast('已保存装卸货点「' + name + '」· ' + type + ' · ' + io + (addr ? ' · ' + addr : ''));
    },
    toggleDispatchMore: function (e) {
      if (e) e.stopPropagation();
      var panel = document.getElementById('wbDispatchMorePanel');
      var btn = document.getElementById('wbDispatchMoreBtn');
      if (!panel || !btn) return;
      var open = panel.hidden;
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        window.setTimeout(function () {
          document.addEventListener('click', closeDispatchMore, { once: true });
        }, 0);
      }
    },
    jumpTaskTab: function (tab) {
      if (typeof window.toOpenStatusTab === 'function') {
        window.toOpenStatusTab(tab);
        return;
      }
      app.navigate('task-order-management');
    },
    dispatchNow: function (id) {
      if (typeof window.toDispatch !== 'function') {
        WB.jumpTaskTab('dispatch');
        return;
      }
      var row = pendingTasks().filter(function (r) { return r.id === id; })[0];
      if (row) {
        store.todos.forEach(function (t) {
          if (t.type === '待派单' && t.bizNo === row.code && t.status !== '已完成' && t.status !== '已取消') {
            addLog(t.id, '待办关闭', t.status, '已完成', '工作台派车成功');
            t.status = '已完成';
            t.finishedAt = nowStr();
          }
        });
        store.updatedAt = nowStr();
        saveState();
      }
      window.toDispatch(id);
    },
    applyMapFilter: function () {
      mapFilter.q = ((document.getElementById('wbMapQ') || {}).value || '').trim();
      mapFilter.vehicle = (document.getElementById('wbMapVehicle') || {}).value || 'all';
      mapFilter.status = (document.getElementById('wbMapStatus') || {}).value || 'all';
      mapFilter.route = (document.getElementById('wbMapRoute') || {}).value || 'all';
      if (dispatchMap && window.AMap) {
        refreshDispatchMarkers(window.AMap);
        var siteName = Object.keys(DC_SITES).filter(function (name) { return mapFilter.q && name.indexOf(mapFilter.q) >= 0; })[0];
        if (siteName) dispatchMap.setZoomAndCenter(12, DC_SITES[siteName]);
      } else renderDispatchFallback(document.getElementById('wbDispatchMap'));
    },
    dcTab: function (id) {
      dcTab = 'monitor';
      mapFilter.fullscreen = false;
      raState.netFull = false;
      raState.sortOpen = false;
      axState.layerOpen = false;
      try { sessionStorage.removeItem('wbDcTabV2'); } catch (e) {}
      app.render();
    },
    raTab: function (id) { raState.tab = id || 'all'; app.render(); },
    raSearch: function () {
      raState.q = ((document.getElementById('raListQ') || {}).value || '');
      paintRaList();
    },
    raSelect: function (name) { raState.selected = name || ''; raState.sortOpen = false; app.render(); },
    raTrend: function (id) { raState.trend = id || 'ton'; app.render(); },
    raRank: function (id) { raState.rank = id || 'rate'; app.render(); },
    raCompose: function (id) { raState.compose = id || 'load'; app.render(); },
    raDay: function () { raState.day = (document.getElementById('raDay') || {}).value || '7d'; app.render(); },
    raGoods: function () { raState.goods = (document.getElementById('raGoods') || {}).value || 'all'; app.render(); },
    raMetric: function () { raState.metric = (document.getElementById('raMetric') || {}).value || 'ton'; app.render(); },
    raToggleSort: function () { raState.sortOpen = !raState.sortOpen; app.render(); },
    raSort: function (id) { raState.sort = id || 'ton'; raState.sortOpen = false; app.render(); },
    raFull: function () { raState.netFull = !raState.netFull; app.render(); },
    raCreate: function () { toast('新建线路将进入分段线路管理'); },
    axTab: function (id) { axState.tab = id || 'all'; app.render(); },
    axSearch: function () {
      axState.q = ((document.getElementById('axQ') || {}).value || '');
      paintAxList();
    },
    axSort: function () { axState.sort = (document.getElementById('axSort') || {}).value || 'new'; app.render(); },
    axSelect: function (id) {
      axState.selected = id || 'ax1';
      axState.detail = 'event';
      selectedPlate = axEvent().plate;
      app.render();
      var ev = axEvent();
      var p = axPos(ev);
      if (dispatchMap && window.AMap) dispatchMap.setZoomAndCenter(12, [p.lng, p.lat]);
    },
    axDetail: function (id) { axState.detail = id || 'event'; app.render(); },
    axMapType: function () { axState.mapType = (document.getElementById('axMapType') || {}).value || 'all'; app.render(); },
    axTrend: function (id) { axState.trend = id || 'hour'; app.render(); },
    axToggleLayer: function () { axState.layerOpen = !axState.layerOpen; app.render(); },
    axLayer: function (key) {
      axState.layers[key] = !axState.layers[key];
      if (dispatchMap && window.AMap) refreshDispatchMarkers(window.AMap);
      else app.render();
    },
    axFocus: function () {
      var ev = axEvent();
      var p = axPos(ev);
      if (dispatchMap && window.AMap) dispatchMap.setZoomAndCenter(13, [p.lng, p.lat]);
    },
    axDone: function () { toast('已标记为已处理'); },
    axRemind: function () { toast('已向司机下发提醒'); },
    axMore: function () { toast('更多处置将下钻到异常任务'); },
    vmScope: function () {
      vmDismissWarningWorkspace();
      vmState.project = (document.getElementById('vmProject') || {}).value || 'yx';
      vmState.fleet = (document.getElementById('vmFleet') || {}).value || 'all';
      vmState.page = 1;
      vmClearTaskSelection();
      paintVmScreen();
      vmRestoreOverviewMap();
    },
    vmToggleOrg: function (e) {
      if (e) e.stopPropagation();
      var panel = document.getElementById('vmOrgPanel');
      var trigger = document.querySelector('.vm-org-trigger');
      if (!panel || !trigger) return;
      vmState.orgOpen = panel.hidden;
      panel.hidden = !vmState.orgOpen;
      trigger.setAttribute('aria-expanded', String(vmState.orgOpen));
      if (vmState.orgOpen) {
        window.setTimeout(function () {
          document.addEventListener('click', closeVmOrgMenu, { once: true });
        }, 0);
      }
    },
    vmSelectOrg: function (id) {
      var node = VM_ORG_TREE.filter(function (item) { return item.id === id; })[0];
      if (!node) return;
      vmState.org = node.id;
      vmState.project = node.project;
      vmState.fleet = node.fleet;
      vmState.orgOpen = false;
      vmState.page = 1;
      vmDismissWarningWorkspace();
      vmClearTaskSelection();
      paintVmOrgSelector();
      paintVmScreen();
      vmRestoreOverviewMap();
      toast('已切换至「' + node.short + '」');
    },
    vmRefreshData: function (button) {
      if (!button || button.disabled) return;
      closeVmOrgMenu();
      button.disabled = true;
      button.classList.add('is-loading');
      button.setAttribute('aria-busy', 'true');
      button.setAttribute('aria-label', '正在刷新数据');
      button.setAttribute('title', '数据刷新中');
      var label = button.querySelector('span');
      if (label) label.textContent = '刷新中';
      window.setTimeout(function () {
        VM_CACHE = null;
        VM_TASK_CACHE = null;
        paintVmScreen();
        button.disabled = false;
        button.classList.remove('is-loading');
        button.removeAttribute('aria-busy');
        button.setAttribute('aria-label', '刷新数据');
        button.setAttribute('title', '刷新数据');
        if (label) label.textContent = '刷新';
        var now = new Date();
        toast('数据已刷新 · ' + pad(now.getHours(), 2) + ':' + pad(now.getMinutes(), 2));
      }, 520);
    },
    vmPageFullscreen: function () {
      closeVmOrgMenu();
      if (!window.__vmFullscreenBound) {
        window.__vmFullscreenBound = true;
        document.addEventListener('fullscreenchange', paintVmPageFullscreen);
      }
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(function () { toast('暂时无法退出全屏，请按 Esc'); });
        }
        return;
      }
      var root = document.documentElement;
      if (!root.requestFullscreen) {
        toast('当前浏览器暂不支持页面全屏');
        return;
      }
      root.requestFullscreen().then(paintVmPageFullscreen).catch(function () {
        toast('浏览器未允许全屏，请再次点击');
      });
    },
    vmToggleOverview: function () {
      vmState.overviewCollapsed = !vmState.overviewCollapsed;
      paintVmRightPanel();
      if (vmState.overviewCollapsed) {
        var rail = document.querySelector('.vm-overview-rail');
        if (rail) rail.focus();
      } else {
        window.setTimeout(function () {
          var toggle = document.querySelector('.vm-daily-toggle');
          if (toggle) toggle.focus();
        }, 0);
      }
      if (!selectedTaskId && !selectedPlate) vmMapNeedsOverviewFit = true;
      window.setTimeout(function () {
        if (dispatchMap && window.AMap) refreshDispatchMarkers(window.AMap);
      }, 180);
    },
    vmToggleOps: function (forceOpen, kpi) {
      var open = forceOpen === true ? true : (forceOpen === false ? false : !vmIsHomeRight());
      vmState.layerOpen = false;
      if (open) {
        selectedPlate = '';
        selectedTaskId = '';
        vmState.selectedSite = '';
        vmDismissWarningWorkspace();
        vmState.opsOpen = true;
        vmState.kpi = kpi || 'operating';
      } else {
        vmState.opsOpen = false;
        if (['operating', 'operatingRate', 'emptyRate'].indexOf(vmState.kpi) >= 0) {
          vmState.kpi = vmState.taskStatus === 'all' ? 'all' : vmState.taskStatus;
        }
      }
      paintVmRightPanel();
      paintVmKpis();
      if (dispatchMap && window.AMap) refreshDispatchMarkers(window.AMap);
    },
    vmSiteClose: function () {
      vmState.selectedSite = '';
      paintVmRightPanel();
      if (dispatchMap && window.AMap) refreshDispatchMarkers(window.AMap);
    },
    vmOpenSiteVehicle: function (index) {
      var site = vmSiteData(vmState.selectedSite);
      var row = site.plates[index] || '';
      var plate = row.split(' · ')[0];
      if (!plate) return;
      var exists = monitorVehicles().some(function (vehicle) { return vehicle.plate === plate; });
      if (exists) WB.locatePlate(plate);
      else toast('已定位 ' + plate + '，演示车辆详情待接入');
    },
    vmOpenSiteSummary: function () {
      vmState.opsOpen = false;
      vmState.layers.load = true;
      vmState.layers.fence = true;
      vmState.selectedSite = '昆钢';
      paintVmRightPanel();
      paintVmLayerControl();
      if (dispatchMap && window.AMap) {
        dispatchMap.setZoomAndCenter(12, DC_SITES['昆钢']);
        refreshDispatchMarkers(window.AMap);
      }
    },
    vmTaskFilter: function (status, kpi, fromKpi) {
      vmDismissWarningWorkspace();
      vmState.opsOpen = false;
      vmState.layerOpen = false;
      vmState.selectedWarning = '';
      vmState.taskStatus = status || 'transporting';
      vmState.kpi = kpi || (status === 'all' ? 'all' : status);
      if (fromKpi) {
        vmState.q = '';
      }
      vmState.page = 1;
      vmClearTaskSelection();
      vmApplyTaskStatusMap(vmState.taskStatus);
      vmRestoreOverviewMap();
      paintVmScreen();
    },
    vmVehicleFilter: function (status) {
      vmDismissWarningWorkspace();
      vmState.opsOpen = false;
      vmState.layerOpen = false;
      vmState.vehicleRuntimeOpen = false;
      vmState.selectedWarning = '';
      vmState.vehicleStatus = status || 'all';
      vmState.page = 1;
      vmClearTaskSelection();
      vmState.layers.executing = ['all', 'has_task', 'pending_transport'].indexOf(vmState.vehicleStatus) >= 0;
      vmState.layers.waiting = vmState.vehicleStatus === 'pending_transport';
      vmState.layers.idle = ['all', 'no_task'].indexOf(vmState.vehicleStatus) >= 0;
      vmState.layers.offline = ['all', 'stopped'].indexOf(vmState.vehicleStatus) >= 0;
      vmState.layers.station = false;
      vmRestoreOverviewMap();
      paintVmScreen();
    },
    vmToggleVehicleRuntime: function (e) {
      if (e) e.stopPropagation();
      var filter = document.querySelector('.vm-runtime-filter');
      var panel = document.querySelector('.vm-runtime-panel');
      var trigger = document.querySelector('.vm-runtime-trigger');
      if (!filter || !panel || !trigger) return;
      vmState.vehicleRuntimeOpen = panel.hidden;
      panel.hidden = !vmState.vehicleRuntimeOpen;
      filter.classList.toggle('is-open', vmState.vehicleRuntimeOpen);
      trigger.setAttribute('aria-expanded', String(vmState.vehicleRuntimeOpen));
      if (vmState.vehicleRuntimeOpen) {
        window.setTimeout(function () {
          document.addEventListener('click', closeVmVehicleRuntimeMenu, { once: true });
        }, 0);
      }
    },
    vmVehicleRuntimeFilter: function (status) {
      var allowed = ['driving', 'parked', 'charging', 'offline'];
      var next = (vmState.vehicleRuntimeStatuses || []).slice();
      if (status === 'all') next = [];
      else if (allowed.indexOf(status) >= 0) {
        var index = next.indexOf(status);
        if (index >= 0) next.splice(index, 1);
        else next.push(status);
        if (next.length === allowed.length) next = [];
      }
      vmDismissWarningWorkspace();
      vmState.opsOpen = false;
      vmState.layerOpen = false;
      vmState.vehicleRuntimeStatuses = next;
      vmState.vehicleRuntimeOpen = true;
      vmState.selectedWarning = '';
      vmState.page = 1;
      vmClearTaskSelection();
      vmRestoreOverviewMap();
      paintVmScreen();
    },
    vmTaskRoute: function (route) {
      vmDismissWarningWorkspace();
      vmState.layerOpen = false;
      vmState.vehicleRuntimeOpen = false;
      vmState.taskRoute = route || 'all';
      vmState.page = 1;
      vmClearTaskSelection();
      vmRestoreOverviewMap();
      paintVmScreen();
    },
    vmTaskHover: function (id, active) {
      if (selectedTaskId) {
        vmHoveredPlate = '';
        return;
      }
      var task = active ? vmTasks().filter(function (item) { return item.id === id; })[0] : null;
      var nextPlate = task && task.assigned ? task.plate : '';
      if (vmHoveredPlate === nextPlate) return;
      vmHoveredPlate = nextPlate;
      if (dispatchMap && window.AMap) refreshDispatchMarkers(window.AMap);
    },
    vmVehicleHover: function (plate, active) {
      if (selectedPlate) {
        vmHoveredPlate = '';
        return;
      }
      var nextPlate = active ? plate : '';
      if (vmHoveredPlate === nextPlate) return;
      vmHoveredPlate = nextPlate;
      if (dispatchMap && window.AMap) refreshDispatchMarkers(window.AMap);
    },
    vmVehicleSelect: function (plate) {
      WB.locatePlate(plate);
    },
    vmToggleLeftPanel: function () {
      var list = document.getElementById('vmList');
      if (!vmState.leftCollapsed && list) vmState.leftScroll = list.scrollTop || 0;
      vmState.leftCollapsed = !vmState.leftCollapsed;
      var left = document.getElementById('vmLeftPanel');
      var root = document.querySelector('.dc-root.is-vm');
      if (left) {
        left.classList.toggle('is-collapsed', vmState.leftCollapsed);
        left.innerHTML = vmLeftPanelHtml();
      }
      if (root) root.classList.toggle('is-left-collapsed', vmState.leftCollapsed);
      if (!vmState.leftCollapsed) {
        window.setTimeout(function () {
          var restoredList = document.getElementById('vmList');
          if (restoredList) restoredList.scrollTop = vmState.leftScroll || 0;
          var collapseButton = document.querySelector('.vm-left-collapse');
          if (collapseButton) collapseButton.focus();
        }, 0);
      } else {
        var rail = document.querySelector('.vm-left-rail');
        if (rail) rail.focus();
      }
      if (!selectedTaskId && !selectedPlate) vmMapNeedsOverviewFit = true;
      window.setTimeout(function () {
        if (dispatchMap && window.AMap) refreshDispatchMarkers(window.AMap);
      }, 180);
    },
    vmTaskSelect: function (id) {
      var task = vmTasks().filter(function (x) { return x.id === id; })[0];
      if (!task) return;
      vmRememberOverviewCamera();
      vmDismissWarningWorkspace();
      vmState.opsOpen = false;
      vmHoveredPlate = '';
      selectedTaskId = task.id;
      selectedPlate = task.plate;
      vmState.layerOpen = false;
      var canShowRoute = vmTaskHasRouteContext(task);
      vmState.layers.load = canShowRoute;
      vmState.layers.fence = false;
      vmState.selectedSite = '';
      if (task.monitorStatus === 'executing') vmState.layers.executing = true;
      if (task.assigned && task.monitorStatus === 'waiting') vmState.layers.waiting = true;
      vmState.layers.station = task.assigned && task.businessStatus !== 'completed' && task.vehicleStatus === 'charge';
      vmState.detail = 'task';
      paintVmPanels();
      paintVmLayerControl();
      if (dispatchMap && window.AMap) {
        refreshDispatchMarkers(window.AMap);
        if (task.assigned) vmFocusTaskMap(task, window.AMap);
      } else renderDispatchFallback(document.getElementById('wbDispatchMap'));
    },
    vmPage: function (n) {
      vmDismissWarningWorkspace();
      vmState.page = n || 1;
      paintVmPanels();
    },
    vmSearch: function (v) {
      vmDismissWarningWorkspace();
      vmState.opsOpen = false;
      vmState.q = (v || '').trim();
      vmState.page = 1;
      vmClearTaskSelection();
      paintVmPanels();
      paintVmLayerControl();
      vmRestoreOverviewMap();
      if (dispatchMap && window.AMap) refreshDispatchMarkers(window.AMap);
    },
    vmClearSearch: function () {
      var input = document.getElementById('vmSearch');
      if (input) input.value = '';
      var wrapper = input && input.parentElement;
      if (wrapper) wrapper.classList.remove('has-value');
      var clear = wrapper && wrapper.querySelector('.vm-search-clear');
      if (clear) clear.disabled = true;
      WB.vmSearch('');
      window.setTimeout(function () {
        var current = document.getElementById('vmSearch');
        if (current) current.focus();
      }, 0);
    },
    vmClose: function () {
      var focusValue = selectedPlate;
      var focusAttr = 'data-vm-plate';
      vmClearTaskSelection();
      vmRestoreOverviewMap(true);
      paintVmRightPanel();
      paintVmTrackMode();
      paintVmLayerControl();
      var list = document.getElementById('vmList');
      if (list) list.innerHTML = vmListCardsHtml();
      window.setTimeout(function () {
        var rows = document.querySelectorAll('#vmList [' + focusAttr + ']');
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].getAttribute(focusAttr) === focusValue) { rows[i].focus(); break; }
        }
      }, 0);
      if (dispatchMap && window.AMap) refreshDispatchMarkers(window.AMap);
      else renderDispatchFallback(document.getElementById('wbDispatchMap'));
    },
    vmDetail: function (id) {
      vmState.detail = id || 'live';
      paintVmPanels();
    },
    vmToggleWarnings: function (forceOpen) {
      if (forceOpen === true || !vmState.warningOpen) {
        vmState.opsOpen = false;
        vmRememberWarningOrigin();
        vmState.warningOpen = true;
        vmState.selectedWarning = '';
        vmState.warningDetailTab = 'overview';
        vmState.warningPlate = '';
        vmState.warningQ = '';
        vmState.warningScope = 'active';
        vmState.warningTab = 'all';
      } else {
        vmRestoreWarningOrigin();
      }
      vmState.warningPulse = false;
      paintVmRightPanel();
    },
    vmOpenWarningFromTicker: function (id) {
      vmRememberWarningOrigin();
      WB.vmWarningSelect(id);
    },
    vmWarningTickerHover: function (paused) {
      vmState.warningTickerHover = !!paused;
    },
    vmOpenPlateWarnings: function (plate) {
      vmRememberWarningOrigin();
      vmState.warningOpen = true;
      vmState.selectedWarning = '';
      vmState.warningDetailTab = 'overview';
      vmState.warningPlate = plate || '';
      vmState.warningQ = '';
      vmState.warningScope = 'active';
      vmState.warningTab = 'all';
      vmState.warningScroll = 0;
      paintVmRightPanel();
    },
    vmClearWarningPlate: function () {
      vmState.warningPlate = '';
      vmState.warningScroll = 0;
      paintVmRightPanel();
    },
    vmWarningSearch: function (value) {
      vmState.warningQ = value || '';
      vmState.warningScroll = 0;
      var list = document.getElementById('vmWarningList');
      if (list) list.innerHTML = vmAlertHtml();
      var result = document.getElementById('vmWarningResult');
      if (result) result.textContent = '当前 ' + vmWarningRows().length + ' 条';
    },
    vmWarningTab: function (tab) {
      vmState.warningTab = tab || 'all';
      vmState.warningOpen = true;
      vmState.selectedWarning = '';
      vmState.warningScroll = 0;
      paintVmRightPanel();
    },
    vmWarningScope: function (scope) {
      vmState.warningScope = scope === 'recovered' ? 'recovered' : 'active';
      vmState.warningOpen = true;
      vmState.selectedWarning = '';
      vmState.warningScroll = 0;
      paintVmRightPanel();
    },
    vmWarningDetailTab: function (tab) {
      vmState.warningDetailTab = ['overview', 'task', 'vehicle'].indexOf(tab) >= 0 ? tab : 'overview';
      paintVmRightPanel();
    },
    vmWarningBack: function () {
      vmState.selectedWarning = '';
      paintVmRightPanel();
      window.setTimeout(function () {
        var list = document.getElementById('vmWarningList');
        if (list) list.scrollTop = vmState.warningScroll || 0;
      }, 0);
    },
    vmWarningClose: function () {
      vmRestoreWarningOrigin();
      paintVmScreen();
    },
    vmWarningSelect: function (id) {
      var warning = vmWarningById(id);
      if (!warning) return;
      if (!vmState.warningOpen) vmRememberWarningOrigin();
      var warningList = document.getElementById('vmWarningList');
      if (warningList) vmState.warningScroll = warningList.scrollTop;
      vmState.warningOpen = true;
      vmState.warningPulse = false;
      vmState.selectedWarning = warning.id;
      vmState.warningDetailTab = 'overview';
      vmState.layerOpen = false;
      vmState.layers.executing = true;
      if (warning.site) {
        vmState.selectedSite = warning.site;
        vmState.layers.load = true;
        if (warning.type.indexOf('充电站') >= 0) vmState.layers.station = true;
      } else vmState.selectedSite = '';
      var task = vmWarningTask(warning);
      vmState.detail = 'task';
      if (task) {
        selectedTaskId = task.id;
        selectedPlate = task.plate;
        vmState.q = '';
        vmState.taskStatus = task.businessStatus || 'all';
        vmState.vehicleStatus = 'all';
        vmState.vehicleRuntimeStatuses = [];
        vmState.vehicleRuntimeOpen = false;
        vmState.taskRoute = task.route || 'all';
        vmState.kpi = '';
        var warningVehicleIndex = vmVehicleFiltered().findIndex(function (vehicle) { return vehicle.plate === task.plate; });
        vmState.page = warningVehicleIndex >= 0 ? Math.floor(warningVehicleIndex / VM_PAGE) + 1 : 1;
      } else {
        selectedTaskId = '';
        vmState.page = 1;
        selectedPlate = warning.plate;
      }
      paintVmScreen();
      window.setTimeout(function () {
        var list = document.getElementById('vmList');
        var selectedRow = list && task && list.querySelector('[data-vm-plate="' + task.plate + '"]');
        if (list && selectedRow) {
          list.scrollTop = Math.max(0, selectedRow.offsetTop - list.offsetTop - (list.clientHeight - selectedRow.offsetHeight) / 2);
        }
        var vehicle = vmSelected();
        if (dispatchMap && window.AMap && vehicle) {
          dispatchMap.setZoomAndCenter(12, [vehicle.lng, vehicle.lat]);
          refreshDispatchMarkers(window.AMap);
        }
      }, 120);
    },
    vmLayer: function (key, checked) {
      if (key === 'executing') {
        vmState.layers.executing = true;
        paintVmLayerControl();
        return;
      }
      if (typeof checked === 'boolean') vmState.layers[key] = checked;
      else vmState.layers[key] = !vmState.layers[key];
      if (key === 'fence' && !vmState.layers.fence) vmState.selectedSite = '';
      if (dispatchMap && window.AMap) {
        applyDispatchMapStyle(window.AMap);
        refreshDispatchMarkers(window.AMap);
        var field = document.querySelector('[data-layer="' + key + '"]');
        if (field) field.checked = !!vmState.layers[key];
        paintVmLayerControl();
      } else app.render();
    },
    vmToggleLayers: function (event) {
      if (event && event.stopPropagation) event.stopPropagation();
      vmState.layerOpen = !vmState.layerOpen;
      var control = document.querySelector('.vm-layer-control');
      var panel = document.getElementById('vmLayerPanel');
      var trigger = document.querySelector('.vm-layer-trigger');
      if (control) control.classList.toggle('is-open', vmState.layerOpen);
      if (panel) panel.hidden = !vmState.layerOpen;
      if (trigger) trigger.setAttribute('aria-expanded', String(vmState.layerOpen));
    },
    vmZoom: function (delta) {
      if (!dispatchMap) return;
      var z = dispatchMap.getZoom ? dispatchMap.getZoom() : 10;
      if (dispatchMap.setZoom) dispatchMap.setZoom(z + delta);
    },
    vmFocus: function () {
      var v = vmSelected();
      var task = vmSelectedTask();
      if (dispatchMap && window.AMap && task) {
        vmFocusTaskMap(task, window.AMap);
      } else if (dispatchMap && window.AMap && v) dispatchMap.setZoomAndCenter(13, [v.lng, v.lat]);
      else if (dispatchMap && window.AMap) {
        vmRestoreOverviewMap();
        refreshDispatchMarkers(window.AMap);
      }
    },
    stTrend: function (id) { stTrendKind = id || 'task'; app.render(); },
    stKpiRange: function (id) { stKpiRange = id || 'today'; app.render(); },
    stDay: function () {
      stDay = (document.getElementById('stDay') || {}).value || 'today';
      app.render();
    },
    stGoods: function () {
      stGoods = (document.getElementById('stGoods') || {}).value || 'all';
      app.render();
    },
    stMore: function () { toast('对应明细将下钻到统计报表'); },
    dcSatellite: function () {
      mapFilter.satellite = !mapFilter.satellite;
      if (dispatchMap && window.AMap) applyDispatchMapStyle(window.AMap);
      var tools = document.querySelectorAll('.dc-map-toolbar .dc-tool');
      if (tools[0]) {
        tools[0].classList.toggle('is-on', mapFilter.satellite);
        tools[0].textContent = mapFilter.satellite ? '卫星' : '地图';
      }
    },
    dcFullscreen: function () {
      mapFilter.fullscreen = !mapFilter.fullscreen;
      var root = document.querySelector('.dc-root');
      if (root) root.classList.toggle('is-map-full', mapFilter.fullscreen);
      var button = document.querySelector('.vm-layer-btns button[title="全屏"], .dc-map-toolbar button[title="全屏"]');
      if (button) button.classList.toggle('is-on', mapFilter.fullscreen);
      window.setTimeout(function () {
        if (dispatchMap && dispatchMap.resize) dispatchMap.resize();
      }, 0);
    },
    locatePlate: function (plate) {
      vmRememberOverviewCamera();
      vmHoveredPlate = '';
      selectedPlate = plate;
      if (dcTab === 'monitor') {
        vmState.opsOpen = false;
        var selectedVehicle = monitorVehicles().filter(function (vehicle) { return vehicle.plate === plate; })[0];
        var task = vmTaskForVehicle(selectedVehicle);
        if (task) {
          selectedTaskId = task.id;
        } else selectedTaskId = '';
        var vehicleIndex = vmVehicleFiltered().findIndex(function (vehicle) { return vehicle.plate === plate; });
        if (vehicleIndex >= 0) vmState.page = Math.floor(vehicleIndex / VM_PAGE) + 1;
        vmState.layers.load = vmTaskHasRouteContext(task);
        vmState.layers.fence = false;
        vmState.selectedSite = '';
        vmState.detail = 'live';
        paintVmPanels();
        paintVmLayerControl();
      } else paintMapPopup();
      var v = (dcTab === 'monitor' ? vmMapVehicles() : dispatchVehicles()).filter(function (x) { return x.plate === plate; })[0];
      if (dispatchMap && window.AMap && v) {
        refreshDispatchMarkers(window.AMap);
        if (dcTab === 'monitor' && task) vmFocusTaskMap(task, window.AMap);
        else dispatchMap.setZoomAndCenter(11, [v.lng, v.lat]);
      } else renderDispatchFallback(document.getElementById('wbDispatchMap'));
    },
    locateAlert: function (id) {
      var alert = findAlert(id);
      if (!alert) return;
      var plate = alert.objectType === '车辆' ? alert.objectNo : '';
      if (!plate) {
        var hit = store.board.executing.filter(function (r) { return r.no === alert.objectNo; })[0];
        plate = hit ? hit.plate : '';
      }
      if (plate) WB.locatePlate(plate);
      else WB.handleAlert(id);
    },
    contactDriver: function (id) {
      var alert = findAlert(id);
      toast(alert ? '已发起联系司机：' + alert.objectNo : '已发起联系司机');
    },
    reschedule: function (id) {
      var alert = findAlert(id);
      toast(alert ? '已进入重调建议：' + alert.objectNo : '已进入重调建议');
      WB.jumpTaskTab('dispatch');
    },
    refresh: function () {
      store.updatedAt = nowStr();
      saveState();
      toast('已按最新规则重算待办与告警');
      app.render();
    },
    openTodos: function (role, type) {
      listState = { page: 1, type: type || '', role: role === 'all' ? '' : (role || ''), status: '未完成', keyword: '', level: '', category: '', read: '' };
      highlightPage = 'workbench-todo';
      app.navigate('workbench-todo');
    },
    openAlerts: function (role, level, type) {
      listState = { page: 1, type: '', role: role === 'all' ? '' : (role || ''), status: '未恢复', keyword: '', level: level || '', category: type || '', read: '' };
      highlightPage = 'workbench-alert';
      app.navigate('workbench-alert');
    },
    dispatchTodoTab: function (tab) {
      dispatchTodoTab = tab === 'conflict' ? 'preassign' : (tab === 'confirm' ? 'other' : (tab || 'all'));
      app.render();
      var el = document.getElementById('wbDispatchTodos');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    dispatchTodoPri: function (value) {
      dispatchTodoPri = value || '';
      app.render();
    },
    dispatchTodoQuery: function (value) {
      dispatchTodoQ = value || '';
      var box = document.querySelector('#wbDispatchTodos .wb-dispatch-todo-scroll');
      if (!box) return;
      var items = visibleDispatchTodos().map(renderDispatchTodoCard).join('');
      box.innerHTML = items || '<div class="empty-state"><b>没有符合筛选条件的业务待办</b><p>可切换类型、优先级或清空关键字后再看。</p></div>';
    },
    dispatchCapacityQuery: function (value) {
      dispatchCapacityQ = value || '';
      var tb = document.querySelector('#wbDispatchCapacity .wb-capacity-table tbody');
      if (!tb) return;
      var rows = visibleDispatchCapacity().map(renderDispatchCapacityRow).join('');
      tb.innerHTML = rows || '<tr><td colspan="5">没有符合筛选的运力</td></tr>';
    },
    dispatchGlobalQuery: function (value) {
      dispatchGlobalQ = value || '';
      var panel = document.getElementById('wbDispatchGlobalPanel');
      if (!panel) return;
      var html = dispatchGlobalPanelHtml();
      panel.hidden = !html;
      panel.innerHTML = html;
    },
    openGlobalHit: function (kind, id) {
      dispatchHit = id || '';
      dispatchGlobalQ = '';
      var panel = document.getElementById('wbDispatchGlobalPanel');
      if (panel) { panel.hidden = true; panel.innerHTML = ''; }
      if (kind === 'todo') {
        var item = dispatchTodoCards().filter(function (row) { return row.id === id; })[0];
        dispatchTodoTab = (item && item.group) || 'all';
        app.render();
        window.setTimeout(function () {
          var el = document.getElementById('wbDispatchTodos');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          if (item) openModal(dispatchTodoPeekHtml(item));
        }, 0);
        return;
      }
      if (kind === 'alert') {
        var alertItem = dispatchAlertCards().filter(function (row) { return row.id === id; })[0];
        dispatchAlertStatus = 'open';
        app.render();
        window.setTimeout(function () {
          var el = document.getElementById('wbDispatchAlerts');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          if (alertItem) openModal(dispatchAlertActionHtml(alertItem, 'task'));
        }, 0);
        return;
      }
      if (kind === 'driver') {
        var driverRow = dispatchCapacityRows().filter(function (row) { return row.driver === id; })[0];
        dispatchHit = (driverRow && driverRow.truck) || id;
        dispatchCapacityFilter = '';
        app.render();
        window.setTimeout(function () {
          var el = document.getElementById('wbDispatchCapacity');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          openModal(dispatchDriverPeekHtml(id));
        }, 0);
        return;
      }
      dispatchCapacityFilter = '';
      app.render();
      window.setTimeout(function () {
        var el = document.getElementById('wbDispatchCapacity');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        WB.openVehiclePeek(id);
      }, 0);
    },
    openVehiclePeek: function (truck) {
      var row = dispatchCapacityRows().filter(function (item) { return item.truck === truck; })[0];
      if (row) openModal(dispatchVehiclePeekHtml(row));
    },
    openDriverPeek: function (name) {
      openModal(dispatchDriverPeekHtml(name));
    },
    dispatchAlertType: function (type) {
      dispatchAlertType = type || 'all';
      app.render();
    },
    dispatchAlertStatus: function (status) {
      dispatchAlertStatus = status || 'open';
      if (status === 'done' || status === 'ignored') dispatchAlertLevel = '';
      app.render();
    },
    focusDispatchAlerts: function (level) {
      var desk = ensureDispatchDesk();
      dispatchAlertPulse = false;
      desk.viewed = true;
      dispatchAlertCards().forEach(function (item) {
        if (item.status === '新告警') desk.alertStatus[item.id] = '待处理';
      });
      saveState();
      dispatchAlertStatus = 'open';
      dispatchAlertLevel = level === '高' || level === 'mid' ? level : '';
      app.render();
      window.setTimeout(function () {
        var el = document.getElementById('wbDispatchAlerts');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    },
    focusDispatchCapacity: function (filter) {
      closeDispatchMore();
      var allowed = { idle: 1, releasing: 1, available: 1, run: 1, load: 1 };
      dispatchCapacityFilter = allowed[filter] ? filter : '';
      app.render();
      window.setTimeout(function () {
        var el = document.getElementById('wbDispatchCapacity');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    },
    dispatchExecBoard: function (node) {
      var titles = { '': '执行中任务', '装货': '执行中任务 · 装货中', '行驶': '执行中任务 · 运输中', '卸货': '执行中任务 · 卸货中' };
      closeDispatchMore();
      boardState = { kind: 'executing', title: titles[node || ''] || '执行中任务', from: app.currentPage, node: node || '', live: true };
      highlightPage = boardState.from;
      listState.page = 1;
      app.navigate('workbench-board');
    },
    dispatchTodoAction: function (action, id) {
      var item = dispatchTodoCards().filter(function (row) { return row.id === id; })[0];
      if (!item) return;
      if (action === 'dispatch' || action === 'preassign' || action === 'adjustPreassign') {
        openDispatchDrawer(id, action === 'dispatch' ? 'formal' : 'preassign');
        return;
      }
      if (action === 'split') {
        WB.splitOrder(item.orderNo || item.taskNo);
        return;
      }
      if (action === 'view' || action === 'viewOrder' || action === 'viewPreassign') {
        openModal(dispatchTodoPeekHtml(item));
        return;
      }
      openModal(dispatchTodoActionHtml(item, action));
    },
    splitOrder: function (orderNo) {
      closeDispatchMore();
      if (orderNo && orderNo.charAt(0) === 'Y' && typeof window.openWaybillSplit === 'function') {
        window.openWaybillSplit(orderNo);
        return;
      }
      WB.openOrderSplit();
    },
    viewOrder: function (orderNo) {
      closeDispatchMore();
      if (orderNo && typeof window.openDynamicOrder === 'function' && (orderNo.charAt(0) === 'Y' || orderNo.indexOf('DD') === 0)) {
        if (orderNo.charAt(0) === 'Y') {
          window.openDynamicOrder(orderNo);
          return;
        }
      }
      WB.openOrderSplit();
    },
    openDispatchDrawer: function (id, mode) {
      openDispatchDrawer(id || '', mode);
    },
    closeDispatchDrawer: function () {
      var host = document.getElementById('wbDispatchDrawerHost');
      var overlay = host && host.querySelector('.wb-dispatch-drawer-overlay');
      if (!host || !overlay) return;
      overlay.classList.remove('show');
      setTimeout(function () { host.innerHTML = ''; }, 220);
    },
    pickReverseTask: function (id) {
      dispatchAssignTaskId = id || '';
      var overlay = document.getElementById('wbDispatchDrawerOverlay');
      if (!overlay) return;
      Array.prototype.forEach.call(overlay.querySelectorAll('.wb-assign-option'), function (el) {
        var input = el.querySelector('input');
        var on = input && input.value === dispatchAssignTaskId;
        el.classList.toggle('is-on', !!on);
        if (input) input.checked = !!on;
      });
    },
    pickAssignCapacity: function (truck) {
      dispatchAssignPick = truck || '';
      var row = dispatchAssignRow(dispatchAssignPick);
      Array.prototype.forEach.call(document.querySelectorAll('.wb-assign-option'), function (el) {
        var input = el.querySelector('input');
        var on = input && input.value === dispatchAssignPick;
        el.classList.toggle('is-on', !!on);
        if (input) input.checked = !!on;
      });
      var driver = document.getElementById('wbAssignDriver');
      var head = document.getElementById('wbAssignTruck');
      var trailer = document.getElementById('wbAssignTrailer');
      if (driver) driver.value = row ? row.driver : '';
      if (head) head.value = row ? row.truck : '';
      if (trailer) trailer.value = row ? row.trailer : '';
    },
    confirmAssign: function () {
      var source = dispatchTodoCards().filter(function (row) { return row.id === dispatchAssignTaskId; })[0];
      var task = dispatchDrawerTask(dispatchAssignTaskId);
      var row = dispatchAssignRow(dispatchAssignPick);
      if (dispatchDrawerDir === 'vehicle' && !source) {
        toast('请选择待派任务');
        return;
      }
      if (!row) {
        toast('请选择可用运力');
        return;
      }
      var desk = ensureDispatchDesk();
      if (dispatchDrawerMode === 'preassign') {
        desk.todoPatch[task.id] = {
          group: 'preassign',
          type: '待转正式',
          driver: row.driver,
          truck: row.truck,
          trailer: row.trailer,
          primary: '转正式派单',
          primaryAction: 'formalize',
          extra: [['调整预派', 'adjustPreassign']],
          prevTask: source && source.group === 'preassign' ? (source.prevTask || '已完成') : (row.status === '空闲' ? '已完成' : row.status),
          resourceReady: row.status === '空闲'
        };
        delete desk.todoStatus[task.id];
        desk.capacityPatch[row.truck] = Object.assign({}, desk.capacityPatch[row.truck] || {}, {
          nextTask: task.route,
          nextTaskNo: task.no
        });
        dispatchTodoTab = 'preassign';
      } else {
        desk.todoStatus[task.id] = '已完成';
      }
      saveState();
      WB.closeDispatchDrawer();
      toast(dispatchDrawerDir === 'vehicle'
        ? ((dispatchDrawerMode === 'preassign' ? '已给 ' : '已派给 ') + row.truck + (dispatchDrawerMode === 'preassign' ? ' 预派 ' : ' ') + task.route)
        : ((dispatchDrawerMode === 'preassign' ? '已预派 ' : '已派单 ') + row.driver + ' · ' + row.truck + ' / ' + row.trailer));
      app.render();
    },
    confirmDispatchTodoAction: function (action, id) {
      var item = dispatchTodoCards().filter(function (row) { return row.id === id; })[0];
      if (!item) return;
      var complete = { formalize: 1, cancelPreassign: 1, confirmInfo: 1 };
      var messages = {
        formalize: '已转为正式派单，待办已闭环',
        adjustPreassign: '已保存预派修改，待办保持待处理',
        cancelPreassign: '已撤回预派，待办已闭环',
        confirmInfo: '必要信息已确认，待办已闭环'
      };
      if (complete[action]) {
        ensureDispatchDesk().todoStatus[id] = '已完成';
        saveState();
      }
      WB.closeModal();
      toast(messages[action] || '操作已提交');
      app.render();
    },
    dispatchAlertAction: function (action, id) {
      var item = dispatchAlertCards().filter(function (row) { return row.id === id; })[0];
      if (!item) return;
      var desk = ensureDispatchDesk();
      if (item.status === '新告警' && action !== 'ignore') {
        desk.alertStatus[id] = '待处理';
        saveState();
      }
      if (action === 'handle') {
        dispatchAlertHandleId = dispatchAlertHandleId === id ? '' : id;
        app.render();
        return;
      }
      if (action === 'contact') {
        desk.alertStatus[id] = '处理中';
        saveState();
        toast('已联系司机 ' + item.driver + ' ' + item.phone);
        app.render();
        return;
      }
      openModal(dispatchAlertActionHtml(item, action));
    },
    cancelAlertHandle: function () {
      dispatchAlertHandleId = '';
      app.render();
    },
    confirmAlertHandle: function (id) {
      var item = dispatchAlertCards().filter(function (row) { return row.id === id; })[0];
      if (!item) return;
      var picked = document.querySelector('input[name="wbAlertResult"]:checked');
      var result = picked ? picked.value : '';
      var note = ((document.getElementById('wbAlertHandleNote') || {}).value || '').trim();
      if (!result) {
        toast('请选择处理结果');
        return;
      }
      if (result === '其他' && !note) {
        toast('选择其他时请填写备注');
        return;
      }
      var desk = ensureDispatchDesk();
      desk.alertResult[id] = result;
      desk.alertNote[id] = note;
      if (result === '运输异常，持续关注') {
        desk.alertStatus[id] = '处理中';
        toast('已记录，该告警持续关注');
      } else if (result === '误报') {
        desk.alertStatus[id] = '已忽略';
        desk.ignoreReason[id] = note || '误报';
        toast('已按误报关闭');
      } else {
        desk.alertStatus[id] = '已处理';
        toast('告警已处理完成');
      }
      dispatchAlertHandleId = '';
      saveState();
      app.render();
    },
    confirmDispatchAlertAction: function (action, id) {
      var item = dispatchAlertCards().filter(function (row) { return row.id === id; })[0];
      if (!item) return;
      var desk = ensureDispatchDesk();
      if (action === 'ignore') {
        var reason = ((document.getElementById('wbAlertIgnoreReason') || {}).value || '').trim();
        if (!reason) { toast('忽略告警必须填写原因'); return; }
        desk.alertStatus[id] = '已忽略';
        desk.ignoreReason[id] = reason;
        toast('已忽略该告警，原因已留痕');
      } else if (action === 'done') {
        desk.alertStatus[id] = '已处理';
        toast('告警已处理完成，已移出未处理列表');
      }
      saveState();
      WB.closeModal();
      app.render();
    },
    dispatchCapacityAction: function (action, truck) {
      var row = dispatchCapacityRows().filter(function (item) { return item.truck === truck; })[0];
      if (!row) return;
      if (action === 'assign') {
        openReverseDispatchDrawer(truck, 'formal');
        return;
      }
      if (action === 'arrange') {
        openReverseDispatchDrawer(truck, 'preassign');
        return;
      }
      openModal(dispatchCapacityActionHtml(row));
    },
    confirmDispatchCapacityAction: function (action, truck) {
      var row = dispatchCapacityRows().filter(function (item) { return item.truck === truck; })[0];
      if (!row) return;
      var desk = ensureDispatchDesk();
      if (action === 'arrange') {
        desk.capacityPatch[truck] = Object.assign({}, desk.capacityPatch[truck] || {}, {
          nextTask: '昆钢 → 研和',
          nextTaskNo: taskCode(90)
        });
        saveState();
      }
      var messages = {
        assign: '已为待派任务匹配 ' + truck,
        arrange: '已为 ' + truck + ' 安排下一任务',
        viewNext: '已将 ' + truck + ' 的下一任务转为正式派单'
      };
      WB.closeModal();
      toast(messages[action] || ('已更新 ' + row.driver + ' 的接续计划'));
      if (action === 'arrange') app.render();
    },
    board: function (kind, node, customTitle) {
      closeDispatchMore();
      var titles = { executing: '执行中任务', finished: '今日完成任务', drivers: '可用司机', vehicles: '可用车辆', trailers: '可用挂车', preassign: '预派任务', releasing: '即将释放运力' };
      var title = customTitle || titles[kind] || '明细';
      if (kind === 'executing' && node && !customTitle) title = '执行中任务 · ' + node + '节点';
      boardState = { kind: kind, title: title, from: app.currentPage, node: kind === 'executing' ? (node || '') : '', live: false };
      highlightPage = boardState.from;
      listState.page = 1;
      app.navigate('workbench-board');
    },
    page: function (n) { listState.page = n; app.render(); },
    applyList: function () {
      var page = app.currentPage;
      listState.page = 1;
      if (page === 'workbench-todo') {
        listState.type = (document.getElementById('wbTodoType') || {}).value || '';
        listState.role = roleSelectValue((document.getElementById('wbTodoRole') || {}).value || '');
        listState.status = (document.getElementById('wbTodoStatus') || {}).value || '';
        listState.keyword = ((document.getElementById('wbTodoKw') || {}).value || '').trim();
      }
      if (page === 'workbench-alert') {
        listState.category = (document.getElementById('wbAlertType') || {}).value || '';
        listState.level = (document.getElementById('wbAlertLevel') || {}).value || '';
        listState.role = roleSelectValue((document.getElementById('wbAlertRole') || {}).value || '');
        listState.keyword = ((document.getElementById('wbAlertKw') || {}).value || '').trim();
      }
      app.render();
    },
    resetList: function () {
      listState = { page: 1, type: '', role: '', status: app.currentPage === 'workbench-alert' ? '未恢复' : (app.currentPage === 'workbench-todo' ? '未完成' : ''), keyword: '', level: '', category: '', read: '' };
      app.render();
    },
    todoTab: function (status) { listState.status = status; listState.page = 1; app.render(); },
    alertTab: function (status) { listState.status = status; listState.level = ''; listState.page = 1; app.render(); },
    msgTab: function (read) { listState.read = read; listState.page = 1; app.render(); },
    detail: function (kind, id) {
      var row = kind === 'todo' ? findTodo(id) : findAlert(id);
      if (!row) return;
      openModal(detailHtml(kind, row));
    },
    closeModal: function () {
      var host = document.getElementById('wbModalHost');
      if (host) host.innerHTML = '';
    },
    handle: function (id) {
      var todo = findTodo(id);
      if (!todo) return;
      WB.closeModal();
      var jump = TODO_JUMP[todo.type];
      if (jump && app.pages[jump]) {
        if (todo.status === '待处理') {
          addLog(todo.id, '待办领取', todo.status, '处理中', '进入业务页处理');
          todo.status = '处理中';
          store.updatedAt = nowStr();
          saveState();
        }
        toast('已进入业务页处理「' + todo.type + '」。完成后回到待办中心确认关闭。');
        if (todo.type === '待派单' && typeof window.toOpenStatusTab === 'function') {
          window.toOpenStatusTab('dispatch');
          return;
        }
        app.navigate(jump);
        return;
      }
      processModal(id, todo.type, '该事项在工作台内闭环演示：填写处理说明后，按业务完成规则关闭待办，并重校验关联告警。');
    },
    closeTodo: function (id) {
      var todo = findTodo(id);
      if (!todo) return;
      processModal(id, '确认业务已完成', '原型不改写原业务模块状态。确认后按“业务完成 → 自动关闭待办”演示闭环。');
    },
    submitProcess: function (id) {
      var reason = ((document.getElementById('wbReason') || {}).value || '').trim();
      if (!reason) { toast('请填写处理说明'); return; }
      var todo = findTodo(id);
      if (!todo) return;
      addLog(todo.id, '待办关闭', todo.status, '已完成', reason);
      todo.status = '已完成';
      todo.finishedAt = nowStr();
      store.alerts.forEach(function (a) {
        if (a.objectNo === todo.bizNo && a.status !== '已关闭' && a.status !== '已恢复') {
          addLog(a.id, '告警恢复', a.status, '已恢复', '待办关闭后重新校验，异常条件消失');
          a.status = '已恢复';
        }
      });
      toast('待办已关闭，关联告警已重新校验');
      afterChange();
    },
    handleAlert: function (id) {
      var alert = findAlert(id);
      if (!alert) return;
      WB.closeModal();
      if (alert.status === '待确认') {
        alert.status = '处理中';
        addLog(alert.id, '告警升级', '待确认', '处理中', '进入处理');
        saveState();
      }
      var related = store.todos.filter(function (t) { return t.bizNo === alert.objectNo && t.status !== '已完成'; })[0];
      if (related) {
        WB.handle(related.id);
        return;
      }
      if (alert.role === 'dispatch' || alert.role === 'fleet') {
        toast('已进入任务单处理该告警');
        app.navigate('task-order-management');
        return;
      }
      if (alert.role === 'stat') {
        app.navigate('weigh-point-audit');
        return;
      }
      WB.openTodos(alert.role);
    },
    ackAlert: function (id) { WB.closeModal(); ackModal(id); },
    submitAck: function (id) {
      var reason = ((document.getElementById('wbReason') || {}).value || '').trim();
      if (!reason) { toast('确认无异常必须填写原因'); return; }
      var alert = findAlert(id);
      if (!alert) return;
      addLog(alert.id, '告警关闭', alert.status, '已关闭', reason);
      alert.status = '已关闭';
      toast('已记录确认无异常');
      afterChange();
    },
    readMsg: function (id) {
      store.messages.forEach(function (m) { if (m.id === id) m.read = true; });
      saveState();
      var msg = store.messages.filter(function (m) { return m.id === id; })[0];
      if (!msg) return;
      openModal('<div class="modal-header"><div class="modal-title">消息详情</div><button class="modal-close" type="button" onclick="WB.closeModal()" aria-label="关闭">×</button></div>'
        + '<div class="modal-body"><div class="form-grid">' + field('标题', msg.title) + field('时间', msg.time) + field('关联对象', msg.bizNo || '—')
        + '<div class="form-item full"><span class="form-label">内容</span><div class="form-value">' + esc(msg.content) + '</div></div></div></div>'
        + '<div class="modal-footer"><button class="btn btn-primary" type="button" onclick="WB.closeModal()">知道了</button></div>');
      app.render();
    }
  };

  function register(name, render) {
    app.register(name, render, [name]);
    app.pages[name].onRender = function () {
      bindListFilters();
      if (app.updateNav) app.updateNav();
      if (app.currentPage === 'dispatch-screen') {
        dcTab = 'monitor';
        startDcClock();
        initDispatchMap();
      } else {
        destroyDispatchMap();
      }
    };
  }

  if (!window.app) return;
  store = loadState();
  enhanceNav();
  register('login', renderLogin);
  register('dispatch-screen', renderDispatchScreen);
  register('workbench-home', renderHome);
  register('workbench-dispatch', renderDispatch);
  register('workbench-stat', renderStat);
  register('workbench-fleet', renderFleet);
  register('workbench-safety', renderSafety);
  register('workbench-ops', renderOps);
  register('workbench-manager', renderManager);
  register('workbench-todo', renderTodoCenter);
  register('workbench-alert', renderAlertCenter);
  register('workbench-message', renderMessageCenter);
  register('workbench-board', renderBoard);

  var origNavigate = app.navigate;
  app.navigate = function (page) {
    if (page !== 'login' && !getAuth()) {
      origNavigate.call(app, 'login');
      return;
    }
    if (page === 'dispatch-screen' && !canSeeScreen()) {
      toast('当前角色不开放调度可视化大屏');
      return;
    }
    origNavigate.call(app, page);
  };

  var origInit = app.init;
  app.init = function () {
    var hashPage = window.location.hash.replace('#', '');
    var acc = currentAccount();
    if (!acc) {
      this.currentPage = 'login';
      if (window.location.hash !== '#login') window.location.hash = 'login';
    } else if (!hashPage || hashPage === 'login' || (hashPage === 'dispatch-screen' && !canSeeScreen())) {
      this.currentPage = roleLanding(acc);
      window.location.hash = '#' + this.currentPage;
    }
    origInit.call(this);
  };
})();
