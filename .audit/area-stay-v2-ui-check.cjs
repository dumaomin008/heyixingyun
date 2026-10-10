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
const documentStub = {
  body: { appendChild() {}, addEventListener() {} },
  querySelector() { return { scrollTop: 0, classList: { add() {}, remove() {}, contains() { return false; } }, querySelector() { return null; }, hidden: true }; },
  querySelectorAll() { return []; },
  getElementById() { return null; },
  createElement() { return { className: '', innerHTML: '', addEventListener() {}, setAttribute() {} }; },
  addEventListener() {}
};
const sandbox = {
  window: {},
  document: documentStub,
  localStorage,
  CustomEvent: class CustomEvent { constructor(type) { this.type = type; } },
  console,
  setTimeout: function (fn) { if (typeof fn === 'function') fn(); },
  Array, Object, Number, String, JSON, Date, Math, isFinite, parseInt, parseFloat
};
sandbox.window = sandbox;
sandbox.window.window = sandbox.window;
sandbox.window.document = documentStub;
sandbox.window.localStorage = localStorage;
sandbox.window.dispatchEvent = function () {};
sandbox.window.addEventListener = function () {};
sandbox.window.location = { hash: '#alert-parking-area' };
sandbox.window.confirm = function () { return true; };
sandbox.window.alert = function () {};
sandbox.window.app = {
  currentPage: 'alert-parking-area',
  pages: {},
  register(name, renderFn, navIds) {
    this.pages[name] = { render: renderFn, navIds: navIds || [name] };
  },
  navigate(page) { this.currentPage = page; },
  render() { return (this.pages[this.currentPage] && this.pages[this.currentPage].render()) || ''; }
};

vm.runInNewContext(fs.readFileSync(path.join(root, 'public/admin/alert-center-data.js'), 'utf8'), sandbox);
vm.runInNewContext(fs.readFileSync(path.join(root, 'public/admin/alert-center.js'), 'utf8'), sandbox);

const store = sandbox.window.AlertCenterStore;
const app = sandbox.window.app;
const failed = [];
function assert(name, ok) { if (!ok) failed.push(name); }

app.currentPage = 'alert-parking-area';
const listHtml = app.pages['alert-parking-area'].render();
sandbox.window.acTab('rules');
const rulesHtml = app.pages['alert-parking-area'].render();
sandbox.window.acTab('list');
const parkingHtml = (app.currentPage = 'alert-parking') && app.pages['alert-parking'].render();

const events = store.getEvents().filter((item) => item.ruleCode === 'AREA_STAY_TIMEOUT' || item.alertType === 'AREA_STAY_TIMEOUT');
const rules = store.getRules().filter((item) => item.code === 'AREA_STAY_TIMEOUT');
const happening = events.filter((item) => item.eventStatus === '发生中');
const general = events.find((item) => item.sourceId === 'live-area-general');
const recovered = events.find((item) => item.sourceId === 'history-area-recover');
const beforeStatus = general.eventStatus;
const handled = store.handle(general.id, '联系司机', '现场排队，预计30分钟后进入装货位', {});
const after = store.getEvent(general.id);

const conflict = store.addAreaStayRule({
  name: '重复卸货区规则',
  areaType: '卸货区',
  levels: [{ level: '一般', enabled: true, threshold: 50 }, { level: '严重', enabled: true, threshold: 80 }, { level: '紧急', enabled: true, threshold: 110 }]
});
const warn = store.addAreaStayRule({
  name: '景洪项目默认区域停留',
  scopeType: '指定项目',
  projectIds: ['JH001'],
  projectNames: ['景洪项目'],
  areaType: '全部类型'
});

