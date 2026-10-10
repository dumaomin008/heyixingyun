const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const localStorage = {
  store: {},
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null; },
  setItem(key, value) { this.store[key] = String(value); },
  removeItem(key) { delete this.store[key]; }
};
const nodes = {};
function makeEl(tag) {
  const el = {
    tagName: tag, className: '', _id: '', innerHTML: '', hidden: false, value: '',
    children: [], style: {},
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    setAttribute() {}, getAttribute(name) { return name === 'data-name' ? this._dataName || '' : ''; },
    addEventListener() {}, appendChild(child) { this.children.push(child); return child; },
    remove() { if (this._id) delete nodes[this._id]; },
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
    click() {}
  };
  Object.defineProperty(el, 'id', {
    get() { return this._id; },
    set(value) { if (this._id) delete nodes[this._id]; this._id = value; if (value) nodes[value] = this; }
  });
  return el;
}
const documentStub = {
  body: makeEl('body'),
  createElement: makeEl,
  getElementById(id) { return nodes[id] || null; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  addEventListener() {}
};
const sandbox = {
  window: {}, document: documentStub, localStorage, console,
  CustomEvent: class CustomEvent { constructor(type) { this.type = type; } },
  setTimeout(fn) { if (typeof fn === 'function') fn(); },
  Array, Object, Number, String, JSON, Date, Math, isFinite, parseInt, parseFloat, URL: { createObjectURL() { return ''; }, revokeObjectURL() {} }, Blob: class Blob {}
};
sandbox.window = sandbox;
sandbox.window.window = sandbox.window;
sandbox.window.document = documentStub;
sandbox.window.localStorage = localStorage;
sandbox.window.dispatchEvent = function () {};
sandbox.window.addEventListener = function () {};
sandbox.window.location = { hash: '#alert-parking' };
sandbox.window.confirm = function () { return false; };
sandbox.window.alert = function () {};
sandbox.window.app = {
  currentPage: 'alert-parking', pages: {},
  register(name, renderFn) { this.pages[name] = { render: renderFn }; },
  navigate(page) { this.currentPage = page; },
  render() { return (this.pages[this.currentPage] && this.pages[this.currentPage].render()) || ''; }
};
vm.runInNewContext(fs.readFileSync(path.join(root, 'public/admin/alert-center-data.js'), 'utf8'), sandbox);
vm.runInNewContext(fs.readFileSync(path.join(root, 'public/admin/alert-center.js'), 'utf8'), sandbox);

const ui = fs.readFileSync(path.join(root, 'public/admin/alert-center.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/admin/alert-center.css'), 'utf8');
const store = sandbox.window.AlertCenterStore;
const app = sandbox.window.app;
const failed = [];
function assert(name, ok) { if (!ok) failed.push(name); }
function headers(html) {
  const labels = [];
  String(html).replace(/<th(?:\s[^>]*)?>([\s\S]*?)<\/th>/g, function (_, inner) {
    labels.push(String(inner).replace(/<[^>]+>/g, '').trim());
    return _;
  });
  return labels;
}
const pages = [
  ['alert-parking', '停车预警', '所属部门', '发生中', ['当前停车告警', '今日新增', '今日紧急', '待处理'], ['停车时长', '告警时间']],
  ['alert-parking-area', '区域停留预警', '所属项目', '发生中', ['当前超时停留', '今日新增', '今日紧急', '待处理'], ['当前停留时长', '围栏类型']],
  ['alert-overspeed', '车速预警', '所属项目', '超速中', ['当前超速车辆', '今日车速预警', '今日紧急', '待处理'], ['当前车速', '连续超速时长']],
  ['alert-weighbill', '卸货后未上传磅单', '所属项目', '待上传中', ['当前待上传', '今日新增', '超60分钟', '待处理'], ['已超时', '离场时间来源', '磅单状态']],
  ['alert-soc', 'SOC预警', '所属项目', '低SOC中', ['当前低SOC车辆', 'SOC≤20%', 'SOC≤10%', '待处理'], ['当前SOC', '充电状态', 'SOC数据时间']],
  ['alert-fatigue', '疲劳驾驶预警', '所属项目', '疲劳风险中', ['当前疲劳驾驶', '≥4小时', '紧急风险', '待处理'], ['连续驾驶时长', '最近停车时长']]
];
const ruleHeads = ['规则名称', '适用范围', '规则摘要', '状态', '更新时间', '更新人', '操作'];
pages.forEach(function (spec) {
  app.currentPage = spec[0];
  const list = app.pages[spec[0]].render();
  const head = headers(list);
  assert(spec[0] + ':title', list.indexOf(spec[1]) >= 0 && list.indexOf('告警列表') >= 0 && list.indexOf('规则配置') >= 0);
  assert(spec[0] + ':columns', head.slice(0, 7).join(',') === ['序号', '告警等级', '事件状态', '处理状态', '车牌号', '司机', spec[2]].join(',') && head[head.length - 2] === '关联任务单' && head[head.length - 1] === '操作');
  assert(spec[0] + ':metrics', spec[4].every((label) => list.indexOf(label) >= 0));
  assert(spec[0] + ':status', list.indexOf(spec[3]) >= 0 && list.indexOf('已恢复') >= 0 && list.indexOf('处理中') >= 0);
  assert(spec[0] + ':extras', spec[5].every((label) => head.indexOf(label) >= 0));
  assert(spec[0] + ':actions', list.indexOf('>详情<') >= 0);
  sandbox.window.acTab('rules');
  const rules = app.pages[spec[0]].render();
  assert(spec[0] + ':ruleHeads', ruleHeads.every((label) => headers(rules).indexOf(label) >= 0));
  assert(spec[0] + ':add', rules.indexOf('新增规则') >= 0 && rules.indexOf('ac-rule-panel') < 0);
  sandbox.window.acTab('list');
  sandbox.window.acTab('rules');
  sandbox.window.acAddRule();
  const modalHost = documentStub.getElementById('acRuleModalHost');
  assert(spec[0] + ':ruleModal', !!(modalHost && String(modalHost.className).indexOf('ac-rule-modal-host') >= 0 && modalHost.innerHTML.indexOf('ac-rule-modal') >= 0 && modalHost.innerHTML.indexOf('>保存<') >= 0));
  sandbox.window.acCloseRuleModal();
  sandbox.window.acTab('list');
});

assert('noCopiedState', !/parkingRuleFilters|areaStayRuleFilters|speedRuleFilters|parkingModal:|areaStayModal:|speedModal:/.test(ui));
assert('noParkingModalClass', ui.indexOf('ac-parking-modal') < 0 && css.indexOf('ac-parking-modal') < 0 && ui.indexOf('ac-rule-modal') >= 0 && css.indexOf('ac-rule-modal') >= 0);
assert('noLegacyRuleAliases', !/acAddParkingRule|acAddAreaStayRule|acAddSpeedRule|acEditParkingRule|acEditAreaStayRule|acEditSpeedRule|acCloseParkingModal|acCloseAreaStayModal|acCloseSpeedModal|acSaveParkingRule|acSaveSpeedRule|acRemoveParkingRule|acRemoveAreaStayRule|acRemoveSpeedRule/.test(ui));
assert('noSpeedHero', ui.indexOf('ac-speed-hero') < 0 && css.indexOf('ac-speed-hero') < 0 && css.indexOf('2280px') < 0 && css.indexOf('1980px') < 0);
assert('sharedRenderers', ['function renderAlertPage', 'function renderMetrics', 'function renderFilters', 'function renderAlertTable', 'function renderRuleList', 'function renderDetailDrawer', 'function renderHandleDrawer'].every((name) => ui.indexOf(name) >= 0));

const events = store.getEvents();
function bySource(id) { return events.filter((item) => item.sourceId === id); }
assert('noUploading', !bySource('live-bill-uploading').length);
assert('noPassby', !bySource('live-bill-passby').length);
assert('noJitter', !bySource('live-soc-jitter').length);
assert('noStaleSoc', !bySource('live-soc-stale').length);
assert('noStaleFatigue', !bySource('live-fatigue-stale').length);
const bills = events.filter((item) => item.ruleCode === 'UNLOAD_WEIGHBILL_MISSING');
const socs = events.filter((item) => item.ruleCode === 'VEHICLE_LOW_SOC');
const fatigues = events.filter((item) => item.ruleCode === 'DRIVER_FATIGUE');
assert('oneBillKey', new Set(bills.map((item) => item.eventKey)).size === bills.length && bills.length === 4);
assert('billLevels', bySource('live-bill')[0].level === '严重' && bySource('live-bill-urgent')[0].level === '紧急' && bySource('live-bill-general')[0].level === '一般');
assert('billUploadRecovered', bySource('history-bill-upload')[0].eventStatus === '已恢复');
assert('socChargingStays', bySource('live-soc-charging')[0].eventStatus === '发生中' && bySource('live-soc-charging')[0].level === '紧急');
assert('socRecovered', bySource('history-soc')[0].eventStatus === '已恢复');
assert('socPerLevelCandidates', !!(bySource('live-soc')[0].metrics.thresholdCandidates && bySource('live-soc')[0].metrics.thresholdCandidates['严重'] && bySource('live-soc')[0].level === '严重' && !bySource('live-soc')[0].metrics.thresholdCandidateStartedAt));
assert('fatigueShortStop', bySource('live-fatigue-shortstop')[0].eventStatus === '发生中');
assert('fatigueRest', bySource('history-fatigue-rest')[0].eventStatus === '已恢复');
assert('fatigueDriver', bySource('history-fatigue-driver')[0].eventStatus === '已恢复' && bySource('history-fatigue-driver')[0].recoverReason === '驾驶员变更');
assert('uniqueKeys', new Set(events.map((item) => item.eventKey)).size === events.length);

const speed = events.find((item) => item.ruleCode === 'VEHICLE_OVERSPEED' && item.eventStatus === '发生中');
const before = speed.eventStatus;
const followed = store.handle(speed.id, '电话提醒司机', '已电话提醒司机减速。', { markDone: false });
assert('speedHandleKeepsEvent', followed.eventStatus === before && followed.handleStatus === '处理中');
const bill = bySource('live-bill')[0];
const closed = store.handle(bill.id, '确认无需磅单', '客户确认本趟不需要磅单。', { falseAlarmReason: '客户确认无需过磅', markDone: true });
assert('noBillRecovers', closed.eventStatus === '已恢复' && closed.handleStatus === '已处理' && closed.recoverReason === '确认无需磅单');

app.currentPage = 'alert-weighbill';
const beforeRules = store.getRules().length;
sandbox.window.acAddRule();
const modal = documentStub.getElementById('acRuleModalHost');
assert('draftModal', !!(modal && modal.innerHTML.indexOf('基础信息') >= 0 && modal.innerHTML.indexOf('适用范围') >= 0 && modal.innerHTML.indexOf('业务识别条件') >= 0 && modal.innerHTML.indexOf('告警等级') >= 0 && modal.innerHTML.indexOf('恢复条件') >= 0 && modal.innerHTML.indexOf('规则说明') >= 0 && modal.innerHTML.indexOf('>保存<') >= 0));
sandbox.window.acCloseRuleModal();
assert('cancelKeepsStore', store.getRules().length === beforeRules && !documentStub.getElementById('acRuleModalHost'));

app.currentPage = 'alert-soc';
const socEvent = bySource('live-soc')[0];
sandbox.window.acView(socEvent.id);
const detail = documentStub.getElementById('acDrawerHost');
assert('socDetail', !!(detail && detail.innerHTML.indexOf('业务详情') >= 0 && detail.innerHTML.indexOf('触发依据') >= 0 && detail.innerHTML.indexOf('充电状态') >= 0 && detail.innerHTML.indexOf('事件时间线') >= 0 && detail.innerHTML.indexOf('处理记录') >= 0 && detail.innerHTML.indexOf('因此当前事件升级为严重预警') >= 0 && detail.innerHTML.indexOf('已连续满足该阈值2分钟') >= 0 && detail.innerHTML.indexOf('已连续满足该阈值5分钟') < 0));
[
  ['live-stop', ['停车开始时间', '当前持续停车时长', '已满足停车预警条件']],
  ['live-area-serious', ['围栏名称', '进入区域时间', '满足区域停留预警条件']],
  ['speed-live-critical', ['规则限速值', '超出速度', '满足当前等级车速预警条件', '一般 → 严重 → 紧急']],
  ['live-bill-urgent', ['离场时间来源', '电子围栏', '因此产生未上传磅单预警']],
  ['live-fatigue', ['司机工号', '当前连续驾驶时长', '有效休息条件']],
  ['live-soc-expired-hold', ['车辆SOC数据已过期', '不能按这份读数继续判断实时电量']]
].forEach(function (spec) {
  const sample = bySource(spec[0])[0];
  sandbox.window.acView(sample.id);
  const drawer = documentStub.getElementById('acDrawerHost');
  const html = drawer ? drawer.innerHTML : '';
  assert('detail:' + spec[0], !!sample && spec[1].every((text) => html.indexOf(text) >= 0) && html.indexOf('告警概览') >= 0 && html.indexOf('告警对象') >= 0 && html.indexOf('处理记录') >= 0);
});
assert('singleDetailDrawer', (ui.match(/function renderDetailDrawer/g) || []).length === 1);
sandbox.window.acHandle(socEvent.id);
const handle = documentStub.getElementById('acDrawerHost');
assert('socHandle', !!(handle && handle.innerHTML.indexOf('提醒司机关注电量') >= 0 && handle.innerHTML.indexOf('提交处理') >= 0 && handle.innerHTML.indexOf('标记已处理') >= 0 && handle.innerHTML.indexOf('联系现场') < 0));

if (failed.length) {
  console.log(JSON.stringify({ ok: false, failed }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({
  ok: true,
  bills: bills.map((item) => item.sourceId + ':' + item.level + ':' + item.eventStatus),
  socs: socs.map((item) => item.sourceId + ':' + item.level + ':' + item.eventStatus),
  fatigues: fatigues.map((item) => item.sourceId + ':' + item.level + ':' + item.eventStatus)
}, null, 2));
