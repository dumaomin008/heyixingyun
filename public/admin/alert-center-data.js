/* 统一告警数据层：六类多级规则、事件升降级、恢复、处理与 Demo 持久化。 */
(function () {
  'use strict';

  var STORAGE_KEY = 'hyxy-alert-center-v1';
  var LEGACY_RULE_KEY = 'hyxy-warning-rules-v1';
  var OPERATOR = '李调度';
  var PROJECT_ID = 'YX001';
  var PROJECT_NAME = '玉溪项目';
  var LEVELS = ['一般', '严重', '紧急'];
  var PROJECTS = [
    { id: 'YX001', name: '玉溪项目' },
    { id: 'JH001', name: '景洪项目' }
  ];
  /* 规则适用范围候选；判定逻辑不按车牌写死。 */
  var PARKING_VEHICLES = [
    { plate: '云A·D8021', projectId: 'YX001', projectName: '玉溪项目' },
    { plate: '云A·E1936', projectId: 'YX001', projectName: '玉溪项目' },
    { plate: '云A·F4470', projectId: 'YX001', projectName: '玉溪项目' },
    { plate: '云A·G2288', projectId: 'YX001', projectName: '玉溪项目' },
    { plate: '云A·H3188', projectId: 'YX001', projectName: '玉溪项目' },
    { plate: '云A·H6612', projectId: 'YX001', projectName: '玉溪项目' },
    { plate: '云A·K4419', projectId: 'JH001', projectName: '景洪项目' },
    { plate: '云A·J5501', projectId: 'JH001', projectName: '景洪项目' },
    { plate: '云A·S1008', projectId: 'YX001', projectName: '玉溪项目' }
  ];
  var state;

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function pad(value) { return String(value).padStart(2, '0'); }
  function nowText() {
    var date = new Date();
    return formatStamp(date.getTime());
  }
  function formatStamp(ms) {
    var date = new Date(ms);
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' '
      + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
  }
  function parseStamp(text) {
    var t = new Date(String(text || '').replace(/-/g, '/')).getTime();
    return isFinite(t) ? t : NaN;
  }
  function shiftStamp(text, minutes) {
    var t = parseStamp(text);
    if (!isFinite(t)) return text;
    return formatStamp(t + Number(minutes) * 60000);
  }
  function minutesBetween(start, end) {
    var a = parseStamp(start);
    var b = parseStamp(end);
    if (!isFinite(a) || !isFinite(b)) return null;
    return Math.max(0, Math.round((b - a) / 60000));
  }
  function evaluationTime(currentSignal) {
    if (typeof currentSignal === 'string') return currentSignal;
    if (!currentSignal) return nowText();
    return currentSignal.evaluatedAt || currentSignal.currentTime || nowText();
  }
  function clockHm(stamp) {
    var hm = String(stamp || '').slice(11, 16);
    return /^\d{2}:\d{2}$/.test(hm) ? hm : '';
  }
  function isExecutingBoundTask(metrics, currentSignal) {
    var taskId = (currentSignal && currentSignal.taskId) || (metrics && metrics.taskId);
    return !!(metrics && metrics.taskStatus === '执行中' && metrics.taskBound === true && taskId);
  }
  function isTaskEnded(metrics) {
    return !!(metrics && (metrics.taskEnded === true || metrics.taskStatus === '已结束' || metrics.taskStatus === '已完成'));
  }
  function levelRank(level) { return level === '紧急' ? 3 : level === '严重' ? 2 : level === '一般' ? 1 : 0; }
  function ruleByCode(rules, code) { return (rules || []).filter(function (item) { return item.code === code; })[0] || null; }
  function rulesByCode(rules, code) { return (rules || []).filter(function (item) { return item.code === code; }); }
  function levelByName(rule, name) { return (rule && rule.levels || []).filter(function (item) { return item.level === name; })[0] || null; }
  function durationLevel(level, threshold) { return { level: level, enabled: true, threshold: threshold }; }
  function speedLevel(level, speed, seconds) { return { level: level, enabled: true, speedThreshold: speed, durationSeconds: seconds }; }
  function fatigueLevel(level, minutes) { return { level: level, enabled: true, thresholdMinutes: minutes }; }
  function defaultParkingDetect() {
    return { stillSpeedKph: 3, minStillMinutes: 5, excludeLoading: true, excludeUnloading: true, excludeCharging: true };
  }
  function parkingRecoveryText(config) {
    var speed = Number((config || {}).recoverSpeedKph || 5);
    var minutes = Number((config || {}).recoverDurationMinutes || 3);
    var extra = (config || {}).endOnTaskComplete !== false ? '；任务结束后自动结束监测' : '';
    return '车速 ≥ ' + speed + ' km/h 持续 ' + minutes + ' 分钟' + extra;
  }
  function defaultParkingRecovery() {
    var config = { recoverSpeedKph: 5, recoverDurationMinutes: 3, endOnTaskComplete: true };
    config.description = parkingRecoveryText(config);
    return config;
  }
  function inMonitorPeriod(rule, currentSignal) {
    if (!rule || rule.monitorPeriod !== '自定义') return true;
    var stamp = evaluationTime(currentSignal);
    var hm = String(stamp).slice(11, 16);
    var start = rule.monitorStart || '00:00';
    var end = rule.monitorEnd || '23:59';
    if (start <= end) return hm >= start && hm <= end;
    return hm >= start || hm <= end;
  }
  function matchParkingRule(rules, currentSignal) {
    var list = rulesByCode(rules, 'TRANSPORT_PARKING').filter(function (item) { return item.enabled; });
    var plate = currentSignal.plate;
    var projectId = currentSignal.projectId || PROJECT_ID;
    var vehicleHit = list.filter(function (item) {
      return item.scopeType === '指定车辆' && (item.vehiclePlates || []).indexOf(plate) >= 0;
    });
    if (vehicleHit.length) return vehicleHit[0];
    var projectHit = list.filter(function (item) {
      return item.scopeType === '指定项目' && (item.projectIds || []).indexOf(projectId) >= 0;
    });
    if (projectHit.length) return projectHit[0];
    return list.filter(function (item) { return item.scopeType === '全部项目' || !item.scopeType; })[0] || null;
  }
  function resolveRule(rules, currentSignal) {
    if (currentSignal.ruleCode === 'TRANSPORT_PARKING') return matchParkingRule(rules, currentSignal);
    return ruleByCode(rules, currentSignal.ruleCode);
  }

  function seedRules() {
    return [
      {
        id: 'RULE_TRANSPORT_PARKING', code: 'TRANSPORT_PARKING', name: '停车超时预警', category: '运输', enabled: true,
        description: '运输任务执行中识别持续静止，排除装卸与充电后按分级时长触发',
        scopeType: '全部项目', projectIds: [], projectNames: [], vehiclePlates: [],
        monitorPeriod: '全天', monitorStart: '06:00', monitorEnd: '23:00',
        detectConfig: defaultParkingDetect(),
        levels: [durationLevel('一般', 30), durationLevel('严重', 60), durationLevel('紧急', 120)],
        recoveryConfig: defaultParkingRecovery(), updatedBy: '系统预置', updatedAt: '2026-10-08 09:00:00'
      },
      {
        id: 'RULE_TRANSPORT_PARKING_K4419', code: 'TRANSPORT_PARKING', name: 'K4419例外停车预警', category: '运输', enabled: true,
        description: '指定车辆覆盖默认规则，用于特殊车辆差异化阈值',
        scopeType: '指定车辆', projectIds: [], projectNames: [], vehiclePlates: ['云A·K4419'],
        monitorPeriod: '全天', monitorStart: '06:00', monitorEnd: '23:00',
        detectConfig: defaultParkingDetect(),
        levels: [durationLevel('一般', 20), durationLevel('严重', 40), durationLevel('紧急', 90)],
        recoveryConfig: defaultParkingRecovery(), updatedBy: '系统预置', updatedAt: '2026-10-08 09:00:00'
      },
      {
        id: 'RULE_TRANSPORT_PARKING_JH', code: 'TRANSPORT_PARKING', name: '景洪项目停车预警', category: '运输', enabled: true,
        description: '指定项目覆盖默认规则，项目内执行任务车辆自动应用',
        scopeType: '指定项目', projectIds: ['JH001'], projectNames: ['景洪项目'], vehiclePlates: [],
        monitorPeriod: '全天', monitorStart: '06:00', monitorEnd: '23:00',
        detectConfig: defaultParkingDetect(),
        levels: [durationLevel('一般', 25), durationLevel('严重', 50), durationLevel('紧急', 90)],
        recoveryConfig: defaultParkingRecovery(), updatedBy: '系统预置', updatedAt: '2026-10-08 09:00:00'
      },
      {
        id: 'RULE_PARKING_AREA', code: 'PARKING_AREA', name: '停车区域预警', category: '作业', enabled: true,
        description: '车辆在业务区域或电子围栏内停留达到分级时长时触发', scopeType: '全部项目', projectIds: [],
        levels: [durationLevel('一般', 60), durationLevel('严重', 120), durationLevel('紧急', 180)],
        recoveryConfig: { description: '车辆离开对应业务区域' }, updatedBy: '系统预置', updatedAt: '2026-10-08 09:00:00'
      },
      {
        id: 'RULE_VEHICLE_OVERSPEED', code: 'VEHICLE_OVERSPEED', name: '车速预警', category: '车辆', enabled: true,
        description: '车辆达到分级车速并连续保持相应时长时触发', scopeType: '全部项目', projectIds: [],
        levels: [speedLevel('一般', 80, 60), speedLevel('严重', 90, 60), speedLevel('紧急', 100, 60)],
        recoveryConfig: { description: '车速恢复至最低启用等级阈值以下' }, updatedBy: '系统预置', updatedAt: '2026-10-08 09:00:00'
      },
      {
        id: 'RULE_UNLOAD_WEIGHBILL_MISSING', code: 'UNLOAD_WEIGHBILL_MISSING', name: '卸货后未上传磅单', category: '单据', enabled: true,
        description: '离开卸货地且磅单未上传，等待时间达到分级阈值时触发', scopeType: '全部项目', projectIds: [],
        levels: [durationLevel('一般', 15), durationLevel('严重', 30), durationLevel('紧急', 60)],
        recoveryConfig: { description: '卸货磅单上传成功' }, updatedBy: '系统预置', updatedAt: '2026-10-08 09:00:00'
      },
      {
        id: 'RULE_VEHICLE_LOW_SOC', code: 'VEHICLE_LOW_SOC', name: 'SOC预警', category: '车辆', enabled: true,
        description: '车辆 SOC 降至分级阈值时触发，数值越低风险越高', scopeType: '全部项目', projectIds: [],
        levels: [durationLevel('一般', 30), durationLevel('严重', 20), durationLevel('紧急', 10)],
        recoveryConfig: { description: 'SOC 恢复至最低启用等级阈值以上' }, updatedBy: '系统预置', updatedAt: '2026-10-08 09:00:00'
      },
      {
        id: 'RULE_DRIVER_FATIGUE', code: 'DRIVER_FATIGUE', name: '疲劳驾驶预警', category: '安全', enabled: true,
        description: '根据车辆运行行为、当前绑定司机和连续驾驶周期计算疲劳风险', scopeType: '全部项目', projectIds: [],
        levels: [fatigueLevel('一般', 210), fatigueLevel('严重', 240), fatigueLevel('紧急', 270)],
        recoveryConfig: { description: '达到有效休息时长或驾驶员发生变更', restThresholdMinutes: 20 },
        updatedBy: '系统预置', updatedAt: '2026-10-08 09:00:00'
      }
    ];
  }
  function parkingDraftTemplate() {
    var template = clone(ruleByCode(seedRules(), 'TRANSPORT_PARKING'));
    template.id = '__parking_draft';
    template.isDraft = true;
    template.name = '停车超时预警';
    template.enabled = true;
    template.scopeType = '指定项目';
    template.projectIds = [];
    template.projectNames = [];
    template.vehiclePlates = [];
    template.updatedBy = '';
    template.updatedAt = '';
    return template;
  }

  function signal(base, metrics, facts, history) {
    base.metrics = metrics || {};
    base.facts = facts || [];
    base.history = history || [];
    return base;
  }

  /* 最新信号来自运输监控上下文；历史片段仅用于展示完整事件生命周期。 */
  function monitorSignals() {
    return [
      signal({ sourceId: 'live-stop', ruleCode: 'TRANSPORT_PARKING', plate: '云A·D8021', driverName: '李宏俊', driverId: 'D021', taskId: 'Y20260904000021', route: '大开门 → 昆钢', cargo: '水渣', location: '昆磨高速辅路', triggeredAt: '2026-10-08 08:30:00', sourceStatus: 'active' },
        { taskStatus: '执行中', taskBound: true, taskNode: '运输途中', transportRelevant: true, speed: 2, parkingStartedAt: '2026-10-08 08:30:00', parkingMinutes: 72, recoverHoldMinutes: 0, loadingScene: false, unloadingScene: false, charging: false }, [], [
          { action: 'STILL_STARTED', at: '2026-10-08 08:30:00', remark: '车辆进入持续静止状态' },
          { action: 'TRIGGERED', level: '一般', at: '2026-10-08 09:00:00', remark: '连续异常停车达到30分钟，一般告警' },
          { action: 'LEVEL_UPGRADED', from: '一般', to: '严重', at: '2026-10-08 09:30:00', remark: '连续异常停车达到60分钟' }
        ]),
      signal({ sourceId: 'live-parking-handled', ruleCode: 'TRANSPORT_PARKING', plate: '云A·H6612', driverName: '陈志远', driverId: 'D025', taskId: 'Y20260904000025', route: '昆钢 → 研和', cargo: '水泥', location: 'G8511 服务区外侧', triggeredAt: '2026-10-08 09:40:00', sourceStatus: 'active' },
        { taskStatus: '执行中', taskBound: true, taskNode: '运输途中', transportRelevant: true, speed: 1, parkingStartedAt: '2026-10-08 09:10:00', parkingMinutes: 48, recoverHoldMinutes: 0, loadingScene: false, unloadingScene: false, charging: false }, []),
      signal({ sourceId: 'live-parking-loading', ruleCode: 'TRANSPORT_PARKING', plate: '云A·F4470', driverName: '马旺', driverId: 'D023', taskId: 'Y20260904000026', route: '大开门 → 昆钢', cargo: '煤炭', location: '大开门装货区', triggeredAt: '2026-10-08 08:00:00', sourceStatus: 'active' },
        { taskStatus: '执行中', taskBound: true, taskNode: '装货作业', transportRelevant: true, speed: 0, parkingStartedAt: '2026-10-08 08:00:00', parkingMinutes: 60, recoverHoldMinutes: 0, loadingScene: true, unloadingScene: false, charging: false }, []),
      signal({ sourceId: 'live-parking-unload', ruleCode: 'TRANSPORT_PARKING', plate: '云A·E1936', driverName: '王磊', driverId: 'D022', taskId: 'Y20260904000027', route: '昆钢 → 北城', cargo: '铁精粉', location: '北城卸货区', triggeredAt: '2026-10-08 08:20:00', sourceStatus: 'active' },
        { taskStatus: '执行中', taskBound: true, taskNode: '卸货作业', transportRelevant: true, speed: 0, parkingStartedAt: '2026-10-08 08:20:00', parkingMinutes: 60, recoverHoldMinutes: 0, loadingScene: false, unloadingScene: true, charging: false }, []),
      signal({ sourceId: 'live-parking-charge', ruleCode: 'TRANSPORT_PARKING', plate: '云A·S1008', driverName: '罗伟', driverId: 'D038', taskId: 'Y20260904000038', route: '研和 → 北城', cargo: '水泥', location: '北城充电站', triggeredAt: '2026-10-08 09:00:00', sourceStatus: 'active' },
        { taskStatus: '执行中', taskBound: true, taskNode: '充电中', transportRelevant: true, speed: 0, parkingStartedAt: '2026-10-08 09:00:00', parkingMinutes: 40, recoverHoldMinutes: 0, loadingScene: false, unloadingScene: false, charging: true }, []),
      signal({ sourceId: 'live-parking-brief', ruleCode: 'TRANSPORT_PARKING', plate: '云A·H3188', driverName: '何平', driverId: 'D033', taskId: 'Y20260904000033', route: '北城 → 研和', cargo: '煤炭', location: '昆磨高速', triggeredAt: '2026-10-08 10:40:00', sourceStatus: 'active' },
        { taskStatus: '执行中', taskBound: true, taskNode: '运输途中', transportRelevant: true, speed: 0, parkingStartedAt: '2026-10-08 10:40:00', parkingMinutes: 3, recoverHoldMinutes: 0, loadingScene: false, unloadingScene: false, charging: false }, []),
      signal({ sourceId: 'history-parking-recover', ruleCode: 'TRANSPORT_PARKING', plate: '云A·G2288', driverName: '张建华', driverId: 'D024', taskId: 'Y20261007000024', route: '大开门 → 北城', cargo: '水渣', location: '昆钢厂区外侧', triggeredAt: '2026-10-07 07:20:00', recoveredAt: '2026-10-07 09:28:00', sourceStatus: 'recovered', wasTriggered: true, finalLevel: '严重' },
        { taskStatus: '执行中', taskBound: true, taskNode: '运输途中', transportRelevant: true, speed: 12, parkingStartedAt: '2026-10-07 07:20:00', parkingMinutes: 125, recoverHoldMinutes: 4, loadingScene: false, unloadingScene: false, charging: false }, [], [
          { action: 'STILL_STARTED', at: '2026-10-07 07:20:00', remark: '车辆进入持续静止状态' },
          { action: 'TRIGGERED', level: '一般', at: '2026-10-07 07:50:00', remark: '连续异常停车达到30分钟，一般告警' },
          { action: 'LEVEL_UPGRADED', from: '一般', to: '严重', at: '2026-10-07 08:20:00', remark: '连续异常停车达到60分钟' },
          { action: 'RECOVERED', at: '2026-10-07 09:28:00', remark: '车辆速度≥5km/h持续3分钟' }
        ]),
      signal({ sourceId: 'live-parking-k4419', ruleCode: 'TRANSPORT_PARKING', plate: '云A·K4419', driverName: '赵敏', driverId: 'D041', taskId: 'Y20260904000041', route: '景洪水泥厂 → 城北搅拌站', cargo: '水泥', location: '景洪东风镇辅路', triggeredAt: '2026-10-08 10:20:00', sourceStatus: 'active' },
        { taskStatus: '执行中', taskBound: true, taskNode: '运输途中', transportRelevant: true, speed: 1, parkingStartedAt: '2026-10-08 10:00:00', parkingMinutes: 25, recoverHoldMinutes: 0, loadingScene: false, unloadingScene: false, charging: false }, []),
      signal({ sourceId: 'live-parking-jinghong', ruleCode: 'TRANSPORT_PARKING', plate: '云A·J5501', driverName: '刘洋', driverId: 'D042', taskId: 'Y20260904000042', route: '景洪水泥厂 → 旧卸料场', cargo: '水泥', location: '景洪城北绕城', triggeredAt: '2026-10-08 10:25:00', sourceStatus: 'active' },
        { taskStatus: '执行中', taskBound: true, taskNode: '运输途中', transportRelevant: true, speed: 0, parkingStartedAt: '2026-10-08 09:57:00', parkingMinutes: 28, recoverHoldMinutes: 0, loadingScene: false, unloadingScene: false, charging: false }, []),
      signal({ sourceId: 'live-area', ruleCode: 'PARKING_AREA', plate: '云A10103', driverName: '周强', driverId: 'D028', taskId: 'Y20260904000028', route: '昆钢 → 北城', cargo: '钢材', location: '北城卸货区', triggeredAt: '2026-10-08 07:45:00', sourceStatus: 'active' },
        { insideBusinessArea: true, areaDwellMinutes: 135, fenceName: '北城卸货区', enteredAt: '2026-10-08 07:45:00' }, ['07:45 进入北城卸货区', '当前仍在业务区域', '停留时长：2小时15分钟']),
      signal({ sourceId: 'live-speed', ruleCode: 'VEHICLE_OVERSPEED', plate: '云A·E1936', driverName: '王磊', driverId: 'D022', taskId: 'Y20260904000022', route: '北城 → 研和', cargo: '铁精粉', location: 'G8511 昆磨高速', triggeredAt: '2026-10-08 10:12:00', sourceStatus: 'active' },
        { speed: 105, overspeedStartedAt: '2026-10-08 10:12:00', overspeedDurationSeconds: 95 }, ['当前车速：105 km/h', '连续超速：1分35秒', '当前位置：G8511 昆磨高速'], [
          { action: 'TRIGGERED', level: '一般', at: '2026-10-08 10:13:00', remark: '85 km/h 持续60秒' },
          { action: 'LEVEL_UPGRADED', from: '一般', to: '严重', at: '2026-10-08 10:13:20', remark: '95 km/h 持续60秒' },
          { action: 'LEVEL_UPGRADED', from: '严重', to: '紧急', at: '2026-10-08 10:13:35', remark: '105 km/h 持续60秒' }
        ]),
      signal({ sourceId: 'live-bill', ruleCode: 'UNLOAD_WEIGHBILL_MISSING', plate: '云A·F4470', driverName: '马旺', driverId: 'D023', taskId: 'Y20260904000023', route: '昆钢 → 北城', cargo: '煤炭', location: '北城卸货区外侧', triggeredAt: '2026-10-08 09:34:00', sourceStatus: 'active' },
        { unloadLocation: '北城卸货区', unloadDepartedAt: '2026-10-08 09:34:00', leftUnload: true, weighbillUploaded: false, waitingMinutes: 36 }, ['09:34 离开北城卸货地', '卸货磅单：未上传', '已等待36分钟']),
      signal({ sourceId: 'live-soc', ruleCode: 'VEHICLE_LOW_SOC', plate: '云A·D8021', driverName: '李宏俊', driverId: 'D021', taskId: 'Y20260904000021', route: '大开门 → 昆钢', cargo: '水渣', location: '昆钢方向途中', triggeredAt: '2026-10-08 09:50:00', sourceStatus: 'active' },
        { soc: 18 }, ['当前 SOC：18%', '当前任务：Y20260904000021', '当前位置：昆钢方向途中'], [
          { action: 'TRIGGERED', level: '一般', at: '2026-10-08 09:50:00', remark: 'SOC 降至28%' },
          { action: 'LEVEL_UPGRADED', from: '一般', to: '严重', at: '2026-10-08 10:08:00', remark: 'SOC 降至18%' }
        ]),
      signal({ sourceId: 'live-fatigue', ruleCode: 'DRIVER_FATIGUE', drivingCycleId: 'DC-D021-20261008-01', plate: '云A·D8021', vehicleId: 'V021', driverName: '李宏俊', driverId: 'D021', taskId: 'Y20260904000021', route: '大开门 → 昆钢', cargo: '水渣', location: '昆磨高速辅路', triggeredAt: '2026-10-08 06:00:00', sourceStatus: 'active' },
        { drivingCycleId: 'DC-D021-20261008-01', drivingStartedAt: '2026-10-08 06:00:00', continuousDrivingMinutes: 252, currentSpeed: 63, parkingStartedAt: null, continuousParkingMinutes: 0, driverBindingStartedAt: '2026-10-08 05:55:00', drivingCycleActive: true }, ['车辆当前绑定司机：李宏俊', '06:00 开始本次连续驾驶', '当前连续驾驶：4小时12分钟']),
      signal({ sourceId: 'history-soc', ruleCode: 'VEHICLE_LOW_SOC', plate: '云A·S1008', driverName: '罗伟', driverId: 'D038', taskId: 'Y20261007000038', route: '研和 → 北城', cargo: '水泥', location: '北城充电站', triggeredAt: '2026-10-07 08:00:00', recoveredAt: '2026-10-07 11:00:00', sourceStatus: 'recovered', wasTriggered: true, finalLevel: '一般' },
        { soc: 35 }, ['SOC 已恢复至35%', '事件自动恢复'], [
          { action: 'TRIGGERED', level: '一般', at: '2026-10-07 08:00:00', remark: 'SOC 28%' },
          { action: 'LEVEL_UPGRADED', from: '一般', to: '严重', at: '2026-10-07 08:30:00', remark: 'SOC 18%' },
          { action: 'LEVEL_UPGRADED', from: '严重', to: '紧急', at: '2026-10-07 09:00:00', remark: 'SOC 8%' },
          { action: 'LEVEL_DOWNGRADED', from: '紧急', to: '严重', at: '2026-10-07 09:40:00', remark: 'SOC 15%' },
          { action: 'LEVEL_DOWNGRADED', from: '严重', to: '一般', at: '2026-10-07 10:20:00', remark: 'SOC 25%' },
          { action: 'RECOVERED', at: '2026-10-07 11:00:00', remark: 'SOC 35%，所有启用等级均不满足' }
        ]),
      signal({ sourceId: 'history-fatigue-rest', ruleCode: 'DRIVER_FATIGUE', drivingCycleId: 'DC-D033-20261007-02', plate: '云A·H3188', vehicleId: 'V033', driverName: '何平', driverId: 'D033', taskId: 'Y20261007000033', route: '北城 → 研和', cargo: '煤炭', location: '研和停车区', triggeredAt: '2026-10-07 13:42:00', recoveredAt: '2026-10-07 18:25:00', sourceStatus: 'recovered', wasTriggered: true, finalLevel: '严重' },
        { drivingCycleId: 'DC-D033-20261007-02', drivingStartedAt: '2026-10-07 13:42:00', continuousDrivingMinutes: 258, currentSpeed: 0, parkingStartedAt: '2026-10-07 18:00:00', continuousParkingMinutes: 25, driverBindingStartedAt: '2026-10-07 13:40:00', drivingCycleActive: false }, ['车辆连续停车25分钟', '达到有效休息条件', '连续驾驶周期结束'], [
          { action: 'TRIGGERED', level: '一般', at: '2026-10-07 17:12:00', remark: '连续驾驶3小时30分钟' },
          { action: 'LEVEL_UPGRADED', from: '一般', to: '严重', at: '2026-10-07 17:42:00', remark: '连续驾驶4小时' },
          { action: 'RECOVERED', at: '2026-10-07 18:25:00', remark: '车辆连续停车25分钟，达到有效休息条件' }
        ])
    ].map(attachParkingContext);
  }
  function attachParkingContext(item) {
    if (item.ruleCode !== 'TRANSPORT_PARKING') return item;
    var found = PARKING_VEHICLES.filter(function (vehicle) { return vehicle.plate === item.plate; })[0];
    if (found) {
      item.projectId = found.projectId;
      item.projectName = found.projectName;
    }
    item.metrics = item.metrics || {};
    item.metrics.mockSource = 'frontend-demo';
    if (!item.evaluatedAt) {
      if (item.recoveredAt) item.evaluatedAt = item.recoveredAt;
      else if (item.metrics.parkingStartedAt && item.metrics.parkingMinutes != null) item.evaluatedAt = shiftStamp(item.metrics.parkingStartedAt, item.metrics.parkingMinutes);
      else item.evaluatedAt = item.detectedAt || nowText();
    }
    item.metrics.evaluatedAt = item.evaluatedAt;
    item.metrics.staticStartTime = item.metrics.staticStartTime || item.metrics.parkingStartedAt || null;
    return item;
  }

  function enabledLevels(rule) {
    return (rule && rule.levels || []).filter(function (item) { return item.enabled !== false; });
  }
  function highestMatched(rule, matcher) {
    var matched = enabledLevels(rule).filter(matcher).sort(function (a, b) { return levelRank(b.level) - levelRank(a.level); });
    return matched[0] || null;
  }
  function evaluation(level, metrics, facts, extra) {
    extra = extra || {};
    return { triggered: !!level, recovered: extra.recovered === true, level: level ? level.level : null, levelConfig: clone(level), metrics: clone(metrics || {}), facts: clone(facts || []) };
  }
  function parkingFacts(currentSignal, rule, metrics) {
    var m = metrics || currentSignal.metrics || {};
    var detect = (rule && rule.detectConfig) || {};
    var still = Number(detect.stillSpeedKph || 3);
    var excluded = m.loadingScene === true || m.unloadingScene === true || m.charging === true;
    var facts = [
      '车辆正在执行任务 ' + (currentSignal.taskId || '—'),
      '当前处于' + (m.taskNode || '运输途中'),
      m.taskStatus === '执行中' ? '任务单状态为执行中' : '任务单状态不是执行中',
      m.taskBound === true ? '车辆已绑定当前任务' : '车辆未绑定当前任务',
      excluded ? '命中装货、卸货或充电排除场景' : '未处于装货、卸货或充电场景',
      (m.staticStartTime || m.parkingStartedAt ? String(m.staticStartTime || m.parkingStartedAt).slice(11, 16) : '—') + ' 开始持续静止',
      '当前已连续异常停车' + (m.parkingMinutes == null ? '—' : m.parkingMinutes) + '分钟',
      '当前车速：' + (m.speed == null ? '—' : m.speed) + ' km/h（静止阈值 ≤' + still + ' km/h）'
    ];
    var matched = highestMatched(rule, function (item) { return Number(m.parkingMinutes) >= Number(item.threshold); });
    if (matched) facts.push('已超过“' + matched.level + '”告警阈值' + matched.threshold + '分钟');
    return facts;
  }
  function resolveParkingCycle(currentSignal, rule, priorMetrics) {
    var input = Object.assign({}, currentSignal.metrics || {});
    var evalAt = evaluationTime(currentSignal);
    input.evaluatedAt = evalAt;
    var detect = (rule && rule.detectConfig) || defaultParkingDetect();
    var rec = (rule && rule.recoveryConfig) || defaultParkingRecovery();
    var stillSpeed = Number(detect.stillSpeedKph || 3);
    var recoverSpeed = Number(rec.recoverSpeedKph || 5);
    var recoverNeed = Number(rec.recoverDurationMinutes || 3);
    var prior = priorMetrics || {};
    var speed = Number(input.speed);
    var executing = input.taskStatus === '执行中';
    var bound = input.taskBound === true && !!(currentSignal.taskId || input.taskId);
    var excluded = (detect.excludeLoading !== false && input.loadingScene === true)
      || (detect.excludeUnloading !== false && input.unloadingScene === true)
      || (detect.excludeCharging !== false && input.charging === true);
    var inPeriod = inMonitorPeriod(rule, currentSignal);
    var taskEnded = input.taskEnded === true || input.taskStatus === '已结束' || input.taskStatus === '已完成';
    var staticStartTime = prior.staticStartTime || prior.parkingStartedAt || null;
    var recoverCandidateStart = prior.recoverCandidateStart || null;
    var recovered = false;
    var canMonitor = executing && bound && inPeriod && !excluded;
    if (staticStartTime && rec.endOnTaskComplete !== false && (taskEnded || !executing || !bound)) recovered = true;
    if (!recovered && canMonitor && isFinite(speed) && speed <= stillSpeed) {
      if (!staticStartTime) staticStartTime = input.staticStartTime || input.parkingStartedAt || evalAt;
      recoverCandidateStart = null;
    } else if (!recovered && staticStartTime && isFinite(speed) && speed >= recoverSpeed) {
      if (!recoverCandidateStart) {
        recoverCandidateStart = prior.recoverCandidateStart || input.recoverCandidateStart
          || (input.recoverHoldMinutes != null ? shiftStamp(evalAt, -Number(input.recoverHoldMinutes)) : evalAt);
      }
      var hold = minutesBetween(recoverCandidateStart, evalAt);
      if (hold != null && hold >= recoverNeed) recovered = true;
    } else if (!recovered && staticStartTime && isFinite(speed) && speed > stillSpeed) {
      recoverCandidateStart = null;
    } else if (!canMonitor && !staticStartTime) {
      recoverCandidateStart = null;
    }
    var parkingMinutes = staticStartTime ? minutesBetween(staticStartTime, evalAt) : 0;
    if (parkingMinutes == null) {
      parkingMinutes = Number(input.parkingMinutes || 0);
      input.durationSource = 'input-fallback';
    } else {
      input.durationSource = 'cycle';
    }
    input.staticStartTime = staticStartTime;
    input.parkingStartedAt = staticStartTime;
    input.parkingMinutes = parkingMinutes;
    input.recoverCandidateStart = recoverCandidateStart;
    input.recoverHoldMinutes = recoverCandidateStart ? (minutesBetween(recoverCandidateStart, evalAt) || 0) : 0;
    input.cycleClosed = recovered;
    input.evaluatedAt = evalAt;
    return { metrics: input, recovered: recovered, canMonitor: canMonitor };
  }
  function parkingCycleKey(currentSignal) {
    return [currentSignal.vehicleId || currentSignal.plate, currentSignal.taskId || 'NO_TASK'].join('|');
  }
  function loadParkingCycle(currentSignal, active) {
    if (active && active.metrics && active.metrics.staticStartTime) return active.metrics;
    return (state.parkingCycles || {})[parkingCycleKey(currentSignal)] || null;
  }
  function saveParkingCycle(currentSignal, metrics, recovered) {
    state.parkingCycles = state.parkingCycles || {};
    var key = parkingCycleKey(currentSignal);
    if (recovered || !metrics || !metrics.staticStartTime) {
      delete state.parkingCycles[key];
      return;
    }
    state.parkingCycles[key] = {
      staticStartTime: metrics.staticStartTime,
      parkingStartedAt: metrics.staticStartTime,
      recoverCandidateStart: metrics.recoverCandidateStart || null
    };
  }
  function evaluateParking(currentSignal, rule, priorCycle) {
    var resolved = resolveParkingCycle(currentSignal, rule, priorCycle);
    var m = resolved.metrics;
    var facts = parkingFacts(currentSignal, rule, m);
    if (!rule || rule.enabled === false) return evaluation(null, m, facts);
    if (resolved.recovered) return evaluation(null, m, facts, { recovered: true });
    if (!resolved.canMonitor) return evaluation(null, m, facts);
    var detect = rule.detectConfig || defaultParkingDetect();
    if (Number(m.speed) > Number(detect.stillSpeedKph || 3)) return evaluation(null, m, facts);
    if (Number(m.parkingMinutes) < Number(detect.minStillMinutes || 5)) return evaluation(null, m, facts);
    return evaluation(highestMatched(rule, function (item) { return Number(m.parkingMinutes) >= Number(item.threshold); }), m, facts);
  }
  function evaluateParkingArea(currentSignal, rule) {
    var m = currentSignal.metrics || {};
    if (m.insideBusinessArea !== true) return evaluation(null, m, currentSignal.facts);
    return evaluation(highestMatched(rule, function (item) { return Number(m.areaDwellMinutes) >= Number(item.threshold); }), m, currentSignal.facts);
  }
  function evaluateSpeed(currentSignal, rule) {
    var m = currentSignal.metrics || {};
    return evaluation(highestMatched(rule, function (item) {
      return Number(m.speed) >= Number(item.speedThreshold) && Number(m.overspeedDurationSeconds) >= Number(item.durationSeconds);
    }), m, currentSignal.facts);
  }
  function evaluateWeighbill(currentSignal, rule) {
    var m = currentSignal.metrics || {};
    if (m.leftUnload !== true || m.weighbillUploaded !== false) return evaluation(null, m, currentSignal.facts);
    return evaluation(highestMatched(rule, function (item) { return Number(m.waitingMinutes) >= Number(item.threshold); }), m, currentSignal.facts);
  }
  function evaluateSoc(currentSignal, rule) {
    var m = currentSignal.metrics || {};
    return evaluation(highestMatched(rule, function (item) { return Number(m.soc) <= Number(item.threshold); }), m, currentSignal.facts);
  }
  function evaluateFatigue(currentSignal, rule) {
    var m = currentSignal.metrics || {};
    var rest = Number(rule && rule.recoveryConfig && rule.recoveryConfig.restThresholdMinutes || 20);
    if (m.driverChanged === true || m.drivingCycleActive === false || Number(m.continuousParkingMinutes || 0) >= rest) return evaluation(null, m, currentSignal.facts);
    return evaluation(highestMatched(rule, function (item) { return Number(m.continuousDrivingMinutes) >= Number(item.thresholdMinutes); }), m, currentSignal.facts);
  }
  function evaluateSignal(currentSignal, rule, priorCycle) {
    if (!rule) return evaluation(null, currentSignal.metrics, currentSignal.facts);
    switch (rule.code) {
      case 'TRANSPORT_PARKING': return evaluateParking(currentSignal, rule, priorCycle);
      case 'PARKING_AREA': return evaluateParkingArea(currentSignal, rule);
      case 'VEHICLE_OVERSPEED': return evaluateSpeed(currentSignal, rule);
      case 'UNLOAD_WEIGHBILL_MISSING': return evaluateWeighbill(currentSignal, rule);
      case 'VEHICLE_LOW_SOC': return evaluateSoc(currentSignal, rule);
      case 'DRIVER_FATIGUE': return evaluateFatigue(currentSignal, rule);
      default: return evaluation(null, currentSignal.metrics, currentSignal.facts);
    }
  }

  function eventKey(currentSignal) {
    if (currentSignal.ruleCode === 'DRIVER_FATIGUE') return [currentSignal.ruleCode, currentSignal.driverId, currentSignal.drivingCycleId || (currentSignal.metrics || {}).drivingCycleId].join('|');
    return [currentSignal.ruleCode, currentSignal.vehicleId || currentSignal.plate, currentSignal.taskId || 'NO_TASK'].join('|');
  }
  function ruleSnapshot(rule) {
    return {
      ruleId: rule.id, ruleCode: rule.code, ruleName: rule.name, category: rule.category,
      levels: clone(rule.levels), recoveryConfig: clone(rule.recoveryConfig),
      detectConfig: clone(rule.detectConfig || null), monitorPeriod: rule.monitorPeriod || '全天',
      monitorStart: rule.monitorStart || '', monitorEnd: rule.monitorEnd || '',
      scopeType: rule.scopeType || '全部项目', capturedAt: nowText()
    };
  }
  function snapshotRule(snapshot, code) {
    return {
      id: snapshot.ruleId, code: snapshot.ruleCode || code, name: snapshot.ruleName,
      enabled: true, levels: clone(snapshot.levels || []),
      recoveryConfig: clone(snapshot.recoveryConfig || {}),
      detectConfig: clone(snapshot.detectConfig || defaultParkingDetect()),
      monitorPeriod: snapshot.monitorPeriod || '全天',
      monitorStart: snapshot.monitorStart, monitorEnd: snapshot.monitorEnd,
      scopeType: snapshot.scopeType || '全部项目'
    };
  }
  function valueText(currentSignal) {
    var m = currentSignal.metrics || {};
    if (currentSignal.displayValue) return currentSignal.displayValue;
    if (currentSignal.ruleCode === 'TRANSPORT_PARKING') return '连续异常停车' + m.parkingMinutes + '分钟';
    if (currentSignal.ruleCode === 'PARKING_AREA') return '区域停留' + m.areaDwellMinutes + '分钟';
    if (currentSignal.ruleCode === 'VEHICLE_OVERSPEED') return m.speed + ' km/h · ' + m.overspeedDurationSeconds + '秒';
    if (currentSignal.ruleCode === 'UNLOAD_WEIGHBILL_MISSING') return '未上传 · ' + m.waitingMinutes + '分钟';
    if (currentSignal.ruleCode === 'VEHICLE_LOW_SOC') return 'SOC ' + m.soc + '%';
    if (currentSignal.ruleCode === 'DRIVER_FATIGUE') return '连续驾驶' + m.continuousDrivingMinutes + '分钟';
    return '—';
  }
  function eventFromSignal(currentSignal, rule, result, id) {
    var handling = currentSignal.sourceId === 'live-stop';
    var handled = currentSignal.sourceId === 'live-soc' || currentSignal.sourceId === 'live-parking-handled';
    return {
      id: id, sourceId: currentSignal.sourceId, eventKey: eventKey(currentSignal), drivingCycleId: currentSignal.drivingCycleId || (currentSignal.metrics || {}).drivingCycleId || null,
      ruleId: rule.id, ruleCode: rule.code, category: rule.category, type: rule.name,
      initialLevel: (currentSignal.history || []).filter(function (item) { return item.level; })[0] && (currentSignal.history || []).filter(function (item) { return item.level; })[0].level || result.level,
      level: currentSignal.finalLevel || result.level || '一般',
      projectId: currentSignal.projectId || PROJECT_ID,
      projectName: currentSignal.projectName || PROJECT_NAME,
      vehicleId: currentSignal.vehicleId || 'FV-' + String(currentSignal.plate || '').replace(/[^A-Z0-9\u4e00-\u9fa5]/gi, ''), plate: currentSignal.plate,
      driverId: currentSignal.driverId, driverName: currentSignal.driverName, taskId: currentSignal.taskId,
      route: currentSignal.route, cargo: currentSignal.cargo, location: currentSignal.location,
      triggeredAt: (function () {
        var hit = (currentSignal.history || []).filter(function (item) { return item.action === 'TRIGGERED'; })[0];
        return (hit && hit.at) || currentSignal.triggeredAt || currentSignal.detectedAt || nowText();
      })(),
      recoveredAt: currentSignal.recoveredAt || null, currentValueText: valueText(Object.assign({}, currentSignal, { metrics: result.metrics })),
      eventStatus: currentSignal.sourceStatus === 'recovered' ? '已恢复' : '发生中',
      handleStatus: handled ? '已处理' : handling ? '处理中' : '待处理',
      acknowledgedAt: handling ? '2026-10-08 09:06:00' : handled ? '2026-10-08 10:10:00' : null,
      acknowledgedBy: handling || handled ? OPERATOR : null,
      handlerId: handled ? 'U001' : null, handlerName: handled ? OPERATOR : null,
      handlingStartedAt: handled ? '2026-10-08 10:11:00' : null, handledAt: handled ? '2026-10-08 10:13:00' : null,
      handlingType: handled ? (currentSignal.sourceId === 'live-parking-handled' ? '已联系司机' : '安排充电') : null,
      parkingReason: handled && currentSignal.sourceId === 'live-parking-handled' ? '道路拥堵' : null,
      handlingResult: handled ? (currentSignal.sourceId === 'live-parking-handled' ? '已联系司机，车辆因前方事故拥堵临时停车，司机及车辆正常，持续关注。' : '已联系司机前往最近充电站，持续关注车辆电量。') : null,
      ruleSnapshot: ruleSnapshot(rule), metrics: clone(result.metrics), facts: clone(result.facts), lastDetectedAt: evaluationTime(currentSignal)
    };
  }

  function eventId(index) { return 'AL20261008' + String(index + 1).padStart(4, '0'); }
  function logId(index) { return 'LOG20261008' + String(index + 1).padStart(4, '0'); }
  function parkingTriggerRemark(event) {
    var level = event.initialLevel || event.level;
    var matched = ((event.ruleSnapshot || {}).levels || []).filter(function (item) { return item.level === level; })[0];
    return '连续异常停车达到' + ((matched && matched.threshold) || 30) + '分钟，' + level + '告警';
  }
  function addSeedLogs(logs, event, history) {
    (history || []).forEach(function (entry) {
      logs.push({ id: logId(logs.length), alertId: event.id, action: entry.action, operator: entry.operator || '系统', operatedAt: entry.at, remark: entry.remark || '', fromLevel: entry.from || null, toLevel: entry.to || entry.level || null });
    });
    if (!history || !history.length) {
      if (event.ruleCode === 'TRANSPORT_PARKING' && event.metrics && event.metrics.parkingStartedAt) {
        logs.push({ id: logId(logs.length), alertId: event.id, action: 'STILL_STARTED', operator: '系统', operatedAt: event.metrics.parkingStartedAt, remark: '车辆进入持续静止状态' });
      }
      logs.push({ id: logId(logs.length), alertId: event.id, action: 'TRIGGERED', operator: '系统', operatedAt: event.triggeredAt, remark: event.ruleCode === 'TRANSPORT_PARKING' ? parkingTriggerRemark(event) : ('首次达到' + event.level + '等级条件'), toLevel: event.initialLevel || event.level });
    }
    if (event.acknowledgedAt) logs.push({ id: logId(logs.length), alertId: event.id, action: 'ACKNOWLEDGED', operator: event.acknowledgedBy, operatedAt: event.acknowledgedAt, remark: '已知悉告警' });
    if (event.handlingStartedAt) logs.push({ id: logId(logs.length), alertId: event.id, action: 'HANDLING_STARTED', operator: event.handlerName, operatedAt: event.handlingStartedAt, remark: event.handlingType });
    if (event.handledAt) logs.push({
      id: logId(logs.length), alertId: event.id, action: 'HANDLED', operator: event.handlerName, operatedAt: event.handledAt,
      remark: event.ruleCode === 'TRANSPORT_PARKING' && event.parkingReason
        ? ((event.handlingType || '人工处理') + '，' + event.parkingReason + (event.handlingResult ? '。' + event.handlingResult : ''))
        : event.handlingResult
    });
  }
  function seedState() {
    var rules = seedRules();
    migrateVeryOldRules(rules);
    var events = [];
    var logs = [];
    monitorSignals().forEach(function (currentSignal) {
      var rule = resolveRule(rules, currentSignal);
      if (!rule) return;
      var result = evaluateSignal(currentSignal, rule, null);
      if (!currentSignal.wasTriggered && (!rule.enabled || !result.triggered)) return;
      var event = eventFromSignal(currentSignal, rule, result, eventId(events.length));
      events.push(event);
      addSeedLogs(logs, event, currentSignal.history);
    });
    return { version: 4, rules: rules, events: events, logs: logs, parkingCycles: {} };
  }

  function migrateVeryOldRules(rules) {
    var map = { stop: 'TRANSPORT_PARKING', site: 'PARKING_AREA', speed: 'VEHICLE_OVERSPEED', weigh: 'UNLOAD_WEIGHBILL_MISSING', soc: 'VEHICLE_LOW_SOC' };
    try {
      var legacy = JSON.parse(localStorage.getItem(LEGACY_RULE_KEY) || 'null');
      (legacy && legacy.rules || []).forEach(function (oldRule) {
        var next = ruleByCode(rules, map[oldRule.id]);
        if (!next) return;
        next.enabled = oldRule.enabled !== false;
        next.updatedBy = oldRule.modifier || next.updatedBy;
        next.updatedAt = oldRule.modifyTime || next.updatedAt;
      });
    } catch (error) {}
  }
  function thresholdField(code) { return code === 'VEHICLE_OVERSPEED' ? 'speedThreshold' : code === 'DRIVER_FATIGUE' ? 'thresholdMinutes' : 'threshold'; }
  function orderValid(rule) {
    var values = LEVELS.map(function (name) { return Number((levelByName(rule, name) || {})[thresholdField(rule.code)]); });
    if (values.some(function (value) { return !isFinite(value); })) return false;
    return rule.code === 'VEHICLE_LOW_SOC' ? values[0] > values[1] && values[1] > values[2] : values[0] < values[1] && values[1] < values[2];
  }
  function normalizeRule(savedRule, template) {
    if (!savedRule) return clone(template);
    var normalized = Object.assign({}, clone(template), clone(savedRule));
    /* 规则元数据由当前版本统一定义，迁移时只保留用户可配置项和修改记录。 */
    normalized.id = savedRule.id || template.id;
    normalized.code = template.code;
    normalized.name = savedRule.name || template.name;
    normalized.category = template.category;
    normalized.description = savedRule.description || template.description;
    normalized.levels = clone(template.levels);
    if (Array.isArray(savedRule.levels)) {
      normalized.levels = template.levels.map(function (defaultLevel) {
        return Object.assign({}, clone(defaultLevel), clone(levelByName(savedRule, defaultLevel.level) || {}), { level: defaultLevel.level });
      });
    } else if (savedRule.config && isFinite(Number(savedRule.config.threshold))) {
      var targetName = LEVELS.indexOf(savedRule.level) >= 0 ? savedRule.level : '严重';
      var target = levelByName(normalized, targetName);
      var field = thresholdField(normalized.code);
      var oldValue = Number(savedRule.config.threshold);
      if (normalized.code === 'DRIVER_FATIGUE' && savedRule.config.unit === '小时') oldValue *= 60;
      target[field] = oldValue;
      if (!orderValid(normalized)) normalized.levels = clone(template.levels);
    }
    normalized.recoveryConfig = Object.assign({}, clone(template.recoveryConfig), clone(savedRule.recoveryConfig || {}));
    if (normalized.code === 'TRANSPORT_PARKING') {
      normalized.detectConfig = Object.assign({}, clone(template.detectConfig || defaultParkingDetect()), clone(savedRule.detectConfig || {}));
      normalized.monitorPeriod = savedRule.monitorPeriod || template.monitorPeriod || '全天';
      normalized.monitorStart = savedRule.monitorStart || template.monitorStart || '06:00';
      normalized.monitorEnd = savedRule.monitorEnd || template.monitorEnd || '23:00';
      normalized.scopeType = savedRule.scopeType || template.scopeType || '全部项目';
      normalized.projectIds = Array.isArray(savedRule.projectIds) ? clone(savedRule.projectIds) : clone(template.projectIds || []);
      normalized.projectNames = Array.isArray(savedRule.projectNames) ? clone(savedRule.projectNames) : clone(template.projectNames || []);
      normalized.vehiclePlates = Array.isArray(savedRule.vehiclePlates) ? clone(savedRule.vehiclePlates) : clone(template.vehiclePlates || []);
      normalized.recoveryConfig.description = parkingRecoveryText(normalized.recoveryConfig);
    } else {
      normalized.recoveryConfig.description = template.recoveryConfig.description;
    }
    normalized.enabled = savedRule.enabled !== false;
    delete normalized.level;
    delete normalized.config;
    delete normalized.repeatIntervalMinutes;
    return normalized;
  }
  function normalizeSnapshot(snapshot, event, rules) {
    var snap = snapshot && typeof snapshot === 'object' ? clone(snapshot) : {};
    var template = ruleByCode(rules, snap.ruleCode || event.ruleCode) || ruleByCode(seedRules(), event.ruleCode);
    if (!Array.isArray(snap.levels) && template) snap.levels = clone(template.levels);
    if (!snap.recoveryConfig && template) snap.recoveryConfig = clone(template.recoveryConfig);
    snap.ruleId = snap.ruleId || event.ruleId || (template && template.id);
    snap.ruleCode = snap.ruleCode || event.ruleCode;
    snap.ruleName = snap.ruleName || event.type || (template && template.name);
    snap.category = snap.category || event.category || (template && template.category);
    snap.capturedAt = snap.capturedAt || event.triggeredAt || nowText();
    return snap;
  }
  function normalizeEvent(savedEvent, rules) {
    var event = Object.assign({}, savedEvent || {});
    event.metrics = event.metrics && typeof event.metrics === 'object' ? event.metrics : {};
    event.facts = Array.isArray(event.facts) ? event.facts : [];
    event.ruleSnapshot = normalizeSnapshot(event.ruleSnapshot, event, rules);
    event.level = LEVELS.indexOf(event.level) >= 0 ? event.level : (LEVELS.indexOf(event.ruleSnapshot.level) >= 0 ? event.ruleSnapshot.level : '一般');
    event.initialLevel = LEVELS.indexOf(event.initialLevel) >= 0 ? event.initialLevel : event.level;
    return event;
  }
  function mergeSeedHistory(events, logs, seeded) {
    var knownSources = {};
    var usedEventIds = {};
    var usedLogIds = {};
    events.forEach(function (event) { if (event.sourceId) knownSources[event.sourceId] = true; usedEventIds[event.id] = true; });
    logs.forEach(function (log) { usedLogIds[log.id] = true; });
    seeded.events.filter(function (event) { return String(event.sourceId || '').indexOf('history-') === 0; }).forEach(function (seedEvent) {
      if (knownSources[seedEvent.sourceId]) return;
      var event = clone(seedEvent);
      var seedId = event.id;
      if (usedEventIds[event.id]) event.id = seedId + '-DEMO';
      while (usedEventIds[event.id]) event.id += '-1';
      usedEventIds[event.id] = true;
      knownSources[event.sourceId] = true;
      events.push(event);
      seeded.logs.filter(function (log) { return log.alertId === seedId; }).forEach(function (seedLog) {
        var log = clone(seedLog);
        log.alertId = event.id;
        if (usedLogIds[log.id]) log.id = log.id + '-DEMO';
        while (usedLogIds[log.id]) log.id += '-1';
        usedLogIds[log.id] = true;
        logs.push(log);
      });
    });
  }
  function normalize(saved) {
    var seeded = seedState();
    if (!saved || saved.version !== 4) return seeded;
    var savedRules = Array.isArray(saved.rules) ? saved.rules : [];
    var savedById = {};
    savedRules.forEach(function (item) { if (item && item.id) savedById[item.id] = item; });
    var rules = seeded.rules.map(function (template) {
      if (saved.version >= 3) return normalizeRule(savedById[template.id] || (template.code !== 'TRANSPORT_PARKING' ? ruleByCode(savedRules, template.code) : null), template);
      if (template.code === 'TRANSPORT_PARKING' && template.id !== 'RULE_TRANSPORT_PARKING') return clone(template);
      return normalizeRule(ruleByCode(savedRules, template.code), template);
    });
    if (saved.version >= 3) {
      savedRules.forEach(function (savedRule) {
        if (!savedRule || savedRule.code !== 'TRANSPORT_PARKING') return;
        if (rules.some(function (item) { return item.id === savedRule.id; })) return;
        var template = clone(ruleByCode(seeded.rules, 'TRANSPORT_PARKING'));
        template.id = savedRule.id;
        rules.push(normalizeRule(savedRule, template));
      });
    }
    var events = Array.isArray(saved.events) ? saved.events.map(function (event) { return normalizeEvent(event, rules); }) : clone(seeded.events);
    var logs = Array.isArray(saved.logs) ? clone(saved.logs) : clone(seeded.logs);
    mergeSeedHistory(events, logs, seeded);
    return { version: 4, rules: rules, events: events, logs: logs, parkingCycles: saved.parkingCycles && typeof saved.parkingCycles === 'object' ? saved.parkingCycles : {} };
  }
  function load() {
    try { return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); }
    catch (error) { return seedState(); }
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) {}
    window.dispatchEvent(new CustomEvent('hyxy-alerts-changed'));
  }
  function nextEventId() {
    var max = state.events.reduce(function (current, event) { return Math.max(current, Number(String(event.id || '').replace(/\D/g, '').slice(-4)) || 0); }, 0);
    return 'AL' + nowText().slice(0, 10).replace(/-/g, '') + String(max + 1).padStart(4, '0');
  }
  function addLog(alertId, action, remark, options) {
    options = options || {};
    state.logs.push({ id: 'LOG-' + Date.now() + '-' + state.logs.length, alertId: alertId, action: action, operator: options.operator || '系统', operatedAt: options.operatedAt || nowText(), remark: remark || '', fromLevel: options.fromLevel || null, toLevel: options.toLevel || null });
  }
  function activeEventFor(currentSignal) {
    var key = eventKey(currentSignal);
    return state.events.filter(function (event) {
      if (event.eventStatus !== '发生中' || event.ruleCode !== currentSignal.ruleCode) return false;
      if (event.eventKey) return event.eventKey === key;
      if (currentSignal.ruleCode === 'DRIVER_FATIGUE') return event.driverId === currentSignal.driverId && (!event.drivingCycleId || event.drivingCycleId === currentSignal.drivingCycleId);
      return event.plate === currentSignal.plate && event.taskId === currentSignal.taskId;
    })[0] || null;
  }
  function recoveryRemark(currentSignal, rule) {
    var m = currentSignal.metrics || {};
    if (currentSignal.ruleCode === 'TRANSPORT_PARKING') return parkingRecoveryText(rule && rule.recoveryConfig);
    if (currentSignal.ruleCode === 'DRIVER_FATIGUE') {
      if (m.driverChanged) return '车辆驾驶员已发生变更，本次连续驾驶周期结束';
      if (Number(m.continuousParkingMinutes || 0) >= Number(rule.recoveryConfig.restThresholdMinutes || 20)) return '车辆连续停车' + m.continuousParkingMinutes + '分钟，达到有效休息条件';
    }
    return (rule.recoveryConfig || {}).description || '所有启用等级均不满足';
  }
  function updateEvidence(event, currentSignal, result) {
    event.sourceId = currentSignal.sourceId || event.sourceId;
    event.metrics = clone(result.metrics);
    event.facts = clone(result.facts);
    event.currentValueText = valueText(Object.assign({}, currentSignal, { metrics: result.metrics }));
    event.location = currentSignal.location || event.location;
    event.lastDetectedAt = evaluationTime(currentSignal);
  }
  function processSignal(currentSignal, shouldPersist) {
    var currentRule = resolveRule(state.rules, currentSignal);
    var cycleChanged = false;
    if (currentSignal.ruleCode === 'DRIVER_FATIGUE' && currentSignal.driverId && currentSignal.drivingCycleId) {
      state.events.forEach(function (event) {
        if (event.ruleCode !== 'DRIVER_FATIGUE' || event.eventStatus !== '发生中' || event.driverId !== currentSignal.driverId) return;
        if (!event.drivingCycleId || event.drivingCycleId === currentSignal.drivingCycleId) return;
        event.eventStatus = '已恢复';
        event.recoveredAt = currentSignal.detectedAt || nowText();
        addLog(event.id, 'RECOVERED', '检测到新的连续驾驶周期，原驾驶周期已结束', { operatedAt: event.recoveredAt });
        cycleChanged = true;
      });
    }
    var active = activeEventFor(currentSignal);
    var effectiveRule = active ? snapshotRule(active.ruleSnapshot, active.ruleCode) : currentRule;
    var priorCycle = currentSignal.ruleCode === 'TRANSPORT_PARKING' ? loadParkingCycle(currentSignal, active) : null;
    var result = evaluateSignal(currentSignal, effectiveRule, priorCycle);
    if (currentSignal.ruleCode === 'TRANSPORT_PARKING') saveParkingCycle(currentSignal, result.metrics, result.recovered);
    var changed = cycleChanged;
    if (currentSignal.ruleCode === 'TRANSPORT_PARKING' && result.metrics && (result.metrics.staticStartTime || result.recovered)) changed = true;
    var shouldRecover = currentSignal.sourceStatus === 'recovered' || (currentSignal.ruleCode === 'TRANSPORT_PARKING'
      ? result.recovered
      : !result.triggered);
    if (active) {
      updateEvidence(active, currentSignal, result);
      if (shouldRecover) {
        active.eventStatus = '已恢复';
        active.recoveredAt = currentSignal.recoveredAt || currentSignal.detectedAt || nowText();
        addLog(active.id, 'RECOVERED', recoveryRemark(currentSignal, effectiveRule), { operatedAt: active.recoveredAt });
        changed = true;
      } else if (result.triggered && active.level !== result.level) {
        var action = levelRank(result.level) > levelRank(active.level) ? 'LEVEL_UPGRADED' : 'LEVEL_DOWNGRADED';
        var from = active.level;
        active.level = result.level;
        addLog(active.id, action, from + ' → ' + result.level + '；' + valueText(Object.assign({}, currentSignal, { metrics: result.metrics })), { fromLevel: from, toLevel: result.level, operatedAt: evaluationTime(currentSignal) });
        changed = true;
      }
    } else if (currentRule && currentRule.enabled && currentSignal.sourceStatus !== 'recovered' && result.triggered) {
      active = eventFromSignal(currentSignal, currentRule, result, nextEventId());
      active.handleStatus = '待处理';
      active.acknowledgedAt = null;
      active.acknowledgedBy = null;
      active.handlerId = null;
      active.handlerName = null;
      active.handlingStartedAt = null;
      active.handledAt = null;
      active.handlingType = null;
      active.parkingReason = null;
      active.handlingResult = null;
      state.events.unshift(active);
      if (currentSignal.ruleCode === 'TRANSPORT_PARKING' && (result.metrics || {}).staticStartTime) {
        addLog(active.id, 'STILL_STARTED', '车辆进入持续静止状态', { operatedAt: result.metrics.staticStartTime });
      }
      addLog(active.id, 'TRIGGERED', currentSignal.ruleCode === 'TRANSPORT_PARKING'
        ? (valueText(Object.assign({}, currentSignal, { metrics: result.metrics })) + '，' + result.level + '告警')
        : ('首次达到' + result.level + '等级条件；' + valueText(currentSignal)), { toLevel: result.level, operatedAt: evaluationTime(currentSignal) || active.triggeredAt });
      changed = true;
    }
    if (changed && shouldPersist !== false) persist();
    return clone(active);
  }
  function refreshDetection() {
    var before = state.logs.length + ':' + state.events.length;
    monitorSignals().filter(function (item) { return !item.wasTriggered; }).forEach(function (item) { processSignal(item, false); });
    var after = state.logs.length + ':' + state.events.length;
    if (before !== after) persist();
  }
  function parkingConflict(candidate, excludeId) {
    return state.rules.filter(function (item) {
      if (item.code !== 'TRANSPORT_PARKING' || item.enabled === false || item.id === excludeId) return false;
      if ((item.scopeType || '全部项目') !== (candidate.scopeType || '全部项目')) return false;
      if (candidate.scopeType === '全部项目' || !candidate.scopeType) return true;
      if (candidate.scopeType === '指定项目') {
        return (candidate.projectIds || []).some(function (id) { return (item.projectIds || []).indexOf(id) >= 0; });
      }
      return (candidate.vehiclePlates || []).some(function (plate) { return (item.vehiclePlates || []).indexOf(plate) >= 0; });
    })[0] || null;
  }
  function parkingConflictError() {
    return '当前适用范围已存在启用中的停车预警规则，请调整适用范围或停用原规则。';
  }
  function applyParkingPatch(rule, patch) {
    if (patch.name != null) rule.name = String(patch.name).trim() || rule.name;
    if (patch.monitorPeriod) rule.monitorPeriod = patch.monitorPeriod;
    if (patch.monitorStart != null) rule.monitorStart = patch.monitorStart;
    if (patch.monitorEnd != null) rule.monitorEnd = patch.monitorEnd;
    if (patch.detectConfig) rule.detectConfig = Object.assign({}, rule.detectConfig || defaultParkingDetect(), clone(patch.detectConfig));
    if (patch.scopeType) rule.scopeType = patch.scopeType;
    if (Array.isArray(patch.projectIds)) rule.projectIds = clone(patch.projectIds);
    if (Array.isArray(patch.projectNames)) rule.projectNames = clone(patch.projectNames);
    if (Array.isArray(patch.vehiclePlates)) rule.vehiclePlates = clone(patch.vehiclePlates);
    if (rule.scopeType === '全部项目') { rule.projectIds = []; rule.projectNames = []; rule.vehiclePlates = []; }
    if (rule.scopeType === '指定项目') rule.vehiclePlates = [];
    if (rule.scopeType === '指定车辆') { rule.projectIds = []; rule.projectNames = []; }
  }
  function updateRule(id, patch) {
    var rule = state.rules.filter(function (item) { return item.id === id; })[0];
    if (!rule) return null;
    patch = patch || {};
    var nextEnabled = patch.enabled != null ? !!patch.enabled : rule.enabled;
    if (rule.code === 'TRANSPORT_PARKING') {
      var candidate = clone(rule);
      applyParkingPatch(candidate, patch);
      candidate.enabled = nextEnabled;
      if (candidate.enabled && parkingConflict(candidate, id)) return { error: parkingConflictError() };
      applyParkingPatch(rule, patch);
    } else {
      if (patch.scopeType) rule.scopeType = patch.scopeType;
      rule.projectIds = patch.scopeType === '指定项目' ? [PROJECT_ID] : (rule.projectIds || []);
    }
    if (patch.enabled != null) rule.enabled = nextEnabled;
    if (Array.isArray(patch.levels)) rule.levels = clone(patch.levels);
    if (patch.recoveryConfig) {
      rule.recoveryConfig = Object.assign({}, rule.recoveryConfig, clone(patch.recoveryConfig));
      if (rule.code === 'TRANSPORT_PARKING') rule.recoveryConfig.description = parkingRecoveryText(rule.recoveryConfig);
    }
    delete rule.level;
    delete rule.config;
    delete rule.repeatIntervalMinutes;
    rule.updatedBy = OPERATOR;
    rule.updatedAt = nowText();
    persist();
    refreshDetection();
    return clone(rule);
  }
  function addParkingRule(patch) {
    var template = clone(ruleByCode(seedRules(), 'TRANSPORT_PARKING'));
    template.id = 'RULE_TRANSPORT_PARKING_' + Date.now();
    template.name = (patch && patch.name) || '停车超时预警';
    template.enabled = true;
    template.scopeType = (patch && patch.scopeType) || '指定项目';
    template.projectIds = [];
    template.projectNames = [];
    template.vehiclePlates = [];
    applyParkingPatch(template, patch || {});
    if (template.enabled && parkingConflict(template, null)) return { error: parkingConflictError() };
    template.updatedBy = OPERATOR;
    template.updatedAt = nowText();
    state.rules.push(template);
    persist();
    return clone(template);
  }
  function removeRule(id) {
    var rule = state.rules.filter(function (item) { return item.id === id; })[0];
    if (!rule) return { error: '未找到规则' };
    if (rule.code !== 'TRANSPORT_PARKING') return { error: '仅支持删除停车预警规则' };
    if (rule.id === 'RULE_TRANSPORT_PARKING') return { error: '默认全部项目规则不能删除，可停用' };
    state.rules = state.rules.filter(function (item) { return item.id !== id; });
    persist();
    return { ok: true };
  }
  function acknowledge(id) {
    var event = state.events.filter(function (item) { return item.id === id; })[0];
    if (!event || event.handleStatus !== '待处理') return clone(event);
    event.handleStatus = '处理中';
    event.acknowledgedAt = nowText();
    event.acknowledgedBy = OPERATOR;
    addLog(event.id, 'ACKNOWLEDGED', '已知悉告警', { operator: OPERATOR });
    persist();
    return clone(event);
  }
  function handle(id, type, result, extra) {
    var event = state.events.filter(function (item) { return item.id === id; })[0];
    if (!event) return null;
    extra = extra || {};
    var time = nowText();
    if (!event.acknowledgedAt) {
      event.acknowledgedAt = time;
      event.acknowledgedBy = OPERATOR;
      addLog(event.id, 'ACKNOWLEDGED', '处理时自动知悉告警', { operator: OPERATOR, operatedAt: time });
    }
    if (!event.handlingStartedAt) {
      event.handlingStartedAt = time;
      addLog(event.id, 'HANDLING_STARTED', type, { operator: OPERATOR, operatedAt: time });
    }
    event.handleStatus = '已处理';
    event.handlerId = 'U001';
    event.handlerName = OPERATOR;
    event.handledAt = time;
    event.handlingType = type;
    event.parkingReason = event.ruleCode === 'TRANSPORT_PARKING' ? (extra.parkingReason || null) : event.parkingReason;
    event.handlingResult = result;
    addLog(event.id, 'HANDLED', event.ruleCode === 'TRANSPORT_PARKING' && event.parkingReason
      ? (type + '，' + event.parkingReason + '。' + result)
      : result, { operator: OPERATOR, operatedAt: time });
    persist();
    return clone(event);
  }
  function logsFor(id) {
    return state.logs.filter(function (item) { return item.alertId === id; }).sort(function (a, b) { return String(a.operatedAt).localeCompare(String(b.operatedAt)); });
  }

  state = load();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) {}
  refreshDetection();

  window.AlertCenterStore = {
    getRules: function () { return clone(state.rules); },
    getRule: function (id) { return clone(state.rules.filter(function (item) { return item.id === id; })[0] || null); },
    getProjects: function () { return clone(PROJECTS); },
    getParkingVehicles: function () { return clone(PARKING_VEHICLES); },
    updateRule: updateRule,
    addParkingRule: addParkingRule,
    getParkingDraftTemplate: parkingDraftTemplate,
    removeRule: removeRule,
    getEvents: function () { refreshDetection(); return clone(state.events); },
    getEvent: function (id) { return clone(state.events.filter(function (item) { return item.id === id; })[0] || null); },
    getLogs: function (id) { return clone(logsFor(id)); },
    acknowledge: acknowledge,
    handle: handle,
    detectSignal: function (currentSignal) { return processSignal(clone(currentSignal), true); },
    refresh: function () { refreshDetection(); return clone(state.events); },
    operator: OPERATOR,
    levelRank: levelRank
  };
})();