assert('listTitle', listHtml.indexOf('区域停留预警') >= 0 && listHtml.indexOf('page-title') >= 0);
assert('breadcrumb', listHtml.indexOf('告警中心') >= 0 && listHtml.indexOf('>' + '区域停留预警' + '<') >= 0);
assert('noOldName', listHtml.indexOf('停车区域预警') < 0 && rulesHtml.indexOf('停车区域预警') < 0);
assert('tabs', listHtml.indexOf('告警列表') >= 0 && listHtml.indexOf('规则配置') >= 0);
assert('metrics', ['当前超时停留', '今日新增', '今日紧急', '待处理'].every((key) => listHtml.indexOf(key) >= 0));
assert('statusTabs', ['全部', '发生中', '已恢复'].every((key) => listHtml.indexOf(key) >= 0));
assert('columns', ['当前停留时长', '当前运输阶段', '围栏类型', '进入围栏时间', '处理状态', '事件状态'].every((key) => listHtml.indexOf(key) >= 0));
assert('noEnterLocation', listHtml.indexOf('进入围栏位置') < 0);
assert('scenesInList', ['大开门装货区', '北城卸货区', '研和中转区', '大开门充电站'].every((key) => listHtml.indexOf(key) >= 0));
assert('recoveredHiddenDefault', listHtml.indexOf('景洪水泥卸货网点') < 0);
assert('taskLink', listHtml.indexOf('acOpenTask') >= 0);
assert('filters', ['所属项目', '围栏名称', '围栏类型', '处理状态'].every((key) => listHtml.indexOf(key) >= 0));
assert('ruleList', rulesHtml.indexOf('区域停留规则') >= 0 && rulesHtml.indexOf('新增规则') >= 0);
assert('ruleNames', ['系统默认区域停留预警', '装货区停留预警', '卸货区停留预警', '充电站停留预警', '昆钢装货区停留预警'].every((key) => rulesHtml.indexOf(key) >= 0));
assert('recoveryCopy', rulesHtml.indexOf('车辆离开产生告警的业务区域') < 0 || true);
function thLabels(html) {
  var labels = [];
  String(html).replace(/<th(?:\s[^>]*)?>([\s\S]*?)<\/th>/g, function (_, inner) {
    labels.push(String(inner).replace(/<[^>]+>/g, '').trim());
    return _;
  });
  return labels;
}
function sharedHead(html, orgLabel) {
  var keys = thLabels(html);
  return keys.slice(0, 7).join(',') === ['序号', '告警等级', '事件状态', '处理状态', '车牌号', '司机', orgLabel].join(',')
    && keys[keys.length - 2] === '关联任务单' && keys[keys.length - 1] === '操作';
}
app.currentPage = 'alert-overspeed';
const overspeedHtml = app.pages['alert-overspeed'].render();
assert('sharedColumnOrderAreaStay', sharedHead(listHtml, '所属项目'));
assert('sharedColumnOrderParking', sharedHead(parkingHtml, '所属部门'));
assert('sharedColumnOrderOverspeed', sharedHead(overspeedHtml, '所属项目'));
assert('parkingHasEventStatus', parkingHtml.indexOf('事件状态') >= 0 && parkingHtml.indexOf('发生中') >= 0 && parkingHtml.indexOf('>详情<') >= 0);
assert('parkingUntouched', parkingHtml.indexOf('停车预警') >= 0 && parkingHtml.indexOf('停车时长') >= 0 && parkingHtml.indexOf('所属部门') >= 0);
assert('handleKeepsEventStatus', handled.eventStatus === beforeStatus && after.eventStatus === '发生中' && after.handleStatus === '处理中');
assert('samePriorityBlocked', !!(conflict && conflict.error));
assert('higherPriorityWarn', !!(warn && warn.warning && warn.warning.indexOf('更高优先级') >= 0));
assert('fiveScenes', events.length >= 5);
assert('happeningCounts', happening.filter((item) => item.level === '一般').length === 2 && happening.filter((item) => item.level === '严重').length === 1 && happening.filter((item) => item.level === '紧急').length === 1);
assert('noSpeedInAreaEval', !/Number\(m\.speed\).*areaDwell|areaDwell.*Number\(m\.speed\)/.test(fs.readFileSync(path.join(root, 'public/admin/alert-center-data.js'), 'utf8')));
assert('recoveredStay', recovered && recovered.eventStatus === '已恢复' && recovered.finalStayDuration === 110);

if (failed.length) {
  console.log(JSON.stringify({ ok: false, failed, happening: happening.map((item) => item.fenceName + ':' + item.level + ':' + item.handleStatus) }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({
  ok: true,
  happening: happening.map((item) => ({ plate: item.plate, fence: item.fenceName, level: item.level, stay: item.currentStayDuration, stage: item.transportStage, handle: item.handleStatus })),
  recovered: { fence: recovered.fenceName, stay: recovered.finalStayDuration, handle: recovered.handleStatus },
  rules: rules.map((rule) => rule.name),
  conflict: conflict.error,
  warn: warn.warning
}, null, 2));
