/*
 * 统一告警数据层
 * 本期只消费运输监控中心已有的六类预警信号，不改写大屏展示与交互。
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'hyxy-alert-center-v1';
  var LEGACY_RULE_KEY = 'hyxy-warning-rules-v1';
  var OPERATOR = '李调度';
  var PROJECT_ID = 'YX001';
  var PROJECT_NAME = '玉溪项目';
  var state;

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function pad(value) { return String(value).padStart(2, '0'); }
  function nowText() {
    var date = new Date();
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' '
      + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
  }
  function levelRank(level) { return level === '紧急' ? 3 : level === '严重' ? 2 : 1; }

  function seedRules() {
    return [
      {
        id: 'RULE_TRANSPORT_PARKING', code: 'TRANSPORT_PARKING', name: '停车预警', category: '运输',
        description: '车辆处于运输相关状态、速度为 0 且连续停车达到设定时长时触发', enabled: true,
        scopeType: '全部项目', projectIds: [], level: '严重',
        config: { threshold: 10, unit: '分钟', compare: '连续停车 ≥' },
        recoveryConfig: { description: '车辆重新行驶' }, updatedBy: '系统预置', updatedAt: '2026-09-28 09:00:00'
      },
      {
        id: 'RULE_PARKING_AREA', code: 'PARKING_AREA', name: '停车区域预警', category: '作业',
        description: '车辆在运输监控中心定义的业务区域内停留达到设定时长时触发', enabled: true,
        scopeType: '全部项目', projectIds: [], level: '严重',
        config: { threshold: 15, unit: '分钟', compare: '区域停留 ≥' },
        recoveryConfig: { description: '车辆离开对应业务区域' }, updatedBy: '系统预置', updatedAt: '2026-09-28 09:00:00'
      },
      {
        id: 'RULE_VEHICLE_OVERSPEED', code: 'VEHICLE_OVERSPEED', name: '车速预警', category: '车辆',
        description: '车辆当前速度达到配置阈值时触发', enabled: true,
        scopeType: '全部项目', projectIds: [], level: '紧急',
        config: { threshold: 80, unit: 'km/h', compare: '当前车速 ≥' },
        recoveryConfig: { description: '车辆速度恢复至阈值以下' }, updatedBy: '系统预置', updatedAt: '2026-09-28 09:00:00'
      },
      {
        id: 'RULE_UNLOAD_WEIGHBILL_MISSING', code: 'UNLOAD_WEIGHBILL_MISSING', name: '卸货后未上传磅单', category: '单据',
        description: '离开卸货地后达到等待时长且卸货磅单仍未上传时触发', enabled: true,
        scopeType: '全部项目', projectIds: [], level: '紧急',
        config: { threshold: 15, unit: '分钟', compare: '离开后等待 ≥' },
        recoveryConfig: { description: '卸货磅单上传成功' }, updatedBy: '系统预置', updatedAt: '2026-09-28 09:00:00'
      },
      {
        id: 'RULE_VEHICLE_LOW_SOC', code: 'VEHICLE_LOW_SOC', name: 'SOC预警', category: '车辆',
        description: '车辆剩余电量低于或等于配置阈值时触发', enabled: true,
        scopeType: '全部项目', projectIds: [], level: '严重',
        config: { threshold: 20, unit: '%', compare: '当前 SOC ≤' },
        recoveryConfig: { description: 'SOC 恢复至配置阈值以上' }, updatedBy: '系统预置', updatedAt: '2026-09-28 09:00:00'
      },
      {
        id: 'RULE_DRIVER_FATIGUE', code: 'DRIVER_FATIGUE', name: '疲劳驾驶预警', category: '安全',
        description: '司机本次连续驾驶时长达到配置阈值时触发（Demo 使用连续驾驶时长数据）', enabled: true,
        scopeType: '全部项目', projectIds: [], level: '紧急',
        config: { threshold: 4, unit: '小时', compare: '连续驾驶 ≥' },
        recoveryConfig: { description: '连续驾驶周期结束或已满足休息条件' }, updatedBy: '系统预置', updatedAt: '2026-09-28 09:00:00'
      }
    ];
  }

  function signal(base, metrics, facts) {
    base.metrics = metrics;
    base.facts = facts;
    return base;
  }

  /* 临界值以下的信号用于验证配置参与判断，默认不会生成告警。 */
  function monitorSignals() {
    return [
      signal({ sourceId: 'vw-bill', ruleCode: 'UNLOAD_WEIGHBILL_MISSING', plate: '云A·F4470', driverName: '马旺', driverId: 'D023', taskId: 'Y20260904000023', route: '昆钢 → 北城', cargo: '煤炭', location: '北城卸货区外侧', triggeredAt: '2026-09-28 13:57:00', currentValue: 26, displayValue: '未上传 · 已等待26分钟', sourceStatus: 'active' },
        { unloadLocation: '北城卸货区', unloadDepartedAt: '2026-09-28 13:31:00', leftUnload: true, weighbillUploaded: false, waitingMinutes: 26 }, ['13:31 离开北城卸货地', '卸货磅单：未上传', '已等待 26 分钟']),
      signal({ sourceId: 'vw-bill-safe', ruleCode: 'UNLOAD_WEIGHBILL_MISSING', plate: '云A·B1026', driverName: '陈飞', driverId: 'D026', taskId: 'Y20260904000026', route: '研和 → 北城', cargo: '水泥', location: '北城卸货区外侧', triggeredAt: '2026-09-28 14:20:00', currentValue: 10, displayValue: '未上传 · 已等待10分钟', sourceStatus: 'active' },
        { unloadLocation: '北城卸货区', unloadDepartedAt: '2026-09-28 14:10:00', leftUnload: true, weighbillUploaded: false, waitingMinutes: 10 }, ['14:10 离开北城卸货地', '卸货磅单：未上传', '已等待 10 分钟']),
      signal({ sourceId: 'vw-stop', ruleCode: 'TRANSPORT_PARKING', plate: '云A·D8021', driverName: '李宏俊', driverId: 'D021', taskId: 'Y20260904000021', route: '大开门 → 昆钢', cargo: '水渣', location: '昆磨高速辅路', triggeredAt: '2026-09-28 09:48:00', currentValue: 42, displayValue: '连续停车42分钟', sourceStatus: 'active' },
        { transportRelevant: true, parkingMinutes: 42, parkingStartedAt: '2026-09-28 09:48:00', speed: 0 }, ['当前位置：昆磨高速辅路', '车辆速度：0 km/h', '连续停车：42分钟']),
      signal({ sourceId: 'vw-stop-safe', ruleCode: 'TRANSPORT_PARKING', plate: '云A·C3518', driverName: '赵勇', driverId: 'D025', taskId: 'Y20260904000025', route: '昆钢 → 研和', cargo: '钢材', location: '昆磨高速入口', triggeredAt: '2026-09-28 14:18:00', currentValue: 8, displayValue: '连续停车8分钟', sourceStatus: 'active' },
        { transportRelevant: true, parkingMinutes: 8, parkingStartedAt: '2026-09-28 14:18:00', speed: 0 }, ['当前位置：昆磨高速入口', '车辆速度：0 km/h', '连续停车：8分钟']),
      signal({ sourceId: 'vw-site', ruleCode: 'PARKING_AREA', plate: '云A10103', driverName: '周强', driverId: 'D028', taskId: 'Y20260904000028', route: '昆钢 → 北城', cargo: '钢材', location: '北城卸货区', triggeredAt: '2026-09-28 08:26:00', currentValue: 76, displayValue: '区域停留1小时16分钟', sourceStatus: 'active' },
        { insideBusinessArea: true, areaDwellMinutes: 76, fenceName: '北城卸货区', enteredAt: '2026-09-28 08:26:00' }, ['08:26 进入北城卸货区', '当前仍在该业务区域', '停留时长：1小时16分钟']),
      signal({ sourceId: 'vw-speed', ruleCode: 'VEHICLE_OVERSPEED', plate: '云A·E1936', driverName: '王磊', driverId: 'D022', taskId: 'Y20260904000022', route: '北城 → 研和', cargo: '铁精粉', location: 'G8511 昆磨高速', triggeredAt: '2026-09-28 14:24:00', currentValue: 86, displayValue: '当前车速86 km/h', sourceStatus: 'active' },
        { speed: 86 }, ['当前速度：86 km/h', '当前位置：G8511 昆磨高速']),
      signal({ sourceId: 'vw-speed-safe', ruleCode: 'VEHICLE_OVERSPEED', plate: '云A·B1026', driverName: '陈飞', driverId: 'D026', taskId: 'Y20260904000026', route: '研和 → 北城', cargo: '水泥', location: '玉溪大道', triggeredAt: '2026-09-28 14:22:00', currentValue: 75, displayValue: '当前车速75 km/h', sourceStatus: 'active' },
        { speed: 75 }, ['当前速度：75 km/h', '当前位置：玉溪大道']),
      signal({ sourceId: 'vw-soc', ruleCode: 'VEHICLE_LOW_SOC', plate: '云A·D8021', driverName: '李宏俊', driverId: 'D021', taskId: 'Y20260904000021', route: '大开门 → 昆钢', cargo: '水渣', location: '昆钢 → 研和途中', triggeredAt: '2026-09-28 13:52:00', currentValue: 18, displayValue: '当前SOC 18%', sourceStatus: 'active' },
        { soc: 18 }, ['当前 SOC：18%', '当前任务：Y20260904000021', '当前位置：昆钢 → 研和途中']),
      signal({ sourceId: 'vw-soc-safe', ruleCode: 'VEHICLE_LOW_SOC', plate: '云A·C3518', driverName: '赵勇', driverId: 'D025', taskId: 'Y20260904000025', route: '昆钢 → 研和', cargo: '钢材', location: '昆磨高速入口', triggeredAt: '2026-09-28 14:18:00', currentValue: 34, displayValue: '当前SOC 34%', sourceStatus: 'active' },
        { soc: 34 }, ['当前 SOC：34%', '当前任务：Y20260904000025']),
      signal({ sourceId: 'vw-fatigue-safe', ruleCode: 'DRIVER_FATIGUE', drivingCycleId: 'D031-20260928-AM', plate: '云A·K5208', driverName: '杨明', driverId: 'D031', taskId: 'Y20260904000031', route: '研和 → 昆钢', cargo: '矿石', location: '昆磨高速研和段', triggeredAt: '2026-09-28 13:50:00', currentValue: 230, displayValue: '连续驾驶3小时50分钟', sourceStatus: 'active' },
        { continuousDrivingMinutes: 230, drivingStartedAt: '2026-09-28 10:00:00', drivingCycleActive: true }, ['10:00 开始本次连续驾驶', '当前连续驾驶：3小时50分钟']),
      signal({ sourceId: 'vw-fatigue', ruleCode: 'DRIVER_FATIGUE', drivingCycleId: 'D021-20260928-AM', plate: '云A·D8021', driverName: '李宏俊', driverId: 'D021', taskId: 'Y20260904000021', route: '大开门 → 昆钢', cargo: '水渣', location: '昆磨高速辅路', triggeredAt: '2026-09-28 14:00:00', currentValue: 240, displayValue: '连续驾驶4小时', sourceStatus: 'active' },
        { continuousDrivingMinutes: 240, drivingStartedAt: '2026-09-28 10:00:00', drivingCycleActive: true }, ['10:00 开始本次连续驾驶', '当前连续驾驶：4小时']),
      signal({ sourceId: 'vw-fatigue', ruleCode: 'DRIVER_FATIGUE', drivingCycleId: 'D021-20260928-AM', plate: '云A·D8021', driverName: '李宏俊', driverId: 'D021', taskId: 'Y20260904000021', route: '大开门 → 昆钢', cargo: '水渣', location: '昆磨高速辅路', triggeredAt: '2026-09-28 14:00:00', currentValue: 252, displayValue: '连续驾驶4小时12分钟', sourceStatus: 'active' },
        { continuousDrivingMinutes: 252, drivingStartedAt: '2026-09-28 10:00:00', drivingCycleActive: true }, ['10:00 开始本次连续驾驶', '当前连续驾驶：4小时12分钟', '同一驾驶周期持续更新']),
      signal({ sourceId: 'vw-r1', ruleCode: 'PARKING_AREA', plate: '云A66666', driverName: '冯二', driverId: 'D040', taskId: 'Y20260904000040', route: '大开门 → 研和', cargo: '铁精粉', location: '大开门充电站', triggeredAt: '2026-09-28 08:32:00', recoveredAt: '2026-09-28 09:06:00', currentValue: 34, displayValue: '区域停留34分钟', sourceStatus: 'recovered', wasTriggered: true },
        { insideBusinessArea: false, areaDwellMinutes: 34, fenceName: '大开门充电站', enteredAt: '2026-09-28 08:32:00' }, ['08:32 触发预警', '09:06 离开充电站', '09:06 自动恢复']),
      signal({ sourceId: 'vw-r2', ruleCode: 'TRANSPORT_PARKING', plate: '云A12345', driverName: '张三', driverId: 'D018', taskId: 'Y20260904000018', route: '昆钢 → 北城', cargo: '钢材', location: '昆钢厂区外侧', triggeredAt: '2026-09-28 07:51:00', recoveredAt: '2026-09-28 08:09:00', currentValue: 18, displayValue: '连续停车18分钟', sourceStatus: 'recovered', wasTriggered: true },
        { transportRelevant: true, parkingMinutes: 18, parkingStartedAt: '2026-09-28 07:51:00', speed: 32 }, ['07:51 触发预警', '08:09 恢复正常行驶', '08:09 自动恢复']),
      signal({ sourceId: 'vw-r3', ruleCode: 'UNLOAD_WEIGHBILL_MISSING', plate: '云A10104', driverName: '刘伟', driverId: 'D019', taskId: 'Y20260904000019', route: '昆钢 → 研和', cargo: '煤炭', location: '研和卸货区', triggeredAt: '2026-09-28 07:20:00', recoveredAt: '2026-09-28 07:31:00', currentValue: 26, displayValue: '已等待26分钟后上传', sourceStatus: 'recovered', wasTriggered: true },
        { unloadLocation: '研和卸货区', unloadDepartedAt: '2026-09-28 07:05:00', leftUnload: true, weighbillUploaded: true, waitingMinutes: 26 }, ['07:05 离开卸货地', '07:20 触发预警', '07:31 上传磅单并自动恢复']),
      signal({ sourceId: 'vw-fatigue-r1', ruleCode: 'DRIVER_FATIGUE', drivingCycleId: 'D033-20260927-PM', plate: '云A·H3188', driverName: '何平', driverId: 'D033', taskId: 'Y20260903000033', route: '北城 → 研和', cargo: '煤炭', location: '研和停车区', triggeredAt: '2026-09-27 18:00:00', recoveredAt: '2026-09-27 18:18:00', currentValue: 0, displayValue: '连续驾驶周期已结束', sourceStatus: 'recovered', wasTriggered: true },
        { continuousDrivingMinutes: 0, peakContinuousDrivingMinutes: 258, drivingStartedAt: '2026-09-27 13:42:00', drivingCycleActive: false }, ['13:42 开始本次连续驾驶', '18:00 触发疲劳驾驶预警', '18:18 连续驾驶周期结束并自动恢复'])
    ];
  }

  function ruleByCode(rules, code) { return (rules || []).filter(function (item) { return item.code === code; })[0] || null; }
  function metricNumber(signal, key) {
    var metrics = signal.metrics || {};
    return Number(metrics[key] == null ? signal.currentValue : metrics[key]);
  }
  function matchesCondition(signal, rule) {
    if (!rule || !rule.config) return false;
    var threshold = Number(rule.config.threshold);
    var metrics = signal.metrics || {};
    switch (rule.code) {
      case 'TRANSPORT_PARKING': return metrics.transportRelevant === true && Number(metrics.speed) === 0 && metricNumber(signal, 'parkingMinutes') >= threshold;
      case 'PARKING_AREA': return metrics.insideBusinessArea === true && metricNumber(signal, 'areaDwellMinutes') >= threshold;
      case 'VEHICLE_OVERSPEED': return metricNumber(signal, 'speed') >= threshold;
      case 'UNLOAD_WEIGHBILL_MISSING': return metrics.leftUnload === true && metrics.weighbillUploaded === false && metricNumber(signal, 'waitingMinutes') >= threshold;
      case 'VEHICLE_LOW_SOC': return metricNumber(signal, 'soc') <= threshold;
      case 'DRIVER_FATIGUE': return metrics.drivingCycleActive === true && metricNumber(signal, 'continuousDrivingMinutes') >= threshold * 60;
      default: return false;
    }
  }
  function isTriggered(signal, rule) { return !!(rule && rule.enabled && matchesCondition(signal, rule)); }
  function eventKey(signal) {
    if (signal.ruleCode === 'DRIVER_FATIGUE') return [signal.ruleCode, signal.driverId || signal.driverName, signal.drivingCycleId || (signal.metrics || {}).drivingStartedAt].join('|');
    return [signal.ruleCode, signal.vehicleId || signal.plate, signal.taskId || 'NO_TASK'].join('|');
  }
  function eventId(index) { return 'AL20260928' + String(index + 1).padStart(4, '0'); }
  function logId(index) { return 'LOG20260928' + String(index + 1).padStart(4, '0'); }
  function ruleSnapshot(rule) {
    return {
      ruleId: rule.id, ruleCode: rule.code, ruleName: rule.name, category: rule.category, level: rule.level,
      config: clone(rule.config), recoveryConfig: clone(rule.recoveryConfig),
      threshold: Number(rule.config.threshold), unit: rule.config.unit, compare: rule.config.compare,
      recovery: rule.recoveryConfig.description, capturedAt: nowText()
    };
  }
  function eventFromSignal(signal, rule, index) {
    var recovered = signal.sourceStatus === 'recovered';
    var handled = signal.sourceId === 'vw-r1' || signal.sourceId === 'vw-r2';
    var handling = signal.sourceId === 'vw-stop';
    var activeHandled = signal.sourceId === 'vw-soc';
    var handleStatus = handled || activeHandled ? '已处理' : handling ? '处理中' : '待处理';
    return {
      id: eventId(index), sourceId: signal.sourceId, eventKey: eventKey(signal), drivingCycleId: signal.drivingCycleId || null,
      ruleId: rule.id, ruleCode: rule.code, category: rule.category, type: rule.name, level: rule.level,
      projectId: PROJECT_ID, projectName: PROJECT_NAME,
      vehicleId: signal.vehicleId || 'FV-' + signal.plate.replace(/[^A-Z0-9\u4e00-\u9fa5]/gi, ''), plate: signal.plate,
      driverId: signal.driverId, driverName: signal.driverName, taskId: signal.taskId,
      route: signal.route, cargo: signal.cargo, location: signal.location,
      triggeredAt: signal.triggeredAt, recoveredAt: signal.recoveredAt || null,
      currentValue: signal.currentValue, currentValueText: signal.displayValue,
      thresholdValue: Number(rule.config.threshold), unit: rule.config.unit,
      eventStatus: recovered ? '已恢复' : '发生中', handleStatus: handleStatus,
      acknowledgedAt: handling ? '2026-09-28 10:02:00' : (handled || activeHandled ? '2026-09-28 09:12:00' : null),
      acknowledgedBy: handling || handled || activeHandled ? OPERATOR : null,
      handlerId: handled || activeHandled ? 'U001' : null, handlerName: handled || activeHandled ? OPERATOR : null,
      handlingStartedAt: handled || activeHandled ? '2026-09-28 09:13:00' : null,
      handledAt: handled || activeHandled ? (recovered ? signal.recoveredAt : '2026-09-28 14:01:00') : null,
      handlingType: handled || activeHandled ? (rule.code === 'VEHICLE_LOW_SOC' ? '安排充电' : '联系司机') : null,
      handlingResult: handled || activeHandled ? (rule.code === 'VEHICLE_LOW_SOC' ? '已联系司机前往最近充电站，持续关注车辆电量。' : '已联系司机核实，车辆恢复后继续运输。') : null,
      ruleSnapshot: ruleSnapshot(rule), metrics: clone(signal.metrics || {}), facts: clone(signal.facts || []), lastDetectedAt: nowText()
    };
  }
  function updateEventFromSignal(event, currentSignal) {
    event.sourceId = currentSignal.sourceId;
    event.currentValue = currentSignal.currentValue;
    event.currentValueText = currentSignal.displayValue;
    event.metrics = clone(currentSignal.metrics || {});
    event.facts = clone(currentSignal.facts || []);
    event.location = currentSignal.location;
    event.lastDetectedAt = nowText();
  }
  function seedState() {
    var rules = seedRules();
    migrateLegacyRules(rules);
    var events = [];
    monitorSignals().forEach(function (currentSignal) {
      var rule = ruleByCode(rules, currentSignal.ruleCode);
      if (!rule || (!currentSignal.wasTriggered && !isTriggered(currentSignal, rule))) return;
      var key = eventKey(currentSignal);
      var existing = events.filter(function (event) { return event.eventKey === key && event.eventStatus === '发生中'; })[0];
      if (existing) {
        updateEventFromSignal(existing, currentSignal);
        if (currentSignal.sourceStatus === 'recovered') {
          existing.eventStatus = '已恢复';
          existing.recoveredAt = currentSignal.recoveredAt || nowText();
        }
        return;
      }
      events.push(eventFromSignal(currentSignal, rule, events.length));
    });
    var logs = [];
    events.forEach(function (event) {
      logs.push({ id: logId(logs.length), alertId: event.id, action: 'TRIGGERED', operator: '系统', operatedAt: event.triggeredAt, remark: '达到「' + event.ruleSnapshot.ruleName + '」触发条件' });
      if (event.acknowledgedAt) logs.push({ id: logId(logs.length), alertId: event.id, action: 'ACKNOWLEDGED', operator: event.acknowledgedBy, operatedAt: event.acknowledgedAt, remark: '已知悉告警' });
      if (event.handlingStartedAt) logs.push({ id: logId(logs.length), alertId: event.id, action: 'HANDLING_STARTED', operator: event.handlerName, operatedAt: event.handlingStartedAt, remark: event.handlingType || '开始处理' });
      if (event.recoveredAt) logs.push({ id: logId(logs.length), alertId: event.id, action: 'RECOVERED', operator: '系统', operatedAt: event.recoveredAt, remark: event.ruleSnapshot.recovery });
      if (event.handledAt) logs.push({ id: logId(logs.length), alertId: event.id, action: 'HANDLED', operator: event.handlerName, operatedAt: event.handledAt, remark: event.handlingResult || '处理完成' });
    });
    return { version: 1, rules: rules, events: events, logs: logs };
  }
  function migrateLegacyRules(rules) {
    var map = { stop: 'TRANSPORT_PARKING', site: 'PARKING_AREA', speed: 'VEHICLE_OVERSPEED', weigh: 'UNLOAD_WEIGHBILL_MISSING', soc: 'VEHICLE_LOW_SOC' };
    try {
      var legacy = JSON.parse(localStorage.getItem(LEGACY_RULE_KEY) || 'null');
      (legacy && legacy.rules || []).forEach(function (oldRule) {
        var next = ruleByCode(rules, map[oldRule.id]);
        if (!next) return;
        if (isFinite(Number(oldRule.threshold))) next.config.threshold = Number(oldRule.threshold);
        next.enabled = oldRule.enabled !== false;
        next.level = oldRule.level === '高' ? '紧急' : '严重';
        next.updatedBy = oldRule.modifier || next.updatedBy;
        next.updatedAt = oldRule.modifyTime || next.updatedAt;
      });
    } catch (error) {}
  }
  function normalizeRule(savedRule, seededRule) {
    var normalized = Object.assign({}, clone(seededRule), clone(savedRule || {}));
    normalized.config = Object.assign({}, clone(seededRule.config), clone(savedRule && savedRule.config || {}));
    normalized.recoveryConfig = Object.assign({}, clone(seededRule.recoveryConfig), clone(savedRule && savedRule.recoveryConfig || {}));
    delete normalized.repeatIntervalMinutes;
    return normalized;
  }
  function normalizeEvent(savedEvent) {
    var event = Object.assign({}, savedEvent || {});
    event.metrics = event.metrics && typeof event.metrics === 'object' ? event.metrics : {};
    event.facts = Array.isArray(event.facts) ? event.facts : [];
    event.ruleSnapshot = event.ruleSnapshot && typeof event.ruleSnapshot === 'object' ? event.ruleSnapshot : {};
    return event;
  }
  function normalize(saved) {
    var seeded = seedState();
    if (!saved || saved.version !== 1) return seeded;
    var savedRules = Array.isArray(saved.rules) ? saved.rules : [];
    return {
      version: 1,
      rules: seeded.rules.map(function (seededRule) { return normalizeRule(ruleByCode(savedRules, seededRule.code), seededRule); }),
      events: Array.isArray(saved.events) ? saved.events.map(normalizeEvent) : seeded.events,
      logs: Array.isArray(saved.logs) ? saved.logs : seeded.logs
    };
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
  function addLog(alertId, action, operator, remark, operatedAt) {
    state.logs.push({ id: 'LOG-' + Date.now() + '-' + state.logs.length, alertId: alertId, action: action, operator: operator || OPERATOR, operatedAt: operatedAt || nowText(), remark: remark || '' });
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
  function refreshDetection() {
    var changed = false;
    monitorSignals().forEach(function (currentSignal) {
      var rule = ruleByCode(state.rules, currentSignal.ruleCode);
      var active = activeEventFor(currentSignal);
      if (active) {
        var snapshot = active.ruleSnapshot || {};
        var snapshotRule = { code: active.ruleCode, config: clone(snapshot.config || { threshold: snapshot.threshold, unit: snapshot.unit, compare: snapshot.compare }) };
        if (currentSignal.sourceStatus === 'recovered' || !matchesCondition(currentSignal, snapshotRule)) {
          active.eventStatus = '已恢复';
          active.recoveredAt = currentSignal.recoveredAt || nowText();
          updateEventFromSignal(active, currentSignal);
          addLog(active.id, 'RECOVERED', '系统', (snapshot.recoveryConfig || {}).description || snapshot.recovery || '触发条件已解除', active.recoveredAt);
          changed = true;
        } else updateEventFromSignal(active, currentSignal);
        return;
      }
      if (currentSignal.sourceStatus !== 'active' || !isTriggered(currentSignal, rule)) return;
      var event = eventFromSignal(currentSignal, rule, 0);
      event.id = nextEventId();
      event.handleStatus = '待处理';
      event.acknowledgedAt = null;
      event.acknowledgedBy = null;
      event.handlerId = null;
      event.handlerName = null;
      event.handlingStartedAt = null;
      event.handledAt = null;
      event.handlingType = null;
      event.handlingResult = null;
      state.events.unshift(event);
      addLog(event.id, 'TRIGGERED', '系统', '达到「' + rule.name + '」触发条件', event.triggeredAt);
      changed = true;
    });
    if (changed) persist();
  }
  function updateRule(id, patch) {
    var rule = state.rules.filter(function (item) { return item.id === id; })[0];
    if (!rule) return null;
    if (patch.enabled != null) rule.enabled = !!patch.enabled;
    if (patch.level && ['一般', '严重', '紧急'].indexOf(patch.level) >= 0) rule.level = patch.level;
    if (patch.scopeType) rule.scopeType = patch.scopeType;
    rule.projectIds = patch.scopeType === '指定项目' ? [PROJECT_ID] : [];
    if (isFinite(Number(patch.threshold))) rule.config.threshold = Number(patch.threshold);
    delete rule.repeatIntervalMinutes;
    rule.updatedBy = OPERATOR;
    rule.updatedAt = nowText();
    persist();
    refreshDetection();
    return clone(rule);
  }
  function acknowledge(id) {
    var event = state.events.filter(function (item) { return item.id === id; })[0];
    if (!event || event.handleStatus !== '待处理') return clone(event);
    event.handleStatus = '处理中';
    event.acknowledgedAt = nowText();
    event.acknowledgedBy = OPERATOR;
    addLog(event.id, 'ACKNOWLEDGED', OPERATOR, '已知悉告警');
    persist();
    return clone(event);
  }
  function handle(id, type, result) {
    var event = state.events.filter(function (item) { return item.id === id; })[0];
    if (!event) return null;
    var time = nowText();
    if (!event.acknowledgedAt) {
      event.acknowledgedAt = time;
      event.acknowledgedBy = OPERATOR;
      addLog(event.id, 'ACKNOWLEDGED', OPERATOR, '处理时自动知悉告警', time);
    }
    if (!event.handlingStartedAt) {
      event.handlingStartedAt = time;
      addLog(event.id, 'HANDLING_STARTED', OPERATOR, type, time);
    }
    event.handleStatus = '已处理';
    event.handlerId = 'U001';
    event.handlerName = OPERATOR;
    event.handledAt = time;
    event.handlingType = type;
    event.handlingResult = result;
    addLog(event.id, 'HANDLED', OPERATOR, result, time);
    persist();
    return clone(event);
  }
  function logsFor(id) {
    return state.logs.filter(function (item) { return item.alertId === id; }).sort(function (a, b) { return String(a.operatedAt).localeCompare(String(b.operatedAt)); });
  }

  state = load();
  refreshDetection();

  window.AlertCenterStore = {
    getRules: function () { return clone(state.rules); },
    getRule: function (id) { return clone(state.rules.filter(function (item) { return item.id === id; })[0] || null); },
    updateRule: updateRule,
    getEvents: function () { refreshDetection(); return clone(state.events); },
    getEvent: function (id) { return clone(state.events.filter(function (item) { return item.id === id; })[0] || null); },
    getLogs: function (id) { return clone(logsFor(id)); },
    acknowledge: acknowledge,
    handle: handle,
    refresh: function () { refreshDetection(); return clone(state.events); },
    operator: OPERATOR,
    levelRank: levelRank
  };
})();
