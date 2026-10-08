/* 规则设置 → 预警规则：六类规则、三级风险条件与公共恢复参数。 */
(function () {
  'use strict';

  var PAGE = 'warning-rule-management';
  var LEVEL_NAMES = ['一般', '严重', '紧急'];
  var category = '全部';
  var keyword = '';
  var editingId = '';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function store() { return window.AlertCenterStore; }
  function toast(message) { if (typeof showAppToast === 'function') showAppToast(message); else window.alert(message); }
  function rules() { return store() ? store().getRules() : []; }
  function rule(id) { return store() ? store().getRule(id) : null; }
  function badge(value, type) { return '<span class="badge badge-' + type + '">' + esc(value) + '</span>'; }
  function statusSwitch(item) {
    return '<button class="wr-switch' + (item.enabled ? ' is-on' : '') + '" type="button" role="switch" aria-checked="' + (item.enabled ? 'true' : 'false') + '" onclick="wrToggle(\'' + esc(item.id) + '\')"><i></i><span>' + (item.enabled ? '启用' : '停用') + '</span></button>';
  }
  function formatHours(minutes) {
    var value = Number(minutes) / 60;
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
  }
  function levelValue(item, level) {
    if (item.code === 'VEHICLE_OVERSPEED') return level.speedThreshold + ' km/h · ' + (level.durationSeconds / 60) + '分钟';
    if (item.code === 'DRIVER_FATIGUE') return formatHours(level.thresholdMinutes) + '小时';
    if (item.code === 'VEHICLE_LOW_SOC') return '≤' + level.threshold + '%';
    return level.threshold + '分钟';
  }
  function ruleSummary(item) {
    return (item.levels || []).filter(function (level) { return level.enabled !== false; }).map(function (level) { return levelValue(item, level); }).join(' / ') || '全部等级已停用';
  }
  function levelSummary(item) {
    var enabled = (item.levels || []).filter(function (level) { return level.enabled !== false; });
    return '<div class="wr-level-summary"><strong>' + enabled.length + '级</strong>' + enabled.map(function (level) {
      return '<span class="wr-level-dot is-' + (level.level === '紧急' ? 'urgent' : level.level === '严重' ? 'major' : 'normal') + '">' + esc(level.level) + '</span>';
    }).join('') + '</div>';
  }
  function filtered() {
    var q = keyword.trim().toLowerCase();
    return rules().filter(function (item) {
      if (category !== '全部' && item.category !== category) return false;
      return !q || [item.name, item.code, item.description].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }
  function tabsHtml(list) {
    return ['全部', '车辆', '运输', '作业', '单据', '安全'].map(function (name) {
      var count = name === '全部' ? list.length : list.filter(function (item) { return item.category === name; }).length;
      return '<button class="tab' + (category === name ? ' active' : '') + '" type="button" onclick="wrCategory(\'' + name + '\')">' + name + '<span class="count">' + count + '</span></button>';
    }).join('');
  }
  function render() {
    var list = rules();
    var rows = filtered();
    var enabled = list.filter(function (item) { return item.enabled; }).length;
    var body = rows.length ? rows.map(function (item) {
      return '<tr><td class="sticky-col"><strong class="wr-rule-name">' + esc(item.name) + '</strong><small class="wr-code">' + esc(item.code) + '</small></td>'
        + '<td>' + badge(item.category, 'gray') + '</td><td class="wr-desc">' + esc(item.description) + '</td>'
        + '<td><strong class="wr-rule-summary">' + esc(ruleSummary(item)) + '</strong></td><td>' + levelSummary(item) + '</td>'
        + '<td>' + esc(item.scopeType) + '</td><td>' + statusSwitch(item) + '</td><td>' + esc(item.updatedBy || '—') + '</td>'
        + '<td class="col-time">' + esc(item.updatedAt || '—') + '</td><td class="sticky-col-r"><a class="link" href="javascript:void(0)" onclick="wrOpen(\'' + esc(item.id) + '\')">配置</a></td></tr>';
    }).join('') : '<tr><td colspan="10"><div class="empty-state"><b>没有符合条件的预警规则</b><p>请调整分类或搜索关键字。</p></div></td></tr>';
    return '<div class="content-area page-standard wr-page"><div class="breadcrumb"><span>规则设置</span><span class="sep">/</span><span class="current">预警规则</span></div>'
      + '<div class="page-header"><div><div class="page-title">预警规则</div><p class="detail-section-sub">为六类运输预警配置一般、严重、紧急三级条件；实时状态同时满足多级时取最高等级。</p></div>'
      + '<div class="wr-summary"><span><b>' + enabled + '</b> 已启用</span><span><b>' + (list.length - enabled) + '</b> 已停用</span><span><b>' + list.length + '</b> 共计</span></div></div>'
      + '<section class="table-section"><div class="table-toolbar wr-toolbar"><div class="left wr-tabs">' + tabsHtml(list) + '</div>'
      + '<div class="right"><label class="wr-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input id="wrKeyword" value="' + esc(keyword) + '" placeholder="搜索规则名称" onkeydown="if(event.key===\'Enter\')wrSearch()"></label><button class="toolbar-btn" type="button" onclick="wrSearch()">查询</button></div></div>'
      + '<div class="table-wrap"><table class="data-table wr-table"><thead><tr><th class="sticky-col">规则名称</th><th>规则分类</th><th>规则说明</th><th>当前规则</th><th>等级配置</th><th>适用范围</th><th>总开关</th><th>修改人</th><th>修改时间</th><th class="sticky-col-r">操作</th></tr></thead><tbody>' + body + '</tbody></table></div>'
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
  function levelTone(name) { return name === '紧急' ? 'urgent' : name === '严重' ? 'major' : 'normal'; }
  function thresholdControl(item, level, index) {
    var base = 'data-level-index="' + index + '"';
    if (item.code === 'VEHICLE_OVERSPEED') {
      return '<div class="wr-level-condition"><label>车速 ≥ <span class="wr-unit-input"><input class="form-control-text wr-speed" ' + base + ' type="number" min="1" max="200" value="' + level.speedThreshold + '"><em>km/h</em></span></label>'
        + '<label>持续 ≥ <span class="wr-unit-input"><input class="form-control-text wr-duration" ' + base + ' type="number" min="1" max="120" value="' + (level.durationSeconds / 60) + '" step="1"><em>分钟</em></span></label></div>';
    }
    if (item.code === 'DRIVER_FATIGUE') {
      return '<div class="wr-level-condition"><label>连续驾驶 ≥ <span class="wr-unit-input"><input class="form-control-text wr-fatigue" ' + base + ' type="number" min="1" max="24" step="0.1" value="' + formatHours(level.thresholdMinutes) + '"><em>小时</em></span></label></div>';
    }
    var compare = item.code === 'VEHICLE_LOW_SOC' ? 'SOC ≤' : item.code === 'PARKING_AREA' ? '区域停留 ≥' : item.code === 'UNLOAD_WEIGHBILL_MISSING' ? '离开卸货地 ≥' : '连续停车 ≥';
    var unit = item.code === 'VEHICLE_LOW_SOC' ? '%' : '分钟';
    var suffix = item.code === 'UNLOAD_WEIGHBILL_MISSING' ? '未上传' : '';
    return '<div class="wr-level-condition"><label>' + compare + ' <span class="wr-unit-input"><input class="form-control-text wr-threshold" ' + base + ' type="number" min="1" max="' + (unit === '%' ? 100 : 1440) + '" value="' + level.threshold + '"><em>' + unit + '</em></span> ' + suffix + '</label></div>';
  }
  function levelsEditor(item) {
    return '<div class="wr-level-list">' + (item.levels || []).map(function (level, index) {
      return '<div class="wr-level-row is-' + levelTone(level.level) + '"><div class="wr-level-head"><span class="wr-level-name">' + esc(level.level) + '</span><label class="wr-level-enable"><input class="wr-level-enabled" data-level-index="' + index + '" type="checkbox"' + (level.enabled !== false ? ' checked' : '') + '>启用本级</label></div>' + thresholdControl(item, level, index) + '</div>';
    }).join('') + '</div>';
  }
  function openDrawer(id) {
    var item = rule(id);
    if (!item) return;
    editingId = id;
    var recovery = item.code === 'DRIVER_FATIGUE'
      ? '<div class="wr-rest-config"><label class="form-label">有效休息时长</label><div class="wr-unit-input"><input class="form-control-text" id="wrRestMinutes" type="number" min="10" max="120" value="' + Number(item.recoveryConfig.restThresholdMinutes || 20) + '"><em>分钟</em></div><p>Demo 公共恢复参数；短暂停车不会立即重置连续驾驶周期。</p></div>'
      : '<div class="wr-recovery"><b>恢复条件</b><span>' + esc(item.recoveryConfig.description) + '</span></div>';
    var html = '<header class="ac-drawer-header"><div><small>多级预警规则配置</small><h2 id="wrDrawerTitle">' + esc(item.name) + '</h2></div><button type="button" onclick="wrClose()" aria-label="关闭">×</button></header>'
      + '<div class="ac-drawer-body"><section class="detail-section"><div class="detail-section-title">基础信息</div><div class="form-grid col-2">'
      + field('规则名称', '<input class="form-control-text" value="' + esc(item.name) + '" disabled>', '', true)
      + field('规则编码', '<input class="form-control-text" value="' + esc(item.code) + '" disabled>', '')
      + field('规则分类', '<input class="form-control-text" value="' + esc(item.category) + '" disabled>', '')
      + field('规则说明', '<textarea class="form-control-text wr-textarea" disabled>' + esc(item.description) + '</textarea>', '', true) + '</div></section>'
      + '<section class="detail-section"><div class="detail-section-title">预警等级配置</div><p class="wr-level-help">每一级可独立启停；实时状态同时满足多级时取最高风险等级。</p>' + levelsEditor(item) + recovery + '</section>'
      + '<section class="detail-section"><div class="detail-section-title">适用与启用</div><div class="form-grid col-2">'
      + field('适用范围', '<select class="form-control-text" id="wrScope" onchange="wrScopeChange()"><option' + (item.scopeType === '全部项目' ? ' selected' : '') + '>全部项目</option><option' + (item.scopeType === '指定项目' ? ' selected' : '') + '>指定项目</option></select>', '')
      + field('指定项目', '<select class="form-control-text" id="wrProject"' + (item.scopeType !== '指定项目' ? ' disabled' : '') + '><option>玉溪项目</option></select>', '')
      + field('规则总开关', '<select class="form-control-text" id="wrEnabled"><option value="on"' + (item.enabled ? ' selected' : '') + '>启用</option><option value="off"' + (!item.enabled ? ' selected' : '') + '>停用</option></select>', '总开关停用后不再产生新事件', true)
      + '</div></section><section class="detail-section"><div class="detail-section-title">变更信息</div><div class="wr-meta"><span>修改人：' + esc(item.updatedBy) + '</span><span>修改时间：' + esc(item.updatedAt) + '</span></div></section></div>'
      + '<footer class="ac-drawer-footer"><button class="btn btn-default" type="button" onclick="wrClose()">取消</button><button class="btn btn-primary" type="button" onclick="wrSave()">保存</button></footer>';
    mountDrawer(html);
  }
  function readNumber(selector, index) {
    var input = document.querySelector(selector + '[data-level-index="' + index + '"]');
    return input ? Number(input.value) : NaN;
  }
  function readLevels(item) {
    return LEVEL_NAMES.map(function (name, index) {
      var enabledInput = document.querySelector('.wr-level-enabled[data-level-index="' + index + '"]');
      if (item.code === 'VEHICLE_OVERSPEED') return { level: name, enabled: !!(enabledInput && enabledInput.checked), speedThreshold: readNumber('.wr-speed', index), durationSeconds: readNumber('.wr-duration', index) * 60 };
      if (item.code === 'DRIVER_FATIGUE') return { level: name, enabled: !!(enabledInput && enabledInput.checked), thresholdMinutes: Math.round(readNumber('.wr-fatigue', index) * 60) };
      return { level: name, enabled: !!(enabledInput && enabledInput.checked), threshold: readNumber('.wr-threshold', index) };
    });
  }
  function validateLevels(item, levels) {
    if (!levels.some(function (level) { return level.enabled; })) return '请至少启用一个预警等级';
    var fieldName = item.code === 'VEHICLE_OVERSPEED' ? 'speedThreshold' : item.code === 'DRIVER_FATIGUE' ? 'thresholdMinutes' : 'threshold';
    var values = levels.map(function (level) { return Number(level[fieldName]); });
    if (values.some(function (value) { return !isFinite(value) || value <= 0; })) return '请填写三个等级的有效阈值';
    if (item.code === 'VEHICLE_LOW_SOC') {
      if (!(values[0] > values[1])) return '严重等级 SOC 阈值必须低于一般等级';
      if (!(values[1] > values[2])) return '紧急等级 SOC 阈值必须低于严重等级';
    } else {
      if (!(values[0] < values[1])) return '严重等级阈值必须高于一般等级';
      if (!(values[1] < values[2])) return '紧急等级阈值必须高于严重等级';
    }
    if (item.code === 'VEHICLE_OVERSPEED' && levels.some(function (level) { return !Number.isInteger(level.durationSeconds) || level.durationSeconds < 60 || level.durationSeconds > 7200; })) return '各等级持续时间应为 1 到 120 分钟';
    if (item.code === 'DRIVER_FATIGUE' && levels.some(function (level) { return level.thresholdMinutes < 60 || level.thresholdMinutes > 1440; })) return '连续驾驶时长应为 1 到 24 小时';
    return '';
  }
  function save() {
    var item = rule(editingId);
    if (!item) return;
    var levels = readLevels(item);
    var error = validateLevels(item, levels);
    if (error) { toast(error); return; }
    var scope = (document.getElementById('wrScope') || {}).value || '全部项目';
    var enabled = ((document.getElementById('wrEnabled') || {}).value || 'on') === 'on';
    var recoveryConfig = {};
    if (item.code === 'DRIVER_FATIGUE') {
      var rest = Number((document.getElementById('wrRestMinutes') || {}).value);
      if (!Number.isInteger(rest) || rest < 10 || rest > 120) { toast('有效休息时长应为 10 到 120 分钟'); return; }
      recoveryConfig.restThresholdMinutes = rest;
    }
    if (item.enabled && !enabled && !window.confirm('停用后系统将不再根据该规则产生新的告警，已产生的告警继续使用原规则快照。')) return;
    store().updateRule(editingId, { levels: levels, recoveryConfig: recoveryConfig, scopeType: scope, enabled: enabled });
    closeDrawer();
    if (window.app) window.app.render();
    toast('多级预警规则已保存');
  }
  function toggle(id) {
    var item = rule(id);
    if (!item) return;
    if (item.enabled && !window.confirm('停用后系统将不再根据该规则产生新的告警，已产生的告警继续使用原规则快照。')) return;
    store().updateRule(id, { enabled: !item.enabled, levels: item.levels, recoveryConfig: item.recoveryConfig, scopeType: item.scopeType });
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
  if (window.app) window.app.register(PAGE, render, [PAGE]);
})();
