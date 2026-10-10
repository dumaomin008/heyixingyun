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
const sandbox = {
  window: {}, document: { body: {}, createElement() { return {}; }, getElementById() { return null; }, querySelector() { return null; }, addEventListener() {} },
  localStorage, console,
  CustomEvent: class CustomEvent { constructor(type) { this.type = type; } },
  setTimeout(fn) { if (typeof fn === 'function') fn(); },
  Array, Object, Number, String, JSON, Date, Math, isFinite, parseInt, parseFloat
};
sandbox.window = sandbox;
sandbox.window.window = sandbox.window;
sandbox.window.document = sandbox.document;
sandbox.window.localStorage = localStorage;
sandbox.window.dispatchEvent = function () {};
sandbox.window.addEventListener = function () {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'public/admin/alert-center-data.js'), 'utf8'), sandbox);

const store = sandbox.window.AlertCenterStore;
const rule = store.getRules().filter((item) => item.code === 'VEHICLE_LOW_SOC')[0];
const failed = [];
function assert(name, ok) { if (!ok) failed.push(name); }

function evalSoc(soc, at, extra, prior) {
  return store.evaluateSoc({
    ruleCode: 'VEHICLE_LOW_SOC',
    evaluatedAt: at,
    metrics: Object.assign({
      soc: soc,
      socSource: 'CAN',
      chargingStatus: '未充电',
      telemetryValid: true,
      lastTelemetryAt: at,
      evaluatedAt: at
    }, extra || {})
  }, rule, prior || null);
}

function priorOf(result) {
  return Object.assign({}, result.metrics, {
    level: result.level,
    maxLevel: result.maxLevel || result.level
  });
}

function t(hm) { return '2026-10-10 ' + hm; }

const c1 = evalSoc(29, t('10:00:00'));
assert('case1-no-alert', c1.triggered === false && !c1.level && c1.episode === false && c1.metrics.thresholdCandidates['一般'] === t('10:00:00') && !c1.metrics.thresholdCandidates['严重']);

const c2a = evalSoc(29, t('10:00:00'));
const c2 = evalSoc(29, t('10:02:00'), null, priorOf(c2a));
assert('case2-general', c2.triggered === true && c2.level === '一般' && c2.metrics.thresholdCandidates['一般'] === t('10:00:00') && !c2.metrics.thresholdCandidateStartedAt);

let p = priorOf(c2);
p = priorOf(evalSoc(25, t('10:12:00'), null, p));
assert('case3-still-general-after-10min', p.level === '一般');
const c3enter = evalSoc(19, t('10:12:00'), null, p);
assert('case3-no-immediate-serious', c3enter.level === '一般' && c3enter.metrics.thresholdCandidates['严重'] === t('10:12:00'));
const c3up = evalSoc(19, t('10:14:00'), null, priorOf(c3enter));
assert('case3-upgrade-after-2min', c3up.level === '严重');

p = priorOf(c2);
const c4a = evalSoc(19, t('10:12:00'), null, p);
const c4b = evalSoc(21, t('10:13:00'), null, priorOf(c4a));
assert('case4-reset-serious-candidate', c4b.level === '一般' && !c4b.metrics.thresholdCandidates['严重'] && !!c4b.metrics.thresholdCandidates['一般']);
const c4c = evalSoc(19, t('10:13:00'), null, priorOf(c4b));
assert('case4-restart-clock', c4c.level === '一般' && c4c.metrics.thresholdCandidates['严重'] === t('10:13:00'));
const c4d = evalSoc(19, t('10:15:00'), null, priorOf(c4c));
assert('case4-upgrade-after-fresh-2min', c4d.level === '严重');

p = priorOf(c3up);
const c5enter = evalSoc(9, t('10:20:00'), null, p);
assert('case5-no-immediate-emergency', c5enter.level === '严重' && c5enter.metrics.thresholdCandidates['紧急'] === t('10:20:00'));
const c5up = evalSoc(9, t('10:22:00'), null, priorOf(c5enter));
assert('case5-upgrade-after-2min', c5up.level === '紧急');

const c6 = evalSoc(25, t('10:40:00'), null, priorOf(c5up));
assert('case6-no-downgrade', c6.triggered === true && c6.level === '紧急' && c6.recovered !== true && !c6.metrics.thresholdCandidates['严重'] && !c6.metrics.thresholdCandidates['紧急']);

const c7 = evalSoc(36, t('10:41:00'), { chargingStatus: '充电中' }, priorOf(c6));
assert('case7-recover-not-yet', c7.recovered !== true && c7.level === '紧急' && !!c7.metrics.recoverCandidateStartedAt);

const c8 = evalSoc(36, t('10:43:00'), { chargingStatus: '充电中' }, priorOf(c7));
assert('case8-recovered', c8.recovered === true && c8.triggered === false);

const stalePrior = Object.assign(priorOf(c3up), { telemetryValid: false });
const c9 = evalSoc(8, t('11:00:00'), { telemetryValid: false, lastTelemetryAt: t('10:14:00') }, stalePrior);
assert('case9-expired-hold', c9.triggered === false && c9.recovered !== true && c9.episode === true && !c9.metrics.thresholdCandidates['紧急']);

const c10 = evalSoc(9, t('10:30:00'), { chargingStatus: '充电中' }, priorOf(c5up));
assert('case10-charging-not-direct-recover', c10.recovered !== true && c10.level === '紧急' && c10.metrics.chargingStatus === '充电中');

const legacy = evalSoc(19, t('12:10:00'), { thresholdCandidateStartedAt: t('12:00:00') }, {
  thresholdCandidateStartedAt: t('12:00:00'),
  level: '一般',
  maxLevel: '一般'
});
assert('legacy-no-immediate-upgrade', legacy.level === '一般' && legacy.metrics.thresholdCandidates['一般'] === t('12:00:00') && legacy.metrics.thresholdCandidates['严重'] === t('12:10:00') && !legacy.metrics.thresholdCandidateStartedAt);

if (failed.length) {
  console.log(JSON.stringify({ ok: false, failed }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({
  ok: true,
  cases: ['1 不足2分钟不告警', '2 ≤30%满2分钟一般', '3 进入严重须重新计时', '4 中断后严重候选清空', '5 进入紧急须重新计时', '6 只升不降', '7 恢复不足2分钟仍发生中', '8 恢复满2分钟已恢复', '9 数据过期不新增不升级不恢复', '10 充电中不直接恢复']
}, null, 2));
