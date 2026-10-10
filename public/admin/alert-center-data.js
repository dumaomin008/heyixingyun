/* 统一告警数据层：六类多级规则、事件升降级、恢复、处理与 Demo 持久化。 */
(function () {
  'use strict';

  var STORAGE_KEY = 'hyxy-alert-center-v1';
  var LEGACY_RULE_KEY = 'hyxy-warning-rules-v1';
  var OPERATOR = '李调度';
  var PROJECT_ID = 'YX001';
  var PROJECT_NAME = '玉溪项目';
  var LEVELS = ['一般', '严重', '紧急'];
  var AREA_STAY_CODE = 'AREA_STAY_TIMEOUT';
  var AREA_STAY_LEGACY = 'PARKING_AREA';
  var AREA_TYPES = ['装货区', '卸货区', '充电站', '停车区', '中转区', '其他'];
  var AREA_RELATION_TEXT = { LOAD: '装货地', UNLOAD: '卸货地', TRANSIT: '途经区域', NON_TASK: '非任务区域', UNKNOWN: '未识别' };
  var AREA_STAY_DEBOUNCE_MIN = 3;
  var PROJECTS = [
    { id: 'YX001', name: '玉溪项目', departmentName: '运营一部' },
    { id: 'JH001', name: '景洪项目', departmentName: '运营二部' }
  ];
  var AREA_STAY_FENCES = [
    { id: 'F-LOAD-DKM', name: '大开门装货区', type: '装货区', projectId: 'YX001', projectName: '玉溪项目' },
    { id: 'F-LOAD-KG', name: '昆钢装货区', type: '装货区', projectId: 'YX001', projectName: '玉溪项目' },
    { id: 'F-UNLOAD-BC', name: '北城卸货区', type: '卸货区', projectId: 'YX001', projectName: '玉溪项目' },
    { id: 'F-UNLOAD-YH', name: '研和卸货区', type: '卸货区', projectId: 'YX001', projectName: '玉溪项目' },
    { id: 'F-CHARGE-DKM', name: '大开门充电站', type: '充电站', projectId: 'YX001', projectName: '玉溪项目' },
    { id: 'F-CHARGE-BC', name: '北城充电站', type: '充电站', projectId: 'YX001', projectName: '玉溪项目' },
    { id: 'F-PARK-YH', name: '研和停车区', type: '停车区', projectId: 'YX001', projectName: '玉溪项目' },
    { id: 'F-TRANSIT-YH', name: '研和中转区', type: '中转区', projectId: 'YX001', projectName: '玉溪项目' },
    { id: 'F-UNLOAD-JH', name: '景洪水泥卸货网点', type: '卸货区', projectId: 'JH001', projectName: '景洪项目' }
  ];
  function departmentOfProject(projectId) {
    var found = PROJECTS.filter(function (item) { return item.id === projectId; })[0];
    return (found && found.departmentName) || '运营一部';
  }
  function isAreaStayCode(code) {
    return code === AREA_STAY_CODE || code === AREA_STAY_LEGACY;
  }
  function fenceById(id) {
    return AREA_STAY_FENCES.filter(function (item) { return item.id === id; })[0] || null;
  }
  function fenceByName(name) {
    return AREA_STAY_FENCES.filter(function (item) { return item.name === name; })[0] || null;
  }
  function transportStageText(taskNode) {
    var node = String(taskNode || '');
    if (!node) return '—';
    if (node === '待开始' || node.indexOf('待开始') >= 0) return '待开始';
    if (node.indexOf('前往装货') >= 0) return '前往装货地';
    if (node.indexOf('装货') >= 0) return '装货等待/装货中';
    if (node.indexOf('卸货') >= 0) return '卸货等待/卸货中';
    if (node === '已完成' || node.indexOf('完成') >= 0) return '已完成';
    if (node.indexOf('运输') >= 0 || node.indexOf('途中') >= 0 || node.indexOf('充电') >= 0) return '运输中';
    return '—';
  }
  function areaRelationText(code) {
    return AREA_RELATION_TEXT[code] || AREA_RELATION_TEXT.UNKNOWN;
  }
  function areaStayPriority(rule) {
    if ((rule.fenceIds || []).length) return 4;
    if (rule.areaType && rule.areaType !== '全部类型') return 3;
    if (rule.scopeType === '指定项目' || (rule.projectIds || []).length) return 2;
    return 1;
  }
  function areaStayPriorityName(rule) {
    var rank = areaStayPriority(rule);
    return rank === 4 ? '指定围栏规则' : rank === 3 ? '区域类型规则' : rank === 2 ? '项目默认规则' : '系统默认规则';
  }
  function defaultAreaStayRecovery() {
    return { description: '车辆离开产生告警的业务区域' };
  }
  function areaStayRule(id, name, extra) {
    extra = extra || {};
    return {
      id: id, code: AREA_STAY_CODE, name: name, category: '作业',
      alertType: AREA_STAY_CODE, enabled: extra.enabled !== false,
      description: extra.description || '车辆进入电子围栏后持续未离开，停留时长达到分级阈值时触发',
      scopeType: extra.scopeType || '全部项目',
      projectIds: clone(extra.projectIds || []),
      projectNames: clone(extra.projectNames || []),
      areaType: extra.areaType || '全部类型',
      fenceIds: clone(extra.fenceIds || []),
      fenceNames: clone(extra.fenceNames || []),
      notifyConfig: { reserved: true, channels: ['站内消息', '调度工作台', '运输监控大屏', '企业微信', '短信', '司机端提醒'] },
      levels: extra.levels || [durationLevel('一般', 60), durationLevel('严重', 120), durationLevel('紧急', 180)],
      recoveryConfig: defaultAreaStayRecovery(),
      updatedBy: extra.updatedBy || '系统预置',
      updatedAt: extra.updatedAt || '2026-10-08 09:00:00'
    };
  }
  /* 规则适用范围候选；判定逻辑不按车牌写死。 */
  var PARKING_VEHICLES = [
    { plate: '云A·D8021', projectId: 'YX001', projectName: '玉溪项目', departmentId: 'ops-1', departmentName: '运营一部' },
    { plate: '云A·E1936', projectId: 'YX001', projectName: '玉溪项目', departmentId: 'ops-1', departmentName: '运营一部' },
    { plate: '云A·F4470', projectId: 'YX001', projectName: '玉溪项目', departmentId: 'ops-1', departmentName: '运营一部' },
    { plate: '云A·G2288', projectId: 'YX001', projectName: '玉溪项目', departmentId: 'ops-1', departmentName: '运营一部' },
    { plate: '云A·H3188', projectId: 'YX001', projectName: '玉溪项目', departmentId: 'ops-1', departmentName: '运营一部' },
    { plate: '云A·H6612', projectId: 'YX001', projectName: '玉溪项目', departmentId: 'ops-1', departmentName: '运营一部' },
    { plate: '云A·K4419', projectId: 'JH001', projectName: '景洪项目', departmentId: 'ops-2', departmentName: '运营二部' },
    { plate: '云A·J5501', projectId: 'JH001', projectName: '景洪项目', departmentId: 'ops-2', departmentName: '运营二部' },
    { plate: '云A·S1008', projectId: 'YX001', projectName: '玉溪项目', departmentId: 'ops-1', departmentName: '运营一部' }
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
  function demoDay(dayOffset, hm) {
    var date = new Date();
    date.setDate(date.getDate() + Number(dayOffset || 0));
    var bits = String(hm || '00:00:00').split(':');
    date.setHours(Number(bits[0] || 0), Number(bits[1] || 0), Number(bits[2] || 0), 0);
    return formatStamp(date.getTime());
  }
  function isLateRuleCode(code) {
    return code === 'UNLOAD_WEIGHBILL_MISSING' || code === 'VEHICLE_LOW_SOC' || code === 'DRIVER_FATIGUE';
  }
  function minutesBetween(start, end) {
    var a = parseStamp(start);
    var b = parseStamp(end);
    if (!isFinite(a) || !isFinite(b)) return null;
    return Math.max(0, Math.round((b - a) / 60000));
  }
  function secondsBetween(start, end) {
    var a = parseStamp(start);
    var b = parseStamp(end);
    if (!isFinite(a) || !isFinite(b)) return 0;
    return Math.max(0, Math.round((b - a) / 1000));
  }
  var SPEED_CLOCK = Date.now();
  function ago(seconds) { return formatStamp(SPEED_CLOCK - Number(seconds) * 1000); }
  function formatDuration(seconds) {
    var total = Math.max(0, Math.round(Number(seconds) || 0));
    if (total < 120) return total + '秒';
    var minutes = Math.floor(total / 60);
    var remain = total % 60;
    if (minutes < 60) return remain ? (minutes + '分' + remain + '秒') : (minutes + '分钟');
    var hours = Math.floor(minutes / 60);
    var minuteRemain = minutes % 60;
    return minuteRemain ? (hours + '小时' + minuteRemain + '分钟') : (hours + '小时');
  }
  function formatSpeed(value) {
    var number = Number(value);
    if (!isFinite(number)) return '—';
    var rounded = Math.round(number * 10) / 10;
    var text = Math.abs(rounded - Math.round(rounded)) < 0.05 ? String(Math.round(rounded)) : String(rounded);
    return text + ' km/h';
  }
  function speedSourceLabel(code) {
    if (code === 'GPS') return 'GPS 速度';
    if (code === 'CAN') return '车辆 CAN/T-BOX';
    return '—';
  }
  function speedPolicyLabel(code) {
    if (code === 'CAN') return '车辆 CAN/T-BOX 速度';
    if (code === 'GPS') return 'GPS 速度';
    return '优先车辆 CAN/T-BOX，缺失时使用 GPS';
  }
  function speedRecoveryText(config) {
    var speed = Number((config || {}).recoverSpeedKph);
    if (!isFinite(speed)) speed = 75;
    var seconds = Number((config || {}).recoverDurationSeconds);
    if (!isFinite(seconds) || seconds <= 0) seconds = 30;
    return '车速 ≤ ' + speed + ' km/h，持续 ≥ ' + formatDuration(seconds);
  }
  function defaultSpeedRecovery() {
    var config = { recoverSpeedKph: 75, recoverDurationSeconds: 30 };
    config.description = speedRecoveryText(config);
    return config;
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
  function speedLevel(level, speed, seconds, unit) {
    return { level: level, enabled: true, speedThreshold: speed, durationSeconds: seconds, durationUnit: unit || '秒' };
  }
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
  function inMonitorPeriod(rule, evaluatedAt) {
    if (!rule || rule.monitorPeriod !== '自定义') return true;
    var hm = clockHm(typeof evaluatedAt === 'string' ? evaluatedAt : evaluationTime(evaluatedAt || {}));
    if (!hm) return true;
    var start = rule.monitorStart || '00:00';
    var end = rule.monitorEnd || '23:59';
    if (start <= end) return hm >= start && hm <= end;
    return hm >= start || hm <= end;
  }
  function vehicleByPlate(plate) {
    return PARKING_VEHICLES.filter(function (item) { return item.plate === plate; })[0] || null;
  }
  function matchParkingRule(rules, currentSignal) {
    var list = rulesByCode(rules, 'TRANSPORT_PARKING').filter(function (item) { return item.enabled; });
    var plate = currentSignal.plate;
    var projectId = currentSignal.projectId || PROJECT_ID;
    var vehicle = vehicleByPlate(plate);
    var departmentId = (currentSignal && currentSignal.departmentId) || (vehicle && vehicle.departmentId) || '';
    var departmentName = (currentSignal && currentSignal.departmentName) || (vehicle && vehicle.departmentName) || '';
    var vehicleHit = list.filter(function (item) {
      return (item.scopeType === '指定车辆' || item.scopeType === '自定义车辆') && (item.vehiclePlates || []).indexOf(plate) >= 0;
    });
    if (vehicleHit.length) return vehicleHit[0];
    var departmentHit = list.filter(function (item) {
      if (item.scopeType !== '组织部门') return false;
      if (departmentId && (item.departmentIds || []).indexOf(departmentId) >= 0) return true;
      return !!(departmentName && (item.departmentNames || []).indexOf(departmentName) >= 0);
    });
    if (departmentHit.length) return departmentHit[0];
    var projectHit = list.filter(function (item) {
      return item.scopeType === '指定项目' && (item.projectIds || []).indexOf(projectId) >= 0;
    });
    if (projectHit.length) return projectHit[0];
    return list.filter(function (item) { return item.scopeType === '全部项目' || !item.scopeType; })[0] || null;
  }
  function areaStaySignalFence(currentSignal) {
    var metrics = (currentSignal && currentSignal.metrics) || {};
    return fenceById(metrics.fenceId) || fenceByName(metrics.fenceName || (currentSignal && currentSignal.location)) || {
      id: metrics.fenceId || '',
      name: metrics.fenceName || (currentSignal && currentSignal.location) || '',
      type: metrics.fenceType || '',
      projectId: currentSignal && currentSignal.projectId,
      projectName: currentSignal && currentSignal.projectName
    };
  }
  function areaStayRuleMatches(rule, currentSignal) {
    if (!rule || rule.enabled === false) return false;
    var fence = areaStaySignalFence(currentSignal);
    var projectId = currentSignal.projectId || (fence && fence.projectId) || PROJECT_ID;
    if (rule.scopeType === '指定项目') {
      if ((rule.projectIds || []).indexOf(projectId) < 0) return false;
    }
    if (rule.areaType && rule.areaType !== '全部类型' && rule.areaType !== fence.type) return false;
    if ((rule.fenceIds || []).length && (rule.fenceIds || []).indexOf(fence.id) < 0) return false;
    return true;
  }
  function matchAreaStayRule(rules, currentSignal) {
    var list = rulesByCode(rules, AREA_STAY_CODE).concat(rulesByCode(rules, AREA_STAY_LEGACY))
      .filter(function (item) { return areaStayRuleMatches(item, currentSignal); })
      .sort(function (a, b) { return areaStayPriority(b) - areaStayPriority(a); });
    return list[0] || null;
  }
  function speedPriority(rule) {
    return rule && rule.scopeType === '指定项目' ? 2 : 1;
  }
  function speedRuleMatches(rule, currentSignal) {
    if (!rule || rule.enabled === false) return false;
    if (rule.scopeType === '指定项目') {
      var vehicle = vehicleByPlate(currentSignal.plate);
      var projectId = currentSignal.projectId || (vehicle && vehicle.projectId) || '';
      return (rule.projectIds || []).indexOf(projectId) >= 0;
    }
    return true;
  }
  function matchSpeedRule(rules, currentSignal) {
    return rulesByCode(rules, 'VEHICLE_OVERSPEED').filter(function (item) {
      return speedRuleMatches(item, currentSignal);
    }).sort(function (a, b) { return speedPriority(b) - speedPriority(a); })[0] || null;
  }
  function matchProjectRule(rules, code, currentSignal) {
    var list = rulesByCode(rules, code).filter(function (item) { return item.enabled !== false; });
    var vehicle = vehicleByPlate(currentSignal.plate);
    var projectId = currentSignal.projectId || (vehicle && vehicle.projectId) || '';
    var specified = list.filter(function (item) {
      return item.scopeType === '指定项目' && (item.projectIds || []).indexOf(projectId) >= 0;
    });
    if (specified.length) return specified[0];
    return list.filter(function (item) { return item.scopeType !== '指定项目'; })[0] || null;
  }
  function resolveRule(rules, currentSignal) {
    if (currentSignal.ruleCode === 'TRANSPORT_PARKING') return matchParkingRule(rules, currentSignal);
    if (isAreaStayCode(currentSignal.ruleCode)) return matchAreaStayRule(rules, currentSignal);
    if (currentSignal.ruleCode === 'VEHICLE_OVERSPEED') return matchSpeedRule(rules, currentSignal);
    if (isLateRuleCode(currentSignal.ruleCode)) return matchProjectRule(rules, currentSignal.ruleCode, currentSignal);
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
      areaStayRule('RULE_AREA_STAY', '系统默认区域停留预警', {
        description: '全部项目、全部区域类型的系统默认规则，优先级最低'
      }),
      areaStayRule('RULE_AREA_STAY_LOAD', '装货区停留预警', {
        areaType: '装货区',
        description: '装货区差异化阈值：60 / 120 / 180 分钟',
        levels: [durationLevel('一般', 60), durationLevel('严重', 120), durationLevel('紧急', 180)]
      }),
      areaStayRule('RULE_AREA_STAY_UNLOAD', '卸货区停留预警', {
        areaType: '卸货区',
        description: '卸货区差异化阈值：60 / 90 / 120 分钟',
        levels: [durationLevel('一般', 60), durationLevel('严重', 90), durationLevel('紧急', 120)]
      }),
      areaStayRule('RULE_AREA_STAY_CHARGE', '充电站停留预警', {
        areaType: '充电站',
        description: '充电站差异化阈值：120 / 180 / 240 分钟',
        levels: [durationLevel('一般', 120), durationLevel('严重', 180), durationLevel('紧急', 240)]
      }),
      areaStayRule('RULE_AREA_STAY_KG_LOAD', '昆钢装货区停留预警', {
        fenceIds: ['F-LOAD-KG'], fenceNames: ['昆钢装货区'],
        areaType: '装货区',
        description: '指定围栏覆盖装货区规则：120 / 180 / 240 分钟',
        levels: [durationLevel('一般', 120), durationLevel('严重', 180), durationLevel('紧急', 240)]
      }),
      areaStayRule('RULE_AREA_STAY_YX', '玉溪项目-卸货区域停留预警', {
        scopeType: '指定项目', projectIds: ['YX001'], projectNames: ['玉溪项目'],
        description: '玉溪项目默认规则，优先级低于区域类型与指定围栏'
      }),
      {
        id: 'RULE_VEHICLE_OVERSPEED', code: 'VEHICLE_OVERSPEED', name: '系统默认车速预警', category: '车辆', enabled: true,
        description: '同一段连续超速只保留一条告警，等级只升不降；车速回到恢复阈值并持续满足后自动恢复',
        scopeType: '全部项目', projectIds: [], projectNames: [], speedSourcePolicy: 'CAN_THEN_GPS',
        levels: [speedLevel('一般', 80, 60), speedLevel('严重', 90, 60), speedLevel('紧急', 100, 60)],
        recoveryConfig: defaultSpeedRecovery(), updatedBy: '系统预置', updatedAt: '2026-10-10 09:00:00'
      },
      {
        id: 'RULE_VEHICLE_OVERSPEED_JH', code: 'VEHICLE_OVERSPEED', name: '景洪项目车速预警', category: '车辆', enabled: true,
        description: '指定项目覆盖默认规则，用于演示项目差异化阈值',
        scopeType: '指定项目', projectIds: ['JH001'], projectNames: ['景洪项目'], speedSourcePolicy: 'CAN_THEN_GPS',
        levels: [speedLevel('一般', 80, 60), speedLevel('严重', 90, 60), speedLevel('紧急', 100, 60)],
        recoveryConfig: defaultSpeedRecovery(), updatedBy: '系统预置', updatedAt: '2026-10-10 09:00:00'
      },
      {
        id: 'RULE_UNLOAD_WEIGHBILL_MISSING', code: 'UNLOAD_WEIGHBILL_MISSING', name: '卸货后未上传磅单', category: '单据', enabled: true,
        description: '车辆已完成卸货并离开卸货区域，超过补录窗口后卸货磅单仍未提交',
        scopeType: '全部项目', projectIds: [], projectNames: [],
        detectConfig: { triggerNode: '离开卸货地', weighbillStatus: '未上传', ignoreUploading: true },
        levels: [durationLevel('一般', 15), durationLevel('严重', 30), durationLevel('紧急', 60)],
        recoveryConfig: { description: '磅单上传成功或确认无需磅单' }, updatedBy: '系统预置', updatedAt: '2026-10-10 09:00:00'
      },
      {
        id: 'RULE_VEHICLE_LOW_SOC', code: 'VEHICLE_LOW_SOC', name: 'SOC预警', category: '车辆', enabled: true,
        description: '有效 SOC 持续低于分级阈值并完成确认后触发；充电后须达到恢复阈值才关闭',
        scopeType: '全部项目', projectIds: [], projectNames: [],
        confirmConfig: { confirmMinutes: 2, dataValidMinutes: 5 },
        levels: [durationLevel('一般', 30), durationLevel('严重', 20), durationLevel('紧急', 10)],
        recoveryConfig: { recoverSoc: 35, recoverDurationMinutes: 2, description: 'SOC ≥ 35% 持续 ≥ 2分钟' },
        updatedBy: '系统预置', updatedAt: '2026-10-10 09:00:00'
      },
      {
        id: 'RULE_DRIVER_FATIGUE', code: 'DRIVER_FATIGUE', name: '疲劳驾驶预警', category: '安全', enabled: true,
        description: '以司机连续驾驶周期判断疲劳风险；短停不重置，达到有效休息或更换司机后结束',
        scopeType: '全部项目', projectIds: [], projectNames: [],
        detectConfig: { drivingSpeedKph: 5, dataValidMinutes: 5 },
        levels: [fatigueLevel('一般', 210), fatigueLevel('严重', 240), fatigueLevel('紧急', 270)],
        recoveryConfig: { description: '连续非驾驶达到有效休息时长，或驾驶员发生变更', restThresholdMinutes: 20 },
        updatedBy: '系统预置', updatedAt: '2026-10-10 09:00:00'
      }
    ];
  }
  function parkingDraftTemplate() {
    var template = clone(ruleByCode(seedRules(), 'TRANSPORT_PARKING'));
    template.id = '__parking_draft';
    template.isDraft = true;
    template.name = '';
    template.enabled = true;
    template.scopeType = '组织部门';
    template.projectIds = [];
    template.projectNames = [];
    template.departmentIds = [];
    template.departmentNames = [];
    template.vehiclePlates = [];
    template.updatedBy = '';
    template.updatedAt = '';
    return template;
  }
  function speedDraftTemplate() {
    var template = clone(ruleByCode(seedRules(), 'VEHICLE_OVERSPEED'));
    template.id = '__speed_draft';
    template.isDraft = true;
    template.name = '';
    template.enabled = true;
    template.scopeType = '全部项目';
    template.projectIds = [];
    template.projectNames = [];
    template.speedSourcePolicy = 'CAN_THEN_GPS';
    template.levels = [speedLevel('一般', 80, 60), speedLevel('严重', 90, 60), speedLevel('紧急', 100, 60)];
    template.recoveryConfig = defaultSpeedRecovery();
    template.updatedBy = '';
    template.updatedAt = '';
    return template;
  }
  function lateRuleTemplate(code) {
    var template = clone(ruleByCode(seedRules(), code));
    template.id = '__draft_' + code;
    template.isDraft = true;
    template.name = '';
    template.enabled = true;
    template.scopeType = '全部项目';
    template.projectIds = [];
    template.projectNames = [];
    template.updatedBy = '';
    template.updatedAt = '';
    return template;
  }
  function weighbillDraftTemplate() { return lateRuleTemplate('UNLOAD_WEIGHBILL_MISSING'); }
  function socDraftTemplate() { return lateRuleTemplate('VEHICLE_LOW_SOC'); }
  function fatigueDraftTemplate() { return lateRuleTemplate('DRIVER_FATIGUE'); }
  function areaStayDraftTemplate() {
    var template = clone(ruleByCode(seedRules(), AREA_STAY_CODE));
    template.id = '__area_stay_draft';
    template.isDraft = true;
    template.name = '';
    template.enabled = true;
    template.scopeType = '全部项目';
    template.projectIds = [];
    template.projectNames = [];
    template.areaType = '全部类型';
    template.fenceIds = [];
    template.fenceNames = [];
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
  function speedPoint(secondsAgo, speed, source) {
    return { at: ago(secondsAgo), speed: speed, source: source || 'CAN', gpsQuality: 5 };
  }
  function speedChain(startAgo, parts) {
    var samples = [];
    var cursor = startAgo;
    parts.forEach(function (part, index) {
      var begin = index === 0 ? cursor : cursor - 10;
      var end = begin - part.seconds;
      for (var at = begin; at >= end; at -= 10) samples.push(speedPoint(at, part.speed, part.source));
      cursor = end;
    });
    return samples;
  }
  function speedEpisode(base, parts, extra) {
    extra = extra || {};
    var source = extra.source || 'CAN';
    return signal(Object.assign({
      ruleCode: 'VEHICLE_OVERSPEED',
      projectId: 'YX001',
      projectName: '玉溪项目',
      sourceStatus: extra.recovered ? 'recovered' : 'active',
      live: extra.live !== false && !extra.recovered,
      wasTriggered: !!extra.recovered
    }, base), {
      samples: speedChain(extra.startAgo, parts.map(function (part) {
        return { seconds: part.seconds, speed: part.speed, source: part.source || source };
      }))
    }, [], []);
  }
  function buildSpeedSignals() {
    var handledAt = ago(360);
    var falseAt = ago(3600);
    return [
      speedEpisode({
        sourceId: 'speed-live-critical', plate: '云A·E1936', driverName: '王磊', driverId: 'D022', taskId: 'Y20260904000022',
        route: '北城 → 研和', cargo: '铁精粉', location: 'G8511 昆磨高速'
      }, [
        { seconds: 70, speed: 82 }, { seconds: 70, speed: 95 }, { seconds: 20, speed: 112 }, { seconds: 80, speed: 105 }
      ], { startAgo: 960, live: true }),
      speedEpisode({
        sourceId: 'speed-live-handled', plate: '云A·D8021', driverName: '李宏俊', driverId: 'D021', taskId: 'Y20260904000021',
        route: '大开门 → 昆钢', cargo: '水渣', location: '昆磨高速辅路',
        seedHandleStatus: '已处理',
        seedHandle: [{ handleTime: handledAt, handler: OPERATOR, handleType: '电话提醒司机', handleResult: '已电话提醒司机立即降速，司机确认收到。', falseAlarmReason: '', markDone: true }]
      }, [
        { seconds: 70, speed: 83 }, { seconds: 70, speed: 96 }, { seconds: 70, speed: 108 }
      ], { startAgo: 720, live: true }),
      speedEpisode({
        sourceId: 'speed-hysteresis', plate: '云A·H3188', driverName: '何平', driverId: 'D033', taskId: 'Y20260904000033',
        route: '北城 → 研和', cargo: '煤炭', location: '昆磨高速'
      }, [
        { seconds: 70, speed: 82 }, { seconds: 70, speed: 95 }, { seconds: 120, speed: 78 }
      ], { startAgo: 520, live: true }),
      speedEpisode({
        sourceId: 'speed-again-active', plate: '云A·G2288', driverName: '张建华', driverId: 'D024', taskId: 'Y20261010000024',
        route: '大开门 → 北城', cargo: '水渣', location: '玉溪北出口'
      }, [
        { seconds: 90, speed: 85 }
      ], { startAgo: 180, live: true }),
      speedEpisode({
        sourceId: 'speed-recovered-pending', plate: '云A·F4470', driverName: '马旺', driverId: 'D023', taskId: 'Y20260904000023',
        route: '昆钢 → 北城', cargo: '煤炭', location: '昆钢厂区外侧'
      }, [
        { seconds: 70, speed: 84 }, { seconds: 40, speed: 70 }
      ], { startAgo: 2800, recovered: true, live: false }),
      speedEpisode({
        sourceId: 'speed-recovered-handled', plate: '云A·G2288', driverName: '张建华', driverId: 'D024', taskId: 'Y20261007000024',
        route: '大开门 → 北城', cargo: '水渣', location: '昆钢厂区外侧',
        seedHandleStatus: '已处理',
        seedHandle: [{ handleTime: ago(7400), handler: OPERATOR, handleType: '通知车队长', handleResult: '已通知车队长复核本次超速，后续按安全教育跟进。', falseAlarmReason: '', markDone: true }]
      }, [
        { seconds: 80, speed: 83 }, { seconds: 40, speed: 68 }
      ], { startAgo: 8000, recovered: true, live: false }),
      speedEpisode({
        sourceId: 'speed-false-alarm', plate: '云A·H6612', driverName: '陈志远', driverId: 'D025', taskId: 'Y20260904000025',
        route: '昆钢 → 研和', cargo: '水泥', location: 'G8511 服务区外侧',
        seedHandleStatus: '已处理', seedFalseAlarm: true,
        seedHandle: [{ handleTime: falseAt, handler: OPERATOR, handleType: '确认误报', handleResult: '核对 CAN 与 GPS 后确认是定位跳变，原记录保留。', falseAlarmReason: 'GPS漂移', markDone: true }]
      }, [
        { seconds: 70, speed: 86 }, { seconds: 40, speed: 60 }
      ], { startAgo: 4200, recovered: true, live: false }),
      speedEpisode({
        sourceId: 'speed-jinghong-critical', plate: '云A·K4419', driverName: '赵敏', driverId: 'D041', taskId: 'Y20260904000041',
        route: '景洪水泥厂 → 城北搅拌站', cargo: '水泥', location: '景洪东风镇辅路',
        projectId: 'JH001', projectName: '景洪项目'
      }, [
        { seconds: 70, speed: 82 }, { seconds: 70, speed: 93 }, { seconds: 70, speed: 104 }, { seconds: 40, speed: 72 }
      ], { startAgo: 5400, recovered: true, live: false, source: 'GPS' }),
      signal({
        sourceId: 'speed-spike-ignored', ruleCode: 'VEHICLE_OVERSPEED', plate: '云A·J5501', driverName: '刘洋', driverId: 'D042',
        taskId: 'Y20260904000042', route: '景洪水泥厂 → 旧卸料场', cargo: '水泥', location: '景洪城北绕城',
        projectId: 'JH001', projectName: '景洪项目', sourceStatus: 'active', live: false
      }, { samples: [speedPoint(120, 60), speedPoint(110, 60), speedPoint(100, 220), speedPoint(90, 65), speedPoint(80, 64)] }, [], []),
      signal({
        sourceId: 'speed-flutter-ignored', ruleCode: 'VEHICLE_OVERSPEED', plate: '云A·S1008', driverName: '罗伟', driverId: 'D038',
        taskId: 'Y20260904000038', route: '研和 → 北城', cargo: '水泥', location: '昆磨高速辅路',
        sourceStatus: 'active', live: false
      }, { samples: [speedPoint(200, 79), speedPoint(190, 81), speedPoint(180, 79), speedPoint(170, 82), speedPoint(160, 78), speedPoint(150, 77)] }, [], [])
    ];
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
      signal({ sourceId: 'live-parking-task-complete', ruleCode: 'TRANSPORT_PARKING', plate: '云A·F4470', driverName: '马旺', driverId: 'D023', taskId: 'Y20260904000999', route: '大开门 → 昆钢', cargo: '煤炭', location: '昆钢厂区外侧', triggeredAt: '2026-10-08 07:00:00', sourceStatus: 'active' },
        { taskStatus: '已完成', taskBound: true, taskNode: '已完成', transportRelevant: true, speed: 0, parkingStartedAt: '2026-10-08 07:00:00', parkingMinutes: 90, recoverHoldMinutes: 0, loadingScene: false, unloadingScene: false, charging: false }, []),
      signal({ sourceId: 'live-area-general', ruleCode: AREA_STAY_CODE, alertType: AREA_STAY_CODE, plate: '云A·F4470', driverName: '马旺', driverId: 'D023', taskId: 'Y20260904000026', route: '大开门 → 昆钢', cargo: '煤炭', location: '大开门装货区过磅通道', triggeredAt: '2026-10-08 08:10:00', sourceStatus: 'active', projectId: 'YX001', projectName: '玉溪项目' },
        { insideBusinessArea: true, fenceId: 'F-LOAD-DKM', fenceName: '大开门装货区', fenceType: '装货区', areaRelation: 'LOAD', enteredAt: '2026-10-08 07:00:00', areaDwellMinutes: 70, currentSpeed: 4, lastLocatedAt: '2026-10-08 08:10:00', taskNode: '装货作业' },
        ['07:00 进入大开门装货区', '当前仍在装货区', '停留时长：70分钟'], [
          { action: 'ENTER_FENCE', at: '2026-10-08 07:00:00', remark: '进入大开门装货区' },
          { action: 'ALERT_CREATED', level: '一般', at: '2026-10-08 08:00:00', remark: '停留达到60分钟，触发一般预警' }
        ]),
      signal({ sourceId: 'live-area-serious', ruleCode: AREA_STAY_CODE, alertType: AREA_STAY_CODE, plate: '云A10103', driverName: '周强', driverId: 'D028', taskId: 'Y20260904000028', route: '昆钢 → 北城', cargo: '钢材', location: '北城卸货区排队车道', triggeredAt: '2026-10-08 08:45:00', sourceStatus: 'active', projectId: 'YX001', projectName: '玉溪项目' },
        { insideBusinessArea: true, fenceId: 'F-UNLOAD-BC', fenceName: '北城卸货区', fenceType: '卸货区', areaRelation: 'UNLOAD', enteredAt: '2026-10-08 07:45:00', areaDwellMinutes: 105, currentSpeed: 3, lastLocatedAt: '2026-10-08 09:30:00', taskNode: '卸货作业' },
        ['07:45 进入北城卸货区', '当前仍在卸货区排队', '停留时长：1小时45分钟'], [
          { action: 'ENTER_FENCE', at: '2026-10-08 07:45:00', remark: '进入北城卸货区' },
          { action: 'ALERT_CREATED', level: '一般', at: '2026-10-08 08:45:00', remark: '停留达到60分钟，触发一般预警' },
          { action: 'LEVEL_UPGRADE', from: '一般', to: '严重', at: '2026-10-08 09:15:00', remark: '停留达到90分钟，升级为严重预警' }
        ]),
      signal({ sourceId: 'live-area-emergency-handled', ruleCode: AREA_STAY_CODE, alertType: AREA_STAY_CODE, plate: '云A·H6612', driverName: '陈志远', driverId: 'D025', taskId: 'Y20260904000025', route: '昆钢 → 研和', cargo: '水泥', location: '研和中转区内侧', triggeredAt: '2026-10-08 08:20:00', sourceStatus: 'active', projectId: 'YX001', projectName: '玉溪项目', seedHandleStatus: '已处理' },
        { insideBusinessArea: true, fenceId: 'F-TRANSIT-YH', fenceName: '研和中转区', fenceType: '中转区', areaRelation: 'TRANSIT', enteredAt: '2026-10-08 07:20:00', areaDwellMinutes: 200, currentSpeed: 6, lastLocatedAt: '2026-10-08 10:40:00', taskNode: '运输途中' },
        ['07:20 进入研和中转区', '当前仍在中转区', '停留时长：3小时20分钟'], [
          { action: 'ENTER_FENCE', at: '2026-10-08 07:20:00', remark: '进入研和中转区' },
          { action: 'ALERT_CREATED', level: '一般', at: '2026-10-08 08:20:00', remark: '停留达到60分钟，触发一般预警' },
          { action: 'LEVEL_UPGRADE', from: '一般', to: '严重', at: '2026-10-08 09:20:00', remark: '停留达到120分钟，升级为严重预警' },
          { action: 'LEVEL_UPGRADE', from: '严重', to: '紧急', at: '2026-10-08 10:20:00', remark: '停留达到180分钟，升级为紧急预警' },
          { action: 'MANUAL_HANDLE', at: '2026-10-08 10:25:00', operator: '李调度', remark: '联系司机：现场正在排队，预计稍后放行' },
          { action: 'MANUAL_HANDLE', at: '2026-10-08 10:50:00', operator: '李调度', remark: '继续观察：司机反馈仍在排队，已登记后续安排' }
        ]),
      signal({ sourceId: 'history-area-recover', ruleCode: AREA_STAY_CODE, alertType: AREA_STAY_CODE, plate: '云A·K4419', driverName: '赵敏', driverId: 'D041', taskId: 'Y20261007000041', route: '景洪水泥厂 → 城北搅拌站', cargo: '水泥', location: '景洪水泥卸货网点', triggeredAt: '2026-10-07 08:00:00', recoveredAt: '2026-10-07 08:50:00', sourceStatus: 'recovered', wasTriggered: true, finalLevel: '严重', projectId: 'JH001', projectName: '景洪项目' },
        { insideBusinessArea: false, fenceId: 'F-UNLOAD-JH', fenceName: '景洪水泥卸货网点', fenceType: '卸货区', areaRelation: 'UNLOAD', enteredAt: '2026-10-07 07:00:00', leaveTime: '2026-10-07 08:50:00', areaDwellMinutes: 110, currentSpeed: 18, lastLocatedAt: '2026-10-07 08:50:00', taskNode: '卸货作业' },
        ['07:00 进入景洪水泥卸货网点', '08:50 离开围栏', '事件自动恢复'], [
          { action: 'ENTER_FENCE', at: '2026-10-07 07:00:00', remark: '进入景洪水泥卸货网点' },
          { action: 'ALERT_CREATED', level: '一般', at: '2026-10-07 08:00:00', remark: '停留达到60分钟，触发一般预警' },
          { action: 'LEVEL_UPGRADE', from: '一般', to: '严重', at: '2026-10-07 08:30:00', remark: '停留达到90分钟，升级为严重预警' },
          { action: 'LEAVE_FENCE', at: '2026-10-07 08:50:00', remark: '车辆离开景洪水泥卸货网点' },
          { action: 'AUTO_RECOVER', at: '2026-10-07 08:50:00', remark: '离开区域自动恢复' }
        ]),
      signal({ sourceId: 'live-area-false-alarm', ruleCode: AREA_STAY_CODE, alertType: AREA_STAY_CODE, plate: '云A66666', driverName: '冯二', driverId: 'D040', taskId: 'Y20260904000040', route: '大开门 → 研和', cargo: '水渣', location: '大开门充电站入口', triggeredAt: '2026-10-08 11:00:00', sourceStatus: 'active', projectId: 'YX001', projectName: '玉溪项目', seedHandleStatus: '已处理', seedFalseAlarm: true },
        { insideBusinessArea: true, fenceId: 'F-CHARGE-DKM', fenceName: '大开门充电站', fenceType: '充电站', areaRelation: 'NON_TASK', enteredAt: '2026-10-08 09:00:00', areaDwellMinutes: 130, currentSpeed: 1, lastLocatedAt: '2026-10-08 11:10:00', taskNode: '充电中' },
        ['09:00 进入大开门充电站', '调度判定 GPS 漂移误报', '停留时长：2小时10分钟'], [
          { action: 'ENTER_FENCE', at: '2026-10-08 09:00:00', remark: '进入大开门充电站' },
          { action: 'ALERT_CREATED', level: '一般', at: '2026-10-08 11:00:00', remark: '停留达到120分钟，触发一般预警' },
          { action: 'MANUAL_HANDLE', at: '2026-10-08 11:10:00', operator: '李调度', remark: '误报：GPS 漂移' }
        ]),
      signal({ sourceId: 'live-bill', ruleCode: 'UNLOAD_WEIGHBILL_MISSING', plate: '云A·F4470', driverName: '马旺', driverId: 'D023', taskId: 'Y20260904000023', route: '昆钢 → 北城', cargo: '煤炭', location: '北城卸货区外侧', triggeredAt: demoDay(0, '10:04:00'), sourceStatus: 'active', projectId: 'YX001', projectName: '玉溪项目' },
        { unloadNodeId: 'UNLOAD-23', weighbillType: '卸货磅单', unloadLocation: '北城卸货区', unloadArrivedAt: demoDay(0, '09:10:00'), unloadDepartedAt: demoDay(0, '09:34:00'), arrivedUnload: true, departedUnload: true, departTimeSource: 'DRIVER', weighbillRequired: true, weighbillStatus: '未上传', weighbillUploaded: false, uploading: false, waitingMinutes: 36, evaluatedAt: demoDay(0, '10:10:00'), taskStatus: '执行中' },
        ['09:34 司机确认离开北城卸货区', '卸货磅单仍未上传', '已超时36分钟'], [
          { action: 'ARRIVED_UNLOAD', at: demoDay(0, '09:10:00'), remark: '到达北城卸货区' },
          { action: 'DEPARTED_UNLOAD', at: demoDay(0, '09:34:00'), remark: '司机确认离开卸货地' },
          { action: 'TRIGGERED', level: '一般', at: demoDay(0, '09:49:00'), remark: '离场15分钟仍未上传卸货磅单' },
          { action: 'LEVEL_UPGRADED', from: '一般', to: '严重', at: demoDay(0, '10:04:00'), remark: '离场30分钟仍未上传，升级为严重' }
        ]),
      signal({ sourceId: 'live-bill-urgent', ruleCode: 'UNLOAD_WEIGHBILL_MISSING', plate: '云A·H6612', driverName: '陈志远', driverId: 'D025', taskId: 'Y20260904000025', route: '昆钢 → 研和', cargo: '水泥', location: '研和卸货区外侧', triggeredAt: demoDay(0, '09:00:00'), sourceStatus: 'active', projectId: 'YX001', projectName: '玉溪项目' },
        { unloadNodeId: 'UNLOAD-25', weighbillType: '卸货磅单', unloadLocation: '研和卸货区', unloadArrivedAt: demoDay(0, '07:40:00'), unloadDepartedAt: demoDay(0, '08:00:00'), arrivedUnload: true, departedUnload: true, departTimeSource: 'GEOFENCE', weighbillRequired: true, weighbillStatus: '未上传', weighbillUploaded: false, uploading: false, waitingMinutes: 70, evaluatedAt: demoDay(0, '09:10:00'), taskStatus: '执行中' },
        ['08:00 围栏判定离开研和卸货区', '已超时70分钟'], [
          { action: 'ARRIVED_UNLOAD', at: demoDay(0, '07:40:00'), remark: '到达研和卸货区' },
          { action: 'DEPARTED_UNLOAD', at: demoDay(0, '08:00:00'), remark: '电子围栏判定离开卸货地' },
          { action: 'TRIGGERED', level: '一般', at: demoDay(0, '08:15:00'), remark: '离场15分钟仍未上传' },
          { action: 'LEVEL_UPGRADED', from: '一般', to: '严重', at: demoDay(0, '08:30:00'), remark: '离场30分钟仍未上传' },
          { action: 'LEVEL_UPGRADED', from: '严重', to: '紧急', at: demoDay(0, '09:00:00'), remark: '离场60分钟仍未上传，升级为紧急' }
        ]),
      signal({ sourceId: 'live-bill-general', ruleCode: 'UNLOAD_WEIGHBILL_MISSING', plate: '云A·G2288', driverName: '张建华', driverId: 'D024', taskId: 'Y20261010000024', route: '大开门 → 北城', cargo: '水渣', location: '北城卸货区', triggeredAt: demoDay(0, '10:33:00'), sourceStatus: 'active', projectId: 'YX001', projectName: '玉溪项目' },
        { unloadNodeId: 'UNLOAD-24', weighbillType: '卸货磅单', unloadLocation: '北城卸货区', unloadArrivedAt: demoDay(0, '09:50:00'), unloadDepartedAt: demoDay(0, '10:15:00'), arrivedUnload: true, departedUnload: true, departTimeSource: 'MANUAL', weighbillRequired: true, weighbillStatus: '未上传', weighbillUploaded: false, uploading: false, waitingMinutes: 18, evaluatedAt: demoDay(0, '10:33:00'), taskStatus: '执行中' },
        ['10:15 后台修正离开卸货地时间', '已超时18分钟'], [
          { action: 'ARRIVED_UNLOAD', at: demoDay(0, '09:50:00'), remark: '到达北城卸货区' },
          { action: 'DEPARTED_UNLOAD', at: demoDay(0, '10:15:00'), remark: '后台人工修正离场时间' },
          { action: 'TRIGGERED', level: '一般', at: demoDay(0, '10:30:00'), remark: '离场15分钟仍未上传卸货磅单' }
        ]),
      signal({ sourceId: 'live-bill-uploading', ruleCode: 'UNLOAD_WEIGHBILL_MISSING', plate: '云A·E1936', driverName: '王磊', driverId: 'D022', taskId: 'Y20260904000022', route: '北城 → 研和', cargo: '铁精粉', location: '研和卸货区', sourceStatus: 'active', projectId: 'YX001', projectName: '玉溪项目' },
        { unloadNodeId: 'UNLOAD-22', weighbillType: '卸货磅单', unloadLocation: '研和卸货区', unloadArrivedAt: demoDay(0, '09:00:00'), unloadDepartedAt: demoDay(0, '09:20:00'), arrivedUnload: true, departedUnload: true, departTimeSource: 'DRIVER', weighbillRequired: true, weighbillStatus: '上传处理中', weighbillUploaded: false, uploading: true, waitingMinutes: 40, evaluatedAt: demoDay(0, '10:00:00'), taskStatus: '执行中' },
        ['磅单正在上传'], []),
      signal({ sourceId: 'live-bill-passby', ruleCode: 'UNLOAD_WEIGHBILL_MISSING', plate: '云A·H3188', driverName: '何平', driverId: 'D033', taskId: 'Y20260904000033', route: '北城 → 研和', cargo: '煤炭', location: '研和卸货区门口', sourceStatus: 'active', projectId: 'YX001', projectName: '玉溪项目' },
        { unloadNodeId: 'UNLOAD-33', weighbillType: '卸货磅单', unloadLocation: '研和卸货区', arrivedUnload: false, departedUnload: false, weighbillUploaded: false, uploading: false, waitingMinutes: 80, evaluatedAt: demoDay(0, '10:00:00'), taskStatus: '执行中' },
        ['尚未到达卸货地'], []),
      signal({ sourceId: 'history-bill-upload', ruleCode: 'UNLOAD_WEIGHBILL_MISSING', plate: '云A·S1008', driverName: '罗伟', driverId: 'D038', taskId: 'Y20261007000038', route: '研和 → 北城', cargo: '水泥', location: '北城卸货区', triggeredAt: demoDay(-1, '08:20:00'), recoveredAt: demoDay(-1, '08:48:00'), sourceStatus: 'recovered', wasTriggered: true, finalLevel: '严重', recoverReason: '磅单上传成功', projectId: 'YX001', projectName: '玉溪项目' },
        { unloadNodeId: 'UNLOAD-38', weighbillType: '卸货磅单', unloadLocation: '北城卸货区', unloadArrivedAt: demoDay(-1, '07:40:00'), unloadDepartedAt: demoDay(-1, '08:00:00'), arrivedUnload: true, departedUnload: true, departTimeSource: 'DRIVER', weighbillRequired: true, weighbillStatus: '已上传', weighbillUploaded: true, uploading: false, uploadedAt: demoDay(-1, '08:48:00'), waitingMinutes: 48, evaluatedAt: demoDay(-1, '08:48:00'), taskStatus: '执行中' },
        ['磅单已上传，事件恢复'], [
          { action: 'ARRIVED_UNLOAD', at: demoDay(-1, '07:40:00'), remark: '到达北城卸货区' },
          { action: 'DEPARTED_UNLOAD', at: demoDay(-1, '08:00:00'), remark: '司机确认离开卸货地' },
          { action: 'TRIGGERED', level: '一般', at: demoDay(-1, '08:15:00'), remark: '离场15分钟仍未上传' },
          { action: 'LEVEL_UPGRADED', from: '一般', to: '严重', at: demoDay(-1, '08:30:00'), remark: '离场30分钟仍未上传' },
          { action: 'UPLOADED', at: demoDay(-1, '08:48:00'), remark: '卸货磅单上传成功' },
          { action: 'RECOVERED', at: demoDay(-1, '08:48:00'), remark: '磅单上传成功' }
        ]),
      signal({ sourceId: 'live-soc', ruleCode: 'VEHICLE_LOW_SOC', socCycleId: 'SOC-D8021-1', plate: '云A·D8021', vehicleId: 'V021', driverName: '李宏俊', driverId: 'D021', taskId: 'Y20260904000021', route: '大开门 → 昆钢', cargo: '水渣', location: '昆钢方向途中', triggeredAt: demoDay(0, '10:05:00'), sourceStatus: 'active', projectId: 'YX001', projectName: '玉溪项目' },
        { socCycleId: 'SOC-D8021-1', soc: 18, triggerSoc: 30, socSource: 'CAN', chargingStatus: '未充电', telemetryValid: true, lastTelemetryAt: demoDay(0, '10:08:00'), thresholdCandidateStartedAt: demoDay(0, '10:03:00'), evaluatedAt: demoDay(0, '10:08:00') },
        ['当前 SOC：18%', '数据来源：车辆 CAN/T-BOX', '已持续低于严重阈值'], [
          { action: 'SOC_LOW', at: demoDay(0, '10:03:00'), remark: 'SOC降至30%以下，开始持续确认' },
          { action: 'TRIGGERED', level: '一般', at: demoDay(0, '10:05:00'), remark: 'SOC≤30%持续2分钟，触发一般预警' },
          { action: 'LEVEL_UPGRADED', from: '一般', to: '严重', at: demoDay(0, '10:08:00'), remark: 'SOC≤20%持续2分钟，升级严重' }
        ]),
      signal({ sourceId: 'live-soc-jitter', ruleCode: 'VEHICLE_LOW_SOC', socCycleId: 'SOC-E1936-JITTER', plate: '云A·E1936', vehicleId: 'V022', driverName: '王磊', driverId: 'D022', taskId: 'Y20260904000022', route: '北城 → 研和', cargo: '铁精粉', location: '昆磨高速', sourceStatus: 'active', projectId: 'YX001', projectName: '玉溪项目' },
        { socCycleId: 'SOC-E1936-JITTER', soc: 29, socSource: 'CAN', chargingStatus: '未充电', telemetryValid: true, lastTelemetryAt: demoDay(0, '10:12:00'), thresholdCandidateStartedAt: demoDay(0, '10:12:00'), evaluatedAt: demoDay(0, '10:12:00') },
        ['单点 SOC 29%，尚未持续确认'], []),
      signal({ sourceId: 'live-soc-stale', ruleCode: 'VEHICLE_LOW_SOC', socCycleId: 'SOC-H3188-STALE', plate: '云A·H3188', vehicleId: 'V033', driverName: '何平', driverId: 'D033', taskId: 'Y20260904000033', route: '北城 → 研和', cargo: '煤炭', location: '昆磨高速', sourceStatus: 'active', projectId: 'YX001', projectName: '玉溪项目' },
        { socCycleId: 'SOC-H3188-STALE', soc: 8, socSource: 'CAN', chargingStatus: '未充电', telemetryValid: false, lastTelemetryAt: demoDay(0, '09:40:00'), evaluatedAt: demoDay(0, '10:12:00') },
        ['SOC 数据已超过有效期'], []),
      signal({ sourceId: 'live-soc-expired-hold', ruleCode: 'VEHICLE_LOW_SOC', socCycleId: 'SOC-H3188-EXPIRED', plate: '云A·H3188', vehicleId: 'V033', driverName: '何平', driverId: 'D033', taskId: 'Y20260904000033', route: '北城 → 研和', cargo: '煤炭', location: '昆磨高速', triggeredAt: demoDay(0, '09:20:00'), sourceStatus: 'active', wasTriggered: true, finalLevel: '严重', projectId: 'YX001', projectName: '玉溪项目' },
        { socCycleId: 'SOC-H3188-EXPIRED', soc: 18, triggerSoc: 30, socSource: 'CAN', chargingStatus: '未充电', telemetryValid: false, lastTelemetryAt: demoDay(0, '09:18:00'), thresholdCandidateStartedAt: demoDay(0, '09:16:00'), evaluatedAt: demoDay(0, '10:12:00') },
        ['车辆SOC数据已过期'], [
          { action: 'TRIGGERED', level: '一般', at: demoDay(0, '09:18:00'), remark: 'SOC≤30%持续2分钟，触发一般预警' },
          { action: 'LEVEL_UPGRADED', from: '一般', to: '严重', at: demoDay(0, '09:22:00'), remark: 'SOC≤20%持续2分钟，升级严重' },
          { action: 'SOC_LOW', at: demoDay(0, '09:28:00'), remark: '车辆SOC数据已过期，暂停按实时电量升级' }
        ]),
      signal({ sourceId: 'live-soc-charging', ruleCode: 'VEHICLE_LOW_SOC', socCycleId: 'SOC-S1008-CHARGE', plate: '云A·S1008', vehicleId: 'V038', driverName: '罗伟', driverId: 'D038', taskId: 'Y20260904000038', route: '研和 → 北城', cargo: '水泥', location: '北城充电站', triggeredAt: demoDay(0, '09:40:00'), sourceStatus: 'active', projectId: 'YX001', projectName: '玉溪项目' },
        { socCycleId: 'SOC-S1008-CHARGE', soc: 9, triggerSoc: 30, socSource: 'CAN', chargingStatus: '充电中', telemetryValid: true, lastTelemetryAt: demoDay(0, '10:16:00'), thresholdCandidateStartedAt: demoDay(0, '09:30:00'), evaluatedAt: demoDay(0, '10:16:00') },
        ['当前 SOC：9%', '已插枪充电，电量尚未回到恢复线'], [
          { action: 'SOC_LOW', at: demoDay(0, '09:30:00'), remark: 'SOC 持续低于30%' },
          { action: 'TRIGGERED', level: '一般', at: demoDay(0, '09:32:00'), remark: 'SOC ≤30% 持续满2分钟' },
          { action: 'LEVEL_UPGRADED', from: '一般', to: '严重', at: demoDay(0, '09:36:00'), remark: 'SOC 降至18%' },
          { action: 'LEVEL_UPGRADED', from: '严重', to: '紧急', at: demoDay(0, '09:40:00'), remark: 'SOC 降至9%' },
          { action: 'CHARGING_STARTED', at: demoDay(0, '10:05:00'), remark: '车辆开始充电，进入恢复候选，SOC 仍为9%' }
        ]),
      signal({ sourceId: 'history-soc', ruleCode: 'VEHICLE_LOW_SOC', socCycleId: 'SOC-J5501-RECOVER', plate: '云A·J5501', vehicleId: 'V042', driverName: '刘洋', driverId: 'D042', taskId: 'Y20261007000042', route: '景洪水泥厂 → 旧卸料场', cargo: '水泥', location: '景洪城北绕城', triggeredAt: demoDay(-1, '08:12:00'), recoveredAt: demoDay(-1, '11:08:00'), sourceStatus: 'recovered', wasTriggered: true, finalLevel: '紧急', recoverReason: 'SOC ≥ 35% 持续 ≥ 2分钟', projectId: 'JH001', projectName: '景洪项目' },
        { socCycleId: 'SOC-J5501-RECOVER', soc: 36, triggerSoc: 30, socSource: 'CAN', chargingStatus: '充电中', telemetryValid: true, lastTelemetryAt: demoDay(-1, '11:08:00'), thresholdCandidateStartedAt: demoDay(-1, '08:00:00'), recoverCandidateStartedAt: demoDay(-1, '11:05:00'), evaluatedAt: demoDay(-1, '11:08:00') },
        ['SOC 已恢复至36%并持续满足恢复时间'], [
          { action: 'TRIGGERED', level: '一般', at: demoDay(-1, '08:02:00'), remark: 'SOC≤30%持续2分钟，触发一般预警' },
          { action: 'LEVEL_UPGRADED', from: '一般', to: '严重', at: demoDay(-1, '08:30:00'), remark: 'SOC≤20%持续2分钟，升级严重' },
          { action: 'LEVEL_UPGRADED', from: '严重', to: '紧急', at: demoDay(-1, '09:00:00'), remark: 'SOC≤10%持续2分钟，升级紧急' },
          { action: 'CHARGING_STARTED', at: demoDay(-1, '09:20:00'), remark: '开始充电' },
          { action: 'RECOVERED', at: demoDay(-1, '11:08:00'), remark: 'SOC≥35%持续2分钟，事件恢复' }
        ]),
      signal({ sourceId: 'live-fatigue', ruleCode: 'DRIVER_FATIGUE', drivingCycleId: 'DC-D021-TODAY-01', plate: '云A·D8021', vehicleId: 'V021', driverName: '李宏俊', driverId: 'D021', taskId: 'Y20260904000021', route: '大开门 → 昆钢', cargo: '水渣', location: '昆磨高速辅路', triggeredAt: demoDay(0, '10:12:00'), sourceStatus: 'active', projectId: 'YX001', projectName: '玉溪项目' },
        { drivingCycleId: 'DC-D021-TODAY-01', drivingStartedAt: demoDay(0, '06:00:00'), continuousDrivingMinutes: 252, currentSpeed: 63, drivingState: 'driving', parkingStartedAt: null, continuousParkingMinutes: 0, driverBindingStartedAt: demoDay(0, '05:55:00'), drivingCycleActive: true, telemetryValid: true, lastTelemetryAt: demoDay(0, '10:12:00'), evaluatedAt: demoDay(0, '10:12:00'), driverChanged: false },
        ['司机：李宏俊', '短停未清零', '连续驾驶4小时12分钟'], [
          { action: 'DRIVE_STARTED', at: demoDay(0, '06:00:00'), remark: '开始本次连续驾驶' },
          { action: 'SHORT_STOP', at: demoDay(0, '08:20:00'), remark: '拥堵短停6分钟，未达到有效休息' },
          { action: 'DRIVE_RESUMED', at: demoDay(0, '08:26:00'), remark: '恢复驾驶，连续驾驶周期继续' },
          { action: 'TRIGGERED', level: '一般', at: demoDay(0, '09:30:00'), remark: '连续驾驶达到3.5小时' },
          { action: 'LEVEL_UPGRADED', from: '一般', to: '严重', at: demoDay(0, '10:00:00'), remark: '连续驾驶达到4小时' }
        ]),
      signal({ sourceId: 'live-fatigue-shortstop', ruleCode: 'DRIVER_FATIGUE', drivingCycleId: 'DC-D022-TODAY-01', plate: '云A·E1936', vehicleId: 'V022', driverName: '王磊', driverId: 'D022', taskId: 'Y20260904000022', route: '北城 → 研和', cargo: '铁精粉', location: '昆磨高速', triggeredAt: demoDay(0, '10:40:00'), sourceStatus: 'active', projectId: 'YX001', projectName: '玉溪项目' },
        { drivingCycleId: 'DC-D022-TODAY-01', drivingStartedAt: demoDay(0, '07:00:00'), continuousDrivingMinutes: 220, currentSpeed: 0, drivingState: 'short_stop', parkingStartedAt: demoDay(0, '10:32:00'), continuousParkingMinutes: 8, driverBindingStartedAt: demoDay(0, '06:55:00'), drivingCycleActive: true, telemetryValid: true, lastTelemetryAt: demoDay(0, '10:40:00'), evaluatedAt: demoDay(0, '10:40:00'), driverChanged: false },
        ['当前短停8分钟', '未达到有效休息，连续驾驶不清零'], [
          { action: 'DRIVE_STARTED', at: demoDay(0, '07:00:00'), remark: '开始本次连续驾驶' },
          { action: 'TRIGGERED', level: '一般', at: demoDay(0, '10:30:00'), remark: '连续驾驶达到3.5小时' },
          { action: 'SHORT_STOP', at: demoDay(0, '10:32:00'), remark: '排队短停，连续驾驶周期继续' }
        ]),
      signal({ sourceId: 'live-fatigue-stale', ruleCode: 'DRIVER_FATIGUE', drivingCycleId: 'DC-D024-STALE', plate: '云A·G2288', vehicleId: 'V024', driverName: '张建华', driverId: 'D024', taskId: 'Y20261010000024', route: '大开门 → 北城', cargo: '水渣', location: '昆钢厂区外侧', sourceStatus: 'active', projectId: 'YX001', projectName: '玉溪项目' },
        { drivingCycleId: 'DC-D024-STALE', drivingStartedAt: demoDay(0, '05:00:00'), continuousDrivingMinutes: 40, currentSpeed: 0, drivingState: 'unknown', parkingStartedAt: null, continuousParkingMinutes: 0, drivingCycleActive: true, telemetryValid: false, lastTelemetryAt: demoDay(0, '09:20:00'), evaluatedAt: demoDay(0, '10:40:00'), driverChanged: false, dataInsufficient: true },
        ['速度数据已失效，暂停累计连续驾驶'], []),
      signal({ sourceId: 'history-fatigue-rest', ruleCode: 'DRIVER_FATIGUE', drivingCycleId: 'DC-D033-YDAY-02', plate: '云A·H3188', vehicleId: 'V033', driverName: '何平', driverId: 'D033', taskId: 'Y20261007000033', route: '北城 → 研和', cargo: '煤炭', location: '研和停车区', triggeredAt: demoDay(-1, '17:12:00'), recoveredAt: demoDay(-1, '18:25:00'), sourceStatus: 'recovered', wasTriggered: true, finalLevel: '严重', recoverReason: '连续非驾驶达到20分钟，有效休息成立', projectId: 'YX001', projectName: '玉溪项目' },
        { drivingCycleId: 'DC-D033-YDAY-02', drivingStartedAt: demoDay(-1, '13:42:00'), continuousDrivingMinutes: 258, currentSpeed: 0, drivingState: 'resting', parkingStartedAt: demoDay(-1, '18:00:00'), continuousParkingMinutes: 25, lastEffectiveRestAt: demoDay(-1, '18:20:00'), driverBindingStartedAt: demoDay(-1, '13:40:00'), drivingCycleActive: false, telemetryValid: true, lastTelemetryAt: demoDay(-1, '18:25:00'), evaluatedAt: demoDay(-1, '18:25:00'), driverChanged: false },
        ['连续非驾驶25分钟', '达到有效休息，周期结束'], [
          { action: 'DRIVE_STARTED', at: demoDay(-1, '13:42:00'), remark: '开始本次连续驾驶' },
          { action: 'TRIGGERED', level: '一般', at: demoDay(-1, '17:12:00'), remark: '连续驾驶达到3.5小时' },
          { action: 'LEVEL_UPGRADED', from: '一般', to: '严重', at: demoDay(-1, '17:42:00'), remark: '连续驾驶达到4小时' },
          { action: 'REST_STARTED', at: demoDay(-1, '18:00:00'), remark: '开始连续休息' },
          { action: 'RECOVERED', at: demoDay(-1, '18:25:00'), remark: '连续非驾驶达到20分钟，有效休息成立' }
        ]),
      signal({ sourceId: 'history-fatigue-driver', ruleCode: 'DRIVER_FATIGUE', drivingCycleId: 'DC-D041-YDAY-01', plate: '云A·K4419', vehicleId: 'V041', driverName: '赵敏', driverId: 'D041', taskId: 'Y20261007000041', route: '景洪水泥厂 → 城北搅拌站', cargo: '水泥', location: '景洪东风镇辅路', triggeredAt: demoDay(-1, '15:30:00'), recoveredAt: demoDay(-1, '16:10:00'), sourceStatus: 'recovered', wasTriggered: true, finalLevel: '一般', recoverReason: '驾驶员变更', projectId: 'JH001', projectName: '景洪项目' },
        { drivingCycleId: 'DC-D041-YDAY-01', drivingStartedAt: demoDay(-1, '12:00:00'), continuousDrivingMinutes: 220, currentSpeed: 0, drivingState: 'ended', continuousParkingMinutes: 0, driverBindingStartedAt: demoDay(-1, '11:50:00'), drivingCycleActive: false, telemetryValid: true, lastTelemetryAt: demoDay(-1, '16:10:00'), evaluatedAt: demoDay(-1, '16:10:00'), driverChanged: true },
        ['驾驶员已更换，原周期结束，驾驶时长不继承给新司机'], [
          { action: 'DRIVE_STARTED', at: demoDay(-1, '12:00:00'), remark: '赵敏开始连续驾驶' },
          { action: 'TRIGGERED', level: '一般', at: demoDay(-1, '15:30:00'), remark: '连续驾驶达到3.5小时' },
          { action: 'DRIVER_CHANGED', at: demoDay(-1, '16:10:00'), remark: '驾驶员变更，原司机当前车辆驾驶周期结束' },
          { action: 'RECOVERED', at: demoDay(-1, '16:10:00'), remark: '驾驶员变更' }
        ])
    ].concat(buildSpeedSignals()).map(attachParkingContext).map(attachAreaStayContext).map(attachSpeedContext).map(attachWeighbillContext).map(attachSocContext).map(attachFatigueContext);
  }
  function attachWeighbillContext(item) {
    if (item.ruleCode !== 'UNLOAD_WEIGHBILL_MISSING') return item;
    item.metrics = item.metrics || {};
    item.projectId = item.projectId || PROJECT_ID;
    item.projectName = item.projectName || PROJECT_NAME;
    item.departmentName = item.departmentName || departmentOfProject(item.projectId);
    item.metrics.weighbillType = item.metrics.weighbillType || '卸货磅单';
    item.metrics.unloadNodeId = item.metrics.unloadNodeId || ('UNLOAD-' + (item.taskId || item.sourceId));
    if (!item.evaluatedAt) {
      if (item.metrics.unloadDepartedAt && item.metrics.waitingMinutes != null) item.evaluatedAt = shiftStamp(item.metrics.unloadDepartedAt, item.metrics.waitingMinutes);
      else item.evaluatedAt = item.recoveredAt || item.triggeredAt || nowText();
    }
    item.metrics.evaluatedAt = item.metrics.evaluatedAt || item.evaluatedAt;
    item.metrics.mockSource = 'frontend-demo';
    return item;
  }
  function attachSocContext(item) {
    if (item.ruleCode !== 'VEHICLE_LOW_SOC') return item;
    item.metrics = item.metrics || {};
    item.projectId = item.projectId || PROJECT_ID;
    item.projectName = item.projectName || PROJECT_NAME;
    item.departmentName = item.departmentName || departmentOfProject(item.projectId);
    item.socCycleId = item.socCycleId || item.metrics.socCycleId || item.sourceId;
    item.metrics.socCycleId = item.socCycleId;
    item.metrics.socSource = item.metrics.socSource || 'CAN';
    item.metrics.chargingStatus = item.metrics.chargingStatus || '未充电';
    if (item.metrics.telemetryValid == null) item.metrics.telemetryValid = true;
    if (!item.evaluatedAt) item.evaluatedAt = item.metrics.evaluatedAt || item.recoveredAt || item.triggeredAt || nowText();
    item.metrics.evaluatedAt = item.metrics.evaluatedAt || item.evaluatedAt;
    item.metrics.lastTelemetryAt = item.metrics.lastTelemetryAt || item.metrics.evaluatedAt;
    item.metrics.mockSource = 'frontend-demo';
    return item;
  }
  function attachFatigueContext(item) {
    if (item.ruleCode !== 'DRIVER_FATIGUE') return item;
    item.metrics = item.metrics || {};
    item.projectId = item.projectId || PROJECT_ID;
    item.projectName = item.projectName || PROJECT_NAME;
    item.departmentName = item.departmentName || departmentOfProject(item.projectId);
    item.drivingCycleId = item.drivingCycleId || item.metrics.drivingCycleId || item.sourceId;
    item.metrics.drivingCycleId = item.drivingCycleId;
    if (!item.evaluatedAt) {
      if (item.metrics.drivingStartedAt && item.metrics.continuousDrivingMinutes != null) item.evaluatedAt = shiftStamp(item.metrics.drivingStartedAt, item.metrics.continuousDrivingMinutes);
      else item.evaluatedAt = item.recoveredAt || item.triggeredAt || nowText();
    }
    item.metrics.evaluatedAt = item.metrics.evaluatedAt || item.evaluatedAt;
    if (item.metrics.telemetryValid == null) item.metrics.telemetryValid = true;
    item.metrics.lastTelemetryAt = item.metrics.lastTelemetryAt || item.metrics.evaluatedAt;
    item.metrics.mockSource = 'frontend-demo';
    return item;
  }
  function attachSpeedContext(item) {
    if (item.ruleCode !== 'VEHICLE_OVERSPEED') return item;
    var found = vehicleByPlate(item.plate);
    if (found) {
      item.projectId = item.projectId || found.projectId;
      item.projectName = item.projectName || found.projectName;
      item.departmentName = item.departmentName || found.departmentName;
    }
    item.departmentName = item.departmentName || departmentOfProject(item.projectId);
    item.metrics = item.metrics || {};
    item.metrics.mockSource = 'frontend-demo';
    return item;
  }
  function attachAreaStayContext(item) {
    if (!isAreaStayCode(item.ruleCode)) return item;
    item.ruleCode = AREA_STAY_CODE;
    item.alertType = AREA_STAY_CODE;
    item.metrics = item.metrics || {};
    var fence = fenceById(item.metrics.fenceId) || fenceByName(item.metrics.fenceName || item.location);
    if (fence) {
      item.metrics.fenceId = fence.id;
      item.metrics.fenceName = fence.name;
      item.metrics.fenceType = fence.type;
      item.projectId = item.projectId || fence.projectId;
      item.projectName = item.projectName || fence.projectName;
    }
    item.departmentName = item.departmentName || departmentOfProject(item.projectId);
    item.metrics.areaRelation = item.metrics.areaRelation || 'UNKNOWN';
    item.metrics.taskNode = item.metrics.taskNode || item.taskNode || '';
    item.transportStage = transportStageText(item.metrics.taskNode);
    item.metrics.mockSource = 'frontend-demo';
    if (!item.evaluatedAt) {
      if (item.recoveredAt) item.evaluatedAt = item.recoveredAt;
      else if (item.metrics.enteredAt && item.metrics.areaDwellMinutes != null) item.evaluatedAt = shiftStamp(item.metrics.enteredAt, item.metrics.areaDwellMinutes);
      else item.evaluatedAt = nowText();
    }
    item.metrics.evaluatedAt = item.evaluatedAt;
    if (item.metrics.insideBusinessArea == null) item.metrics.insideBusinessArea = item.sourceStatus !== 'recovered';
    return item;
  }
  function attachParkingContext(item) {
    if (item.ruleCode !== 'TRANSPORT_PARKING') return item;
    var found = PARKING_VEHICLES.filter(function (vehicle) { return vehicle.plate === item.plate; })[0];
    if (found) {
      item.projectId = found.projectId;
      item.projectName = found.projectName;
      item.departmentName = found.departmentName || departmentOfProject(found.projectId);
    }
    item.departmentName = item.departmentName || departmentOfProject(item.projectId);
    item.metrics = item.metrics || {};
    item.metrics.mockSource = 'frontend-demo';
    if (!item.evaluatedAt) {
      if (item.recoveredAt) item.evaluatedAt = item.recoveredAt;
      else if (item.metrics.parkingStartedAt && item.metrics.parkingMinutes != null) item.evaluatedAt = shiftStamp(item.metrics.parkingStartedAt, item.metrics.parkingMinutes);
      else item.evaluatedAt = nowText();
    }
    item.metrics.evaluatedAt = item.evaluatedAt;
    item.metrics.staticCandidateStartAt = item.metrics.staticCandidateStartAt || item.metrics.staticStartTime || item.metrics.parkingStartedAt || null;
    item.metrics.staticStartTime = item.metrics.staticCandidateStartAt;
    if (item.metrics.telemetryValid == null) item.metrics.telemetryValid = true;
    item.metrics.lastTelemetryAt = item.metrics.lastTelemetryAt || item.evaluatedAt;
    item.metrics.speedSource = item.metrics.speedSource || 'frontend-demo';
    item.metrics.positionSource = item.metrics.positionSource || 'frontend-demo';
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
    return {
      triggered: !!level,
      recovered: extra.recovered === true,
      episode: extra.episode === true || !!level,
      level: level ? level.level : (extra.maxLevel || null),
      maxLevel: extra.maxLevel || (level ? level.level : null),
      initialLevel: extra.initialLevel || (level ? level.level : null),
      currentRiskLevel: extra.currentRiskLevel || null,
      timeline: extra.timeline || [],
      levelConfig: clone(level),
      metrics: clone(metrics || {}),
      facts: clone(facts || [])
    };
  }
  function parkingFacts(currentSignal, rule, metrics) {
    var m = metrics || currentSignal.metrics || {};
    var detect = (rule && rule.detectConfig) || {};
    var still = Number(detect.stillSpeedKph || 3);
    var excluded = m.loadingScene === true || m.unloadingScene === true || m.charging === true;
    var startAt = m.parkingStartedAt || m.staticCandidateStartAt || m.staticStartTime;
    var facts = [
      isExecutingBoundTask(m, currentSignal) ? '车辆正在执行任务 ' + (currentSignal.taskId || m.taskId || '—') : '车辆当前不在执行运输任务',
      '当前处于' + (m.taskNode || '运输途中'),
      m.taskStatus === '执行中' ? '任务单状态为执行中' : '任务单状态不是执行中',
      m.taskBound === true ? '车辆已绑定当前任务' : '车辆未绑定当前任务',
      excluded ? '命中装货、卸货或充电排除场景' : '未处于装货、卸货或充电场景',
      (startAt ? String(startAt).slice(11, 16) : '—') + ' 开始持续静止',
      m.staticConfirmedAt ? ('连续静止已于 ' + String(m.staticConfirmedAt).slice(11, 16) + ' 确认') : '尚未达到最小持续静止时间',
      '当前已连续异常停车' + (m.parkingMinutes == null ? '—' : m.parkingMinutes) + '分钟',
      '当前车速：' + (m.speed == null ? '—' : m.speed) + ' km/h（静止阈值 ≤' + still + ' km/h）'
    ];
    var matched = highestMatched(rule, function (item) { return Number(m.parkingMinutes) >= Number(item.threshold); });
    if (matched) facts.push('已超过“' + matched.level + '”告警阈值' + matched.threshold + '分钟');
    if (m.recoverReason) facts.push('恢复原因：' + m.recoverReason);
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
    var minStill = Number(detect.minStillMinutes || 5);
    var executing = isExecutingBoundTask(input, currentSignal);
    var excluded = (detect.excludeLoading !== false && input.loadingScene === true)
      || (detect.excludeUnloading !== false && input.unloadingScene === true)
      || (detect.excludeCharging !== false && input.charging === true);
    var inPeriod = inMonitorPeriod(rule, evalAt);
    var taskEnded = isTaskEnded(input);
    var staticCandidateStartAt = prior.staticCandidateStartAt || prior.staticStartTime || prior.parkingStartedAt
      || input.staticCandidateStartAt || input.staticStartTime || input.parkingStartedAt || null;
    var staticConfirmedAt = prior.staticConfirmedAt || input.staticConfirmedAt || null;
    var parkingStartedAt = prior.parkingStartedAt || null;
    var recoverCandidateStartAt = prior.recoverCandidateStartAt || prior.recoverCandidateStart
      || input.recoverCandidateStartAt || input.recoverCandidateStart || null;
    var recovered = false;
    var recoverReason = null;
    if (input.telemetryValid == null) input.telemetryValid = true;
    input.lastTelemetryAt = input.lastTelemetryAt || evalAt;
    input.speedSource = input.speedSource || input.mockSource || 'frontend-demo';
    input.positionSource = input.positionSource || input.mockSource || 'frontend-demo';
    var canMonitor = executing && inPeriod && !excluded && input.telemetryValid !== false;
    if ((parkingStartedAt || staticCandidateStartAt) && rec.endOnTaskComplete !== false && (taskEnded || !executing)) {
      recovered = true;
      recoverReason = '任务结束';
    }
    if (input.telemetryValid === false) {
      input.staticCandidateStartAt = staticCandidateStartAt;
      input.staticStartTime = staticCandidateStartAt;
      input.staticConfirmedAt = staticConfirmedAt;
      input.parkingStartedAt = parkingStartedAt;
      input.parkingMinutes = prior.parkingMinutes != null ? prior.parkingMinutes : 0;
      input.recoverCandidateStartAt = recoverCandidateStartAt;
      input.recoverCandidateStart = recoverCandidateStartAt;
      input.cycleClosed = false;
      input.durationSource = 'telemetry-invalid';
      input.recoverReason = null;
      return { metrics: input, recovered: false, canMonitor: false };
    }
    if (!recovered && canMonitor && isFinite(speed) && speed <= stillSpeed) {
      if (!staticCandidateStartAt) staticCandidateStartAt = input.staticCandidateStartAt || input.staticStartTime || input.parkingStartedAt || evalAt;
      recoverCandidateStartAt = null;
      var stillMinutes = minutesBetween(staticCandidateStartAt, evalAt);
      if (stillMinutes == null && input.parkingMinutes != null) stillMinutes = Number(input.parkingMinutes);
      if (stillMinutes != null && stillMinutes >= minStill) {
        parkingStartedAt = staticCandidateStartAt;
        if (!staticConfirmedAt) staticConfirmedAt = shiftStamp(staticCandidateStartAt, minStill);
      }
    } else if (!recovered && (parkingStartedAt || staticCandidateStartAt) && isFinite(speed) && speed >= recoverSpeed) {
      if (!recoverCandidateStartAt) {
        recoverCandidateStartAt = prior.recoverCandidateStartAt || prior.recoverCandidateStart || input.recoverCandidateStartAt || input.recoverCandidateStart
          || (input.recoverHoldMinutes != null ? shiftStamp(evalAt, -Number(input.recoverHoldMinutes)) : evalAt);
      }
      var hold = minutesBetween(recoverCandidateStartAt, evalAt);
      if (hold != null && hold >= recoverNeed) {
        recovered = true;
        recoverReason = parkingRecoveryText(rec);
      }
    } else if (!recovered && (parkingStartedAt || staticCandidateStartAt) && isFinite(speed) && speed > stillSpeed) {
      recoverCandidateStartAt = null;
    } else if (!canMonitor && !(parkingStartedAt || staticCandidateStartAt)) {
      recoverCandidateStartAt = null;
    }
    var durationStart = parkingStartedAt || staticCandidateStartAt || prior.parkingStartedAt || input.parkingStartedAt || null;
    var parkingMinutes = durationStart ? minutesBetween(durationStart, evalAt) : 0;
    if (recovered) {
      parkingStartedAt = parkingStartedAt || durationStart;
      if (!staticConfirmedAt && parkingStartedAt) staticConfirmedAt = shiftStamp(parkingStartedAt, minStill);
      parkingMinutes = parkingStartedAt ? minutesBetween(parkingStartedAt, evalAt) : parkingMinutes;
      if (parkingMinutes == null || parkingMinutes === 0) {
        parkingMinutes = Number(prior.parkingMinutes != null ? prior.parkingMinutes : (input.parkingMinutes || 0));
      }
    } else if (!canMonitor) {
      parkingMinutes = prior.parkingMinutes != null ? prior.parkingMinutes : parkingMinutes;
    }
    if (parkingMinutes == null) {
      parkingMinutes = Number(input.parkingMinutes || 0);
      input.durationSource = 'input-fallback';
    } else {
      input.durationSource = recovered ? 'closed-cycle' : 'cycle';
    }
    input.staticCandidateStartAt = staticCandidateStartAt || parkingStartedAt;
    input.staticStartTime = input.staticCandidateStartAt;
    input.staticConfirmedAt = staticConfirmedAt;
    input.parkingStartedAt = parkingStartedAt || (staticConfirmedAt ? staticCandidateStartAt : null);
    input.parkingMinutes = parkingMinutes;
    input.recoverCandidateStartAt = recoverCandidateStartAt;
    input.recoverCandidateStart = recoverCandidateStartAt;
    input.recoverHoldMinutes = recoverCandidateStartAt ? (minutesBetween(recoverCandidateStartAt, evalAt) || 0) : 0;
    input.cycleClosed = recovered;
    input.recoverReason = recoverReason;
    input.evaluatedAt = evalAt;
    return { metrics: input, recovered: recovered, canMonitor: canMonitor };
  }
  function parkingCycleKey(currentSignal) {
    return [currentSignal.vehicleId || currentSignal.plate, currentSignal.taskId || 'NO_TASK'].join('|');
  }
  function loadParkingCycle(currentSignal, active) {
    if (active && active.metrics && (active.metrics.staticCandidateStartAt || active.metrics.staticStartTime || active.metrics.parkingStartedAt)) return active.metrics;
    return (state.parkingCycles || {})[parkingCycleKey(currentSignal)] || null;
  }
  function saveParkingCycle(currentSignal, metrics, recovered) {
    state.parkingCycles = state.parkingCycles || {};
    var key = parkingCycleKey(currentSignal);
    if (recovered || !metrics || !(metrics.staticCandidateStartAt || metrics.staticStartTime)) {
      delete state.parkingCycles[key];
      return;
    }
    state.parkingCycles[key] = {
      staticCandidateStartAt: metrics.staticCandidateStartAt || metrics.staticStartTime || null,
      staticStartTime: metrics.staticCandidateStartAt || metrics.staticStartTime || null,
      staticConfirmedAt: metrics.staticConfirmedAt || null,
      parkingStartedAt: metrics.parkingStartedAt || null,
      recoverCandidateStartAt: metrics.recoverCandidateStartAt || metrics.recoverCandidateStart || null,
      recoverCandidateStart: metrics.recoverCandidateStartAt || metrics.recoverCandidateStart || null,
      parkingMinutes: metrics.parkingMinutes
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
    if (!m.parkingStartedAt) return evaluation(null, m, facts);
    if (Number(m.parkingMinutes) < Number(detect.minStillMinutes || 5)) return evaluation(null, m, facts);
    return evaluation(highestMatched(rule, function (item) { return Number(m.parkingMinutes) >= Number(item.threshold); }), m, facts);
  }
  function areaStayFacts(currentSignal, rule, metrics) {
    var m = metrics || currentSignal.metrics || {};
    var fence = areaStaySignalFence(Object.assign({}, currentSignal, { metrics: m }));
    var dwell = Number(m.areaDwellMinutes);
    var facts = [
      (m.enteredAt ? String(m.enteredAt).slice(11, 16) : '—') + ' 进入' + (fence.name || '业务区域'),
      m.insideBusinessArea === true ? '当前仍在围栏内，持续累计区域停留时长' : '车辆已离开对应电子围栏',
      '围栏类型：' + (fence.type || m.fenceType || '—'),
      '当前运输阶段：' + transportStageText(m.taskNode),
      '与当前任务关系：' + areaRelationText(m.areaRelation) + '（后续能力）',
      '当前已停留' + (isFinite(dwell) ? dwell : '—') + '分钟',
      rule ? ('命中规则：' + rule.name + '（' + areaStayPriorityName(rule) + '）') : '未命中区域停留规则'
    ];
    var matched = highestMatched(rule, function (item) { return Number(m.areaDwellMinutes) >= Number(item.threshold); });
    if (matched) facts.push('已超过“' + matched.level + '”告警阈值' + matched.threshold + '分钟');
    return facts;
  }
  function resolveAreaStayDuration(currentSignal) {
    var m = Object.assign({}, currentSignal.metrics || {});
    var evalAt = evaluationTime(currentSignal);
    m.evaluatedAt = evalAt;
    var enter = m.enteredAt || currentSignal.enterTime || currentSignal.triggeredAt;
    var leave = m.leaveTime || currentSignal.leaveTime || currentSignal.recoveredAt || null;
    var inside = m.insideBusinessArea === true && currentSignal.sourceStatus !== 'recovered';
    if (inside) {
      var live = minutesBetween(enter, evalAt);
      if (live != null) m.areaDwellMinutes = live;
      m.leaveTime = null;
    } else {
      var closed = minutesBetween(enter, leave || evalAt);
      if (closed != null) m.areaDwellMinutes = closed;
      m.leaveTime = leave || evalAt;
      m.insideBusinessArea = false;
    }
    m.enteredAt = enter;
    m.currentStayDuration = inside ? m.areaDwellMinutes : null;
    m.finalStayDuration = inside ? null : m.areaDwellMinutes;
    return m;
  }
  function evaluateParkingArea(currentSignal, rule) {
    var m = resolveAreaStayDuration(currentSignal);
    var facts = areaStayFacts(currentSignal, rule, m);
    if (!rule || rule.enabled === false) return evaluation(null, m, facts);
    if (m.insideBusinessArea !== true) return evaluation(null, m, facts, { recovered: true });
    return evaluation(highestMatched(rule, function (item) { return Number(m.areaDwellMinutes) >= Number(item.threshold); }), m, facts);
  }
  function normalizeSpeedSample(raw, policy) {
    if (!raw || !raw.at) return null;
    var can = raw.canSpeed != null ? Number(raw.canSpeed) : ((raw.source === 'CAN' || !raw.source) ? Number(raw.speed) : NaN);
    var gps = raw.gpsSpeed != null ? Number(raw.gpsSpeed) : (raw.source === 'GPS' ? Number(raw.speed) : NaN);
    if (raw.source === 'GPS' && raw.canSpeed == null) can = NaN;
    var speed;
    var source;
    if (policy === 'CAN') {
      if (!isFinite(can)) return null;
      speed = can;
      source = 'CAN';
    } else if (policy === 'GPS') {
      if (!isFinite(gps)) return null;
      speed = gps;
      source = 'GPS';
    } else if (isFinite(can)) {
      speed = can;
      source = 'CAN';
    } else if (isFinite(gps)) {
      speed = gps;
      source = 'GPS';
    } else return null;
    return { at: raw.at, speed: speed, source: source, gpsQuality: raw.gpsQuality };
  }
  function speedSampleAccept(sample, prev) {
    if (!sample.at || !isFinite(sample.speed)) return false;
    if (sample.speed < 0 || sample.speed > 160) return false;
    if (sample.gpsQuality != null && Number(sample.gpsQuality) <= 0) return false;
    if (prev && isFinite(prev.speed)) {
      var gap = secondsBetween(prev.at, sample.at);
      if (gap > 0 && gap <= 15 && Math.abs(sample.speed - prev.speed) >= 45) return false;
    }
    return true;
  }
  function collectSpeedSamples(metrics, policy) {
    var raw = Array.isArray(metrics.samples) ? metrics.samples : [];
    var valid = [];
    var rejected = [];
    raw.map(function (item) { return normalizeSpeedSample(item, policy); }).filter(Boolean).sort(function (a, b) {
      return parseStamp(a.at) - parseStamp(b.at);
    }).forEach(function (sample) {
      var prev = valid.length ? valid[valid.length - 1] : null;
      if (!speedSampleAccept(sample, prev)) rejected.push(sample);
      else valid.push(sample);
    });
    return { valid: valid, rejected: rejected };
  }
  function instantSpeedRisk(speed, levels, recoverSpeed) {
    var matched = null;
    levels.forEach(function (level) {
      if (Number(speed) >= Number(level.speedThreshold)) matched = level;
    });
    if (matched) return matched.level;
    var lowest = levels[0];
    if (lowest && Number(speed) > Number(recoverSpeed) && Number(speed) < Number(lowest.speedThreshold)) return '滞回观察';
    return '未达触发阈值';
  }
  function speedTriggerSentence(level) {
    if (!level) return '—';
    return '≥' + level.speedThreshold + ' km/h 持续' + formatDuration(level.durationSeconds);
  }
  function evaluateSpeed(currentSignal, rule) {
    var metricsIn = currentSignal.metrics || {};
    if (!rule) return evaluation(null, metricsIn, [], { episode: false });
    var levels = enabledLevels(rule).slice().sort(function (a, b) { return levelRank(a.level) - levelRank(b.level); });
    if (!levels.length) return evaluation(null, metricsIn, [], { episode: false });
    var recoverSpeed = Number((rule.recoveryConfig || {}).recoverSpeedKph);
    if (!isFinite(recoverSpeed)) recoverSpeed = 75;
    var recoverNeed = Number((rule.recoveryConfig || {}).recoverDurationSeconds);
    if (!isFinite(recoverNeed) || recoverNeed <= 0) recoverNeed = 30;
    var parsed = collectSpeedSamples(metricsIn, rule.speedSourcePolicy || 'CAN_THEN_GPS');
    var valid = parsed.valid;
    var lowest = levels[0];
    var overspeedStart = null;
    var alertAt = null;
    var initialLevel = null;
    var maxLevel = null;
    var maxLevelConfig = null;
    var criticalAt = null;
    var recoverStart = null;
    var recoveredAt = null;
    var recoverReason = '';
    var heldSince = {};
    var achieved = {};
    var timeline = [];
    var last = null;
    var speedSource = '';
    function markAchieved(level, at) {
      if (achieved[level.level]) return;
      achieved[level.level] = at;
      if (!alertAt) {
        alertAt = at;
        initialLevel = level.level;
        timeline.push({ action: 'ALERT_CREATED', at: at, to: level.level, remark: '车速 ≥' + level.speedThreshold + ' km/h 持续' + formatDuration(level.durationSeconds) + '。' });
      } else if (!maxLevel || levelRank(level.level) > levelRank(maxLevel)) {
        timeline.push({ action: 'LEVEL_UPGRADE', at: at, from: maxLevel, to: level.level, remark: '车速 ≥' + level.speedThreshold + ' km/h 持续' + formatDuration(level.durationSeconds) + '。' });
      }
      if (!maxLevel || levelRank(level.level) > levelRank(maxLevel)) {
        maxLevel = level.level;
        maxLevelConfig = level;
        if (level.level === '紧急') criticalAt = at;
      }
    }
    valid.forEach(function (sample) {
      if (recoveredAt) return;
      var speed = sample.speed;
      last = sample;
      speedSource = sample.source || speedSource;
      if (!overspeedStart) {
        if (speed >= Number(lowest.speedThreshold)) {
          overspeedStart = sample.at;
          timeline.push({ action: 'SPEED_START', at: sample.at, remark: '车辆速度达到 ' + formatSpeed(speed) + '，开始累计超速时长。' });
        } else return;
      }
      if (speed <= recoverSpeed) {
        if (alertAt) {
          if (!recoverStart) recoverStart = sample.at;
          if (secondsBetween(recoverStart, sample.at) >= recoverNeed) {
            recoveredAt = formatStamp(parseStamp(recoverStart) + recoverNeed * 1000);
            recoverReason = '车速 ≤' + recoverSpeed + ' km/h 持续' + formatDuration(recoverNeed) + '，本次超速事件恢复。';
            timeline.push({ action: 'RECOVERED', at: recoveredAt, remark: recoverReason });
          }
        } else {
          overspeedStart = null;
          heldSince = {};
          recoverStart = null;
          timeline = timeline.filter(function (node) { return node.action !== 'SPEED_START'; });
        }
        levels.forEach(function (level) { heldSince[level.level] = null; });
        return;
      }
      recoverStart = null;
      if (!alertAt && speed < Number(lowest.speedThreshold)) {
        overspeedStart = null;
        heldSince = {};
        timeline = timeline.filter(function (node) { return node.action !== 'SPEED_START'; });
        return;
      }
      levels.forEach(function (level) {
        if (speed >= Number(level.speedThreshold)) {
          if (!heldSince[level.level]) heldSince[level.level] = sample.at;
          if (secondsBetween(heldSince[level.level], sample.at) >= Number(level.durationSeconds)) {
            markAchieved(level, formatStamp(parseStamp(heldSince[level.level]) + Number(level.durationSeconds) * 1000));
          }
        } else heldSince[level.level] = null;
      });
    });
    if (!alertAt) {
      return evaluation(null, Object.assign({}, metricsIn, {
        speed: last ? last.speed : null,
        rejectedCount: parsed.rejected.length,
        speedSource: speedSource,
        mockSource: 'frontend-demo'
      }), [], { episode: false, timeline: [] });
    }
    var sum = 0;
    var count = 0;
    var maxSpeed = null;
    valid.forEach(function (sample) {
      var at = parseStamp(sample.at);
      if (at < parseStamp(overspeedStart)) return;
      if (recoveredAt && at > parseStamp(recoveredAt)) return;
      if (maxSpeed == null || sample.speed > maxSpeed) maxSpeed = sample.speed;
      sum += sample.speed;
      count += 1;
    });
    var currentSpeed = last ? last.speed : null;
    if (recoveredAt) {
      var closed = valid.filter(function (sample) { return parseStamp(sample.at) <= parseStamp(recoveredAt); });
      if (closed.length) currentSpeed = closed[closed.length - 1].speed;
    }
    var avg = count ? Math.round((sum / count) * 10) / 10 : maxSpeed;
    var risk = recoveredAt ? '已恢复' : instantSpeedRisk(currentSpeed, levels, recoverSpeed);
    var durationEnd = recoveredAt || nowText();
    var metrics = Object.assign({}, metricsIn, {
      speed: currentSpeed,
      maxSpeed: maxSpeed,
      avgSpeed: avg,
      overspeedStartedAt: overspeedStart,
      alertCreatedAt: alertAt,
      recoveredAt: recoveredAt,
      overspeedDurationSeconds: secondsBetween(overspeedStart, durationEnd),
      speedSource: speedSource,
      lastDataAt: (!recoveredAt && currentSignal.live !== false) ? nowText() : (last && last.at),
      triggerSpeed: maxLevelConfig ? maxLevelConfig.speedThreshold : null,
      triggerDurationSeconds: maxLevelConfig ? maxLevelConfig.durationSeconds : null,
      initialLevel: initialLevel,
      maxAlertLevel: maxLevel,
      criticalAt: criticalAt,
      realtimeRisk: risk,
      recoverReason: recoverReason,
      rejectedCount: parsed.rejected.length,
      mockSource: 'frontend-demo'
    });
    var facts = [
      '超速开始：' + overspeedStart,
      '当前车速：' + formatSpeed(currentSpeed),
      '最高车速：' + formatSpeed(maxSpeed),
      '平均车速：' + formatSpeed(avg),
      '速度来源：' + speedSourceLabel(speedSource),
      '触发规则：' + speedTriggerSentence(maxLevelConfig),
      recoveredAt ? ('已于 ' + recoveredAt + ' 恢复') : '当前仍在超速'
    ];
    timeline.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
    return evaluation(recoveredAt ? null : maxLevelConfig, metrics, facts, {
      episode: true,
      recovered: !!recoveredAt,
      maxLevel: maxLevel,
      initialLevel: initialLevel,
      currentRiskLevel: risk,
      timeline: timeline
    });
  }
  function departSourceText(code) {
    if (code === 'DRIVER') return '司机离场';
    if (code === 'GEOFENCE') return '围栏离场';
    if (code === 'MANUAL') return '人工修正';
    return '—';
  }
  function keepHigherLevel(rule, matched, prior, field) {
    var priorName = prior && (prior.maxLevel || prior.level);
    if (!priorName) return matched;
    if (!matched) return levelByName(rule, priorName);
    if (levelRank(priorName) > levelRank(matched.level)) return levelByName(rule, priorName) || matched;
    return matched;
  }
  function telemetryFresh(lastAt, evalAt, validMinutes, explicitValid) {
    if (explicitValid === false) return false;
    if (!lastAt) return explicitValid !== false;
    var age = minutesBetween(lastAt, evalAt);
    if (age == null) return true;
    return age <= Number(validMinutes || 5);
  }
  function evaluateWeighbill(currentSignal, rule, prior) {
    var m = Object.assign({}, prior || {}, currentSignal.metrics || {});
    var evalAt = m.evaluatedAt || currentSignal.evaluatedAt || evaluationTime(currentSignal);
    m.evaluatedAt = evalAt;
    m.weighbillType = m.weighbillType || '卸货磅单';
    if (m.departedUnload == null && m.leftUnload === true) m.departedUnload = true;
    if (m.unloadDepartedAt && m.departedUnload === true) {
      var wait = minutesBetween(m.unloadDepartedAt, m.uploadedAt || evalAt);
      if (wait != null) m.waitingMinutes = wait;
    }
    var block = '';
    if (!currentSignal.taskId && !m.taskId) block = '无有效任务单';
    else if (m.taskCancelled === true || m.taskStatus === '已取消') block = '任务已取消';
    else if (m.unloadNodeVoid === true) block = '卸货节点已作废';
    else if (!m.unloadNodeId) block = '缺少卸货节点';
    else if (m.arrivedUnload !== true) block = '未确认到达卸货地';
    else if (m.departedUnload !== true || !m.unloadDepartedAt) block = '尚未形成有效离场';
    else if (!m.departTimeSource) block = '无法确认有效离场来源';
    else if (m.weighbillNotRequired === true || m.weighbillStatus === '无需磅单') block = '无需磅单';
    else if (m.uploading === true || m.weighbillStatus === '上传处理中') block = '上传处理中';
    else if (m.weighbillUploaded === true || m.weighbillStatus === '已上传') block = '已上传';
    var facts = [
      '卸货地：' + (m.unloadLocation || currentSignal.location || '—'),
      m.unloadArrivedAt ? ('到达卸货地：' + m.unloadArrivedAt) : '尚未确认到达卸货地',
      m.unloadDepartedAt ? ('离开卸货地：' + m.unloadDepartedAt) : '尚未离开卸货地',
      '离场判断来源：' + departSourceText(m.departTimeSource),
      '磅单状态：' + (m.weighbillStatus || (m.weighbillUploaded ? '已上传' : '未上传')),
      '已超时：' + (m.waitingMinutes == null ? '—' : m.waitingMinutes + '分钟')
    ];
    if (block) facts.push(block);
    if (block === '已上传' || block === '无需磅单') {
      m.recoverReason = block === '已上传' ? '磅单上传成功' : '确认无需磅单';
      return evaluation(null, m, facts, { recovered: true, maxLevel: prior && (prior.maxLevel || prior.level) });
    }
    if (block) return evaluation(null, m, facts, { episode: false });
    var matched = keepHigherLevel(rule, highestMatched(rule, function (item) {
      return Number(m.waitingMinutes) >= Number(item.threshold);
    }), prior);
    return evaluation(matched, m, facts, { maxLevel: matched ? matched.level : null });
  }
  function evaluateSoc(currentSignal, rule, prior) {
    var m = Object.assign({}, prior || {}, currentSignal.metrics || {});
    var evalAt = m.evaluatedAt || currentSignal.evaluatedAt || evaluationTime(currentSignal);
    m.evaluatedAt = evalAt;
    var confirmNeed = Number((rule && rule.confirmConfig || {}).confirmMinutes || 2);
    var validMinutes = Number((rule && rule.confirmConfig || {}).dataValidMinutes || 5);
    var recoverSoc = Number((rule && rule.recoveryConfig || {}).recoverSoc || 35);
    var recoverNeed = Number((rule && rule.recoveryConfig || {}).recoverDurationMinutes || 2);
    var fresh = telemetryFresh(m.lastTelemetryAt, evalAt, validMinutes, m.telemetryValid);
    m.telemetryValid = fresh;
    m.dataExpired = !fresh;
    var soc = Number(m.soc);
    var facts = [
      '当前 SOC：' + (isFinite(soc) ? soc + '%' : '—'),
      '充电状态：' + (m.chargingStatus || '未充电'),
      '数据来源：' + (m.socSource === 'GPS' ? 'GPS' : '车辆 CAN/T-BOX'),
      '数据时间：' + (m.lastTelemetryAt || '—'),
      fresh ? 'SOC 数据有效' : '数据已过期'
    ];
    if (!fresh) return evaluation(null, m, facts, { hold: true, episode: !!(prior && prior.level) });
    var matchedNow = highestMatched(rule, function (item) { return isFinite(soc) && soc <= Number(item.threshold); });
    if (!matchedNow) {
      m.thresholdCandidateStartedAt = null;
      if (isFinite(soc) && soc >= recoverSoc) {
        var recoverStart = m.recoverCandidateStartedAt || evalAt;
        if (!(prior && prior.recoverCandidateStartedAt) && m.recoverCandidateStartedAt == null) recoverStart = evalAt;
        if (prior && prior.recoverCandidateStartedAt) recoverStart = prior.recoverCandidateStartedAt;
        else if (m.recoverCandidateStartedAt) recoverStart = m.recoverCandidateStartedAt;
        m.recoverCandidateStartedAt = recoverStart;
        var held = minutesBetween(recoverStart, evalAt);
        if (held != null && held >= recoverNeed) {
          m.recoverReason = 'SOC ≥ ' + recoverSoc + '% 持续 ≥ ' + recoverNeed + '分钟';
          return evaluation(null, m, facts, { recovered: true, maxLevel: prior && (prior.maxLevel || prior.level) });
        }
        var waiting = keepHigherLevel(rule, null, prior);
        if (waiting) return evaluation(waiting, m, facts, { maxLevel: waiting.level });
        return evaluation(null, m, facts);
      }
      m.recoverCandidateStartedAt = null;
      var heldLevel = keepHigherLevel(rule, null, prior);
      if (heldLevel) return evaluation(heldLevel, m, facts, { maxLevel: heldLevel.level });
      return evaluation(null, m, facts);
    }
    m.recoverCandidateStartedAt = null;
    var candidate = (prior && prior.thresholdCandidateStartedAt) || m.thresholdCandidateStartedAt || evalAt;
    m.thresholdCandidateStartedAt = candidate;
    var confirmedFor = minutesBetween(candidate, evalAt);
    if (confirmedFor == null) confirmedFor = 0;
    facts.push('低 SOC 已持续 ' + confirmedFor + ' 分钟');
    if (confirmedFor < confirmNeed && !(prior && (prior.maxLevel || prior.level))) {
      return evaluation(null, m, facts, { episode: false });
    }
    var matched = keepHigherLevel(rule, matchedNow, prior);
    if (prior && (prior.maxLevel || prior.level) && levelRank(matchedNow.level) > levelRank(prior.maxLevel || prior.level) && confirmedFor < confirmNeed) {
      matched = levelByName(rule, prior.maxLevel || prior.level) || matched;
    }
    return evaluation(matched, m, facts, { maxLevel: matched ? matched.level : null });
  }
  function evaluateFatigue(currentSignal, rule, prior) {
    var m = Object.assign({}, prior || {}, currentSignal.metrics || {});
    var evalAt = m.evaluatedAt || currentSignal.evaluatedAt || evaluationTime(currentSignal);
    m.evaluatedAt = evalAt;
    var driveSpeed = Number((rule && rule.detectConfig || {}).drivingSpeedKph || 5);
    var validMinutes = Number((rule && rule.detectConfig || {}).dataValidMinutes || 5);
    var restNeed = Number((rule && rule.recoveryConfig || {}).restThresholdMinutes || 20);
    var fresh = telemetryFresh(m.lastTelemetryAt, evalAt, validMinutes, m.telemetryValid);
    m.telemetryValid = fresh;
    var speed = Number(m.currentSpeed);
    if (m.driverChanged === true) {
      m.recoverReason = '驾驶员变更';
      m.drivingCycleActive = false;
      m.drivingState = 'ended';
      return evaluation(null, m, ['驾驶员变更，结束当前司机在当前车辆上的驾驶周期'], { recovered: true, maxLevel: prior && (prior.maxLevel || prior.level) });
    }
    if (!fresh) {
      m.dataInsufficient = true;
      m.drivingState = 'unknown';
      if (m.continuousDrivingMinutes == null && prior) m.continuousDrivingMinutes = prior.continuousDrivingMinutes;
      var frozen = prior && (prior.maxLevel || prior.level) ? levelByName(rule, prior.maxLevel || prior.level) : null;
      return evaluation(frozen, m, ['速度数据长时间未更新，已暂停疲劳升级'], { hold: !frozen, maxLevel: frozen ? frozen.level : null, episode: !!frozen });
    }
    if (m.drivingCycleActive !== false && m.drivingStartedAt) {
      var elapsed = minutesBetween(m.drivingStartedAt, evalAt);
      if (elapsed != null) m.continuousDrivingMinutes = elapsed;
    }
    var driving = isFinite(speed) && speed > driveSpeed;
    if (driving) {
      m.parkingStartedAt = null;
      m.continuousParkingMinutes = 0;
      m.drivingState = 'driving';
    } else if (m.parkingStartedAt) {
      var parked = minutesBetween(m.parkingStartedAt, evalAt);
      m.continuousParkingMinutes = parked == null ? Number(m.continuousParkingMinutes || 0) : parked;
      m.drivingState = m.continuousParkingMinutes >= restNeed ? 'resting' : 'short_stop';
    } else {
      m.continuousParkingMinutes = Number(m.continuousParkingMinutes || 0);
      m.drivingState = m.continuousParkingMinutes >= restNeed ? 'resting' : 'short_stop';
    }
    var facts = [
      '司机连续驾驶周期：' + (m.drivingCycleId || currentSignal.drivingCycleId || '—'),
      '周期开始：' + (m.drivingStartedAt || '—'),
      '连续驾驶：' + (m.continuousDrivingMinutes == null ? '—' : m.continuousDrivingMinutes + '分钟'),
      '当前车速：' + (isFinite(speed) ? speed + ' km/h' : '—'),
      '当前停车：' + (m.continuousParkingMinutes || 0) + '分钟',
      m.drivingState === 'short_stop' ? '短停不重置连续驾驶' : (m.drivingState === 'resting' ? '已达到有效休息' : '驾驶数据有效')
    ];
    if (m.drivingCycleActive === false || Number(m.continuousParkingMinutes || 0) >= restNeed) {
      m.recoverReason = '连续非驾驶达到' + restNeed + '分钟，有效休息成立';
      m.drivingCycleActive = false;
      m.lastEffectiveRestAt = m.lastEffectiveRestAt || evalAt;
      m.drivingState = 'resting';
      return evaluation(null, m, facts, { recovered: true, maxLevel: prior && (prior.maxLevel || prior.level) });
    }
    if (!currentSignal.driverId && !m.driverId) return evaluation(null, m, facts.concat(['缺少绑定司机']), { episode: false });
    var matchedNow = highestMatched(rule, function (item) { return Number(m.continuousDrivingMinutes) >= Number(item.thresholdMinutes); });
    var matched = keepHigherLevel(rule, matchedNow, prior);
    return evaluation(matched, m, facts, { maxLevel: matched ? matched.level : null });
  }
  function evaluateSignal(currentSignal, rule, priorCycle) {
    if (!rule) return evaluation(null, currentSignal.metrics, currentSignal.facts);
    switch (rule.code) {
      case 'TRANSPORT_PARKING': return evaluateParking(currentSignal, rule, priorCycle);
      case AREA_STAY_CODE:
      case AREA_STAY_LEGACY: return evaluateParkingArea(currentSignal, rule);
      case 'VEHICLE_OVERSPEED': return evaluateSpeed(currentSignal, rule);
      case 'UNLOAD_WEIGHBILL_MISSING': return evaluateWeighbill(currentSignal, rule, priorCycle);
      case 'VEHICLE_LOW_SOC': return evaluateSoc(currentSignal, rule, priorCycle);
      case 'DRIVER_FATIGUE': return evaluateFatigue(currentSignal, rule, priorCycle);
      default: return evaluation(null, currentSignal.metrics, currentSignal.facts);
    }
  }

  function eventKey(currentSignal) {
    var metrics = (currentSignal && currentSignal.metrics) || {};
    if (currentSignal.ruleCode === 'TRANSPORT_PARKING') {
      var cycle = metrics.parkingStartedAt || metrics.staticCandidateStartAt || currentSignal.sourceId || currentSignal.taskId || 'CYCLE';
      return ['TRANSPORT_PARKING', currentSignal.vehicleId || currentSignal.plate, cycle].join('|');
    }
    if (isAreaStayCode(currentSignal.ruleCode)) {
      var fence = areaStaySignalFence(currentSignal);
      var enter = metrics.enteredAt || currentSignal.enterTime || currentSignal.sourceId || 'CYCLE';
      return [AREA_STAY_CODE, currentSignal.vehicleId || currentSignal.plate, fence.id || fence.name || 'NO_FENCE', enter].join('|');
    }
    if (currentSignal.ruleCode === 'VEHICLE_OVERSPEED') {
      return ['VEHICLE_OVERSPEED', currentSignal.plate || currentSignal.vehicleId || 'NO_VEHICLE', currentSignal.sourceId || metrics.overspeedStartedAt || 'CYCLE'].join('|');
    }
    if (currentSignal.ruleCode === 'UNLOAD_WEIGHBILL_MISSING') {
      return ['UNLOAD_WEIGHBILL_MISSING', currentSignal.taskId || 'NO_TASK', metrics.unloadNodeId || 'NO_NODE', metrics.weighbillType || '卸货磅单'].join('|');
    }
    if (currentSignal.ruleCode === 'VEHICLE_LOW_SOC') {
      return ['VEHICLE_LOW_SOC', currentSignal.vehicleId || currentSignal.plate || 'NO_VEHICLE', metrics.socCycleId || currentSignal.socCycleId || currentSignal.sourceId || 'CYCLE'].join('|');
    }
    if (currentSignal.ruleCode === 'DRIVER_FATIGUE') {
      return ['DRIVER_FATIGUE', currentSignal.driverId || 'NO_DRIVER', currentSignal.drivingCycleId || metrics.drivingCycleId || 'CYCLE'].join('|');
    }
    return [currentSignal.ruleCode, currentSignal.vehicleId || currentSignal.plate, currentSignal.taskId || 'NO_TASK'].join('|');
  }
  function legacyEventKey(currentSignal) {
    var metrics = (currentSignal && currentSignal.metrics) || {};
    if (isAreaStayCode(currentSignal.ruleCode)) {
      var fence = areaStaySignalFence(currentSignal);
      return [AREA_STAY_CODE, currentSignal.vehicleId || currentSignal.plate, fence.id || fence.name || 'NO_FENCE'].join('|');
    }
    if (currentSignal.ruleCode === 'DRIVER_FATIGUE') return ['DRIVER_FATIGUE', currentSignal.driverId, currentSignal.drivingCycleId || metrics.drivingCycleId].join('|');
    if (currentSignal.ruleCode === 'VEHICLE_OVERSPEED') return ['VEHICLE_OVERSPEED', currentSignal.plate || currentSignal.vehicleId || 'NO_VEHICLE'].join('|');
    return [currentSignal.ruleCode, currentSignal.vehicleId || currentSignal.plate, currentSignal.taskId || 'NO_TASK'].join('|');
  }
  function ruleSnapshot(rule, result) {
    var levelName = result && result.level;
    var level = levelName ? levelByName(rule, levelName) : null;
    return {
      ruleId: rule.id, ruleCode: rule.code, ruleName: rule.name, category: rule.category,
      ruleVersion: rule.updatedAt || nowText(), updatedAt: rule.updatedAt || nowText(),
      triggerLevel: levelName || null,
      triggerThreshold: level && level.threshold != null ? level.threshold : null,
      stillSpeedKph: ((rule.detectConfig || {}).stillSpeedKph),
      minStillMinutes: ((rule.detectConfig || {}).minStillMinutes),
      recoverSpeedKph: ((rule.recoveryConfig || {}).recoverSpeedKph),
      recoverDurationMinutes: ((rule.recoveryConfig || {}).recoverDurationMinutes),
      levels: clone(rule.levels), recoveryConfig: clone(rule.recoveryConfig),
      detectConfig: clone(rule.detectConfig || null), confirmConfig: clone(rule.confirmConfig || null), monitorPeriod: rule.monitorPeriod || '全天',
      monitorStart: rule.monitorStart || '', monitorEnd: rule.monitorEnd || '',
      scopeType: rule.scopeType || '全部项目',
      speedSourcePolicy: rule.speedSourcePolicy || '',
      projectIds: clone(rule.projectIds || []),
      projectNames: clone(rule.projectNames || []),
      departmentIds: clone(rule.departmentIds || []),
      departmentNames: clone(rule.departmentNames || []),
      vehiclePlates: clone(rule.vehiclePlates || []),
      areaType: rule.areaType || '全部类型',
      fenceIds: clone(rule.fenceIds || []),
      fenceNames: clone(rule.fenceNames || []),
      capturedAt: nowText()
    };
  }
  function snapshotRule(snapshot, code) {
    return {
      id: snapshot.ruleId, code: snapshot.ruleCode || code, name: snapshot.ruleName,
      enabled: true, levels: clone(snapshot.levels || []),
      recoveryConfig: clone(snapshot.recoveryConfig || {}),
      detectConfig: clone(snapshot.detectConfig || defaultParkingDetect()),
      confirmConfig: clone(snapshot.confirmConfig || null),
      monitorPeriod: snapshot.monitorPeriod || '全天',
      monitorStart: snapshot.monitorStart, monitorEnd: snapshot.monitorEnd,
      scopeType: snapshot.scopeType || '全部项目',
      speedSourcePolicy: snapshot.speedSourcePolicy || 'CAN_THEN_GPS',
      projectIds: clone(snapshot.projectIds || []),
      projectNames: clone(snapshot.projectNames || []),
      departmentIds: clone(snapshot.departmentIds || []),
      departmentNames: clone(snapshot.departmentNames || []),
      vehiclePlates: clone(snapshot.vehiclePlates || []),
      areaType: snapshot.areaType || '全部类型',
      fenceIds: clone(snapshot.fenceIds || []),
      fenceNames: clone(snapshot.fenceNames || []),
      updatedAt: snapshot.updatedAt || snapshot.ruleVersion || snapshot.capturedAt
    };
  }
  function valueText(currentSignal) {
    var m = currentSignal.metrics || {};
    if (currentSignal.displayValue) return currentSignal.displayValue;
    if (currentSignal.ruleCode === 'TRANSPORT_PARKING') return '连续异常停车' + m.parkingMinutes + '分钟';
    if (isAreaStayCode(currentSignal.ruleCode)) return '区域停留' + m.areaDwellMinutes + '分钟';
    if (currentSignal.ruleCode === 'VEHICLE_OVERSPEED') return formatSpeed(m.speed) + ' · 最高 ' + formatSpeed(m.maxSpeed);
    if (currentSignal.ruleCode === 'UNLOAD_WEIGHBILL_MISSING') return '未上传 · ' + m.waitingMinutes + '分钟';
    if (currentSignal.ruleCode === 'VEHICLE_LOW_SOC') return 'SOC ' + m.soc + '%';
    if (currentSignal.ruleCode === 'DRIVER_FATIGUE') return '连续驾驶' + m.continuousDrivingMinutes + '分钟';
    return '—';
  }
  function firstHistoryAt(history, actions) {
    var hit = (history || []).filter(function (item) { return actions.indexOf(item.action) >= 0; })[0];
    return hit && hit.at;
  }
  function lastHistoryAt(history, actions) {
    var list = (history || []).filter(function (item) { return actions.indexOf(item.action) >= 0; });
    return list.length ? list[list.length - 1].at : null;
  }
  function speedHandleRemark(record) {
    var operator = (record && record.handler) || OPERATOR;
    var type = (record && record.handleType) || '其他';
    var result = (record && record.handleResult) || '';
    var lead = operator + '已登记处理：' + type + '。';
    if (type === '电话提醒司机') lead = operator + '通过电话提醒司机降速。';
    else if (type === '通知车队长') lead = operator + '已通知车队长。';
    else if (type === '安全教育') lead = operator + '已安排安全教育。';
    else if (type === '确认误报') lead = operator + '确认误报，原因：' + ((record && record.falseAlarmReason) || '其他') + '。';
    else if (type === '无需处理') lead = operator + '确认本次无需处理。';
    return result ? (lead + result) : lead;
  }
  function applySpeedEvent(event, currentSignal, result) {
    var metrics = result.metrics || {};
    event.metrics = clone(metrics);
    event.facts = clone(result.facts || []);
    var maxLevel = result.maxLevel || metrics.maxAlertLevel || event.maxAlertLevel || event.level || '一般';
    event.maxAlertLevel = maxLevel;
    event.level = maxLevel;
    event.initialLevel = result.initialLevel || metrics.initialLevel || event.initialLevel || maxLevel;
    event.realtimeRisk = result.currentRiskLevel || metrics.realtimeRisk || (result.recovered ? '已恢复' : maxLevel);
    event.currentLevel = maxLevel;
    event.overspeedStartedAt = metrics.overspeedStartedAt || event.overspeedStartedAt || null;
    event.alertCreatedAt = metrics.alertCreatedAt || event.alertCreatedAt || event.triggeredAt;
    event.triggeredAt = event.alertCreatedAt || event.triggeredAt;
    event.criticalAt = metrics.criticalAt || event.criticalAt || (maxLevel === '紧急' ? event.alertCreatedAt : null);
    event.maxSpeed = metrics.maxSpeed;
    event.avgSpeed = metrics.avgSpeed;
    event.speedSource = metrics.speedSource || event.speedSource || '';
    event.lastDataAt = metrics.lastDataAt || event.lastDataAt || null;
    event.triggerSpeed = metrics.triggerSpeed;
    event.triggerDurationSeconds = metrics.triggerDurationSeconds;
    event.location = (currentSignal && currentSignal.location) || event.location;
    event.currentValueText = formatSpeed(metrics.speed);
    event.type = '车速预警';
    event.falsePositive = !!(event.falsePositive || (currentSignal && currentSignal.seedFalseAlarm));
    var falseRecord = (event.handleRecords || []).filter(function (item) { return item && item.falseAlarmReason; })[0];
    if (falseRecord) event.falseAlarmReason = falseRecord.falseAlarmReason;
    else if (currentSignal && currentSignal.seedFalseAlarm) event.falseAlarmReason = event.falseAlarmReason || 'GPS漂移';
    if (result.recovered) {
      event.eventStatus = '已恢复';
      event.recoveredAt = metrics.recoveredAt || (currentSignal && currentSignal.recoveredAt) || event.recoveredAt;
      event.recoverReason = metrics.recoverReason || event.recoverReason || null;
    } else if (event.eventStatus !== '已恢复') {
      event.eventStatus = '发生中';
      event.recoveredAt = null;
      event.recoverReason = null;
    }
    event.acknowledgedAt = null;
    event.acknowledgedBy = null;
    return event;
  }
  function appendSpeedSeedLogs(logs, event, timeline) {
    (timeline || []).forEach(function (node) {
      logs.push({ id: logId(logs.length), alertId: event.id, action: node.action, operator: node.operator || '系统', operatedAt: node.at, remark: node.remark || '', fromLevel: node.from || null, toLevel: node.to || null });
    });
    (event.handleRecords || []).forEach(function (record) {
      logs.push({ id: logId(logs.length), alertId: event.id, action: 'HANDLED', operator: record.handler || OPERATOR, operatedAt: record.handleTime, remark: speedHandleRemark(record), fromLevel: null, toLevel: null });
    });
  }
  function mergeSpeedTimeline(event, timeline) {
    var added = false;
    (timeline || []).forEach(function (node) {
      if (!node || !node.action || !node.at) return;
      var exists = state.logs.some(function (log) {
        return log.alertId === event.id && log.action === node.action && log.operatedAt === node.at;
      });
      if (exists) return;
      addLog(event.id, node.action, node.remark || '', { operator: node.operator || '系统', operatedAt: node.at, fromLevel: node.from || null, toLevel: node.to || null });
      added = true;
    });
    return added;
  }
  function seedHandleRecords(currentSignal) {
    if (Array.isArray(currentSignal.seedHandle) && currentSignal.seedHandle.length) return clone(currentSignal.seedHandle);
    if (currentSignal.sourceId === 'live-area-emergency-handled') {
      return [
        { handleTime: '2026-10-08 10:25:00', handler: OPERATOR, handleType: '联系司机', handleResult: '现场正在排队，预计稍后放行', falseAlarmReason: '', markDone: false },
        { handleTime: '2026-10-08 10:50:00', handler: OPERATOR, handleType: '继续观察', handleResult: '司机反馈仍在排队，已登记后续安排', falseAlarmReason: '', markDone: true }
      ];
    }
    if (currentSignal.sourceId === 'live-area-false-alarm') {
      return [
        { handleTime: '2026-10-08 11:10:00', handler: OPERATOR, handleType: '误报', handleResult: '核对定位后判定围栏边界抖动/GPS 漂移，不改写真实围栏状态。', falseAlarmReason: 'GPS 漂移', markDone: true }
      ];
    }
    if (currentSignal.sourceId === 'live-parking-handled') {
      return [
        { handleTime: '2026-10-08 10:13:00', handler: OPERATOR, handleType: '联系司机', handleResult: '已联系司机，车辆因前方事故拥堵临时停车，司机及车辆正常，持续关注。', parkingReason: '道路拥堵', falseAlarmReason: '', markDone: true }
      ];
    }
    return [];
  }
  function eventFromSignal(currentSignal, rule, result, id) {
    var handling = currentSignal.sourceId === 'live-stop';
    var handled = currentSignal.sourceId === 'live-parking-handled' || currentSignal.seedHandleStatus === '已处理';
    var metrics = result.metrics || {};
    var fence = areaStaySignalFence(Object.assign({}, currentSignal, { metrics: metrics }));
    var handleRecords = seedHandleRecords(currentSignal);
    var createdAt = firstHistoryAt(currentSignal.history, ['ALERT_CREATED', 'TRIGGERED']) || currentSignal.triggeredAt || currentSignal.detectedAt || nowText();
    var levelTriggerAt = lastHistoryAt(currentSignal.history, ['LEVEL_UPGRADE', 'LEVEL_UPGRADED', 'ALERT_CREATED', 'TRIGGERED']) || createdAt;
    var event = {
      id: id, sourceId: currentSignal.sourceId, eventKey: eventKey(currentSignal), drivingCycleId: currentSignal.drivingCycleId || (currentSignal.metrics || {}).drivingCycleId || null,
      ruleId: rule.id, ruleCode: isAreaStayCode(rule.code) ? AREA_STAY_CODE : rule.code, category: rule.category,
      alertType: isAreaStayCode(rule.code) ? AREA_STAY_CODE : rule.code,
      type: isAreaStayCode(rule.code) ? '区域停留预警' : ({ TRANSPORT_PARKING: '停车预警', VEHICLE_OVERSPEED: '车速预警', UNLOAD_WEIGHBILL_MISSING: '卸货后未上传磅单', VEHICLE_LOW_SOC: 'SOC预警', DRIVER_FATIGUE: '疲劳驾驶预警' }[rule.code] || rule.name),
      ruleName: rule.name,
      initialLevel: (currentSignal.history || []).filter(function (item) { return item.level; })[0] && (currentSignal.history || []).filter(function (item) { return item.level; })[0].level || result.level,
      level: currentSignal.finalLevel || result.level || '一般',
      currentLevel: currentSignal.finalLevel || result.level || '一般',
      maxLevel: result.maxLevel || currentSignal.finalLevel || result.level || '一般',
      projectId: currentSignal.projectId || fence.projectId || PROJECT_ID,
      projectName: currentSignal.projectName || fence.projectName || PROJECT_NAME,
      departmentName: currentSignal.departmentName || departmentOfProject(currentSignal.projectId || fence.projectId || PROJECT_ID),
      vehicleId: currentSignal.vehicleId || 'FV-' + String(currentSignal.plate || '').replace(/[^A-Z0-9\u4e00-\u9fa5]/gi, ''), plate: currentSignal.plate,
      driverId: currentSignal.driverId, driverName: currentSignal.driverName, taskId: currentSignal.taskId,
      route: currentSignal.route, cargo: currentSignal.cargo, location: currentSignal.location,
      transportStage: transportStageText(metrics.taskNode || currentSignal.transportStage),
      fenceId: fence.id, fenceName: fence.name, fenceType: fence.type,
      areaRelation: metrics.areaRelation || 'UNKNOWN',
      enterTime: metrics.enteredAt || null,
      leaveTime: metrics.leaveTime || currentSignal.recoveredAt || null,
      firstAlertTime: createdAt,
      currentLevelTriggerTime: levelTriggerAt,
      triggeredAt: createdAt,
      recoveredAt: currentSignal.recoveredAt || null,
      recoverReason: currentSignal.sourceStatus === 'recovered' ? (currentSignal.recoverReason || (metrics && metrics.recoverReason) || (isAreaStayCode(rule.code) ? '离开区域自动恢复' : null)) : null,
      recoverCondition: isAreaStayCode(rule.code) ? ('车辆离开' + (fence.name || '对应电子围栏')) : null,
      currentStayDuration: metrics.currentStayDuration,
      finalStayDuration: metrics.finalStayDuration,
      triggerCondition: null,
      currentValueText: valueText(Object.assign({}, currentSignal, { metrics: result.metrics })),
      eventStatus: currentSignal.sourceStatus === 'recovered' ? '已恢复' : '发生中',
      handleStatus: handled ? '已处理' : handling ? '处理中' : '待处理',
      handleRecords: handleRecords,
      levelChangeLogs: (currentSignal.history || []).filter(function (item) {
        return item.action === 'LEVEL_UPGRADE' || item.action === 'LEVEL_UPGRADED' || item.action === 'ALERT_CREATED' || item.action === 'TRIGGERED';
      }).map(function (item) {
        return { at: item.at, from: item.from || null, to: item.to || item.level || null, remark: item.remark || '' };
      }),
      acknowledgedAt: handling ? '2026-10-08 09:06:00' : handled ? (handleRecords[0] && handleRecords[0].handleTime) || '2026-10-08 10:10:00' : null,
      acknowledgedBy: handling || handled ? OPERATOR : null,
      handlerId: handled ? 'U001' : null, handlerName: handled ? OPERATOR : null,
      handlingStartedAt: handled ? (handleRecords[0] && handleRecords[0].handleTime) || '2026-10-08 10:11:00' : null,
      handledAt: handled ? (handleRecords[handleRecords.length - 1] && handleRecords[handleRecords.length - 1].handleTime) || '2026-10-08 10:13:00' : null,
      handlingType: handled ? (handleRecords.length ? handleRecords[handleRecords.length - 1].handleType : (currentSignal.sourceId === 'live-parking-handled' ? '已联系司机' : '安排充电')) : null,
      parkingReason: handled && currentSignal.sourceId === 'live-parking-handled' ? '道路拥堵' : null,
      handlingResult: handled ? (handleRecords.length ? handleRecords[handleRecords.length - 1].handleResult : (currentSignal.sourceId === 'live-parking-handled' ? '已联系司机，车辆因前方事故拥堵临时停车，司机及车辆正常，持续关注。' : '已联系司机前往最近充电站，持续关注车辆电量。')) : null,
      falseAlarmReason: currentSignal.seedFalseAlarm ? 'GPS 漂移' : null,
      ruleSnapshot: ruleSnapshot(rule, result), metrics: clone(result.metrics), facts: clone(result.facts), lastDetectedAt: evaluationTime(currentSignal)
    };
    var matched = (event.ruleSnapshot.levels || []).filter(function (item) { return item.level === event.level && item.enabled !== false; })[0];
    if (isAreaStayCode(rule.code) && matched) event.triggerCondition = '区域停留 ≥ ' + matched.threshold + '分钟';
    if (rule.code === 'VEHICLE_OVERSPEED') applySpeedEvent(event, currentSignal, result);
    return event;
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
      if (currentSignal.ruleCode === 'VEHICLE_OVERSPEED') {
        if (!result.episode) return;
      } else if (!currentSignal.wasTriggered && (!rule.enabled || !result.triggered)) return;
      var event = eventFromSignal(currentSignal, rule, result, eventId(events.length));
      events.push(event);
      if (event.ruleCode === 'VEHICLE_OVERSPEED') appendSpeedSeedLogs(logs, event, result.timeline);
      else addSeedLogs(logs, event, currentSignal.history);
    });
    return { version: 9, rules: rules, events: events, logs: logs, parkingCycles: {} };
  }

  function migrateVeryOldRules(rules) {
    var map = { stop: 'TRANSPORT_PARKING', site: AREA_STAY_CODE, speed: 'VEHICLE_OVERSPEED', weigh: 'UNLOAD_WEIGHBILL_MISSING', soc: 'VEHICLE_LOW_SOC' };
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
      normalized.departmentIds = Array.isArray(savedRule.departmentIds) ? clone(savedRule.departmentIds) : clone(template.departmentIds || []);
      normalized.departmentNames = Array.isArray(savedRule.departmentNames) ? clone(savedRule.departmentNames) : clone(template.departmentNames || []);
      normalized.recoveryConfig.description = parkingRecoveryText(normalized.recoveryConfig);
    } else if (isAreaStayCode(normalized.code)) {
      normalized.code = AREA_STAY_CODE;
      normalized.alertType = AREA_STAY_CODE;
      normalized.areaType = savedRule.areaType || template.areaType || '全部类型';
      normalized.fenceIds = Array.isArray(savedRule.fenceIds) ? clone(savedRule.fenceIds) : clone(template.fenceIds || []);
      normalized.fenceNames = Array.isArray(savedRule.fenceNames) ? clone(savedRule.fenceNames) : clone(template.fenceNames || []);
      normalized.projectIds = Array.isArray(savedRule.projectIds) ? clone(savedRule.projectIds) : clone(template.projectIds || []);
      normalized.projectNames = Array.isArray(savedRule.projectNames) ? clone(savedRule.projectNames) : clone(template.projectNames || []);
      normalized.scopeType = savedRule.scopeType || template.scopeType || '全部项目';
      normalized.notifyConfig = Object.assign({ reserved: true, channels: ['站内消息', '调度工作台', '运输监控大屏', '企业微信', '短信', '司机端提醒'] }, clone(savedRule.notifyConfig || template.notifyConfig || {}));
      normalized.recoveryConfig = Object.assign({}, defaultAreaStayRecovery(), clone(savedRule.recoveryConfig || {}));
      normalized.recoveryConfig.description = defaultAreaStayRecovery().description;
    } else if (normalized.code === 'VEHICLE_OVERSPEED') {
      normalized.speedSourcePolicy = savedRule.speedSourcePolicy || template.speedSourcePolicy || 'CAN_THEN_GPS';
      normalized.scopeType = savedRule.scopeType || template.scopeType || '全部项目';
      normalized.projectIds = Array.isArray(savedRule.projectIds) ? clone(savedRule.projectIds) : clone(template.projectIds || []);
      normalized.projectNames = Array.isArray(savedRule.projectNames) ? clone(savedRule.projectNames) : clone(template.projectNames || []);
      if (normalized.scopeType !== '指定项目') {
        normalized.projectIds = [];
        normalized.projectNames = [];
      }
      normalized.levels = (normalized.levels || []).map(function (level) {
        if (!level.durationUnit) level.durationUnit = '秒';
        if (!isFinite(Number(level.durationSeconds)) || Number(level.durationSeconds) <= 0) level.durationSeconds = 60;
        return level;
      });
      if (normalized.recoveryConfig.recoverSpeedKph == null) normalized.recoveryConfig.recoverSpeedKph = 75;
      if (normalized.recoveryConfig.recoverDurationSeconds == null) normalized.recoveryConfig.recoverDurationSeconds = 30;
      normalized.recoveryConfig.description = speedRecoveryText(normalized.recoveryConfig);
    } else if (normalized.code === 'VEHICLE_LOW_SOC') {
      normalized.confirmConfig = Object.assign({ confirmMinutes: 2, dataValidMinutes: 5 }, clone(template.confirmConfig || {}), clone(savedRule.confirmConfig || {}));
      normalized.recoveryConfig = Object.assign({ recoverSoc: 35, recoverDurationMinutes: 2 }, clone(template.recoveryConfig || {}), clone(savedRule.recoveryConfig || {}));
      normalized.recoveryConfig.description = 'SOC ≥ ' + normalized.recoveryConfig.recoverSoc + '% 持续 ≥ ' + normalized.recoveryConfig.recoverDurationMinutes + '分钟';
      normalized.scopeType = savedRule.scopeType || template.scopeType || '全部项目';
      normalized.projectIds = Array.isArray(savedRule.projectIds) ? clone(savedRule.projectIds) : [];
      normalized.projectNames = Array.isArray(savedRule.projectNames) ? clone(savedRule.projectNames) : [];
    } else if (normalized.code === 'DRIVER_FATIGUE') {
      normalized.detectConfig = Object.assign({ drivingSpeedKph: 5, dataValidMinutes: 5 }, clone(template.detectConfig || {}), clone(savedRule.detectConfig || {}));
      normalized.recoveryConfig = Object.assign({}, clone(template.recoveryConfig || {}), clone(savedRule.recoveryConfig || {}));
      if (normalized.recoveryConfig.restThresholdMinutes == null) normalized.recoveryConfig.restThresholdMinutes = 20;
      normalized.recoveryConfig.description = '连续非驾驶达到有效休息时长，或驾驶员发生变更';
      normalized.scopeType = savedRule.scopeType || template.scopeType || '全部项目';
      normalized.projectIds = Array.isArray(savedRule.projectIds) ? clone(savedRule.projectIds) : [];
      normalized.projectNames = Array.isArray(savedRule.projectNames) ? clone(savedRule.projectNames) : [];
    } else if (normalized.code === 'UNLOAD_WEIGHBILL_MISSING') {
      normalized.detectConfig = Object.assign({ triggerNode: '离开卸货地', weighbillStatus: '未上传', ignoreUploading: true }, clone(template.detectConfig || {}), clone(savedRule.detectConfig || {}));
      normalized.recoveryConfig = Object.assign({}, clone(template.recoveryConfig || {}), clone(savedRule.recoveryConfig || {}));
      normalized.recoveryConfig.description = '磅单上传成功或确认无需磅单';
      normalized.scopeType = savedRule.scopeType || template.scopeType || '全部项目';
      normalized.projectIds = Array.isArray(savedRule.projectIds) ? clone(savedRule.projectIds) : [];
      normalized.projectNames = Array.isArray(savedRule.projectNames) ? clone(savedRule.projectNames) : [];
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
    if (!snap.detectConfig && template) snap.detectConfig = clone(template.detectConfig);
    snap.ruleId = snap.ruleId || event.ruleId || (template && template.id);
    snap.ruleCode = snap.ruleCode || event.ruleCode;
    snap.ruleName = snap.ruleName || event.type || (template && template.name);
    snap.category = snap.category || event.category || (template && template.category);
    snap.ruleVersion = snap.ruleVersion || snap.updatedAt || snap.capturedAt || event.triggeredAt;
    snap.updatedAt = snap.updatedAt || snap.ruleVersion;
    snap.triggerLevel = snap.triggerLevel || event.initialLevel || event.level;
    if (snap.triggerThreshold == null) {
      var snapLevel = (snap.levels || []).filter(function (item) { return item.level === snap.triggerLevel; })[0];
      snap.triggerThreshold = snapLevel && snapLevel.threshold != null ? snapLevel.threshold : null;
    }
    if (snap.stillSpeedKph == null && snap.detectConfig) snap.stillSpeedKph = snap.detectConfig.stillSpeedKph;
    if (snap.minStillMinutes == null && snap.detectConfig) snap.minStillMinutes = snap.detectConfig.minStillMinutes;
    if (snap.recoverSpeedKph == null && snap.recoveryConfig) snap.recoverSpeedKph = snap.recoveryConfig.recoverSpeedKph;
    if (snap.recoverDurationMinutes == null && snap.recoveryConfig) snap.recoverDurationMinutes = snap.recoveryConfig.recoverDurationMinutes;
    snap.scopeType = snap.scopeType || (template && template.scopeType) || '全部项目';
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
    event.departmentName = event.departmentName || departmentOfProject(event.projectId);
    if (event.ruleCode === 'TRANSPORT_PARKING') {
      event.metrics.staticCandidateStartAt = event.metrics.staticCandidateStartAt || event.metrics.staticStartTime || event.metrics.parkingStartedAt || null;
      event.metrics.staticStartTime = event.metrics.staticCandidateStartAt;
      event.metrics.recoverCandidateStartAt = event.metrics.recoverCandidateStartAt || event.metrics.recoverCandidateStart || null;
      if (!event.metrics.parkingStartedAt) event.metrics.parkingStartedAt = event.metrics.staticCandidateStartAt || null;
      if (event.recoveredAt && event.metrics.parkingStartedAt) {
        var closed = minutesBetween(event.metrics.parkingStartedAt, event.recoveredAt);
        if (closed != null && closed > 0) event.metrics.parkingMinutes = closed;
      }
      event.eventStatus = event.recoveredAt ? '已恢复' : (event.eventStatus || '发生中');
      if (event.metrics.telemetryValid == null) event.metrics.telemetryValid = true;
      event.metrics.speedSource = event.metrics.speedSource || event.metrics.mockSource || 'frontend-demo';
      event.metrics.positionSource = event.metrics.positionSource || event.metrics.mockSource || 'frontend-demo';
      if (!Array.isArray(event.handleRecords)) event.handleRecords = [];
      if (!event.handleRecords.length && event.handlingResult) {
        event.handleRecords.push({
          handleTime: event.handledAt || event.acknowledgedAt || nowText(),
          handler: event.handlerName || OPERATOR,
          handleType: event.handlingType || '处理',
          handleResult: event.handlingResult,
          parkingReason: event.parkingReason || '',
          falseAlarmReason: event.falseAlarmReason || '',
          markDone: event.handleStatus === '已处理'
        });
      }
    }
    if (isAreaStayCode(event.ruleCode)) {
      event.ruleCode = AREA_STAY_CODE;
      event.alertType = AREA_STAY_CODE;
      event.type = '区域停留预警';
      var fence = fenceById(event.fenceId || event.metrics.fenceId) || fenceByName(event.fenceName || event.metrics.fenceName || event.location);
      if (fence) {
        event.fenceId = fence.id;
        event.fenceName = fence.name;
        event.fenceType = fence.type;
        event.metrics.fenceId = fence.id;
        event.metrics.fenceName = fence.name;
        event.metrics.fenceType = fence.type;
      } else {
        event.fenceId = event.fenceId || event.metrics.fenceId || '';
        event.fenceName = event.fenceName || event.metrics.fenceName || event.location || '';
        event.fenceType = event.fenceType || event.metrics.fenceType || '';
      }
      event.enterTime = event.enterTime || event.metrics.enteredAt || null;
      event.leaveTime = event.leaveTime || event.metrics.leaveTime || event.recoveredAt || null;
      event.areaRelation = event.areaRelation || event.metrics.areaRelation || 'UNKNOWN';
      event.transportStage = event.transportStage || transportStageText(event.metrics.taskNode);
      event.currentLevel = event.currentLevel || event.level;
      event.firstAlertTime = event.firstAlertTime || event.triggeredAt;
      event.currentLevelTriggerTime = event.currentLevelTriggerTime || event.firstAlertTime;
      event.recoverCondition = event.recoverCondition || ('车辆离开' + (event.fenceName || '对应电子围栏'));
      if (!Array.isArray(event.handleRecords)) event.handleRecords = [];
      if (!Array.isArray(event.levelChangeLogs)) event.levelChangeLogs = [];
      if (event.eventStatus === '已恢复') {
        var closed = minutesBetween(event.enterTime, event.leaveTime || event.recoveredAt);
        if (closed != null) {
          event.finalStayDuration = closed;
          event.metrics.areaDwellMinutes = closed;
          event.metrics.finalStayDuration = closed;
        }
        event.currentStayDuration = null;
      } else {
        event.currentStayDuration = event.metrics.areaDwellMinutes;
        event.metrics.currentStayDuration = event.currentStayDuration;
      }
    }
    if (event.ruleCode === 'VEHICLE_OVERSPEED') {
      event.type = '车速预警';
      event.maxAlertLevel = event.maxAlertLevel || event.level;
      event.level = event.maxAlertLevel || event.level;
      event.falsePositive = !!event.falsePositive;
      event.realtimeRisk = event.realtimeRisk || (event.eventStatus === '已恢复' ? '已恢复' : event.level);
      if (!event.criticalAt && event.maxAlertLevel === '紧急') event.criticalAt = event.triggeredAt;
      event.metrics.overspeedStartedAt = event.metrics.overspeedStartedAt || event.overspeedStartedAt || null;
    }
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
    if (!saved || saved.version < 4) return seeded;
    var savedRules = Array.isArray(saved.rules) ? saved.rules : [];
    savedRules = savedRules.map(function (item) {
      if (!item) return item;
      if (item.code === AREA_STAY_LEGACY) item.code = AREA_STAY_CODE;
      return item;
    });
    var savedById = {};
    savedRules.forEach(function (item) { if (item && item.id) savedById[item.id] = item; });
    var keepSavedAreaStay = saved.version >= 5;
    var rules = seeded.rules.map(function (template) {
      if (isAreaStayCode(template.code) && !keepSavedAreaStay) return clone(template);
      if (saved.version >= 3) {
        var savedMatch = savedById[template.id] || (!isAreaStayCode(template.code) && template.code !== 'TRANSPORT_PARKING' && template.code !== 'VEHICLE_OVERSPEED' ? ruleByCode(savedRules, template.code) : null);
        return normalizeRule(savedMatch, template);
      }
      if (template.code === 'TRANSPORT_PARKING' && template.id !== 'RULE_TRANSPORT_PARKING') return clone(template);
      return normalizeRule(ruleByCode(savedRules, template.code), template);
    });
    if (saved.version >= 3) {
      savedRules.forEach(function (savedRule) {
        if (!savedRule) return;
        if (savedRule.code === 'TRANSPORT_PARKING' || savedRule.code === 'VEHICLE_OVERSPEED' || (keepSavedAreaStay && isAreaStayCode(savedRule.code))) {
          if (rules.some(function (item) { return item.id === savedRule.id; })) return;
          var template = clone(ruleByCode(seeded.rules, isAreaStayCode(savedRule.code) ? AREA_STAY_CODE : savedRule.code));
          template.id = savedRule.id;
          rules.push(normalizeRule(savedRule, template));
        }
      });
    }
    var events;
    var logs;
    if (keepSavedAreaStay && Array.isArray(saved.events)) {
      events = saved.events.map(function (event) {
        if (event && event.ruleCode === AREA_STAY_LEGACY) event.ruleCode = AREA_STAY_CODE;
        return normalizeEvent(event, rules);
      });
      logs = Array.isArray(saved.logs) ? clone(saved.logs) : clone(seeded.logs);
    } else {
      var keptEvents = Array.isArray(saved.events) ? saved.events.filter(function (event) { return event && !isAreaStayCode(event.ruleCode); }) : [];
      events = keptEvents.map(function (event) { return normalizeEvent(event, rules); }).concat(seeded.events.filter(function (event) { return isAreaStayCode(event.ruleCode); }).map(clone));
      var areaIds = {};
      seeded.events.forEach(function (event) { if (isAreaStayCode(event.ruleCode)) areaIds[event.id] = true; });
      logs = (Array.isArray(saved.logs) ? saved.logs.filter(function (log) {
        var alert = keptEvents.filter(function (event) { return event.id === log.alertId; })[0];
        return !!alert;
      }) : []).concat(seeded.logs.filter(function (log) { return areaIds[log.alertId]; }).map(clone));
    }
    mergeSeedHistory(events, logs, seeded);
    if (!saved.version || saved.version < 6) {
      var replaced = replaceSpeedSeed(events, logs, seeded);
      events = replaced.events;
      logs = replaced.logs;
    }
    if (!saved.version || saved.version < 7) {
      seeded.rules.forEach(function (rule) {
        if (rule.code !== 'VEHICLE_OVERSPEED') return;
        if (rules.some(function (item) { return item.id === rule.id; })) return;
        rules.push(clone(rule));
      });
    }
    if (!saved.version || saved.version < 8) {
      var resetCodes = ['UNLOAD_WEIGHBILL_MISSING', 'VEHICLE_LOW_SOC', 'DRIVER_FATIGUE'];
      rules = rules.filter(function (item) { return resetCodes.indexOf(item.code) < 0; });
      seeded.rules.forEach(function (rule) {
        if (resetCodes.indexOf(rule.code) >= 0) rules.push(clone(rule));
      });
      var replacedLate = replaceTypedSeed(events, logs, seeded, resetCodes);
      events = replacedLate.events;
      logs = replacedLate.logs;
    }
    if (!saved.version || saved.version < 9) {
      var replacedSoc = replaceTypedSeed(events, logs, seeded, ['VEHICLE_LOW_SOC']);
      events = replacedSoc.events;
      logs = replacedSoc.logs;
    }
    return { version: 9, rules: rules, events: events, logs: logs, parkingCycles: saved.parkingCycles && typeof saved.parkingCycles === 'object' ? saved.parkingCycles : {} };
  }
  function replaceTypedSeed(events, logs, seeded, codes) {
    var drop = {};
    events.forEach(function (event) { if (event && codes.indexOf(event.ruleCode) >= 0) drop[event.id] = true; });
    var nextEvents = events.filter(function (event) { return event && codes.indexOf(event.ruleCode) < 0; });
    var nextLogs = logs.filter(function (log) { return !drop[log.alertId]; });
    seeded.events.forEach(function (event) {
      if (codes.indexOf(event.ruleCode) >= 0) nextEvents.push(clone(event));
    });
    seeded.logs.forEach(function (log) {
      var owner = seeded.events.filter(function (event) { return event.id === log.alertId && codes.indexOf(event.ruleCode) >= 0; })[0];
      if (owner) nextLogs.push(clone(log));
    });
    return { events: nextEvents, logs: nextLogs };
  }
  function replaceSpeedSeed(events, logs, seeded) {
    var drop = {};
    events.forEach(function (event) { if (event && event.ruleCode === 'VEHICLE_OVERSPEED') drop[event.id] = true; });
    var nextEvents = events.filter(function (event) { return event && event.ruleCode !== 'VEHICLE_OVERSPEED'; });
    var nextLogs = logs.filter(function (log) { return !drop[log.alertId]; });
    seeded.events.forEach(function (event) {
      if (event.ruleCode === 'VEHICLE_OVERSPEED') nextEvents.push(clone(event));
    });
    seeded.logs.forEach(function (log) {
      var owner = seeded.events.filter(function (event) { return event.id === log.alertId && event.ruleCode === 'VEHICLE_OVERSPEED'; })[0];
      if (owner) nextLogs.push(clone(log));
    });
    return { events: nextEvents, logs: nextLogs };
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
    var legacy = legacyEventKey(currentSignal);
    function sameRule(event) {
      if (event.eventStatus !== '发生中') return false;
      if (isAreaStayCode(currentSignal.ruleCode)) return isAreaStayCode(event.ruleCode);
      return event.ruleCode === currentSignal.ruleCode;
    }
    var exact = state.events.filter(function (event) { return sameRule(event) && event.eventKey === key; })[0];
    if (exact) return exact;
    return state.events.filter(function (event) {
      if (!sameRule(event)) return false;
      if (event.eventKey && event.eventKey === legacy) return true;
      if (event.eventKey) return false;
      if (currentSignal.ruleCode === 'DRIVER_FATIGUE') return event.driverId === currentSignal.driverId && (!event.drivingCycleId || event.drivingCycleId === (currentSignal.drivingCycleId || (currentSignal.metrics || {}).drivingCycleId));
      return event.plate === currentSignal.plate && event.taskId === currentSignal.taskId;
    })[0] || null;
  }
  function recoveryRemark(currentSignal, rule) {
    var m = currentSignal.metrics || {};
    if (isAreaStayCode(currentSignal.ruleCode)) {
      var fence = areaStaySignalFence(currentSignal);
      return '离开区域自动恢复；车辆离开' + (fence.name || '对应电子围栏');
    }
    if (currentSignal.ruleCode === 'TRANSPORT_PARKING') return parkingRecoveryText(rule && rule.recoveryConfig);
    if (currentSignal.ruleCode === 'DRIVER_FATIGUE') {
      if (m.driverChanged) return '车辆驾驶员已发生变更，本次连续驾驶周期结束';
      if (Number(m.continuousParkingMinutes || 0) >= Number(rule.recoveryConfig.restThresholdMinutes || 20)) return '车辆连续停车' + m.continuousParkingMinutes + '分钟，达到有效休息条件';
    }
    return (rule.recoveryConfig || {}).description || '所有启用等级均不满足';
  }
  function updateEvidence(event, currentSignal, result) {
    if (event.ruleCode === 'VEHICLE_OVERSPEED') {
      applySpeedEvent(event, currentSignal, result);
      event.lastDetectedAt = evaluationTime(currentSignal);
      return;
    }
    event.sourceId = currentSignal.sourceId || event.sourceId;
    event.metrics = clone(result.metrics);
    event.facts = clone(result.facts);
    event.currentValueText = valueText(Object.assign({}, currentSignal, { metrics: result.metrics }));
    event.location = currentSignal.location || event.location;
    event.lastDetectedAt = evaluationTime(currentSignal);
    if (isAreaStayCode(event.ruleCode)) {
      var fence = areaStaySignalFence(Object.assign({}, currentSignal, { metrics: result.metrics }));
      event.fenceId = fence.id;
      event.fenceName = fence.name;
      event.fenceType = fence.type;
      event.enterTime = (result.metrics || {}).enteredAt || event.enterTime;
      event.leaveTime = (result.metrics || {}).leaveTime || event.leaveTime;
      event.currentStayDuration = (result.metrics || {}).currentStayDuration;
      event.finalStayDuration = (result.metrics || {}).finalStayDuration;
      event.transportStage = transportStageText((result.metrics || {}).taskNode || event.transportStage);
      event.areaRelation = (result.metrics || {}).areaRelation || event.areaRelation || 'UNKNOWN';
      event.currentLevel = event.level;
    }
  }
  function processSignal(currentSignal, shouldPersist) {
    var currentRule = resolveRule(state.rules, currentSignal);
    var cycleChanged = false;
    if (currentSignal.ruleCode === 'DRIVER_FATIGUE' && currentSignal.driverId && currentSignal.drivingCycleId) {
      state.events.forEach(function (event) {
        if (event.ruleCode !== 'DRIVER_FATIGUE' || event.eventStatus !== '发生中' || event.driverId !== currentSignal.driverId) return;
        if (!event.drivingCycleId || event.drivingCycleId === currentSignal.drivingCycleId) return;
        event.eventStatus = '已恢复';
        event.recoveredAt = evaluationTime(currentSignal);
        addLog(event.id, 'RECOVERED', '检测到新的连续驾驶周期，原驾驶周期已结束', { operatedAt: event.recoveredAt });
        cycleChanged = true;
      });
    }
    var active = activeEventFor(currentSignal);
    if (!active && isAreaStayCode(currentSignal.ruleCode)) {
      var key = eventKey(currentSignal);
      var recent = state.events.filter(function (event) {
        return isAreaStayCode(event.ruleCode) && (event.eventKey === key || (event.plate === currentSignal.plate && event.fenceId === areaStaySignalFence(currentSignal).id))
          && event.eventStatus === '已恢复' && event.recoveredAt
          && minutesBetween(event.recoveredAt, evaluationTime(currentSignal)) != null
          && minutesBetween(event.recoveredAt, evaluationTime(currentSignal)) <= AREA_STAY_DEBOUNCE_MIN;
      }).sort(function (a, b) { return String(b.recoveredAt).localeCompare(String(a.recoveredAt)); })[0];
      if (recent) active = recent;
    }
    var effectiveRule = active ? snapshotRule(active.ruleSnapshot, active.ruleCode) : currentRule;
    var lateSignal = isLateRuleCode(currentSignal.ruleCode);
    var priorCycle = currentSignal.ruleCode === 'TRANSPORT_PARKING'
      ? loadParkingCycle(currentSignal, active)
      : (lateSignal && active ? Object.assign({}, active.metrics || {}, { level: active.maxLevel || active.level, maxLevel: active.maxLevel || active.level, eventOpen: active.eventStatus === '发生中' }) : null);
    var result = evaluateSignal(currentSignal, effectiveRule, priorCycle);
    if (result.hold && !result.triggered) {
      if (active) updateEvidence(active, currentSignal, result);
      if (cycleChanged && shouldPersist !== false) persist();
      return clone(active);
    }
    if (currentSignal.ruleCode === 'TRANSPORT_PARKING') saveParkingCycle(currentSignal, result.metrics, result.recovered);
    var changed = cycleChanged;
    if (currentSignal.ruleCode === 'TRANSPORT_PARKING' && result.metrics && (result.metrics.staticStartTime || result.recovered)) changed = true;
    var speedSignal = currentSignal.ruleCode === 'VEHICLE_OVERSPEED';
    var shouldRecover = (speedSignal || currentSignal.ruleCode === 'TRANSPORT_PARKING' || isAreaStayCode(currentSignal.ruleCode) || lateSignal)
      ? result.recovered === true
      : (currentSignal.sourceStatus === 'recovered' || !result.triggered);
    if (active && speedSignal && result.episode) {
      applySpeedEvent(active, currentSignal, result);
      if (mergeSpeedTimeline(active, result.timeline)) changed = true;
      if (result.recovered && active.eventStatus !== '已恢复') {
        active.eventStatus = '已恢复';
        active.recoveredAt = (result.metrics && result.metrics.recoveredAt) || evaluationTime(currentSignal);
        active.recoverReason = (result.metrics && result.metrics.recoverReason) || speedRecoveryText(effectiveRule && effectiveRule.recoveryConfig);
        changed = true;
      }
    } else if (active) {
      if (isAreaStayCode(active.ruleCode) && active.eventStatus === '已恢复' && result.triggered && !shouldRecover) {
        active.eventStatus = '发生中';
        active.recoveredAt = null;
        active.leaveTime = null;
        active.recoverReason = null;
        active.finalStayDuration = null;
        addLog(active.id, 'ENTER_FENCE', '短时边界抖动，继续同一围栏停留事件', { operatedAt: evaluationTime(currentSignal) });
        changed = true;
      }
      updateEvidence(active, currentSignal, result);
      if (shouldRecover) {
        active.eventStatus = '已恢复';
        active.recoveredAt = currentSignal.recoveredAt || evaluationTime(currentSignal);
        active.leaveTime = (result.metrics && result.metrics.leaveTime) || active.recoveredAt;
        active.finalStayDuration = (result.metrics && result.metrics.finalStayDuration) || active.finalStayDuration;
        active.currentStayDuration = null;
        active.recoverReason = (result.metrics && result.metrics.recoverReason) || recoveryRemark(currentSignal, effectiveRule);
        if (isAreaStayCode(active.ruleCode)) addLog(active.id, 'LEAVE_FENCE', '车辆离开' + (active.fenceName || '对应电子围栏'), { operatedAt: active.recoveredAt });
        addLog(active.id, isAreaStayCode(active.ruleCode) ? 'AUTO_RECOVER' : 'RECOVERED', active.recoverReason, { operatedAt: active.recoveredAt });
        changed = true;
      } else if (result.triggered && active.level !== result.level && !(lateSignal && levelRank(result.level) < levelRank(active.level))) {
        var action = levelRank(result.level) > levelRank(active.level)
          ? (isAreaStayCode(active.ruleCode) ? 'LEVEL_UPGRADE' : 'LEVEL_UPGRADED')
          : 'LEVEL_DOWNGRADED';
        var from = active.level;
        active.level = result.level;
        active.currentLevel = result.level;
        active.maxLevel = result.maxLevel || result.level;
        active.currentLevelTriggerTime = evaluationTime(currentSignal);
        var matched = ((effectiveRule && effectiveRule.levels) || []).filter(function (item) { return item.level === result.level; })[0];
        if (matched) active.triggerCondition = '区域停留 ≥ ' + matched.threshold + '分钟';
        active.levelChangeLogs = active.levelChangeLogs || [];
        active.levelChangeLogs.push({ at: active.currentLevelTriggerTime, from: from, to: result.level, remark: valueText(Object.assign({}, currentSignal, { metrics: result.metrics })) });
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
      active.handleRecords = [];
      state.events.unshift(active);
      if (currentSignal.ruleCode === 'TRANSPORT_PARKING' && (result.metrics || {}).staticCandidateStartAt) {
        addLog(active.id, 'STILL_STARTED', '车辆进入持续静止状态', { operatedAt: result.metrics.staticCandidateStartAt });
      }
      if (isAreaStayCode(currentSignal.ruleCode)) {
        addLog(active.id, 'ENTER_FENCE', '进入' + (active.fenceName || '业务区域'), { operatedAt: active.enterTime || evaluationTime(currentSignal) });
        addLog(active.id, 'ALERT_CREATED', '停留达到' + ((result.levelConfig && result.levelConfig.threshold) || '') + '分钟，触发' + result.level + '预警', { toLevel: result.level, operatedAt: evaluationTime(currentSignal) || active.triggeredAt });
      } else if (currentSignal.ruleCode === 'VEHICLE_OVERSPEED') {
        mergeSpeedTimeline(active, result.timeline);
      } else {
        addLog(active.id, 'TRIGGERED', currentSignal.ruleCode === 'TRANSPORT_PARKING'
          ? (valueText(Object.assign({}, currentSignal, { metrics: result.metrics })) + '，' + result.level + '告警')
          : ('首次达到' + result.level + '等级条件；' + valueText(currentSignal)), { toLevel: result.level, operatedAt: evaluationTime(currentSignal) || active.triggeredAt });
      }
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
  function scopeFamily(type) {
    if (type === '自定义车辆' || type === '指定车辆') return 'vehicle';
    if (type === '组织部门') return 'department';
    if (type === '指定项目') return 'project';
    return 'all';
  }
  function idOverlaps(left, right) {
    return (left || []).some(function (id) { return (right || []).indexOf(id) >= 0; });
  }
  function parkingConflict(candidate, excludeId) {
    var family = scopeFamily(candidate.scopeType);
    return state.rules.filter(function (item) {
      if (item.code !== 'TRANSPORT_PARKING' || item.enabled === false || item.id === excludeId) return false;
      if (scopeFamily(item.scopeType) !== family) return false;
      if (family === 'all') return true;
      if (family === 'department') return idOverlaps(candidate.departmentIds, item.departmentIds);
      if (family === 'project') return idOverlaps(candidate.projectIds, item.projectIds);
      return idOverlaps(candidate.vehiclePlates, item.vehiclePlates);
    })[0] || null;
  }
  function parkingOverlapLabel(candidate, conflict) {
    if (!conflict) return '';
    var family = scopeFamily(candidate.scopeType);
    if (family === 'project') {
      var names = [];
      (candidate.projectIds || []).forEach(function (id, index) {
        if ((conflict.projectIds || []).indexOf(id) >= 0) names.push((candidate.projectNames || [])[index] || id);
      });
      return names.join('、');
    }
    if (family === 'department') {
      var departments = [];
      (candidate.departmentIds || []).forEach(function (id, index) {
        if ((conflict.departmentIds || []).indexOf(id) >= 0) departments.push((candidate.departmentNames || [])[index] || id);
      });
      return departments.join('、');
    }
    if (family === 'vehicle') {
      return (candidate.vehiclePlates || []).filter(function (plate) {
        return (conflict.vehiclePlates || []).indexOf(plate) >= 0;
      }).join('、');
    }
    return '全部组织';
  }
  function parkingConflictError(conflict, candidate) {
    if (!conflict) return '当前适用范围已存在启用中的同优先级停车预警规则，禁止保存。';
    var overlap = parkingOverlapLabel(candidate || {}, conflict);
    var family = scopeFamily(candidate && candidate.scopeType);
    if (family === 'vehicle') return '自定义车辆「' + overlap + '」已存在启用中的同优先级规则「' + conflict.name + '」，禁止保存。';
    if (family === 'department') return '组织部门「' + overlap + '」已存在启用中的同优先级规则「' + conflict.name + '」，禁止保存。';
    if (family === 'project') return '指定项目「' + overlap + '」已存在启用中的同优先级规则「' + conflict.name + '」，禁止保存。';
    return '已存在启用中的全部组织默认规则「' + conflict.name + '」，禁止保存。';
  }
  function areaStayProjectIds(rule) {
    if (rule.scopeType === '指定项目') return rule.projectIds || [];
    return PROJECTS.map(function (item) { return item.id; });
  }
  function areaStayScopeOverlap(left, right) {
    var leftProjects = areaStayProjectIds(left);
    var rightProjects = areaStayProjectIds(right);
    if (!idOverlaps(leftProjects, rightProjects) && left.scopeType === '指定项目' && right.scopeType === '指定项目') return false;
    var leftType = left.areaType || '全部类型';
    var rightType = right.areaType || '全部类型';
    if (leftType !== '全部类型' && rightType !== '全部类型' && leftType !== rightType) return false;
    var leftFences = left.fenceIds || [];
    var rightFences = right.fenceIds || [];
    if (leftFences.length && rightFences.length) return idOverlaps(leftFences, rightFences);
    if (leftFences.length || rightFences.length) return false;
    return true;
  }
  function areaStayConflict(candidate, excludeId) {
    var rank = areaStayPriority(candidate);
    return state.rules.filter(function (item) {
      if (!isAreaStayCode(item.code) || item.enabled === false || item.id === excludeId) return false;
      if (areaStayPriority(item) !== rank) return false;
      return areaStayScopeOverlap(candidate, item);
    })[0] || null;
  }
  function areaStayHigherWarning(candidate, excludeId) {
    return state.rules.filter(function (item) {
      if (!isAreaStayCode(item.code) || item.enabled === false || item.id === excludeId) return false;
      if (areaStayPriority(item) <= areaStayPriority(candidate)) return false;
      return areaStayScopeOverlap(candidate, item);
    })[0] || null;
  }
  function areaStayConflictError(conflict) {
    return '当前项目/区域/围栏已存在同级生效规则「' + ((conflict && conflict.name) || '') + '」，请修改原规则或调整适用范围。';
  }
  function applyAreaStayPatch(rule, patch) {
    if (patch.name != null) rule.name = String(patch.name).trim() || rule.name;
    if (patch.scopeType) rule.scopeType = patch.scopeType;
    if (Array.isArray(patch.projectIds)) rule.projectIds = clone(patch.projectIds);
    if (Array.isArray(patch.projectNames)) rule.projectNames = clone(patch.projectNames);
    if (patch.areaType != null) rule.areaType = patch.areaType || '全部类型';
    if (Array.isArray(patch.fenceIds)) rule.fenceIds = clone(patch.fenceIds);
    if (Array.isArray(patch.fenceNames)) rule.fenceNames = clone(patch.fenceNames);
    if (rule.scopeType !== '指定项目') {
      rule.projectIds = [];
      rule.projectNames = [];
    }
    if (!(rule.fenceIds || []).length) rule.fenceNames = [];
    rule.code = AREA_STAY_CODE;
    rule.alertType = AREA_STAY_CODE;
    rule.recoveryConfig = defaultAreaStayRecovery();
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
    if (Array.isArray(patch.departmentIds)) rule.departmentIds = clone(patch.departmentIds);
    if (Array.isArray(patch.departmentNames)) rule.departmentNames = clone(patch.departmentNames);
    if (Array.isArray(patch.vehiclePlates)) rule.vehiclePlates = clone(patch.vehiclePlates);
    if (rule.scopeType === '全部项目') {
      rule.projectIds = []; rule.projectNames = []; rule.departmentIds = []; rule.departmentNames = []; rule.vehiclePlates = [];
    }
    if (rule.scopeType === '指定项目') { rule.vehiclePlates = []; rule.departmentIds = []; rule.departmentNames = []; }
    if (rule.scopeType === '指定车辆' || rule.scopeType === '自定义车辆') {
      rule.projectIds = []; rule.projectNames = []; rule.departmentIds = []; rule.departmentNames = [];
    }
    if (rule.scopeType === '组织部门') { rule.projectIds = []; rule.projectNames = []; rule.vehiclePlates = []; }
  }
  function speedConflict(candidate, excludeId) {
    var rank = speedPriority(candidate);
    return state.rules.filter(function (item) {
      if (item.code !== 'VEHICLE_OVERSPEED' || item.enabled === false || item.id === excludeId) return false;
      if (speedPriority(item) !== rank) return false;
      if (rank === 2) return idOverlaps(candidate.projectIds, item.projectIds);
      return true;
    })[0] || null;
  }
  function speedHigherWarning(candidate, excludeId) {
    return state.rules.filter(function (item) {
      if (item.code !== 'VEHICLE_OVERSPEED' || item.enabled === false || item.id === excludeId) return false;
      if (speedPriority(item) <= speedPriority(candidate)) return false;
      if (candidate.scopeType === '全部项目') return true;
      return idOverlaps(candidate.projectIds, item.projectIds);
    })[0] || null;
  }
  function speedConflictError(conflict) {
    return '当前适用范围已存在同级生效规则「' + ((conflict && conflict.name) || '') + '」，请修改原规则或调整适用范围。';
  }
  function applySpeedRulePatch(rule, patch) {
    patch = patch || {};
    if (patch.name != null) rule.name = String(patch.name).trim() || rule.name;
    if (patch.scopeType) rule.scopeType = patch.scopeType;
    if (patch.speedSourcePolicy) rule.speedSourcePolicy = patch.speedSourcePolicy;
    if (!rule.speedSourcePolicy) rule.speedSourcePolicy = 'CAN_THEN_GPS';
    if (rule.scopeType === '指定项目') {
      if (Array.isArray(patch.projectIds)) {
        rule.projectIds = clone(patch.projectIds);
        rule.projectNames = clone(patch.projectNames || []);
      }
    } else {
      rule.projectIds = [];
      rule.projectNames = [];
    }
    if (Array.isArray(patch.levels)) rule.levels = clone(patch.levels);
    if (patch.recoveryConfig) rule.recoveryConfig = Object.assign({}, defaultSpeedRecovery(), rule.recoveryConfig || {}, clone(patch.recoveryConfig));
    if (!rule.recoveryConfig) rule.recoveryConfig = defaultSpeedRecovery();
    rule.recoveryConfig.description = speedRecoveryText(rule.recoveryConfig);
  }
  function speedLevelError(levels) {
    var enabled = (levels || []).filter(function (level) { return level.enabled !== false; });
    if (!enabled.length) return '请至少启用一个预警等级';
    var ordered = LEVELS.map(function (name) {
      return enabled.filter(function (level) { return level.level === name; })[0];
    }).filter(Boolean);
    for (var index = 0; index < ordered.length; index += 1) {
      var speed = Number(ordered[index].speedThreshold);
      var duration = Number(ordered[index].durationSeconds);
      if (!isFinite(speed) || speed <= 0) return '车速阈值必须大于 0';
      if (!isFinite(duration) || duration <= 0 || !Number.isInteger(duration)) return '持续时间必须大于 0';
      if (index > 0 && speed <= Number(ordered[index - 1].speedThreshold)) return '高级别预警的车速阈值必须高于低级别预警。';
    }
    return '';
  }
  function validateSpeedRule(rule) {
    var levelError = speedLevelError(rule.levels);
    if (levelError) return levelError;
    if (rule.scopeType === '指定项目' && !(rule.projectIds || []).length) return '请选择至少一个项目';
    if (['CAN', 'GPS', 'CAN_THEN_GPS'].indexOf(rule.speedSourcePolicy || '') < 0) return '请选择速度数据来源';
    var recoverSpeed = Number((rule.recoveryConfig || {}).recoverSpeedKph);
    var recoverDuration = Number((rule.recoveryConfig || {}).recoverDurationSeconds);
    if (!isFinite(recoverSpeed) || recoverSpeed <= 0) return '恢复车速阈值必须大于 0';
    if (!isFinite(recoverDuration) || recoverDuration <= 0 || !Number.isInteger(recoverDuration)) return '恢复持续时间必须大于 0';
    var lowest = (rule.levels || []).filter(function (level) { return level.enabled !== false; }).slice().sort(function (a, b) {
      return Number(a.speedThreshold) - Number(b.speedThreshold);
    })[0];
    if (lowest && recoverSpeed >= Number(lowest.speedThreshold)) return '恢复车速阈值必须低于已启用的最低车速阈值';
    return '';
  }
  function applyLateRulePatch(rule, patch) {
    patch = patch || {};
    if (patch.name != null) rule.name = String(patch.name).trim() || rule.name;
    if (patch.scopeType) rule.scopeType = patch.scopeType;
    if (rule.scopeType === '指定项目') {
      if (Array.isArray(patch.projectIds)) {
        rule.projectIds = clone(patch.projectIds);
        rule.projectNames = clone(patch.projectNames || []);
      }
    } else {
      rule.projectIds = [];
      rule.projectNames = [];
    }
    if (patch.detectConfig) rule.detectConfig = Object.assign({}, rule.detectConfig || {}, clone(patch.detectConfig));
    if (patch.confirmConfig) rule.confirmConfig = Object.assign({}, rule.confirmConfig || {}, clone(patch.confirmConfig));
    if (patch.recoveryConfig) rule.recoveryConfig = Object.assign({}, rule.recoveryConfig || {}, clone(patch.recoveryConfig));
  }
  function projectScopeRank(rule) { return rule && rule.scopeType === '指定项目' ? 2 : 1; }
  function projectScopeConflict(candidate, excludeId) {
    var rank = projectScopeRank(candidate);
    return state.rules.filter(function (item) {
      if (item.code !== candidate.code || item.enabled === false || item.id === excludeId) return false;
      if (projectScopeRank(item) !== rank) return false;
      if (rank === 2) return idOverlaps(candidate.projectIds, item.projectIds);
      return true;
    })[0] || null;
  }
  function projectScopeHigher(candidate, excludeId) {
    return state.rules.filter(function (item) {
      if (item.code !== candidate.code || item.enabled === false || item.id === excludeId) return false;
      if (projectScopeRank(item) <= projectScopeRank(candidate)) return false;
      if (candidate.scopeType !== '指定项目') return true;
      return idOverlaps(candidate.projectIds, item.projectIds);
    })[0] || null;
  }
  function projectScopeConflictError(conflict) {
    return '当前适用范围已存在同级生效规则「' + ((conflict && conflict.name) || '') + '」，请修改原规则或调整适用范围。';
  }
  function validateLateRule(rule) {
    if (rule.scopeType === '指定项目' && !(rule.projectIds || []).length) return '请选择至少一个项目';
    var enabled = LEVELS.map(function (name) {
      return (rule.levels || []).filter(function (level) { return level.level === name && level.enabled !== false; })[0];
    }).filter(Boolean);
    if (!enabled.length) return '请至少启用一个预警等级';
    if (rule.code === 'VEHICLE_LOW_SOC') {
      for (var i = 0; i < enabled.length; i += 1) {
        var value = Number(enabled[i].threshold);
        if (!isFinite(value) || value <= 0 || value > 100) return 'SOC 阈值应为 1 到 100';
        if (i > 0 && value >= Number(enabled[i - 1].threshold)) return 'SOC 阈值必须随等级降低：一般 > 严重 > 紧急';
      }
      var confirm = Number((rule.confirmConfig || {}).confirmMinutes);
      var valid = Number((rule.confirmConfig || {}).dataValidMinutes);
      if (!Number.isInteger(confirm) || confirm < 1 || confirm > 30) return 'SOC 持续确认时间应为 1 到 30 分钟';
      if (!Number.isInteger(valid) || valid < 1 || valid > 60) return '数据有效期应为 1 到 60 分钟';
      var recoverSoc = Number((rule.recoveryConfig || {}).recoverSoc);
      var recoverHold = Number((rule.recoveryConfig || {}).recoverDurationMinutes);
      if (!isFinite(recoverSoc) || recoverSoc <= 0 || recoverSoc > 100) return '恢复 SOC 应为 1 到 100';
      if (!Number.isInteger(recoverHold) || recoverHold < 1 || recoverHold > 60) return '恢复持续时间应为 1 到 60 分钟';
      var general = enabled[0];
      if (general && recoverSoc <= Number(general.threshold)) return '恢复 SOC 必须高于一般告警 SOC';
      return '';
    }
    if (rule.code === 'DRIVER_FATIGUE') {
      for (var f = 0; f < enabled.length; f += 1) {
        var minutes = Number(enabled[f].thresholdMinutes);
        if (!isFinite(minutes) || minutes < 60 || minutes > 1440) return '已启用等级的连续驾驶时长应为 1 到 24 小时';
        if (f > 0 && minutes <= Number(enabled[f - 1].thresholdMinutes)) return '高等级连续驾驶时长必须高于低等级';
      }
      var drive = Number((rule.detectConfig || {}).drivingSpeedKph);
      var dataValid = Number((rule.detectConfig || {}).dataValidMinutes);
      var rest = Number((rule.recoveryConfig || {}).restThresholdMinutes);
      if (!isFinite(drive) || drive <= 0 || drive > 30) return '驾驶判定速度应为 1 到 30 km/h';
      if (!Number.isInteger(dataValid) || dataValid < 1 || dataValid > 60) return '数据有效期应为 1 到 60 分钟';
      if (!Number.isInteger(rest) || rest < 5 || rest > 120) return '有效休息时长应为 5 到 120 分钟';
      return '';
    }
    for (var w = 0; w < enabled.length; w += 1) {
      var wait = Number(enabled[w].threshold);
      if (!Number.isInteger(wait) || wait < 1 || wait > 1440) return '超时分钟数应为 1 到 1440 的整数';
      if (w > 0 && wait <= Number(enabled[w - 1].threshold)) return '高等级超时时间必须高于低等级';
    }
    return '';
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
      var conflict = candidate.enabled ? parkingConflict(candidate, id) : null;
      if (conflict) return { error: parkingConflictError(conflict, candidate) };
      applyParkingPatch(rule, patch);
    } else if (isAreaStayCode(rule.code)) {
      var areaCandidate = clone(rule);
      applyAreaStayPatch(areaCandidate, patch);
      areaCandidate.enabled = nextEnabled;
      var areaConflict = areaCandidate.enabled ? areaStayConflict(areaCandidate, id) : null;
      if (areaConflict) return { error: areaStayConflictError(areaConflict) };
      applyAreaStayPatch(rule, patch);
      var higher = areaCandidate.enabled ? areaStayHigherWarning(areaCandidate, id) : null;
      rule._saveWarning = higher ? '当前范围内存在更高优先级规则「' + higher.name + '」，实际告警将按照优先级匹配最终生效规则。' : '';
    } else if (rule.code === 'VEHICLE_OVERSPEED') {
      var speedCandidate = clone(rule);
      applySpeedRulePatch(speedCandidate, patch);
      speedCandidate.enabled = nextEnabled;
      var speedError = validateSpeedRule(speedCandidate);
      if (speedError) return { error: speedError };
      var speedConflicted = speedCandidate.enabled ? speedConflict(speedCandidate, id) : null;
      if (speedConflicted) return { error: speedConflictError(speedConflicted) };
      applySpeedRulePatch(rule, patch);
      var speedHigher = speedCandidate.enabled ? speedHigherWarning(speedCandidate, id) : null;
      rule._saveWarning = speedHigher ? '当前范围内存在更高优先级规则「' + speedHigher.name + '」，实际告警将按照优先级匹配最终生效规则。' : '';
    } else if (isLateRuleCode(rule.code)) {
      var lateCandidate = clone(rule);
      applyLateRulePatch(lateCandidate, patch);
      lateCandidate.enabled = nextEnabled;
      if (Array.isArray(patch.levels)) lateCandidate.levels = clone(patch.levels);
      var lateError = validateLateRule(lateCandidate);
      if (lateError) return { error: lateError };
      var lateConflict = lateCandidate.enabled ? projectScopeConflict(lateCandidate, id) : null;
      if (lateConflict) return { error: projectScopeConflictError(lateConflict) };
      applyLateRulePatch(rule, patch);
      var lateHigher = lateCandidate.enabled ? projectScopeHigher(lateCandidate, id) : null;
      rule._saveWarning = lateHigher ? '当前范围内存在更高优先级规则「' + lateHigher.name + '」，实际告警将按照优先级匹配最终生效规则。' : '';
    } else {
      if (patch.scopeType) rule.scopeType = patch.scopeType;
      rule.projectIds = patch.scopeType === '指定项目' ? [PROJECT_ID] : (rule.projectIds || []);
    }
    if (patch.enabled != null) rule.enabled = nextEnabled;
    if (Array.isArray(patch.levels)) rule.levels = clone(patch.levels);
    if (patch.recoveryConfig) {
      rule.recoveryConfig = Object.assign({}, rule.recoveryConfig, clone(patch.recoveryConfig));
      if (rule.code === 'TRANSPORT_PARKING') rule.recoveryConfig.description = parkingRecoveryText(rule.recoveryConfig);
      if (isAreaStayCode(rule.code)) rule.recoveryConfig = defaultAreaStayRecovery();
      if (rule.code === 'VEHICLE_OVERSPEED') rule.recoveryConfig.description = speedRecoveryText(rule.recoveryConfig);
      if (rule.code === 'VEHICLE_LOW_SOC') rule.recoveryConfig.description = 'SOC ≥ ' + (rule.recoveryConfig.recoverSoc || 35) + '% 持续 ≥ ' + (rule.recoveryConfig.recoverDurationMinutes || 2) + '分钟';
      if (rule.code === 'DRIVER_FATIGUE') rule.recoveryConfig.description = '连续非驾驶达到有效休息时长，或驾驶员发生变更';
      if (rule.code === 'UNLOAD_WEIGHBILL_MISSING') rule.recoveryConfig.description = '磅单上传成功或确认无需磅单';
    }
    delete rule.level;
    delete rule.config;
    delete rule.repeatIntervalMinutes;
    rule.updatedBy = OPERATOR;
    rule.updatedAt = nowText();
    persist();
    refreshDetection();
    var saved = clone(rule);
    if (rule._saveWarning) saved.warning = rule._saveWarning;
    delete rule._saveWarning;
    return saved;
  }
  function addParkingRule(patch) {
    var template = clone(ruleByCode(seedRules(), 'TRANSPORT_PARKING'));
    template.id = 'RULE_TRANSPORT_PARKING_' + Date.now();
    template.name = (patch && patch.name) || '停车超时预警';
    template.enabled = patch && patch.enabled != null ? !!patch.enabled : true;
    template.scopeType = (patch && patch.scopeType) || '组织部门';
    template.projectIds = [];
    template.projectNames = [];
    template.departmentIds = [];
    template.departmentNames = [];
    template.vehiclePlates = [];
    applyParkingPatch(template, patch || {});
    if (Array.isArray(patch && patch.levels)) template.levels = clone(patch.levels);
    if (patch && patch.recoveryConfig) {
      template.recoveryConfig = Object.assign({}, defaultParkingRecovery(), clone(patch.recoveryConfig));
      template.recoveryConfig.description = parkingRecoveryText(template.recoveryConfig);
    }
    var createdConflict = template.enabled ? parkingConflict(template, null) : null;
    if (createdConflict) return { error: parkingConflictError(createdConflict, template) };
    template.updatedBy = OPERATOR;
    template.updatedAt = nowText();
    state.rules.push(template);
    persist();
    refreshDetection();
    return clone(template);
  }
  function addSpeedRule(patch) {
    var template = clone(ruleByCode(seedRules(), 'VEHICLE_OVERSPEED'));
    template.id = 'RULE_VEHICLE_OVERSPEED_' + Date.now();
    template.name = (patch && patch.name) || '车速预警';
    template.enabled = patch && patch.enabled != null ? !!patch.enabled : true;
    template.scopeType = (patch && patch.scopeType) || '全部项目';
    template.projectIds = [];
    template.projectNames = [];
    template.isDraft = false;
    applySpeedRulePatch(template, patch || {});
    var createdError = validateSpeedRule(template);
    if (createdError) return { error: createdError };
    var createdConflict = template.enabled ? speedConflict(template, null) : null;
    if (createdConflict) return { error: speedConflictError(createdConflict) };
    var higher = template.enabled ? speedHigherWarning(template, null) : null;
    template.updatedBy = OPERATOR;
    template.updatedAt = nowText();
    state.rules.push(template);
    persist();
    refreshDetection();
    var saved = clone(template);
    if (higher) saved.warning = '当前范围内存在更高优先级规则「' + higher.name + '」，实际告警将按照优先级匹配最终生效规则。';
    return saved;
  }
  function addAreaStayRule(patch) {
    var template = clone(ruleByCode(seedRules(), AREA_STAY_CODE));
    template.id = 'RULE_AREA_STAY_' + Date.now();
    template.name = (patch && patch.name) || '区域停留预警';
    template.enabled = patch && patch.enabled != null ? !!patch.enabled : true;
    template.scopeType = (patch && patch.scopeType) || '全部项目';
    template.projectIds = [];
    template.projectNames = [];
    template.areaType = '全部类型';
    template.fenceIds = [];
    template.fenceNames = [];
    applyAreaStayPatch(template, patch || {});
    if (Array.isArray(patch && patch.levels)) template.levels = clone(patch.levels);
    var createdConflict = template.enabled ? areaStayConflict(template, null) : null;
    if (createdConflict) return { error: areaStayConflictError(createdConflict) };
    var higher = template.enabled ? areaStayHigherWarning(template, null) : null;
    template.updatedBy = OPERATOR;
    template.updatedAt = nowText();
    state.rules.push(template);
    persist();
    refreshDetection();
    var saved = clone(template);
    if (higher) saved.warning = '当前范围内存在更高优先级规则「' + higher.name + '」，实际告警将按照优先级匹配最终生效规则。';
    return saved;
  }
  function addLateRule(patch) {
    var code = patch && patch.code;
    if (!isLateRuleCode(code)) return { error: '不支持的告警类型' };
    var template = clone(ruleByCode(seedRules(), code));
    template.id = 'RULE_' + code + '_' + Date.now();
    template.isDraft = false;
    template.name = (patch && patch.name) || template.name;
    template.enabled = patch && patch.enabled != null ? !!patch.enabled : true;
    applyLateRulePatch(template, patch || {});
    if (Array.isArray(patch && patch.levels)) template.levels = clone(patch.levels);
    var createdError = validateLateRule(template);
    if (createdError) return { error: createdError };
    var createdConflict = template.enabled ? projectScopeConflict(template, null) : null;
    if (createdConflict) return { error: projectScopeConflictError(createdConflict) };
    var higher = template.enabled ? projectScopeHigher(template, null) : null;
    template.updatedBy = OPERATOR;
    template.updatedAt = nowText();
    state.rules.push(template);
    persist();
    refreshDetection();
    var saved = clone(template);
    if (higher) saved.warning = '当前范围内存在更高优先级规则「' + higher.name + '」，实际告警将按照优先级匹配最终生效规则。';
    return saved;
  }
  function removeRule(id) {
    var rule = state.rules.filter(function (item) { return item.id === id; })[0];
    if (!rule) return { error: '未找到规则' };
    if (rule.code !== 'TRANSPORT_PARKING' && !isAreaStayCode(rule.code) && rule.code !== 'VEHICLE_OVERSPEED' && !isLateRuleCode(rule.code)) return { error: '当前规则不支持删除' };
    if (rule.id === 'RULE_TRANSPORT_PARKING') return { error: '默认全部项目规则不能删除，可停用' };
    if (rule.id === 'RULE_AREA_STAY') return { error: '系统默认区域停留规则不能删除，可停用' };
    if (rule.id === 'RULE_VEHICLE_OVERSPEED') return { error: '系统默认车速预警规则不能删除，可停用' };
    if (rule.id === 'RULE_UNLOAD_WEIGHBILL_MISSING' || rule.id === 'RULE_VEHICLE_LOW_SOC' || rule.id === 'RULE_DRIVER_FATIGUE') return { error: '系统默认规则不能删除，可停用' };
    state.rules = state.rules.filter(function (item) { return item.id !== id; });
    persist();
    return { ok: true };
  }
  function acknowledge(id) {
    var event = state.events.filter(function (item) { return item.id === id; })[0];
    if (!event || event.ruleCode === 'VEHICLE_OVERSPEED' || event.handleStatus !== '待处理') return clone(event);
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
    var falseType = type === '误报' || type === '确认误报';
    var closingType = falseType || type === '无需处理' || type === '确认无需磅单';
    if (falseType && !(extra.falseAlarmReason || '').trim()) return { error: '请选择误报原因' };
    if (type === '确认无需磅单' && !(extra.falseAlarmReason || result || '').trim()) return { error: '请填写无需磅单原因' };
    if (!(result || '').trim()) return { error: '请填写处理说明' };
    var markDone = extra.markDone === true || closingType;
    if (!event.acknowledgedAt) {
      event.acknowledgedAt = time;
      event.acknowledgedBy = OPERATOR;
    }
    if (!event.handlingStartedAt) event.handlingStartedAt = time;
    event.handleRecords = Array.isArray(event.handleRecords) ? event.handleRecords : [];
    event.handleRecords.push({
      handleTime: time, handler: OPERATOR, handleType: type, handleResult: result,
      parkingReason: extra.parkingReason || '',
      falseAlarmReason: extra.falseAlarmReason || '', markDone: markDone
    });
    if (event.handleStatus === '待处理') event.handleStatus = '处理中';
    if (markDone) {
      event.handleStatus = '已处理';
      event.handledAt = time;
    }
    event.handlerId = 'U001';
    event.handlerName = OPERATOR;
    event.handlingType = type;
    event.handlingResult = result;
    if (event.ruleCode === 'TRANSPORT_PARKING') event.parkingReason = extra.parkingReason || event.parkingReason || null;
    if (falseType) {
      event.falseAlarmReason = extra.falseAlarmReason || null;
      event.falsePositive = true;
    }
    if (event.ruleCode === 'UNLOAD_WEIGHBILL_MISSING' && type === '确认无需磅单') {
      event.metrics = event.metrics || {};
      event.metrics.weighbillNotRequired = true;
      event.metrics.weighbillStatus = '无需磅单';
      event.metrics.weighbillUploaded = false;
      event.eventStatus = '已恢复';
      event.recoveredAt = time;
      event.recoverReason = '确认无需磅单';
      addLog(event.id, 'NO_WEIGHBILL', '后台确认本任务无需磅单。' + (extra.falseAlarmReason || result), { operator: OPERATOR, operatedAt: time });
      addLog(event.id, 'RECOVERED', '确认无需磅单', { operator: OPERATOR, operatedAt: time });
    }
    var remark = (falseType && extra.falseAlarmReason ? (type + '：' + extra.falseAlarmReason) : (event.ruleCode === 'TRANSPORT_PARKING' && extra.parkingReason ? (type + '，' + extra.parkingReason) : type)) + '。' + result;
    if (event.ruleCode === 'VEHICLE_OVERSPEED') remark = speedHandleRemark(event.handleRecords[event.handleRecords.length - 1]);
    addLog(event.id, markDone ? 'HANDLED' : 'MANUAL_HANDLE', remark, { operator: OPERATOR, operatedAt: time });
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
    getAreaStayFences: function () { return clone(AREA_STAY_FENCES); },
    getAreaTypes: function () { return AREA_TYPES.slice(); },
    areaStayPriorityName: areaStayPriorityName,
    areaRelationText: areaRelationText,
    updateRule: updateRule,
    addParkingRule: addParkingRule,
    addAreaStayRule: addAreaStayRule,
    addSpeedRule: addSpeedRule,
    addLateRule: addLateRule,
    getParkingDraftTemplate: parkingDraftTemplate,
    getAreaStayDraftTemplate: areaStayDraftTemplate,
    getSpeedDraftTemplate: speedDraftTemplate,
    getWeighbillDraftTemplate: weighbillDraftTemplate,
    getSocDraftTemplate: socDraftTemplate,
    getFatigueDraftTemplate: fatigueDraftTemplate,
    departSourceText: departSourceText,
    removeRule: removeRule,
    getEvents: function () { refreshDetection(); return clone(state.events); },
    getEvent: function (id) { return clone(state.events.filter(function (item) { return item.id === id; })[0] || null); },
    getLogs: function (id) { return clone(logsFor(id)); },
    acknowledge: acknowledge,
    handle: handle,
    detectSignal: function (currentSignal) { return processSignal(clone(currentSignal), true); },
    refresh: function () { refreshDetection(); return clone(state.events); },
    inMonitorPeriod: function (rule, evaluatedAt) { return inMonitorPeriod(rule, evaluatedAt); },
    evaluateParking: function (currentSignal, rule, priorCycle) {
      return evaluateParking(clone(currentSignal), rule || resolveRule(state.rules, currentSignal), priorCycle || null);
    },
    evaluateSpeed: function (currentSignal, rule) {
      var signalCopy = clone(currentSignal || {});
      signalCopy.ruleCode = 'VEHICLE_OVERSPEED';
      return evaluateSpeed(signalCopy, rule || resolveRule(state.rules, signalCopy));
    },
    operator: OPERATOR,
    levelRank: levelRank
  };
})();
