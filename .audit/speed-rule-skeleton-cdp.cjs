const CDP = 'http://127.0.0.1:9336';
const PAGE = 'http://127.0.0.1:5173/admin/index.html#alert-overspeed';

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function cdp(ws, method, params, sessionId) {
  return new Promise((resolve, reject) => {
    const id = cdp.nextId = (cdp.nextId || 0) + 1;
    const msg = { id, method, params: params || {} };
    if (sessionId) msg.sessionId = sessionId;
    const timer = setTimeout(() => {
      ws.removeEventListener('message', onMsg);
      reject(new Error(method + ' timeout'));
    }, 20000);
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

async function evalOn(ws, sessionId, expression) {
  const result = await cdp(ws, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  }, sessionId);
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception && result.exceptionDetails.exception.description;
    throw new Error(detail || result.exceptionDetails.text || 'eval failed');
  }
  return result.result && result.result.value;
}

(async () => {
  const list = await fetch(CDP + '/json/list').then((res) => res.json());
  const page = list.find((item) => item.type === 'page' && item.webSocketDebuggerUrl) || list[0];
  if (!page) throw new Error('no CDP page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  const { sessionId } = await cdp(ws, 'Target.attachToTarget', { targetId: page.id, flatten: true });
  await cdp(ws, 'Page.enable', {}, sessionId);
  await cdp(ws, 'Runtime.enable', {}, sessionId);
  await cdp(ws, 'Page.navigate', { url: PAGE }, sessionId);
  await sleep(1600);
  await evalOn(ws, sessionId, `(function () {
    localStorage.setItem('tms-admin-auth-v1', JSON.stringify({ id: 'safety', name: '刘安', title: '安全员', at: '2026-10-10 10:40:00' }));
    localStorage.removeItem('hyxy-alert-center-v1');
    return true;
  })()`);
  await cdp(ws, 'Page.reload', { ignoreCache: true }, sessionId);
  await sleep(1800);
  await evalOn(ws, sessionId, `(function () {
    if (window.app) window.app.navigate('alert-overspeed');
    return true;
  })()`);
  await sleep(500);
  await evalOn(ws, sessionId, `window.acTab && window.acTab('rules')`);
  await sleep(400);

  const rules = await evalOn(ws, sessionId, `(function () {
    var headers = Array.prototype.map.call(document.querySelectorAll('.ac-rule-table thead th'), function (th) { return th.textContent.trim(); });
    var names = Array.prototype.map.call(document.querySelectorAll('.ac-rule-table tbody tr td:nth-child(2)'), function (td) { return td.textContent.trim(); });
    return {
      title: document.querySelector('.page-title') && document.querySelector('.page-title').textContent,
      tab: document.querySelector('.section-tab.active') && document.querySelector('.section-tab.active').textContent,
      hasList: !!document.querySelector('.ac-rule-list'),
      noInline: !document.querySelector('.ac-rule-panel'),
      addBtn: Array.prototype.some.call(document.querySelectorAll('.table-toolbar .btn'), function (btn) { return btn.textContent.indexOf('新增规则') >= 0; }),
      headers: headers,
      names: names
    };
  })()`);

  await evalOn(ws, sessionId, `window.acAddRule && window.acAddRule()`);
  await sleep(300);
  const createModal = await evalOn(ws, sessionId, `(function () {
    return {
      open: !!document.getElementById('acRuleModalHost'),
      title: document.querySelector('#acRuleModalHost .modal-title') && document.querySelector('#acRuleModalHost .modal-title').textContent,
      hasName: !!document.getElementById('wrName'),
      hasSource: !!document.getElementById('wrSpeedSource'),
      hasRecover: !!document.getElementById('wrRecoverSpeed'),
      hasUnit: !!document.querySelector('.wr-duration-unit'),
      hasNotify: (document.querySelector('#acRuleModalHost') || {}).textContent.indexOf('通知策略') >= 0
    };
  })()`);
  await evalOn(ws, sessionId, `(function () {
    var name = document.getElementById('wrName');
    if (name) name.value = '玉溪项目车速预警';
    var scope = document.getElementById('wrScope');
    if (scope) { scope.value = '指定项目'; if (window.acScopeChange) window.acScopeChange(); }
    var box = document.querySelector('#acRuleModalHost input[name="wrSpeedProjects"][value="YX001"]');
    if (box) box.checked = true;
    window.acSaveRule();
    return true;
  })()`);
  await sleep(400);
  const afterSave = await evalOn(ws, sessionId, `(function () {
    var names = Array.prototype.map.call(document.querySelectorAll('.ac-rule-table tbody tr td:nth-child(2)'), function (td) { return td.textContent.trim(); });
    return {
      modalClosed: !document.getElementById('acRuleModalHost'),
      names: names,
      toast: (document.getElementById('appToastText') || {}).textContent || ''
    };
  })()`);

  await evalOn(ws, sessionId, `window.acAddRule && window.acAddRule()`);
  await sleep(200);
  const conflict = await evalOn(ws, sessionId, `(function () {
    var name = document.getElementById('wrName');
    if (name) name.value = '又一条全部项目';
    window.acSaveRule();
    return (document.getElementById('appToastText') || {}).textContent || '';
  })()`);

  console.log(JSON.stringify({ rules, createModal, afterSave, conflict }, null, 2));
  ws.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
