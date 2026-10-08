/* 告警中心：实时告警、告警记录、知悉、处理与详情时间线。 */
(function () {
  'use strict';

  var liveFilters = blankFilters(false);
  var recordFilters = blankFilters(true);
  var activeMetric = '';
  var drawerEventId = '';
  var savedMainScroll = 0;

  function blankFilters(record) {
    return { project: '', type: '', category: '', level: '', eventStatus: record ? '' : '发生中', handleStatus: '', keyword: '', start: '', end: '' };
  }
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function toast(message) {
    if (typeof showAppToast === 'function') showAppToast(message);
    else window.alert(message);
  }
  function store() { return window.AlertCenterStore; }
  function events() { return store() ? store().getEvents() : []; }
  function rules() { return store() ? store().getRules() : []; }
  function isRecordPage() { return window.app && window.app.currentPage === 'alert-records'; }
  function currentFilters() { return isRecordPage() ? recordFilters : liveFilters; }
  function option(value, label, selected) {
    return '<option value="' + esc(value) + '"' + (value === selected ? ' selected' : '') + '>' + esc(label) + '</option>';
  }
  function options(values, selected, allLabel) {
    return option('', allLabel || '全部', selected) + values.map(function (value) { return option(value, value, selected); }).join('');
  }
  function field(label, control) {
    return '<div class="filter-item"><label class="filter-label">' + label + '</label>' + control + '</div>';
  }
  function badge(value, tone) { return '<span class="badge badge-' + tone + '">' + esc(value) + '</span>'; }
  function levelBadge(level) {
    if (level === '紧急') return badge(level, 'error');
    if (level === '严重') return badge(level, 'warning');
    return badge(level, 'gray');
  }
  function eventBadge(status) { return status === '发生中' ? badge(status, 'error') : badge(status, 'success'); }
  function handleBadge(status) {
    if (status === '待处理') return badge(status, 'warning');
    if (status === '处理中') return badge(status, 'primary');
    return badge(status, 'success');
  }
  function thresholdText(event) {
    var snap = event.ruleSnapshot || {};
    var levels = Array.isArray(snap.levels) ? snap.levels : [];
    var current = levels.filter(function (item) { return item.level === event.level; })[0];
    if (current) {
      if (event.ruleCode === 'VEHICLE_OVERSPEED') return '车速 ≥ ' + current.speedThreshold + ' km/h，持续 ≥ ' + Math.round(current.durationSeconds / 60 * 10) / 10 + '分钟';
      if (event.ruleCode === 'DRIVER_FATIGUE') return '连续驾驶 ≥ ' + Math.round(current.thresholdMinutes / 6) / 10 + '小时';
      if (event.ruleCode === 'VEHICLE_LOW_SOC') return 'SOC ≤ ' + current.threshold + '%';
      if (event.ruleCode === 'PARKING_AREA') return '区域停留 ≥ ' + current.threshold + '分钟';
      if (event.ruleCode === 'UNLOAD_WEIGHBILL_MISSING') return '离开卸货地 ≥ ' + current.threshold + '分钟未上传';
      return '连续停车 ≥ ' + current.threshold + '分钟';
    }
    var config = snap.config || {};
    var threshold = config.threshold == null ? snap.threshold : config.threshold;
    var unit = config.unit || snap.unit || '';
    var compare = config.compare || snap.compare || '';
    return compare + ' ' + (threshold == null ? '—' : threshold) + (unit === '%' ? '%' : ' ' + unit);
  }
  function durationText(event) {
    var start = new Date(String(event.triggeredAt).replace(/-/g, '/')).getTime();
    var end = event.recoveredAt ? new Date(String(event.recoveredAt).replace(/-/g, '/')).getTime() : Date.now();
    if (!isFinite(start) || !isFinite(end)) return '—';
    var minutes = Math.max(0, Math.round((end - start) / 60000));
    if (minutes >= 1440) return Math.floor(minutes / 1440) + '天' + Math.floor((minutes % 1440) / 60) + '小时';
    if (minutes >= 60) return Math.floor(minutes / 60) + '小时' + (minutes % 60) + '分钟';
    return minutes + '分钟';
  }
  function metrics(list) {
    var active = list.filter(function (item) { return item.eventStatus === '发生中'; });
    return {
      active: active.length,
      emergency: active.filter(function (item) { return item.level === '紧急'; }).length,
      pending: active.filter(function (item) { return item.handleStatus === '待处理'; }).length,
      handling: active.filter(function (item) { return item.handleStatus === '处理中'; }).length
    };
  }
  function metricHtml(key, label, value, copy, tone) {
    return '<button type="button" class="ac-metric ac-metric-' + tone + (activeMetric === key ? ' is-active' : '') + '" onclick="acMetric(\'' + key + '\')"><span>' + esc(label) + '</span><b>' + value + '</b><small>' + esc(copy) + '</small></button>';
  }
  function filterEvents(all, filters, record) {
    var q = filters.keyword.trim().toLowerCase();
    return all.filter(function (item) {
      if (!record && item.eventStatus !== '发生中') return false;
      if (filters.project && item.projectName !== filters.project) return false;
      if (filters.type && item.type !== filters.type) return false;
      if (filters.category && item.category !== filters.category) return false;
      if (filters.level && item.level !== filters.level) return false;
      if (filters.eventStatus && item.eventStatus !== filters.eventStatus) return false;
      if (filters.handleStatus && item.handleStatus !== filters.handleStatus) return false;
      if (filters.start && String(item.triggeredAt).slice(0, 10) < filters.start) return false;
      if (filters.end && String(item.triggeredAt).slice(0, 10) > filters.end) return false;
      if (q && [item.id, item.plate, item.driverName, item.taskId, item.type].join(' ').toLowerCase().indexOf(q) < 0) return false;
      if (activeMetric === 'emergency' && !(item.eventStatus === '发生中' && item.level === '紧急')) return false;
      if (activeMetric === 'pending' && !(item.eventStatus === '发生中' && item.handleStatus === '待处理')) return false;
      if (activeMetric === 'handling' && !(item.eventStatus === '发生中' && item.handleStatus === '处理中')) return false;
      if (activeMetric === 'active' && item.eventStatus !== '发生中') return false;
      return true;
    }).sort(function (a, b) { return String(b.triggeredAt).localeCompare(String(a.triggeredAt)); });
  }
  function filtersHtml(record, filters) {
    var ruleNames = rules().map(function (item) { return item.name; });
    var html = '<div class="filter-panel ac-filter"><div class="filter-row">'
      + field('项目', '<select class="filter-control" id="acProject">' + options(['玉溪项目'], filters.project) + '</select>')
      + field('告警类型', '<select class="filter-control" id="acType">' + options(ruleNames, filters.type) + '</select>')
      + field('告警分类', '<select class="filter-control" id="acCategory">' + options(['车辆', '运输', '作业', '单据', '安全'], filters.category) + '</select>')
      + field('告警等级', '<select class="filter-control" id="acLevel">' + options(['一般', '严重', '紧急'], filters.level) + '</select>')
      + field('事件状态', '<select class="filter-control" id="acEventStatus">' + options(['发生中', '已恢复'], filters.eventStatus) + '</select>')
      + field('处理状态', '<select class="filter-control" id="acHandleStatus">' + options(['待处理', '处理中', '已处理'], filters.handleStatus) + '</select>')
      + field('关键字', '<input class="filter-control" id="acKeyword" value="' + esc(filters.keyword) + '" placeholder="车牌 / 司机 / 任务单 / 告警编号" onkeydown="if(event.key===\'Enter\')acApply()">');
    if (record) {
      html += field('开始日期', '<input class="filter-control" id="acStart" type="date" value="' + esc(filters.start) + '">')
        + field('结束日期', '<input class="filter-control" id="acEnd" type="date" value="' + esc(filters.end) + '">');
    }
    return html + '</div><div class="filter-actions"><button class="btn btn-default" type="button" onclick="acReset()">重置</button><button class="btn btn-primary" type="button" onclick="acApply()">查询</button></div></div>';
  }
  function liveRow(event) {
    var facts = Array.isArray(event.facts) ? event.facts : [];
    var actions = '<a class="link" href="javascript:void(0)" onclick="acView(\'' + esc(event.id) + '\')">查看</a>';
    if (event.handleStatus === '待处理') actions += '<a class="link" href="javascript:void(0)" onclick="acAck(\'' + esc(event.id) + '\')">知悉</a>';
    else actions += '<span class="ac-action-done">已知悉</span>';
    if (event.handleStatus !== '已处理') actions += '<a class="link" href="javascript:void(0)" onclick="acHandle(\'' + esc(event.id) + '\')">处理</a>';
    return '<tr><td class="sticky-col col-time">' + esc(event.triggeredAt) + '</td><td>' + levelBadge(event.level) + '</td><td><strong>' + esc(event.type) + '</strong></td><td>' + esc(event.projectName) + '</td><td>' + esc(event.plate) + '</td><td>' + esc(event.driverName) + '</td><td class="col-mono">' + esc(event.taskId || '—') + '</td><td class="ac-content-cell" title="' + esc(facts.join('；')) + '">' + esc(facts[0] || event.type) + '</td><td>' + esc(event.currentValueText || event.currentValue) + '</td><td>' + esc(thresholdText(event)) + '</td><td>' + esc(durationText(event)) + '</td><td>' + eventBadge(event.eventStatus) + '</td><td>' + handleBadge(event.handleStatus) + '</td><td>' + esc(event.handlerName || event.acknowledgedBy || '—') + '</td><td class="sticky-col-r ac-actions">' + actions + '</td></tr>';
  }
  function recordRow(event) {
    return '<tr><td class="sticky-col col-mono"><a class="link" href="javascript:void(0)" onclick="acView(\'' + esc(event.id) + '\')">' + esc(event.id) + '</a></td><td>' + esc(event.type) + '</td><td>' + esc(event.category) + '</td><td>' + levelBadge(event.level) + '</td><td>' + esc(event.projectName) + '</td><td>' + esc(event.plate) + '</td><td>' + esc(event.driverName) + '</td><td class="col-mono">' + esc(event.taskId || '—') + '</td><td class="col-time">' + esc(event.triggeredAt) + '</td><td class="col-time">' + esc(event.recoveredAt || '—') + '</td><td>' + esc(durationText(event)) + '</td><td>' + eventBadge(event.eventStatus) + '</td><td>' + handleBadge(event.handleStatus) + '</td><td>' + esc(event.handlerName || '—') + '</td><td class="col-time">' + esc(event.handledAt || '—') + '</td><td class="ac-content-cell">' + esc(event.handlingResult || '—') + '</td><td class="sticky-col-r"><a class="link" href="javascript:void(0)" onclick="acView(\'' + esc(event.id) + '\')">查看</a></td></tr>';
  }
  function tableHtml(record, rows) {
    var head = record
      ? '<th class="sticky-col">告警编号</th><th>告警类型</th><th>分类</th><th>当前/最终等级</th><th>项目</th><th>车牌号</th><th>司机</th><th>任务单号</th><th>触发时间</th><th>恢复时间</th><th>持续时长</th><th>事件状态</th><th>处理状态</th><th>处理人</th><th>处理完成时间</th><th>处理结果</th><th class="sticky-col-r">操作</th>'
      : '<th class="sticky-col">告警时间</th><th>当前等级</th><th>告警类型</th><th>项目</th><th>车牌号</th><th>司机</th><th>关联任务单</th><th>告警内容</th><th>当前值</th><th>当前等级条件</th><th>持续时间</th><th>事件状态</th><th>处理状态</th><th>处理人</th><th class="sticky-col-r">操作</th>';
    var body = rows.length ? rows.map(record ? recordRow : liveRow).join('') : '<tr><td colspan="17"><div class="empty-state"><b>没有符合条件的告警</b><p>可调整筛选条件后重新查询。</p></div></td></tr>';
    return '<section class="table-section"><div class="table-toolbar"><div class="left"><span class="detail-section-title">' + (record ? '告警记录' : '实时告警') + '</span><span class="ac-table-count">共 ' + rows.length + ' 条</span></div><div class="right">'
      + (record ? '<button class="toolbar-btn" type="button" onclick="acExport()">导出</button>' : '')
      + '<button class="toolbar-btn" type="button" onclick="acRefresh()">刷新</button></div></div>'
      + '<div class="table-wrap ac-table-wrap"><table class="data-table ac-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>'
      + '<div class="pagination"><div class="pagination-info">共 ' + rows.length + ' 条，当前 1-' + rows.length + '</div><div class="pagination-controls"><button class="page-btn active" type="button">1</button></div></div></section>';
  }
  function render() {
    var record = isRecordPage();
    var all = events();
    var filters = currentFilters();
    var rows = filterEvents(all, filters, record);
    var m = metrics(all);
    return '<div class="content-area page-standard ac-page">'
      + '<div class="breadcrumb"><span>告警中心</span><span class="sep">/</span><span class="current">' + (record ? '告警记录' : '实时告警') + '</span></div>'
      + '<div class="page-header"><div><div class="page-title">告警中心</div><p class="detail-section-sub">统一查看运输监控中心产生的预警事件，并完成知悉、处理与历史复盘。</p></div></div>'
      + '<nav class="section-tabs ac-page-tabs" aria-label="告警中心页面"><button class="tab-item' + (!record ? ' active' : '') + '" type="button" onclick="app.navigate(\'alert-center\')">实时告警</button><button class="tab-item' + (record ? ' active' : '') + '" type="button" onclick="app.navigate(\'alert-records\')">告警记录</button></nav>'
      + '<div class="ac-metrics">' + metricHtml('active', '发生中告警', m.active, '当前异常仍存在', 'red') + metricHtml('emergency', '紧急告警', m.emergency, '需优先关注', 'orange') + metricHtml('pending', '待处理', m.pending, '尚未被知悉', 'amber') + metricHtml('handling', '处理中', m.handling, '已有人跟进', 'blue') + '</div>'
      + filtersHtml(record, filters) + tableHtml(record, rows) + '</div>';
  }
  function readFilters() {
    var filters = currentFilters();
    ['Project', 'Type', 'Category', 'Level', 'EventStatus', 'HandleStatus', 'Keyword', 'Start', 'End'].forEach(function (suffix) {
      var el = document.getElementById('ac' + suffix);
      if (!el) return;
      var key = suffix.charAt(0).toLowerCase() + suffix.slice(1);
      filters[key] = String(el.value || '').trim();
    });
  }
  function rerender() {
    var main = document.querySelector('.main');
    savedMainScroll = main ? main.scrollTop : 0;
    if (window.app) window.app.render();
  }
  function closeDrawer() {
    var host = document.getElementById('acDrawerHost');
    if (host) host.remove();
    drawerEventId = '';
  }
  function mountDrawer(html, mode) {
    closeDrawer();
    var host = document.createElement('div');
    host.id = 'acDrawerHost';
    host.className = 'ac-drawer-host is-open';
    host.innerHTML = '<button class="ac-drawer-mask" type="button" onclick="acCloseDrawer()" aria-label="关闭"></button><aside class="ac-drawer ac-' + mode + '-drawer" role="dialog" aria-modal="true">' + html + '</aside>';
    document.body.appendChild(host);
  }
  function kv(label, value) { return '<div><dt>' + esc(label) + '</dt><dd>' + (value == null || value === '' ? '—' : value) + '</dd></div>'; }
  function summary(event) {
    return '<div class="ac-detail-summary"><span>' + levelBadge(event.level) + '<small>告警等级</small></span><span>' + eventBadge(event.eventStatus) + '<small>事件状态</small></span><span>' + handleBadge(event.handleStatus) + '<small>处理状态</small></span><span><b>' + esc(durationText(event)) + '</b><small>持续时间</small></span></div>';
  }
  function timelineHtml(event) {
    var names = { TRIGGERED: '告警触发', LEVEL_UPGRADED: '告警升级', LEVEL_DOWNGRADED: '告警降级', ACKNOWLEDGED: '告警知悉', HANDLING_STARTED: '开始处理', HANDLED: '处理完成', RECOVERED: '自动恢复' };
    var logs = store().getLogs(event.id);
    return logs.map(function (log) {
      return '<li class="is-' + String(log.action).toLowerCase() + '"><i></i><div><time>' + esc(log.operatedAt) + '</time><b>' + esc(names[log.action] || log.action) + '</b><p>' + esc(log.remark || '') + (log.operator ? '<span> · ' + esc(log.operator) + '</span>' : '') + '</p></div></li>';
    }).join('');
  }
  function metricText(minutes) {
    var value = Number(minutes);
    if (!isFinite(value)) return '—';
    if (value >= 60) return Math.floor(value / 60) + '小时' + (value % 60 ? value % 60 + '分钟' : '');
    return value + '分钟';
  }
  function evidenceHtml(event) {
    var metrics = event.metrics || {};
    var threshold = thresholdText(event);
    var items = [];
    switch (event.ruleCode) {
      case 'TRANSPORT_PARKING':
        items = [['当前车速', metrics.speed == null ? '—' : metrics.speed + ' km/h'], ['停车开始时间', metrics.parkingStartedAt], ['连续停车时长', metricText(metrics.parkingMinutes)], ['触发阈值', threshold], ['当前位置', event.location]];
        break;
      case 'PARKING_AREA':
        items = [['区域 / 围栏名称', metrics.fenceName || event.location], ['进入时间', metrics.enteredAt], ['当前停留时长', metricText(metrics.areaDwellMinutes)], ['触发阈值', threshold], ['当前任务单', event.taskId]];
        break;
      case 'VEHICLE_OVERSPEED':
        items = [['当前车速', metrics.speed == null ? '—' : metrics.speed + ' km/h'], ['超速开始时间', metrics.overspeedStartedAt], ['连续超速时间', metrics.overspeedDurationSeconds == null ? '—' : metrics.overspeedDurationSeconds + '秒'], ['当前等级条件', threshold], ['当前位置', event.location]];
        break;
      case 'UNLOAD_WEIGHBILL_MISSING':
        items = [['任务单号', event.taskId], ['卸货地', metrics.unloadLocation || event.location], ['离开卸货地时间', metrics.unloadDepartedAt], ['当前磅单状态', metrics.weighbillUploaded ? '已上传' : '未上传'], ['已等待时长', metricText(metrics.waitingMinutes)], ['触发阈值', threshold]];
        break;
      case 'VEHICLE_LOW_SOC':
        items = [['当前 SOC', metrics.soc == null ? '—' : metrics.soc + '%'], ['触发阈值', threshold], ['当前任务单', event.taskId], ['当前位置', event.location]];
        break;
      case 'DRIVER_FATIGUE':
        items = [['司机', event.driverName], ['车辆', event.plate], ['驾驶周期', event.drivingCycleId || metrics.drivingCycleId], ['当前任务单', event.taskId], ['本次连续驾驶开始时间', metrics.drivingStartedAt], ['当前连续驾驶时长', metricText(metrics.continuousDrivingMinutes)], ['当前车速', metrics.currentSpeed == null ? '—' : metrics.currentSpeed + ' km/h'], ['最近停车开始时间', metrics.parkingStartedAt || '—'], ['当前连续停车时长', metricText(metrics.continuousParkingMinutes || 0)], ['当前等级条件', threshold], ['有效休息阈值', metricText(((event.ruleSnapshot || {}).recoveryConfig || {}).restThresholdMinutes || 20)]];
        break;
      default:
        items = [['当前值', event.currentValueText || event.currentValue], ['触发阈值', threshold]];
    }
    return items.map(function (item) { return kv(item[0], esc(item[1] == null ? '—' : item[1])); }).join('');
  }
  function detailDrawer(id) {
    var event = store().getEvent(id);
    if (!event) return;
    var html = '<header class="ac-drawer-header"><div><small>' + esc(event.id) + '</small><h2>' + esc(event.type) + '</h2></div><button type="button" onclick="acCloseDrawer()" aria-label="关闭">×</button></header>'
      + '<div class="ac-drawer-body">' + summary(event)
      + '<section class="detail-section"><div class="detail-section-title">车辆信息</div><dl class="ac-kv">' + kv('车牌号', esc(event.plate)) + kv('司机', esc(event.driverName)) + kv('当前位置', esc(event.location)) + kv('车辆状态', event.eventStatus === '发生中' ? '异常状态持续中' : '已恢复正常') + '</dl></section>'
      + '<section class="detail-section"><div class="detail-section-title">关联运输</div><dl class="ac-kv">' + kv('任务单号', '<a class="link" href="javascript:void(0)" onclick="acOpenTask(\'' + esc(event.taskId) + '\')">' + esc(event.taskId || '—') + '</a>') + kv('线路', esc(event.route || '—')) + kv('货物', esc(event.cargo || '—')) + kv('项目', esc(event.projectName)) + '</dl></section>'
      + '<section class="detail-section"><div class="detail-section-title">告警信息</div><dl class="ac-kv">' + kv('触发时间', esc(event.triggeredAt)) + kv('触发规则', esc((event.ruleSnapshot || {}).ruleName || event.type)) + kv('触发时等级', levelBadge(event.initialLevel || event.level)) + kv('当前风险等级', levelBadge(event.level)) + kv('当前等级条件', esc(thresholdText(event))) + kv('恢复条件', esc(((event.ruleSnapshot || {}).recoveryConfig || {}).description || (event.ruleSnapshot || {}).recovery || '—')) + kv('恢复时间', esc(event.recoveredAt || '—')) + '</dl></section>'
      + '<section class="detail-section"><div class="detail-section-title">业务证据</div><dl class="ac-kv">' + evidenceHtml(event) + '</dl><div class="ac-facts"><b>监控事实</b>' + (event.facts || []).map(function (fact) { return '<span>' + esc(fact) + '</span>'; }).join('') + '</div></section>'
      + (event.handlingResult ? '<section class="detail-section"><div class="detail-section-title">处理结果</div><dl class="ac-kv">' + kv('处理方式', esc(event.handlingType)) + kv('处理人', esc(event.handlerName)) + kv('处理时间', esc(event.handledAt)) + kv('处理结果', esc(event.handlingResult)) + '</dl></section>' : '')
      + '<section class="detail-section"><div class="detail-section-title">告警时间线</div><ol class="ac-timeline">' + timelineHtml(event) + '</ol></section></div>'
      + '<footer class="ac-drawer-footer"><button class="btn btn-default" type="button" onclick="acCloseDrawer()">关闭</button>' + (event.handleStatus !== '已处理' ? '<button class="btn btn-primary" type="button" onclick="acHandle(\'' + esc(event.id) + '\')">处理告警</button>' : '') + '</footer>';
    mountDrawer(html, 'detail');
    drawerEventId = id;
  }
  function handleDrawer(id) {
    var event = store().getEvent(id);
    if (!event) return;
    var types = ['联系司机', '联系现场', '调整任务', '安排充电', '车辆检修', '补传资料', '无需处理', '其他'];
    var html = '<header class="ac-drawer-header"><div><small>' + esc(event.id) + '</small><h2>处理告警</h2></div><button type="button" onclick="acCloseDrawer()" aria-label="关闭">×</button></header>'
      + '<div class="ac-drawer-body"><div class="ac-handle-context"><strong>' + esc(event.type) + '</strong><span>' + esc(event.plate + ' · ' + event.driverName + ' · ' + (event.taskId || '无任务单')) + '</span><p>' + esc((event.facts || [])[0] || '') + '</p></div>'
      + '<section class="detail-section"><div class="detail-section-title">处理信息</div><div class="form-grid">'
      + '<div class="form-item"><label class="form-label">处理方式 <span class="req">*</span></label><select class="form-control-text" id="acHandlingType"><option value="">请选择</option>' + types.map(function (type) { return option(type, type, false); }).join('') + '</select></div>'
      + '<div class="form-item"><label class="form-label">处理结果 <span class="req">*</span></label><textarea class="form-control-text ac-result" id="acHandlingResult" maxlength="300" placeholder="请说明核实情况、采取的措施和后续安排"></textarea></div>'
      + '<div class="ac-handler-meta"><span>处理人：' + esc(store().operator) + '</span><span>提交时记录处理时间</span></div></div></section>'
      + '<div class="alert alert-info">人工标记已处理不会改变客观事件状态；若异常仍存在，事件状态仍为“发生中”。</div></div>'
      + '<footer class="ac-drawer-footer"><button class="btn btn-default" type="button" onclick="acCloseDrawer()">取消</button><button class="btn btn-primary" type="button" onclick="acSubmitHandle()">标记已处理</button></footer>';
    mountDrawer(html, 'handle');
    drawerEventId = id;
  }
  function exportCsv() {
    var rows = filterEvents(events(), recordFilters, true);
    var headers = ['告警编号', '告警类型', '分类', '当前/最终等级', '项目', '车牌号', '司机', '任务单号', '触发时间', '恢复时间', '持续时长', '事件状态', '处理状态', '处理人', '处理方式', '处理结果'];
    function csv(value) { return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"'; }
    var content = [headers.map(csv).join(',')].concat(rows.map(function (event) {
      return [event.id, event.type, event.category, event.level, event.projectName, event.plate, event.driverName, event.taskId, event.triggeredAt, event.recoveredAt, durationText(event), event.eventStatus, event.handleStatus, event.handlerName, event.handlingType, event.handlingResult].map(csv).join(',');
    })).join('\n');
    var link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' }));
    link.download = '告警记录_' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    toast('已导出当前筛选结果');
  }

  window.acApply = function () { readFilters(); activeMetric = ''; rerender(); };
  window.acReset = function () { if (isRecordPage()) recordFilters = blankFilters(true); else liveFilters = blankFilters(false); activeMetric = ''; rerender(); };
  window.acMetric = function (key) { activeMetric = activeMetric === key ? '' : key; rerender(); };
  window.acRefresh = function () { store().refresh(); rerender(); toast('告警数据已刷新'); };
  window.acView = detailDrawer;
  window.acCloseDrawer = closeDrawer;
  window.acAck = function (id) { store().acknowledge(id); rerender(); toast('已知悉告警，处理状态已更新为处理中'); };
  window.acHandle = handleDrawer;
  window.acSubmitHandle = function () {
    var type = ((document.getElementById('acHandlingType') || {}).value || '').trim();
    var result = ((document.getElementById('acHandlingResult') || {}).value || '').trim();
    if (!type) { toast('请选择处理方式'); return; }
    if (!result) { toast('请填写处理结果'); return; }
    store().handle(drawerEventId, type, result);
    closeDrawer();
    rerender();
    toast('告警已标记为已处理');
  };
  window.acOpenTask = function (id) {
    closeDrawer();
    if (window.app && window.app.pages['task-order-management']) app.navigate('task-order-management');
    else toast('任务单 ' + id);
  };
  window.acExport = exportCsv;
  window.addEventListener('hashchange', closeDrawer);

  if (!window.app) return;
  window.app.register('alert-center', render, ['alert-center']);
  window.app.register('alert-records', render, ['alert-records']);
  window.app.pages['alert-center'].onRender = window.app.pages['alert-records'].onRender = function () {
    var main = document.querySelector('.main');
    if (main && savedMainScroll) main.scrollTop = savedMainScroll;
  };
  window.setTimeout(function () {
    var page = window.location.hash.replace('#', '');
    if ((page === 'alert-center' || page === 'alert-records') && window.app.currentPage !== page) window.app.navigate(page);
  }, 0);
})();
