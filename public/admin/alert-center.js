/* 告警中心：六类事件分页，页内 Tab 切换列表与规则配置。 */
(function () {
  'use strict';

  var LEVEL_NAMES = ['一般', '严重', '紧急'];
  function listColumns(orgLabel, extras) {
    return [
      { key: 'index', label: '序号' }, { key: 'level', label: '告警等级' },
      { key: 'eventStatus', label: '事件状态' }, { key: 'handleStatus', label: '处理状态' },
      { key: 'plate', label: '车牌号' }, { key: 'driverName', label: '司机' },
      { key: 'projectName', label: orgLabel }
    ].concat(extras || []).concat([
      { key: 'taskId', label: '关联任务单' }, { key: 'actions', label: '操作' }
    ]);
  }
  var TYPES = [
    {
      page: 'alert-parking', code: 'TRANSPORT_PARKING', name: '停车预警',
      summary: '运输任务执行中识别持续静止，排除装卸与充电后按分级时长触发。',
      extraLabel: '', extraPlaceholder: '',
      columns: listColumns('所属部门', [
        { key: 'parkingDuration', label: '停车时长' }, { key: 'location', label: '当前/停车位置' },
        { key: 'parkingStartedAt', label: '停车开始时间' }, { key: 'triggeredAt', label: '告警时间' },
        { key: 'parkingEndedAt', label: '停车结束时间' }
      ])
    },
    {
      page: 'alert-parking-area', code: 'AREA_STAY_TIMEOUT', name: '区域停留预警',
      summary: '车辆进入电子围栏后持续未离开，按区域停留时长分级升级，离开围栏后自动恢复。',
      extraLabel: '围栏名称', extraPlaceholder: '围栏名称',
      columns: listColumns('所属项目', [
        { key: 'stayDuration', label: '当前停留时长' }, { key: 'transportStage', label: '当前运输阶段' },
        { key: 'fenceName', label: '围栏名称' }, { key: 'fenceType', label: '围栏类型' },
        { key: 'enteredAt', label: '进入围栏时间' }
      ])
    },
    {
      page: 'alert-overspeed', code: 'VEHICLE_OVERSPEED', name: '车速预警',
      summary: '同一段连续超速只保留一条告警，等级只升不降；车速回到恢复阈值并持续满足后自动恢复。',
      extraLabel: '', extraPlaceholder: '',
      columns: [
        { key: 'index', label: '序号' }, { key: 'level', label: '告警等级' },
        { key: 'plate', label: '车牌号' }, { key: 'driverName', label: '司机' },
        { key: 'speed', label: '当前车速' }, { key: 'maxSpeed', label: '最高车速' },
        { key: 'triggerRule', label: '触发阈值' }, { key: 'overspeedDuration', label: '连续超速时长' },
        { key: 'speedState', label: '当前状态' }, { key: 'location', label: '当前地点' },
        { key: 'projectName', label: '所属项目' }, { key: 'taskId', label: '关联任务单' },
        { key: 'overspeedStartedAt', label: '超速开始时间' }, { key: 'handleStatus', label: '处置状态' },
        { key: 'actions', label: '操作' }
      ]
    },
    {
      page: 'alert-weighbill', code: 'UNLOAD_WEIGHBILL_MISSING', name: '卸货后未上传磅单',
      summary: '离开卸货地且磅单未上传，等待时间达到分级阈值时触发。',
      extraLabel: '卸货地', extraPlaceholder: '卸货区域 / 地点',
      columns: listColumns('所属项目', [
        { key: 'waitingMinutes', label: '已等待时长' }, { key: 'weighbillStatus', label: '磅单状态' },
        { key: 'unloadLocation', label: '卸货地' }, { key: 'unloadDepartedAt', label: '离开卸货地时间' }
      ])
    },
    {
      page: 'alert-soc', code: 'VEHICLE_LOW_SOC', name: 'SOC预警',
      summary: '车辆 SOC 降至分级阈值时触发，数值越低风险越高。',
      extraLabel: '', extraPlaceholder: '',
      columns: listColumns('所属项目', [
        { key: 'soc', label: '当前SOC' }, { key: 'location', label: '当前位置' }
      ])
    },
    {
      page: 'alert-fatigue', code: 'DRIVER_FATIGUE', name: '疲劳驾驶预警',
      summary: '根据车辆运行行为、当前绑定司机和连续驾驶周期计算疲劳风险。',
      extraLabel: '', extraPlaceholder: '',
      columns: listColumns('所属项目', [
        { key: 'continuousDriving', label: '连续驾驶时长' }, { key: 'currentSpeed', label: '当前车速' },
        { key: 'drivingStartedAt', label: '驾驶开始时间' }, { key: 'restThreshold', label: '有效休息' }
      ])
    }
  ];
  var pageState = {};
  var drawerEventId = '';
  var drawerMode = '';
  var savedMainScroll = 0;

  function isParkingType(type) { return !!(type && type.code === 'TRANSPORT_PARKING'); }
  function isAreaStayType(type) { return !!(type && (type.code === 'AREA_STAY_TIMEOUT' || type.code === 'PARKING_AREA')); }
  function isSpeedType(type) { return !!(type && type.code === 'VEHICLE_OVERSPEED'); }
  function typeByPage(page) { return TYPES.filter(function (item) { return item.page === page; })[0] || null; }
  function isAreaStayEvent(event) { return !!(event && (event.ruleCode === 'AREA_STAY_TIMEOUT' || event.ruleCode === 'PARKING_AREA' || event.alertType === 'AREA_STAY_TIMEOUT')); }
  function stillAbnormal(event) { return isParkingType({ code: event.ruleCode }) ? !event.recoveredAt : event.eventStatus === '发生中'; }
  function blankFilters(type) {
    var filters = {
      project: '', level: '', handleStatus: '',
      keyword: '', extra: '', start: '', end: '', eventStatus: isSpeedType(type) ? '' : '发生中'
    };
    if (isAreaStayType(type)) filters.fenceType = '';
    if (isSpeedType(type)) {
      filters.speedView = '';
      filters.stillOverspeed = '';
    }
    return filters;
  }
  function pageOf(page) {
    var type = typeByPage(page);
    if (!pageState[page]) pageState[page] = { tab: 'list', filters: blankFilters(type || { code: page }), activeMetric: '', parkingRuleFilters: { name: '', scopeType: '', status: '' }, parkingModal: null, areaStayRuleFilters: { name: '', scopeType: '', status: '' }, areaStayModal: null, speedRuleFilters: { name: '', scopeType: '', status: '' }, speedModal: null };
    if (!pageState[page].parkingRuleFilters) pageState[page].parkingRuleFilters = { name: '', scopeType: '', status: '' };
    if (!pageState[page].areaStayRuleFilters) pageState[page].areaStayRuleFilters = { name: '', scopeType: '', status: '' };
    if (!pageState[page].speedRuleFilters) pageState[page].speedRuleFilters = { name: '', scopeType: '', status: '' };
    if (pageState[page].filters && pageState[page].filters.eventStatus == null && !isSpeedType(type)) pageState[page].filters.eventStatus = '发生中';
    if (isSpeedType(type) && pageState[page].filters && pageState[page].filters.speedView == null) pageState[page].filters.speedView = '';
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
  function eventBadge(status) { return status === '发生中' || status === '超速中' ? badge(status, 'error') : badge(status, 'success'); }
  function handleBadge(status) {
    if (status === '待处理') return badge(status, 'warning');
    if (status === '处理中') return badge(status, 'primary');
    return badge(status, 'success');
  }
  function todayStamp() {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  }
  function isTodayStamp(value) { return String(value || '').slice(0, 10) === todayStamp(); }
  function uiSpeed(value) {
    var number = Number(value);
    if (!isFinite(number)) return '—';
    var rounded = Math.round(number * 10) / 10;
    var text = Math.abs(rounded - Math.round(rounded)) < 0.05 ? String(Math.round(rounded)) : String(rounded);
    return text + ' km/h';
  }
  function speedDurationLabel(seconds) {
    var total = Math.max(0, Math.round(Number(seconds) || 0));
    if (!isFinite(Number(seconds))) return '—';
    if (total < 120) return total + '秒';
    var minutes = Math.floor(total / 60);
    var remain = total % 60;
    if (minutes < 60) return remain ? (minutes + '分' + remain + '秒') : (minutes + '分钟');
    var hours = Math.floor(minutes / 60);
    var minuteRemain = minutes % 60;
    return minuteRemain ? (hours + '小时' + minuteRemain + '分钟') : (hours + '小时');
  }
  function speedStartAt(event) {
    return event.overspeedStartedAt || (event.metrics || {}).overspeedStartedAt || '';
  }
  function speedSeconds(event) {
    var start = speedStartAt(event);
    var end = event.eventStatus === '已恢复' ? (event.recoveredAt || (event.metrics || {}).recoveredAt) : '';
    if (start) {
      var from = new Date(String(start).replace(/-/g, '/')).getTime();
      var to = end ? new Date(String(end).replace(/-/g, '/')).getTime() : Date.now();
      if (isFinite(from) && isFinite(to)) return Math.max(0, Math.round((to - from) / 1000));
    }
    return (event.metrics || {}).overspeedDurationSeconds;
  }
  function speedLevelConfig(event) {
    var levels = ((event.ruleSnapshot || {}).levels) || [];
    return levels.filter(function (item) { return item.level === (event.maxAlertLevel || event.level); })[0] || null;
  }
  function speedSentence(event) {
    var current = speedLevelConfig(event);
    if (!current || current.speedThreshold == null) return '—';
    return '≥' + current.speedThreshold + ' km/h 持续' + speedDurationLabel(current.durationSeconds);
  }
  function speedSlash(event) {
    var current = speedLevelConfig(event);
    if (!current || current.speedThreshold == null) return '—';
    return '≥' + current.speedThreshold + ' km/h / ' + speedDurationLabel(current.durationSeconds);
  }
  function speedSourceText(code) {
    if (code === 'GPS') return 'GPS 速度';
    if (code === 'CAN') return '车辆 CAN/T-BOX';
    return '—';
  }
  function speedPolicyText(code) {
    if (code === 'CAN') return '车辆 CAN/T-BOX 速度';
    if (code === 'GPS') return 'GPS 速度';
    return '优先车辆 CAN/T-BOX，缺失时使用 GPS';
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
      if (event.ruleCode === 'VEHICLE_OVERSPEED') return speedSentence(event);
      if (event.ruleCode === 'DRIVER_FATIGUE') return '连续驾驶 ≥ ' + formatHours(current.thresholdMinutes) + '小时';
      if (event.ruleCode === 'VEHICLE_LOW_SOC') return 'SOC ≤ ' + current.threshold + '%';
      if (isAreaStayEvent(event) || event.ruleCode === 'AREA_STAY_TIMEOUT') return '区域停留 ≥ ' + current.threshold + '分钟';
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
  function stampMinutes(start, end) {
    var a = new Date(String(start || '').replace(/-/g, '/')).getTime();
    var b = new Date(String(end || '').replace(/-/g, '/')).getTime();
    if (!isFinite(a) || !isFinite(b)) return null;
    return Math.max(0, Math.round((b - a) / 60000));
  }
  function parkingStartAt(event) {
    var metrics = event.metrics || {};
    return metrics.parkingStartedAt || metrics.staticCandidateStartAt || metrics.staticStartTime || '';
  }
  function parkingDurationText(event) {
    var start = parkingStartAt(event);
    if (start && event.recoveredAt) {
      var closed = stampMinutes(start, event.recoveredAt);
      if (closed != null && closed > 0) return metricText(closed);
    }
    return metricText((event.metrics || {}).parkingMinutes);
  }
  function areaStayDurationText(event) {
    if (event.eventStatus === '已恢复' || event.leaveTime || event.recoveredAt) {
      if (event.finalStayDuration != null) return metricText(event.finalStayDuration);
      var closed = stampMinutes(event.enterTime || (event.metrics || {}).enteredAt, event.leaveTime || event.recoveredAt);
      if (closed != null) return metricText(closed);
    }
    if (event.currentStayDuration != null) return metricText(event.currentStayDuration);
    return metricText((event.metrics || {}).areaDwellMinutes);
  }
  function cellValue(event, key, index) {
    var metrics = event.metrics || {};
    var snap = event.ruleSnapshot || {};
    switch (key) {
      case 'index': return String(index + 1);
      case 'level': return levelBadge(event.ruleCode === 'VEHICLE_OVERSPEED' ? (event.maxAlertLevel || event.level) : event.level);
      case 'eventStatus': return eventBadge(event.eventStatus || (event.recoveredAt ? '已恢复' : '发生中'));
      case 'handleStatus': return handleBadge(event.handleStatus);
      case 'projectName': return esc((event.ruleCode === 'TRANSPORT_PARKING' ? (event.departmentName || event.projectName) : event.projectName) || '—');
      case 'plate': return esc(event.plate);
      case 'driverName': return esc(event.driverName);
      case 'location': return esc(event.location || '—');
      case 'taskId':
        if (!event.taskId) return '—';
        return '<a class="link col-mono" href="javascript:void(0)" onclick="acOpenTask(\'' + esc(event.taskId) + '\')">' + esc(event.taskId) + '</a>';
      case 'parkingMinutes':
      case 'parkingDuration': return esc(parkingDurationText(event));
      case 'parkingStartedAt': return esc(parkingStartAt(event) || '—');
      case 'speed': return esc(event.ruleCode === 'VEHICLE_OVERSPEED' ? uiSpeed(metrics.speed) : (metrics.speed == null ? '—' : metrics.speed + ' km/h'));
      case 'maxSpeed': return esc(uiSpeed(event.maxSpeed != null ? event.maxSpeed : metrics.maxSpeed));
      case 'triggerRule': return esc(speedSlash(event));
      case 'speedState': return eventBadge(event.eventStatus === '发生中' ? '超速中' : '已恢复') + (event.falsePositive ? '<span class="ac-false-tag">误报</span>' : '');
      case 'parkingEndedAt': return esc(event.recoveredAt || '—');
      case 'triggeredAt': return esc(event.triggeredAt || '—');
      case 'areaDwellMinutes':
      case 'stayDuration': return esc(areaStayDurationText(event));
      case 'fenceName': return esc(event.fenceName || metrics.fenceName || event.location || '—');
      case 'fenceType': return esc(event.fenceType || metrics.fenceType || '—');
      case 'transportStage': return esc(event.transportStage || '—');
      case 'enteredAt': return esc(event.enterTime || metrics.enteredAt || '—');
      case 'overspeedDuration': return esc(speedDurationLabel(speedSeconds(event)));
      case 'overspeedStartedAt': return esc(speedStartAt(event) || '—');
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
    if (isAreaStayType(type)) return String(event.fenceName || metrics.fenceName || event.location || '').toLowerCase().indexOf(q) >= 0;
    if (type.code === 'UNLOAD_WEIGHBILL_MISSING') return String(metrics.unloadLocation || event.location || '').toLowerCase().indexOf(q) >= 0;
    return true;
  }
  function typeEvents(all, code) {
    if (code === 'AREA_STAY_TIMEOUT' || code === 'PARKING_AREA') {
      return all.filter(function (item) { return item.ruleCode === 'AREA_STAY_TIMEOUT' || item.ruleCode === 'PARKING_AREA'; });
    }
    return all.filter(function (item) { return item.ruleCode === code; });
  }
  function filterEvents(list, filters, type, activeMetric) {
    var q = filters.keyword.trim().toLowerCase();
    return list.filter(function (item) {
      if (filters.project) {
        if (isParkingType(type)) {
          var dept = item.departmentName || item.projectName;
          var under = orgTreeNamesUnder(filters.project);
          if (under.indexOf(dept) < 0 && dept !== filters.project) return false;
        } else if (item.projectName !== filters.project) return false;
      }
      if (filters.level && item.level !== filters.level) return false;
      if (filters.eventStatus && item.eventStatus !== filters.eventStatus) return false;
      if (filters.handleStatus && item.handleStatus !== filters.handleStatus) return false;
      if (filters.fenceType && (item.fenceType || (item.metrics || {}).fenceType) !== filters.fenceType) return false;
      var timeKey = isSpeedType(type) ? (speedStartAt(item) || item.triggeredAt) : item.triggeredAt;
      if (filters.start && String(timeKey).slice(0, 10) < filters.start) return false;
      if (filters.end && String(timeKey).slice(0, 10) > filters.end) return false;
      if (q && [item.plate, item.driverName, item.taskId, item.id].join(' ').toLowerCase().indexOf(q) < 0) return false;
      if (!extraMatch(item, type, filters.extra.trim())) return false;
      if (isSpeedType(type)) {
        if (filters.speedView === '超速中' && item.eventStatus !== '发生中') return false;
        if (filters.speedView === '待处理' && item.handleStatus !== '待处理') return false;
        if (filters.speedView === '已处理' && item.handleStatus !== '已处理') return false;
        if (filters.stillOverspeed === '是' && item.eventStatus !== '发生中') return false;
        if (filters.stillOverspeed === '否' && item.eventStatus === '发生中') return false;
        if (activeMetric && item.falsePositive) return false;
        if (activeMetric === '当前超速车辆' && item.eventStatus !== '发生中') return false;
        if (activeMetric === '今日车速预警' && !isTodayStamp(item.alertCreatedAt || item.triggeredAt)) return false;
        if (activeMetric === '今日紧急预警' && !isTodayStamp(item.criticalAt)) return false;
        if (activeMetric === '待处理' && item.handleStatus !== '待处理') return false;
      } else if (activeMetric === '待处理') {
        if (item.handleStatus !== '待处理') return false;
      } else if (activeMetric && !(item.eventStatus === '发生中' && item.level === activeMetric)) return false;
      return true;
    }).sort(function (a, b) {
      if (isSpeedType(type)) return String(speedStartAt(b) || b.triggeredAt).localeCompare(String(speedStartAt(a) || a.triggeredAt));
      return String(b.triggeredAt).localeCompare(String(a.triggeredAt));
    });
  }
  function metricHtml(key, label, value, copy, tone, active) {
    return '<button type="button" class="ac-metric ac-metric-' + tone + (active === key ? ' is-active' : '') + '" onclick="acMetric(\'' + key + '\')"><span>' + esc(label) + '</span><b>' + value + '</b><small>' + esc(copy) + '</small></button>';
  }
  function metricsHtml(list, active, type) {
    if (isSpeedType(type)) {
      var countable = list.filter(function (item) { return !item.falsePositive; });
      var plates = {};
      countable.forEach(function (item) { if (item.eventStatus === '发生中' && item.plate) plates[item.plate] = true; });
      return '<div class="ac-metrics ac-metrics-4">'
        + metricHtml('当前超速车辆', '当前超速车辆', Object.keys(plates).length, '仍在超速的车辆', 'red', active)
        + metricHtml('今日车速预警', '今日车速预警', countable.filter(function (item) { return isTodayStamp(item.alertCreatedAt || item.triggeredAt); }).length, '今日新产生的超速事件', 'blue', active)
        + metricHtml('今日紧急预警', '今日紧急预警', countable.filter(function (item) { return isTodayStamp(item.criticalAt); }).length, '今日升至紧急的事件', 'orange', active)
        + metricHtml('待处理', '待处理', countable.filter(function (item) { return item.handleStatus === '待处理'; }).length, '尚未处置', 'amber', active)
        + '</div>';
    }
    var happening = list.filter(function (item) { return item.eventStatus === '发生中'; });
    var cards = metricHtml('一般', '一般告警', happening.filter(function (item) { return item.level === '一般'; }).length, '发生中 · 一般', 'blue', active)
      + metricHtml('严重', '严重告警', happening.filter(function (item) { return item.level === '严重'; }).length, '发生中 · 严重', 'orange', active)
      + metricHtml('紧急', '紧急告警', happening.filter(function (item) { return item.level === '紧急'; }).length, '发生中 · 紧急', 'red', active);
    if (isParkingType(type)) {
      return '<div class="ac-metrics ac-metrics-4">' + cards
        + metricHtml('待处理', '待处理告警', list.filter(function (item) { return item.handleStatus === '待处理'; }).length, '待调度处理', 'amber', active)
        + '</div>';
    }
    return '<div class="ac-metrics">' + cards + '</div>';
  }
  function statusFilterHtml(list, current) {
    if (isSpeedType(currentType())) {
      var speedItems = [
        { value: '', label: '全部', count: list.length },
        { value: '超速中', label: '超速中', count: list.filter(function (item) { return item.eventStatus === '发生中'; }).length },
        { value: '待处理', label: '待处理', count: list.filter(function (item) { return item.handleStatus === '待处理'; }).length },
        { value: '已处理', label: '已处理', count: list.filter(function (item) { return item.handleStatus === '已处理'; }).length }
      ];
      var speedCurrent = currentState().filters.speedView || '';
      return '<div class="ac-status-switch" aria-label="车速预警快捷筛选">' + speedItems.map(function (item) {
        return '<button type="button" class="' + (speedCurrent === item.value ? 'is-active' : '') + '" aria-pressed="' + (speedCurrent === item.value ? 'true' : 'false') + '" onclick="acStatus(\'' + item.value + '\')"><span>' + item.label + '</span><b>' + item.count + '</b></button>';
      }).join('') + '</div>';
    }
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
  function jsStr(value) {
    return "'" + String(value == null ? '' : value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  }
  function orgTreeData() {
    if (window.AdminOrgTree && typeof window.AdminOrgTree.get === 'function') return window.AdminOrgTree.get() || [];
    return [
      { name: '云南力伏星新能源有限公司', departments: [{ name: '运营一部' }, { name: '运营二部' }, { name: '云南钦圣新能源科技有限公司' }] }
    ];
  }
  function orgTreeNamesUnder(selected) {
    if (window.AdminOrgTree && typeof window.AdminOrgTree.namesUnder === 'function') return window.AdminOrgTree.namesUnder(selected);
    var names = [];
    orgTreeData().forEach(function (org) {
      if (!selected || org.name === selected) {
        names.push(org.name);
        (org.departments || []).forEach(function (dept) { names.push(dept.name); });
      } else {
        (org.departments || []).forEach(function (dept) {
          if (dept.name === selected) names.push(dept.name);
        });
      }
    });
    return names;
  }
  function orgTreeMatches(org, dept, keyword) {
    if (!keyword) return true;
    return org.name.indexOf(keyword) >= 0 || dept.name.indexOf(keyword) >= 0;
  }
  function orgTreeListHtml(selected, keyword) {
    keyword = String(keyword || '').trim();
    var html = '<button type="button" class="cb-entity-node' + (!selected ? ' is-selected' : '') + '" onclick="acPickDept(\'\')">全部部门</button>';
    html += orgTreeData().map(function (org) {
      var depts = (org.departments || []).filter(function (dept) { return orgTreeMatches(org, dept, keyword); });
      if (keyword && !depts.length && org.name.indexOf(keyword) < 0) return '';
      if (keyword && org.name.indexOf(keyword) >= 0) depts = org.departments || [];
      var deptHtml = depts.map(function (dept) {
        return '<button type="button" class="cb-entity-node is-dept' + (dept.name === selected ? ' is-selected' : '') + '" onclick="acPickDept(' + jsStr(dept.name) + ')">' + esc(dept.name) + '</button>';
      }).join('');
      return '<div class="cb-entity-org">'
        + '<button type="button" class="cb-entity-node is-org' + (org.name === selected ? ' is-selected' : '') + '" onclick="acPickDept(' + jsStr(org.name) + ')">' + esc(org.name) + '</button>'
        + '<div class="cb-entity-depts">' + deptHtml + '</div></div>';
    }).join('');
    return html || '<div class="cb-entity-empty">没有匹配的组织或部门</div>';
  }
  function deptFilterHtml(selected) {
    return '<div class="cb-entity-field ac-org-filter" data-org-field="acProject">'
      + '<input type="hidden" id="acProject" value="' + esc(selected || '') + '">'
      + '<button type="button" class="filter-control cb-entity-trigger" data-org-trigger aria-haspopup="listbox" aria-expanded="false" onclick="acToggleDeptTree(event)">'
      + '<span data-org-label class="' + (selected ? '' : 'is-placeholder') + '">' + esc(selected || '全部部门') + '</span>'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>'
      + '</button>'
      + '<div class="cb-entity-panel" data-org-panel hidden>'
      + '<input class="filter-control" data-org-search placeholder="搜索组织或部门" oninput="acFilterDeptTree(this.value)">'
      + '<div class="cb-entity-tree" data-org-list role="listbox">' + orgTreeListHtml(selected) + '</div>'
      + '</div></div>';
  }
  function deptFilterWrap() { return document.querySelector('.ac-org-filter'); }
  function filtersHtml(type, filters) {
    var parking = isParkingType(type);
    var speed = isSpeedType(type);
    var html = '<div class="filter-panel ac-filter"><div class="filter-row">'
      + field(parking ? '所属部门' : '所属项目', parking ? deptFilterHtml(filters.project) : '<select class="filter-control" id="acProject">' + options(projectNames(), filters.project) + '</select>')
      + field(speed ? '车牌 / 司机 / 任务单' : '车牌号 / 司机', '<input class="filter-control" id="acKeyword" value="' + esc(filters.keyword) + '" placeholder="车牌 / 司机 / 任务单" onkeydown="if(event.key===\'Enter\')acApply()">')
      + field('告警等级', '<select class="filter-control" id="acLevel">' + options(LEVEL_NAMES, filters.level) + '</select>')
      + field(speed ? '处置状态' : '处理状态', '<select class="filter-control" id="acHandleStatus">' + options(speed ? ['待处理', '已处理'] : ['待处理', '处理中', '已处理'], filters.handleStatus) + '</select>');
    if (type.extraLabel) {
      html += field(type.extraLabel, '<input class="filter-control" id="acExtra" value="' + esc(filters.extra) + '" placeholder="' + esc(type.extraPlaceholder) + '" onkeydown="if(event.key===\'Enter\')acApply()">');
    }
    if (isAreaStayType(type)) {
      var fenceTypes = (store() && store().getAreaTypes ? store().getAreaTypes() : ['装货区', '卸货区', '充电站', '停车区', '中转区', '其他']);
      html += field('围栏类型', '<select class="filter-control" id="acFenceType">' + options(fenceTypes, filters.fenceType) + '</select>');
    }
    if (speed) {
      html += field('是否仍在超速', '<select class="filter-control" id="acStillOverspeed">' + option('', '全部', filters.stillOverspeed || '') + option('是', '是', filters.stillOverspeed || '') + option('否', '否', filters.stillOverspeed || '') + '</select>');
    }
    if (parking) {
      html += field('告警时间', '<div class="ac-date-range"><input class="filter-control" id="acStart" type="date" value="' + esc(filters.start) + '"><span>至</span><input class="filter-control" id="acEnd" type="date" value="' + esc(filters.end) + '"></div>');
    } else {
      html += field('开始日期', '<input class="filter-control" id="acStart" type="date" value="' + esc(filters.start) + '">')
        + field('结束日期', '<input class="filter-control" id="acEnd" type="date" value="' + esc(filters.end) + '">');
    }
    return html + '</div><div class="filter-actions"><button class="btn btn-default" type="button" onclick="acReset()">重置</button><button class="btn btn-primary" type="button" onclick="acApply()">查询</button></div></div>';
  }
  function actionsHtml(event) {
    var actions = '<a class="link" href="javascript:void(0)" onclick="acView(\'' + esc(event.id) + '\')">' + (event.ruleCode === 'VEHICLE_OVERSPEED' ? '查看' : '详情') + '</a>';
    if (event.handleStatus !== '已处理') actions += '<a class="link" href="javascript:void(0)" onclick="acHandle(\'' + esc(event.id) + '\')">处理</a>';
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
    if (item.code === 'VEHICLE_OVERSPEED') return '≥' + level.speedThreshold + ' km/h / ' + speedDurationLabel(level.durationSeconds);
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
      var unit = level.durationUnit === '分钟' ? '分钟' : '秒';
      var shown = unit === '分钟' ? (Number(level.durationSeconds || 0) / 60) : Number(level.durationSeconds || 0);
      return '<div class="wr-level-condition"><label>车速 ≥ <span class="wr-unit-input"><input class="form-control-text wr-speed" ' + base + ' type="number" min="1" max="200" value="' + level.speedThreshold + '"><em>km/h</em></span></label>'
        + '<label>持续 ≥ <span class="wr-unit-input ac-speed-duration"><input class="form-control-text wr-duration" ' + base + ' type="number" min="1" step="1" value="' + shown + '"><select class="wr-duration-unit" ' + base + ' aria-label="持续时间单位"><option value="秒"' + (unit === '秒' ? ' selected' : '') + '>秒</option><option value="分钟"' + (unit === '分钟' ? ' selected' : '') + '>分钟</option></select></span></label></div>';
    }
    if (item.code === 'DRIVER_FATIGUE') {
      return '<div class="wr-level-condition"><label>连续驾驶 ≥ <span class="wr-unit-input"><input class="form-control-text wr-fatigue" ' + base + ' type="number" min="1" max="24" step="0.1" value="' + formatHours(level.thresholdMinutes) + '"><em>小时</em></span></label></div>';
    }
    var compare = item.code === 'VEHICLE_LOW_SOC' ? 'SOC ≤' : isAreaStayType(item) ? '区域停留 ≥' : item.code === 'UNLOAD_WEIGHBILL_MISSING' ? '离开卸货地 ≥' : '连续异常停车 ≥';
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
  /* 与合同「乙方 / 使用部门」同一套组织树，停车规则按部门多选。 */
  var ORG_TREE = [
    { id: 'yunnan-lifu', name: '云南力伏星新能源有限公司', departments: [
      { id: 'finance', name: '财务部（宁核聚力）' },
      { id: 'chengdu', name: '成都校区' },
      { id: 'guangxi', name: '广西钦圣' },
      { id: 'hr', name: '人资部（宁核聚力）' },
      { id: 'sales', name: '销售部（宁核聚力）' },
      { id: 'yunnan-qinsheng', name: '云南钦圣新能源科技有限公司' },
      { id: 'ops-1', name: '运营一部' },
      { id: 'ops-2', name: '运营二部' }
    ]},
    { id: 'woyuan', name: '内蒙古沃远智行物流有限公司', departments: [
      { id: 'woyuan-ops', name: '西南项目组' }
    ]},
    { id: 'wotong', name: '内蒙古沃通智行物流科技有限公司', departments: [
      { id: 'wotong-default', name: '默认部门' }
    ]},
    { id: 'heavy-truck-test', name: '重卡测试组', departments: [
      { id: 'test-default', name: '测试运营部' }
    ]}
  ];
  function parkingPeriodText(rule) {
    if (rule.monitorPeriod !== '自定义') return '全天';
    return (rule.monitorStart || '00:00') + '-' + (rule.monitorEnd || '23:59');
  }
  function parkingScopeMode(rule) {
    var type = (rule && rule.scopeType) || '';
    if (type === '自定义车辆' || type === '指定车辆') return '自定义车辆';
    return '组织部门';
  }
  function parkingScopeLabel(rule) {
    return parkingScopeMode(rule);
  }
  function joinedScope(names, unit, emptyText) {
    if (!names.length) return { text: emptyText, title: '' };
    if (names.length === 1) return { text: names[0], title: names[0] };
    return { text: names[0] + '等' + names.length + unit, title: names.join('、') };
  }
  function parkingScopeObject(rule) {
    if (rule.scopeType === '指定车辆' || rule.scopeType === '自定义车辆') {
      return joinedScope(rule.vehiclePlates || [], '辆', '未选车辆');
    }
    if (rule.scopeType === '组织部门') return joinedScope(rule.departmentNames || [], '个部门', '未选部门');
    if (rule.scopeType === '指定项目') return joinedScope(rule.projectNames || [], '个项目', '未选项目');
    return { text: '全部组织', title: '全部组织部门' };
  }
  function selectedScopeMode() {
    var checked = document.querySelector('#acParkingModalHost input[name="wrScopeMode"]:checked');
    return checked ? checked.value : '组织部门';
  }
  function checkedDeptRecords() {
    return Array.prototype.map.call(document.querySelectorAll('#acParkingModalHost input[name="wrDeptIds"]:checked'), function (input) {
      return { id: input.value, name: input.getAttribute('data-name') || input.value };
    });
  }
  function parkingOrgTreeHtml(selectedIds) {
    return ORG_TREE.map(function (org) {
      var deptHtml = org.departments.map(function (dept) {
        var checked = selectedIds.indexOf(dept.id) >= 0;
        return '<label class="ac-org-dept ac-check" data-org-id="' + esc(org.id) + '" data-dept-name="' + esc(dept.name) + '">'
          + '<input type="checkbox" name="wrDeptIds" value="' + esc(dept.id) + '" data-name="' + esc(dept.name) + '"' + (checked ? ' checked' : '') + ' onchange="acParkingCount()">'
          + esc(dept.name) + '</label>';
      }).join('');
      return '<div class="ac-org-group" data-org-id="' + esc(org.id) + '" data-org-name="' + esc(org.name) + '">'
        + '<label class="ac-org-company ac-check"><input type="checkbox" data-org-toggle="' + esc(org.id) + '" onchange="acOrgToggle(this)">' + esc(org.name) + '</label>'
        + '<div class="ac-org-depts">' + deptHtml + '</div></div>';
    }).join('');
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
      if (filters.scopeType && parkingScopeLabel(rule) !== filters.scopeType) return false;
      if (filters.status === '启用' && !rule.enabled) return false;
      if (filters.status === '停用' && rule.enabled) return false;
      return true;
    }).sort(function (a, b) { return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); });
    var body = rows.length ? rows.map(function (rule, index) {
      var target = parkingScopeObject(rule);
      var canDelete = rule.id !== 'RULE_TRANSPORT_PARKING';
      return '<tr><td class="sticky-col">' + (index + 1) + '</td><td>' + esc(rule.name || '未命名规则') + '</td><td>' + esc(parkingScopeLabel(rule)) + '</td>'
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
      + field('适用范围', '<select class="filter-control" id="acRuleScope">' + option('', '全部', filters.scopeType) + option('组织部门', '组织部门', filters.scopeType) + option('自定义车辆', '自定义车辆', filters.scopeType) + '</select>')
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
    var scopeMode = parkingScopeMode(item);
    var vehicles = store().getParkingVehicles ? store().getParkingVehicles() : [];
    var selectedPlates = scopeMode === '自定义车辆' ? (item.vehiclePlates || []) : [];
    var selectedDepts = item.scopeType === '组织部门' ? (item.departmentIds || []) : [];
    var vehicleChecks = vehicles.map(function (vehicle) {
      var meta = vehicle.departmentName || vehicle.projectName || '';
      return '<label class="ac-vehicle-option ac-check" data-plate="' + esc(vehicle.plate) + '"><input type="checkbox" name="wrVehiclePlates" value="' + esc(vehicle.plate) + '"' + (selectedPlates.indexOf(vehicle.plate) >= 0 ? ' checked' : '') + ' onchange="acParkingCount()">' + esc(vehicle.plate) + (meta ? '<small>' + esc(meta) + '</small>' : '') + '</label>';
    }).join('');
    var scopeChoice = function (value) {
      return '<label class="ac-scope-choice"><input type="radio" name="wrScopeMode" value="' + value + '"' + (scopeMode === value ? ' checked' : '') + ' onchange="acScopeChange()"><span>' + value + '</span></label>';
    };
    var title = mode === 'create' ? '新增停车超时规则' : '编辑停车超时规则';
    return '<div class="modal ac-parking-modal" role="dialog" aria-modal="true">'
      + '<div class="modal-header"><div><div class="modal-title">' + title + '</div>' + (item.name ? '<p class="ac-modal-sub">' + esc(item.name) + '</p>' : '') + '</div><button class="modal-close" type="button" onclick="acCloseParkingModal()" aria-label="关闭">×</button></div>'
      + '<div class="modal-body">'
      + '<section class="form-section"><div class="form-section-title"><span class="section-icon"></span>基础信息</div><div class="form-grid col-2">'
      + formField('规则名称 <span class="req">*</span>', '<input class="form-control-text" id="wrName" value="' + esc(item.name) + '" maxlength="40" placeholder="最多40字">', '')
      + formField('规则状态 <span class="req">*</span>', '<select class="form-control-text" id="wrEnabled">' + option('启用', '启用', item.enabled !== false ? '启用' : '停用') + option('停用', '停用', item.enabled !== false ? '启用' : '停用') + '</select>', '')
      + formField('监控时段 <span class="req">*</span>', '<select class="form-control-text" id="wrMonitorPeriod" onchange="acMonitorPeriodChange()">' + option('全天', '全天', item.monitorPeriod || '全天') + option('自定义', '自定义', item.monitorPeriod) + '</select>', '')
      + '</div><div class="form-grid col-2" id="wrMonitorRange"' + (customPeriod ? '' : ' hidden') + '>'
      + formField('开始时间', '<input class="form-control-text" id="wrMonitorStart" type="time" value="' + esc(item.monitorStart || '22:00') + '">', '')
      + formField('结束时间', '<input class="form-control-text" id="wrMonitorEnd" type="time" value="' + esc(item.monitorEnd || '06:00') + '">', '')
      + '<div class="form-item full"><div class="form-hint">开始时间大于结束时间时按跨天时段计算，例如 22:00-06:00</div></div>'
      + '</div></section>'
      + '<section class="form-section"><div class="form-section-title"><span class="section-icon"></span>适用范围</div>'
      + '<div class="ac-scope-choices" role="radiogroup" aria-label="适用范围">' + scopeChoice('组织部门') + scopeChoice('自定义车辆') + '</div>'
      + '<div class="ac-scope-panel" id="wrOrgBox"' + (scopeMode === '组织部门' ? '' : ' hidden') + '>'
      + '<div class="ac-scope-bar"><p class="ac-scope-count" id="wrOrgCount">已选择 ' + selectedDepts.length + ' 个部门</p></div>'
      + '<input class="form-control-text" id="wrOrgQuery" placeholder="搜索组织或部门" oninput="acFilterOrg()">'
      + '<div class="ac-org-tree">' + parkingOrgTreeHtml(selectedDepts) + '</div></div>'
      + '<div class="ac-scope-panel" id="wrVehicleBox"' + (scopeMode === '自定义车辆' ? '' : ' hidden') + '>'
      + '<div class="ac-scope-bar"><p class="ac-scope-count" id="wrVehicleCount">已选择 ' + selectedPlates.length + ' 辆</p>'
      + '<div class="ac-scope-actions"><button class="btn btn-default btn-sm" type="button" onclick="acVehicleSelectAll(true)">全选</button><button class="btn btn-default btn-sm" type="button" onclick="acVehicleSelectAll(false)">取消全选</button></div></div>'
      + '<input class="form-control-text" id="wrVehicleQuery" placeholder="搜索车牌号" oninput="acFilterVehicles()">'
      + '<div class="ac-check-list ac-vehicle-list">' + (vehicleChecks || '<div class="ac-org-empty">当前没有车辆</div>') + '</div></div></section>'
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
  function areaStayScopeLabel(rule) {
    if ((rule.fenceIds || []).length) return '指定围栏';
    if (rule.areaType && rule.areaType !== '全部类型') return '区域类型';
    if (rule.scopeType === '指定项目') return '指定项目';
    return '全部项目';
  }
  function areaStayScopeObject(rule) {
    if ((rule.fenceIds || []).length) return joinedScope(rule.fenceNames || [], '个围栏', '未选围栏');
    if (rule.areaType && rule.areaType !== '全部类型') return { text: rule.areaType, title: rule.areaType };
    if (rule.scopeType === '指定项目') return joinedScope(rule.projectNames || [], '个项目', '未选项目');
    return { text: '全部项目', title: '全部项目 / 全部类型 / 全部围栏' };
  }
  function areaStayRulesHtml() {
    var filters = currentState().areaStayRuleFilters;
    var list = rules().filter(function (item) { return item.code === 'AREA_STAY_TIMEOUT' || item.code === 'PARKING_AREA'; });
    var q = String(filters.name || '').trim().toLowerCase();
    var rows = list.filter(function (rule) {
      if (q && String(rule.name || '').toLowerCase().indexOf(q) < 0) return false;
      if (filters.scopeType && areaStayScopeLabel(rule) !== filters.scopeType) return false;
      if (filters.status === '启用' && !rule.enabled) return false;
      if (filters.status === '停用' && rule.enabled) return false;
      return true;
    }).sort(function (a, b) { return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); });
    var body = rows.length ? rows.map(function (rule, index) {
      var target = areaStayScopeObject(rule);
      var canDelete = rule.id !== 'RULE_AREA_STAY';
      return '<tr><td class="sticky-col">' + (index + 1) + '</td><td>' + esc(rule.name || '未命名规则') + '</td><td>' + esc(areaStayScopeLabel(rule)) + '</td>'
        + '<td title="' + esc(target.title) + '">' + esc(target.text) + '</td>'
        + '<td>' + esc(parkingLevelCell(rule, '一般')) + '</td><td>' + esc(parkingLevelCell(rule, '严重')) + '</td><td>' + esc(parkingLevelCell(rule, '紧急')) + '</td>'
        + '<td>' + (rule.enabled ? badge('启用', 'primary') : badge('停用', 'gray')) + '</td>'
        + '<td>' + esc(rule.updatedAt || '—') + '</td><td class="sticky-col-r ac-actions">'
        + '<a class="link" href="javascript:void(0)" onclick="acEditAreaStayRule(\'' + esc(rule.id) + '\')">编辑</a>'
        + '<a class="link" href="javascript:void(0)" onclick="acToggleRule(\'' + esc(rule.id) + '\')">' + (rule.enabled ? '停用' : '启用') + '</a>'
        + (canDelete ? '<a class="link" href="javascript:void(0)" onclick="acRemoveAreaStayRule(\'' + esc(rule.id) + '\')">删除</a>' : '')
        + '</td></tr>';
    }).join('') : '<tr><td colspan="10"><div class="empty-state"><b>没有符合条件的区域停留规则</b><p>可调整筛选条件，或新增一条规则。</p></div></td></tr>';
    return '<div class="ac-rule-list">'
      + '<div class="filter-panel ac-filter"><div class="filter-row">'
      + field('规则名称', '<input class="filter-control" id="acRuleName" value="' + esc(filters.name) + '" placeholder="支持模糊搜索" onkeydown="if(event.key===\'Enter\')acAreaRuleApply()">')
      + field('适用范围', '<select class="filter-control" id="acRuleScope">' + option('', '全部', filters.scopeType) + option('全部项目', '全部项目', filters.scopeType) + option('指定项目', '指定项目', filters.scopeType) + option('区域类型', '区域类型', filters.scopeType) + option('指定围栏', '指定围栏', filters.scopeType) + '</select>')
      + field('状态', '<select class="filter-control" id="acRuleStatus">' + option('', '全部', filters.status) + option('启用', '启用', filters.status) + option('停用', '停用', filters.status) + '</select>')
      + '</div><div class="filter-actions"><button class="btn btn-default" type="button" onclick="acAreaRuleReset()">重置</button><button class="btn btn-primary" type="button" onclick="acAreaRuleApply()">查询</button></div></div>'
      + '<section class="table-section"><div class="table-toolbar"><div class="left"><span class="detail-section-title">区域停留规则</span><span class="ac-table-count">共 ' + rows.length + ' 条</span></div><div class="right"><button class="btn btn-primary" type="button" onclick="acAddAreaStayRule()">+ 新增规则</button></div></div>'
      + '<div class="table-wrap ac-table-wrap"><table class="data-table ac-table ac-rule-table"><thead><tr>'
      + '<th class="sticky-col">序号</th><th>规则名称</th><th>适用范围</th><th>适用对象</th><th>一般</th><th>严重</th><th>紧急</th><th>状态</th><th>更新时间</th><th class="sticky-col-r">操作</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>'
      + '<div class="pagination"><div class="pagination-info">共 ' + rows.length + ' 条，当前 ' + (rows.length ? '1-' + rows.length : '0-0') + '</div><div class="pagination-controls"><button class="page-btn active" type="button">1</button></div></div></section></div>';
  }
  function areaStayFenceOptions(item) {
    var fences = store().getAreaStayFences ? store().getAreaStayFences() : [];
    var projectIds = item.scopeType === '指定项目' ? (item.projectIds || []) : [];
    var areaType = item.areaType && item.areaType !== '全部类型' ? item.areaType : '';
    return fences.filter(function (fence) {
      if (projectIds.length && projectIds.indexOf(fence.projectId) < 0) return false;
      if (areaType && fence.type !== areaType) return false;
      return true;
    });
  }
  function areaStayModalHtml(item, mode) {
    var projects = store().getProjects ? store().getProjects() : [];
    var areaTypes = store().getAreaTypes ? store().getAreaTypes() : [];
    var specifiedProject = item.scopeType === '指定项目';
    var specifiedFence = (item.fenceIds || []).length > 0 || item._fenceMode === '指定围栏';
    var fenceMode = specifiedFence ? '指定围栏' : '全部符合条件围栏';
    var fences = areaStayFenceOptions(item);
    var selectedFences = item.fenceIds || [];
    var selectedProjects = item.projectIds || [];
    var title = mode === 'create' ? '新增区域停留规则' : '编辑区域停留规则';
    var projectChecks = projects.map(function (project) {
      return '<label class="ac-check"><input type="checkbox" name="wrAreaProjects" value="' + esc(project.id) + '" data-name="' + esc(project.name) + '"' + (selectedProjects.indexOf(project.id) >= 0 ? ' checked' : '') + ' onchange="acAreaStayFenceFilter()">' + esc(project.name) + '</label>';
    }).join('');
    var fenceChecks = fences.map(function (fence) {
      return '<label class="ac-vehicle-option ac-check" data-fence="' + esc(fence.name) + '" data-fence-type="' + esc(fence.type) + '"><input type="checkbox" name="wrAreaFences" value="' + esc(fence.id) + '" data-name="' + esc(fence.name) + '"' + (selectedFences.indexOf(fence.id) >= 0 ? ' checked' : '') + '>' + esc(fence.name) + '<small>' + esc(fence.type + ' · ' + fence.projectName) + '</small></label>';
    }).join('');
    return '<div class="modal ac-parking-modal" role="dialog" aria-modal="true">'
      + '<div class="modal-header"><div><div class="modal-title">' + title + '</div>' + (item.name ? '<p class="ac-modal-sub">' + esc(item.name) + '</p>' : '') + '</div><button class="modal-close" type="button" onclick="acCloseAreaStayModal()" aria-label="关闭">×</button></div>'
      + '<div class="modal-body">'
      + '<section class="form-section"><div class="form-section-title"><span class="section-icon"></span>基础配置</div><div class="form-grid col-2">'
      + formField('规则名称 <span class="req">*</span>', '<input class="form-control-text" id="wrName" value="' + esc(item.name) + '" maxlength="40" placeholder="例如：玉溪项目-卸货区域停留预警">', '')
      + formField('规则状态 <span class="req">*</span>', '<select class="form-control-text" id="wrEnabled">' + option('启用', '启用', item.enabled !== false ? '启用' : '停用') + option('停用', '停用', item.enabled !== false ? '启用' : '停用') + '</select>', '')
      + formField('适用项目 <span class="req">*</span>', '<select class="form-control-text" id="wrScope" onchange="acAreaStayScopeChange()">' + option('全部项目', '全部项目', item.scopeType || '全部项目') + option('指定项目', '指定项目', item.scopeType) + '</select>', '')
      + formField('区域类型 <span class="req">*</span>', '<select class="form-control-text" id="wrAreaType" onchange="acAreaStayFenceFilter()">' + option('全部类型', '全部类型', item.areaType || '全部类型') + areaTypes.map(function (type) { return option(type, type, item.areaType); }).join('') + '</select>', '优先复用电子围栏业务类型，不另建主数据')
      + '</div>'
      + '<div id="wrAreaProjectBox"' + (specifiedProject ? '' : ' hidden') + '><div class="form-hint" style="margin-bottom:8px">选择指定项目后，仅这些项目内的围栏参与匹配。</div><div class="ac-check-list">' + projectChecks + '</div></div>'
      + '<div class="form-item" style="margin-top:14px"><label class="form-label">适用围栏</label>'
      + '<div class="ac-scope-choices" role="radiogroup">'
      + '<label class="ac-scope-choice"><input type="radio" name="wrFenceMode" value="全部符合条件围栏"' + (fenceMode === '全部符合条件围栏' ? ' checked' : '') + ' onchange="acAreaStayFenceMode()">全部符合条件围栏</label>'
      + '<label class="ac-scope-choice"><input type="radio" name="wrFenceMode" value="指定围栏"' + (fenceMode === '指定围栏' ? ' checked' : '') + ' onchange="acAreaStayFenceMode()">指定围栏</label>'
      + '</div></div>'
      + '<div class="ac-scope-panel" id="wrAreaFenceBox"' + (fenceMode === '指定围栏' ? '' : ' hidden') + '>'
      + '<p class="ac-scope-count" id="wrFenceCount">已选择 ' + selectedFences.length + ' 个围栏</p>'
      + '<input class="form-control-text" id="wrFenceQuery" placeholder="搜索围栏名称" oninput="acFilterAreaFences()">'
      + '<div class="ac-check-list ac-vehicle-list" id="wrAreaFenceList">' + (fenceChecks || '<div class="ac-org-empty">当前项目 / 区域类型下没有可选围栏</div>') + '</div></div></section>'
      + '<section class="form-section"><div class="form-section-title"><span class="section-icon"></span>预警等级配置</div>'
      + '<p class="wr-level-help">同一车辆一次连续停留在同一围栏只产生 1 个告警事件，达到更高等级时升级原事件。必须至少启用一级；启用等级阈值须递增且不得相同。</p>'
      + '<table class="data-table ac-level-table"><thead><tr><th>告警等级</th><th>是否启用</th><th>区域停留时长</th></tr></thead><tbody>'
      + (item.levels || []).map(function (level, index) {
        return '<tr><td>' + esc(level.level) + '</td><td><label class="ac-check"><input class="wr-level-enabled" data-level-index="' + index + '" type="checkbox"' + (level.enabled !== false ? ' checked' : '') + '>启用本级</label></td>'
          + '<td><div class="wr-level-condition"><label>区域停留 ≥ <span class="wr-unit-input ac-level-input"><input class="form-control-text wr-threshold" data-level-index="' + index + '" type="number" min="1" max="1440" value="' + Number(level.threshold || 0) + '"><em>分钟</em></span></label></div></td></tr>';
      }).join('')
      + '</tbody></table></section>'
      + '<section class="form-section"><div class="form-section-title"><span class="section-icon"></span>恢复规则</div>'
      + '<div class="wr-recovery"><b>恢复条件</b><span>车辆离开产生告警的业务区域</span></div>'
      + '<p class="form-hint">一期固定为离开对应电子围栏后自动恢复，暂不开放复杂恢复条件。</p></section>'
      + '<section class="form-section"><div class="form-section-title"><span class="section-icon"></span>通知策略（后续能力）</div>'
      + '<p class="ac-mock-hint">预留站内消息、调度工作台、运输监控大屏、企业微信、短信和司机端提醒。本期不发送真实通知。</p></section>'
      + '</div>'
      + '<div class="modal-footer"><button class="btn btn-default" type="button" onclick="acCloseAreaStayModal()">取消</button><button class="btn btn-primary" type="button" onclick="acSaveAreaStayRule()">保存</button></div></div>';
  }
  function speedScopeLabel(rule) {
    return rule && rule.scopeType === '指定项目' ? '指定项目' : '全部项目';
  }
  function speedScopeObject(rule) {
    if (rule.scopeType === '指定项目') return joinedScope(rule.projectNames || [], '个项目', '未选项目');
    return { text: '全部项目', title: '全部项目' };
  }
  function speedLevelCell(rule, name) {
    var level = (rule.levels || []).filter(function (item) { return item.level === name; })[0];
    if (!level || level.enabled === false) return '未启用';
    return '≥' + level.speedThreshold + ' km/h / ' + speedDurationLabel(level.durationSeconds);
  }
  function speedRulesHtml() {
    var filters = currentState().speedRuleFilters;
    var list = rules().filter(function (item) { return item.code === 'VEHICLE_OVERSPEED'; });
    var q = String(filters.name || '').trim().toLowerCase();
    var rows = list.filter(function (rule) {
      if (q && String(rule.name || '').toLowerCase().indexOf(q) < 0) return false;
      if (filters.scopeType && speedScopeLabel(rule) !== filters.scopeType) return false;
      if (filters.status === '启用' && !rule.enabled) return false;
      if (filters.status === '停用' && rule.enabled) return false;
      return true;
    }).sort(function (a, b) { return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); });
    var body = rows.length ? rows.map(function (rule, index) {
      var target = speedScopeObject(rule);
      var canDelete = rule.id !== 'RULE_VEHICLE_OVERSPEED';
      return '<tr><td class="sticky-col">' + (index + 1) + '</td><td>' + esc(rule.name || '未命名规则') + '</td><td>' + esc(speedScopeLabel(rule)) + '</td>'
        + '<td title="' + esc(target.title) + '">' + esc(target.text) + '</td>'
        + '<td>' + esc(speedLevelCell(rule, '一般')) + '</td><td>' + esc(speedLevelCell(rule, '严重')) + '</td><td>' + esc(speedLevelCell(rule, '紧急')) + '</td>'
        + '<td>' + esc(speedPolicyText(rule.speedSourcePolicy)) + '</td>'
        + '<td>' + (rule.enabled ? badge('启用', 'primary') : badge('停用', 'gray')) + '</td>'
        + '<td>' + esc(rule.updatedAt || '—') + '</td><td class="sticky-col-r ac-actions">'
        + '<a class="link" href="javascript:void(0)" onclick="acEditSpeedRule(\'' + esc(rule.id) + '\')">编辑</a>'
        + '<a class="link" href="javascript:void(0)" onclick="acToggleRule(\'' + esc(rule.id) + '\')">' + (rule.enabled ? '停用' : '启用') + '</a>'
        + (canDelete ? '<a class="link" href="javascript:void(0)" onclick="acRemoveSpeedRule(\'' + esc(rule.id) + '\')">删除</a>' : '')
        + '</td></tr>';
    }).join('') : '<tr><td colspan="11"><div class="empty-state"><b>没有符合条件的车速预警规则</b><p>可调整筛选条件，或新增一条规则。</p></div></td></tr>';
    return '<div class="ac-rule-list">'
      + '<div class="filter-panel ac-filter"><div class="filter-row">'
      + field('规则名称', '<input class="filter-control" id="acRuleName" value="' + esc(filters.name) + '" placeholder="支持模糊搜索" onkeydown="if(event.key===\'Enter\')acSpeedRuleApply()">')
      + field('适用范围', '<select class="filter-control" id="acRuleScope">' + option('', '全部', filters.scopeType) + option('全部项目', '全部项目', filters.scopeType) + option('指定项目', '指定项目', filters.scopeType) + '</select>')
      + field('状态', '<select class="filter-control" id="acRuleStatus">' + option('', '全部', filters.status) + option('启用', '启用', filters.status) + option('停用', '停用', filters.status) + '</select>')
      + '</div><div class="filter-actions"><button class="btn btn-default" type="button" onclick="acSpeedRuleReset()">重置</button><button class="btn btn-primary" type="button" onclick="acSpeedRuleApply()">查询</button></div></div>'
      + '<section class="table-section"><div class="table-toolbar"><div class="left"><span class="detail-section-title">车速预警规则</span><span class="ac-table-count">共 ' + rows.length + ' 条</span></div><div class="right"><button class="btn btn-primary" type="button" onclick="acAddSpeedRule()">+ 新增规则</button></div></div>'
      + '<div class="table-wrap ac-table-wrap"><table class="data-table ac-table ac-rule-table"><thead><tr>'
      + '<th class="sticky-col">序号</th><th>规则名称</th><th>适用范围</th><th>适用对象</th><th>一般</th><th>严重</th><th>紧急</th><th>速度来源</th><th>状态</th><th>更新时间</th><th class="sticky-col-r">操作</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>'
      + '<div class="pagination"><div class="pagination-info">共 ' + rows.length + ' 条，当前 ' + (rows.length ? '1-' + rows.length : '0-0') + '</div><div class="pagination-controls"><button class="page-btn active" type="button">1</button></div></div></section></div>';
  }
  function speedModalHtml(item, mode) {
    var recovery = item.recoveryConfig || {};
    var projects = store() && store().getProjects ? store().getProjects() : [];
    var selected = item.projectIds || [];
    var policy = item.speedSourcePolicy || 'CAN_THEN_GPS';
    var specified = item.scopeType === '指定项目';
    var title = mode === 'create' ? '新增车速预警规则' : '编辑车速预警规则';
    var checks = projects.map(function (project) {
      return '<label class="ac-check"><input type="checkbox" name="wrSpeedProjects" value="' + esc(project.id) + '" data-name="' + esc(project.name) + '"' + (selected.indexOf(project.id) >= 0 ? ' checked' : '') + '>' + esc(project.name) + '</label>';
    }).join('');
    return '<div class="modal ac-parking-modal" role="dialog" aria-modal="true">'
      + '<div class="modal-header"><div><div class="modal-title">' + title + '</div>' + (item.name ? '<p class="ac-modal-sub">' + esc(item.name) + '</p>' : '') + '</div><button class="modal-close" type="button" onclick="acCloseSpeedModal()" aria-label="关闭">×</button></div>'
      + '<div class="modal-body">'
      + '<section class="form-section"><div class="form-section-title"><span class="section-icon"></span>基础配置</div><div class="form-grid col-2">'
      + formField('规则名称 <span class="req">*</span>', '<input class="form-control-text" id="wrName" value="' + esc(item.name) + '" maxlength="40" placeholder="例如：景洪项目车速预警">', '')
      + formField('规则状态 <span class="req">*</span>', '<select class="form-control-text" id="wrEnabled">' + option('启用', '启用', item.enabled !== false ? '启用' : '停用') + option('停用', '停用', item.enabled !== false ? '启用' : '停用') + '</select>', '')
      + formField('速度数据来源 <span class="req">*</span>', '<select class="form-control-text" id="wrSpeedSource">' + option('CAN_THEN_GPS', speedPolicyText('CAN_THEN_GPS'), policy) + option('CAN', speedPolicyText('CAN'), policy) + option('GPS', speedPolicyText('GPS'), policy) + '</select>', '尖峰过滤为固定策略，不在此配置')
      + formField('适用范围 <span class="req">*</span>', '<select class="form-control-text" id="wrScope" onchange="acScopeChange()">' + option('全部项目', '全部项目', item.scopeType || '全部项目') + option('指定项目', '指定项目', item.scopeType || '全部项目') + '</select>', '指定项目优先于全部项目')
      + '</div>'
      + '<div id="wrSpeedProjects"' + (specified ? '' : ' hidden') + '><div class="form-hint" style="margin-bottom:8px">指定项目至少选择一个。同级指定项目范围重叠时禁止保存。</div><div class="ac-check-list ac-speed-projects">' + (checks || '<div class="ac-org-empty">当前没有可选项目</div>') + '</div></div></section>'
      + '<section class="form-section"><div class="form-section-title"><span class="section-icon"></span>预警等级配置</div>'
      + '<p class="wr-level-help">同一段连续超速只保留一条告警，达到更高等级时在原事件上升级，等级只升不降。必须至少启用一级；启用等级的车速阈值须递增。</p>'
      + '<table class="data-table ac-level-table"><thead><tr><th>告警等级</th><th>是否启用</th><th>车速阈值</th><th>持续时间</th></tr></thead><tbody>'
      + (item.levels || []).map(function (level, index) {
        var unit = level.durationUnit === '分钟' ? '分钟' : '秒';
        var shown = unit === '分钟' ? (Number(level.durationSeconds || 0) / 60) : Number(level.durationSeconds || 0);
        return '<tr><td>' + esc(level.level) + '</td><td><label class="ac-check"><input class="wr-level-enabled" data-level-index="' + index + '" type="checkbox"' + (level.enabled !== false ? ' checked' : '') + '>启用本级</label></td>'
          + '<td><div class="wr-unit-input ac-level-input"><input class="form-control-text wr-speed" data-level-index="' + index + '" type="number" min="1" max="200" value="' + Number(level.speedThreshold || 0) + '"><em>km/h</em></div></td>'
          + '<td><div class="wr-unit-input ac-speed-duration ac-level-input"><input class="form-control-text wr-duration" data-level-index="' + index + '" type="number" min="1" step="1" value="' + shown + '"><select class="wr-duration-unit" data-level-index="' + index + '" aria-label="持续时间单位"><option value="秒"' + (unit === '秒' ? ' selected' : '') + '>秒</option><option value="分钟"' + (unit === '分钟' ? ' selected' : '') + '>分钟</option></select></div></td></tr>';
      }).join('')
      + '</tbody></table></section>'
      + '<section class="form-section"><div class="form-section-title"><span class="section-icon"></span>恢复条件</div><div class="form-grid col-2">'
      + formField('恢复车速阈值 <span class="req">*</span>', '<div class="wr-unit-input ac-speed-recover"><input class="form-control-text" id="wrRecoverSpeed" type="number" min="1" value="' + Number(recovery.recoverSpeedKph || 75) + '"><em>km/h</em></div>', '须低于已启用的最低车速阈值')
      + formField('恢复持续时间 <span class="req">*</span>', '<div class="wr-unit-input ac-speed-recover"><input class="form-control-text" id="wrRecoverSeconds" type="number" min="1" step="1" value="' + Number(recovery.recoverDurationSeconds || 30) + '"><em>秒</em></div>', '车速回到恢复阈值后需连续满足该时长')
      + '</div><p class="form-hint">关闭规则后不再产生新告警，尚未恢复的事件仍按原规则快照完成恢复判定。</p></section>'
      + '<section class="form-section"><div class="form-section-title"><span class="section-icon"></span>通知策略（后续能力）</div>'
      + '<p class="ac-mock-hint">预留站内消息、调度工作台、运输监控大屏、企业微信、短信和司机端提醒。本期不发送真实通知。</p></section>'
      + '</div>'
      + '<div class="modal-footer"><button class="btn btn-default" type="button" onclick="acCloseSpeedModal()">取消</button><button class="btn btn-primary" type="button" onclick="acSaveSpeedRule()">保存</button></div></div>';
  }
  function rulesHtml(type) {
    if (type.code === 'TRANSPORT_PARKING') return parkingRulesHtml();
    if (isAreaStayType(type)) return areaStayRulesHtml();
    if (isSpeedType(type)) return speedRulesHtml();
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
      + (state.tab === 'rules' ? rulesHtml(type) : metricsHtml(all, state.activeMetric, type) + statusFilterHtml(all, state.filters.eventStatus) + filtersHtml(type, state.filters) + tableHtml(type, rows))
      + '</div>';
  }
  function readFilters() {
    var filters = currentState().filters;
    ['Project', 'Level', 'HandleStatus', 'Keyword', 'Extra', 'Start', 'End', 'FenceType', 'StillOverspeed'].forEach(function (suffix) {
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
    drawerMode = '';
  }
  function mountDrawer(html, mode) {
    closeDrawer();
    drawerMode = mode;
    var host = document.createElement('div');
    host.id = 'acDrawerHost';
    host.className = 'ac-drawer-host is-open';
    host.innerHTML = '<button class="ac-drawer-mask" type="button" onclick="acCloseDrawer()" aria-label="关闭"></button><aside class="ac-drawer ac-' + mode + '-drawer" role="dialog" aria-modal="true">' + html + '</aside>';
    document.body.appendChild(host);
  }
  function kv(label, value) { return '<div><dt>' + esc(label) + '</dt><dd>' + (value == null || value === '' ? '—' : value) + '</dd></div>'; }
  function summary(event) {
    var parking = event.ruleCode === 'TRANSPORT_PARKING';
    var areaStay = isAreaStayEvent(event);
    var handleLabel = '处理状态';
    var duration = parking ? parkingDurationText(event) : areaStay ? areaStayDurationText(event) : durationText(event);
    var durationLabel = parking ? '停车时长' : areaStay ? (event.eventStatus === '已恢复' ? '最终停留时长' : '已停留') : '持续时间';
    return '<div class="ac-detail-summary"><span>' + levelBadge(event.currentLevel || event.level) + '<small>' + (areaStay ? '当前等级' : '告警等级') + '</small></span>'
      + '<span>' + eventBadge(event.eventStatus || (event.recoveredAt ? '已恢复' : '发生中')) + '<small>事件状态</small></span>'
      + '<span>' + handleBadge(event.handleStatus) + '<small>' + handleLabel + '</small></span><span><b>' + esc(duration) + '</b><small>' + durationLabel + '</small></span></div>';
  }
  function timelineHtml(event) {
    var names = { STILL_STARTED: '开始异常停车', TRIGGERED: '告警触发', ALERT_CREATED: '触发预警', LEVEL_UPGRADED: '告警升级', LEVEL_UPGRADE: '升级预警', LEVEL_DOWNGRADED: '告警降级', ACKNOWLEDGED: '告警知悉', HANDLING_STARTED: '人工开始处理', HANDLED: '人工处理完成', MANUAL_HANDLE: '人工处理', ENTER_FENCE: '进入围栏', LEAVE_FENCE: '离开围栏', AUTO_RECOVER: '自动恢复', RECOVERED: '告警恢复' };
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
          ['停车开始时间', parkingStartAt(event) || '—'],
          ['停车时长', parkingDurationText(event)],
          ['当前位置', event.location],
          ['任务状态', metrics.taskNode || metrics.taskStatus || '—'],
          ['装货作业', yesNo(metrics.loadingScene === true)],
          ['卸货作业', yesNo(metrics.unloadingScene === true)],
          ['充电状态', yesNo(metrics.charging === true)]
        ];
        break;
      case 'PARKING_AREA':
      case 'AREA_STAY_TIMEOUT':
        items = [['围栏名称', event.fenceName || metrics.fenceName || event.location], ['围栏类型', event.fenceType || metrics.fenceType], ['进入围栏时间', event.enterTime || metrics.enteredAt], ['离开围栏时间', event.leaveTime || '—'], ['当前/最终停留时长', areaStayDurationText(event)], ['命中规则', (event.ruleSnapshot || {}).ruleName || event.ruleName], ['当前触发条件', threshold]];
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
  function handleRecordsHtml(event) {
    var records = event.handleRecords || [];
    if (!records.length) return '<p class="ac-mock-hint">暂无处理记录。</p>';
    return '<ol class="ac-handle-records">' + records.map(function (record) {
      return '<li><time>' + esc(record.handleTime) + '</time><b>' + esc(record.handler || '—') + ' · ' + esc(record.handleType) + '</b>'
        + (record.parkingReason ? '<p>停车原因：' + esc(record.parkingReason) + '</p>' : '')
        + (record.falseAlarmReason ? '<p>误报原因：' + esc(record.falseAlarmReason) + '</p>' : '')
        + '<p>' + esc(record.handleResult || '') + '</p></li>';
    }).join('') + '</ol>';
  }
  function speedTimelineHtml(event) {
    var logs = store().getLogs(event.id);
    return logs.map(function (log) {
      var title = '';
      if (log.action === 'SPEED_START') title = '开始超速';
      else if (log.action === 'ALERT_CREATED') title = '触发' + (log.toLevel || '一般') + '预警';
      else if (log.action === 'LEVEL_UPGRADE' || log.action === 'LEVEL_UPGRADED') title = '升级为' + (log.toLevel || '') + '预警';
      else if (log.action === 'HANDLED' || log.action === 'MANUAL_HANDLE') title = '人工处置';
      else if (log.action === 'RECOVERED') title = '恢复正常';
      else return '';
      var tone = log.action === 'SPEED_START' ? 'speed_start' : String(log.action).toLowerCase();
      return '<li class="is-' + tone + '"><i></i><div><time>' + esc(log.operatedAt) + '</time><b>' + esc(title) + '</b><p>' + esc(log.remark || '') + (log.operator ? '<span> · ' + esc(log.operator) + '</span>' : '') + '</p></div></li>';
    }).join('');
  }
  function speedRiskHtml(event) {
    var risk = event.realtimeRisk || (event.eventStatus === '已恢复' ? '已恢复' : (event.maxAlertLevel || event.level));
    if (risk === '一般' || risk === '严重' || risk === '紧急') return levelBadge(risk);
    return esc(risk || '—');
  }
  function speedDetailDrawer(id) {
    if (store() && store().refresh) store().refresh();
    var event = store().getEvent(id);
    if (!event) return;
    var metrics = event.metrics || {};
    var stateLabel = event.eventStatus === '发生中' ? '超速中' : '已恢复';
    var recovery = ((event.ruleSnapshot || {}).recoveryConfig || {}).description || ('车速 ≤ ' + ((event.ruleSnapshot || {}).recoveryConfig || {}).recoverSpeedKph + ' km/h');
    var canHandle = event.handleStatus !== '已处理';
    var html = '<header class="ac-drawer-header"><div><small>' + esc(event.id) + '</small><h2>车速预警</h2></div><button type="button" onclick="acCloseDrawer()" aria-label="关闭">×</button></header>'
      + '<div class="ac-drawer-body"><div class="ac-speed-hero"><div><strong>' + esc(event.plate) + ' · ' + esc(event.driverName) + '</strong><span>' + esc((event.maxAlertLevel || event.level) + '预警 · ' + stateLabel) + '</span></div>'
      + '<dl><div><dt>当前车速</dt><dd>' + esc(uiSpeed(metrics.speed)) + '</dd></div><div><dt>最高车速</dt><dd>' + esc(uiSpeed(event.maxSpeed != null ? event.maxSpeed : metrics.maxSpeed)) + '</dd></div><div><dt>触发条件</dt><dd>' + esc(speedSentence(event)) + '</dd></div><div><dt>连续超速</dt><dd>' + esc(speedDurationLabel(speedSeconds(event))) + '</dd></div><div><dt>当前位置</dt><dd>' + esc(event.location || '—') + '</dd></div></dl></div>'
      + '<section class="detail-section"><div class="detail-section-title">车辆信息</div><dl class="ac-kv">' + kv('车牌号', esc(event.plate)) + kv('司机', esc(event.driverName)) + kv('当前位置', esc(event.location || '—')) + kv('速度来源', esc(speedSourceText(event.speedSource || metrics.speedSource))) + kv('最后数据时间', esc(event.lastDataAt || metrics.lastDataAt || '—')) + '</dl></section>'
      + '<section class="detail-section"><div class="detail-section-title">关联运输</div><dl class="ac-kv">' + kv('任务单号', event.taskId ? '<a class="link" href="javascript:void(0)" onclick="acOpenTask(\'' + esc(event.taskId) + '\')">' + esc(event.taskId) + '</a>' : '—') + kv('线路', esc(event.route || '—')) + kv('货物', esc(event.cargo || '—')) + kv('所属项目', esc(event.projectName || '—')) + '</dl></section>'
      + '<section class="detail-section"><div class="detail-section-title">告警信息</div><dl class="ac-kv">'
      + kv('告警编号', esc(event.id)) + kv('告警类型', '车速预警') + kv('超速开始时间', esc(speedStartAt(event) || '—')) + kv('告警生成时间', esc(event.alertCreatedAt || event.triggeredAt || '—'))
      + kv('初始等级', levelBadge(event.initialLevel || event.level)) + kv('最高等级', levelBadge(event.maxAlertLevel || event.level)) + kv('实时风险', speedRiskHtml(event))
      + kv('触发规则', esc(speedSentence(event))) + kv('恢复条件', esc(recovery)) + kv('恢复时间', esc(event.recoveredAt || '—'))
      + '</dl></section>'
      + '<section class="detail-section"><div class="detail-section-title">超速证据</div><dl class="ac-kv">'
      + kv('当前车速', esc(uiSpeed(metrics.speed))) + kv('最高车速', esc(uiSpeed(event.maxSpeed != null ? event.maxSpeed : metrics.maxSpeed))) + kv('平均车速', esc(uiSpeed(event.avgSpeed != null ? event.avgSpeed : metrics.avgSpeed)))
      + kv('超速开始时间', esc(speedStartAt(event) || '—')) + kv('连续超速时长', esc(speedDurationLabel(speedSeconds(event)))) + kv('触发规则', esc(speedSentence(event)))
      + kv('当前位置', esc(event.location || '—')) + kv('实际速度来源', esc(speedSourceText(event.speedSource || metrics.speedSource))) + kv('最后数据时间', esc(event.lastDataAt || metrics.lastDataAt || '—'))
      + '</dl></section>'
      + '<section class="detail-section"><div class="detail-section-title">处理记录</div>' + handleRecordsHtml(event) + '</section>'
      + '<section class="detail-section"><div class="detail-section-title">告警时间线</div><ol class="ac-timeline">' + speedTimelineHtml(event) + '</ol></section></div>'
      + '<footer class="ac-drawer-footer"><button class="btn btn-default" type="button" onclick="acCloseDrawer()">关闭</button>' + (canHandle ? '<button class="btn btn-primary" type="button" onclick="acHandle(\'' + esc(event.id) + '\')">处理告警</button>' : '') + '</footer>';
    mountDrawer(html, 'detail');
    drawerEventId = id;
  }
  function detailDrawer(id) {
    var peek = store() && store().getEvent(id);
    if (peek && peek.ruleCode === 'VEHICLE_OVERSPEED') { speedDetailDrawer(id); return; }
    var event = peek;
    if (!event) return;
    var parking = event.ruleCode === 'TRANSPORT_PARKING';
    var areaStay = isAreaStayEvent(event);
    var metrics = event.metrics || {};
    var relationText = store().areaRelationText ? store().areaRelationText(event.areaRelation || metrics.areaRelation) : (event.areaRelation || '未识别');
    var vehicleStatus = parking ? (metrics.taskNode || metrics.taskStatus || '—') : (event.eventStatus === '发生中' ? '异常状态持续中' : '已恢复正常');
    var alertInfo = parking
      ? kv('告警类型', '停车超时') + kv('触发规则', esc((event.ruleSnapshot || {}).ruleName || event.type)) + kv('触发时等级', levelBadge(event.initialLevel || event.level)) + kv('当前风险等级', levelBadge(event.level)) + kv('停车开始时间', esc(parkingStartAt(event) || '—')) + kv('告警触发时间', esc(event.triggeredAt)) + kv('停车结束时间', esc(event.recoveredAt || '—')) + kv('当前等级触发条件', esc(thresholdText(event))) + kv('触发阈值', esc((event.ruleSnapshot || {}).triggerThreshold != null ? ('连续异常停车 ≥ ' + (event.ruleSnapshot || {}).triggerThreshold + '分钟') : thresholdText(event))) + kv('停车时长', esc(parkingDurationText(event))) + kv('恢复条件', esc(((event.ruleSnapshot || {}).recoveryConfig || {}).description || '—')) + kv('恢复原因', esc(event.recoverReason || '—'))
      : areaStay
        ? kv('告警编号', esc(event.id)) + kv('当前告警等级', levelBadge(event.currentLevel || event.level)) + kv('首次触发时间', esc(event.firstAlertTime || event.triggeredAt)) + kv('当前等级触发时间', esc(event.currentLevelTriggerTime || event.triggeredAt)) + kv('当前触发条件', esc(event.triggerCondition || thresholdText(event))) + kv('命中规则', esc((event.ruleSnapshot || {}).ruleName || event.ruleName || '—')) + kv('事件状态', eventBadge(event.eventStatus)) + kv('处理状态', handleBadge(event.handleStatus)) + kv('恢复条件', esc(event.recoverCondition || '车辆离开产生告警的业务区域')) + kv('恢复时间', esc(event.recoveredAt || '—'))
      : kv('触发时间', esc(event.triggeredAt)) + kv('触发规则', esc((event.ruleSnapshot || {}).ruleName || event.type)) + kv('触发时等级', levelBadge(event.initialLevel || event.level)) + kv('当前风险等级', levelBadge(event.level)) + kv('当前等级条件', esc(thresholdText(event))) + kv('恢复条件', esc(((event.ruleSnapshot || {}).recoveryConfig || {}).description || (event.ruleSnapshot || {}).recovery || '—')) + kv('恢复时间', esc(event.recoveredAt || '—'));
    var canHandle = event.handleStatus !== '已处理';
    var html = '<header class="ac-drawer-header"><div><small>' + esc(event.id) + '</small><h2>' + esc(event.type) + '</h2></div><button type="button" onclick="acCloseDrawer()" aria-label="关闭">×</button></header>'
      + '<div class="ac-drawer-body">' + summary(event)
      + '<section class="detail-section"><div class="detail-section-title">车辆信息</div><dl class="ac-kv">' + kv('车牌号', esc(event.plate)) + kv('司机', esc(event.driverName)) + kv('当前车辆位置', esc(event.location)) + (areaStay || parking ? kv('当前速度', (areaStay ? metrics.currentSpeed : metrics.speed) == null ? '—' : esc((areaStay ? metrics.currentSpeed : metrics.speed) + ' km/h')) : '') + (areaStay ? kv('最后定位时间', esc(metrics.lastLocatedAt || event.lastDetectedAt || '—')) : '') + (parking || areaStay ? '' : kv('车辆状态', esc(vehicleStatus))) + (parking ? kv('车辆状态', esc(vehicleStatus)) : '') + '</dl></section>'
      + '<section class="detail-section"><div class="detail-section-title">关联运输</div><dl class="ac-kv">' + kv('任务单号', '<a class="link" href="javascript:void(0)" onclick="acOpenTask(\'' + esc(event.taskId) + '\')">' + esc(event.taskId || '—') + '</a>') + kv('线路', esc(event.route || '—')) + kv('货物', esc(event.cargo || '—')) + kv(parking ? '所属部门' : '项目', esc(parking ? (event.departmentName || event.projectName) : event.projectName)) + (areaStay ? kv('当前运输阶段', esc(event.transportStage || '—')) : '') + '</dl></section>'
      + (areaStay ? '<section class="detail-section"><div class="detail-section-title">区域信息</div><dl class="ac-kv">' + kv('围栏名称', esc(event.fenceName || metrics.fenceName || '—')) + kv('围栏类型', esc(event.fenceType || metrics.fenceType || '—')) + kv('进入围栏时间', esc(event.enterTime || metrics.enteredAt || '—')) + kv('离开围栏时间', esc(event.leaveTime || '—')) + kv('当前/最终停留时长', esc(areaStayDurationText(event))) + kv('与当前任务关系', esc(relationText)) + '</dl><p class="ac-mock-hint">与当前任务关系为一期预留字段，不作为告警触发条件。</p></section>' : '')
      + '<section class="detail-section"><div class="detail-section-title">告警信息</div><dl class="ac-kv">' + alertInfo + '</dl></section>'
      + (areaStay ? '' : '<section class="detail-section"><div class="detail-section-title">业务证据</div><dl class="ac-kv">' + evidenceHtml(event) + '</dl>' + (parking ? '<p class="ac-mock-hint">作业场景、车速与时长为前端 mock 信号，未接入真实回传。</p>' : '<div class="ac-facts"><b>监控事实</b>' + (event.facts || []).map(function (fact) { return '<span>' + esc(fact) + '</span>'; }).join('') + '</div>') + '</section>')
      + ((parking || areaStay) ? '<section class="detail-section"><div class="detail-section-title">处理记录</div>' + handleRecordsHtml(event) + '</section>' : (event.handlingResult ? '<section class="detail-section"><div class="detail-section-title">处理结果</div><dl class="ac-kv">' + kv('处理方式', esc(event.handlingType)) + kv('处理人', esc(event.handlerName)) + kv('处理时间', esc(event.handledAt)) + kv('处理结果', esc(event.handlingResult)) + '</dl></section>' : ''))
      + '<section class="detail-section"><div class="detail-section-title">' + (areaStay ? '事件时间轴' : '告警时间线') + '</div><ol class="ac-timeline">' + timelineHtml(event) + '</ol></section></div>'
      + '<footer class="ac-drawer-footer"><button class="btn btn-default" type="button" onclick="acCloseDrawer()">关闭</button>' + (canHandle ? '<button class="btn btn-primary" type="button" onclick="acHandle(\'' + esc(event.id) + '\')">处理告警</button>' : '') + '</footer>';
    mountDrawer(html, 'detail');
    drawerEventId = id;
  }
  function handleDrawer(id) {
    var event = store().getEvent(id);
    if (!event) return;
    var speed = event.ruleCode === 'VEHICLE_OVERSPEED';
    var parking = event.ruleCode === 'TRANSPORT_PARKING';
    var areaStay = isAreaStayEvent(event);
    var sharedHandle = parking || areaStay;
    var types = speed
      ? ['电话提醒司机', '通知车队长', '安全教育', '确认误报', '无需处理', '其他']
      : sharedHandle
      ? ['继续观察', '联系司机', '联系场站', '调整任务', '车辆故障处理', '误报', '无需处理', '其他']
      : ['联系司机', '联系现场', '调整任务', '安排充电', '车辆检修', '补传资料', '无需处理', '其他'];
    var reasons = ['装货等待', '卸货等待', '排队/过磅', '充电', '司机休息', '道路拥堵', '车辆故障', '交通事故', '临时停车', '数据异常', '其他'];
    var falseReasons = speed
      ? ['GPS漂移', '设备数据异常', '数据延迟', '其他']
      : ['围栏边界异常', 'GPS 漂移', '车辆定位异常', '规则配置错误', '其他'];
    var html = '<header class="ac-drawer-header"><div><small>' + esc(event.id) + '</small><h2>处理告警</h2></div><button type="button" onclick="acCloseDrawer()" aria-label="关闭">×</button></header>'
      + '<div class="ac-drawer-body"><div class="ac-handle-context"><strong>' + esc(event.type) + '</strong>'
      + (areaStay
        ? '<span>' + esc(event.plate + ' · ' + event.driverName) + '</span><span>任务单 ' + esc(event.taskId || '—') + ' · ' + esc(event.fenceName || '—') + '</span><p>' + esc((event.currentLevel || event.level) + ' · 已停留 ' + areaStayDurationText(event)) + '</p>'
        : '<span>' + esc(event.plate + ' · ' + event.driverName + ' · ' + (event.taskId || '无任务单')) + '</span><p>' + esc(parking ? ('停车时长 ' + parkingDurationText(event) + ' · ' + (event.location || '')) : ((event.facts || [])[0] || '')) + '</p>')
      + '</div>'
      + '<section class="detail-section"><div class="detail-section-title">处理信息</div><div class="form-grid">'
      + '<div class="form-item"><label class="form-label">处理方式 <span class="req">*</span></label><select class="form-control-text" id="acHandlingType" onchange="acHandleTypeChange()"><option value="">请选择</option>' + types.map(function (type) { return option(type, type, false); }).join('') + '</select></div>'
      + (parking ? '<div class="form-item"><label class="form-label">停车原因 <span class="req">*</span></label><select class="form-control-text" id="acParkingReason"><option value="">请选择</option>' + reasons.map(function (reason) { return option(reason, reason, false); }).join('') + '</select></div>' : '')
      + (sharedHandle || speed ? '<div class="form-item" id="acFalseAlarmBox" hidden><label class="form-label">误报原因 <span class="req">*</span></label><select class="form-control-text" id="acFalseAlarmReason"><option value="">请选择</option>' + falseReasons.map(function (reason) { return option(reason, reason, false); }).join('') + '</select></div>' : '')
      + '<div class="form-item"><label class="form-label">' + (speed ? '处理结果' : '处理说明') + ' <span class="req">*</span></label><textarea class="form-control-text ac-result" id="acHandlingResult" maxlength="300" placeholder="' + (speed ? '请说明核实情况、采取的措施和后续安排。' : '请输入现场情况、已采取措施及后续安排') + '"></textarea></div>'
      + (sharedHandle ? '<div class="form-item"><label class="ac-check"><input id="acMarkDone" type="checkbox">同时标记已处理</label><div class="form-hint">首次提交将进入处理中；勾选后处理状态变为已处理，不会改变事件状态。</div></div>' : '')
      + '<div class="ac-handler-meta"><span>处理人：' + esc(store().operator) + '</span><span>提交时记录处理时间</span></div></div></section>'
      + (sharedHandle && (event.handleRecords || []).length ? '<section class="detail-section"><div class="detail-section-title">历史处理记录</div>' + handleRecordsHtml(event) + '</section>' : '')
      + '<div class="alert alert-info">' + (speed
        ? '处置只记录人工结果，不会结束超速。车辆仍在超速时，当前状态保持超速中。'
        : parking
        ? '人工处理不会改变事件状态。车辆恢复行驶或任务结束后才会结束本条停车监测。'
        : '人工标记已处理不会改变客观事件状态；若异常仍存在，事件状态仍为“发生中”。') + '</div></div>'
      + '<footer class="ac-drawer-footer"><button class="btn btn-default" type="button" onclick="acCloseDrawer()">取消</button>'
      + (sharedHandle
        ? '<button class="btn btn-default" type="button" onclick="acSubmitHandle(false)">提交处理</button><button class="btn btn-primary" type="button" onclick="acSubmitHandle(true)">标记已处理</button>'
        : '<button class="btn btn-primary" type="button" onclick="acSubmitHandle()">标记已处理</button>')
      + '</footer>';
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
      if (item.code === 'VEHICLE_OVERSPEED') {
        var unitInput = document.querySelector('.wr-duration-unit[data-level-index="' + index + '"]');
        var unit = unitInput && unitInput.value === '分钟' ? '分钟' : '秒';
        var raw = readNumber('.wr-duration', index);
        return { level: name, enabled: !!(enabledInput && enabledInput.checked), speedThreshold: readNumber('.wr-speed', index), durationSeconds: unit === '分钟' ? Math.round(raw * 60) : Math.round(raw), durationUnit: unit };
      }
      if (item.code === 'DRIVER_FATIGUE') return { level: name, enabled: !!(enabledInput && enabledInput.checked), thresholdMinutes: Math.round(readNumber('.wr-fatigue', index) * 60) };
      return { level: name, enabled: !!(enabledInput && enabledInput.checked), threshold: readNumber('.wr-threshold', index) };
    });
  }
  function validateLevels(item, levels) {
    var enabledLevels = levels.filter(function (level) { return level.enabled; });
    if (item.code === 'VEHICLE_OVERSPEED') {
      if (!enabledLevels.length) return '请至少启用一个预警等级';
      for (var speedIndex = 0; speedIndex < enabledLevels.length; speedIndex += 1) {
        var speedValue = Number(enabledLevels[speedIndex].speedThreshold);
        var durationValue = Number(enabledLevels[speedIndex].durationSeconds);
        if (!isFinite(speedValue) || speedValue <= 0) return '车速阈值必须大于 0';
        if (!isFinite(durationValue) || durationValue <= 0 || !Number.isInteger(durationValue)) return '持续时间必须大于 0';
        if (speedIndex > 0 && speedValue <= Number(enabledLevels[speedIndex - 1].speedThreshold)) return '高级别预警的车速阈值必须高于低级别预警。';
      }
      return '';
    }
    if (!enabledLevels.length) return '请至少启用一个预警等级';
    var fieldName = item.code === 'VEHICLE_OVERSPEED' ? 'speedThreshold' : item.code === 'DRIVER_FATIGUE' ? 'thresholdMinutes' : 'threshold';
    var values = enabledLevels.map(function (level) { return Number(level[fieldName]); });
    if (values.some(function (value) { return !isFinite(value) || value <= 0; })) return '请填写已启用等级的有效阈值';
    if (values.filter(function (value, index) { return values.indexOf(value) !== index; }).length) return '禁止保存重复阈值';
    for (var index = 1; index < values.length; index += 1) {
      var ordered = item.code === 'VEHICLE_LOW_SOC' ? values[index - 1] > values[index] : values[index - 1] < values[index];
      if (!ordered) return enabledLevels[index].level + '等级' + (item.code === 'VEHICLE_LOW_SOC' ? ' SOC 阈值必须低于' : '阈值必须高于') + enabledLevels[index - 1].level + '等级';
    }
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
      scope: selectedScopeMode(),
      departmentIds: checkedValues('wrDeptIds'),
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
  function areaStayFormFingerprint() {
    if (!document.getElementById('acAreaStayModalHost')) return '';
    return JSON.stringify({
      name: ((document.getElementById('wrName') || {}).value || '').trim(),
      enabled: (document.getElementById('wrEnabled') || {}).value || '启用',
      scope: (document.getElementById('wrScope') || {}).value || '全部项目',
      areaType: (document.getElementById('wrAreaType') || {}).value || '全部类型',
      fenceMode: (document.querySelector('#acAreaStayModalHost input[name="wrFenceMode"]:checked') || {}).value || '',
      projectIds: checkedValues('wrAreaProjects'),
      fenceIds: checkedValues('wrAreaFences'),
      levels: readLevels({ code: 'AREA_STAY_TIMEOUT' })
    });
  }
  function openAreaStayModal(mode, rule) {
    closeAreaStayModal(true);
    currentState().areaStayModal = { mode: mode, rule: rule, baseline: '' };
    var host = document.createElement('div');
    host.id = 'acAreaStayModalHost';
    host.className = 'modal-overlay show ac-parking-modal-host';
    host.innerHTML = areaStayModalHtml(rule, mode);
    host.addEventListener('click', function (event) { if (event.target === host) window.acCloseAreaStayModal(); });
    document.body.appendChild(host);
    currentState().areaStayModal.baseline = areaStayFormFingerprint();
    window.acAreaStayFenceMode();
  }
  function closeAreaStayModal(force) {
    if (!document.getElementById('acAreaStayModalHost')) {
      currentState().areaStayModal = null;
      return true;
    }
    if (!force && currentState().areaStayModal && areaStayFormFingerprint() !== currentState().areaStayModal.baseline) {
      if (!window.confirm('当前修改尚未保存，确定关闭？')) return false;
    }
    var host = document.getElementById('acAreaStayModalHost');
    if (host) host.remove();
    currentState().areaStayModal = null;
    return true;
  }
  function saveAreaStayRule() {
    var modal = currentState().areaStayModal;
    if (!modal || !modal.rule) return;
    var item = modal.rule;
    var name = ((document.getElementById('wrName') || {}).value || '').trim();
    if (!name) { toast('请填写规则名称'); return; }
    if (name.length > 40) { toast('规则名称最多 40 字'); return; }
    var enabled = ((document.getElementById('wrEnabled') || {}).value || '启用') === '启用';
    var scope = (document.getElementById('wrScope') || {}).value || '全部项目';
    var areaType = (document.getElementById('wrAreaType') || {}).value || '全部类型';
    var fenceMode = ((document.querySelector('#acAreaStayModalHost input[name="wrFenceMode"]:checked') || {}).value) || '全部符合条件围栏';
    var projects = Array.prototype.map.call(document.querySelectorAll('#acAreaStayModalHost input[name="wrAreaProjects"]:checked'), function (input) {
      return { id: input.value, name: input.getAttribute('data-name') || input.value };
    });
    var fences = Array.prototype.map.call(document.querySelectorAll('#acAreaStayModalHost input[name="wrAreaFences"]:checked'), function (input) {
      return { id: input.value, name: input.getAttribute('data-name') || input.value };
    });
    if (scope === '指定项目' && !projects.length) { toast('请选择至少一个指定项目'); return; }
    if (fenceMode === '指定围栏' && !fences.length) { toast('请选择至少一个指定围栏'); return; }
    var levels = readLevels({ code: 'AREA_STAY_TIMEOUT' });
    var error = validateLevels({ code: 'AREA_STAY_TIMEOUT' }, levels);
    if (error) { toast(error); return; }
    var patch = {
      name: name, enabled: enabled, scopeType: scope, areaType: areaType, levels: levels,
      projectIds: scope === '指定项目' ? projects.map(function (item) { return item.id; }) : [],
      projectNames: scope === '指定项目' ? projects.map(function (item) { return item.name; }) : [],
      fenceIds: fenceMode === '指定围栏' ? fences.map(function (item) { return item.id; }) : [],
      fenceNames: fenceMode === '指定围栏' ? fences.map(function (item) { return item.name; }) : []
    };
    var saved = modal.mode === 'create' ? store().addAreaStayRule(patch) : store().updateRule(item.id, patch);
    if (saved && saved.error) { toast(saved.error); return; }
    closeAreaStayModal(true);
    rerender();
    toast(saved && saved.warning ? saved.warning : '保存成功');
  }
  function speedFormFingerprint() {
    if (!document.getElementById('acSpeedModalHost')) return '';
    return JSON.stringify({
      name: ((document.getElementById('wrName') || {}).value || '').trim(),
      enabled: (document.getElementById('wrEnabled') || {}).value || '启用',
      source: (document.getElementById('wrSpeedSource') || {}).value || '',
      scope: (document.getElementById('wrScope') || {}).value || '全部项目',
      projectIds: checkedValues('wrSpeedProjects'),
      recoverSpeed: (document.getElementById('wrRecoverSpeed') || {}).value || '',
      recoverSeconds: (document.getElementById('wrRecoverSeconds') || {}).value || '',
      levels: readLevels({ code: 'VEHICLE_OVERSPEED' })
    });
  }
  function openSpeedModal(mode, rule) {
    closeSpeedModal(true);
    currentState().speedModal = { mode: mode, rule: rule, baseline: '' };
    var host = document.createElement('div');
    host.id = 'acSpeedModalHost';
    host.className = 'modal-overlay show ac-parking-modal-host';
    host.innerHTML = speedModalHtml(rule, mode);
    host.addEventListener('click', function (event) { if (event.target === host) window.acCloseSpeedModal(); });
    document.body.appendChild(host);
    currentState().speedModal.baseline = speedFormFingerprint();
  }
  function closeSpeedModal(force) {
    if (!document.getElementById('acSpeedModalHost')) {
      currentState().speedModal = null;
      return true;
    }
    if (!force && currentState().speedModal && speedFormFingerprint() !== currentState().speedModal.baseline) {
      if (!window.confirm('当前修改尚未保存，确定关闭？')) return false;
    }
    var host = document.getElementById('acSpeedModalHost');
    if (host) host.remove();
    currentState().speedModal = null;
    return true;
  }
  function saveSpeedRule() {
    var modal = currentState().speedModal;
    if (!modal || !modal.rule) return;
    var item = modal.rule;
    var name = ((document.getElementById('wrName') || {}).value || '').trim();
    if (!name) { toast('请填写规则名称'); return; }
    if (name.length > 40) { toast('规则名称最多 40 字'); return; }
    var enabled = ((document.getElementById('wrEnabled') || {}).value || '启用') === '启用';
    var scope = (document.getElementById('wrScope') || {}).value || '全部项目';
    var recoverSpeed = Number((document.getElementById('wrRecoverSpeed') || {}).value);
    var recoverSeconds = Number((document.getElementById('wrRecoverSeconds') || {}).value);
    if (!isFinite(recoverSpeed) || recoverSpeed <= 0) { toast('恢复车速阈值必须大于 0'); return; }
    if (!Number.isInteger(recoverSeconds) || recoverSeconds <= 0) { toast('恢复持续时间必须大于 0'); return; }
    var projectIds = checkedValues('wrSpeedProjects');
    var projectNames = Array.prototype.map.call(document.querySelectorAll('#acSpeedModalHost input[name="wrSpeedProjects"]:checked'), function (input) {
      return input.getAttribute('data-name') || input.value;
    });
    if (scope === '指定项目' && !projectIds.length) { toast('请选择至少一个项目'); return; }
    var levels = readLevels({ code: 'VEHICLE_OVERSPEED' });
    var error = validateLevels({ code: 'VEHICLE_OVERSPEED' }, levels);
    if (error) { toast(error); return; }
    var patch = {
      name: name, enabled: enabled, scopeType: scope, levels: levels,
      speedSourcePolicy: (document.getElementById('wrSpeedSource') || {}).value || 'CAN_THEN_GPS',
      projectIds: scope === '指定项目' ? projectIds : [],
      projectNames: scope === '指定项目' ? projectNames : [],
      recoveryConfig: { recoverSpeedKph: recoverSpeed, recoverDurationSeconds: recoverSeconds }
    };
    var saved = modal.mode === 'create' ? store().addSpeedRule(patch) : store().updateRule(item.id, patch);
    if (saved && saved.error) { toast(saved.error); return; }
    closeSpeedModal(true);
    rerender();
    toast(saved && saved.warning ? saved.warning : '保存成功');
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
    var scope = selectedScopeMode();
    var depts = scope === '组织部门' ? checkedDeptRecords() : [];
    var vehiclePlates = scope === '自定义车辆' ? checkedValues('wrVehiclePlates') : [];
    if (scope === '组织部门' && !depts.length) { toast('请选择至少一个组织部门'); return; }
    if (scope === '自定义车辆' && !vehiclePlates.length) { toast('请选择至少一辆车'); return; }
    var patch = {
      name: name, enabled: enabled, monitorPeriod: monitorPeriod, monitorStart: monitorStart, monitorEnd: monitorEnd,
      levels: levels, scopeType: scope, projectIds: [], projectNames: [],
      departmentIds: depts.map(function (dept) { return dept.id; }),
      departmentNames: depts.map(function (dept) { return dept.name; }),
      vehiclePlates: vehiclePlates,
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
    if (isAreaStayType(type)) { saveAreaStayRule(); return; }
    if (isSpeedType(type)) { saveSpeedRule(); return; }
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
    if (item.code === 'VEHICLE_OVERSPEED') {
      patch.projectIds = item.projectIds;
      patch.projectNames = item.projectNames;
      patch.speedSourcePolicy = item.speedSourcePolicy;
    }
    if (isAreaStayType(item) || item.code === 'AREA_STAY_TIMEOUT') {
      patch.scopeType = item.scopeType;
      patch.projectIds = item.projectIds;
      patch.projectNames = item.projectNames;
      patch.areaType = item.areaType;
      patch.fenceIds = item.fenceIds;
      patch.fenceNames = item.fenceNames;
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
      acBindDeptTree();
      if (drawerMode === 'detail' && drawerEventId && document.getElementById('acDrawerHost')) {
        var drawerBody = document.querySelector('#acDrawerHost .ac-drawer-body');
        var drawerScroll = drawerBody ? drawerBody.scrollTop : 0;
        var openId = drawerEventId;
        detailDrawer(openId);
        var nextBody = document.querySelector('#acDrawerHost .ac-drawer-body');
        if (nextBody) nextBody.scrollTop = drawerScroll;
      }
    };
  }

  window.acCloseDeptTree = function () {
    var wrap = deptFilterWrap();
    if (!wrap) return;
    var panel = wrap.querySelector('[data-org-panel]');
    var trigger = wrap.querySelector('[data-org-trigger]');
    wrap.classList.remove('is-open');
    if (panel) panel.hidden = true;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  };
  window.acToggleDeptTree = function (event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    var wrap = deptFilterWrap();
    if (!wrap) return;
    if (wrap.classList.contains('is-open')) { window.acCloseDeptTree(); return; }
    var panel = wrap.querySelector('[data-org-panel]');
    var trigger = wrap.querySelector('[data-org-trigger]');
    var search = wrap.querySelector('[data-org-search]');
    wrap.classList.add('is-open');
    if (panel) panel.hidden = false;
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    if (search) { search.value = ''; window.acFilterDeptTree(''); search.focus(); }
  };
  window.acFilterDeptTree = function (keyword) {
    var wrap = deptFilterWrap();
    var list = wrap && wrap.querySelector('[data-org-list]');
    var input = wrap && wrap.querySelector('#acProject');
    if (list) list.innerHTML = orgTreeListHtml(input ? input.value : '', keyword);
  };
  window.acPickDept = function (name) {
    var wrap = deptFilterWrap();
    var input = wrap && wrap.querySelector('#acProject');
    var label = wrap && wrap.querySelector('[data-org-label]');
    if (input) input.value = name || '';
    if (label) {
      label.textContent = name || '全部部门';
      label.classList.toggle('is-placeholder', !name);
    }
    window.acCloseDeptTree();
    window.acApply();
  };
  function acBindDeptTree() {
    if (window.__acDeptTreeBound) return;
    window.__acDeptTreeBound = true;
    document.addEventListener('click', function (event) {
      var open = document.querySelector('.ac-org-filter.is-open');
      if (!open || open.contains(event.target)) return;
      window.acCloseDeptTree();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') window.acCloseDeptTree();
    });
  }
  window.acTab = function (tab) { if (!closeParkingModal() || !closeAreaStayModal() || !closeSpeedModal()) return; currentState().tab = tab === 'rules' ? 'rules' : 'list'; closeDrawer(); rerender(); };
  window.acApply = function () { readFilters(); currentState().activeMetric = ''; rerender(); };
  window.acReset = function () { var state = currentState(); state.filters = blankFilters(currentType()); state.activeMetric = ''; rerender(); };
  window.acStatus = function (status) {
    var state = currentState();
    if (isSpeedType(currentType())) {
      state.filters.speedView = status;
      state.filters.eventStatus = '';
    } else state.filters.eventStatus = status;
    state.activeMetric = '';
    rerender();
  };
  window.acMetric = function (key) {
    var state = currentState();
    var speed = isSpeedType(currentType());
    state.activeMetric = state.activeMetric === key ? '' : key;
    if (speed) state.filters.speedView = '';
    else if (state.filters.eventStatus != null && state.activeMetric) state.filters.eventStatus = '发生中';
    rerender();
  };
  window.acRefresh = function () { store().refresh(); rerender(); toast('告警数据已刷新'); };
  window.acView = detailDrawer;
  window.acCloseDrawer = closeDrawer;
  window.acAck = function (id) { store().acknowledge(id); rerender(); toast('已知悉告警，处理状态已更新为处理中'); };
  window.acHandle = handleDrawer;
  window.acHandleTypeChange = function () {
    var box = document.getElementById('acFalseAlarmBox');
    var type = ((document.getElementById('acHandlingType') || {}).value || '').trim();
    if (box) box.hidden = type !== '误报' && type !== '确认误报';
  };
  window.acSubmitHandle = function (markDone) {
    var type = ((document.getElementById('acHandlingType') || {}).value || '').trim();
    var result = ((document.getElementById('acHandlingResult') || {}).value || '').trim();
    var reasonEl = document.getElementById('acParkingReason');
    var parkingReason = reasonEl ? String(reasonEl.value || '').trim() : '';
    var falseEl = document.getElementById('acFalseAlarmReason');
    var falseReason = falseEl ? String(falseEl.value || '').trim() : '';
    var markBox = document.getElementById('acMarkDone');
    if (!type) { toast('请选择处理方式'); return; }
    if (reasonEl && !parkingReason) { toast('请选择停车原因'); return; }
    if ((type === '误报' || type === '确认误报') && falseEl && !falseReason) { toast('请选择误报原因'); return; }
    if (!result) { toast((isParkingType(currentType()) || isAreaStayType(currentType())) ? '请填写处理说明' : '请填写处理结果'); return; }
    var extra = {};
    if (parkingReason) extra.parkingReason = parkingReason;
    if (falseReason) extra.falseAlarmReason = falseReason;
    extra.markDone = markDone === true || !!(markBox && markBox.checked) || type === '误报' || type === '确认误报' || type === '无需处理';
    var handlingId = drawerEventId;
    var before = store().getEvent(handlingId);
    var saved = store().handle(handlingId, type, result, extra);
    if (saved && saved.error) { toast(saved.error); return; }
    closeDrawer();
    rerender();
    if (before && before.ruleCode === 'VEHICLE_OVERSPEED') toast(saved && saved.eventStatus === '发生中' ? '已记录处置。车辆仍在超速，事件不会因此恢复' : '已记录处置');
    else toast(extra.markDone ? '已记录处理结果，处理状态更新为已处理' : (type === '继续观察' ? '已记录处理，事件仍为发生中' : '已记录处理'));
  };
  window.acOpenTask = function (id) {
    closeDrawer();
    if (window.app && window.app.pages['task-order-management']) app.navigate('task-order-management');
    else toast('任务单 ' + id);
  };
  window.acExport = exportCsv;
  window.acSaveRule = saveRule;
  window.acSaveParkingRule = saveParkingRule;
  window.acSaveSpeedRule = saveSpeedRule;
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
  window.acAreaRuleApply = function () {
    var filters = currentState().areaStayRuleFilters;
    filters.name = ((document.getElementById('acRuleName') || {}).value || '').trim();
    filters.scopeType = (document.getElementById('acRuleScope') || {}).value || '';
    filters.status = (document.getElementById('acRuleStatus') || {}).value || '';
    rerender();
  };
  window.acAreaRuleReset = function () {
    currentState().areaStayRuleFilters = { name: '', scopeType: '', status: '' };
    rerender();
  };
  window.acAddAreaStayRule = function () {
    openAreaStayModal('create', store().getAreaStayDraftTemplate());
  };
  window.acEditAreaStayRule = function (id) {
    var rule = store().getRule(id);
    if (!rule) { toast('未找到规则'); return; }
    openAreaStayModal('edit', rule);
  };
  window.acCloseAreaStayModal = function () { closeAreaStayModal(false); };
  window.acSpeedRuleApply = function () {
    var filters = currentState().speedRuleFilters;
    filters.name = ((document.getElementById('acRuleName') || {}).value || '').trim();
    filters.scopeType = (document.getElementById('acRuleScope') || {}).value || '';
    filters.status = (document.getElementById('acRuleStatus') || {}).value || '';
    rerender();
  };
  window.acSpeedRuleReset = function () {
    currentState().speedRuleFilters = { name: '', scopeType: '', status: '' };
    rerender();
  };
  window.acAddSpeedRule = function () {
    openSpeedModal('create', store().getSpeedDraftTemplate());
  };
  window.acEditSpeedRule = function (id) {
    var rule = store().getRule(id);
    if (!rule) { toast('未找到规则'); return; }
    openSpeedModal('edit', rule);
  };
  window.acCloseSpeedModal = function () { closeSpeedModal(false); };
  window.acRemoveSpeedRule = function (id) {
    if (!window.confirm('删除后该规则不再用于新的车速预警，已产生告警不受影响。确定删除？')) return;
    var result = store().removeRule(id);
    if (result && result.error) { toast(result.error); return; }
    rerender();
    toast('规则已删除');
  };
  window.acRemoveAreaStayRule = function (id) {
    if (!window.confirm('删除后该规则不再用于新的区域停留预警，已产生告警不受影响。确定删除？')) return;
    var result = store().removeRule(id);
    if (result && result.error) { toast(result.error); return; }
    rerender();
    toast('规则已删除');
  };
  window.acAreaStayScopeChange = function () {
    var box = document.getElementById('wrAreaProjectBox');
    var scope = document.getElementById('wrScope');
    if (box && scope) box.hidden = scope.value !== '指定项目';
    window.acAreaStayFenceFilter();
  };
  window.acAreaStayFenceMode = function () {
    var box = document.getElementById('wrAreaFenceBox');
    var checked = document.querySelector('#acAreaStayModalHost input[name="wrFenceMode"]:checked');
    if (box) box.hidden = !(checked && checked.value === '指定围栏');
    window.acAreaStayFenceFilter();
  };
  window.acAreaStayFenceFilter = function () {
    var list = document.getElementById('wrAreaFenceList');
    if (!list) return;
    var modal = currentState().areaStayModal;
    if (!modal || !modal.rule) return;
    var draft = cloneSafe(modal.rule);
    draft.scopeType = (document.getElementById('wrScope') || {}).value || draft.scopeType;
    draft.areaType = (document.getElementById('wrAreaType') || {}).value || draft.areaType;
    draft.projectIds = checkedValues('wrAreaProjects');
    var selected = checkedValues('wrAreaFences');
    var fences = areaStayFenceOptions(draft);
    list.innerHTML = fences.length ? fences.map(function (fence) {
      return '<label class="ac-vehicle-option ac-check" data-fence="' + esc(fence.name) + '"><input type="checkbox" name="wrAreaFences" value="' + esc(fence.id) + '" data-name="' + esc(fence.name) + '"' + (selected.indexOf(fence.id) >= 0 ? ' checked' : '') + '>' + esc(fence.name) + '<small>' + esc(fence.type + ' · ' + fence.projectName) + '</small></label>';
    }).join('') : '<div class="ac-org-empty">当前项目 / 区域类型下没有可选围栏</div>';
    var count = document.getElementById('wrFenceCount');
    if (count) count.textContent = '已选择 ' + checkedValues('wrAreaFences').length + ' 个围栏';
  };
  window.acFilterAreaFences = function () {
    var q = ((document.getElementById('wrFenceQuery') || {}).value || '').trim().toLowerCase();
    Array.prototype.forEach.call(document.querySelectorAll('#acAreaStayModalHost .ac-vehicle-option'), function (row) {
      row.hidden = !!(q && String(row.getAttribute('data-fence') || '').toLowerCase().indexOf(q) < 0);
    });
  };
  function cloneSafe(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }
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
  window.acFilterOrg = function () {
    var q = ((document.getElementById('wrOrgQuery') || {}).value || '').trim().toLowerCase();
    Array.prototype.forEach.call(document.querySelectorAll('#acParkingModalHost .ac-org-group'), function (group) {
      var orgName = String(group.getAttribute('data-org-name') || '').toLowerCase();
      var orgHit = !q || orgName.indexOf(q) >= 0;
      var any = false;
      Array.prototype.forEach.call(group.querySelectorAll('.ac-org-dept'), function (row) {
        var deptName = String(row.getAttribute('data-dept-name') || '').toLowerCase();
        var show = orgHit || deptName.indexOf(q) >= 0;
        row.hidden = !show;
        if (show) any = true;
      });
      group.hidden = !any;
    });
  };
  window.acFilterVehicles = function () {
    var q = ((document.getElementById('wrVehicleQuery') || {}).value || '').trim().toLowerCase();
    Array.prototype.forEach.call(document.querySelectorAll('#acParkingModalHost .ac-vehicle-option'), function (row) {
      row.hidden = !!(q && String(row.getAttribute('data-plate') || '').toLowerCase().indexOf(q) < 0);
    });
  };
  window.acOrgToggle = function (input) {
    var orgId = input.getAttribute('data-org-toggle');
    Array.prototype.forEach.call(document.querySelectorAll('#acParkingModalHost input[name="wrDeptIds"]'), function (box) {
      var label = box.closest('.ac-org-dept');
      if (label && label.getAttribute('data-org-id') === orgId) box.checked = input.checked;
    });
    window.acParkingCount();
  };
  window.acVehicleSelectAll = function (checked) {
    Array.prototype.forEach.call(document.querySelectorAll('#acParkingModalHost input[name="wrVehiclePlates"]'), function (box) {
      box.checked = !!checked;
    });
    window.acParkingCount();
  };
  window.acParkingCount = function () {
    var orgCount = document.getElementById('wrOrgCount');
    var vehicleCount = document.getElementById('wrVehicleCount');
    if (orgCount) orgCount.textContent = '已选择 ' + checkedValues('wrDeptIds').length + ' 个部门';
    if (vehicleCount) vehicleCount.textContent = '已选择 ' + checkedValues('wrVehiclePlates').length + ' 辆';
    Array.prototype.forEach.call(document.querySelectorAll('#acParkingModalHost [data-org-toggle]'), function (toggle) {
      var orgId = toggle.getAttribute('data-org-toggle');
      var boxes = Array.prototype.filter.call(document.querySelectorAll('#acParkingModalHost input[name="wrDeptIds"]'), function (box) {
        var label = box.closest('.ac-org-dept');
        return label && label.getAttribute('data-org-id') === orgId;
      });
      var checkedCount = boxes.filter(function (box) { return box.checked; }).length;
      toggle.checked = boxes.length > 0 && checkedCount === boxes.length;
      toggle.indeterminate = checkedCount > 0 && checkedCount < boxes.length;
    });
  };
  window.acScopeChange = function () {
    var project = document.getElementById('wrProject');
    var scope = document.getElementById('wrScope');
    var orgBox = document.getElementById('wrOrgBox');
    var vehicleBox = document.getElementById('wrVehicleBox');
    if (project && scope) project.disabled = scope.value !== '指定项目';
    var speedProjects = document.getElementById('wrSpeedProjects');
    if (speedProjects && scope) speedProjects.hidden = scope.value !== '指定项目';
    if (orgBox || vehicleBox) {
      var mode = selectedScopeMode();
      if (orgBox) orgBox.hidden = mode !== '组织部门';
      if (vehicleBox) vehicleBox.hidden = mode !== '自定义车辆';
    }
    window.acParkingCount();
  };
  window.addEventListener('hashchange', function () { closeParkingModal(true); closeAreaStayModal(true); closeSpeedModal(true); closeDrawer(); });

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
