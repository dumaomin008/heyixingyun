/*
 * 统一告警数据层
 *
 * 本期只消费「运输监控中心」已有的五类预警事件，不改写大屏展示与交互。
 * 规则、独立告警事件、处理日志保存在 localStorage，适配纯前端 Demo 部署。
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'hyxy-alert-center-v1';
  var LEGACY_RULE_KEY = 'hyxy-warning-rules-v1';
  var OPERATOR = '李调度';
  var PROJECT_ID = 'YX001';
  var PROJECT_NAME = '玉溪项目';
  var state;

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }
  function pad(value) { return String(value).padStart(2, '0'); }
  function nowText() {
    var date = new Date();
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' '
      + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
  }
  function levelRank(level) {
    return level === '紧急' ? 3 : level === '严重' ? 2 : 1;
  }

  function seedRules() {
    return [
      {
        id: 'RULE_TRANSPORT_PARKING', code: 'TRANSPORT_PARKING', name: '停车预警', category: '运输',
        description: '车辆不在装卸货点或充电站且持续静止时触发', enabled: true,
        scopeType: '全部项目', projectIds: [], level: '严重',
        config: { threshold: 10, unit: '分钟', compare: '持续 ≥' },
        recoveryConfig: { description: '车辆重新行驶，或进入装卸货点/充电站' }, repeatIntervalMinutes: 30,
        updatedBy: '系统预置', updatedAt: '2026-09-28 09:00:00'
      },
      {
        id: 'RULE_PARKING_AREA', code: 'PARKING_AREA', name: '停车区域预警', category: '作业',
        description: '车辆在装卸货点或充电站区域停留超过设定时长时触发', enabled: true,
        scopeType: '全部项目', projectIds: [], level: '严重',
        config: { threshold: 15, unit: '分钟', compare: '持续 ≥' },
        recoveryConfig: { description: '车辆离开当前业务区域' }, repeatIntervalMinutes: 30,
        updatedBy: '系统预置', updatedAt: '2026-09-28 09:00:00'
      },
      {
        id: 'RULE_VEHICLE_OVERSPEED', code: 'VEHICLE_OVERSPEED', name: '车速预警', category: '车辆',
        description: '车辆速度高于配置阈值时触发', enabled: true,
        scopeType: '全部项目', projectIds: [], level: '紧急',
        config: { threshold: 80, unit: 'km/h', compare: '速度 ≥' },
        recoveryConfig: { description: '车辆速度恢复至阈值以下' }, repeatIntervalMinutes: 15,
        updatedBy: '系统预置', updatedAt: '2026-09-28 09:00:00'
      },
      {
        id: 'RULE_UNLOAD_WEIGHBILL_MISSING', code: 'UNLOAD_WEIGHBILL_MISSING', name: '卸货后未上传磅单', category: '单据',
        description: '离开卸货点后超过等待时间仍未上传卸货磅单时触发', enabled: true,
        scopeType: '全部项目', projectIds: [], level: '紧急',
        config: { threshold: 15, unit: '分钟', compare: '离开后 ≥' },
        recoveryConfig: { description: '成功上传卸货磅单' }, repeatIntervalMinutes: 30,
        updatedBy: '系统预置', updatedAt: '2026-09-28 09:00:00'
      },
      {
        id: 'RULE_VEHICLE_LOW_SOC', code: 'VEHICLE_LOW_SOC', name: 'SOC预警', category: '车辆',
        description: '车辆剩余电量低于配置阈值时触发', enabled: true,
        scopeType: '全部项目', projectIds: [], level: '严重',
        config: { threshold: 20, unit: '%', compare: 'SOC ≤' },
        recoveryConfig: { description: 'SOC 恢复至阈值以上' }, repeatIntervalMinutes: 30,
        updatedBy: '系统预置', updatedAt: '2026-09-28 09:00:00'
      }
    ];
  }

  /* 字段取自现有运输监控中心 VM_WARNINGS 及其车辆/任务上下文。 */
  function monitorSignals() {
    return [
      { sourceId: 'vw-bill', ruleCode: 'UNLOAD_WEIGHBILL_MISSING', plate: '云A·F4470', driverName: '马旺', driverId: 'D023', taskId: 'Y20260904000023', route: '昆钢 → 北城', cargo: '煤炭', location: '北城卸货区外侧', triggeredAt: '2026-09-28 13:57:00', currentValue: 26, displayValue: '未上传 · 26分钟', sourceStatus: 'active', facts: ['13:31 离开北城卸货地', '卸货磅单：未上传', '已等待 26 分钟'] },
      { sourceId: 'vw-stop', ruleCode: 'TRANSPORT_PARKING', plate: '云A·D8021', driverName: '李宏俊', driverId: 'D021', taskId: 'Y20260904000021', route: '大开门 → 昆钢', cargo: '水渣', location: '昆磨高速辅路', triggeredAt: '2026-09-28 09:48:00', currentValue: 42, displayValue: '静止 42分钟', sourceStatus: 'active', facts: ['当前位置：昆磨高速辅路', '车辆速度：0 km/h', '不在装卸货点或充电站范围'] },
      { sourceId: 'vw-site', ruleCode: 'PARKING_AREA', plate: '云A10103', driverName: '周强', driverId: 'D028', taskId: 'Y20260904000028', route: '昆钢 → 北城', cargo: '钢材', location: '北城卸货区', triggeredAt: '2026-09-28 08:26:00', currentValue: 76, displayValue: '停留 76分钟', sourceStatus: 'active', facts: ['08:26 到达北城卸货区', '当前仍在卸货区域', '停留时长：1小时16分钟'] },
      { sourceId: 'vw-speed', ruleCode: 'VEHICLE_OVERSPEED', plate: '云A·E1936', driverName: '王磊', driverId: 'D022', taskId: 'Y20260904000022', route: '北城 → 研和', cargo: '铁精粉', location: 'G8511 昆磨高速', triggeredAt: '2026-09-28 14:24:00', currentValue: 86, displayValue: '86 km/h', sourceStatus: 'active', facts: ['当前速度：86 km/h', '持续时间：2分钟'] },
      { sourceId: 'vw-soc', ruleCode: 'VEHICLE_LOW_SOC', plate: '云A·D8021', driverName: '李宏俊', driverId: 'D021', taskId: 'Y20260904000021', route: '大开门 → 昆钢', cargo: '水渣', location: '昆钢 → 研和途中', triggeredAt: '2026-09-28 13:52:00', currentValue: 18, displayValue: 'SOC 18%', sourceStatus: 'active', facts: ['当前 SOC：18%', '当前任务：运输中'] },
      { sourceId: 'vw-r1', ruleCode: 'PARKING_AREA', plate: '云A66666', driverName: '冯二', driverId: 'D040', taskId: 'Y20260904000040', route: '大开门 → 研和', cargo: '铁精粉', location: '大开门充电站', triggeredAt: '2026-09-28 08:32:00', recoveredAt: '2026-09-28 09:06:00', currentValue: 34, displayValue: '停留 34分钟', sourceStatus: 'recovered', facts: ['08:32 触发预警', '09:06 离开充电站', '09:06 自动恢复'] },
      { sourceId: 'vw-r2', ruleCode: 'TRANSPORT_PARKING', plate: '云A12345', driverName: '张三', driverId: 'D018', taskId: 'Y20260904000018', route: '昆钢 → 北城', cargo: '钢材', location: '昆钢厂区外侧', triggeredAt: '2026-09-28 07:51:00', recoveredAt: '2026-09-28 08:09:00', currentValue: 18, displayValue: '静止 18分钟', sourceStatus: 'recovered', facts: ['07:51 触发预警', '08:09 恢复正常行驶', '08:09 自动恢复'] },
      { sourceId: 'vw-r3', ruleCode: 'UNLOAD_WEIGHBILL_MISSING', plate: '云A10104', driverName: '刘伟', driverId: 'D019', taskId: 'Y20260904000019', route: '昆钢 → 研和', cargo: '煤炭', location: '研和卸货区', triggeredAt: '2026-09-28 07:20:00', recoveredAt: '2026-09-28 07:31:00', currentValue: 26, displayValue: '未上传 · 26分钟', sourceStatus: 'recovered', facts: ['07:05 离开卸货地', '07:20 触发预警', '07:31 上传磅单并自动恢复'] }
    ];
  }

  function ruleByCode(rules, code) {
    return (rules || []).filter(function (item) { return item.code === code; })[0] || null;
  }
  function isTriggered(signal, rule) {
    if (!rule || !rule.enabled) return false;
    var threshold = Number(rule.config && rule.config.threshold);
    var value = Number(signal.currentValue);
    if (rule.code === 'VEHICLE_LOW_SOC') return value <= threshold;
    return value >= threshold;
  }
  function eventId(index) { return 'AL20260928' + String(index + 1).padStart(4, '0'); }
  function logId(index) { return 'LOG20260928' + String(index + 1).padStart(4, '0'); }
  function ruleSnapshot(rule) {
    return {
      ruleId: rule.id, ruleCode: rule.code, ruleName: rule.name, level: rule.level,
      threshold: Number(rule.config.threshold), unit: rule.config.unit,
      compare: rule.config.compare, recovery: rule.recoveryConfig.description,
      capturedAt: nowText()
    };
  }
  function eventFromSignal(signal, rule, index) {
    var recovered = signal.sourceStatus === 'recovered';
    var handled = signal.sourceId === 'vw-r1' || signal.sourceId === 'vw-r2';
    var handling = signal.sourceId === 'vw-stop';
    var activeHandled = signal.sourceId === 'vw-soc';
    var handleStatus = handled || activeHandled ? '已处理' : handling ? '处理中' : '待处理';
    var event = {
      id: eventId(index), sourceId: signal.sourceId,
      ruleId: rule.id, ruleCode: rule.code, category: rule.category, type: rule.name, level: rule.level,
      projectId: PROJECT_ID, projectName: PROJECT_NAME,
      vehicleId: 'FV-' + signal.plate.replace(/[^A-Z0-9\u4e00-\u9fa5]/gi, ''), plate: signal.plate,
      driverId: signal.driverId, driverName: signal.driverName, taskId: signal.taskId,
      route: signal.route, cargo: signal.cargo, location: signal.location,
      triggeredAt: signal.triggeredAt, recoveredAt: signal.recoveredAt || null,
      currentValue: signal.currentValue, currentValueText: signal.displayValue,
      thresholdValue: Number(rule.config.threshold), unit: rule.config.unit,
      eventStatus: recovered ? '已恢复' : '发生中', handleStatus: handleStatus,
      acknowledgedAt: handling ? '2026-09-28 10:02:00' : (handled || activeHandled ? '2026-09-28 09:12:00' : null),
      acknowledgedBy: handling || handled || activeHandled ? OPERATOR : null,
      handlerId: handled || activeHandled ? 'U001' : null,
      handlerName: handled || activeHandled ? OPERATOR : null,
      handlingStartedAt: handled || activeHandled ? '2026-09-28 09:13:00' : null,
      handledAt: handled || activeHandled ? (recovered ? signal.recoveredAt : '2026-09-28 14:01:00') : null,
      handlingType: handled || activeHandled ? (rule.code === 'VEHICLE_LOW_SOC' ? '安排充电' : '联系司机') : null,
      handlingResult: handled || activeHandled ? (rule.code === 'VEHICLE_LOW_SOC' ? '已联系司机前往最近充电站，持续关注车辆电量。' : '已联系司机核实，车辆恢复后继续运输。') : null,
      ruleSnapshot: ruleSnapshot(rule), facts: clone(signal.facts || []), lastDetectedAt: nowText()
    };
    return event;
  }
  function seedState() {
    var rules = seedRules();
    migrateLegacyRules(rules);
    var events = monitorSignals().map(function (signal, index) {
      return eventFromSignal(signal, ruleByCode(rules, signal.ruleCode), index);
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
  function normalize(saved) {
    var seeded = seedState();
    if (!saved || saved.version !== 1) return seeded;
    var rules = Array.isArray(saved.rules) ? saved.rules : seeded.rules;
    var ruleCodes = {};
    rules.forEach(function (rule) { ruleCodes[rule.code] = true; });
    seeded.rules.forEach(function (rule) { if (!ruleCodes[rule.code]) rules.push(rule); });
    return {
      version: 1,
      rules: rules,
      events: Array.isArray(saved.events) ? saved.events : seeded.events,
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
    var max = state.events.reduce(function (current, event) {
      return Math.max(current, Number(String(event.id || '').replace(/\D/g, '').slice(-4)) || 0);
    }, 0);
    return 'AL' + nowText().slice(0, 10).replace(/-/g, '') + String(max + 1).padStart(4, '0');
  }
  function addLog(alertId, action, operator, remark, operatedAt) {
    state.logs.push({
      id: 'LOG-' + Date.now() + '-' + state.logs.length,
      alertId: alertId, action: action, operator: operator || OPERATOR,
      operatedAt: operatedAt || nowText(), remark: remark || ''
    });
  }
  function refreshDetection() {
    var changed = false;
    monitorSignals().filter(function (signal) { return signal.sourceStatus === 'active'; }).forEach(function (signal) {
      var rule = ruleByCode(state.rules, signal.ruleCode);
      var active = state.events.filter(function (event) {
        return event.ruleCode === signal.ruleCode && event.plate === signal.plate && event.taskId === signal.taskId && event.eventStatus === '发生中';
      })[0];
      var triggered = isTriggered(signal, rule);
      if (active) {
        if (triggered) {
          active.currentValue = signal.currentValue;
          active.currentValueText = signal.displayValue;
          active.lastDetectedAt = nowText();
        } else if (rule && rule.enabled) {
          active.eventStatus = '已恢复';
          active.recoveredAt = nowText();
          addLog(active.id, 'RECOVERED', '系统', '重新检测后触发条件已不成立');
          changed = true;
        }
        return;
      }
      if (!triggered) return;
      var event = eventFromSignal(signal, rule, 0);
      event.id = nextEventId();
      event.ruleSnapshot = ruleSnapshot(rule);
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
    if (isFinite(Number(patch.repeatIntervalMinutes))) rule.repeatIntervalMinutes = Number(patch.repeatIntervalMinutes);
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
    return state.logs.filter(function (item) { return item.alertId === id; }).sort(function (a, b) {
      return String(a.operatedAt).localeCompare(String(b.operatedAt));
    });
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
