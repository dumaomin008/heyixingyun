const { spawn } = require('child_process');
const http = require('http');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9336;
const PAGE = 'http://127.0.0.1:5175/admin/index.html#alert-parking';

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--remote-debugging-port=' + PORT,
  '--user-data-dir=/tmp/ac-unified-chrome', 'about:blank'
], { stdio: 'ignore' });

let ws;
let nextId = 0;
function cdp(method, params, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const msg = { id, method, params: params || {} };
    if (sessionId) msg.sessionId = sessionId;
    const timer = setTimeout(() => reject(new Error(method + ' timeout')), 20000);
    function onMsg(event) {
      const data = JSON.parse(event.data);
      if (data.id !== id) return;
      clearTimeout(timer);
      ws.removeEventListener('message', onMsg);
      if (data.error) reject(new Error(method + ' ' + JSON.stringify(data.error)));
      else resolve(data.result);
    }
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify(msg));
  });
}
async function evaluate(sessionId, expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception && result.exceptionDetails.exception.description;
    throw new Error(detail || result.exceptionDetails.text || expression);
  }
  return result.result && result.result.value;
}

(async () => {
  let list = '';
  for (let i = 0; i < 30; i += 1) {
    try { list = await get('http://127.0.0.1:' + PORT + '/json/list'); break; } catch (error) { await sleep(200); }
  }
  const pages = JSON.parse(list);
  const page = pages.find((item) => item.type === 'page') || pages[0];
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
  const { sessionId } = await cdp('Target.attachToTarget', { targetId: page.id, flatten: true });
  await cdp('Page.enable', {}, sessionId);
  await cdp('Runtime.enable', {}, sessionId);
  await cdp('Page.navigate', { url: PAGE }, sessionId);
  await sleep(1200);
  await evaluate(sessionId, `(function () {
    localStorage.setItem('tms-admin-auth-v1', JSON.stringify({ id: 'safety', name: '刘安', title: '安全员', at: '2026-10-10 08:30:00' }));
    localStorage.removeItem('hyxy-alert-center-v1');
    return true;
  })()`);
  await cdp('Page.reload', { ignoreCache: true }, sessionId);
  await sleep(1800);
  const booted = await evaluate(sessionId, `(function () {
    if (window.WB && window.WB.login && document.querySelector('.wb-login')) window.WB.login('safety');
    if (window.app) window.app.navigate('alert-parking');
    return document.querySelector('.page-title') && document.querySelector('.page-title').textContent;
  })()`);
  await sleep(500);

  const pagespec = [
    ['alert-parking', '停车预警', ['当前停车告警', '今日新增', '今日紧急', '待处理'], '发生中'],
    ['alert-parking-area', '区域停留预警', ['当前超时停留', '今日新增', '今日紧急', '待处理'], '发生中'],
    ['alert-overspeed', '车速预警', ['当前超速车辆', '今日车速预警', '今日紧急', '待处理'], '超速中'],
    ['alert-weighbill', '卸货后未上传磅单', ['当前待上传', '今日新增', '超60分钟', '待处理'], '待上传中'],
    ['alert-soc', 'SOC预警', ['当前低SOC车辆', 'SOC≤20%', 'SOC≤10%', '待处理'], '低SOC中'],
    ['alert-fatigue', '疲劳驾驶预警', ['当前疲劳驾驶', '≥4小时', '紧急风险', '待处理'], '疲劳风险中']
  ];
  const views = [];
  for (const spec of pagespec) {
    const view = await evaluate(sessionId, `(function () {
      window.app.navigate(${JSON.stringify(spec[0])});
      var headers = Array.prototype.map.call(document.querySelectorAll('.ac-table thead th'), function (th) { return th.textContent.trim(); });
      var metrics = Array.prototype.map.call(document.querySelectorAll('.ac-metric > span'), function (node) { return node.textContent.trim(); });
      var active = document.querySelector('.ac-status-switch button.is-active span');
      return {
        title: document.querySelector('.page-title') && document.querySelector('.page-title').textContent,
        headers: headers,
        metrics: metrics,
        active: active && active.textContent,
        hero: !!document.querySelector('.ac-speed-hero'),
        detail: !!document.querySelector('.ac-actions .link')
      };
    })()`);
    views.push({ page: spec[0], expect: spec[1], view });
    await sleep(200);
  }

  const ruleFlow = await evaluate(sessionId, `(function () {
    window.app.navigate('alert-weighbill');
    var before = window.AlertCenterStore.getRules().length;
    window.acTab('rules');
    window.acAddRule();
    var text = (document.querySelector('.ac-parking-modal') || {}).textContent || '';
    var sections = ['基础信息', '适用范围', '业务识别条件', '告警等级', '恢复条件', '规则说明'].map(function (name) { return text.indexOf(name) >= 0; });
    window.acCloseRuleModal();
    var after = window.AlertCenterStore.getRules().length;
    window.acTab('list');
    return { before: before, after: after, sections: sections, closed: !document.querySelector('.ac-parking-modal') };
  })()`);

  const handleFlow = await evaluate(sessionId, `(function () {
    window.app.navigate('alert-soc');
    var event = window.AlertCenterStore.getEvents().filter(function (item) { return item.sourceId === 'live-soc'; })[0];
    window.acView(event.id);
    var detail = document.querySelector('.ac-drawer');
    var detailText = detail ? detail.textContent : '';
    window.acHandle(event.id);
    var select = document.getElementById('acHandlingType');
    var options = select ? Array.prototype.map.call(select.options, function (item) { return item.textContent; }) : [];
    select.value = '提醒司机关注电量';
    document.getElementById('acHandlingResult').value = '已提醒司机关注电量并就近补能。';
    window.acSubmitHandle(false);
    var updated = window.AlertCenterStore.getEvent(event.id);
    return {
      detailHas: detailText.indexOf('电量状态') >= 0 && detailText.indexOf('时间轴') >= 0,
      options: options,
      eventStatus: updated.eventStatus,
      handleStatus: updated.handleStatus
    };
  })()`);

  const noBill = await evaluate(sessionId, `(function () {
    window.app.navigate('alert-weighbill');
    var event = window.AlertCenterStore.getEvents().filter(function (item) { return item.sourceId === 'live-bill-general'; })[0];
    window.acHandle(event.id);
    var select = document.getElementById('acHandlingType');
    select.value = '确认无需磅单';
    window.acHandleTypeChange();
    document.getElementById('acFalseAlarmReason').value = '客户确认无需过磅';
    document.getElementById('acHandlingResult').value = '客户确认本趟不需要卸货磅单。';
    window.acSubmitHandle(true);
    var updated = window.AlertCenterStore.getEvent(event.id);
    return { eventStatus: updated.eventStatus, handleStatus: updated.handleStatus, reason: updated.recoverReason };
  })()`);

  const modals = await evaluate(sessionId, `(function () {
    function open(page) {
      window.app.navigate(page);
      window.acTab('rules');
      window.acAddRule();
      var text = (document.querySelector('.ac-parking-modal') || {}).textContent || '';
      var ok = text.indexOf('基础信息') >= 0 && text.indexOf('取消') >= 0 && text.indexOf('保存') >= 0;
      window.acCloseRuleModal();
      return { ok: ok, closed: !document.querySelector('.ac-parking-modal'), sample: text.slice(0, 80) };
    }
    return {
      parking: open('alert-parking'),
      area: open('alert-parking-area'),
      speed: open('alert-overspeed'),
      fatigue: open('alert-fatigue')
    };
  })()`);

  console.log(JSON.stringify({ booted, views, ruleFlow, handleFlow, noBill, modals }, null, 2));
  chrome.kill('SIGKILL');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  chrome.kill('SIGKILL');
  process.exit(1);
});
