/* 告警中心：六类事件分页，页内 Tab 切换列表与规则配置。 */
(function () {
  'use strict';

  var LEVEL_NAMES = ['一般', '严重', '紧急'];
  var TYPES = [
    {
      page: 'alert-parking', code: 'TRANSPORT_PARKING', name: '停车预警',
      summary: '运输任务执行中识别持续静止，排除装卸与充电后按分级时长触发。',
      extraLabel: '', extraPlaceholder: '',
      columns: [
        { key: 'index', label: '序号' }, { key: 'level', label: '告警等级' }, { key: 'plate', label: '车牌号' },
        { key: 'parkingMinutes', label: '连续异常停车时长' }, { key: 'location', label: '停车位置' },
        { key: 'driverName', label: '司机' }, { key: 'projectName', label: '所属项目' }, { key: 'taskId', label: '关联任务单' },
        { key: 'parkingStartedAt', label: '停车开始时间' }, { key: 'triggeredAt', label: '告警触发时间' },
        { key: 'eventStatus', label: '事件状态' }, { key: 'handleStatus', label: '处置状态' }, { key: 'actions', label: '操作' }
      ]
    },
    {
      page: 'alert-parking-area', code: 'PARKING_AREA', name: '停车区域预警',
      summary: '车辆在业务区域或电子围栏内停留达到分级时长时触发。',
      extraLabel: '围栏名称', extraPlaceholder: '围栏 / 区域名称',
      columns: [
        { key: 'index', label: '序号' }, { key: 'level', label: '告警等级' }, { key: 'areaDwellMinutes', label: '围栏内停留时长' },
        { key: 'eventStatus', label: '状态' }, { key: 'projectName', label: '所属项目' }, { key: 'plate', label: '车牌号' },
        { key: 'driverName', label: '司机' }, { key: 'fenceName', label: '围栏名称' }, { key: 'location', label: '进入围栏位置' },
        { key: 'enteredAt', label: '进入围栏时间' }, { key: 'taskId', label: '关联任务单' },
        { key: 'handleStatus', label: '处理状态' }, { key: 'actions', label: '操作' }
      ]
    },
    {
      page: 'alert-overspeed', code: 'VEHICLE_OVERSPEED', name: '车速预警',
      summary: '车辆达到分级车速并连续保持相应时长时触发。',
      extraLabel: '', extraPlaceholder: '',
      columns: [
        { key: 'index', label: '序号' }, { key: 'level', label: '告警等级' }, { key: 'speed', label: '当前车速' },
        { key: 'overspeedDuration', label: '连续超速时长' }, { key: 'eventStatus', label: '状态' }, { key: 'projectName', label: '所属项目' },
        { key: 'plate', label: '车牌号' }, { key: 'driverName', label: '司机' }, { key: 'location', label: '当前位置' },
        { key: 'overspeedStartedAt', label: '超速开始时间' }, { key: 'taskId', label: '关联任务单' },
        { key: 'handleStatus', label: '处理状态' }, { key: 'actions', label: '操作' }
      ]
    },
    {
      page: 'alert-weighbill', code: 'UNLOAD_WEIGHBILL_MISSING', name: '卸货后未上传磅单',
      summary: '离开卸货地且磅单未上传，等待时间达到分级阈值时触发。',
      extraLabel: '卸货地', extraPlaceholder: '卸货区域 / 地点',
      columns: [
        { key: 'index', label: '序号' }, { key: 'level', label: '告警等级' }, { key: 'waitingMinutes', label: '已等待时长' },
        { key: 'weighbillStatus', label: '磅单状态' }, { key: 'eventStatus', label: '状态' }, { key: 'projectName', label: '所属项目' },
        { key: 'plate', label: '车牌号' }, { key: 'driverName', label: '司机' }, { key: 'unloadLocation', label: '卸货地' },
        { key: 'unloadDepartedAt', label: '离开卸货地时间' }, { key: 'taskId', label: '关联任务单' },
        { key: 'handleStatus', label: '处理状态' }, { key: 'actions', label: '操作' }
      ]
    },
    {
      page: 'alert-soc', code: 'VEHICLE_LOW_SOC', name: 'SOC预警',
      summary: '车辆 SOC 降至分级阈值时触发，数值越低风险越高。',
      extraLabel: '', extraPlaceholder: '',
      columns: [
        { key: 'index', label: '序号' }, { key: 'level', label: '告警等级' }, { key: 'soc', label: '当前SOC' },
        { key: 'eventStatus', label: '状态' }, { key: 'projectName', label: '所属项目' }, { key: 'plate', label: '车牌号' },
        { key: 'driverName', label: '司机' }, { key: 'location', label: '当前位置' }, { key: 'taskId', label: '关联任务单' },
        { key: 'handleStatus', label: '处理状态' }, { key: 'actions', label: '操作' }
      ]
    },
    {
      page: 'alert-fatigue', code: 'DRIVER_FATIGUE', name: '疲劳驾驶预警',
      summary: '根据车辆运行行为、当前绑定司机和连续驾驶周期计算疲劳风险。',
      extraLabel: '', extraPlaceholder: '',
      columns: [
        { key: 'index', label: '序号' }, { key: 'level', label: '告警等级' }, { key: 'continuousDriving', label: '连续驾驶时长' },
        { key: 'eventStatus', label: '状态' }, { key: 'projectName', label: '所属项目' }, { key: 'plate', label: '车牌号' },
        { key: 'driverName', label: '司机' }, { key: 'currentSpeed', label: '当前车速' }, { key: 'drivingStartedAt', label: '驾驶开始时间' },
        { key: 'restThreshold', label: '有效休息' }, { key: 'taskId', label: '关联任务单' },
        { key: 'handleStatus', label: '处理状态' }, { key: 'actions', label: '操作' }
      ]
    }
  ];
  var pageState = {};
  var drawerEventId = '';
  var savedMainScroll = 0;

  function blankFilters() {
    return { project: '', level: '', eventStatus: '发生中', handleStatus: '', keyword: '', extra: '', start: '', end: '' };
  }
  function pageOf(page) {
    if (!pageState[page]) pageState[page] = { tab: 'list', filters: blankFilters(), activeMetric: '', parkingRuleFilters: { name: '', scopeType: '', status: '' }, parkingModal: null };
    if (!pageState[page].parkingRuleFilters) pageState[page].parkingRuleFilters = { name: '', scopeType: '', status: '' };
    return pageState[page];
  }
  function currentType() {
    var page = window.app && window.app.currentPage;
    return TYPES.filter(function (item) { return item.page === page; })[0] || TYPES[0];
  }
  function currentState() { return pageOf(currentType().page); }
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
  function ruleOf(code) { return rules().filter(function (item) { return item.code === code; })[0] || null; }
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
  function metricText(minutes) {
    var value = Number(minutes);
    if (!isFinite(value)) return '—';
    if (value >= 1440) return Math.floor(value / 1440) + '天' + Math.floor((value % 1440) / 60) + '小时';
    if (value >= 60) return Math.floor(value / 60) + '小时' + (value % 60 ? value % 60 + '分钟' : '');
    return value + '分钟';
  }
  function formatHours(minutes) {
    var value = Number(minutes) / 60;
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
  }
  function thresholdText(event) {
    var snap = event.ruleSnapshot || {};
    var levels = Array.isArray(snap.levels) ? snap.levels : [];
    var current = levels.filter(function (item) { return item.level === event.level; })[0];
    if (current) {
      if (event.ruleCode === 'VEHICLE_OVERSPEED') return '车速 ≥ ' + current.speedThreshold + ' km/h，持续 ≥ ' + Math.round(current.durationSeconds / 60 * 10) / 10 + '分钟';
      if (event.ruleCode === 'DRIVER_FATIGUE') return '连续驾驶 ≥ ' + formatHours(current.thresholdMinutes) + '小时';
      if (event.ruleCode === 'VEHICLE_LOW_SOC') return 'SOC ≤ ' + current.threshold + '%';
      if (event.ruleCode === 'PARKING_AREA') return '区域停留 ≥ ' + current.threshold + '分钟';
      if (event.ruleCode === 'UNLOAD_WEIGHBILL_MISSING') return '离开卸货地 ≥ ' + current.threshold + '分钟未上传';
      return '连续异常停车 ≥ ' + current.threshold + '分钟';
    }
    return '—';
  }
  function durationText(event) {
    var start = new Date(String(event.triggeredAt).replace(/-/g, '/')).getTime();
    var end = event.recoveredAt ? new Date(String(event.recoveredAt).replace(/-/g, '/')).getTime() : Date.now();
    if (!isFinite(start) || !isFinite(end)) return '—';
    return metricText(Math.max(0, Math.round((end - start) / 60000)));
  }
  function cellValue(event, key, index) {
    var metrics = event.metrics || {};
    var snap = event.ruleSnapshot || {};
    switch (key) {
      case 'index': return String(index + 1);
      case 'level': return levelBadge(event.level);
      case 'eventStatus': return eventBadge(event.eventStatus);
      case 'handleStatus': return handleBadge(event.handleStatus);
      case 'projectName': return esc(event.projectName);
      case 'plate': return esc(event.plate);
      case 'driverName': return esc(event.driverName);
      case 'location': return esc(event.location || '—');
      case 'taskId': return '<span class="col-mono">' + esc(event.taskId || '—') + '</span>';
      case 'parkingMinutes': return esc(metricText(metrics.parkingMinutes));
      case 'speed': return metrics.speed == null ? '—' : esc(metrics.speed + ' km/h');
      case 'parkingStartedAt': return esc(metrics.parkingStartedAt || '—');
      case 'triggeredAt': return esc(event.triggeredAt || '—');
      case 'areaDwellMinutes': return esc(metricText(metrics.areaDwellMinutes));
      case 'fenceName': return esc(metrics.fenceName || event.location || '—');
      case 'enteredAt': return esc(metrics.enteredAt || '—');
      case 'overspeedDuration': return metrics.overspeedDurationSeconds == null ? '—' : esc(metrics.overspeedDurationSeconds + '秒');
      case 'overspeedStartedAt': return esc(metrics.overspeedStartedAt || '—');
      case 'waitingMinutes': return esc(metricText(metrics.waitingMinutes));
      case 'weighbillStatus': return esc(metrics.weighbillUploaded ? '已上传' : '未上传');
      case 'unloadLocation': return esc(metrics.unloadLocation || event.location || '—');
      case 'unloadDepartedAt': return esc(metrics.unloadDepartedAt || '—');
      case 'soc': return metrics.soc == null ? '—' : esc(metrics.soc + '%');
      case 'continuousDriving': return esc(metricText(metrics.continuousDrivingMinutes));
      case 'currentSpeed': return metrics.currentSpeed == null ? '—' : esc(metrics.currentSpeed + ' km/h');
      case 'drivingStartedAt': return esc(metrics.drivingStartedAt || '—');
      case 'restThreshold': return esc(metricText((snap.recoveryConfig || {}).restThresholdMinutes || 20));
      default: return '—';
    }
  }
  function extraMatch(event, type, extra) {
    if (!extra) return true;
    var q = extra.toLowerCase();
    var metrics = event.metrics || {};
    if (type.code === 'PARKING_AREA') return String(metrics.fenceName || event.location || '').toLowerCase().indexOf(q) >= 0;
    if (type.code === 'UNLOAD_WEIGHBILL_MISSING') return String(metrics.unloadLocation || event.location || '').toLowerCase().indexOf(q) >= 0;
    return true;
  }
  function typeEvents(all, code) {
    return all.filter(function (item) { return item.ruleCode === code; });
  }
  function filterEvents(list, filters, type, activeMetric) {
    var q = filters.keyword.trim().toLowerCase();
    return list.filter(function (item) {
      if (filters.project && item.projectName !== filters.project) return false;
      if (filters.level && item.level !== filters.level) return false;
      if (filters.eventStatus && item.eventStatus !== filters.eventStatus) return false;
      if (filters.handleStatus && item.handleStatus !== filters.handleStatus) return false;
      if (filters.start && String(item.triggeredAt).slice(0, 10) < filters.start) return false;
      if (filters.end && String(item.triggeredAt).slice(0, 10) > filters.end) return false;
      if (q && [item.plate, item.driverName, item.taskId, item.id].join(' ').toLowerCase().indexOf(q) < 0) return false;
      if (!extraMatch(item, type, filters.extra.trim())) return false;
      if (activeMetric && !(item.eventStatus === '发生中' && item.level === activeMetric)) return false;
      return true;
    }).sort(function (a, b) { return String(b.triggeredAt).localeCompare(String(a.triggeredAt)); });
  }
  function metricHtml(key, label, value, copy, tone, active) {
    return '<button type="button" class="ac-metric ac-metric-' + tone + (active === key ? ' is-active' : '') + '" onclick="acMetric(\'' + key + '\')"><span>' + esc(label) + '</span><b>' + value + '</b><small>' + esc(copy) + '</small></button>';
  }
  function metricsHtml(list, active) {
    var happening = list.filter(function (item) { return item.eventStatus === '发生中'; });
    return '<div class="ac-metrics">'
      + metricHtml('一般', '一般告警', happening.filter(function (item) { return item.level === '一般'; }).length, '发生中 · 一般', 'blue', active)
      + metricHtml('严重', '严重告警', happening.filter(function (item) { return item.level === '严重'; }).length, '发生中 · 严重', 'orange', active)
      + metricHtml('紧急', '紧急告警', happening.filter(function (item) { return item.level === '紧急'; }).length, '发生中 · 紧急', 'red', active)
      + '</div>';
  }
  function statusFilterHtml(list, current) {
    var items = [
      { value: '', label: '全部', count: list.length },
      { value: '发生中', label: '发生中', count: list.filter(function (item) { return item.eventStatus === '发生中'; }).length },
      { value: '已恢复', label: '已恢复', count: list.filter(function (item) { return item.eventStatus === '已恢复'; }).length }
    ];
    return '<div class="ac-status-switch" aria-label="告警事件状态">' + items.map(function (item) {
      return '<button type="button" class="' + (current === item.value ? 'is-active' : '') + '" aria-pressed="' + (current === item.value ? 'true' : 'false') + '" onclick="acStatus(\'' + item.value + '\')"><span>' + item.label + '</span><b>' + item.count + '</b></button>';
    }).join('') + '</div>';
  }
  function tabsHtml(type, tab) {
    return '<div class="section-tabs ac-section-tabs" role="tablist">'
      + '<button type="button" class="section-tab' + (tab === 'list' ? ' active' : '') + '" role="tab" aria-selected="' + (tab === 'list') + '" onclick="acTab(\'list\')">告警列表</button>'
      + '<button type="button" class="section-tab' + (tab === 'rules' ? ' active' : '') + '" role="tab" aria-selected="' + (tab === 'rules') + '" onclick="acTab(\'rules\')">规则配置</button>'
      + '</div>';
  }
  function projectNames() {
    var names = (store() && store().getProjects ? store().getProjects() : []).map(function (item) { return item.name; });
    events().forEach(function (item) { if (item.projectName && names.indexOf(item.projectName) < 0) names.push(item.projectName); });
    return names;
  }
  function filtersHtml(type, filters) {
    var handleLabel = type.code === 'TRANSPORT_PARKING' ? '处置状态' : '处理状态';
    var html = '<div class="filter-panel ac-filter"><div class="filter-row">'
      + field('所属项目', '<select class="filter-control" id="acProject">' + options(projectNames(), filters.project) + '</select>')
      + field('车牌号 / 司机', '<input class="filter-control" id="acKeyword" value="' + esc(filters.keyword) + '" placeholder="车牌 / 司机 / 任务单" onkeydown="if(event.key===\'Enter\')acApply()">')
      + field('告警等级', '<select class="filter-control" id="acLevel">' + options(LEVEL_NAMES, filters.level) + '</select>')
      + field(handleLabel, '<select class="filter-control" id="acHandleStatus">' + options(['待处理', '处理中', '已处理'], filters.handleStatus) + '</select>');
    if (type.extraLabel) {
      html += field(type.extraLabel, '<input class="filter-control" id="acExtra" value="' + esc(filters.extra) + '" placeholder="' + esc(type.extraPlaceholder) + '" onkeydown="if(event.key===\'Enter\')acApply()">');
    }
    html += field('开始日期', '<input class="filter-control" id="acStart" type="date" value="' + esc(filters.start) + '">')
      + field('结束日期', '<input class="filter-control" id="acEnd" type="date" value="' + esc(filters.end) + '">');
    return html + '</div><div class="filter-actions"><button class="btn btn-default" type="button" onclick="acReset()">重置</button><button class="btn btn-primary" type="button" onclick="acApply()">查询</button></div></div>';
  }
  function actionsHtml(event) {
    var actions = '<a class="link" href="javascript:void(0)" onclick="acView(\'' + esc(event.id) + '\')">查看</a>';
    if (event.eventStatus === '发生中') {
      if (event.handleStatus === '待处理') actions += '<a class="link" href="javascript:void(0)" onclick="acAck(\'' + esc(event.id) + '\')">知悉</a>';
      else actions += '<span class="ac-action-done">已知悉</span>';
      if (event.handleStatus !== '已处理') actions += '<a class="link" href="javascript:void(0)" onclick="acHandle(\'' + esc(event.id) + '\')">处理</a>';
    }
    return actions;
  }
  function eventRow(type, event, index) {
    var cells = type.columns.map(function (column) {
      if (column.key === 'actions') return '<td class="sticky-col-r ac-actions">' + actionsHtml(event) + '</td>';
      var extra = column.key === 'index' ? ' class="sticky-col"' : '';
      return '<td' + extra + '>' + cellValue(event, column.key, index) + '</td>';
    }).join('');
    return '<tr>' + cells + '</tr>';
  }
  function tableHtml(type, rows) {
    var head = type.columns.map(function (column) {
      var extra = column.key === 'index' ? ' class="sticky-col"' : (column.key === 'actions' ? ' class="sticky-col-r"' : '');
      return '<th' + extra + '>' + column.label + '</th>';
    }).join('');
    var body = rows.length
      ? rows.map(function (event, index) { return eventRow(type, event, index); }).join('')
      : '<tr><td colspan="' + type.columns.length + '"><div class="empty-state"><b>当前没有符合条件的' + esc(type.name) + '</b><p>可调整筛选条件后重新查询。</p></div></td></tr>';
    return '<section class="table-section"><div class="table-toolbar"><div class="left"><span class="detail-section-title">' + esc(type.name) + '</span><span class="ac-table-count">共 ' + rows.length + ' 条</span></div><div class="right">'
      + '<button class="toolbar-btn" type="button" onclick="acExport()">导出</button>'
      + '<button class="toolbar-btn" type="button" onclick="acRefresh()">刷新</button></div></div>'
      + '<div class="table-wrap ac-table-wrap"><table class="data-table ac-table ac-table-' + type.code.toLowerCase() + '"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>'
      + '<div class="pagination"><div class="pagination-info">共 ' + rows.length + ' 条，当前 ' + (rows.length ? '1-' + rows.length : '0-0') + '</div><div class="pagination-controls"><button class="page-btn active" type="button">1</button></div></div></section>';
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
  function formField(label, control, hint, full) {
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
    var compare = item.code === 'VEHICLE_LOW_SOC' ? 'SOC ≤' : item.code === 'PARKING_AREA' ? '区域停留 ≥' : item.code === 'UNLOAD_WEIGHBILL_MISSING' ? '离开卸货地 ≥' : '连续异常停车 ≥';
    var unit = item.code === 'VEHICLE_LOW_SOC' ? '%' : '分钟';
    var suffix = item.code === 'UNLOAD_WEIGHBILL_MISSING' ? '未上传' : '';
    return '<div class="wr-level-condition"><label>' + compare + ' <span class="wr-unit-input"><input class="form-control-text wr-threshold" ' + base + ' type="number" min="1" max="' + (unit === '%' ? 100 : 1440) + '" value="' + level.threshold + '"><em>' + unit + '</em></span> ' + suffix + '</label></div>';
  }
  function levelsEditor(item) {
    return '<div class="wr-level-list">' + (item.levels || []).map(function (level, index) {
      return '<div class="wr-level-row is-' + levelTone(level.level) + '"><div class="wr-level-head"><span class="wr-level-name">' + esc(level.level) + '</span><label class="wr-level-enable"><input class="wr-level-enabled" data-level-index="' + index + '" type="checkbox"' + (level.enabled !== false ? ' checked' : '') + '>启用本级</label></div>' + thresholdControl(item, level, index) + '</div>';
    }).join('') + '</div>';
  }
  function parkingRuleOf() {
    var modal = currentState().parkingModal;
    if (modal && modal.rule) return modal.rule;
    var list = rules().filter(function (item) { return item.code === 'TRANSPORT_PARKING'; });
    return list[0] || null;
  }
  function yesNo(value) { return value ? '是' : '否'; }
  function parkingLevelCell(rule, name) {
    var level = (rule.levels || []).filter(function (item) { return item.level === name; })[0];
    if (!level || level.enabled === false) return '未启用';
    return '≥' + level.threshold + '分钟';
  }
  function parkingPeriodText(rule) {
    if (rule.monitorPeriod !== '自定义') return '全天';
    return (rule.monitorStart || '00:00') + '-' + (rule.monitorEnd || '23:59');
  }
  function parkingScopeObject(rule) {
    if (rule.scopeType === '指定车辆') {
      var plates = rule.vehiclePlates || [];
      if (!plates.length) return { text: '未选车辆', title: '' };
      if (plates.length === 1) return { text: plates[0], title: plates[0] };
      return { text: plates[0] + '等' + plates.length + '辆', title: plates.join('、') };
    }
    if (rule.scopeType === '指定项目') {
      var names = rule.projectNames || [];
      if (!names.length) return { text: '未选项目', title: '' };
      if (names.length === 1) return { text: names[0], title: names[0] };
      return { text: names[0] + '等' + names.length + '个项目', title: names.join('、') };
    }
    return { text: '全部车辆', title: '全部项目 · 全部车辆' };
  }
  function parkingCompactLevels(item) {
    return '<table class="data-table ac-level-table"><thead><tr><th>告警等级</th><th>是否启用</th><th>连续异常停车时长</th></tr></thead><tbody>'
      + (item.levels || []).map(function (level, index) {
        return '<tr><td>' + esc(level.level) + '</td><td><label class="ac-check"><input class="wr-level-enabled" data-level-index="' + index + '" type="checkbox"' + (level.enabled !== false ? ' checked' : '') + '>启用</label></td>'
          + '<td><div class="wr-unit-input ac-level-input"><input class="form-control-text wr-threshold" data-level-index="' + index + '" type="number" min="1" max="1440" value="' + Number(level.threshold || 0) + '"><em>分钟</em></div></td></tr>';
      }).join('')
      + '</tbody></table>';
  }
  function parkingRulesHtml() {
    var filters = currentState().parkingRuleFilters;
    var list = rules().filter(function (item) { return item.code === 'TRANSPORT_PARKING'; });
    var q = String(filters.name || '').trim().toLowerCase();
    var rows = list.filter(function (rule) {
      if (q && String(rule.name || '').toLowerCase().indexOf(q) < 0) return false;
      if (filters.scopeType && (rule.scopeType || '全部项目') !== filters.scopeType) return false;
      if (filters.status === '启用' && !rule.enabled) return false;
      if (filters.status === '停用' && rule.enabled) return false;
      return true;
    }).sort(function (a, b) { return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); });
    var body = rows.length ? rows.map(function (rule, index) {
      var target = parkingScopeObject(rule);
      var canDelete = rule.id !== 'RULE_TRANSPORT_PARKING';
      return '<tr><td class="sticky-col">' + (index + 1) + '</td><td>' + esc(rule.name || '未命名规则') + '</td><td>' + esc(rule.scopeType || '全部项目') + '</td>'
        + '<td title="' + esc(target.title) + '">' + esc(target.text) + '</td>'
        + '<td>' + esc(parkingLevelCell(rule, '一般')) + '</td><td>' + esc(parkingLevelCell(rule, '严重')) + '</td><td>' + esc(parkingLevelCell(rule, '紧急')) + '</td>'
        + '<td>' + esc(parkingPeriodText(rule)) + '</td><td>' + (rule.enabled ? badge('启用', 'primary') : badge('停用', 'gray')) + '</td>'
        + '<td>' + esc(rule.updatedAt || '—') + '</td><td class="sticky-col-r ac-actions">'
        + '<a class="link" href="javascript:void(0)" onclick="acEditParkingRule(\'' + esc(rule.id) + '\')">编辑</a>'
        + '<a class="link" href="javascript:void(0)" onclick="acToggleRule(\'' + esc(rule.id) + '\')">' + (rule.enabled ? '停用' : '启用') + '</a>'
        + (canDelete ? '<a class="link" href="javascript:void(0)" onclick="acRemoveParkingRule(\'' + esc(rule.id) + '\')">删除</a>' : '')
        + '</td></tr>';
    }).join('') : '<tr><td colspan="11"><div class="empty-state"><b>没有符合条件的停车超时规则</b><p>可调整筛选条件，或新增一条规则。</p></div></td></tr>';
    return '<div class="ac-rule-list">'
      + '<div class="filter-panel ac-filter"><div class="filter-row">'
      + field('规则名称', '<input class="filter-control" id="acRuleName" value="' + esc(filters.name) + '" placeholder="支持模糊搜索" onkeydown="if(event.key===\'Enter\')acRuleApply()">')
      + field('适用范围', '<select class="filter-control" id="acRuleScope">' + option('', '全部', filters.scopeType) + option('全部项目', '全部项目', filters.scopeType) + option('指定项目', '指定项目', filters.scopeType) + option('指定车辆', '指定车辆', filters.scopeType) + '</select>')
      + field('状态', '<select class="filter-control" id="acRuleStatus">' + option('', '全部', filters.status) + option('启用', '启用', filters.status) + option('停用', '停用', filters.status) + '</select>')
      + '</div><div class="filter-actions"><button class="btn btn-default" type="button" onclick="acRuleReset()">重置</button><button class="btn btn-primary" type="button" onclick="acRuleApply()">查询</button></div></div>'
      + '<section class="table-section"><div class="table-toolbar"><div class="left"><span class="detail-section-title">停车超时规则</span><span class="ac-table-count">共 ' + rows.length + ' 条</span></div><div class="right"><button class="btn btn-primary" type="button" onclick="acAddParkingRule()">+ 新增规则</button></div></div>'
      + '<div class="table-wrap ac-table-wrap"><table class="data-table ac-table ac-rule-table"><thead><tr>'
      + '<th class="sticky-col">序号</th><th>规则名称</th><th>适用范围</th><th>适用对象</th><th>一般</th><th>严重</th><th>紧急</th><th>监控时段</th><th>状态</th><th>更新时间</th><th class="sticky-col-r">操作</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>'
      + '<div class="pagination"><div class="pagination-info">共 ' + rows.length + ' 条，当前 ' + (rows.length ? '1-' + rows.length : '0-0') + '</div><div class="pagination-controls"><button class="page-btn active" type="button">1</button></div></div></section></div>';
  }
  function parkingModalHtml(item, mode) {
    var detect = item.detectConfig || {};
    var recovery = item.recoveryConfig || {};
    var customPeriod = item.monitorPeriod === '自定义';
    var projects = store().getProjects ? store().getProjects() : [];
    var vehicles = store().getParkingVehicles ? store().getParkingVehicles() : [];
    var selectedPlates = item.vehiclePlates || [];
    var selectedProjects = item.projectIds || [];
    var projectChecks = projects.map(function (project) {
      return '<label class="ac-check"><input type="checkbox" name="wrProjectIds" value="' + esc(project.id) + '"' + (selectedProjects.indexOf(project.id) >= 0 ? ' checked' : '') + ' onchange="acParkingCount()">' + esc(project.name) + '</label>';
    }).join('');
    var vehicleChecks = vehicles.map(function (vehicle) {
      return '<label class="ac-vehicle-option ac-check" data-plate="' + esc(vehicle.plate) + '"><input type="checkbox" name="wrVehiclePlates" value="' + esc(vehicle.plate) + '"' + (selectedPlates.indexOf(vehicle.plate) >= 0 ? ' checked' : '') + ' onchange="acParkingCount()">' + esc(vehicle.plate) + '<small>' + esc(vehicle.projectName) + '</small></label>';
    }).join('');
    var title = mode === 'create' ? '新增停车超时规则' : '编辑停车超时规则';
    return '<div class="modal ac-parking-modal" role="dialog" aria-modal="true">'
      + '<div class="modal-header"><div><div class="modal-title">' + title + '</div>' + (item.name ? '<p class="ac-modal-sub">' + esc(item.name) + '</p>' : '') + '</div><button class="modal-close" type="button" onclick="acCloseParkingModal()" aria-label="关闭">×</button></div>'
      + '<div class="modal-body">'
      + '<section class="form-section"><div class="form-section-title"><span class="section-icon"></span>基础信息</div><div class="form-grid col-2">'
      + formField('规则名称 <span class="req">*</span>', '<input class="form-control-text" id="wrName" value="' + esc(item.name) + '" maxlength="40" placeholder="最多40字">', '')
      + formField('规则状态 <span class="req">*</span>', '<select class="form-control-text" id="wrEnabled">' + option('启用', '启用', item.enabled !== false ? '启用' : '停用') + option('停用', '停用', item.enabled !== false ? '启用' : '停用') + '</select>', '')
      + formField('监控时段 <span class="req">*</span>', '<select class="form-control-text" id="wrMonitorPeriod" onchange="acMonitorPeriodChange()">' + option('全天', '全天', item.monitorPeriod || '全天') + option('自定义', '自定义', item.monitorPeriod) + '</select>', '开始时间大于结束时间时按跨天时段计算，例如 22:00-06:00')
      + '</div><div class="form-grid col-2" id="wrMonitorRange"' + (customPeriod ? '' : ' hidden') + '>'
      + formField('开始时间', '<input class="form-control-text" id="wrMonitorStart" type="time" value="' + esc(item.monitorStart || '22:00') + '">', '')
      + formField('结束时间', '<input class="form-control-text" id="wrMonitorEnd" type="time" value="' + esc(item.monitorEnd || '06:00') + '">', '')
      + '</div></section>'
      + '<section class="form-section"><div class="form-section-title"><span class="section-icon"></span>适用范围</div><div class="form-grid col-2">'
      + formField('适用范围', '<select class="form-control-text" id="wrScope" onchange="acScopeChange()">' + option('全部项目', '全部项目', item.scopeType || '全部项目') + option('指定项目', '指定项目', item.scopeType) + option('指定车辆', '指定车辆', item.scopeType) + '</select>', '指定车辆 &gt; 指定项目 &gt; 全部项目')
      + '</div>'
      + '<div id="wrProjectBox"' + (item.scopeType === '指定项目' ? '' : ' hidden') + '><div class="form-label">指定项目</div><p class="ac-scope-count" id="wrProjectCount">已选择 ' + selectedProjects.length + ' 个项目</p><div class="ac-check-list">' + projectChecks + '</div></div>'
      + '<div id="wrVehicleBox"' + (item.scopeType === '指定车辆' ? '' : ' hidden') + '><div class="form-label">指定车辆</div><p class="ac-scope-count" id="wrVehicleCount">已选择 ' + selectedPlates.length + ' 辆</p>'
      + '<input class="form-control-text" id="wrVehicleQuery" placeholder="搜索车牌号" oninput="acFilterVehicles()">'
      + '<div class="ac-check-list ac-vehicle-list">' + vehicleChecks + '</div></div></section>'
      + '<section class="form-section"><div class="form-section-title"><span class="section-icon"></span>停车判定</div><div class="form-grid col-2">'
      + formField('监控对象', '<input class="form-control-text" value="执行运输任务中的车辆" disabled>', '固定，不允许编辑')
      + formField('静止速度阈值', '<div class="wr-unit-input"><input class="form-control-text" id="wrStillSpeed" type="number" min="0" max="20" step="0.1" value="' + Number(detect.stillSpeedKph || 3) + '"><em>km/h</em></div>', '0～20 km/h')
      + formField('最小持续静止时间', '<div class="wr-unit-input"><input class="form-control-text" id="wrMinStill" type="number" min="1" max="120" value="' + Number(detect.minStillMinutes || 5) + '"><em>分钟</em></div>', '最小持续静止时间用于过滤短暂停车和定位/车速抖动，不代表告警阈值。')
      + formField('排除装货作业', '<label class="ac-check"><input id="wrExcludeLoading" type="checkbox"' + (detect.excludeLoading !== false ? ' checked' : '') + '>开启</label>', '')
      + formField('排除卸货作业', '<label class="ac-check"><input id="wrExcludeUnloading" type="checkbox"' + (detect.excludeUnloading !== false ? ' checked' : '') + '>开启</label>', '')
      + formField('排除充电状态', '<label class="ac-check"><input id="wrExcludeCharging" type="checkbox"' + (detect.excludeCharging !== false ? ' checked' : '') + '>开启</label>', '')
      + '</div></section>'
      + '<section class="form-section"><div class="form-section-title"><span class="section-icon"></span>告警等级配置</div>'
      + '<p class="wr-level-help">同一次连续停车只产生 1 个告警事件，达到更高等级时升级原事件。停用等级不参与阈值顺序校验，启用等级禁止重复阈值且必须按风险递增。</p>'
      + parkingCompactLevels(item) + '</section>'
      + '<section class="form-section"><div class="form-section-title"><span class="section-icon"></span>恢复条件</div><div class="form-grid col-2">'
      + formField('恢复速度阈值', '<div class="wr-unit-input"><input class="form-control-text" id="wrRecoverSpeed" type="number" min="1" max="80" step="0.1" value="' + Number(recovery.recoverSpeedKph || 5) + '"><em>km/h</em></div>', '必须高于静止速度阈值')
      + formField('恢复持续时间', '<div class="wr-unit-input"><input class="form-control-text" id="wrRecoverHold" type="number" min="1" max="60" value="' + Number(recovery.recoverDurationMinutes || 3) + '"><em>分钟</em></div>', '1～60分钟，短暂速度漂移不得立即恢复')
      + formField('任务结束自动结束监测', '<label class="ac-check"><input id="wrEndOnTask" type="checkbox"' + (recovery.endOnTaskComplete !== false ? ' checked' : '') + '>开启</label>', '', true)
      + '</div></section></div>'
      + '<div class="modal-footer"><button class="btn btn-default" type="button" onclick="acCloseParkingModal()">取消</button><button class="btn btn-primary" type="button" onclick="acSaveParkingRule()">保存</button></div></div>';
  }
  function rulesHtml(type) {
    if (type.code === 'TRANSPORT_PARKING') return parkingRulesHtml();
    var item = ruleOf(type.code);
    if (!item) return '<div class="empty-state"><b>未找到该事件的预警规则</b></div>';
    var recovery = item.code === 'DRIVER_FATIGUE'
      ? '<div class="wr-rest-config"><label class="form-label">有效休息时长</label><div class="wr-unit-input"><input class="form-control-text" id="wrRestMinutes" type="number" min="10" max="120" value="' + Number((item.recoveryConfig || {}).restThresholdMinutes || 20) + '"><em>分钟</em></div><p>短暂停车不会立即重置连续驾驶周期；达到有效休息或更换司机后结束当前周期。</p></div>'
      : '<div class="wr-recovery"><b>恢复条件</b><span>' + esc((item.recoveryConfig || {}).description || '—') + '</span></div>';
    return '<div class="ac-rule-panel">'
      + '<div class="ac-rule-bar"><div><strong>' + esc(item.name) + '</strong><span>' + esc(ruleSummary(item)) + '</span></div>'
      + '<button class="wr-switch' + (item.enabled ? ' is-on' : '') + '" type="button" role="switch" aria-checked="' + (item.enabled ? 'true' : 'false') + '" onclick="acToggleRule()"><i></i><span>' + (item.enabled ? '启用' : '停用') + '</span></button></div>'
      + '<section class="form-section"><div class="form-section-title"><span class="section-icon"></span>预警等级配置</div>'
      + '<p class="wr-level-help">每一级可独立启停；实时状态同时满足多级时取最高风险等级。改规则只影响之后新触发的预警。</p>'
      + levelsEditor(item) + recovery + '</section>'
      + '<section class="form-section"><div class="form-section-title"><span class="section-icon"></span>适用与启用</div><div class="form-grid col-2">'
      + formField('适用范围', '<select class="form-control-text" id="wrScope" onchange="acScopeChange()"><option' + (item.scopeType === '全部项目' ? ' selected' : '') + '>全部项目</option><option' + (item.scopeType === '指定项目' ? ' selected' : '') + '>指定项目</option></select>', '')
      + formField('指定项目', '<select class="form-control-text" id="wrProject"' + (item.scopeType !== '指定项目' ? ' disabled' : '') + '><option>玉溪项目</option></select>', '')
      + '</div></section>'
      + '<div class="ac-rule-footer"><div class="wr-meta"><span>修改人：' + esc(item.updatedBy || '—') + '</span><span>修改时间：' + esc(item.updatedAt || '—') + '</span></div>'
      + '<button class="btn btn-primary" type="button" onclick="acSaveRule()">保存规则</button></div></div>';
  }
  function render() {
    var type = currentType();
    var state = pageOf(type.page);
    if (window.__acPreferTab) {
      state.tab = window.__acPreferTab;
      window.__acPreferTab = '';
    }
    var all = typeEvents(events(), type.code);
    var rows = filterEvents(all, state.filters, type, state.activeMetric);
    return '<div class="content-area page-standard ac-page">'
      + '<div class="breadcrumb"><span>告警中心</span><span class="sep">/</span><span class="current">' + esc(type.name) + '</span></div>'
      + '<div class="page-header"><div><div class="page-title">' + esc(type.name) + '</div><p class="detail-section-sub">' + esc(type.summary) + '</p></div></div>'
      + tabsHtml(type, state.tab)
      + (state.tab === 'rules' ? rulesHtml(type) : metricsHtml(all, state.activeMetric) + statusFilterHtml(all, state.filters.eventStatus) + filtersHtml(type, state.filters) + tableHtml(type, rows))
      + '</div>';
  }
  function readFilters() {
    var filters = currentState().filters;
    ['Project', 'Level', 'HandleStatus', 'Keyword', 'Extra', 'Start', 'End'].forEach(function (suffix) {
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
    var handleLabel = event.ruleCode === 'TRANSPORT_PARKING' ? '处置状态' : '处理状态';
    return '<div class="ac-detail-summary"><span>' + levelBadge(event.level) + '<small>告警等级</small></span><span>' + eventBadge(event.eventStatus) + '<small>事件状态</small></span><span>' + handleBadge(event.handleStatus) + '<small>' + handleLabel + '</small></span><span><b>' + esc(durationText(event)) + '</b><small>持续时间</small></span></div>';
  }
  function timelineHtml(event) {
    var names = { STILL_STARTED: '开始异常停车', TRIGGERED: '告警触发', LEVEL_UPGRADED: '告警升级', LEVEL_DOWNGRADED: '告警降级', ACKNOWLEDGED: '告警知悉', HANDLING_STARTED: '人工开始处理', HANDLED: '人工处理完成', RECOVERED: '告警恢复' };
    var logs = store().getLogs(event.id);
    return logs.map(function (log) {
      return '<li class="is-' + String(log.action).toLowerCase() + '"><i></i><div><time>' + esc(log.operatedAt) + '</time><b>' + esc(names[log.action] || log.action) + '</b><p>' + esc(log.remark || '') + (log.operator ? '<span> · ' + esc(log.operator) + '</span>' : '') + '</p></div></li>';
    }).join('');
  }
  function evidenceHtml(event) {
    var metrics = event.metrics || {};
    var threshold = thresholdText(event);
    var items = [];
    switch (event.ruleCode) {
      case 'TRANSPORT_PARKING':
        items = [
          ['当前车速', metrics.speed == null ? '—' : metrics.speed + ' km/h'],
          ['静止速度阈值', '≤' + Number(((event.ruleSnapshot || {}).detectConfig || {}).stillSpeedKph || 3) + ' km/h'],
          ['停车开始时间', metrics.parkingStartedAt],
          ['连续异常停车', metricText(metrics.parkingMinutes)],
          ['当前位置', event.location],
          ['任务状态', metrics.taskNode || metrics.taskStatus || '—'],
          ['装货作业', yesNo(metrics.loadingScene === true)],
          ['卸货作业', yesNo(metrics.unloadingScene === true)],
          ['充电状态', yesNo(metrics.charging === true)]
        ];
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
    var parking = event.ruleCode === 'TRANSPORT_PARKING';
    var metrics = event.metrics || {};
    var vehicleStatus = parking ? (metrics.taskNode || (event.eventStatus === '发生中' ? '异常停车持续中' : '已恢复正常')) : (event.eventStatus === '发生中' ? '异常状态持续中' : '已恢复正常');
    var alertInfo = parking
      ? kv('告警类型', '停车超时') + kv('触发规则', esc((event.ruleSnapshot || {}).ruleName || event.type)) + kv('触发时等级', levelBadge(event.initialLevel || event.level)) + kv('当前风险等级', levelBadge(event.level)) + kv('停车开始时间', esc(metrics.parkingStartedAt || '—')) + kv('告警触发时间', esc(event.triggeredAt)) + kv('当前等级触发条件', esc(thresholdText(event))) + kv('触发阈值', esc((event.ruleSnapshot || {}).triggerThreshold != null ? ('连续异常停车 ≥ ' + (event.ruleSnapshot || {}).triggerThreshold + '分钟') : thresholdText(event))) + kv('当前连续异常停车时长', esc(metricText(metrics.parkingMinutes))) + kv('恢复条件', esc(((event.ruleSnapshot || {}).recoveryConfig || {}).description || '—')) + kv('恢复原因', esc(event.recoverReason || (event.eventStatus === '已恢复' ? (((event.ruleSnapshot || {}).recoveryConfig || {}).description || '—') : '—'))) + kv('恢复时间', esc(event.recoveredAt || '—'))
      : kv('触发时间', esc(event.triggeredAt)) + kv('触发规则', esc((event.ruleSnapshot || {}).ruleName || event.type)) + kv('触发时等级', levelBadge(event.initialLevel || event.level)) + kv('当前风险等级', levelBadge(event.level)) + kv('当前等级条件', esc(thresholdText(event))) + kv('恢复条件', esc(((event.ruleSnapshot || {}).recoveryConfig || {}).description || (event.ruleSnapshot || {}).recovery || '—')) + kv('恢复时间', esc(event.recoveredAt || '—'));
    var html = '<header class="ac-drawer-header"><div><small>' + esc(event.id) + '</small><h2>' + esc(event.type) + '</h2></div><button type="button" onclick="acCloseDrawer()" aria-label="关闭">×</button></header>'
      + '<div class="ac-drawer-body">' + summary(event)
      + '<section class="detail-section"><div class="detail-section-title">车辆信息</div><dl class="ac-kv">' + kv('车牌号', esc(event.plate)) + kv('司机', esc(event.driverName)) + (parking ? kv('当前车速', metrics.speed == null ? '—' : esc(metrics.speed + ' km/h')) : '') + kv('当前位置', esc(event.location)) + kv('车辆状态', esc(vehicleStatus)) + '</dl></section>'
      + '<section class="detail-section"><div class="detail-section-title">关联运输</div><dl class="ac-kv">' + kv('任务单号', '<a class="link" href="javascript:void(0)" onclick="acOpenTask(\'' + esc(event.taskId) + '\')">' + esc(event.taskId || '—') + '</a>') + kv('线路', esc(event.route || '—')) + kv('货物', esc(event.cargo || '—')) + kv('项目', esc(event.projectName)) + '</dl></section>'
      + '<section class="detail-section"><div class="detail-section-title">告警信息</div><dl class="ac-kv">' + alertInfo + '</dl></section>'
      + (parking ? '<section class="detail-section ac-judge"><div class="detail-section-title">异常判定</div><ol class="ac-judge-list">' + (event.facts || []).map(function (fact) { return '<li>' + esc(fact) + '</li>'; }).join('') + '</ol></section>' : '')
      + '<section class="detail-section"><div class="detail-section-title">业务证据</div><dl class="ac-kv">' + evidenceHtml(event) + '</dl>' + (parking ? '<p class="ac-mock-hint">作业场景、车速与时长为前端 mock 信号，未接入真实回传。</p>' : '<div class="ac-facts"><b>监控事实</b>' + (event.facts || []).map(function (fact) { return '<span>' + esc(fact) + '</span>'; }).join('') + '</div>') + '</section>'
      + (event.handlingResult ? '<section class="detail-section"><div class="detail-section-title">处理结果</div><dl class="ac-kv">' + kv('处理方式', esc(event.handlingType)) + (parking && event.parkingReason ? kv('停车原因', esc(event.parkingReason)) : '') + kv('处理人', esc(event.handlerName)) + kv('处理时间', esc(event.handledAt)) + kv('处理结果', esc(event.handlingResult)) + '</dl></section>' : '')
      + '<section class="detail-section"><div class="detail-section-title">告警时间线</div><ol class="ac-timeline">' + timelineHtml(event) + '</ol></section></div>'
      + '<footer class="ac-drawer-footer"><button class="btn btn-default" type="button" onclick="acCloseDrawer()">关闭</button>' + (event.eventStatus === '发生中' && event.handleStatus !== '已处理' ? '<button class="btn btn-primary" type="button" onclick="acHandle(\'' + esc(event.id) + '\')">处理告警</button>' : '') + '</footer>';
    mountDrawer(html, 'detail');
    drawerEventId = id;
  }
  function handleDrawer(id) {
    var event = store().getEvent(id);
    if (!event) return;
    var parking = event.ruleCode === 'TRANSPORT_PARKING';
    var types = parking ? ['已联系司机', '已通知车队', '现场处理中', '无需处理', '误报', '其他'] : ['联系司机', '联系现场', '调整任务', '安排充电', '车辆检修', '补传资料', '无需处理', '其他'];
    var reasons = ['装货等待', '卸货等待', '排队/过磅', '充电', '司机休息', '道路拥堵', '车辆故障', '交通事故', '临时停车', '数据异常', '其他'];
    var html = '<header class="ac-drawer-header"><div><small>' + esc(event.id) + '</small><h2>处理告警</h2></div><button type="button" onclick="acCloseDrawer()" aria-label="关闭">×</button></header>'
      + '<div class="ac-drawer-body"><div class="ac-handle-context"><strong>' + esc(event.type) + '</strong><span>' + esc(event.plate + ' · ' + event.driverName + ' · ' + (event.taskId || '无任务单')) + '</span><p>' + esc((event.facts || [])[0] || '') + '</p></div>'
      + '<section class="detail-section"><div class="detail-section-title">处理信息</div><div class="form-grid">'
      + '<div class="form-item"><label class="form-label">处理方式 <span class="req">*</span></label><select class="form-control-text" id="acHandlingType"><option value="">请选择</option>' + types.map(function (type) { return option(type, type, false); }).join('') + '</select></div>'
      + (parking ? '<div class="form-item"><label class="form-label">停车原因 <span class="req">*</span></label><select class="form-control-text" id="acParkingReason"><option value="">请选择</option>' + reasons.map(function (reason) { return option(reason, reason, false); }).join('') + '</select></div>' : '')
      + '<div class="form-item"><label class="form-label">处理结果 <span class="req">*</span></label><textarea class="form-control-text ac-result" id="acHandlingResult" maxlength="300" placeholder="请说明核实情况、采取的措施和后续安排"></textarea></div>'
      + '<div class="ac-handler-meta"><span>处理人：' + esc(store().operator) + '</span><span>提交时记录处理时间</span></div></div></section>'
      + '<div class="alert alert-info">人工标记已处理不会改变客观事件状态；若异常仍存在，事件状态仍为“发生中”。</div></div>'
      + '<footer class="ac-drawer-footer"><button class="btn btn-default" type="button" onclick="acCloseDrawer()">取消</button><button class="btn btn-primary" type="button" onclick="acSubmitHandle()">标记已处理</button></footer>';
    mountDrawer(html, 'handle');
    drawerEventId = id;
  }
  function exportCsv() {
    var type = currentType();
    var state = currentState();
    var rows = filterEvents(typeEvents(events(), type.code), state.filters, type, state.activeMetric);
    var headers = type.columns.filter(function (column) { return column.key !== 'actions'; }).map(function (column) { return column.label; });
    function csv(value) { return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"'; }
    function plain(event, key, index) {
      var html = cellValue(event, key, index);
      return String(html).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    }
    var content = [headers.map(csv).join(',')].concat(rows.map(function (event, index) {
      return type.columns.filter(function (column) { return column.key !== 'actions'; }).map(function (column) { return csv(plain(event, column.key, index)); }).join(',');
    })).join('\n');
    var link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' }));
    link.download = type.name + '_' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    toast('已导出当前筛选结果');
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
    var enabledLevels = levels.filter(function (level) { return level.enabled; });
    if (!enabledLevels.length) return '请至少启用一个预警等级';
    var fieldName = item.code === 'VEHICLE_OVERSPEED' ? 'speedThreshold' : item.code === 'DRIVER_FATIGUE' ? 'thresholdMinutes' : 'threshold';
    var values = enabledLevels.map(function (level) { return Number(level[fieldName]); });
    if (values.some(function (value) { return !isFinite(value) || value <= 0; })) return '请填写已启用等级的有效阈值';
    if (values.filter(function (value, index) { return values.indexOf(value) !== index; }).length) return '禁止保存重复阈值';
    for (var index = 1; index < values.length; index += 1) {
      var ordered = item.code === 'VEHICLE_LOW_SOC' ? values[index - 1] > values[index] : values[index - 1] < values[index];
      if (!ordered) return enabledLevels[index].level + '等级' + (item.code === 'VEHICLE_LOW_SOC' ? ' SOC 阈值必须低于' : '阈值必须高于') + enabledLevels[index - 1].level + '等级';
    }
    if (item.code === 'VEHICLE_OVERSPEED' && enabledLevels.some(function (level) { return !Number.isInteger(level.durationSeconds) || level.durationSeconds < 60 || level.durationSeconds > 7200; })) return '各已启用等级的持续时间应为 1 到 120 分钟';
    if (item.code === 'DRIVER_FATIGUE' && enabledLevels.some(function (level) { return level.thresholdMinutes < 60 || level.thresholdMinutes > 1440; })) return '已启用等级的连续驾驶时长应为 1 到 24 小时';
    return '';
  }
  function checkedValues(name) {
    return Array.prototype.map.call(document.querySelectorAll('input[name="' + name + '"]:checked'), function (input) { return input.value; });
  }
  function readInteger(id, min, max, label) {
    var raw = String(((document.getElementById(id) || {}).value || '')).trim();
    if (!/^-?\d+$/.test(raw)) return { error: label + '必须为整数' };
    var value = Number(raw);
    if (value < min || value > max) return { error: label + '应为 ' + min + ' 到 ' + max };
    return { value: value };
  }
  function parkingFormFingerprint() {
    if (!document.getElementById('wrName')) return '';
    return JSON.stringify({
      name: ((document.getElementById('wrName') || {}).value || '').trim(),
      enabled: (document.getElementById('wrEnabled') || {}).value || '启用',
      monitorPeriod: (document.getElementById('wrMonitorPeriod') || {}).value || '全天',
      monitorStart: (document.getElementById('wrMonitorStart') || {}).value || '',
      monitorEnd: (document.getElementById('wrMonitorEnd') || {}).value || '',
      stillSpeed: (document.getElementById('wrStillSpeed') || {}).value || '',
      minStill: (document.getElementById('wrMinStill') || {}).value || '',
      recoverSpeed: (document.getElementById('wrRecoverSpeed') || {}).value || '',
      recoverHold: (document.getElementById('wrRecoverHold') || {}).value || '',
      excludeLoading: !!(document.getElementById('wrExcludeLoading') || {}).checked,
      excludeUnloading: !!(document.getElementById('wrExcludeUnloading') || {}).checked,
      excludeCharging: !!(document.getElementById('wrExcludeCharging') || {}).checked,
      endOnTask: !!(document.getElementById('wrEndOnTask') || {}).checked,
      scope: (document.getElementById('wrScope') || {}).value || '',
      projectIds: checkedValues('wrProjectIds'),
      vehiclePlates: checkedValues('wrVehiclePlates'),
      levels: readLevels({ code: 'TRANSPORT_PARKING' })
    });
  }
  function openParkingModal(mode, rule) {
    closeParkingModal(true);
    currentState().parkingModal = { mode: mode, rule: rule, baseline: '' };
    var host = document.createElement('div');
    host.id = 'acParkingModalHost';
    host.className = 'modal-overlay show ac-parking-modal-host';
    host.innerHTML = parkingModalHtml(rule, mode);
    host.addEventListener('click', function (event) { if (event.target === host) window.acCloseParkingModal(); });
    document.body.appendChild(host);
    currentState().parkingModal.baseline = parkingFormFingerprint();
    window.acParkingCount();
  }
  function closeParkingModal(force) {
    if (!document.getElementById('acParkingModalHost')) {
      currentState().parkingModal = null;
      return true;
    }
    if (!force && currentState().parkingModal && parkingFormFingerprint() !== currentState().parkingModal.baseline) {
      if (!window.confirm('当前修改尚未保存，确定关闭？')) return false;
    }
    var host = document.getElementById('acParkingModalHost');
    if (host) host.remove();
    currentState().parkingModal = null;
    return true;
  }
  function saveParkingRule() {
    var modal = currentState().parkingModal;
    if (!modal || !modal.rule) return;
    var item = modal.rule;
    var name = ((document.getElementById('wrName') || {}).value || '').trim();
    if (!name) { toast('请填写规则名称'); return; }
    if (name.length > 40) { toast('规则名称最多 40 字'); return; }
    var enabled = ((document.getElementById('wrEnabled') || {}).value || '启用') === '启用';
    var monitorPeriod = (document.getElementById('wrMonitorPeriod') || {}).value || '全天';
    var monitorStart = (document.getElementById('wrMonitorStart') || {}).value || '06:00';
    var monitorEnd = (document.getElementById('wrMonitorEnd') || {}).value || '23:00';
    if (monitorPeriod === '自定义' && (!monitorStart || !monitorEnd)) { toast('请填写自定义监控时段'); return; }
    var stillSpeed = Number((document.getElementById('wrStillSpeed') || {}).value);
    if (!isFinite(stillSpeed) || stillSpeed < 0 || stillSpeed > 20) { toast('静止速度阈值应为 0 到 20 km/h'); return; }
    var minStill = readInteger('wrMinStill', 1, 120, '最小持续静止时间');
    if (minStill.error) { toast(minStill.error); return; }
    var recoverSpeed = Number((document.getElementById('wrRecoverSpeed') || {}).value);
    if (!isFinite(recoverSpeed) || recoverSpeed <= stillSpeed) { toast('恢复速度阈值必须高于静止速度阈值'); return; }
    var recoverHold = readInteger('wrRecoverHold', 1, 60, '恢复持续时间');
    if (recoverHold.error) { toast(recoverHold.error); return; }
    var levels = readLevels(item);
    var error = validateLevels(item, levels);
    if (error) { toast(error); return; }
    var scope = (document.getElementById('wrScope') || {}).value || '全部项目';
    var projectIds = scope === '指定项目' ? checkedValues('wrProjectIds') : [];
    var vehiclePlates = scope === '指定车辆' ? checkedValues('wrVehiclePlates') : [];
    if (scope === '指定项目' && !projectIds.length) { toast('请选择至少一个指定项目'); return; }
    if (scope === '指定车辆' && !vehiclePlates.length) { toast('请选择至少一辆指定车辆'); return; }
    var projects = (store().getProjects ? store().getProjects() : []).filter(function (project) { return projectIds.indexOf(project.id) >= 0; });
    var patch = {
      name: name, enabled: enabled, monitorPeriod: monitorPeriod, monitorStart: monitorStart, monitorEnd: monitorEnd,
      levels: levels, scopeType: scope, projectIds: projectIds,
      projectNames: projects.map(function (project) { return project.name; }), vehiclePlates: vehiclePlates,
      detectConfig: {
        stillSpeedKph: stillSpeed, minStillMinutes: minStill.value,
        excludeLoading: !!(document.getElementById('wrExcludeLoading') || {}).checked,
        excludeUnloading: !!(document.getElementById('wrExcludeUnloading') || {}).checked,
        excludeCharging: !!(document.getElementById('wrExcludeCharging') || {}).checked
      },
      recoveryConfig: { recoverSpeedKph: recoverSpeed, recoverDurationMinutes: recoverHold.value, endOnTaskComplete: !!(document.getElementById('wrEndOnTask') || {}).checked }
    };
    var saved = modal.mode === 'create' ? store().addParkingRule(patch) : store().updateRule(item.id, patch);
    if (saved && saved.error) { toast(saved.error); return; }
    closeParkingModal(true);
    rerender();
    toast('保存成功');
  }
  function saveRule() {
    var type = currentType();
    if (type.code === 'TRANSPORT_PARKING') { saveParkingRule(); return; }
    var item = ruleOf(type.code);
    if (!item) return;
    var levels = readLevels(item);
    var error = validateLevels(item, levels);
    if (error) { toast(error); return; }
    var scope = (document.getElementById('wrScope') || {}).value || '全部项目';
    var recoveryConfig = {};
    var patch = { levels: levels, recoveryConfig: recoveryConfig, scopeType: scope, enabled: item.enabled };
    if (item.code === 'DRIVER_FATIGUE') {
      var rest = Number((document.getElementById('wrRestMinutes') || {}).value);
      if (!Number.isInteger(rest) || rest < 10 || rest > 120) { toast('有效休息时长应为 10 到 120 分钟'); return; }
      recoveryConfig.restThresholdMinutes = rest;
    }
    var saved = store().updateRule(item.id, patch);
    if (saved && saved.error) { toast(saved.error); return; }
    rerender();
    toast('多级预警规则已保存');
  }
  function toggleRule(id) {
    var type = currentType();
    var item = id ? store().getRule(id) : ruleOf(type.code);
    if (!item) return;
    if (item.enabled && !window.confirm('停用后系统将不再根据该规则产生新的告警，已产生的告警继续使用原规则快照。')) return;
    var patch = { enabled: !item.enabled, levels: item.levels, recoveryConfig: item.recoveryConfig, scopeType: item.scopeType };
    if (item.code === 'TRANSPORT_PARKING') {
      patch.projectIds = item.projectIds;
      patch.projectNames = item.projectNames;
      patch.vehiclePlates = item.vehiclePlates;
    }
    var saved = store().updateRule(item.id, patch);
    if (saved && saved.error) { toast(saved.error); return; }
    rerender();
    toast(item.enabled ? '规则已停用' : '规则已启用');
  }
  function bindPage(page) {
    window.app.register(page, render, [page]);
    window.app.pages[page].onRender = function () {
      var main = document.querySelector('.main');
      if (main && savedMainScroll) main.scrollTop = savedMainScroll;
      var group = document.querySelector('.nav-group[data-group="alert-center"]');
      if (group) group.classList.add('open');
    };
  }

  window.acTab = function (tab) { if (!closeParkingModal()) return; currentState().tab = tab === 'rules' ? 'rules' : 'list'; closeDrawer(); rerender(); };
  window.acApply = function () { readFilters(); currentState().activeMetric = ''; rerender(); };
  window.acReset = function () { var state = currentState(); state.filters = blankFilters(); state.activeMetric = ''; rerender(); };
  window.acStatus = function (status) { currentState().filters.eventStatus = status; currentState().activeMetric = ''; rerender(); };
  window.acMetric = function (key) {
    var state = currentState();
    state.activeMetric = state.activeMetric === key ? '' : key;
    if (state.activeMetric) state.filters.eventStatus = '发生中';
    rerender();
  };
  window.acRefresh = function () { store().refresh(); rerender(); toast('告警数据已刷新'); };
  window.acView = detailDrawer;
  window.acCloseDrawer = closeDrawer;
  window.acAck = function (id) { store().acknowledge(id); rerender(); toast('已知悉告警，处理状态已更新为处理中'); };
  window.acHandle = handleDrawer;
  window.acSubmitHandle = function () {
    var type = ((document.getElementById('acHandlingType') || {}).value || '').trim();
    var result = ((document.getElementById('acHandlingResult') || {}).value || '').trim();
    var reasonEl = document.getElementById('acParkingReason');
    var parkingReason = reasonEl ? String(reasonEl.value || '').trim() : '';
    if (!type) { toast('请选择处理方式'); return; }
    if (reasonEl && !parkingReason) { toast('请选择停车原因'); return; }
    if (!result) { toast('请填写处理结果'); return; }
    store().handle(drawerEventId, type, result, parkingReason ? { parkingReason: parkingReason } : {});
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
  window.acSaveRule = saveRule;
  window.acSaveParkingRule = saveParkingRule;
  window.acToggleRule = toggleRule;
  window.acRuleApply = function () {
    var filters = currentState().parkingRuleFilters;
    filters.name = ((document.getElementById('acRuleName') || {}).value || '').trim();
    filters.scopeType = (document.getElementById('acRuleScope') || {}).value || '';
    filters.status = (document.getElementById('acRuleStatus') || {}).value || '';
    rerender();
  };
  window.acRuleReset = function () {
    currentState().parkingRuleFilters = { name: '', scopeType: '', status: '' };
    rerender();
  };
  window.acAddParkingRule = function () {
    openParkingModal('create', store().getParkingDraftTemplate());
  };
  window.acEditParkingRule = function (id) {
    var rule = store().getRule(id);
    if (!rule) { toast('未找到规则'); return; }
    openParkingModal('edit', rule);
  };
  window.acCloseParkingModal = function () { closeParkingModal(false); };
  window.acRemoveParkingRule = function (id) {
    if (!window.confirm('删除后该规则不再用于新的停车预警，已产生告警不受影响。确定删除？')) return;
    var result = store().removeRule(id);
    if (result && result.error) { toast(result.error); return; }
    rerender();
    toast('规则已删除');
  };
  window.acMonitorPeriodChange = function () {
    var row = document.getElementById('wrMonitorRange');
    var period = document.getElementById('wrMonitorPeriod');
    if (row && period) row.hidden = period.value !== '自定义';
  };
  window.acFilterVehicles = function () {
    var q = ((document.getElementById('wrVehicleQuery') || {}).value || '').trim().toLowerCase();
    Array.prototype.forEach.call(document.querySelectorAll('.ac-vehicle-option'), function (row) {
      row.hidden = !!(q && String(row.getAttribute('data-plate') || '').toLowerCase().indexOf(q) < 0);
    });
  };
  window.acParkingCount = function () {
    var projectCount = document.getElementById('wrProjectCount');
    var vehicleCount = document.getElementById('wrVehicleCount');
    if (projectCount) projectCount.textContent = '已选择 ' + checkedValues('wrProjectIds').length + ' 个项目';
    if (vehicleCount) vehicleCount.textContent = '已选择 ' + checkedValues('wrVehiclePlates').length + ' 辆';
  };
  window.acScopeChange = function () {
    var project = document.getElementById('wrProject');
    var scope = document.getElementById('wrScope');
    var projectBox = document.getElementById('wrProjectBox');
    var vehicleBox = document.getElementById('wrVehicleBox');
    if (project && scope) project.disabled = scope.value !== '指定项目';
    if (projectBox) projectBox.hidden = !scope || scope.value !== '指定项目';
    if (vehicleBox) vehicleBox.hidden = !scope || scope.value !== '指定车辆';
    window.acParkingCount();
  };
  window.addEventListener('hashchange', function () { closeParkingModal(true); closeDrawer(); });

  if (!window.app) return;
  TYPES.forEach(function (type) { bindPage(type.page); });
  window.app.register('alert-center', render, ['alert-parking']);
  window.app.register('warning-rule-management', function () {
    window.setTimeout(function () { window.__acPreferTab = 'rules'; window.app.navigate('alert-parking'); }, 0);
    return '';
  }, ['alert-parking']);
  window.setTimeout(function () {
    var page = window.location.hash.replace('#', '');
    if (page === 'alert-records' || page === 'alert-center') window.app.navigate('alert-parking');
    else if (page === 'warning-rule-management') { window.__acPreferTab = 'rules'; window.app.navigate('alert-parking'); }
  }, 0);
})();
