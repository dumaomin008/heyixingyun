/* 告警中心：六类菜单共用一套列表、规则弹框、详情抽屉和处理抽屉。 */
(function () {
  'use strict';

  var LEVEL_NAMES = ['一般', '严重', '紧急'];
  var HANDLE_STATUSES = ['待处理', '处理中', '已处理'];
  var HOST = '#acRuleModalHost';

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
  function activeMatch(event) { return event.eventStatus === '发生中'; }
  function pendingMatch(event) { return event.handleStatus === '待处理'; }
  function todayMatch(event) { return isTodayStamp(event.alertCreatedAt || event.triggeredAt); }
  function urgentTodayMatch(event) {
    var level = event.maxAlertLevel || event.maxLevel || event.level;
    return level === '紧急' && isTodayStamp(event.criticalAt || event.currentLevelTriggerTime || event.triggeredAt);
  }
  function decisionMetrics(labels, extras) {
    return [
      { key: 'current', label: labels[0], copy: '仍在发生', tone: 'red', status: '发生中', count: extras && extras.plates ? 'plates' : '', match: activeMatch },
      { key: 'today', label: labels[1], copy: (extras && extras.todayCopy) || (labels[1] === '今日车速预警' ? '今日新产生的超速事件' : '今日新产生'), tone: 'blue', match: extras && extras.today ? extras.today : todayMatch },
      { key: 'urgent', label: labels[2], copy: extras && extras.urgentCopy ? extras.urgentCopy : '今日升至紧急', tone: 'orange', status: extras && extras.urgentStatus ? extras.urgentStatus : '', match: extras && extras.urgent ? extras.urgent : urgentTodayMatch },
      { key: 'pending', label: '待处理', copy: '尚未处置', tone: 'amber', handle: '待处理', match: pendingMatch }
    ];
  }

  var TYPES = [
    {
      page: 'alert-parking', code: 'TRANSPORT_PARKING', name: '停车预警',
      summary: '运输任务执行中识别持续静止，排除装卸与充电后按分级时长触发。',
      orgLabel: '所属部门', activeLabel: '发生中', orgKind: 'dept',
      protectedId: 'RULE_TRANSPORT_PARKING', ruleTitle: '停车超时规则',
      scopeOptions: ['组织部门', '自定义车辆'],
      columns: listColumns('所属部门', [
        { key: 'parkingDuration', label: '停车时长' }, { key: 'location', label: '当前/停车位置' },
        { key: 'parkingStartedAt', label: '停车开始时间' }, { key: 'triggeredAt', label: '告警时间' },
        { key: 'parkingEndedAt', label: '停车结束时间' }
      ]),
      metrics: decisionMetrics(['当前停车告警', '今日新增', '今日紧急']),
      handleOptions: ['继续观察', '联系司机', '联系场站', '调整任务', '车辆故障处理', '误报', '无需处理', '其他'],
      falseAlarmReasons: ['围栏边界异常', 'GPS 漂移', '车辆定位异常', '规则配置错误', '其他'],
      parkingReasons: ['装货等待', '卸货等待', '排队/过磅', '充电', '司机休息', '道路拥堵', '车辆故障', '交通事故', '临时停车', '数据异常', '其他'],
      handleHint: '提交处理和标记已处理只更新处理状态。车辆恢复行驶或任务结束后，停车监测才会结束。',
      note: '同一次连续停车只产生一条告警，达到更高等级时在原事件上升级。修改规则只影响之后新触发的预警。'
    },
    {
      page: 'alert-parking-area', code: 'AREA_STAY_TIMEOUT', name: '区域停留预警',
      summary: '车辆进入电子围栏后持续未离开，按停留时长分级升级，离开围栏后自动恢复。',
      orgLabel: '所属项目', activeLabel: '发生中', orgKind: 'project',
      extraLabel: '围栏名称', extraPlaceholder: '围栏名称',
      protectedId: 'RULE_AREA_STAY', ruleTitle: '区域停留规则',
      scopeOptions: ['全部项目', '指定项目', '区域类型', '指定围栏'],
      columns: listColumns('所属项目', [
        { key: 'stayDuration', label: '当前停留时长' }, { key: 'transportStage', label: '当前运输阶段' },
        { key: 'fenceName', label: '围栏名称' }, { key: 'fenceType', label: '围栏类型' },
        { key: 'enteredAt', label: '进入围栏时间' }
      ]),
      metrics: decisionMetrics(['当前超时停留', '今日新增', '今日紧急']),
      handleOptions: ['继续观察', '联系司机', '联系场站', '调整任务', '车辆故障处理', '误报', '无需处理', '其他'],
      falseAlarmReasons: ['围栏边界异常', 'GPS 漂移', '车辆定位异常', '规则配置错误', '其他'],
      handleHint: '提交处理和标记已处理只更新处理状态。车辆离开产生告警的围栏后，事件才会恢复。',
      note: '同一车辆一次连续停留同一围栏只保留一条事件。指定围栏优先于区域类型，再优先于项目默认和系统默认。'
    },
    {
      page: 'alert-overspeed', code: 'VEHICLE_OVERSPEED', name: '车速预警',
      summary: '同一段连续超速只保留一条告警，等级只升不降；车速回到恢复阈值并持续满足后自动恢复。',
      orgLabel: '所属项目', activeLabel: '超速中', orgKind: 'project',
      protectedId: 'RULE_VEHICLE_OVERSPEED', ruleTitle: '车速预警规则',
      scopeOptions: ['全部项目', '指定项目'],
      columns: listColumns('所属项目', [
        { key: 'speed', label: '当前车速' }, { key: 'overspeedDuration', label: '连续超速时长' },
        { key: 'location', label: '当前地点' }, { key: 'triggeredAt', label: '告警时间' }
      ]),
      metrics: decisionMetrics(['当前超速车辆', '今日车速预警', '今日紧急'], { plates: true }),
      handleOptions: ['电话提醒司机', '通知车队长', '安全教育', '确认误报', '无需处理', '其他'],
      falseAlarmReasons: ['GPS漂移', '设备数据异常', '数据延迟', '其他'],
      handleHint: '处置只记录人工结果。车辆仍在超速时，事件保持超速中，直到车速回到恢复条件。',
      note: '同一段连续超速只保留一个告警编号，等级只升不降。尖峰过滤为固定策略。确认误报的事件不计入车速统计。'
    },
    {
      page: 'alert-weighbill', code: 'UNLOAD_WEIGHBILL_MISSING', name: '卸货后未上传磅单',
      summary: '车辆完成卸货并有效离开卸货地后，超过补录窗口仍未提交卸货磅单时触发。',
      orgLabel: '所属项目', activeLabel: '待上传中', orgKind: 'project',
      extraLabel: '卸货地', extraPlaceholder: '卸货区域 / 地点',
      protectedId: 'RULE_UNLOAD_WEIGHBILL_MISSING', ruleTitle: '磅单预警规则',
      scopeOptions: ['全部项目', '指定项目'],
      columns: listColumns('所属项目', [
        { key: 'waitingMinutes', label: '已超时' }, { key: 'unloadLocation', label: '卸货地' },
        { key: 'unloadDepartedAt', label: '离开卸货地时间' }, { key: 'departSource', label: '离场时间来源' },
        { key: 'weighbillStatus', label: '磅单状态' }, { key: 'triggeredAt', label: '告警时间' }
      ]),
      metrics: decisionMetrics(['当前待上传', '今日新增', '超60分钟'], {
        urgentCopy: '发生中且已超时 60 分钟',
        urgentStatus: '发生中',
        urgent: function (event) { return activeMatch(event) && Number((event.metrics || {}).waitingMinutes) >= 60; }
      }),
      handleOptions: ['提醒司机上传', '联系现场确认', '后台协助补传', '确认无需磅单', '确认误报', '其他'],
      falseAlarmReasons: ['数据异常', '重复任务', '磅单已线下收取', '其他'],
      noBillReasons: ['客户确认无需过磅', '现场无法过磅', '其他'],
      handleHint: '提醒、联系和协助补传只更新处理状态。确认无需磅单会结束本条告警并保留原因。',
      note: '只在任务有效、卸货节点成立且已确认离场后计时。经过围栏、上传中和无需磅单不会触发。'
    },
    {
      page: 'alert-soc', code: 'VEHICLE_LOW_SOC', name: 'SOC预警',
      summary: '有效 SOC 持续低于分级阈值并完成确认后触发；充电后须回到恢复阈值才关闭。',
      orgLabel: '所属项目', activeLabel: '低SOC中', orgKind: 'project',
      protectedId: 'RULE_VEHICLE_LOW_SOC', ruleTitle: 'SOC预警规则',
      scopeOptions: ['全部项目', '指定项目'],
      columns: listColumns('所属项目', [
        { key: 'soc', label: '当前SOC' }, { key: 'chargingStatus', label: '充电状态' },
        { key: 'location', label: '当前/最后位置' }, { key: 'socDataAt', label: 'SOC数据时间' },
        { key: 'triggeredAt', label: '告警时间' }
      ]),
      metrics: decisionMetrics(['当前低SOC车辆', 'SOC≤20%', 'SOC≤10%'], {
        plates: true,
        todayCopy: '发生中且 SOC ≤ 20%',
        urgentCopy: '发生中且 SOC ≤ 10%',
        urgentStatus: '发生中',
        today: function (event) { return activeMatch(event) && Number((event.metrics || {}).soc) <= 20; },
        urgent: function (event) { return activeMatch(event) && Number((event.metrics || {}).soc) <= 10; }
      }),
      handleOptions: ['提醒司机关注电量', '建议就近充电', '联系调度调整任务', '联系车队长', '车辆/电池异常排查', '确认误报', '无需处理', '其他'],
      falseAlarmReasons: ['数据异常', 'SOC数据延迟', '设备异常', '其他'],
      handleHint: '人工处理只更新处理状态。SOC 回到恢复阈值并持续满足后，事件才会恢复。',
      note: '单点 SOC 抖动不会立即告警。数据过期不产生新告警，也不把过期数据当成新的异常类型。'
    },
    {
      page: 'alert-fatigue', code: 'DRIVER_FATIGUE', name: '疲劳驾驶预警',
      summary: '以司机和连续驾驶周期判断疲劳风险；短停不重置，达到有效休息或更换司机后结束。',
      orgLabel: '所属项目', activeLabel: '疲劳风险中', orgKind: 'project',
      protectedId: 'RULE_DRIVER_FATIGUE', ruleTitle: '疲劳驾驶规则',
      scopeOptions: ['全部项目', '指定项目'],
      columns: listColumns('所属项目', [
        { key: 'continuousDriving', label: '连续驾驶时长' }, { key: 'drivingStartedAt', label: '驾驶开始时间' },
        { key: 'currentSpeed', label: '当前车速' }, { key: 'recentParking', label: '最近停车时长' },
        { key: 'triggeredAt', label: '告警时间' }
      ]),
      metrics: decisionMetrics(['当前疲劳驾驶', '≥4小时', '紧急风险'], {
        todayCopy: '发生中且连续驾驶达到 4 小时',
        urgentCopy: '发生中的紧急风险',
        urgentStatus: '发生中',
        today: function (event) { return activeMatch(event) && Number((event.metrics || {}).continuousDrivingMinutes) >= 240; },
        urgent: function (event) { return activeMatch(event) && (event.maxLevel || event.level) === '紧急'; }
      }),
      handleOptions: ['电话提醒司机', '通知司机尽快休息', '通知车队长', '调整运输任务', '安排换司机', '安全教育', '确认误报', '无需处理', '其他'],
      falseAlarmReasons: ['司机绑定错误', '车辆数据异常', '速度数据异常', '驾驶周期计算异常', '其他'],
      handleHint: '人工处理只更新处理状态。达到有效休息或更换司机后，当前驾驶周期才会结束。',
      note: '告警主体是司机和连续驾驶周期。短停计入本周期，达到有效休息才结束；数据失效时暂停累计。'
    }
  ];

  TYPES[1].metrics[0].match = activeMatch;
  TYPES[4].metrics[0].count = 'plates';

  var pageState = {};
  var drawerEventId = '';
  var drawerMode = '';
  var savedMainScroll = 0;

  function typeByPage(page) { return TYPES.filter(function (item) { return item.page === page; })[0] || null; }
  function typeByCode(code) {
    if (code === 'PARKING_AREA') code = 'AREA_STAY_TIMEOUT';
    return TYPES.filter(function (item) { return item.code === code; })[0] || TYPES[0];
  }
  function isAreaCode(code) { return code === 'AREA_STAY_TIMEOUT' || code === 'PARKING_AREA'; }
  function blankFilters() {
    return {
      project: '', level: '', handleStatus: '', keyword: '', extra: '',
      start: '', end: '', eventStatus: '发生中', fenceType: '', metric: ''
    };
  }
  function blankRuleFilters() { return { name: '', scopeType: '', status: '' }; }
  function pageOf(page) {
    if (!pageState[page]) {
      pageState[page] = { tab: 'list', listFilters: blankFilters(), activeMetric: '', ruleFilters: blankRuleFilters(), ruleModal: null };
    }
    var state = pageState[page];
    if (!state.listFilters) state.listFilters = blankFilters();
    if (!state.ruleFilters) state.ruleFilters = blankRuleFilters();
    if (state.ruleModal === undefined) state.ruleModal = null;
    return state;
  }
  function currentType() {
    var page = window.app && window.app.currentPage;
    return typeByPage(page) || TYPES[0];
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
  function option(value, label, selected) {
    return '<option value="' + esc(value) + '"' + (String(value) === String(selected) ? ' selected' : '') + '>' + esc(label) + '</option>';
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
    return badge(level || '—', 'gray');
  }
  function eventBadge(type, event) {
    var raw = event.eventStatus || (event.recoveredAt ? '已恢复' : '发生中');
    var label = raw === '已恢复' ? '已恢复' : (type.activeLabel || '发生中');
    return badge(label, raw === '已恢复' ? 'success' : 'error');
  }
  function handleBadge(status) {
    if (status === '待处理') return badge(status, 'warning');
    if (status === '处理中') return badge(status, 'primary');
    return badge(status || '—', 'success');
  }
  function todayStamp() {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  }
  function isTodayStamp(value) { return String(value || '').slice(0, 10) === todayStamp(); }
  function metricText(minutes) {
    var value = Number(minutes);
    if (!isFinite(value)) return '—';
    var whole = Math.round(value);
    if (whole >= 1440) return Math.floor(whole / 1440) + '天' + Math.floor((whole % 1440) / 60) + '小时';
    if (whole >= 60) return Math.floor(whole / 60) + '小时' + (whole % 60 ? whole % 60 + '分钟' : '');
    return whole + '分钟';
  }
  function formatHours(minutes) {
    var value = Number(minutes) / 60;
    if (!isFinite(value)) return '—';
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
  }
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
  function speedPolicyText(code) {
    if (code === 'CAN') return '车辆 CAN/T-BOX 速度';
    if (code === 'GPS') return 'GPS 速度';
    return '优先车辆 CAN/T-BOX，缺失时使用 GPS';
  }
  function speedSourceText(code) {
    if (code === 'GPS') return 'GPS 速度';
    if (code === 'CAN') return '车辆 CAN/T-BOX';
    return '—';
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
  function speedStartAt(event) { return event.overspeedStartedAt || (event.metrics || {}).overspeedStartedAt || ''; }
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
  function displayLevel(event) {
    if (event.ruleCode === 'VEHICLE_OVERSPEED') return event.maxAlertLevel || event.maxLevel || event.level;
    return event.level;
  }
  function levelRank(level) { return level === '紧急' ? 3 : level === '严重' ? 2 : level === '一般' ? 1 : 0; }
  function thresholdText(event) {
    var snap = event.ruleSnapshot || {};
    var levels = Array.isArray(snap.levels) ? snap.levels : [];
    var current = levels.filter(function (item) { return item.level === (event.maxAlertLevel || event.level); })[0];
    if (!current) return '—';
    if (event.ruleCode === 'VEHICLE_OVERSPEED') return '≥' + current.speedThreshold + ' km/h 持续' + speedDurationLabel(current.durationSeconds);
    if (event.ruleCode === 'DRIVER_FATIGUE') return '连续驾驶 ≥ ' + formatHours(current.thresholdMinutes) + '小时';
    if (event.ruleCode === 'VEHICLE_LOW_SOC') return 'SOC ≤ ' + current.threshold + '%';
    if (isAreaCode(event.ruleCode)) return '区域停留 ≥ ' + current.threshold + '分钟';
    if (event.ruleCode === 'UNLOAD_WEIGHBILL_MISSING') return '离开卸货地 ≥ ' + current.threshold + '分钟未上传';
    return '连续异常停车 ≥ ' + current.threshold + '分钟';
  }
  function summaryMetric(type, event) {
    if (type && type.headline) return type.headline(event);
    return { label: '告警', value: '—' };
  }
  function weighbillStatusText(metrics) {
    metrics = metrics || {};
    if (metrics.weighbillNotRequired || metrics.weighbillStatus === '无需磅单') return '无需磅单';
    if (metrics.weighbillUploaded || metrics.weighbillStatus === '已上传') return '已上传';
    if (metrics.uploading || metrics.weighbillStatus === '上传中') return '上传中';
    return metrics.weighbillStatus || '未上传';
  }
  function chargingText(metrics) {
    metrics = metrics || {};
    if (metrics.chargingStatus) return metrics.chargingStatus;
    return metrics.charging ? '充电中' : '未充电';
  }
  function yesNo(value) { return value ? '是' : '否'; }
  function taskLink(id) {
    if (!id) return '—';
    return '<a class="link col-mono" href="javascript:void(0)" onclick="acOpenTask(\'' + esc(id) + '\')">' + esc(id) + '</a>';
  }
  function cellValue(type, event, key, index) {
    var metrics = event.metrics || {};
    switch (key) {
      case 'index': return String(index + 1);
      case 'level': return levelBadge(displayLevel(event));
      case 'eventStatus': return eventBadge(type, event);
      case 'handleStatus': return handleBadge(event.handleStatus) + (event.falsePositive ? '<span class="ac-false-tag">误报</span>' : '');
      case 'projectName': return esc((type.code === 'TRANSPORT_PARKING' ? (event.departmentName || event.projectName) : event.projectName) || '—');
      case 'plate': return esc(event.plate || '—');
      case 'driverName': return esc(event.driverName || '—');
      case 'location': return esc(event.location || '—');
      case 'taskId': return taskLink(event.taskId);
      case 'parkingDuration': return esc(parkingDurationText(event));
      case 'parkingStartedAt': return esc(parkingStartAt(event) || '—');
      case 'parkingEndedAt': return esc(event.recoveredAt || '—');
      case 'triggeredAt': return esc(event.triggeredAt || '—');
      case 'stayDuration': return esc(areaStayDurationText(event));
      case 'fenceName': return esc(event.fenceName || metrics.fenceName || event.location || '—');
      case 'fenceType': return esc(event.fenceType || metrics.fenceType || '—');
      case 'transportStage': return esc(event.transportStage || '—');
      case 'enteredAt': return esc(event.enterTime || metrics.enteredAt || '—');
      case 'speed': return esc(uiSpeed(metrics.speed));
      case 'overspeedDuration': return esc(speedDurationLabel(speedSeconds(event)));
      case 'waitingMinutes': return esc(metricText(metrics.waitingMinutes));
      case 'weighbillStatus': return esc(weighbillStatusText(metrics));
      case 'unloadLocation': return esc(metrics.unloadLocation || event.location || '—');
      case 'unloadDepartedAt': return esc(metrics.unloadDepartedAt || '—');
      case 'departSource': return esc(store() && store().departSourceText ? store().departSourceText(metrics.departTimeSource) : (metrics.departTimeSource || '—'));
      case 'soc': return metrics.telemetryValid === false ? esc('已过期') : (metrics.soc == null ? '—' : esc(metrics.soc + '%'));
      case 'chargingStatus': return esc(chargingText(metrics));
      case 'socDataAt': return esc(metrics.lastTelemetryAt || '—');
      case 'continuousDriving': return esc(metricText(metrics.continuousDrivingMinutes));
      case 'currentSpeed': return esc(uiSpeed(metrics.currentSpeed));
      case 'drivingStartedAt': return esc(metrics.drivingStartedAt || '—');
      case 'recentParking': return esc(metricText(metrics.continuousParkingMinutes || 0));
      default: return '—';
    }
  }
  function typeEvents(all, code) {
    if (isAreaCode(code)) return all.filter(function (item) { return isAreaCode(item.ruleCode) || item.alertType === 'AREA_STAY_TIMEOUT'; });
    return all.filter(function (item) { return item.ruleCode === code; });
  }
  function extraMatch(event, type, extra) {
    if (!extra) return true;
    var q = extra.toLowerCase();
    var metrics = event.metrics || {};
    if (type.code === 'AREA_STAY_TIMEOUT') return String(event.fenceName || metrics.fenceName || event.location || '').toLowerCase().indexOf(q) >= 0;
    if (type.code === 'UNLOAD_WEIGHBILL_MISSING') return String(metrics.unloadLocation || event.location || '').toLowerCase().indexOf(q) >= 0;
    return true;
  }
  function metricByKey(type, key) {
    return (type.metrics || []).filter(function (item) { return item.key === key; })[0] || null;
  }
  function filterEvents(list, filters, type) {
    var q = String(filters.keyword || '').trim().toLowerCase();
    var metric = metricByKey(type, filters.metric);
    return list.filter(function (item) {
      if (filters.project) {
        if (type.orgKind === 'dept') {
          var dept = item.departmentName || item.projectName;
          var under = orgTreeNamesUnder(filters.project);
          if (under.indexOf(dept) < 0 && dept !== filters.project) return false;
        } else if (item.projectName !== filters.project) return false;
      }
      if (filters.level && displayLevel(item) !== filters.level && item.level !== filters.level) return false;
      if (filters.eventStatus && item.eventStatus !== filters.eventStatus) return false;
      if (filters.handleStatus && item.handleStatus !== filters.handleStatus) return false;
      if (filters.fenceType && (item.fenceType || (item.metrics || {}).fenceType) !== filters.fenceType) return false;
      if (filters.start && String(item.triggeredAt || '').slice(0, 10) < filters.start) return false;
      if (filters.end && String(item.triggeredAt || '').slice(0, 10) > filters.end) return false;
      if (q && [item.plate, item.driverName, item.taskId, item.id].join(' ').toLowerCase().indexOf(q) < 0) return false;
      if (!extraMatch(item, type, String(filters.extra || '').trim())) return false;
      if (metric && !metric.match(item)) return false;
      return true;
    }).sort(function (a, b) {
      var rank = levelRank(displayLevel(b)) - levelRank(displayLevel(a));
      if (rank) return rank;
      return String(b.triggeredAt || '').localeCompare(String(a.triggeredAt || ''));
    });
  }
  function metricCount(list, metric) {
    var matched = list.filter(function (item) { return !item.falsePositive && metric.match(item); });
    if (metric.count === 'plates') {
      var plates = {};
      matched.forEach(function (item) { if (item.plate) plates[item.plate] = true; });
      return Object.keys(plates).length;
    }
    return matched.length;
  }
  function renderMetrics(type, list, active) {
    return '<div class="ac-metrics ac-metrics-4">' + type.metrics.map(function (metric) {
      return '<button type="button" class="ac-metric ac-metric-' + metric.tone + (active === metric.key ? ' is-active' : '') + '" onclick="acMetric(\'' + metric.key + '\')"><span>' + esc(metric.label) + '</span><b>' + metricCount(list, metric) + '</b><small>' + esc(metric.copy) + '</small></button>';
    }).join('') + '</div>';
  }
  function renderStatusSwitch(type, list, current) {
    var items = [
      { value: '', label: '全部', count: list.length },
      { value: '发生中', label: type.activeLabel || '发生中', count: list.filter(function (item) { return item.eventStatus === '发生中'; }).length },
      { value: '已恢复', label: '已恢复', count: list.filter(function (item) { return item.eventStatus === '已恢复'; }).length }
    ];
    return '<div class="ac-status-switch" role="tablist" aria-label="事件状态">' + items.map(function (item) {
      var on = current != null && (current || '') === item.value;
      return '<button type="button" class="' + (on ? 'is-active' : '') + '" aria-pressed="' + (on ? 'true' : 'false') + '" onclick="acStatus(\'' + item.value + '\')"><span>' + item.label + '</span><b>' + item.count + '</b></button>';
    }).join('') + '</div>';
  }
  function tabsHtml(tab) {
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
  function jsStr(value) { return "'" + String(value == null ? '' : value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }
  function orgTreeData() {
    if (window.AdminOrgTree && typeof window.AdminOrgTree.get === 'function') return window.AdminOrgTree.get() || [];
    return [{ name: '云南力伏星新能源有限公司', departments: [{ name: '运营一部' }, { name: '运营二部' }, { name: '云南钦圣新能源科技有限公司' }] }];
  }
  function orgTreeNamesUnder(selected) {
    if (window.AdminOrgTree && typeof window.AdminOrgTree.namesUnder === 'function') return window.AdminOrgTree.namesUnder(selected);
    var names = [];
    orgTreeData().forEach(function (org) {
      if (!selected || org.name === selected) {
        names.push(org.name);
        (org.departments || []).forEach(function (dept) { names.push(dept.name); });
      } else {
        (org.departments || []).forEach(function (dept) { if (dept.name === selected) names.push(dept.name); });
      }
    });
    return names;
  }
  function orgTreeListHtml(selected, keyword) {
    keyword = String(keyword || '').trim();
    var html = '<button type="button" class="cb-entity-node' + (!selected ? ' is-selected' : '') + '" onclick="acPickDept(\'\')">全部部门</button>';
    html += orgTreeData().map(function (org) {
      var depts = (org.departments || []).filter(function (dept) { return !keyword || org.name.indexOf(keyword) >= 0 || dept.name.indexOf(keyword) >= 0; });
      if (keyword && org.name.indexOf(keyword) >= 0) depts = org.departments || [];
      if (keyword && !depts.length) return '';
      return '<div class="cb-entity-org"><button type="button" class="cb-entity-node is-org' + (org.name === selected ? ' is-selected' : '') + '" onclick="acPickDept(' + jsStr(org.name) + ')">' + esc(org.name) + '</button><div class="cb-entity-depts">'
        + depts.map(function (dept) { return '<button type="button" class="cb-entity-node is-dept' + (dept.name === selected ? ' is-selected' : '') + '" onclick="acPickDept(' + jsStr(dept.name) + ')">' + esc(dept.name) + '</button>'; }).join('')
        + '</div></div>';
    }).join('');
    return html || '<div class="cb-entity-empty">没有匹配的组织或部门</div>';
  }
  function deptFilterHtml(selected) {
    return '<div class="cb-entity-field ac-org-filter" data-org-field="acProject"><input type="hidden" id="acProject" value="' + esc(selected || '') + '">'
      + '<button type="button" class="filter-control cb-entity-trigger" data-org-trigger aria-haspopup="listbox" aria-expanded="false" onclick="acToggleDeptTree(event)"><span data-org-label class="' + (selected ? '' : 'is-placeholder') + '">' + esc(selected || '全部部门') + '</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg></button>'
      + '<div class="cb-entity-panel" data-org-panel hidden><input class="filter-control" data-org-search placeholder="搜索组织或部门" oninput="acFilterDeptTree(this.value)"><div class="cb-entity-tree" data-org-list role="listbox">' + orgTreeListHtml(selected) + '</div></div></div>';
  }
  function renderFilters(type, filters) {
    var html = '<div class="filter-panel ac-filter"><div class="filter-row">'
      + field(type.orgLabel, type.orgKind === 'dept' ? deptFilterHtml(filters.project) : '<select class="filter-control" id="acProject">' + options(projectNames(), filters.project) + '</select>')
      + field('车牌 / 司机 / 任务单', '<input class="filter-control" id="acKeyword" value="' + esc(filters.keyword) + '" placeholder="车牌 / 司机 / 任务单" onkeydown="if(event.key===\'Enter\')acApply()">')
      + field('告警等级', '<select class="filter-control" id="acLevel">' + options(LEVEL_NAMES, filters.level) + '</select>')
      + field('处理状态', '<select class="filter-control" id="acHandleStatus">' + options(HANDLE_STATUSES, filters.handleStatus) + '</select>');
    if (type.extraLabel) html += field(type.extraLabel, '<input class="filter-control" id="acExtra" value="' + esc(filters.extra) + '" placeholder="' + esc(type.extraPlaceholder) + '" onkeydown="if(event.key===\'Enter\')acApply()">');
    if (type.code === 'AREA_STAY_TIMEOUT') {
      var fenceTypes = store() && store().getAreaTypes ? store().getAreaTypes() : ['装货区', '卸货区', '充电站', '停车区', '中转区', '其他'];
      html += field('围栏类型', '<select class="filter-control" id="acFenceType">' + options(fenceTypes, filters.fenceType) + '</select>');
    }
    html += field('开始日期', '<input class="filter-control" id="acStart" type="date" value="' + esc(filters.start) + '">')
      + field('结束日期', '<input class="filter-control" id="acEnd" type="date" value="' + esc(filters.end) + '">');
    return html + '</div><div class="filter-actions"><button class="btn btn-default" type="button" onclick="acReset()">重置</button><button class="btn btn-primary" type="button" onclick="acApply()">查询</button></div></div>';
  }
  function actionsHtml(event) {
    var actions = '<a class="link" href="javascript:void(0)" onclick="acView(\'' + esc(event.id) + '\')">详情</a>';
    if (event.handleStatus !== '已处理') actions += '<a class="link" href="javascript:void(0)" onclick="acHandle(\'' + esc(event.id) + '\')">处理</a>';
    return actions;
  }
  function pagination(count) {
    return '<div class="pagination"><div class="pagination-info">共 ' + count + ' 条，当前 ' + (count ? ('1-' + count) : '0-0') + '</div><div class="pagination-controls"><button class="page-btn active" type="button">1</button></div></div>';
  }
  function renderAlertTable(type, rows) {
    var head = type.columns.map(function (column) {
      var extra = column.key === 'index' ? ' class="sticky-col"' : (column.key === 'actions' ? ' class="sticky-col-r"' : '');
      return '<th' + extra + '>' + column.label + '</th>';
    }).join('');
    var body = rows.length ? rows.map(function (event, index) {
      return '<tr>' + type.columns.map(function (column) {
        if (column.key === 'actions') return '<td class="sticky-col-r ac-actions">' + actionsHtml(event) + '</td>';
        return '<td' + (column.key === 'index' ? ' class="sticky-col"' : '') + '>' + cellValue(type, event, column.key, index) + '</td>';
      }).join('') + '</tr>';
    }).join('') : '<tr><td colspan="' + type.columns.length + '"><div class="empty-state"><b>当前没有符合条件的' + esc(type.name) + '</b><p>可调整筛选条件后重新查询。</p></div></td></tr>';
    return '<section class="table-section"><div class="table-toolbar"><div class="left"><span class="detail-section-title">' + esc(type.name) + '</span><span class="ac-table-count">共 ' + rows.length + ' 条</span></div><div class="right">'
      + '<button class="toolbar-btn" type="button" onclick="acExport()">导出</button>'
      + '<button class="toolbar-btn" type="button" data-ac-refresh onclick="acRefresh()">刷新</button></div></div>'
      + '<div class="table-wrap ac-table-wrap"><table class="data-table ac-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>'
      + pagination(rows.length) + '</section>';
  }
  function typeRules(type) {
    return rules().filter(function (item) { return type.code === 'AREA_STAY_TIMEOUT' ? isAreaCode(item.code) : item.code === type.code; });
  }
  function joinedScope(names, unit, emptyText) {
    if (!names.length) return { text: emptyText, title: '' };
    if (names.length === 1) return { text: names[0], title: names[0] };
    return { text: names[0] + '等' + names.length + unit, title: names.join('、') };
  }
  function parkingScopeMode(rule) {
    var kind = (rule && rule.scopeType) || '';
    return kind === '自定义车辆' || kind === '指定车辆' ? '自定义车辆' : '组织部门';
  }
  function scopeLabel(type, rule) {
    if (type.code === 'TRANSPORT_PARKING') return parkingScopeMode(rule);
    if (type.code === 'AREA_STAY_TIMEOUT') {
      if ((rule.fenceIds || []).length) return '指定围栏';
      if (rule.areaType && rule.areaType !== '全部类型') return '区域类型';
      if (rule.scopeType === '指定项目') return '指定项目';
      return '全部项目';
    }
    return rule && rule.scopeType === '指定项目' ? '指定项目' : '全部项目';
  }
  function scopeObject(type, rule) {
    if (type.code === 'TRANSPORT_PARKING') {
      if (rule.scopeType === '指定车辆' || rule.scopeType === '自定义车辆') return joinedScope(rule.vehiclePlates || [], '辆', '未选车辆');
      if (rule.scopeType === '组织部门') return joinedScope(rule.departmentNames || [], '个部门', '未选部门');
      if (rule.scopeType === '指定项目') return joinedScope(rule.projectNames || [], '个项目', '未选项目');
      return { text: '全部组织', title: '全部组织部门' };
    }
    if (type.code === 'AREA_STAY_TIMEOUT') {
      if ((rule.fenceIds || []).length) return joinedScope(rule.fenceNames || [], '个围栏', '未选围栏');
      if (rule.areaType && rule.areaType !== '全部类型') return { text: rule.areaType, title: rule.areaType };
      if (rule.scopeType === '指定项目') return joinedScope(rule.projectNames || [], '个项目', '未选项目');
      return { text: '全部项目', title: '全部项目' };
    }
    if (rule.scopeType === '指定项目') return joinedScope(rule.projectNames || [], '个项目', '未选项目');
    return { text: '全部项目', title: '全部项目' };
  }
  function scopeLine(type, rule) {
    var label = scopeLabel(type, rule);
    var object = scopeObject(type, rule);
    if (!object.text || object.text === label) return { text: label, title: object.title || label };
    return { text: label + ' · ' + object.text, title: object.title || object.text };
  }
  function enabledLevels(rule) { return (rule.levels || []).filter(function (level) { return level.enabled !== false; }); }
  function ruleSummary(type, rule) {
    var levels = enabledLevels(rule);
    if (!levels.length) return '全部等级已停用';
    if (type.code === 'VEHICLE_OVERSPEED') return levels.map(function (level) { return level.level + '≥' + level.speedThreshold + 'km/h/' + speedDurationLabel(level.durationSeconds); }).join(' / ');
    if (type.code === 'DRIVER_FATIGUE') return levels.map(function (level) { return formatHours(level.thresholdMinutes) + 'h'; }).join(' / ') + '，有效休息' + Number((rule.recoveryConfig || {}).restThresholdMinutes || 20) + 'min';
    if (type.code === 'VEHICLE_LOW_SOC') return levels.map(function (level) { return level.level + '≤' + level.threshold + '%'; }).join(' / ');
    if (type.code === 'UNLOAD_WEIGHBILL_MISSING') return '离场' + levels.map(function (level) { return level.threshold; }).join(' / ') + 'min仍未上传';
    return levels.map(function (level) { return level.level + '≥' + level.threshold + '分钟'; }).join(' / ');
  }
  function renderRuleList(type, filters) {
    var q = String(filters.name || '').trim().toLowerCase();
    var rows = typeRules(type).filter(function (rule) {
      if (q && String(rule.name || '').toLowerCase().indexOf(q) < 0) return false;
      if (filters.scopeType && scopeLabel(type, rule) !== filters.scopeType) return false;
      if (filters.status === '启用' && !rule.enabled) return false;
      if (filters.status === '停用' && rule.enabled) return false;
      return true;
    }).sort(function (a, b) { return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); });
    var body = rows.length ? rows.map(function (rule) {
      var scope = scopeLine(type, rule);
      var canDelete = rule.id !== type.protectedId;
      return '<tr><td>' + esc(rule.name || '未命名规则') + '</td><td title="' + esc(scope.title) + '">' + esc(scope.text) + '</td><td>' + esc(ruleSummary(type, rule)) + '</td><td>' + (rule.enabled ? badge('启用', 'primary') : badge('停用', 'gray')) + '</td><td>' + esc(rule.updatedAt || '—') + '</td><td>' + esc(rule.updatedBy || '—') + '</td><td class="sticky-col-r ac-actions">'
        + '<a class="link" href="javascript:void(0)" onclick="acEditRule(\'' + esc(rule.id) + '\')">编辑</a>'
        + '<a class="link" href="javascript:void(0)" onclick="acToggleRule(\'' + esc(rule.id) + '\')">' + (rule.enabled ? '停用' : '启用') + '</a>'
        + (canDelete ? '<a class="link" href="javascript:void(0)" onclick="acRemoveRule(\'' + esc(rule.id) + '\')">删除</a>' : '')
        + '</td></tr>';
    }).join('') : '<tr><td colspan="7"><div class="empty-state"><b>没有符合条件的规则</b><p>可调整筛选条件，或新增一条规则。</p></div></td></tr>';
    return '<div class="ac-rule-list"><div class="filter-panel ac-filter"><div class="filter-row">'
      + field('规则名称', '<input class="filter-control" id="acRuleName" value="' + esc(filters.name) + '" placeholder="支持模糊搜索" onkeydown="if(event.key===\'Enter\')acRuleApply()">')
      + field('适用范围', '<select class="filter-control" id="acRuleScope">' + option('', '全部', filters.scopeType) + type.scopeOptions.map(function (item) { return option(item, item, filters.scopeType); }).join('') + '</select>')
      + field('状态', '<select class="filter-control" id="acRuleStatus">' + option('', '全部', filters.status) + option('启用', '启用', filters.status) + option('停用', '停用', filters.status) + '</select>')
      + '</div><div class="filter-actions"><button class="btn btn-default" type="button" onclick="acRuleReset()">重置</button><button class="btn btn-primary" type="button" onclick="acRuleApply()">查询</button></div></div>'
      + '<section class="table-section"><div class="table-toolbar"><div class="left"><span class="detail-section-title">' + esc(type.ruleTitle) + '</span><span class="ac-table-count">共 ' + rows.length + ' 条</span></div><div class="right"><button class="btn btn-primary" type="button" onclick="acAddRule()">+ 新增规则</button></div></div>'
      + '<div class="table-wrap ac-table-wrap"><table class="data-table ac-table ac-rule-table"><thead><tr><th>规则名称</th><th>适用范围</th><th>规则摘要</th><th>状态</th><th>更新时间</th><th>更新人</th><th class="sticky-col-r">操作</th></tr></thead><tbody>' + body + '</tbody></table></div>'
      + pagination(rows.length) + '</section></div>';
  }
  function renderAlertPage(type) {
    var state = pageOf(type.page);
    if (window.__acPreferTab) { state.tab = window.__acPreferTab; window.__acPreferTab = ''; }
    var all = typeEvents(events(), type.code);
    var rows = filterEvents(all, state.listFilters, type);
    return '<div class="content-area page-standard ac-page"><div class="breadcrumb"><span>告警中心</span><span class="sep">/</span><span class="current">' + esc(type.name) + '</span></div>'
      + '<div class="page-header"><div><div class="page-title">' + esc(type.name) + '</div><p class="detail-section-sub">' + esc(type.summary) + '</p></div></div>'
      + tabsHtml(state.tab)
      + (state.tab === 'rules' ? renderRuleList(type, state.ruleFilters) : renderMetrics(type, all, state.activeMetric) + renderStatusSwitch(type, all, state.activeMetric && !state.listFilters.eventStatus ? null : state.listFilters.eventStatus) + renderFilters(type, state.listFilters) + renderAlertTable(type, rows))
      + '</div>';
  }

  function formField(label, control, hint, full) {
    return '<div class="form-item' + (full ? ' full' : '') + '"><label class="form-label">' + label + '</label>' + control + (hint ? '<div class="form-hint">' + hint + '</div>' : '') + '</div>';
  }
  function formSection(title, inner) {
    return '<section class="form-section"><div class="form-section-title"><span class="section-icon"></span>' + title + '</div>' + inner + '</section>';
  }
  function modalShell(title, name, body) {
    return '<div class="modal ac-parking-modal" role="dialog" aria-modal="true"><div class="modal-header"><div><div class="modal-title">' + esc(title) + '</div>' + (name ? '<p class="ac-modal-sub">' + esc(name) + '</p>' : '') + '</div><button class="modal-close" type="button" onclick="acCloseRuleModal()" aria-label="关闭">×</button></div><div class="modal-body">' + body + '</div><div class="modal-footer"><button class="btn btn-default" type="button" onclick="acCloseRuleModal()">取消</button><button class="btn btn-primary" type="button" onclick="acSaveRule()">保存</button></div></div>';
  }
  function baseFields(item) {
    return '<div class="form-grid col-2">'
      + formField('规则名称 <span class="req">*</span>', '<input class="form-control-text" id="wrName" value="' + esc(item.name) + '" maxlength="40" placeholder="最多40字">', '')
      + formField('规则状态 <span class="req">*</span>', '<select class="form-control-text" id="wrEnabled">' + option('启用', '启用', item.enabled !== false ? '启用' : '停用') + option('停用', '停用', item.enabled !== false ? '启用' : '停用') + '</select>', '')
      + '</div>';
  }
  function noteSection(type) { return formSection('规则说明', '<p class="ac-mock-hint">' + esc(type.note) + '</p>'); }
  function levelRows(item, label, control) {
    return '<table class="data-table ac-level-table"><thead><tr><th>告警等级</th><th>是否启用</th><th>' + label + '</th></tr></thead><tbody>'
      + (item.levels || []).map(function (level, index) {
        return '<tr><td>' + esc(level.level) + '</td><td><label class="ac-check"><input class="wr-level-enabled" data-level-index="' + index + '" type="checkbox"' + (level.enabled !== false ? ' checked' : '') + '>启用</label></td><td>' + control(level, index) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }
  function minuteControl(level, index) {
    return '<div class="wr-unit-input ac-level-input"><input class="form-control-text wr-threshold" data-level-index="' + index + '" type="number" min="1" max="1440" value="' + Number(level.threshold || 0) + '"><em>分钟</em></div>';
  }
  var ORG_TREE = [
    { id: 'yunnan-lifu', name: '云南力伏星新能源有限公司', departments: [
      { id: 'finance', name: '财务部（宁核聚力）' }, { id: 'chengdu', name: '成都校区' }, { id: 'guangxi', name: '广西钦圣' },
      { id: 'hr', name: '人资部（宁核聚力）' }, { id: 'sales', name: '销售部（宁核聚力）' }, { id: 'yunnan-qinsheng', name: '云南钦圣新能源科技有限公司' },
      { id: 'ops-1', name: '运营一部' }, { id: 'ops-2', name: '运营二部' }
    ]},
    { id: 'woyuan', name: '内蒙古沃远智行物流有限公司', departments: [{ id: 'woyuan-ops', name: '西南项目组' }] },
    { id: 'wotong', name: '内蒙古沃通智行物流科技有限公司', departments: [{ id: 'wotong-default', name: '默认部门' }] },
    { id: 'heavy-truck-test', name: '重卡测试组', departments: [{ id: 'test-default', name: '测试运营部' }] }
  ];
  function parkingOrgTreeHtml(selectedIds) {
    return ORG_TREE.map(function (org) {
      return '<div class="ac-org-group" data-org-id="' + esc(org.id) + '" data-org-name="' + esc(org.name) + '"><label class="ac-org-company ac-check"><input type="checkbox" data-org-toggle="' + esc(org.id) + '" onchange="acOrgToggle(this)">' + esc(org.name) + '</label><div class="ac-org-depts">'
        + org.departments.map(function (dept) {
          return '<label class="ac-org-dept ac-check" data-org-id="' + esc(org.id) + '" data-dept-name="' + esc(dept.name) + '"><input type="checkbox" name="wrDeptIds" value="' + esc(dept.id) + '" data-name="' + esc(dept.name) + '"' + (selectedIds.indexOf(dept.id) >= 0 ? ' checked' : '') + ' onchange="acParkingCount()">' + esc(dept.name) + '</label>';
        }).join('') + '</div></div>';
    }).join('');
  }
  function parkingModalBody(item) {
    var type = typeByCode('TRANSPORT_PARKING');
    var detect = item.detectConfig || {};
    var recovery = item.recoveryConfig || {};
    var scopeMode = parkingScopeMode(item);
    var vehicles = store() && store().getParkingVehicles ? store().getParkingVehicles() : [];
    var selectedPlates = scopeMode === '自定义车辆' ? (item.vehiclePlates || []) : [];
    var selectedDepts = item.scopeType === '组织部门' ? (item.departmentIds || []) : [];
    var choice = function (value) {
      return '<label class="ac-scope-choice"><input type="radio" name="wrScopeMode" value="' + value + '"' + (scopeMode === value ? ' checked' : '') + ' onchange="acScopeChange()"><span>' + value + '</span></label>';
    };
    return formSection('基础信息', baseFields(item) + '<div class="form-grid col-2">'
      + formField('监控时段 <span class="req">*</span>', '<select class="form-control-text" id="wrMonitorPeriod" onchange="acMonitorPeriodChange()">' + option('全天', '全天', item.monitorPeriod || '全天') + option('自定义', '自定义', item.monitorPeriod) + '</select>', '')
      + '</div><div class="form-grid col-2" id="wrMonitorRange"' + (item.monitorPeriod === '自定义' ? '' : ' hidden') + '>'
      + formField('开始时间', '<input class="form-control-text" id="wrMonitorStart" type="time" value="' + esc(item.monitorStart || '22:00') + '">', '')
      + formField('结束时间', '<input class="form-control-text" id="wrMonitorEnd" type="time" value="' + esc(item.monitorEnd || '06:00') + '">', '')
      + '<div class="form-item full"><div class="form-hint">开始时间大于结束时间时按跨天时段计算，例如 22:00-06:00</div></div></div>')
      + formSection('适用范围', '<div class="ac-scope-choices" role="radiogroup" aria-label="适用范围">' + choice('组织部门') + choice('自定义车辆') + '</div>'
        + '<div class="ac-scope-panel" id="wrOrgBox"' + (scopeMode === '组织部门' ? '' : ' hidden') + '><div class="ac-scope-bar"><p class="ac-scope-count" id="wrOrgCount">已选择 ' + selectedDepts.length + ' 个部门</p></div><input class="form-control-text" id="wrOrgQuery" placeholder="搜索组织或部门" oninput="acFilterOrg()"><div class="ac-org-tree">' + parkingOrgTreeHtml(selectedDepts) + '</div></div>'
        + '<div class="ac-scope-panel" id="wrVehicleBox"' + (scopeMode === '自定义车辆' ? '' : ' hidden') + '><div class="ac-scope-bar"><p class="ac-scope-count" id="wrVehicleCount">已选择 ' + selectedPlates.length + ' 辆</p><div class="ac-scope-actions"><button class="btn btn-default btn-sm" type="button" onclick="acVehicleSelectAll(true)">全选</button><button class="btn btn-default btn-sm" type="button" onclick="acVehicleSelectAll(false)">取消全选</button></div></div><input class="form-control-text" id="wrVehicleQuery" placeholder="搜索车牌号" oninput="acFilterVehicles()"><div class="ac-check-list ac-vehicle-list">'
        + (vehicles.map(function (vehicle) {
          var meta = vehicle.departmentName || vehicle.projectName || '';
          return '<label class="ac-vehicle-option ac-check" data-plate="' + esc(vehicle.plate) + '"><input type="checkbox" name="wrVehiclePlates" value="' + esc(vehicle.plate) + '"' + (selectedPlates.indexOf(vehicle.plate) >= 0 ? ' checked' : '') + ' onchange="acParkingCount()">' + esc(vehicle.plate) + (meta ? '<small>' + esc(meta) + '</small>' : '') + '</label>';
        }).join('') || '<div class="ac-org-empty">当前没有车辆</div>') + '</div></div>')
      + formSection('业务识别条件', '<div class="form-grid col-2">'
        + formField('监控对象', '<input class="form-control-text" value="执行运输任务中的车辆" disabled>', '任务执行中且已绑定当前任务')
        + formField('静止速度阈值', '<div class="wr-unit-input"><input class="form-control-text" id="wrStillSpeed" type="number" min="0" max="20" step="0.1" value="' + Number(detect.stillSpeedKph || 3) + '"><em>km/h</em></div>', '0～20 km/h')
        + formField('最小持续静止时间', '<div class="wr-unit-input"><input class="form-control-text" id="wrMinStill" type="number" min="1" max="120" value="' + Number(detect.minStillMinutes || 5) + '"><em>分钟</em></div>', '用于过滤短暂停车和定位抖动，1～120 分钟')
        + formField('排除装货作业', '<label class="ac-check"><input id="wrExcludeLoading" type="checkbox"' + (detect.excludeLoading !== false ? ' checked' : '') + '>开启</label>', '')
        + formField('排除卸货作业', '<label class="ac-check"><input id="wrExcludeUnloading" type="checkbox"' + (detect.excludeUnloading !== false ? ' checked' : '') + '>开启</label>', '')
        + formField('排除充电状态', '<label class="ac-check"><input id="wrExcludeCharging" type="checkbox"' + (detect.excludeCharging !== false ? ' checked' : '') + '>开启</label>', '')
        + '</div>')
      + formSection('告警等级', '<p class="wr-level-help">同一次连续停车只产生 1 个告警事件。启用等级的时长必须按风险递增。</p>' + levelRows(item, '连续异常停车时长', minuteControl))
      + formSection('恢复条件', '<div class="form-grid col-2">'
        + formField('恢复速度阈值', '<div class="wr-unit-input"><input class="form-control-text" id="wrRecoverSpeed" type="number" min="1" max="80" step="0.1" value="' + Number(recovery.recoverSpeedKph || 5) + '"><em>km/h</em></div>', '必须高于静止速度阈值')
        + formField('恢复持续时间', '<div class="wr-unit-input"><input class="form-control-text" id="wrRecoverHold" type="number" min="1" max="60" value="' + Number(recovery.recoverDurationMinutes || 3) + '"><em>分钟</em></div>', '1～60 分钟')
        + formField('任务结束自动结束监测', '<label class="ac-check"><input id="wrEndOnTask" type="checkbox"' + (recovery.endOnTaskComplete !== false ? ' checked' : '') + '>开启</label>', '', true)
        + '</div>')
      + noteSection(type);
  }
  function areaFenceOptions(item) {
    var fences = store() && store().getAreaStayFences ? store().getAreaStayFences() : [];
    var projectIds = item.scopeType === '指定项目' ? (item.projectIds || []) : [];
    var areaType = item.areaType && item.areaType !== '全部类型' ? item.areaType : '';
    return fences.filter(function (fence) {
      if (projectIds.length && projectIds.indexOf(fence.projectId) < 0) return false;
      if (areaType && fence.type !== areaType) return false;
      return true;
    });
  }
  function areaStayModalBody(item) {
    var type = typeByCode('AREA_STAY_TIMEOUT');
    var areaTypes = store() && store().getAreaTypes ? store().getAreaTypes() : [];
    var specifiedProject = item.scopeType === '指定项目';
    var fenceMode = ((item.fenceIds || []).length > 0 || item._fenceMode === '指定围栏') ? '指定围栏' : '全部符合条件围栏';
    var fences = areaFenceOptions(item);
    var selectedFences = item.fenceIds || [];
    var projects = store() && store().getProjects ? store().getProjects() : [];
    return formSection('基础信息', baseFields(item))
      + formSection('适用范围', '<div class="form-grid col-2">'
        + formField('适用项目 <span class="req">*</span>', '<select class="form-control-text" id="wrScope" onchange="acAreaStayScopeChange()">' + option('全部项目', '全部项目', item.scopeType || '全部项目') + option('指定项目', '指定项目', item.scopeType) + '</select>', '')
        + formField('区域类型 <span class="req">*</span>', '<select class="form-control-text" id="wrAreaType" onchange="acAreaStayFenceFilter()">' + option('全部类型', '全部类型', item.areaType || '全部类型') + areaTypes.map(function (name) { return option(name, name, item.areaType); }).join('') + '</select>', '')
        + '</div><div id="wrAreaProjectBox"' + (specifiedProject ? '' : ' hidden') + '><div class="ac-check-list">' + projects.map(function (project) {
          return '<label class="ac-check"><input type="checkbox" name="wrAreaProjects" value="' + esc(project.id) + '" data-name="' + esc(project.name) + '"' + ((item.projectIds || []).indexOf(project.id) >= 0 ? ' checked' : '') + ' onchange="acAreaStayFenceFilter()">' + esc(project.name) + '</label>';
        }).join('') + '</div></div><div class="form-item" style="margin-top:14px"><label class="form-label">适用围栏</label><div class="ac-scope-choices">'
        + '<label class="ac-scope-choice"><input type="radio" name="wrFenceMode" value="全部符合条件围栏"' + (fenceMode !== '指定围栏' ? ' checked' : '') + ' onchange="acAreaStayFenceMode()">全部符合条件围栏</label>'
        + '<label class="ac-scope-choice"><input type="radio" name="wrFenceMode" value="指定围栏"' + (fenceMode === '指定围栏' ? ' checked' : '') + ' onchange="acAreaStayFenceMode()">指定围栏</label></div></div>'
        + '<div class="ac-scope-panel" id="wrAreaFenceBox"' + (fenceMode === '指定围栏' ? '' : ' hidden') + '><p class="ac-scope-count" id="wrFenceCount">已选择 ' + selectedFences.length + ' 个围栏</p><input class="form-control-text" id="wrFenceQuery" placeholder="搜索围栏名称" oninput="acFilterAreaFences()"><div class="ac-check-list ac-vehicle-list" id="wrAreaFenceList">'
        + (fences.map(function (fence) {
          return '<label class="ac-vehicle-option ac-check" data-fence="' + esc(fence.name) + '"><input type="checkbox" name="wrAreaFences" value="' + esc(fence.id) + '" data-name="' + esc(fence.name) + '"' + (selectedFences.indexOf(fence.id) >= 0 ? ' checked' : '') + '>' + esc(fence.name) + '<small>' + esc(fence.type + ' · ' + fence.projectName) + '</small></label>';
        }).join('') || '<div class="ac-org-empty">当前项目和区域类型下没有可选围栏</div>') + '</div></div>')
      + formSection('业务识别条件', '<p class="ac-mock-hint">车辆进入电子围栏后持续未离开即开始计时。本规则不使用车速判断开始或停止。</p>')
      + formSection('告警等级', '<p class="wr-level-help">同一车辆一次连续停留只产生 1 个告警事件。启用等级的停留时长必须递增。</p>' + levelRows(item, '区域停留时长', function (level, index) {
        return '<div class="wr-level-condition"><label>区域停留 ≥ ' + minuteControl(level, index) + '</label></div>';
      }))
      + formSection('恢复条件', '<div class="wr-recovery"><b>恢复条件</b><span>车辆离开产生告警的业务区域</span></div><p class="form-hint">离开对应电子围栏后自动恢复。</p>')
      + noteSection(type);
  }
  function speedModalBody(item) {
    var type = typeByCode('VEHICLE_OVERSPEED');
    var recovery = item.recoveryConfig || {};
    var selected = item.scopeType === '指定项目' ? (item.projectIds || []) : [];
    var projects = store() && store().getProjects ? store().getProjects() : [];
    return formSection('基础信息', baseFields(item) + '<div class="form-grid col-2">' + formField('速度数据来源 <span class="req">*</span>', '<select class="form-control-text" id="wrSpeedSource">' + option('CAN_THEN_GPS', speedPolicyText('CAN_THEN_GPS'), item.speedSourcePolicy || 'CAN_THEN_GPS') + option('CAN', speedPolicyText('CAN'), item.speedSourcePolicy) + option('GPS', speedPolicyText('GPS'), item.speedSourcePolicy) + '</select>', '尖峰过滤为固定策略') + '</div>')
      + formSection('适用范围', '<div class="form-grid col-2">' + formField('适用范围 <span class="req">*</span>', '<select class="form-control-text" id="wrScope" onchange="acScopeChange()">' + option('全部项目', '全部项目', item.scopeType || '全部项目') + option('指定项目', '指定项目', item.scopeType || '全部项目') + '</select>', '指定项目优先于全部项目') + '</div>'
        + '<div id="wrSpeedProjects"' + (item.scopeType === '指定项目' ? '' : ' hidden') + '><div class="form-hint" style="margin:8px 0">指定项目至少选择一个。同级范围重叠时禁止保存。</div><div class="ac-check-list">'
        + projects.map(function (project) {
          return '<label class="ac-check"><input type="checkbox" name="wrSpeedProjects" value="' + esc(project.id) + '" data-name="' + esc(project.name) + '"' + (selected.indexOf(project.id) >= 0 ? ' checked' : '') + '>' + esc(project.name) + '</label>';
        }).join('') + '</div></div>')
      + formSection('业务识别条件', '<p class="ac-mock-hint">同一段连续超速只保留一条告警。车速必须同时达到速度阈值和持续时长。</p>')
      + formSection('告警等级', '<p class="wr-level-help">等级只升不降。启用等级的车速阈值必须递增。</p><table class="data-table ac-level-table"><thead><tr><th>告警等级</th><th>是否启用</th><th>车速阈值</th><th>持续时间</th></tr></thead><tbody>'
        + (item.levels || []).map(function (level, index) {
          var unit = level.durationUnit === '分钟' ? '分钟' : '秒';
          var shown = unit === '分钟' ? (Number(level.durationSeconds || 0) / 60) : Number(level.durationSeconds || 0);
          return '<tr><td>' + esc(level.level) + '</td><td><label class="ac-check"><input class="wr-level-enabled" data-level-index="' + index + '" type="checkbox"' + (level.enabled !== false ? ' checked' : '') + '>启用</label></td>'
            + '<td><div class="wr-unit-input ac-level-input"><input class="form-control-text wr-speed" data-level-index="' + index + '" type="number" min="1" max="200" value="' + Number(level.speedThreshold || 0) + '"><em>km/h</em></div></td>'
            + '<td><div class="wr-unit-input ac-speed-duration ac-level-input"><input class="form-control-text wr-duration" data-level-index="' + index + '" type="number" min="1" step="1" value="' + shown + '"><select class="wr-duration-unit" data-level-index="' + index + '" aria-label="持续时间单位"><option value="秒"' + (unit === '秒' ? ' selected' : '') + '>秒</option><option value="分钟"' + (unit === '分钟' ? ' selected' : '') + '>分钟</option></select></div></td></tr>';
        }).join('') + '</tbody></table>')
      + formSection('恢复条件', '<div class="form-grid col-2">'
        + formField('恢复车速阈值 <span class="req">*</span>', '<div class="wr-unit-input ac-speed-recover"><input class="form-control-text" id="wrRecoverSpeed" type="number" min="1" value="' + Number(recovery.recoverSpeedKph || 75) + '"><em>km/h</em></div>', '须低于已启用的最低车速阈值')
        + formField('恢复持续时间 <span class="req">*</span>', '<div class="wr-unit-input ac-speed-recover"><input class="form-control-text" id="wrRecoverSeconds" type="number" min="1" step="1" value="' + Number(recovery.recoverDurationSeconds || 30) + '"><em>秒</em></div>', '回到恢复阈值后需连续满足')
        + '</div>')
      + noteSection(type);
  }
  function lateProjectSection(item) {
    var selected = item.scopeType === '指定项目' ? (item.projectIds || []) : [];
    var projects = store() && store().getProjects ? store().getProjects() : [];
    return formSection('适用范围', '<div class="form-grid col-2">' + formField('适用范围 <span class="req">*</span>', '<select class="form-control-text" id="wrScope" onchange="acScopeChange()">' + option('全部项目', '全部项目', item.scopeType || '全部项目') + option('指定项目', '指定项目', item.scopeType || '全部项目') + '</select>', '指定项目优先于全部项目') + '</div>'
      + '<div id="wrLateProjects"' + (item.scopeType === '指定项目' ? '' : ' hidden') + '><div class="form-hint" style="margin:8px 0">指定项目至少选择一个。同级范围重叠时禁止保存。</div><div class="ac-check-list">'
      + projects.map(function (project) {
        return '<label class="ac-check"><input type="checkbox" name="wrLateProjects" value="' + esc(project.id) + '" data-name="' + esc(project.name) + '"' + (selected.indexOf(project.id) >= 0 ? ' checked' : '') + '>' + esc(project.name) + '</label>';
      }).join('') + '</div></div>');
  }
  function weighbillModalBody(item) {
    var type = typeByCode(item.code);
    var detect = item.detectConfig || {};
    return formSection('基础信息', baseFields(item)) + lateProjectSection(item)
      + formSection('业务识别条件', '<div class="form-grid col-2">'
        + formField('触发节点', '<input class="form-control-text" value="' + esc(detect.triggerNode || '离开卸货地') + '" disabled>', '')
        + formField('磅单状态', '<input class="form-control-text" value="' + esc(detect.weighbillStatus || '未上传') + '" disabled>', '')
        + formField('忽略上传处理中', '<input class="form-control-text" value="是" disabled>', '上传中不产生告警')
        + '</div>')
      + formSection('告警等级', '<p class="wr-level-help">同一卸货节点只产生一条告警，15 / 30 / 60 分钟在原事件上升级。</p>' + levelRows(item, '离场后仍未上传', minuteControl))
      + formSection('恢复条件', '<div class="wr-recovery"><b>恢复条件</b><span>磅单上传成功或确认无需磅单</span></div>')
      + noteSection(type);
  }
  function socModalBody(item) {
    var type = typeByCode(item.code);
    var confirm = item.confirmConfig || {};
    var recovery = item.recoveryConfig || {};
    return formSection('基础信息', baseFields(item)) + lateProjectSection(item)
      + formSection('业务识别条件', '<div class="form-grid col-2">'
        + formField('SOC持续满足', '<div class="wr-unit-input"><input class="form-control-text" id="wrConfirmMinutes" type="number" min="1" max="30" value="' + Number(confirm.confirmMinutes || 2) + '"><em>分钟</em></div>', '1～30 分钟，过滤单点抖动')
        + formField('数据有效期', '<div class="wr-unit-input"><input class="form-control-text" id="wrDataValid" type="number" min="1" max="60" value="' + Number(confirm.dataValidMinutes || 5) + '"><em>分钟</em></div>', '超过有效期不产生新告警')
        + '</div>')
      + formSection('告警等级', '<p class="wr-level-help">SOC 越低风险越高。启用等级必须满足一般阈值高于严重，严重高于紧急。</p>' + levelRows(item, 'SOC 阈值', function (level, index) {
        return '<div class="wr-unit-input ac-level-input"><input class="form-control-text wr-threshold" data-level-index="' + index + '" type="number" min="1" max="100" value="' + Number(level.threshold || 0) + '"><em>%</em></div>';
      }))
      + formSection('恢复条件', '<div class="form-grid col-2">'
        + formField('恢复 SOC', '<div class="wr-unit-input"><input class="form-control-text" id="wrRecoverSoc" type="number" min="1" max="100" value="' + Number(recovery.recoverSoc || 35) + '"><em>%</em></div>', '必须高于一般告警 SOC')
        + formField('恢复持续时间', '<div class="wr-unit-input"><input class="form-control-text" id="wrRecoverHold" type="number" min="1" max="60" value="' + Number(recovery.recoverDurationMinutes || 2) + '"><em>分钟</em></div>', '开始充电不会立刻关闭仍偏低的事件')
        + '</div>')
      + noteSection(type);
  }
  function fatigueModalBody(item) {
    var type = typeByCode(item.code);
    var detect = item.detectConfig || {};
    var recovery = item.recoveryConfig || {};
    return formSection('基础信息', baseFields(item)) + lateProjectSection(item)
      + formSection('业务识别条件', '<div class="form-grid col-2">'
        + formField('驾驶判定速度', '<div class="wr-unit-input"><input class="form-control-text" id="wrDriveSpeed" type="number" min="1" max="30" value="' + Number(detect.drivingSpeedKph || 5) + '"><em>km/h</em></div>', '存在绑定司机且车速高于该值视为驾驶')
        + formField('数据有效期', '<div class="wr-unit-input"><input class="form-control-text" id="wrDataValid" type="number" min="1" max="60" value="' + Number(detect.dataValidMinutes || 5) + '"><em>分钟</em></div>', '数据失效时暂停累计')
        + '</div>')
      + formSection('告警等级', '<p class="wr-level-help">等级只升不降。启用等级的连续驾驶时长必须递增。</p>' + levelRows(item, '连续驾驶时长', function (level, index) {
        return '<div class="wr-unit-input ac-level-input"><input class="form-control-text wr-fatigue" data-level-index="' + index + '" type="number" min="1" max="24" step="0.1" value="' + formatHours(level.thresholdMinutes) + '"><em>小时</em></div>';
      }))
      + formSection('恢复条件', '<div class="form-grid col-2">' + formField('有效休息时长', '<div class="wr-unit-input"><input class="form-control-text" id="wrRestMinutes" type="number" min="5" max="120" value="' + Number(recovery.restThresholdMinutes || 20) + '"><em>分钟</em></div>', '连续非驾驶达到该时长后结束当前周期') + '</div><p class="form-hint">短时停车不会重置连续驾驶周期。更换司机也会结束原司机当前周期。</p>')
      + noteSection(type);
  }
  function modalBody(item) {
    if (item.code === 'TRANSPORT_PARKING') return parkingModalBody(item);
    if (isAreaCode(item.code)) return areaStayModalBody(item);
    if (item.code === 'VEHICLE_OVERSPEED') return speedModalBody(item);
    if (item.code === 'VEHICLE_LOW_SOC') return socModalBody(item);
    if (item.code === 'DRIVER_FATIGUE') return fatigueModalBody(item);
    return weighbillModalBody(item);
  }
  function draftOf(type) {
    var api = store();
    if (type.code === 'TRANSPORT_PARKING') return api.getParkingDraftTemplate();
    if (type.code === 'AREA_STAY_TIMEOUT') return api.getAreaStayDraftTemplate();
    if (type.code === 'VEHICLE_OVERSPEED') return api.getSpeedDraftTemplate();
    if (type.code === 'VEHICLE_LOW_SOC') return api.getSocDraftTemplate();
    if (type.code === 'DRIVER_FATIGUE') return api.getFatigueDraftTemplate();
    return api.getWeighbillDraftTemplate();
  }
  function readNumber(selector, index) {
    var input = document.querySelector(selector + '[data-level-index="' + index + '"]');
    return input ? Number(input.value) : NaN;
  }
  function readLevels(code) {
    return LEVEL_NAMES.map(function (name, index) {
      var enabledInput = document.querySelector('.wr-level-enabled[data-level-index="' + index + '"]');
      var enabled = !!(enabledInput && enabledInput.checked);
      if (code === 'VEHICLE_OVERSPEED') {
        var unitInput = document.querySelector('.wr-duration-unit[data-level-index="' + index + '"]');
        var unit = unitInput && unitInput.value === '分钟' ? '分钟' : '秒';
        var raw = readNumber('.wr-duration', index);
        return { level: name, enabled: enabled, speedThreshold: readNumber('.wr-speed', index), durationSeconds: unit === '分钟' ? Math.round(raw * 60) : Math.round(raw), durationUnit: unit };
      }
      if (code === 'DRIVER_FATIGUE') return { level: name, enabled: enabled, thresholdMinutes: Math.round(readNumber('.wr-fatigue', index) * 60) };
      return { level: name, enabled: enabled, threshold: readNumber('.wr-threshold', index) };
    });
  }
  function checkedValues(name) {
    return Array.prototype.map.call(document.querySelectorAll(HOST + ' input[name="' + name + '"]:checked'), function (input) { return input.value; });
  }
  function checkedNamed(name) {
    return Array.prototype.map.call(document.querySelectorAll(HOST + ' input[name="' + name + '"]:checked'), function (input) {
      return { id: input.value, name: input.getAttribute('data-name') || input.value };
    });
  }
  function readInteger(id, min, max, label) {
    var raw = String(((document.getElementById(id) || {}).value || '')).trim();
    if (!/^-?\d+$/.test(raw)) return { error: label + '必须为整数' };
    var value = Number(raw);
    if (value < min || value > max) return { error: label + '应为 ' + min + ' 到 ' + max };
    return { value: value };
  }
  function readNameEnabled() {
    var name = ((document.getElementById('wrName') || {}).value || '').trim();
    if (!name) return { error: '请填写规则名称' };
    if (name.length > 40) return { error: '规则名称最多 40 字' };
    return { name: name, enabled: ((document.getElementById('wrEnabled') || {}).value || '启用') === '启用' };
  }
  function projectPatch(name) {
    var scope = (document.getElementById('wrScope') || {}).value || '全部项目';
    var picked = scope === '指定项目' ? checkedNamed(name) : [];
    if (scope === '指定项目' && !picked.length) return { error: '请选择至少一个项目' };
    return { scopeType: scope, projectIds: picked.map(function (item) { return item.id; }), projectNames: picked.map(function (item) { return item.name; }) };
  }
  function readPatch(rule) {
    var base = readNameEnabled();
    if (base.error) return base;
    if (rule.code === 'TRANSPORT_PARKING') {
      var monitorPeriod = (document.getElementById('wrMonitorPeriod') || {}).value || '全天';
      var monitorStart = (document.getElementById('wrMonitorStart') || {}).value || '06:00';
      var monitorEnd = (document.getElementById('wrMonitorEnd') || {}).value || '23:00';
      if (monitorPeriod === '自定义' && (!monitorStart || !monitorEnd)) return { error: '请填写自定义监控时段' };
      var stillSpeed = Number((document.getElementById('wrStillSpeed') || {}).value);
      if (!isFinite(stillSpeed) || stillSpeed < 0 || stillSpeed > 20) return { error: '静止速度阈值应为 0 到 20 km/h' };
      var minStill = readInteger('wrMinStill', 1, 120, '最小持续静止时间');
      if (minStill.error) return minStill;
      var recoverSpeed = Number((document.getElementById('wrRecoverSpeed') || {}).value);
      if (!isFinite(recoverSpeed) || recoverSpeed <= stillSpeed) return { error: '恢复速度阈值必须高于静止速度阈值' };
      var recoverHold = readInteger('wrRecoverHold', 1, 60, '恢复持续时间');
      if (recoverHold.error) return recoverHold;
      var scope = ((document.querySelector(HOST + ' input[name="wrScopeMode"]:checked') || {}).value) || '组织部门';
      var depts = scope === '组织部门' ? checkedNamed('wrDeptIds') : [];
      var plates = scope === '自定义车辆' ? checkedValues('wrVehiclePlates') : [];
      if (scope === '组织部门' && !depts.length) return { error: '请选择至少一个组织部门' };
      if (scope === '自定义车辆' && !plates.length) return { error: '请选择至少一辆车' };
      return {
        name: base.name, enabled: base.enabled, monitorPeriod: monitorPeriod, monitorStart: monitorStart, monitorEnd: monitorEnd,
        levels: readLevels(rule.code), scopeType: scope, projectIds: [], projectNames: [],
        departmentIds: depts.map(function (dept) { return dept.id; }), departmentNames: depts.map(function (dept) { return dept.name; }),
        vehiclePlates: plates,
        detectConfig: {
          stillSpeedKph: stillSpeed, minStillMinutes: minStill.value,
          excludeLoading: !!(document.getElementById('wrExcludeLoading') || {}).checked,
          excludeUnloading: !!(document.getElementById('wrExcludeUnloading') || {}).checked,
          excludeCharging: !!(document.getElementById('wrExcludeCharging') || {}).checked
        },
        recoveryConfig: { recoverSpeedKph: recoverSpeed, recoverDurationMinutes: recoverHold.value, endOnTaskComplete: !!(document.getElementById('wrEndOnTask') || {}).checked }
      };
    }
    if (isAreaCode(rule.code)) {
      var scopeType = (document.getElementById('wrScope') || {}).value || '全部项目';
      var projects = scopeType === '指定项目' ? checkedNamed('wrAreaProjects') : [];
      var fenceMode = ((document.querySelector(HOST + ' input[name="wrFenceMode"]:checked') || {}).value) || '全部符合条件围栏';
      var fences = fenceMode === '指定围栏' ? checkedNamed('wrAreaFences') : [];
      if (scopeType === '指定项目' && !projects.length) return { error: '请选择至少一个指定项目' };
      if (fenceMode === '指定围栏' && !fences.length) return { error: '请选择至少一个指定围栏' };
      return {
        name: base.name, enabled: base.enabled, scopeType: scopeType, areaType: (document.getElementById('wrAreaType') || {}).value || '全部类型',
        levels: readLevels('AREA_STAY_TIMEOUT'),
        projectIds: projects.map(function (item) { return item.id; }), projectNames: projects.map(function (item) { return item.name; }),
        fenceIds: fences.map(function (item) { return item.id; }), fenceNames: fences.map(function (item) { return item.name; })
      };
    }
    if (rule.code === 'VEHICLE_OVERSPEED') {
      var projectsPatch = projectPatch('wrSpeedProjects');
      if (projectsPatch.error) return projectsPatch;
      var speedRecover = Number((document.getElementById('wrRecoverSpeed') || {}).value);
      var speedSecondsValue = Number((document.getElementById('wrRecoverSeconds') || {}).value);
      if (!isFinite(speedRecover) || speedRecover <= 0) return { error: '恢复车速阈值必须大于 0' };
      if (!Number.isInteger(speedSecondsValue) || speedSecondsValue <= 0) return { error: '恢复持续时间必须大于 0' };
      return Object.assign({
        name: base.name, enabled: base.enabled, levels: readLevels(rule.code),
        speedSourcePolicy: (document.getElementById('wrSpeedSource') || {}).value || 'CAN_THEN_GPS',
        recoveryConfig: { recoverSpeedKph: speedRecover, recoverDurationSeconds: speedSecondsValue }
      }, projectsPatch);
    }
    var lateProjects = projectPatch('wrLateProjects');
    if (lateProjects.error) return lateProjects;
    var patch = Object.assign({ name: base.name, enabled: base.enabled, code: rule.code, levels: readLevels(rule.code) }, lateProjects);
    if (rule.code === 'VEHICLE_LOW_SOC') {
      var confirmMinutes = readInteger('wrConfirmMinutes', 1, 30, 'SOC 持续确认时间');
      if (confirmMinutes.error) return confirmMinutes;
      var dataValid = readInteger('wrDataValid', 1, 60, '数据有效期');
      if (dataValid.error) return dataValid;
      var recoverSoc = Number((document.getElementById('wrRecoverSoc') || {}).value);
      var recoverHoldSoc = readInteger('wrRecoverHold', 1, 60, '恢复持续时间');
      if (recoverHoldSoc.error) return recoverHoldSoc;
      patch.confirmConfig = { confirmMinutes: confirmMinutes.value, dataValidMinutes: dataValid.value };
      patch.recoveryConfig = { recoverSoc: recoverSoc, recoverDurationMinutes: recoverHoldSoc.value };
    } else if (rule.code === 'DRIVER_FATIGUE') {
      var driveSpeed = Number((document.getElementById('wrDriveSpeed') || {}).value);
      if (!isFinite(driveSpeed) || driveSpeed <= 0 || driveSpeed > 30) return { error: '驾驶判定速度应为 1 到 30 km/h' };
      var fatigueValid = readInteger('wrDataValid', 1, 60, '数据有效期');
      if (fatigueValid.error) return fatigueValid;
      var rest = readInteger('wrRestMinutes', 5, 120, '有效休息时长');
      if (rest.error) return rest;
      patch.detectConfig = { drivingSpeedKph: driveSpeed, dataValidMinutes: fatigueValid.value };
      patch.recoveryConfig = { restThresholdMinutes: rest.value };
    }
    return patch;
  }
  function createRule(rule, patch) {
    if (rule.code === 'TRANSPORT_PARKING') return store().addParkingRule(patch);
    if (isAreaCode(rule.code)) return store().addAreaStayRule(patch);
    if (rule.code === 'VEHICLE_OVERSPEED') return store().addSpeedRule(patch);
    return store().addLateRule(patch);
  }
  function formFingerprint(rule) {
    if (!rule || !document.getElementById('wrName')) return '';
    var common = {
      name: ((document.getElementById('wrName') || {}).value || '').trim(),
      enabled: (document.getElementById('wrEnabled') || {}).value || '',
      levels: readLevels(rule.code)
    };
    if (rule.code === 'TRANSPORT_PARKING') {
      common.scope = ((document.querySelector(HOST + ' input[name="wrScopeMode"]:checked') || {}).value) || '';
      common.departments = checkedValues('wrDeptIds');
      common.plates = checkedValues('wrVehiclePlates');
      common.period = (document.getElementById('wrMonitorPeriod') || {}).value || '';
    } else if (isAreaCode(rule.code)) {
      common.scope = (document.getElementById('wrScope') || {}).value || '';
      common.areaType = (document.getElementById('wrAreaType') || {}).value || '';
      common.fences = checkedValues('wrAreaFences');
    } else {
      common.scope = (document.getElementById('wrScope') || {}).value || '';
      common.projects = checkedValues(rule.code === 'VEHICLE_OVERSPEED' ? 'wrSpeedProjects' : 'wrLateProjects');
    }
    return JSON.stringify(common);
  }

  function sectionHtml(title, inner) { return '<section class="detail-section"><div class="detail-section-title">' + title + '</div>' + inner + '</section>'; }
  function clockText(stamp) {
    var match = String(stamp || '').match(/(\d{2}:\d{2})/);
    return match ? match[1] : '—';
  }
  function preciseSpan(start, end) {
    var from = new Date(String(start || '').replace(/-/g, '/')).getTime();
    var to = new Date(String(end || '').replace(/-/g, '/')).getTime();
    if (!isFinite(from) || !isFinite(to) || to < from) return '';
    var total = Math.round((to - from) / 1000);
    var minutes = Math.floor(total / 60);
    var seconds = total % 60;
    if (minutes >= 60) {
      var hours = Math.floor(minutes / 60);
      var remain = minutes % 60;
      return remain ? (hours + '小时' + remain + '分钟') : (hours + '小时');
    }
    if (!minutes) return seconds + '秒';
    return seconds ? (minutes + '分' + seconds + '秒') : (minutes + '分钟');
  }
  function snapshotLevel(event, name) {
    return (((event.ruleSnapshot || {}).levels) || []).filter(function (item) {
      return item.level === name && item.enabled !== false;
    })[0] || null;
  }
  function currentLevelConfig(event) { return snapshotLevel(event, displayLevel(event)) || snapshotLevel(event, event.level); }
  function generalLevelConfig(event) { return snapshotLevel(event, '一般'); }
  function metricsOf(event) { return event.metrics || {}; }
  function socConfirmMinutes(event) {
    var minutes = Number(((event.ruleSnapshot || {}).confirmConfig || {}).confirmMinutes);
    return isFinite(minutes) && minutes > 0 ? minutes : 2;
  }
  function socRecoverSentence(event) {
    var recovery = (event.ruleSnapshot || {}).recoveryConfig || {};
    var soc = recovery.recoverSoc != null ? recovery.recoverSoc : 35;
    var minutes = recovery.recoverDurationMinutes != null ? recovery.recoverDurationMinutes : 2;
    return 'SOC ≥' + soc + '%并持续' + minutes + '分钟';
  }
  function fatigueRestMinutes(event) {
    var minutes = Number(((event.ruleSnapshot || {}).recoveryConfig || {}).restThresholdMinutes);
    return isFinite(minutes) && minutes > 0 ? minutes : 20;
  }
  function levelHeldText(event) {
    var metrics = metricsOf(event);
    var start = metrics.thresholdCandidateStartedAt || event.currentLevelTriggerTime || event.triggeredAt;
    var end = event.recoveredAt || metrics.evaluatedAt || metrics.lastTelemetryAt;
    return preciseSpan(start, end) || '—';
  }
  function departLabel(code) {
    if (code === 'GEOFENCE') return '电子围栏';
    if (code === 'DRIVER') return '司机确认离场';
    if (code === 'MANUAL') return '人工修正';
    return '—';
  }
  function runStatusText(metrics) {
    metrics = metrics || {};
    if (metrics.charging === true || metrics.chargingStatus === '充电中') return '充电中';
    if (metrics.loadingScene === true) return '装货作业';
    if (metrics.unloadingScene === true) return '卸货作业';
    var speed = Number(metrics.speed != null ? metrics.speed : metrics.currentSpeed);
    if (!isFinite(speed)) return '—';
    return speed > 5 ? '行驶中' : '驻车静止';
  }
  function coordText(event) {
    var metrics = metricsOf(event);
    var lng = metrics.lng != null ? metrics.lng : event.lng;
    var lat = metrics.lat != null ? metrics.lat : event.lat;
    var known = {
      '云A·D8021': [102.832116, 24.418532], '云A·E1936': [102.741208, 24.352441],
      '云A·F4470': [102.668431, 24.501226], '云A·G2288': [102.905774, 24.287615],
      '云A·H3188': [102.612903, 24.446118], '云A·H6612': [102.978552, 24.533904],
      '云A·K4419': [100.812446, 22.004318], '云A·J5501': [100.796221, 21.982704],
      '云A·S1008': [102.854337, 24.369882]
    };
    if ((lng == null || lat == null) && known[event.plate]) {
      lng = known[event.plate][0];
      lat = known[event.plate][1];
    }
    if (lng == null || lat == null || lng === '' || lat === '') return '—';
    var left = Number(lng);
    var right = Number(lat);
    if (!isFinite(left) || !isFinite(right)) return '—';
    return left.toFixed(6) + ', ' + right.toFixed(6);
  }
  function speedLimitValue(event) {
    var level = currentLevelConfig(event);
    var limit = level && level.speedThreshold != null ? Number(level.speedThreshold) : 80;
    return isFinite(limit) ? limit : 80;
  }
  function speedHeadline(event) {
    var metrics = metricsOf(event);
    var max = Number(event.maxSpeed != null ? event.maxSpeed : metrics.maxSpeed);
    var current = Number(metrics.speed);
    if (isFinite(max)) return max;
    return isFinite(current) ? current : NaN;
  }
  function joinSentence(remark, suffix) {
    var text = String(remark || '').replace(/。$/, '').trim();
    if (!text) return suffix;
    if (text.indexOf('触发') >= 0 || text.indexOf('升级') >= 0 || text.indexOf('恢复') >= 0) return text;
    return text + '，' + suffix;
  }
  function dispatchTimelineTitle(log) {
    var remark = String(log.remark || '');
    if (log.action === 'ACKNOWLEDGED') return '调度已知悉';
    if (/联系司机|电话/.test(remark)) return '调度联系司机';
    if (/车队长/.test(remark)) return '调度通知车队长';
    if (log.action === 'HANDLING_STARTED') return '调度开始处理';
    return '调度登记处理';
  }
  function isHandleLog(log) {
    return log.action === 'HANDLED' || log.action === 'MANUAL_HANDLE' || log.action === 'ACKNOWLEDGED' || log.action === 'HANDLING_STARTED';
  }
  function timelineDetail(log, title) {
    if (log.action === 'ENTER_FENCE' || log.action === 'LEAVE_FENCE' || log.action === 'DEPARTED_UNLOAD' || log.action === 'DRIVE_STARTED' || log.action === 'ARRIVED_UNLOAD') return '';
    var remark = String(log.remark || '').replace(/。$/, '').trim();
    var head = String(title || '').replace(/[【】·，。,\s]/g, '');
    var body = remark.replace(/[【】·，。,\s]/g, '');
    if (!remark || remark === title || head.indexOf(body) >= 0 || body.indexOf(head) >= 0) return '';
    return remark;
  }

  var DETAIL_FIELDS = {
    plate: function (event) { return event.plate || '—'; },
    driver: function (event) { return event.driverName || '—'; },
    driverId: function (event) { return event.driverId || '—'; },
    parkingOrg: function (event) { return event.departmentName || event.projectName || '—'; },
    projectOrg: function (event) { return event.projectName || '—'; },
    task: function (event) { return { html: taskLink(event.taskId) }; },
    route: function (event) { return event.route || '—'; },
    cargo: function (event) { return event.cargo || '—'; },
    place: function (event) { return event.location || '—'; },
    alertTime: function (event) { return event.triggeredAt || '—'; },
    recoverTime: function (event) { return event.recoveredAt || '尚未恢复'; },
    ruleName: function (event) { return (event.ruleSnapshot || {}).ruleName || event.ruleName || '—'; },
    parkingStartedAt: function (event) { return parkingStartAt(event) || '—'; },
    parkingDuration: function (event) { return parkingDurationText(event); },
    coordinates: function (event) { return coordText(event); },
    parkingSpeed: function (event) { return uiSpeed(metricsOf(event).speed); },
    vehicleRunStatus: function (event) { return runStatusText(metricsOf(event)); },
    taskStatus: function (event) { return metricsOf(event).taskStatus || metricsOf(event).taskNode || '—'; },
    fenceName: function (event) { return event.fenceName || metricsOf(event).fenceName || '—'; },
    fenceType: function (event) { return event.fenceType || metricsOf(event).fenceType || '—'; },
    enteredAt: function (event) { return event.enterTime || metricsOf(event).enteredAt || '—'; },
    stayDuration: function (event) { return areaStayDurationText(event); },
    leftAt: function (event) {
      var leave = event.leaveTime || metricsOf(event).leaveTime;
      if (leave) return leave;
      if (metricsOf(event).insideBusinessArea === true || event.eventStatus === '发生中') return '尚未离开';
      return '—';
    },
    areaSpeed: function (event) {
      var speed = metricsOf(event).currentSpeed;
      return speed == null ? '—' : speed + ' km/h';
    },
    currentSpeed: function (event) { return uiSpeed(metricsOf(event).speed); },
    maxSpeed: function (event) { return uiSpeed(event.maxSpeed != null ? event.maxSpeed : metricsOf(event).maxSpeed); },
    speedLimit: function (event) { return speedLimitValue(event) + ' km/h'; },
    speedExcess: function (event) {
      var speed = speedHeadline(event);
      var limit = speedLimitValue(event);
      if (!isFinite(speed)) return '—';
      var excess = Math.round((speed - limit) * 10) / 10;
      return (excess > 0 ? excess : 0) + ' km/h';
    },
    overspeedDuration: function (event) { return speedDurationLabel(speedSeconds(event)); },
    overspeedStartedAt: function (event) { return speedStartAt(event) || '—'; },
    unloadNode: function (event) { return metricsOf(event).unloadNodeId || '卸货'; },
    unloadPlace: function (event) { return metricsOf(event).unloadLocation || event.location || '—'; },
    arrivedAt: function (event) { return metricsOf(event).unloadArrivedAt || '—'; },
    departedAt: function (event) { return metricsOf(event).unloadDepartedAt || '—'; },
    departSource: function (event) { return departLabel(metricsOf(event).departTimeSource); },
    waiting: function (event) { return metricText(metricsOf(event).waitingMinutes); },
    billType: function (event) { return metricsOf(event).weighbillType || '卸货磅单'; },
    billStatus: function (event) { return weighbillStatusText(metricsOf(event)); },
    uploading: function (event) {
      var metrics = metricsOf(event);
      if (metrics.uploading === true || metrics.weighbillStatus === '上传处理中') return '正在上传';
      return '否';
    },
    currentSoc: function (event) {
      var metrics = metricsOf(event);
      if (metrics.telemetryValid === false) return { text: '车辆SOC数据已过期', tone: 'danger' };
      return metrics.soc == null ? '—' : metrics.soc + '%';
    },
    triggerSoc: function (event) {
      var metrics = metricsOf(event);
      var value = metrics.triggerSoc != null ? metrics.triggerSoc : metrics.soc;
      if (value == null) return '—';
      if (metrics.telemetryValid === false && metrics.triggerSoc == null) return { text: value + '%（过期读数，不能当实时电量）', tone: 'danger' };
      return value + '%';
    },
    socLevel: function (event) { return displayLevel(event) || '—'; },
    charging: function (event) { return chargingText(metricsOf(event)); },
    socSource: function (event) {
      var source = metricsOf(event).socSource;
      if (source === 'GPS') return 'GPS';
      if (source === 'CAN') return '车辆 CAN/T-BOX';
      return source || '—';
    },
    socUpdatedAt: function (event) { return metricsOf(event).lastTelemetryAt || '—'; },
    socValid: function (event) {
      if (metricsOf(event).telemetryValid === false) return { text: '车辆SOC数据已过期', tone: 'danger' };
      return '有效';
    },
    levelDuration: function (event) { return levelHeldText(event); },
    driveStartedAt: function (event) { return metricsOf(event).drivingStartedAt || '—'; },
    driveDuration: function (event) { return metricText(metricsOf(event).continuousDrivingMinutes); },
    fatigueSpeed: function (event) { return uiSpeed(metricsOf(event).currentSpeed); },
    lastStopAt: function (event) { return metricsOf(event).parkingStartedAt || '当前未停车'; },
    lastStopDuration: function (event) { return metricText(metricsOf(event).continuousParkingMinutes || 0); },
    cycleId: function (event) { return event.drivingCycleId || metricsOf(event).drivingCycleId || '—'; },
    fatigueUpdatedAt: function (event) { return metricsOf(event).lastTelemetryAt || '—'; }
  };
  var OVERVIEW_FIELDS = [
    { key: 'alertTime', label: '告警时间' },
    { key: 'recoverTime', label: '恢复时间' },
    { key: 'ruleName', label: '命中规则' }
  ];
  function vehicleObject(orgKey, orgLabel) {
    return [
      { key: 'plate', label: '车牌号' },
      { key: 'driver', label: '司机' },
      { key: orgKey, label: orgLabel },
      { key: 'task', label: '关联任务单' },
      { key: 'route', label: '线路' },
      { key: 'cargo', label: '货物' },
      { key: 'place', label: '当前位置' }
    ];
  }
  var ALERT_TYPE_CONFIG = {
    TRANSPORT_PARKING: {
      objectSchema: vehicleObject('parkingOrg', '所属部门'),
      detailSchema: [
        { key: 'parkingStartedAt', label: '停车开始时间' },
        { key: 'parkingDuration', label: '当前持续停车时长' },
        { key: 'place', label: '停车位置' },
        { key: 'coordinates', label: '经纬度' },
        { key: 'parkingSpeed', label: '当前速度' },
        { key: 'vehicleRunStatus', label: '当前车辆状态' },
        { key: 'parkingOrg', label: '所属部门' },
        { key: 'task', label: '关联任务单' },
        { key: 'taskStatus', label: '当前任务状态' }
      ],
      headline: function (event) { return { label: '停车时长', value: parkingDurationText(event) }; },
      buildTriggerReason: function (event) {
        var general = generalLevelConfig(event);
        var current = currentLevelConfig(event);
        var generalMinutes = general && general.threshold != null ? general.threshold : 30;
        var lines = ['车辆连续停车 ' + parkingDurationText(event) + '，当前规则一般预警阈值为 ' + generalMinutes + ' 分钟，已满足停车预警条件。'];
        if (current && displayLevel(event) !== '一般' && current.threshold != null) {
          lines.push('当前等级为' + displayLevel(event) + '，对应阈值为 ' + current.threshold + ' 分钟。');
        }
        return lines;
      },
      timelineTitle: function (log, event) {
        if (log.action === 'STILL_STARTED') return '开始持续停车' + (event.location ? ' · ' + event.location : '');
        if (log.action === 'TRIGGERED' || log.action === 'ALERT_CREATED') return '连续停车达到阈值，触发' + (log.toLevel || '一般') + '预警';
        if (log.action === 'LEVEL_UPGRADE' || log.action === 'LEVEL_UPGRADED') return '升级' + (log.toLevel || '');
        if (log.action === 'RECOVERED') return '车辆恢复行驶，事件恢复';
        if (isHandleLog(log)) return dispatchTimelineTitle(log);
        return log.remark || '停车状态更新';
      }
    },
    AREA_STAY_TIMEOUT: {
      objectSchema: vehicleObject('projectOrg', '所属项目'),
      detailSchema: [
        { key: 'fenceName', label: '围栏名称' },
        { key: 'fenceType', label: '围栏类型' },
        { key: 'enteredAt', label: '进入区域时间' },
        { key: 'stayDuration', label: '当前停留时长' },
        { key: 'leftAt', label: '离开区域时间' },
        { key: 'place', label: '当前车辆位置' },
        { key: 'areaSpeed', label: '当前速度' },
        { key: 'projectOrg', label: '所属项目' },
        { key: 'task', label: '关联任务单' }
      ],
      headline: function (event) { return { label: event.eventStatus === '已恢复' ? '最终停留时长' : '已停留', value: areaStayDurationText(event) }; },
      buildTriggerReason: function (event) {
        var fence = event.fenceName || metricsOf(event).fenceName || '业务区域';
        var entered = clockText(event.enterTime || metricsOf(event).enteredAt);
        var current = currentLevelConfig(event);
        var threshold = current && current.threshold != null ? current.threshold : '—';
        return ['车辆于 ' + entered + ' 进入【' + fence + '】，已连续停留 ' + areaStayDurationText(event) + '，当前等级阈值为 ' + threshold + ' 分钟，满足区域停留预警条件。'];
      },
      timelineTitle: function (log, event) {
        var fence = event.fenceName || metricsOf(event).fenceName || '区域';
        if (log.action === 'ENTER_FENCE') return '进入【' + fence + '】';
        if (log.action === 'LEAVE_FENCE') return '离开【' + fence + '】';
        if (log.action === 'ALERT_CREATED' || log.action === 'TRIGGERED') return joinSentence(log.remark, '触发' + (log.toLevel || '一般') + '预警');
        if (log.action === 'LEVEL_UPGRADE' || log.action === 'LEVEL_UPGRADED') return joinSentence(log.remark, '升级' + (log.toLevel || ''));
        if (log.action === 'AUTO_RECOVER' || log.action === 'RECOVERED') return '离开区域，事件恢复';
        if (isHandleLog(log)) return dispatchTimelineTitle(log);
        return log.remark || '区域停留状态更新';
      }
    },
    VEHICLE_OVERSPEED: {
      objectSchema: vehicleObject('projectOrg', '所属项目'),
      detailSchema: [
        { key: 'currentSpeed', label: '当前车速' },
        { key: 'maxSpeed', label: '本次最高车速' },
        { key: 'speedLimit', label: '规则限速值' },
        { key: 'speedExcess', label: '超出速度' },
        { key: 'overspeedDuration', label: '连续超速时长' },
        { key: 'overspeedStartedAt', label: '超速开始时间' },
        { key: 'place', label: '当前/发生位置' },
        { key: 'projectOrg', label: '所属项目' },
        { key: 'task', label: '关联任务单' }
      ],
      headline: function (event) { return { label: '连续超速', value: speedDurationLabel(speedSeconds(event)) }; },
      buildTriggerReason: function (event) {
        var speed = speedHeadline(event);
        var limit = speedLimitValue(event);
        return ['车辆当前/本次最高速度 ' + (isFinite(speed) ? uiSpeed(speed) : '—') + '，规则限速 ' + limit + ' km/h，连续超速 ' + speedDurationLabel(speedSeconds(event)) + '，满足当前等级车速预警条件。'];
      },
      timelineLead: function (event) {
        var levels = [];
        (store().getLogs(event.id) || []).slice().sort(function (a, b) {
          return String(a.operatedAt || '').localeCompare(String(b.operatedAt || ''));
        }).forEach(function (log) {
          var level = log.toLevel;
          if (!level) return;
          if (log.action !== 'ALERT_CREATED' && log.action !== 'TRIGGERED' && log.action !== 'LEVEL_UPGRADE' && log.action !== 'LEVEL_UPGRADED') return;
          if (levels.indexOf(level) < 0) levels.push(level);
        });
        if (levels.length < 2) return '';
        return '同一条超速事件内升级：' + levels.join(' → ');
      },
      timelineTitle: function (log) {
        if (log.action === 'SPEED_START') return '开始连续超速';
        if (log.action === 'ALERT_CREATED' || log.action === 'TRIGGERED') return '触发' + (log.toLevel || '一般') + '预警';
        if (log.action === 'LEVEL_UPGRADE' || log.action === 'LEVEL_UPGRADED') return '升级' + (log.toLevel || '');
        if (log.action === 'RECOVERED') return '车速回到恢复条件，事件恢复';
        if (isHandleLog(log)) return dispatchTimelineTitle(log);
        return log.remark || '车速状态更新';
      }
    },
    UNLOAD_WEIGHBILL_MISSING: {
      objectSchema: vehicleObject('projectOrg', '所属项目'),
      detailSchema: [
        { key: 'task', label: '任务单号' },
        { key: 'unloadNode', label: '卸货节点' },
        { key: 'unloadPlace', label: '卸货地' },
        { key: 'arrivedAt', label: '到达卸货地时间' },
        { key: 'departedAt', label: '离开卸货地时间' },
        { key: 'departSource', label: '离场时间来源' },
        { key: 'waiting', label: '已超时时长' },
        { key: 'billType', label: '磅单类型' },
        { key: 'billStatus', label: '当前磅单状态' },
        { key: 'uploading', label: '是否正在上传' },
        { key: 'driver', label: '当前司机' },
        { key: 'plate', label: '当前车辆' }
      ],
      headline: function (event) { return { label: '已超时', value: metricText(metricsOf(event).waitingMinutes) }; },
      buildTriggerReason: function (event) {
        var metrics = metricsOf(event);
        var place = metrics.unloadLocation || event.location || '卸货地';
        var left = clockText(metrics.unloadDepartedAt);
        var current = currentLevelConfig(event);
        var threshold = current && current.threshold != null ? current.threshold : 15;
        var uploaded = metrics.weighbillUploaded === true || metrics.weighbillStatus === '已上传';
        var lead = uploaded
          ? '车辆已于 ' + left + ' 有效离开【' + place + '】。卸货磅单现已上传成功，本条预警结束。'
          : '车辆已于 ' + left + ' 有效离开【' + place + '】，当前磅单仍未上传成功，已超过规则规定的 ' + threshold + ' 分钟，因此产生未上传磅单预警。';
        return [lead, '离场来源：' + departLabel(metrics.departTimeSource)];
      },
      timelineTitle: function (log, event) {
        var source = metricsOf(event).departTimeSource;
        if (log.action === 'ARRIVED_UNLOAD') return '到达卸货地';
        if (log.action === 'DEPARTED_UNLOAD') {
          if (source === 'GEOFENCE') return '电子围栏识别车辆离开卸货地';
          if (source === 'MANUAL') return '人工修正确认车辆离开卸货地';
          if (source === 'DRIVER') return '司机确认车辆离开卸货地';
          return '确认车辆离开卸货地';
        }
        if (log.action === 'TRIGGERED' || log.action === 'ALERT_CREATED') return joinSentence(log.remark, '触发' + (log.toLevel || '一般') + '预警');
        if (log.action === 'LEVEL_UPGRADE' || log.action === 'LEVEL_UPGRADED') return joinSentence(log.remark, '升级' + (log.toLevel || ''));
        if (log.action === 'UPLOADED') return '司机上传磅单成功';
        if (log.action === 'NO_WEIGHBILL') return '确认无需磅单，事件恢复';
        if (log.action === 'RECOVERED') return '事件自动恢复';
        if (isHandleLog(log)) return dispatchTimelineTitle(log);
        return log.remark || '磅单状态更新';
      }
    },
    VEHICLE_LOW_SOC: {
      objectSchema: vehicleObject('projectOrg', '所属项目'),
      detailSchema: [
        { key: 'currentSoc', label: '当前SOC' },
        { key: 'triggerSoc', label: '告警触发时SOC' },
        { key: 'socLevel', label: '当前告警等级' },
        { key: 'charging', label: '充电状态' },
        { key: 'socSource', label: 'SOC数据来源' },
        { key: 'socUpdatedAt', label: 'SOC最后更新时间' },
        { key: 'socValid', label: '数据是否有效' },
        { key: 'place', label: '当前车辆位置' },
        { key: 'task', label: '当前任务单' },
        { key: 'driver', label: '当前司机' },
        { key: 'levelDuration', label: '当前等级持续时间' }
      ],
      headline: function (event) {
        var metrics = metricsOf(event);
        if (metrics.telemetryValid === false) return { label: '当前SOC', value: '数据已过期' };
        return { label: '当前SOC', value: metrics.soc == null ? '—' : metrics.soc + '%' };
      },
      buildTriggerReason: function (event) {
        var metrics = metricsOf(event);
        var recovery = '恢复条件：' + socRecoverSentence(event) + '。';
        if (metrics.telemetryValid === false) {
          var last = metrics.soc == null ? '—' : metrics.soc + '%';
          return {
            tone: 'danger',
            paragraphs: [
              '车辆SOC数据已过期，不能按这份读数继续判断实时电量。',
              '最后一次回传 SOC 为 ' + last + '，数据时间 ' + (metrics.lastTelemetryAt || '—') + '。',
              recovery
            ]
          };
        }
        if (event.eventStatus === '已恢复') {
          return [
            '当前SOC为' + (metrics.soc == null ? '—' : metrics.soc + '%') + '。本事件最高达到' + (displayLevel(event) || '—') + '。' + (event.recoverReason ? ('恢复原因：' + event.recoverReason + '。') : ''),
            recovery
          ];
        }
        var levelName = displayLevel(event) || '一般';
        var current = currentLevelConfig(event);
        var threshold = current && current.threshold != null ? current.threshold : '—';
        var verb = levelName === '一般' ? '因此产生一般预警' : ('因此当前事件升级为' + levelName + '预警');
        return [
          '当前SOC为' + (metrics.soc == null ? '—' : metrics.soc + '%') + '，' + levelName + '等级阈值为≤' + threshold + '%，已连续满足该阈值' + levelHeldText(event) + '，持续确认要求为' + socConfirmMinutes(event) + '分钟，' + verb + '。',
          recovery
        ];
      },
      timelineTitle: function (log) {
        if (log.action === 'SOC_LOW') return log.remark || 'SOC 进入低电量观察';
        if (log.action === 'TRIGGERED' || log.action === 'ALERT_CREATED') return joinSentence(log.remark, '触发' + (log.toLevel || '一般') + '预警');
        if (log.action === 'LEVEL_UPGRADE' || log.action === 'LEVEL_UPGRADED') return joinSentence(log.remark, '升级' + (log.toLevel || ''));
        if (log.action === 'CHARGING_STARTED') return '开始充电';
        if (log.action === 'RECOVERED') return joinSentence(log.remark, '事件恢复');
        if (isHandleLog(log)) return dispatchTimelineTitle(log);
        return log.remark || '电量状态更新';
      }
    },
    DRIVER_FATIGUE: {
      objectKicker: '本条告警以司机和连续驾驶周期为主体，车辆只表示当前驾驶关系。',
      objectSchema: [
        { key: 'driver', label: '司机', emphasis: true },
        { key: 'driverId', label: '司机工号' },
        { key: 'plate', label: '当前驾驶车辆' },
        { key: 'projectOrg', label: '所属项目' },
        { key: 'task', label: '当前任务单' },
        { key: 'cycleId', label: '驾驶周期' },
        { key: 'place', label: '当前位置' }
      ],
      detailSchema: [
        { key: 'driver', label: '司机姓名', emphasis: true },
        { key: 'driverId', label: '司机工号' },
        { key: 'plate', label: '当前驾驶车辆' },
        { key: 'driveStartedAt', label: '连续驾驶开始时间' },
        { key: 'driveDuration', label: '当前连续驾驶时长' },
        { key: 'fatigueSpeed', label: '当前速度' },
        { key: 'lastStopAt', label: '最近一次停车时间' },
        { key: 'lastStopDuration', label: '最近停车持续时长' },
        { key: 'cycleId', label: '当前驾驶周期' },
        { key: 'task', label: '当前任务单' },
        { key: 'fatigueUpdatedAt', label: '数据最后更新时间' }
      ],
      headline: function (event) { return { label: '连续驾驶', value: metricText(metricsOf(event).continuousDrivingMinutes) }; },
      handleContext: function (event) {
        return (event.driverName || '—') + ' · 驾驶 ' + (event.plate || '—') + ' · ' + (event.taskId || '无任务单');
      },
      buildTriggerReason: function (event) {
        var metrics = metricsOf(event);
        var name = event.driverName || '司机';
        var levelName = displayLevel(event) || '一般';
        var current = currentLevelConfig(event);
        var threshold = current && current.thresholdMinutes != null ? formatHours(current.thresholdMinutes) : '—';
        var rest = fatigueRestMinutes(event);
        var rested = Number(metrics.continuousParkingMinutes || 0) >= Number(rest) || event.eventStatus === '已恢复';
        var reason = event.recoverReason
          ? ('恢复原因：' + event.recoverReason + '。')
          : (rested ? '已形成有效休息。' : '期间未形成≥' + rest + '分钟有效休息，因此产生' + levelName + '疲劳驾驶预警。');
        return [
          '司机' + name + '当前驾驶周期已连续驾驶' + metricText(metrics.continuousDrivingMinutes) + '，' + levelName + '预警阈值为' + threshold + '小时，' + reason,
          '有效休息条件：连续非驾驶≥' + rest + '分钟'
        ];
      },
      timelineTitle: function (log) {
        if (log.action === 'DRIVE_STARTED') return '开始当前驾驶周期';
        if (log.action === 'SHORT_STOP') return log.remark || '短停，连续驾驶周期继续';
        if (log.action === 'DRIVE_RESUMED') return '恢复驾驶，连续驾驶周期继续';
        if (log.action === 'TRIGGERED' || log.action === 'ALERT_CREATED') return joinSentence(log.remark, '触发' + (log.toLevel || '一般') + '预警');
        if (log.action === 'LEVEL_UPGRADE' || log.action === 'LEVEL_UPGRADED') return joinSentence(log.remark, '升级' + (log.toLevel || ''));
        if (log.action === 'REST_STARTED') return '开始停车休息';
        if (log.action === 'DRIVER_CHANGED') return '驾驶员变更，当前驾驶周期结束';
        if (log.action === 'RECOVERED') return joinSentence(log.remark, '事件恢复');
        if (isHandleLog(log)) return dispatchTimelineTitle(log);
        return log.remark || '驾驶周期更新';
      }
    }
  };
  Object.keys(ALERT_TYPE_CONFIG).forEach(function (code) {
    var type = TYPES.filter(function (item) { return item.code === code; })[0];
    var extra = ALERT_TYPE_CONFIG[code];
    if (!type || !extra) return;
    Object.keys(extra).forEach(function (key) { type[key] = extra[key]; });
  });

  function resolveDetailField(event, key) {
    var resolver = DETAIL_FIELDS[key];
    var value = resolver ? resolver(event) : '—';
    if (value && typeof value === 'object') {
      return {
        text: value.text == null || value.text === '' ? '—' : String(value.text),
        html: value.html || '',
        tone: value.tone || ''
      };
    }
    return { text: value == null || value === '' ? '—' : String(value), html: '', tone: '' };
  }
  function schemaRows(schema, event) {
    return (schema || []).map(function (field) {
      var resolved = resolveDetailField(event, field.key);
      var classes = [];
      if (field.emphasis) classes.push('is-emphasis');
      if (resolved.tone) classes.push('is-' + resolved.tone);
      var body = resolved.html || esc(resolved.text);
      return '<div' + (classes.length ? ' class="' + classes.join(' ') + '"' : '') + '><dt>' + esc(field.label) + '</dt><dd>' + body + '</dd></div>';
    }).join('');
  }
  function schemaSection(title, schema, event, extra) {
    return sectionHtml(title, (extra || '') + '<dl class="ac-kv">' + schemaRows(schema, event) + '</dl>');
  }
  function overviewHtml(type, event) {
    var metric = summaryMetric(type, event);
    return sectionHtml('告警概览', '<div class="ac-detail-summary"><span>' + levelBadge(displayLevel(event)) + '<small>告警等级</small></span><span>' + eventBadge(type, event) + '<small>事件状态</small></span><span>' + handleBadge(event.handleStatus) + '<small>处理状态</small></span><span><b>' + esc(metric.value) + '</b><small>' + esc(metric.label) + '</small></span></div><dl class="ac-kv ac-overview-meta">' + schemaRows(OVERVIEW_FIELDS, event) + '</dl>');
  }
  function objectSection(config, event) {
    var kicker = config.objectKicker ? '<p class="ac-object-kicker">' + esc(config.objectKicker) + '</p>' : '';
    return schemaSection('告警对象', config.objectSchema, event, kicker);
  }
  function buildBusinessDetail(event, schema) { return schemaSection('业务详情', schema, event); }
  function triggerSection(config, event) {
    var built = config.buildTriggerReason ? config.buildTriggerReason(event) : [];
    var paragraphs = Array.isArray(built) ? built : (built.paragraphs || []);
    var tone = Array.isArray(built) ? '' : (built.tone || '');
    var html = '<div class="ac-trigger' + (tone ? ' is-' + tone : '') + '">' + paragraphs.filter(Boolean).map(function (text, index) {
      return '<p class="' + (index ? 'ac-trigger-note' : 'ac-trigger-lead') + '">' + esc(text) + '</p>';
    }).join('') + '</div>';
    return sectionHtml('触发依据', html);
  }
  function buildAlertTimeline(event, config) {
    return (store().getLogs(event.id) || []).slice().sort(function (a, b) {
      return String(a.operatedAt || '').localeCompare(String(b.operatedAt || ''));
    }).map(function (log) {
      var title = config.timelineTitle ? config.timelineTitle(log, event) : (log.remark || '状态更新');
      return {
        at: log.operatedAt,
        action: log.action,
        title: title,
        detail: timelineDetail(log, title),
        operator: log.operator && log.operator !== '系统' ? log.operator : ''
      };
    });
  }
  function timelineSection(event, config) {
    var items = buildAlertTimeline(event, config);
    var lead = config.timelineLead ? config.timelineLead(event) : '';
    var html = items.map(function (item) {
      var tone = String(item.action || '').toLowerCase();
      return '<li class="is-' + esc(tone) + '"><i></i><div><time>' + esc(clockText(item.at)) + '</time><b>' + esc(item.title) + '</b>'
        + (item.detail || item.operator ? '<p>' + esc(item.detail || '') + (item.operator ? '<span> · ' + esc(item.operator) + '</span>' : '') + '</p>' : '')
        + '</div></li>';
    }).join('') || '<li><i></i><div><b>暂无时间线</b></div></li>';
    return sectionHtml('事件时间线', (lead ? '<p class="ac-timeline-lead">' + esc(lead) + '</p>' : '') + '<ol class="ac-timeline">' + html + '</ol>');
  }
  function handleRecordsHtml(event) {
    var records = event.handleRecords || [];
    if (!records.length) return '<p class="ac-mock-hint">暂无处理记录。</p>';
    return '<ol class="ac-handle-records">' + records.map(function (record) {
      return '<li><time>' + esc(record.handleTime) + '</time><b>' + esc(record.handler || '—') + ' · ' + esc(record.handleType) + '</b>'
        + (record.parkingReason ? '<p>停车原因：' + esc(record.parkingReason) + '</p>' : '')
        + (record.falseAlarmReason ? '<p>原因：' + esc(record.falseAlarmReason) + '</p>' : '')
        + '<p>' + esc(record.handleResult || '') + '</p></li>';
    }).join('') + '</ol>';
  }
  function renderDetailDrawer(id) {
    var event = store() && store().getEvent(id);
    if (!event) return;
    var type = typeByCode(event.ruleCode || event.alertType);
    var config = ALERT_TYPE_CONFIG[type.code] || type;
    var canHandle = event.handleStatus !== '已处理';
    var view = {
      common: overviewHtml(type, event) + objectSection(config, event),
      business: buildBusinessDetail(event, config.detailSchema),
      triggerReason: triggerSection(config, event),
      timeline: timelineSection(event, config),
      handlingRecords: event.handleRecords || []
    };
    var html = '<header class="ac-drawer-header"><div><small>' + esc(event.id) + '</small><h2>' + esc(type.name) + '</h2></div><button type="button" onclick="acCloseDrawer()" aria-label="关闭">×</button></header>'
      + '<div class="ac-drawer-body">' + view.common + view.business + view.triggerReason + view.timeline
      + sectionHtml('处理记录', handleRecordsHtml(event))
      + '</div><footer class="ac-drawer-footer"><button class="btn btn-default" type="button" onclick="acCloseDrawer()">关闭</button>'
      + (canHandle ? '<button class="btn btn-primary" type="button" onclick="acHandle(\'' + esc(event.id) + '\')">处理</button>' : '') + '</footer>';
    mountDrawer(html, 'detail');
    drawerEventId = id;
  }
  function renderHandleDrawer(id) {
    var event = store() && store().getEvent(id);
    if (!event) return;
    var type = typeByCode(event.ruleCode || event.alertType);
    var config = ALERT_TYPE_CONFIG[type.code] || type;
    var metric = summaryMetric(type, event);
    var reasons = type.falseAlarmReasons || [];
    var context = config.handleContext ? config.handleContext(event) : ((event.plate || '—') + ' · ' + (event.driverName || '—') + ' · ' + (event.taskId || '无任务单'));
    var html = '<header class="ac-drawer-header"><div><small>' + esc(event.id) + '</small><h2>处理告警</h2></div><button type="button" onclick="acCloseDrawer()" aria-label="关闭">×</button></header>'
      + '<div class="ac-drawer-body"><div class="ac-handle-context"><strong>' + esc(type.name) + '</strong><span>' + esc(context) + '</span><p>' + esc(metric.label + ' ' + metric.value) + '</p></div>'
      + '<section class="detail-section"><div class="detail-section-title">处理信息</div><div class="form-grid">'
      + '<div class="form-item"><label class="form-label">处理方式 <span class="req">*</span></label><select class="form-control-text" id="acHandlingType" onchange="acHandleTypeChange()"><option value="">请选择</option>' + (type.handleOptions || []).map(function (item) { return option(item, item, ''); }).join('') + '</select></div>'
      + (type.parkingReasons ? '<div class="form-item"><label class="form-label">停车原因 <span class="req">*</span></label><select class="form-control-text" id="acParkingReason"><option value="">请选择</option>' + type.parkingReasons.map(function (item) { return option(item, item, ''); }).join('') + '</select></div>' : '')
      + '<div class="form-item" id="acFalseAlarmBox" hidden><label class="form-label" id="acReasonLabel">误报原因 <span class="req">*</span></label><select class="form-control-text" id="acFalseAlarmReason"><option value="">请选择</option>' + reasons.map(function (item) { return option(item, item, ''); }).join('') + '</select></div>'
      + '<div class="form-item"><label class="form-label">处理说明 <span class="req">*</span></label><textarea class="form-control-text ac-result" id="acHandlingResult" maxlength="300" placeholder="请输入现场情况、已采取措施及后续安排"></textarea></div>'
      + '<div class="ac-handler-meta"><span>处理人：' + esc(store().operator) + '</span><span>提交时记录处理时间</span></div></div></section>'
      + ((event.handleRecords || []).length ? sectionHtml('处理记录', handleRecordsHtml(event)) : '')
      + '<div class="alert alert-info">' + esc(type.handleHint) + '</div></div>'
      + '<footer class="ac-drawer-footer"><button class="btn btn-default" type="button" onclick="acCloseDrawer()">取消</button><button class="btn btn-default" type="button" onclick="acSubmitHandle(false)">提交处理</button><button class="btn btn-primary" type="button" onclick="acSubmitHandle(true)">标记已处理</button></footer>';
    mountDrawer(html, 'handle');
    drawerEventId = id;
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
  function closeDrawer() {
    var host = document.getElementById('acDrawerHost');
    if (host) host.remove();
    drawerEventId = '';
    drawerMode = '';
  }
  function readFilters() {
    var filters = currentState().listFilters;
    ['Project', 'Level', 'HandleStatus', 'Keyword', 'Extra', 'Start', 'End', 'FenceType'].forEach(function (suffix) {
      var el = document.getElementById('ac' + suffix);
      if (!el) return;
      filters[suffix.charAt(0).toLowerCase() + suffix.slice(1)] = String(el.value || '').trim();
    });
  }
  function rerender() {
    var main = document.querySelector('.main');
    savedMainScroll = main ? main.scrollTop : 0;
    if (window.app) window.app.render();
  }
  function openRuleModal(mode, rule) {
    closeRuleModal(true);
    var type = typeByCode(rule.code);
    var state = pageOf(type.page);
    state.ruleModal = { mode: mode, rule: JSON.parse(JSON.stringify(rule)), baseline: '' };
    var host = document.createElement('div');
    host.id = 'acRuleModalHost';
    host.className = 'modal-overlay show ac-parking-modal-host';
    host.innerHTML = modalShell((mode === 'create' ? '新增' : '编辑') + type.name + '规则', rule.name, modalBody(rule));
    host.addEventListener('click', function (event) { if (event.target === host) window.acCloseRuleModal(); });
    document.body.appendChild(host);
    state.ruleModal.baseline = formFingerprint(rule);
    if (rule.code === 'TRANSPORT_PARKING' && window.acParkingCount) window.acParkingCount();
    if (isAreaCode(rule.code) && window.acAreaStayFenceMode) window.acAreaStayFenceMode();
  }
  function closeRuleModal(force) {
    var host = document.getElementById('acRuleModalHost');
    var state = currentState();
    if (!host) { state.ruleModal = null; return true; }
    if (!force && state.ruleModal && formFingerprint(state.ruleModal.rule) !== state.ruleModal.baseline) {
      if (!window.confirm('当前修改尚未保存，确定关闭？')) return false;
    }
    host.remove();
    state.ruleModal = null;
    return true;
  }
  function saveRule() {
    var modal = currentState().ruleModal;
    if (!modal || !modal.rule) return;
    var patch = readPatch(modal.rule);
    if (patch.error) { toast(patch.error); return; }
    var saved = modal.mode === 'create' ? createRule(modal.rule, patch) : store().updateRule(modal.rule.id, patch);
    if (saved && saved.error) { toast(saved.error); return; }
    closeRuleModal(true);
    rerender();
    toast(saved && saved.warning ? saved.warning : '保存成功');
  }
  function toggleRule(id) {
    var item = store().getRule(id);
    if (!item) return;
    if (item.enabled && !window.confirm('停用后不再根据该规则产生新告警，已产生的告警继续使用原规则快照。')) return;
    var patch = {
      enabled: !item.enabled, levels: item.levels, recoveryConfig: item.recoveryConfig, scopeType: item.scopeType,
      projectIds: item.projectIds, projectNames: item.projectNames, vehiclePlates: item.vehiclePlates,
      departmentIds: item.departmentIds, departmentNames: item.departmentNames,
      areaType: item.areaType, fenceIds: item.fenceIds, fenceNames: item.fenceNames,
      speedSourcePolicy: item.speedSourcePolicy, detectConfig: item.detectConfig, confirmConfig: item.confirmConfig
    };
    var saved = store().updateRule(item.id, patch);
    if (saved && saved.error) { toast(saved.error); return; }
    rerender();
    toast(item.enabled ? '规则已停用' : '规则已启用');
  }
  function exportCsv() {
    var type = currentType();
    var rows = filterEvents(typeEvents(events(), type.code), currentState().listFilters, type);
    function csv(value) { return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"'; }
    function plain(event, key, index) {
      return String(cellValue(type, event, key, index)).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    }
    var columns = type.columns.filter(function (column) { return column.key !== 'actions'; });
    var content = [columns.map(function (column) { return csv(column.label); }).join(',')].concat(rows.map(function (event, index) {
      return columns.map(function (column) { return csv(plain(event, column.key, index)); }).join(',');
    })).join('\n');
    var link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' }));
    link.download = type.name + '_' + todayStamp() + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    toast('已导出当前筛选结果');
  }
  function bindPage(page) {
    window.app.register(page, function () { return renderAlertPage(typeByPage(page) || currentType()); }, [page]);
    window.app.pages[page].onRender = function () {
      var main = document.querySelector('.main');
      if (main && savedMainScroll) main.scrollTop = savedMainScroll;
      var group = document.querySelector('.nav-group[data-group="alert-center"]');
      if (group) group.classList.add('open');
      acBindDeptTree();
      if (drawerMode === 'detail' && drawerEventId && document.getElementById('acDrawerHost')) {
        var drawerBody = document.querySelector('#acDrawerHost .ac-drawer-body');
        var drawerScroll = drawerBody ? drawerBody.scrollTop : 0;
        renderDetailDrawer(drawerEventId);
        var nextBody = document.querySelector('#acDrawerHost .ac-drawer-body');
        if (nextBody) nextBody.scrollTop = drawerScroll;
      }
    };
  }
  function deptFilterWrap() { return document.querySelector('.ac-org-filter'); }
  function acBindDeptTree() {
    if (window.__acDeptTreeBound) return;
    window.__acDeptTreeBound = true;
    document.addEventListener('click', function (event) {
      var open = document.querySelector('.ac-org-filter.is-open');
      if (!open || open.contains(event.target)) return;
      window.acCloseDeptTree();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (document.getElementById('acRuleModalHost')) { window.acCloseRuleModal(); return; }
      window.acCloseDeptTree();
    });
  }
  function cloneSafe(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

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
    wrap.classList.add('is-open');
    var panel = wrap.querySelector('[data-org-panel]');
    var trigger = wrap.querySelector('[data-org-trigger]');
    var search = wrap.querySelector('[data-org-search]');
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
    if (label) { label.textContent = name || '全部部门'; label.classList.toggle('is-placeholder', !name); }
    window.acCloseDeptTree();
    window.acApply();
  };
  window.acTab = function (tab) {
    if (!closeRuleModal()) return;
    currentState().tab = tab === 'rules' ? 'rules' : 'list';
    closeDrawer();
    rerender();
  };
  window.acApply = function () {
    var state = currentState();
    readFilters();
    state.activeMetric = '';
    state.listFilters.metric = '';
    rerender();
  };
  window.acReset = function () {
    var state = currentState();
    state.listFilters = blankFilters();
    state.activeMetric = '';
    rerender();
  };
  window.acStatus = function (status) {
    var state = currentState();
    state.listFilters.eventStatus = status;
    state.listFilters.metric = '';
    state.activeMetric = '';
    rerender();
  };
  window.acMetric = function (key) {
    var state = currentState();
    var type = currentType();
    if (state.activeMetric === key) {
      state.activeMetric = '';
      state.listFilters = blankFilters();
      rerender();
      return;
    }
    var metric = metricByKey(type, key);
    var filters = blankFilters();
    filters.eventStatus = '';
    filters.metric = key;
    if (metric && metric.status) filters.eventStatus = metric.status;
    if (metric && metric.handle) filters.handleStatus = metric.handle;
    state.listFilters = filters;
    state.activeMetric = key;
    rerender();
  };
  window.acRefresh = function () {
    store().refresh();
    rerender();
    var now = new Date();
    toast('告警数据已刷新 ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0'));
  };
  window.acView = renderDetailDrawer;
  window.acCloseDrawer = closeDrawer;
  window.acHandle = renderHandleDrawer;
  window.acHandleTypeChange = function () {
    var box = document.getElementById('acFalseAlarmBox');
    var label = document.getElementById('acReasonLabel');
    var select = document.getElementById('acFalseAlarmReason');
    var chosen = ((document.getElementById('acHandlingType') || {}).value || '').trim();
    var type = currentType();
    var noBill = chosen === '确认无需磅单';
    var needs = chosen === '误报' || chosen === '确认误报' || noBill;
    if (box) box.hidden = !needs;
    if (label) label.innerHTML = (noBill ? '无需磅单原因' : '误报原因') + ' <span class="req">*</span>';
    if (select) {
      var reasons = noBill ? (type.noBillReasons || []) : (type.falseAlarmReasons || []);
      select.innerHTML = '<option value="">请选择</option>' + reasons.map(function (item) { return option(item, item, ''); }).join('');
    }
  };
  window.acSubmitHandle = function (markDone) {
    var chosen = ((document.getElementById('acHandlingType') || {}).value || '').trim();
    var result = ((document.getElementById('acHandlingResult') || {}).value || '').trim();
    var parkingReason = ((document.getElementById('acParkingReason') || {}).value || '').trim();
    var falseReason = ((document.getElementById('acFalseAlarmReason') || {}).value || '').trim();
    var closing = chosen === '误报' || chosen === '确认误报' || chosen === '无需处理' || chosen === '确认无需磅单';
    if (!chosen) { toast('请选择处理方式'); return; }
    if (document.getElementById('acParkingReason') && !parkingReason) { toast('请选择停车原因'); return; }
    if ((chosen === '误报' || chosen === '确认误报' || chosen === '确认无需磅单') && !falseReason) { toast(chosen === '确认无需磅单' ? '请选择无需磅单原因' : '请选择误报原因'); return; }
    if (!result) { toast('请填写处理说明'); return; }
    var extra = { markDone: markDone === true || closing };
    if (parkingReason) extra.parkingReason = parkingReason;
    if (falseReason) extra.falseAlarmReason = falseReason;
    var saved = store().handle(drawerEventId, chosen, result, extra);
    if (saved && saved.error) { toast(saved.error); return; }
    closeDrawer();
    rerender();
    if (chosen === '确认无需磅单') toast('已确认无需磅单，告警已恢复');
    else if (extra.markDone) toast('已标记已处理');
    else toast('已提交处理');
  };
  window.acOpenTask = function (id) {
    closeDrawer();
    if (window.app && window.app.pages && window.app.pages['task-order-management']) window.app.navigate('task-order-management');
    else toast('任务单 ' + id);
  };
  window.acExport = exportCsv;
  window.acSaveRule = saveRule;
  window.acToggleRule = toggleRule;
  window.acAddRule = function () { openRuleModal('create', draftOf(currentType())); };
  window.acEditRule = function (id) {
    var rule = store().getRule(id);
    if (!rule) { toast('未找到规则'); return; }
    openRuleModal('edit', rule);
  };
  window.acCloseRuleModal = function () { closeRuleModal(false); };
  window.acRemoveRule = function (id) {
    var rule = store().getRule(id);
    if (!rule) return;
    if (!window.confirm('删除后该规则不再用于新的' + typeByCode(rule.code).name + '，已产生告警不受影响。确定删除？')) return;
    var result = store().removeRule(id);
    if (result && result.error) { toast(result.error); return; }
    rerender();
    toast('规则已删除');
  };
  window.acRuleApply = function () {
    var filters = currentState().ruleFilters;
    filters.name = ((document.getElementById('acRuleName') || {}).value || '').trim();
    filters.scopeType = (document.getElementById('acRuleScope') || {}).value || '';
    filters.status = (document.getElementById('acRuleStatus') || {}).value || '';
    rerender();
  };
  window.acRuleReset = function () { currentState().ruleFilters = blankRuleFilters(); rerender(); };
  window.acMonitorPeriodChange = function () {
    var row = document.getElementById('wrMonitorRange');
    var period = document.getElementById('wrMonitorPeriod');
    if (row && period) row.hidden = period.value !== '自定义';
  };
  window.acScopeChange = function () {
    var scope = document.getElementById('wrScope');
    var orgBox = document.getElementById('wrOrgBox');
    var vehicleBox = document.getElementById('wrVehicleBox');
    var speedProjects = document.getElementById('wrSpeedProjects');
    var lateProjects = document.getElementById('wrLateProjects');
    if (orgBox || vehicleBox) {
      var mode = ((document.querySelector(HOST + ' input[name="wrScopeMode"]:checked') || {}).value) || '组织部门';
      if (orgBox) orgBox.hidden = mode !== '组织部门';
      if (vehicleBox) vehicleBox.hidden = mode !== '自定义车辆';
    }
    if (speedProjects && scope) speedProjects.hidden = scope.value !== '指定项目';
    if (lateProjects && scope) lateProjects.hidden = scope.value !== '指定项目';
    if (window.acParkingCount) window.acParkingCount();
  };
  window.acFilterOrg = function () {
    var q = ((document.getElementById('wrOrgQuery') || {}).value || '').trim().toLowerCase();
    Array.prototype.forEach.call(document.querySelectorAll(HOST + ' .ac-org-group'), function (group) {
      var orgHit = !q || String(group.getAttribute('data-org-name') || '').toLowerCase().indexOf(q) >= 0;
      var any = false;
      Array.prototype.forEach.call(group.querySelectorAll('.ac-org-dept'), function (row) {
        var show = orgHit || String(row.getAttribute('data-dept-name') || '').toLowerCase().indexOf(q) >= 0;
        row.hidden = !show;
        if (show) any = true;
      });
      group.hidden = !any;
    });
  };
  window.acFilterVehicles = function () {
    var q = ((document.getElementById('wrVehicleQuery') || {}).value || '').trim().toLowerCase();
    Array.prototype.forEach.call(document.querySelectorAll(HOST + ' .ac-vehicle-option'), function (row) {
      row.hidden = !!(q && String(row.getAttribute('data-plate') || '').toLowerCase().indexOf(q) < 0);
    });
  };
  window.acOrgToggle = function (input) {
    var orgId = input.getAttribute('data-org-toggle');
    Array.prototype.forEach.call(document.querySelectorAll(HOST + ' input[name="wrDeptIds"]'), function (box) {
      var label = box.closest('.ac-org-dept');
      if (label && label.getAttribute('data-org-id') === orgId) box.checked = input.checked;
    });
    window.acParkingCount();
  };
  window.acVehicleSelectAll = function (checked) {
    Array.prototype.forEach.call(document.querySelectorAll(HOST + ' input[name="wrVehiclePlates"]'), function (box) { box.checked = !!checked; });
    window.acParkingCount();
  };
  window.acParkingCount = function () {
    var orgCount = document.getElementById('wrOrgCount');
    var vehicleCount = document.getElementById('wrVehicleCount');
    if (orgCount) orgCount.textContent = '已选择 ' + checkedValues('wrDeptIds').length + ' 个部门';
    if (vehicleCount) vehicleCount.textContent = '已选择 ' + checkedValues('wrVehiclePlates').length + ' 辆';
    Array.prototype.forEach.call(document.querySelectorAll(HOST + ' [data-org-toggle]'), function (toggle) {
      var orgId = toggle.getAttribute('data-org-toggle');
      var boxes = Array.prototype.filter.call(document.querySelectorAll(HOST + ' input[name="wrDeptIds"]'), function (box) {
        var label = box.closest('.ac-org-dept');
        return label && label.getAttribute('data-org-id') === orgId;
      });
      var checkedCount = boxes.filter(function (box) { return box.checked; }).length;
      toggle.checked = boxes.length > 0 && checkedCount === boxes.length;
      toggle.indeterminate = checkedCount > 0 && checkedCount < boxes.length;
    });
  };
  window.acAreaStayScopeChange = function () {
    var box = document.getElementById('wrAreaProjectBox');
    var scope = document.getElementById('wrScope');
    if (box && scope) box.hidden = scope.value !== '指定项目';
    window.acAreaStayFenceFilter();
  };
  window.acAreaStayFenceMode = function () {
    var box = document.getElementById('wrAreaFenceBox');
    var checked = document.querySelector(HOST + ' input[name="wrFenceMode"]:checked');
    if (box) box.hidden = !(checked && checked.value === '指定围栏');
    window.acAreaStayFenceFilter();
  };
  window.acAreaStayFenceFilter = function () {
    var list = document.getElementById('wrAreaFenceList');
    if (!list) return;
    var modal = currentState().ruleModal;
    if (!modal || !modal.rule) return;
    var draft = cloneSafe(modal.rule);
    draft.scopeType = (document.getElementById('wrScope') || {}).value || draft.scopeType;
    draft.areaType = (document.getElementById('wrAreaType') || {}).value || draft.areaType;
    draft.projectIds = checkedValues('wrAreaProjects');
    var selected = checkedValues('wrAreaFences');
    var fences = areaFenceOptions(draft);
    list.innerHTML = fences.length ? fences.map(function (fence) {
      return '<label class="ac-vehicle-option ac-check" data-fence="' + esc(fence.name) + '"><input type="checkbox" name="wrAreaFences" value="' + esc(fence.id) + '" data-name="' + esc(fence.name) + '"' + (selected.indexOf(fence.id) >= 0 ? ' checked' : '') + '>' + esc(fence.name) + '<small>' + esc(fence.type + ' · ' + fence.projectName) + '</small></label>';
    }).join('') : '<div class="ac-org-empty">当前项目和区域类型下没有可选围栏</div>';
    var count = document.getElementById('wrFenceCount');
    if (count) count.textContent = '已选择 ' + checkedValues('wrAreaFences').length + ' 个围栏';
  };
  window.acFilterAreaFences = function () {
    var q = ((document.getElementById('wrFenceQuery') || {}).value || '').trim().toLowerCase();
    Array.prototype.forEach.call(document.querySelectorAll(HOST + ' .ac-vehicle-option'), function (row) {
      row.hidden = !!(q && String(row.getAttribute('data-fence') || '').toLowerCase().indexOf(q) < 0);
    });
  };
  window.acAddParkingRule = window.acAddRule;
  window.acAddAreaStayRule = window.acAddRule;
  window.acAddSpeedRule = window.acAddRule;
  window.acEditParkingRule = window.acEditRule;
  window.acEditAreaStayRule = window.acEditRule;
  window.acEditSpeedRule = window.acEditRule;
  window.acCloseParkingModal = window.acCloseRuleModal;
  window.acCloseAreaStayModal = window.acCloseRuleModal;
  window.acCloseSpeedModal = window.acCloseRuleModal;
  window.acSaveParkingRule = window.acSaveRule;
  window.acSaveSpeedRule = window.acSaveRule;
  window.acRemoveParkingRule = window.acRemoveRule;
  window.acRemoveAreaStayRule = window.acRemoveRule;
  window.acRemoveSpeedRule = window.acRemoveRule;
  window.acAreaRuleApply = window.acRuleApply;
  window.acSpeedRuleApply = window.acRuleApply;
  window.acAreaRuleReset = window.acRuleReset;
  window.acSpeedRuleReset = window.acRuleReset;
  window.addEventListener('hashchange', function () { closeRuleModal(true); closeDrawer(); });

  if (!window.app) return;
  TYPES.forEach(function (type) { bindPage(type.page); });
  window.app.register('alert-center', function () { return renderAlertPage(typeByPage('alert-parking')); }, ['alert-parking']);
  window.app.register('alert-records', function () { return renderAlertPage(typeByPage('alert-parking')); }, ['alert-parking']);
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
