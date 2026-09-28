/* 规则设置 → 预警规则：配置运输监控中心现有六类预置规则。 */
(function () {
  'use strict';

  var PAGE = 'warning-rule-management';
  var category = '全部';
  var keyword = '';
  var editingId = '';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function store() { return window.AlertCenterStore; }
  function toast(message) {
    if (typeof showAppToast === 'function') showAppToast(message);
    else window.alert(message);
  }
  function rules() { return store() ? store().getRules() : []; }
  function rule(id) { return store() ? store().getRule(id) : null; }
  function badge(value, type) {
    return '<span class="badge badge-' + type + '">' + esc(value) + '</span>';
  }
  function levelBadge(level) {
    if (level === '紧急') return badge(level, 'error');
    if (level === '严重') return badge(level, 'warning');
    return badge(level, 'gray');
  }
  function statusSwitch(item) {
    return '<button class="wr-switch' + (item.enabled ? ' is-on' : '') + '" type="button" role="switch" aria-checked="' + (item.enabled ? 'true' : 'false') + '" onclick="wrToggle(\'' + esc(item.id) + '\')"><i></i><span>' + (item.enabled ? '启用' : '停用') + '</span></button>';
  }
  function thresholdText(item) {
    return esc(item.config.compare + ' ' + item.config.threshold + (item.config.unit === '%' ? '%' : ' ' + item.config.unit));
  }
  function filtered() {
    var q = keyword.trim().toLowerCase();
    return rules().filter(function (item) {
      if (category !== '全部' && item.category !== category) return false;
      if (q && [item.name, item.code, item.description].join(' ').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function tabsHtml(list) {
    var cats = ['全部', '车辆', '运输', '作业', '单据', '安全'];
    return cats.map(function (name) {
      var count = name === '全部' ? list.length : list.filter(function (item) { return item.category === name; }).length;
      return '<button class="tab' + (category === name ? ' active' : '') + '" type="button" onclick="wrCategory(\'' + name + '\')">' + name + '<span class="count">' + count + '</span></button>';
    }).join('');
  }
  function render() {
    var list = rules();
    var rows = filtered();
    var enabled = list.filter(function (item) { return item.enabled; }).length;
    var body = rows.length ? rows.map(function (item) {
      return '<tr>'
        + '<td class="sticky-col"><strong class="wr-rule-name">' + esc(item.name) + '</strong><small class="wr-code">' + esc(item.code) + '</small></td>'
        + '<td>' + badge(item.category, 'gray') + '</td>'
        + '<td class="wr-desc">' + esc(item.description) + '</td>'
        + '<td><strong>' + thresholdText(item) + '</strong></td>'
        + '<td>' + levelBadge(item.level) + '</td>'
        + '<td>' + esc(item.scopeType) + '</td>'
        + '<td>' + statusSwitch(item) + '</td>'
        + '<td>' + esc(item.updatedBy || '—') + '</td>'
        + '<td class="col-time">' + esc(item.updatedAt || '—') + '</td>'
        + '<td class="sticky-col-r"><a class="link" href="javascript:void(0)" onclick="wrOpen(\'' + esc(item.id) + '\')">配置</a></td>'
        + '</tr>';
    }).join('') : '<tr><td colspan="10"><div class="empty-state"><b>没有符合条件的预警规则</b><p>请调整分类或搜索关键字。</p></div></td></tr>';

    return '<div class="content-area page-standard wr-page">'
      + '<div class="breadcrumb"><span>规则设置</span><span class="sep">/</span><span class="current">预警规则</span></div>'
      + '<div class="page-header"><div><div class="page-title">预警规则</div><p class="detail-section-sub">配置运输过程中的异常识别规则。规则启用后，系统将根据运输监控中心已有的车辆、任务、围栏及业务数据产生告警。</p></div>'
      + '<div class="wr-summary"><span><b>' + enabled + '</b> 已启用</span><span><b>' + (list.length - enabled) + '</b> 已停用</span><span><b>' + list.length + '</b> 共计</span></div></div>'
      + '<section class="table-section"><div class="table-toolbar wr-toolbar"><div class="left wr-tabs">' + tabsHtml(list) + '</div>'
      + '<div class="right"><label class="wr-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input id="wrKeyword" value="' + esc(keyword) + '" placeholder="搜索规则名称" onkeydown="if(event.key===\'Enter\')wrSearch()"></label><button class="toolbar-btn" type="button" onclick="wrSearch()">查询</button></div></div>'
      + '<div class="table-wrap"><table class="data-table wr-table"><thead><tr><th class="sticky-col">规则名称</th><th>规则分类</th><th>规则说明</th><th>当前规则</th><th>告警等级</th><th>适用范围</th><th>状态</th><th>修改人</th><th>修改时间</th><th class="sticky-col-r">操作</th></tr></thead><tbody>' + body + '</tbody></table></div>'
      + '<div class="pagination"><div class="pagination-info">共 ' + rows.length + ' 条规则</div></div></section></div>';
  }
  function closeDrawer() {
    var host = document.getElementById('wrDrawerHost');
    if (host) host.remove();
    editingId = '';
  }
  function mountDrawer(html) {
    closeDrawer();
    var host = document.createElement('div');
    host.id = 'wrDrawerHost';
    host.className = 'ac-drawer-host is-open';
    host.innerHTML = '<button class="ac-drawer-mask" type="button" onclick="wrClose()" aria-label="关闭配置"></button><aside class="ac-drawer wr-drawer" role="dialog" aria-modal="true" aria-labelledby="wrDrawerTitle">' + html + '</aside>';
    document.body.appendChild(host);
  }
  function field(label, control, hint, full) {
    return '<div class="form-item' + (full ? ' full' : '') + '"><label class="form-label">' + label + '</label>' + control + (hint ? '<div class="form-hint">' + hint + '</div>' : '') + '</div>';
  }
  function openDrawer(id) {
    var item = rule(id);
    if (!item) return;
    editingId = id;
    var max = item.config.unit === '%' ? 100 : item.config.unit === 'km/h' ? 200 : 1440;
    var html = '<header class="ac-drawer-header"><div><small>预警规则配置</small><h2 id="wrDrawerTitle">' + esc(item.name) + '</h2></div><button type="button" onclick="wrClose()" aria-label="关闭">×</button></header>'
      + '<div class="ac-drawer-body"><section class="detail-section"><div class="detail-section-title">基础信息</div><div class="form-grid col-2">'
      + field('规则名称', '<input class="form-control-text" value="' + esc(item.name) + '" disabled>', '', true)
      + field('规则编码', '<input class="form-control-text" value="' + esc(item.code) + '" disabled>', '')
      + field('规则分类', '<input class="form-control-text" value="' + esc(item.category) + '" disabled>', '')
      + field('规则说明', '<textarea class="form-control-text wr-textarea" disabled>' + esc(item.description) + '</textarea>', '', true)
      + '</div></section>'
      + '<section class="detail-section"><div class="detail-section-title">触发与恢复</div><div class="wr-condition"><span>' + esc(item.config.compare) + '</span><input id="wrThreshold" class="form-control-text" type="number" min="1" max="' + max + '" value="' + item.config.threshold + '"><b>' + esc(item.config.unit) + '</b></div>'
      + '<div class="form-grid col-2 wr-config-grid">'
      + field('告警等级', '<select class="form-control-text" id="wrLevel"><option' + (item.level === '一般' ? ' selected' : '') + '>一般</option><option' + (item.level === '严重' ? ' selected' : '') + '>严重</option><option' + (item.level === '紧急' ? ' selected' : '') + '>紧急</option></select>', '')
      + field('适用范围', '<select class="form-control-text" id="wrScope" onchange="wrScopeChange()"><option' + (item.scopeType === '全部项目' ? ' selected' : '') + '>全部项目</option><option' + (item.scopeType === '指定项目' ? ' selected' : '') + '>指定项目</option></select>', '')
      + field('指定项目', '<select class="form-control-text" id="wrProject"' + (item.scopeType !== '指定项目' ? ' disabled' : '') + '><option>玉溪项目</option></select>', '')
      + field('启用状态', '<select class="form-control-text" id="wrEnabled"><option value="on"' + (item.enabled ? ' selected' : '') + '>启用</option><option value="off"' + (!item.enabled ? ' selected' : '') + '>停用</option></select>', '', true)
      + '</div><div class="wr-recovery"><b>恢复条件</b><span>' + esc(item.recoveryConfig.description) + '</span></div></section>'
      + '<section class="detail-section"><div class="detail-section-title">变更信息</div><div class="wr-meta"><span>修改人：' + esc(item.updatedBy) + '</span><span>修改时间：' + esc(item.updatedAt) + '</span></div></section></div>'
      + '<footer class="ac-drawer-footer"><button class="btn btn-default" type="button" onclick="wrClose()">取消</button><button class="btn btn-primary" type="button" onclick="wrSave()">保存</button></footer>';
    mountDrawer(html);
  }
  function save() {
    var item = rule(editingId);
    if (!item) return;
    var threshold = Number((document.getElementById('wrThreshold') || {}).value);
    var scope = (document.getElementById('wrScope') || {}).value || '全部项目';
    var level = (document.getElementById('wrLevel') || {}).value || item.level;
    var enabled = ((document.getElementById('wrEnabled') || {}).value || 'on') === 'on';
    var max = item.config.unit === '%' ? 100 : item.config.unit === 'km/h' ? 200 : 1440;
    if (!Number.isInteger(threshold) || threshold < 1 || threshold > max) { toast('请输入 1 到 ' + max + ' 的整数阈值'); return; }
    if (item.enabled && !enabled && !window.confirm('停用后系统将不再根据该规则产生新的告警，已产生的告警不受影响。')) return;
    store().updateRule(editingId, { threshold: threshold, scopeType: scope, level: level, enabled: enabled });
    closeDrawer();
    if (window.app) window.app.render();
    toast('预警规则已保存');
  }
  function toggle(id) {
    var item = rule(id);
    if (!item) return;
    if (item.enabled && !window.confirm('停用后系统将不再根据该规则产生新的告警，已产生的告警不受影响。')) return;
    store().updateRule(id, { enabled: !item.enabled, threshold: item.config.threshold, scopeType: item.scopeType, level: item.level });
    if (window.app) window.app.render();
    toast(item.enabled ? '规则已停用' : '规则已启用');
  }

  window.wrCategory = function (value) { category = value || '全部'; if (window.app) window.app.render(); };
  window.wrSearch = function () { keyword = ((document.getElementById('wrKeyword') || {}).value || '').trim(); if (window.app) window.app.render(); };
  window.wrOpen = openDrawer;
  window.wrClose = closeDrawer;
  window.wrSave = save;
  window.wrToggle = toggle;
  window.wrScopeChange = function () {
    var project = document.getElementById('wrProject');
    var scope = document.getElementById('wrScope');
    if (project && scope) project.disabled = scope.value !== '指定项目';
  };
  window.addEventListener('hashchange', closeDrawer);

  if (!window.app) return;
  window.app.register(PAGE, render, [PAGE]);
})();
