const fs = require('fs');
const vm = require('vm');
const path = require('path');

const code = fs.readFileSync(path.resolve(__dirname, '../public/admin/alert-center-data.js'), 'utf8');
const localStorage = {
  store: {},
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null; },
  setItem(key, value) { this.store[key] = String(value); },
  removeItem(key) { delete this.store[key]; }
};
const sandbox = {
  window: {},
  localStorage,
  CustomEvent: class CustomEvent { constructor(type) { this.type = type; } },
  console
};
sandbox.window = sandbox;
sandbox.window.localStorage = localStorage;
sandbox.window.dispatchEvent = function () {};
vm.runInNewContext(code, sandbox);
const store = sandbox.window.AlertCenterStore;
if (!store) throw new Error('AlertCenterStore missing');

const events = store.getEvents().filter((item) => item.ruleCode === 'AREA_STAY_TIMEOUT');
const rules = store.getRules().filter((item) => item.code === 'AREA_STAY_TIMEOUT');
const names = events.map((item) => item.type);
const levels = events.reduce((acc, item) => {
  acc[item.currentLevel || item.level] = (acc[item.currentLevel || item.level] || 0) + (item.eventStatus === '发生中' ? 1 : 0);
  return acc;
}, {});
const scenes = events.map((item) => ({
  sourceId: item.sourceId,
  id: item.id,
  plate: item.plate,
  level: item.currentLevel || item.level,
  eventStatus: item.eventStatus,
  handleStatus: item.handleStatus,
  fenceName: item.fenceName,
  fenceType: item.fenceType,
  transportStage: item.transportStage,
  stay: item.eventStatus === '已恢复' ? item.finalStayDuration : item.currentStayDuration,
  handles: (item.handleRecords || []).map((row) => row.handleType + (row.falseAlarmReason ? ':' + row.falseAlarmReason : '')),
  ruleName: (item.ruleSnapshot || {}).ruleName
}));

const checks = {
  renamed: names.every((name) => name === '区域停留预警') && names.length > 0,
  noOldName: !JSON.stringify(events).includes('停车区域预警') && !rules.some((rule) => rule.name === '停车区域预警'),
  fiveScenes: ['live-area-general', 'live-area-serious', 'live-area-emergency-handled', 'history-area-recover', 'live-area-false-alarm']
    .every((id) => events.some((item) => item.sourceId === id)),
  general: events.some((item) => item.sourceId === 'live-area-general' && item.level === '一般' && item.eventStatus === '发生中' && item.handleStatus === '待处理'),
  serious: events.some((item) => item.sourceId === 'live-area-serious' && item.level === '严重' && item.eventStatus === '发生中' && (item.levelChangeLogs || []).length >= 1),
  emergencyHandled: events.some((item) => item.sourceId === 'live-area-emergency-handled' && item.level === '紧急' && item.eventStatus === '发生中' && item.handleStatus === '已处理'),
  recovered: events.some((item) => item.sourceId === 'history-area-recover' && item.eventStatus === '已恢复' && item.recoveredAt && item.finalStayDuration),
  falseAlarm: events.some((item) => item.sourceId === 'live-area-false-alarm' && (item.handleRecords || []).some((row) => row.handleType === '误报' && row.falseAlarmReason === 'GPS 漂移')),
  uniqueFenceEvents: events.filter((item) => item.sourceId === 'live-area-serious').length === 1,
  happeningStats: levels,
  differentiatedRules: rules.some((rule) => rule.areaType === '卸货区') && rules.some((rule) => (rule.fenceIds || []).includes('F-LOAD-KG')),
  defaultUndeletable: rules.some((rule) => rule.id === 'RULE_AREA_STAY')
};

const failed = Object.keys(checks).filter((key) => checks[key] !== true && key !== 'happeningStats');
console.log(JSON.stringify({ ok: failed.length === 0, failed, checks, scenes, ruleNames: rules.map((rule) => rule.name + ' / ' + (rule.areaType || '') + ' / ' + ((rule.fenceNames || [])[0] || '')) }, null, 2));
if (failed.length) process.exit(1);
