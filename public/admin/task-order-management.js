/* 任务单管理：父菜单「任务单中心」，列序对齐线下任务单列表横向滚动截图。 */
(function () {
  var PAGE_SIZE = 20;
  var DEPT = '云南钦圣新能源科技有限公司';
  var page = 1;
  var selected = {};
  var statusTab = 'all';
  var filters = emptyFilters();

  var COLUMNS = [
    '状态', '委派状态', '任务单号', '辅助状态', '卸货点确认状态', '创建时间', '任务单名称', '车辆', '主司机',
    '主司机电话', '分段线路', '关联运单', '要求调度时间', '委派要求', '派车时间', '派车要求',
    '要求发车时间', '承运公司', '任务单所属部门', '附加要求', '货物类型', '实际完成时间', '运输方式',
    '设备', '预约车型', '实际车型', '送货员', '设备名称', '预计运输里程(km)', '任务单客户', '电子路书',
    '运单客户', '货物', '预计行驶时长(h)', '实际行驶里程(km)', '实际行驶时长(h)', '实际发车时间', '副司机1', '副司机1电话',
    '副司机2', '副司机2电话', '调度备注', '要求发运时间', '调度总数量', '调度总重量', '调度总体积', '签收总数量',
    '签收总重量', '签收总体积', '委派时间', '创建方式', '起点区域', '终点区域', '远程区域',
    '交接详情', '挂车号', '交接类型', '货物名称', '流向', '提货清单状态', '卸货磅单号',
    '卸货磅单状态', '磅单审核状态', '是否超时', '任务单类型', '装到达时间', '装离开时间', '卸到达时间', '卸离开时间'
  ];

  var TAB_PLAN = [
    { id: 'dispatch', label: '待派车', status: '待调度', count: 32 },
    { id: 'execute', label: '待执行', status: '待执行', count: 31 },
    { id: 'wait', label: '待运输', status: '待运输', count: 10 },
    { id: 'running', label: '运输中', status: '运输中', count: 30 },
    { id: 'done', label: '已完成', status: '已完成', count: 102 }
  ];
  var AREA_UNLOAD_END = '景洪水泥卸货网点';
  var AREA_ROUTE_UNIT_PRICE = '42.00';
  var AREA_UNLOAD_POINTS = [
    { id: 'F-0000069', name: '景洪水泥卸货点', matched: true, price: '45.00' },
    { id: 'F-0000070', name: '景洪城北搅拌站 3 号卸料位', matched: true, price: '45.00' },
    { id: 'F-0000071', name: '景洪东风镇项目料场', matched: true, price: '52.00' },
    { id: 'F-0000072', name: '景洪旧卸料场', matched: false, price: '' }
  ];
  var AUX_STATUSES = ['正常', '异常', '已作废'];
  var POINT_CONFIRM_PENDING = '待确认卸货点';
  var POINT_CONFIRM_DONE = '已确认';
  var POINT_CONFIRM_SKIP = '无需确认';
  var POINT_CONFIRM_STATUSES = [POINT_CONFIRM_PENDING, POINT_CONFIRM_DONE, POINT_CONFIRM_SKIP];
  var TICKET_LOAD = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480"><rect width="360" height="480" fill="#f4f1ea"/><rect x="18" y="16" width="324" height="448" fill="#fffdf8" stroke="#d7d1c4"/><text x="180" y="48" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="20" font-weight="700" fill="#1f2937">电子过磅单</text><text x="180" y="72" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="12" fill="#6b7280">装货 · 尖峰水泥场</text><line x1="36" y1="86" x2="324" y2="86" stroke="#e5e0d6"/><g font-family="PingFang SC,sans-serif" font-size="13" fill="#374151"><text x="40" y="114">磅单号</text><text x="140" y="114" font-weight="600">WB-L-20260912</text><text x="40" y="142">车牌号</text><text x="140" y="142" font-weight="600">云A·D8021</text><text x="40" y="170">毛重</text><text x="140" y="170" font-weight="600">50.65 吨</text><text x="40" y="198">皮重</text><text x="140" y="198" font-weight="600">16.85 吨</text><text x="40" y="226">净重</text><text x="140" y="226" font-weight="700" fill="#0f766e">33.80 吨</text><text x="40" y="254">过磅时间</text><text x="140" y="254">2026-09-02 17:08:22</text><text x="40" y="282">司磅员</text><text x="140" y="282">李磅</text></g><rect x="40" y="308" width="280" height="64" fill="#f8fafc" stroke="#e5e7eb"/><text x="180" y="336" text-anchor="middle" font-family="ui-monospace,monospace" font-size="11" fill="#64748b">||||||||||||||||||||</text><text x="180" y="356" text-anchor="middle" font-family="ui-monospace,monospace" font-size="11" fill="#64748b">WB L 20260912 3380</text></svg>');
  var TICKET_UNLOAD = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480"><rect width="360" height="480" fill="#eef4f8"/><rect x="18" y="16" width="324" height="448" fill="#fbfdff" stroke="#c9d6e0"/><text x="180" y="48" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="20" font-weight="700" fill="#1f2937">电子过磅单</text><text x="180" y="72" text-anchor="middle" font-family="PingFang SC,sans-serif" font-size="12" fill="#6b7280">卸货 · 景洪水泥卸货网点</text><line x1="36" y1="86" x2="324" y2="86" stroke="#d7e2ea"/><g font-family="PingFang SC,sans-serif" font-size="13" fill="#374151"><text x="40" y="114">磅单号</text><text x="140" y="114" font-weight="600">WB-U-20260912</text><text x="40" y="142">车牌号</text><text x="140" y="142" font-weight="600">云A·D8021</text><text x="40" y="170">毛重</text><text x="140" y="170" font-weight="600">50.52 吨</text><text x="40" y="198">皮重</text><text x="140" y="198" font-weight="600">16.82 吨</text><text x="40" y="226">净重</text><text x="140" y="226" font-weight="700" fill="#0f766e">33.70 吨</text><text x="40" y="254">过磅时间</text><text x="140" y="254">2026-09-02 20:48:16</text><text x="40" y="282">司磅员</text><text x="140" y="282">王磅</text></g><rect x="40" y="308" width="280" height="64" fill="#f8fafc" stroke="#e5e7eb"/><text x="180" y="336" text-anchor="middle" font-family="ui-monospace,monospace" font-size="11" fill="#64748b">||||||||||||||||||||</text><text x="180" y="356" text-anchor="middle" font-family="ui-monospace,monospace" font-size="11" fill="#64748b">WB U 20260912 3370</text></svg>');

  function emptyFilters() {
    return {
      code: '', type: '', status: '', auxStatus: '', unloadConfirmStatus: '', name: '',
      plate: '', driver: '', area: '', waybillNo: '', orderNo: '',
      transport: '', carrier: '', dept: '', extra: '', customer: '', cargoType: '',
      equipment: '', roadbook: '', courier: '', assignStatus: '', weighAudit: '',
      flow: '', overtime: ''
    };
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function toast(message, type) {
    if (typeof showAppToast === 'function') showAppToast(message, type);
    else window.alert(message);
  }
  function pad(n, width) {
    var s = String(n);
    while (s.length < width) s = '0' + s;
    return s;
  }

  function seedTasks() {
    var routes = [
      { start: '大开门水渣装货地', end: '尖峰水泥厂（卸货地）', cargo: '水泥+1', cargoName: '水泥+1', flow: '下行', customer: '贺旺有限公司' },
      { start: '尖峰水泥场（装货地）', end: '景洪水泥卸货网点', cargo: '水泥', cargoName: '水泥', flow: '上行', customer: '贺旺有限公司' },
      { start: '大勐龙铁精粉装货地', end: '杨武铁精粉下货点', cargo: '铁精粉', cargoName: '铁精粉', flow: '上行', customer: '吉祥物流' },
      { start: '普洱市宁洱天恒水泥厂', end: '景洪水泥卸货点', cargo: '水泥', cargoName: '水泥', flow: '下行', customer: '玉溪绿多民族物流有限公司' }
    ];
    var plates = ['云A·D8021', '云A·E1936', '云A·F4470', '云A·G2288', '云A·H6612'];
    var drivers = ['李宏俊', '王磊', '马旺', '张建华', '陈志远'];
    var phones = ['13808710021', '13987120336', '13708814670', '13608715518', '13577820944'];
    var trailers = ['云A·挂8021', '云A·挂1936', '云A·挂4470', '云A·挂2288', '云A·挂6612'];
    var rows = [];
    var seq = 0;
    var areaPointSeq = 0;
    TAB_PLAN.forEach(function (plan) {
      var i;
      for (i = 0; i < plan.count; i++) {
        seq += 1;
        var route = routes[seq % routes.length];
        var d = seq % drivers.length;
        var dispatched = plan.id !== 'dispatch';
        var running = plan.id === 'running' || plan.id === 'done';
        var done = plan.id === 'done';
        var type = seq % 5 === 0 ? '装货空驶单' : '直达任务单';
        var qty = type === '装货空驶单' ? 0 : 34;
        var createTime = '2026-09-02 14:44:' + pad(seq % 60, 2);
        var isAreaRoute = route.end === AREA_UNLOAD_END;
        var needPointConfirm = done && type === '直达任务单' && isAreaRoute;
        var pointMeta = AREA_UNLOAD_POINTS[needPointConfirm ? (areaPointSeq++ % AREA_UNLOAD_POINTS.length) : (seq % AREA_UNLOAD_POINTS.length)];
        var pointConfirmed = needPointConfirm && seq % 3 === 0;
        var overtime = done && seq % 11 === 0 ? '是' : '否';
        var auxStatus = overtime === '是' || (running && seq % 13 === 0)
          ? '异常'
          : (plan.id === 'dispatch' && seq % 31 === 0 ? '已作废' : '正常');
        var unloadConfirmStatus = needPointConfirm
          ? (pointConfirmed ? POINT_CONFIRM_DONE : POINT_CONFIRM_PENDING)
          : POINT_CONFIRM_SKIP;
        rows.push({
          id: 'TO-' + pad(seq, 3),
          status: plan.status,
          assignStatus: dispatched ? '已委派' : '未委派',
          code: 'Y2026090203' + pad(seq, 6),
          auxStatus: auxStatus,
          unloadConfirmStatus: unloadConfirmStatus,
          createTime: createTime,
          name: '',
          plate: dispatched ? plates[d] : '',
          driver: dispatched ? drivers[d] : '',
          driverPhone: dispatched ? phones[d] : '',
          route: route.start + ' → ' + route.end,
          waybillNo: 'Y2026090203' + pad(Math.ceil(seq / 2), 4),
          requireDispatchTime: dispatched ? '2026-09-02 15:00:00' : '',
          assignReq: '',
          dispatchTime: dispatched ? '2026-09-02 15:12:08' : '',
          dispatchReq: '',
          requireDepartTime: dispatched ? '2026-09-02 16:00:00' : '',
          carrier: dispatched ? '云南钦圣新能源科技有限公司' : '',
          dept: DEPT,
          extra: '',
          cargoType: route.cargoName.indexOf('铁精粉') >= 0 ? '铁精粉' : '水泥',
          actualFinishTime: done ? '2026-09-02 21:18:40' : '',
          transport: '公路运输',
          equipment: running ? '0' : '',
          bookModel: '',
          actualModel: dispatched ? '牵引车' : '',
          courier: '',
          equipmentName: '',
          estMileage: running || done ? String(86 + (seq % 40)) : '0',
          taskCustomer: route.customer,
          roadbook: '',
          waybillCustomer: route.customer,
          cargo: route.cargo,
          estHours: running || done ? '3.5' : '',
          actualMileage: done ? String(82 + (seq % 12)) : (running ? String(40 + (seq % 20)) : ''),
          actualHours: done ? '3.2' : '',
          actualDepartTime: running || done ? '2026-09-02 16:08:12' : '',
          copilot1: dispatched && seq % 3 === 0 ? '刘副驾' : '',
          copilot1Phone: dispatched && seq % 3 === 0 ? '13688881234' : '',
          copilot2: '',
          copilot2Phone: '',
          dispatchRemark: '',
          requireShipTime: dispatched ? '2026-09-02 16:00:00' : '',
          dispatchQty: qty,
          dispatchWeight: qty ? '34' : '0',
          dispatchVolume: '0',
          signQty: done ? qty : '0',
          signWeight: done ? (qty ? '34' : '0') : '0',
          signVolume: '0',
          assignTime: dispatched ? '2026-09-02 15:10:02' : '',
          createMode: '加入任务单',
          startArea: route.start,
          endArea: route.end,
          remoteArea: '',
          handoverDetail: running || done ? '查看' : '',
          trailerNo: dispatched ? trailers[d] : '',
          handoverType: running || done ? '充电' : '',
          cargoName: route.cargoName,
          flow: route.flow,
          pickupStatus: done ? '已打印' : '',
          unloadWeighNo: done && type === '直达任务单' ? 'WB-U-' + pad(seq, 4) : '',
          unloadWeighStatus: done && type === '直达任务单' ? '已过磅' : '',
          weighAudit: done ? (needPointConfirm && !pointConfirmed ? '待审核' : '已审核') : (running ? '待审核' : ''),
          loadWeighNo: (running || done) && type === '直达任务单' ? 'WB-L-' + pad(seq, 4) : '',
          loadGross: (running || done) ? (50.65 + (seq % 7) * 0.02).toFixed(2) : '',
          loadTare: (running || done) ? (16.85 + (seq % 5) * 0.01).toFixed(2) : '',
          loadNet: (running || done) ? (33.80 + (seq % 7) * 0.02 - (seq % 5) * 0.01).toFixed(2) : '',
          unloadGross: done && type === '直达任务单' ? (50.52 + (seq % 6) * 0.02).toFixed(2) : '',
          unloadTare: done && type === '直达任务单' ? (16.82 + (seq % 4) * 0.01).toFixed(2) : '',
          unloadNet: done && type === '直达任务单' ? (33.70 + (seq % 6) * 0.02 - (seq % 4) * 0.01).toFixed(2) : '',
          loadPhotos: (running || done) ? [TICKET_LOAD] : [],
          unloadPhotos: done && type === '直达任务单' && !(needPointConfirm && !pointConfirmed) ? [TICKET_UNLOAD] : [],
          overtime: overtime,
          type: type,
          loadArrive: running || done ? '2026-09-02 16:40:00' : '',
          loadLeave: running || done ? '2026-09-02 17:20:00' : '',
          unloadArrive: done ? '2026-09-02 20:10:00' : '',
          unloadLeave: done ? '2026-09-02 20:55:00' : '',
          areaTask: isAreaRoute && type === '直达任务单',
          unloadPoint: needPointConfirm ? pointMeta.name : '',
          unloadPointId: needPointConfirm ? pointMeta.id : '',
          matchStatus: needPointConfirm ? (pointMeta.matched ? '已匹配' : '未匹配') : '',
          dispatchPointConfirmed: pointConfirmed,
          feeItem: type === '直达任务单' ? '预计运费' : '',
          areaUnitPrice: isAreaRoute ? AREA_ROUTE_UNIT_PRICE : '',
          pointUnitPrice: needPointConfirm && pointMeta.matched ? pointMeta.price : '',
          unitPrice: type === '直达任务单' ? (isAreaRoute ? ((needPointConfirm && pointMeta.matched && pointMeta.price) || AREA_ROUTE_UNIT_PRICE) : '38.00') : '',
          rounding: '否',
          taxRate: type === '直达任务单' ? '9%' : '',
          oncePriced: false
        });
      }
    });
    return rows;
  }

  var records = seedTasks();

  function unique(field) {
    var seen = {};
    var list = [];
    records.forEach(function (row) {
      var value = row[field];
      if (value && !seen[value]) { seen[value] = true; list.push(value); }
    });
    return list;
  }

  function statusCounts(list) {
    var counts = { all: list.length, dispatch: 0, execute: 0, wait: 0, running: 0, done: 0 };
    list.forEach(function (row) {
      if (row.status === '待调度') counts.dispatch += 1;
      else if (row.status === '待执行') counts.execute += 1;
      else if (row.status === '待运输') counts.wait += 1;
      else if (row.status === '运输中') counts.running += 1;
      else if (row.status === '已完成') counts.done += 1;
    });
    return counts;
  }

  function matchFilters(row) {
    if (filters.code && String(row.code).indexOf(filters.code) < 0) return false;
    if (filters.type && row.type !== filters.type) return false;
    if (filters.status && row.status !== filters.status) return false;
    if (filters.auxStatus && row.auxStatus !== filters.auxStatus) return false;
    if (filters.unloadConfirmStatus && row.unloadConfirmStatus !== filters.unloadConfirmStatus) return false;
    if (filters.name && String(row.name).indexOf(filters.name) < 0) return false;
    if (filters.plate && row.plate !== filters.plate) return false;
    if (filters.driver && row.driver !== filters.driver) return false;
    if (filters.area && row.endArea !== filters.area && row.startArea !== filters.area) return false;
    if (filters.waybillNo && String(row.waybillNo).indexOf(filters.waybillNo) < 0) return false;
    if (filters.orderNo && String(row.orderNo || '').indexOf(filters.orderNo) < 0) return false;
    if (filters.transport && row.transport !== filters.transport) return false;
    if (filters.carrier && String(row.carrier).indexOf(filters.carrier) < 0) return false;
    if (filters.dept && row.dept !== filters.dept) return false;
    if (filters.extra && String(row.extra).indexOf(filters.extra) < 0) return false;
    if (filters.customer && row.taskCustomer !== filters.customer) return false;
    if (filters.cargoType && row.cargoType !== filters.cargoType) return false;
    if (filters.equipment && String(row.equipment).indexOf(filters.equipment) < 0) return false;
    if (filters.roadbook && row.roadbook !== filters.roadbook) return false;
    if (filters.courier && row.courier !== filters.courier) return false;
    if (filters.assignStatus && row.assignStatus !== filters.assignStatus) return false;
    if (filters.weighAudit && row.weighAudit !== filters.weighAudit) return false;
    if (filters.flow && row.flow !== filters.flow) return false;
    if (filters.overtime && row.overtime !== filters.overtime) return false;
    return true;
  }

  function queriedRecords() { return records.filter(matchFilters); }

  function filteredRecords() {
    return queriedRecords().filter(function (row) {
      if (statusTab === 'dispatch') return row.status === '待调度';
      if (statusTab === 'execute') return row.status === '待执行';
      if (statusTab === 'wait') return row.status === '待运输';
      if (statusTab === 'running') return row.status === '运输中';
      if (statusTab === 'done') return row.status === '已完成';
      return true;
    });
  }

  function optionHtml(list, selectedValue) {
    var html = '<option value="">全部</option>';
    list.forEach(function (item) {
      html += '<option value="' + esc(item) + '"' + (selectedValue === item ? ' selected' : '') + '>' + esc(item) + '</option>';
    });
    return html;
  }
  function inputItem(id, label, value, placeholder) {
    return '<div class="filter-item"><label class="filter-label" for="' + id + '">' + label + '</label><input class="filter-control" id="' + id + '" value="' + esc(value) + '" placeholder="' + esc(placeholder || '请输入') + '"></div>';
  }
  function selectItem(id, label, optionsHtml) {
    return '<div class="filter-item"><label class="filter-label" for="' + id + '">' + label + '</label><select class="filter-control" id="' + id + '">' + optionsHtml + '</select></div>';
  }
  function dateRangeItem(label, start, end, empty) {
    return '<div class="filter-item order-filter-span-2"><label class="filter-label">' + label + '</label><div class="order-date-range' + (empty ? ' is-empty' : '') + '"><span>' + esc(start) + '</span><i>—</i><span>' + esc(end) + '</span></div></div>';
  }

  function statusBadge(kind, text) {
    if (!text) return '';
    return '<span class="badge badge-dot ' + kind + '">' + esc(text) + '</span>';
  }
  function mainBadge(text) {
    if (text === '待调度') return statusBadge('badge-purple', text);
    if (text === '待执行' || text === '待运输') return statusBadge('badge-warning', text);
    if (text === '运输中') return statusBadge('badge-primary', text);
    if (text === '已完成') return statusBadge('badge-success', text);
    return statusBadge('badge-gray', text);
  }
  function auxBadge(text) {
    if (text === '异常') return statusBadge('badge-error', text);
    if (text === '已作废') return statusBadge('badge-gray', text);
    if (text === '正常') return statusBadge('badge-success', text);
    return cell(text);
  }
  function unloadConfirmBadge(text) {
    if (text === POINT_CONFIRM_PENDING) return statusBadge('badge-warning', text);
    if (text === POINT_CONFIRM_DONE) return statusBadge('badge-success', text);
    if (text === POINT_CONFIRM_SKIP) return statusBadge('badge-gray', text);
    return cell(text);
  }
  function assignBadge(text) {
    if (text === '未委派') return statusBadge('badge-warning', text);
    if (text === '已委派') return statusBadge('badge-success', text);
    return statusBadge('badge-gray', text);
  }

  function cell(value) {
    return value === 0 || value ? esc(value) : '';
  }

  function moreIcon() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>';
  }

  function fieldValue(row, title) {
    var map = {
      '状态': mainBadge(row.status),
      '委派状态': assignBadge(row.assignStatus),
      '任务单号': '<a class="link" href="javascript:void(0)" onclick="toOpenTask(\'' + row.id + '\')">' + esc(row.code) + '</a>',
      '辅助状态': auxBadge(row.auxStatus),
      '卸货点确认状态': unloadConfirmBadge(row.unloadConfirmStatus),
      '创建时间': '<span class="col-time">' + cell(row.createTime) + '</span>',
      '任务单名称': cell(row.name),
      '车辆': cell(row.plate),
      '主司机': cell(row.driver),
      '主司机电话': cell(row.driverPhone),
      '分段线路': '<span class="tooltip" title="' + esc(row.route) + '">' + cell(row.route) + '</span>',
      '关联运单': '<a class="link" href="javascript:void(0)" onclick="toOpenWaybill(\'' + esc(row.waybillNo) + '\')">' + esc(row.waybillNo) + '</a>',
      '要求调度时间': '<span class="col-time">' + cell(row.requireDispatchTime) + '</span>',
      '委派要求': cell(row.assignReq),
      '派车时间': '<span class="col-time">' + cell(row.dispatchTime) + '</span>',
      '派车要求': cell(row.dispatchReq),
      '要求发车时间': '<span class="col-time">' + cell(row.requireDepartTime) + '</span>',
      '承运公司': '<span class="tooltip" title="' + esc(row.carrier) + '">' + cell(row.carrier) + '</span>',
      '任务单所属部门': '<span class="tooltip" title="' + esc(row.dept) + '">' + cell(row.dept) + '</span>',
      '附加要求': cell(row.extra),
      '货物类型': cell(row.cargoType),
      '实际完成时间': '<span class="col-time">' + cell(row.actualFinishTime) + '</span>',
      '运输方式': cell(row.transport),
      '设备': cell(row.equipment),
      '预约车型': cell(row.bookModel),
      '实际车型': cell(row.actualModel),
      '送货员': cell(row.courier),
      '设备名称': cell(row.equipmentName),
      '预计运输里程(km)': cell(row.estMileage),
      '任务单客户': cell(row.taskCustomer),
      '电子路书': cell(row.roadbook),
      '运单客户': cell(row.waybillCustomer),
      '货物': cell(row.cargo),
      '预计行驶时长(h)': cell(row.estHours),
      '实际行驶里程(km)': cell(row.actualMileage),
      '实际行驶时长(h)': cell(row.actualHours),
      '实际发车时间': '<span class="col-time">' + cell(row.actualDepartTime) + '</span>',
      '副司机1': cell(row.copilot1),
      '副司机1电话': cell(row.copilot1Phone),
      '副司机2': cell(row.copilot2),
      '副司机2电话': cell(row.copilot2Phone),
      '调度备注': cell(row.dispatchRemark),
      '要求发运时间': '<span class="col-time">' + cell(row.requireShipTime) + '</span>',
      '调度总数量': cell(row.dispatchQty),
      '调度总重量': cell(row.dispatchWeight),
      '调度总体积': cell(row.dispatchVolume),
      '签收总数量': cell(row.signQty),
      '签收总重量': cell(row.signWeight),
      '签收总体积': cell(row.signVolume),
      '委派时间': '<span class="col-time">' + cell(row.assignTime) + '</span>',
      '创建方式': cell(row.createMode),
      '起点区域': '<span class="tooltip" title="' + esc(row.startArea) + '">' + cell(row.startArea) + '</span>',
      '终点区域': '<span class="tooltip" title="' + esc(row.endArea) + '">' + cell(row.endArea) + '</span>',
      '远程区域': cell(row.remoteArea),
      '交接详情': row.handoverDetail ? '<a class="link" href="javascript:void(0)" onclick="toPlaceholder(\'交接详情\')">查看</a>' : '',
      '挂车号': cell(row.trailerNo),
      '交接类型': cell(row.handoverType),
      '货物名称': cell(row.cargoName),
      '流向': cell(row.flow),
      '提货清单状态': cell(row.pickupStatus),
      '卸货磅单号': cell(row.unloadWeighNo),
      '卸货磅单状态': cell(row.unloadWeighStatus),
      '磅单审核状态': cell(row.weighAudit),
      '是否超时': cell(row.overtime),
      '任务单类型': cell(row.type),
      '装到达时间': '<span class="col-time">' + cell(row.loadArrive) + '</span>',
      '装离开时间': '<span class="col-time">' + cell(row.loadLeave) + '</span>',
      '卸到达时间': '<span class="col-time">' + cell(row.unloadArrive) + '</span>',
      '卸离开时间': '<span class="col-time">' + cell(row.unloadLeave) + '</span>'
    };
    return map[title] || '';
  }

  function renderTabs(counts) {
    function tab(id, label, count) {
      return '<button type="button" class="tab' + (statusTab === id ? ' active' : '') + '" onclick="toSetStatusTab(\'' + id + '\')">' + label + ' <span class="count">' + count + '</span></button>';
    }
    return tab('all', '全部', counts.all)
      + tab('dispatch', '待派车', counts.dispatch)
      + tab('execute', '待执行', counts.execute)
      + tab('wait', '待运输', counts.wait)
      + tab('running', '运输中', counts.running)
      + tab('done', '已完成', counts.done);
  }

  function pageButtons(totalPages) {
    var html = '<button class="page-btn" type="button" ' + (page <= 1 ? 'disabled' : '') + ' onclick="toGoPage(' + (page - 1) + ')">&lsaquo;</button>';
    var i;
    var show = function (n) {
      html += '<button class="page-btn' + (n === page ? ' active' : '') + '" type="button" onclick="toGoPage(' + n + ')">' + n + '</button>';
    };
    if (totalPages <= 8) {
      for (i = 1; i <= totalPages; i++) show(i);
    } else {
      show(1);
      var start = Math.max(2, page - 2);
      var end = Math.min(totalPages - 1, page + 2);
      if (start > 2) html += '<span class="page-ellipsis">…</span>';
      for (i = start; i <= end; i++) show(i);
      if (end < totalPages - 1) html += '<span class="page-ellipsis">…</span>';
      show(totalPages);
    }
    html += '<button class="page-btn" type="button" ' + (page >= totalPages ? 'disabled' : '') + ' onclick="toGoPage(' + (page + 1) + ')">&rsaquo;</button>';
    return html;
  }

  function renderPage() {
    var queried = queriedRecords();
    var rows = filteredRecords();
    var counts = statusCounts(queried);
    var total = rows.length;
    var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
    if (page > totalPages) page = totalPages;
    var start = (page - 1) * PAGE_SIZE;
    var pageRows = rows.slice(start, start + PAGE_SIZE);
    var colCount = COLUMNS.length + 3;

    var body = pageRows.length ? pageRows.map(function (row, index) {
      var seq = start + index + 1;
      var checked = selected[row.id] ? ' checked' : '';
      return '<tr>'
        + '<td class="sticky-col col-seq"><input type="checkbox" onchange="toToggleRow(\'' + row.id + '\', this.checked)"' + checked + '></td>'
        + '<td class="col-seq to-seq">' + seq + '</td>'
        + COLUMNS.map(function (title) { return '<td>' + fieldValue(row, title) + '</td>'; }).join('')
        + '<td class="sticky-col-r"><span class="to-ops">' + taskOps(row) + '</span></td>'
        + '</tr>';
    }).join('') : '<tr><td colspan="' + colCount + '"><div class="empty-state"><b>没有符合条件的任务单</b><span>调整筛选条件后再查，或清空筛选查看全部任务。</span><button class="btn btn-default" type="button" onclick="toResetFilters()">清空筛选</button></div></td></tr>';

    return '<div class="content-area page-standard to-page">'
      + '<div class="breadcrumb"><a href="javascript:void(0)" onclick="app.navigate(\'task-order-management\')">任务单中心</a><span class="sep">/</span><span class="current">任务单管理</span></div>'
      + '<div class="page-header"><div class="page-title">任务单管理</div></div>'
      + '<div class="filter-panel order-list-filter-panel"><div class="filter-row order-list-filter-grid">'
      + inputItem('toCode', '任务单号', filters.code, '请输入任务单号')
      + selectItem('toType', '任务单类型', optionHtml(['直达任务单', '装货空驶单'], filters.type))
      + selectItem('toStatus', '任务单状态', optionHtml(['待调度', '待执行', '待运输', '运输中', '已完成'], filters.status))
      + selectItem('toAuxStatus', '辅助状态', optionHtml(AUX_STATUSES, filters.auxStatus))
      + selectItem('toUnloadConfirmStatus', '卸货点确认状态', optionHtml(POINT_CONFIRM_STATUSES, filters.unloadConfirmStatus))
      + dateRangeItem('自定义时间', '2026-08-31 00:00:00', '2026-09-02 23:59:59', false)
      + inputItem('toName', '任务单名称', filters.name, '请输入任务单名称')
      + selectItem('toPlate', '车辆', optionHtml(unique('plate'), filters.plate))
      + selectItem('toDriver', '司机', optionHtml(unique('driver'), filters.driver))
      + selectItem('toArea', '配送区域', optionHtml(unique('endArea'), filters.area))
      + inputItem('toWaybillNo', '关联运单', filters.waybillNo, '请输入运单号')
      + dateRangeItem('要求调度时间', '要求调度开始时间', '要求调度结束时间', true)
      + dateRangeItem('派车时间', '派车开始时间', '派车结束时间', true)
      + dateRangeItem('要求发车时间', '要求发车开始时间', '要求发车结束时间', true)
      + selectItem('toTransport', '运输方式', optionHtml(['公路运输'], filters.transport))
      + selectItem('toCarrier', '承运公司', optionHtml(unique('carrier'), filters.carrier))
      + selectItem('toDept', '任务单所属部门', optionHtml(unique('dept'), filters.dept))
      + selectItem('toExtra', '附加要求', optionHtml([], filters.extra))
      + selectItem('toCustomer', '客户', optionHtml(unique('taskCustomer'), filters.customer))
      + selectItem('toCargoType', '货物类型', optionHtml(unique('cargoType'), filters.cargoType))
      + selectItem('toEquipment', '设备', optionHtml([], filters.equipment))
      + dateRangeItem('实际完成时间', '实际完成开始时间', '实际完成结束时间', true)
      + selectItem('toRoadbook', '电子路书', optionHtml([], filters.roadbook))
      + selectItem('toCourier', '送货员', optionHtml([], filters.courier))
      + selectItem('toAssignStatus', '委派状态', optionHtml(['未委派', '已委派'], filters.assignStatus))
      + selectItem('toWeighAudit', '磅单审核状态', optionHtml(['待审核', '已审核', '已驳回'], filters.weighAudit))
      + selectItem('toFlow', '流向', optionHtml(['上行', '下行'], filters.flow))
      + selectItem('toOvertime', '是否超时', optionHtml(['是', '否'], filters.overtime))
      + '</div><div class="filter-actions"><button class="btn btn-default" type="button" onclick="toResetFilters()">重置</button><button class="btn btn-primary" type="button" onclick="toApplyFilters()">查询</button></div></div>'
      + '<div class="table-section">'
      + '<div class="table-toolbar order-status-toolbar to-toolbar"><div class="left">' + renderTabs(counts) + '</div>'
      + '<div class="right">'
      + '<button class="toolbar-btn" type="button" onclick="toPlaceholder(\'分配部门\')">分配部门</button>'
      + '<button class="toolbar-btn" type="button" onclick="toPlaceholder(\'打印随车清单\')">打印随车清单</button>'
      + '<button class="toolbar-btn" type="button" onclick="toPlaceholder(\'委派\')">委派</button>'
      + '<button class="toolbar-btn" type="button" onclick="toPlaceholder(\'委派拒绝\')">委派拒绝</button>'
      + '<button class="toolbar-btn" type="button" onclick="toPlaceholder(\'委派接受\')">委派接受</button>'
      + '<button class="toolbar-btn" type="button" onclick="toPlaceholder(\'异常上报\')">异常上报</button>'
      + '<button class="toolbar-btn" type="button" onclick="toPlaceholder(\'节点监控\')">节点监控</button>'
      + '<button class="toolbar-btn" type="button" onclick="app.render()">刷新</button>'
      + '</div></div>'
      + '<div class="table-wrap"><table class="data-table to-list-table"><thead><tr>'
      + '<th class="sticky-col col-seq"><input type="checkbox" onchange="toToggleAll(this.checked)"></th>'
      + '<th class="to-seq">序号</th>'
      + COLUMNS.map(function (title) { return '<th>' + title + '</th>'; }).join('')
      + '<th class="sticky-col-r">操作</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>'
      + '<div class="pagination"><div class="pagination-info">共 ' + total + ' 条</div>'
      + '<div class="page-size"><select onchange="toChangePageSize(this.value)"><option value="20" selected>20条/页</option></select></div>'
      + '<div class="pagination-controls">' + pageButtons(totalPages) + '</div>'
      + '<div class="to-jump">前往 <input id="toJumpPage" value="' + page + '" onkeydown="if(event.key===\'Enter\')toJump()"> 页</div>'
      + '</div></div></div>';
  }

  function renderPlaceholder(title, hint) {
    return '<div class="content-area page-standard to-page">'
      + '<div class="breadcrumb"><a href="javascript:void(0)" onclick="app.navigate(\'task-order-management\')">任务单中心</a><span class="sep">/</span><span class="current">' + esc(title) + '</span></div>'
      + '<div class="page-header"><div class="page-title">' + esc(title) + '</div></div>'
      + '<div class="table-section"><div class="empty-state to-placeholder"><b>' + esc(title) + '待接入</b><span>' + esc(hint) + '</span>'
      + '<button class="btn btn-default" type="button" onclick="app.navigate(\'task-order-management\')">返回任务单管理</button></div></div></div>';
  }

  function readFilters() {
    function val(id) {
      var el = document.getElementById(id);
      return el ? String(el.value || '').trim() : '';
    }
    filters.code = val('toCode');
    filters.type = val('toType');
    filters.status = val('toStatus');
    filters.auxStatus = val('toAuxStatus');
    filters.unloadConfirmStatus = val('toUnloadConfirmStatus');
    filters.name = val('toName');
    filters.plate = val('toPlate');
    filters.driver = val('toDriver');
    filters.area = val('toArea');
    filters.waybillNo = val('toWaybillNo');
    filters.transport = val('toTransport');
    filters.carrier = val('toCarrier');
    filters.dept = val('toDept');
    filters.extra = val('toExtra');
    filters.customer = val('toCustomer');
    filters.cargoType = val('toCargoType');
    filters.equipment = val('toEquipment');
    filters.roadbook = val('toRoadbook');
    filters.courier = val('toCourier');
    filters.assignStatus = val('toAssignStatus');
    filters.weighAudit = val('toWeighAudit');
    filters.flow = val('toFlow');
    filters.overtime = val('toOvertime');
  }

  window.toApplyFilters = function () { readFilters(); page = 1; app.render(); };
  window.toResetFilters = function () { filters = emptyFilters(); statusTab = 'all'; page = 1; selected = {}; app.render(); };
  window.toSetStatusTab = function (id) { statusTab = id; page = 1; app.render(); };
  window.toGetRecords = function () { return records.slice(); };
  window.toOpenStatusTab = function (id) {
    filters = emptyFilters();
    statusTab = id || 'all';
    page = 1;
    selected = {};
    if (app.currentPage === 'task-order-management') app.render();
    else app.navigate('task-order-management');
  };
  window.toFilterByUnloadConfirm = function (status) {
    filters = emptyFilters();
    filters.unloadConfirmStatus = status || POINT_CONFIRM_PENDING;
    statusTab = 'done';
    page = 1;
    selected = {};
    if (app.currentPage === 'task-order-management') app.render();
    else app.navigate('task-order-management');
  };
  window.toGoPage = function (next) { page = Math.max(1, next); app.render(); };
  window.toChangePageSize = function () { page = 1; app.render(); };
  window.toJump = function () {
    var el = document.getElementById('toJumpPage');
    var next = Number(el && el.value);
    if (!next) return;
    page = next;
    app.render();
  };
  window.toToggleAll = function (checked) {
    filteredRecords().slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).forEach(function (row) {
      if (checked) selected[row.id] = true; else delete selected[row.id];
    });
    app.render();
  };
  window.toToggleRow = function (id, checked) {
    if (checked) selected[id] = true; else delete selected[id];
  };
  function needsUnloadPointConfirm(row) {
    return !!(row && row.status === '已完成' && row.unloadConfirmStatus === POINT_CONFIRM_PENDING);
  }
  function confirmPointDenyReason(row) {
    if (!row || row.status !== '已完成') return '请到已完成任务中确认卸货点。';
    if (row.unloadConfirmStatus === POINT_CONFIRM_DONE) return '该任务已确认卸货点。';
    if (row.unloadConfirmStatus === POINT_CONFIRM_SKIP) return '该任务无需确认卸货点。';
    if (row.unloadConfirmStatus !== POINT_CONFIRM_PENDING) return '仅待确认卸货点的任务可确认或改卸货点。';
    if (row.type === '装货空驶单') return '装货空驶单没有卸货点。';
    if (!row.areaTask) return '精确地址任务已按点围栏派单，无需再确认。改点请到运单管理。';
    if (row.dispatchPointConfirmed) return '该任务已确认卸货点。';
    return '当前任务不可确认卸货点。';
  }
  function taskOps(row) {
    var html = '';
    if (row.status === '已完成') {
      html += '<a class="link" href="javascript:void(0)" onclick="toEditTask(\'' + row.id + '\')">编辑</a>';
      html += '<a class="link" href="javascript:void(0)" onclick="toOpenWeighAudit(\'' + row.id + '\')">磅单初审</a>';
      return html;
    }
    if (row.status === '待调度') {
      if (row.auxStatus === '已作废') html += '<span class="dynamic-muted">已作废</span>';
      else html += '<a class="link" href="javascript:void(0)" onclick="toDispatch(\'' + row.id + '\')">调度</a>';
    }
    if (row.areaTask && (row.status === '待运输' || row.status === '待执行' || row.status === '运输中')) {
      html += '<a class="link" href="javascript:void(0)" onclick="toSimulateUnload(\'' + row.id + '\')">模拟卸货打卡</a>';
    }
    html += '<a class="link" href="javascript:void(0)" onclick="toRename(\'' + row.id + '\')">任务单名称</a>';
    html += '<button type="button" class="to-more" aria-label="更多" onclick="toMore(\'' + row.id + '\')">' + moreIcon() + '</button>';
    return html;
  }
  function closeToPointModal() {
    var el = document.getElementById('toPointModal');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
  function findTask(id) {
    return records.filter(function (item) { return item.id === id; })[0];
  }
  window.toClosePointModal = closeToPointModal;
  function closeWeighAuditModal() {
    var el = document.getElementById('toWeighAuditModal');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
  function weighPhotosOf(row, side) {
    var key = side === 'unload' ? 'unloadPhotos' : 'loadPhotos';
    if (!row[key] || !row[key].length) row[key] = [];
    return row[key];
  }
  function plusIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  }
  function weighPhotosHtml(row, side) {
    var photos = weighPhotosOf(row, side);
    var html = photos.map(function (src, index) {
      return '<div class="to-weigh-thumb"><img src="' + esc(src) + '" alt="' + (side === 'unload' ? '卸货磅单' : '装货磅单') + '"><button class="to-weigh-thumb-x" type="button" onclick="toWeighRemovePhoto(\'' + row.id + '\',\'' + side + '\',' + index + ')" aria-label="删除照片">×</button></div>';
    }).join('');
    html += '<button class="to-weigh-add" type="button" onclick="toWeighAddPhoto(\'' + row.id + '\',\'' + side + '\')" aria-label="上传磅单">' + plusIcon() + '</button>';
    return '<div class="to-weigh-photos">' + html + '</div>';
  }
  function weighFieldHtml(id, label, value) {
    return '<label class="to-weigh-field"><span><i>*</i> ' + label + '</span><div class="to-weigh-input"><input id="' + id + '" type="number" step="0.01" value="' + esc(value || '') + '" oninput="toWeighRecalc()"><em>吨</em></div></label>';
  }
  function weighColHtml(row, side) {
    var isUnload = side === 'unload';
    var title = isUnload ? '卸货磅单' : '装货磅单';
    var required = row.type !== '装货空驶单' || !isUnload;
    var prefix = isUnload ? 'toWeighUnload' : 'toWeighLoad';
    return '<div class="to-weigh-col">'
      + '<div class="to-weigh-col-title">' + (required ? '<i>*</i>' : '') + title + '</div>'
      + weighPhotosHtml(row, side)
      + '<div class="to-weigh-fields">'
      + weighFieldHtml(prefix + 'Gross', '毛重', isUnload ? row.unloadGross : row.loadGross)
      + weighFieldHtml(prefix + 'Tare', '皮重', isUnload ? row.unloadTare : row.loadTare)
      + weighFieldHtml(prefix + 'Net', '净重', isUnload ? row.unloadNet : row.loadNet)
      + '</div></div>';
  }
  function matchBadge(row) {
    if (row && row.matchStatus === '已匹配') return statusBadge('badge-success', '已匹配');
    return statusBadge('badge-warning', '未匹配');
  }
  function currentRouteText(row) {
    var start = row && row.startArea ? row.startArea : '—';
    var end = row && row.unloadPoint && row.unloadPoint !== '—' ? row.unloadPoint : ((row && row.endArea) || '—');
    return start + ' → ' + end;
  }
  function moneyText(value) {
    var text = String(value || '').trim();
    if (!text || text === '—') return '—';
    return text.indexOf('元') >= 0 ? text : (text + ' 元/吨');
  }
  function hasUnloadPoint(row) {
    return !!(row && row.unloadPoint && row.unloadPoint !== '—');
  }
  function areaPriceText(row) {
    if (!row) return '—';
    return moneyText(row.areaUnitPrice || AREA_ROUTE_UNIT_PRICE);
  }
  function pointPriceText(row) {
    if (!row || row.matchStatus !== '已匹配') return '—';
    return moneyText(row.pointUnitPrice || row.unitPrice);
  }
  function matchStatusHtml(row) {
    var note = hasUnloadPoint(row) && row.matchStatus !== '已匹配'
      ? '<small class="to-match-note">未命中点规则，本单按区域路线价</small>'
      : '';
    return '<div class="to-match-cell">' + matchBadge(row) + note + '</div>';
  }
  function weighPointOps(row) {
    if (!needsUnloadPointConfirm(row)) return '<span class="dynamic-muted">—</span>';
    var label = hasUnloadPoint(row) ? '改卸货点' : '选择卸货点';
    return '<div class="to-ops"><a class="link" href="javascript:void(0)" onclick="toOpenReselectPoint(\'' + row.id + '\')">' + label + '</a></div>';
  }
  function rulePending(row) {
    return !!(row && (row.matchStatus === '待审核' || row.pendingRuleId));
  }
  function needsAddPointRule(row) {
    return needsUnloadPointConfirm(row) && row.matchStatus === '未匹配' && !row.pendingRuleId;
  }
  function weighPointPanelHtml(row) {
    if (row.type === '装货空驶单' || !row.areaTask) return '';
    return '<section class="to-weigh-point"><div class="to-weigh-point-head"><b>卸货点确认</b></div>'
      + '<div class="table-wrap"><table class="data-table to-weigh-point-table"><thead><tr>'
      + '<th>运单号</th><th>车辆 / 司机</th><th>当前路线</th><th>具体卸货地</th><th>卸到达时间</th><th>匹配状态</th><th>当前区域单价</th><th>当前单价</th><th class="sticky-col-r">操作</th>'
      + '</tr></thead><tbody><tr>'
      + '<td>' + esc(row.waybillNo || '—') + '</td>'
      + '<td>' + esc((row.plate || '—') + ' / ' + (row.driver || '—')) + '</td>'
      + '<td>' + esc(currentRouteText(row)) + '</td>'
      + '<td>' + esc(row.unloadPoint || '—') + '</td>'
      + '<td>' + esc(row.unloadArrive || '—') + '</td>'
      + '<td>' + matchStatusHtml(row) + '</td>'
      + '<td>' + esc(areaPriceText(row)) + '</td>'
      + '<td>' + esc(pointPriceText(row)) + '</td>'
      + '<td class="sticky-col-r">' + weighPointOps(row) + '</td>'
      + '</tr></tbody></table></div></section>';
  }
  function readWeighInputs(row) {
    function num(id) {
      var el = document.getElementById(id);
      return el ? String(el.value || '').trim() : '';
    }
    row.loadGross = num('toWeighLoadGross');
    row.loadTare = num('toWeighLoadTare');
    row.loadNet = num('toWeighLoadNet');
    row.unloadGross = num('toWeighUnloadGross');
    row.unloadTare = num('toWeighUnloadTare');
    row.unloadNet = num('toWeighUnloadNet');
  }
  function validWeighSide(gross, tare, net, label) {
    var g = Number(gross);
    var t = Number(tare);
    var n = Number(net);
    if (!isFinite(g) || !isFinite(t) || g <= t) {
      toast('请填写有效的' + label + '毛重和皮重，且毛重大于皮重。');
      return false;
    }
    if (!isFinite(n) || Math.abs(n - (g - t)) > 0.05) {
      toast(label + '净重应等于毛重减皮重。');
      return false;
    }
    return true;
  }
  window.toWeighRecalc = function () {
    function fill(prefix) {
      var g = Number((document.getElementById(prefix + 'Gross') || {}).value);
      var t = Number((document.getElementById(prefix + 'Tare') || {}).value);
      var net = document.getElementById(prefix + 'Net');
      if (net && isFinite(g) && isFinite(t)) net.value = (g - t).toFixed(2);
    }
    fill('toWeighLoad');
    fill('toWeighUnload');
  };
  window.toWeighAddPhoto = function (id, side) {
    var row = findTask(id);
    if (!row) return;
    var photos = weighPhotosOf(row, side);
    if (photos.length >= 2) { toast('每侧最多 2 张磅单照片。'); return; }
    photos.push(side === 'unload' ? TICKET_UNLOAD : TICKET_LOAD);
    window.toOpenWeighAudit(id);
  };
  window.toWeighRemovePhoto = function (id, side, index) {
    var row = findTask(id);
    if (!row) return;
    weighPhotosOf(row, side).splice(index, 1);
    window.toOpenWeighAudit(id);
  };
  window.toCloseWeighAudit = function (clear) {
    if (clear) window.__toWeighAuditId = '';
    closeWeighAuditModal();
  };
  window.toOpenWeighAudit = function (id) {
    var row = findTask(id);
    if (!row) return;
    window.__toWeighAuditId = id;
    closeWeighAuditModal();
    var overlay = document.createElement('div');
    overlay.id = 'toWeighAuditModal';
    overlay.className = 'billing-modal-overlay';
    overlay.innerHTML = '<section class="billing-modal to-weigh-audit-modal" role="dialog" aria-modal="true" aria-labelledby="toWeighAuditTitle">'
      + '<header><div><h2 id="toWeighAuditTitle">磅单审核</h2></div>'
      + '<button class="billing-modal-close" type="button" onclick="toCloseWeighAudit(true)" aria-label="关闭">×</button></header>'
      + '<div class="to-weigh-audit-body">'
      + '<div class="to-weigh-audit-meta"><div class="to-weigh-code">任务单编号：<b>' + esc(row.code) + '</b></div></div>'
      + '<div class="to-weigh-cols">' + weighColHtml(row, 'load') + weighColHtml(row, 'unload') + '</div>'
      + weighPointPanelHtml(row)
      + '</div><footer>'
      + '<button class="btn btn-default" type="button" onclick="toCloseWeighAudit(true)">取消</button>'
      + '<button class="btn btn-danger" type="button" onclick="toWeighReject(\'' + row.id + '\')">驳回</button>'
      + '<button class="btn btn-primary" type="button" onclick="toWeighApprove(\'' + row.id + '\')">审核通过</button>'
      + '</footer></section>';
    document.body.appendChild(overlay);
  };
  window.toResumeWeighAudit = function () {
    var id = window.__toWeighAuditId;
    if (!id || app.currentPage !== 'task-order-management') return;
    window.toOpenWeighAudit(id);
  };
  window.toWeighReject = function (id) {
    var row = findTask(id);
    if (!row) return;
    readWeighInputs(row);
    row.weighAudit = '已驳回';
    window.toCloseWeighAudit(true);
    app.render();
    toast('磅单初审已驳回，请核对重量或照片后再次提交。');
  };
  window.toWeighApprove = function (id) {
    var row = findTask(id);
    if (!row) return;
    readWeighInputs(row);
    if (!validWeighSide(row.loadGross, row.loadTare, row.loadNet, '装货')) return;
    if (!weighPhotosOf(row, 'load').length) { toast('请上传装货磅单。'); return; }
    if (row.type !== '装货空驶单') {
      if (!validWeighSide(row.unloadGross, row.unloadTare, row.unloadNet, '卸货')) return;
      if (!weighPhotosOf(row, 'unload').length) { toast('请上传卸货磅单。'); return; }
    }
    if (needsUnloadPointConfirm(row)) {
      if (!hasUnloadPoint(row)) { toast('请先选择卸货点。'); return; }
      var passNote = taskPointPriced(row) ? '卸货点与点价已确认。' : '卸货点已确认，本单按区域路线价。';
      row.weighAudit = '已审核';
      window.__toWeighAuditId = '';
      window.__toWeighPassNote = passNote;
      closeWeighAuditModal();
      if (typeof window.confirmOpsAccept === 'function') window.confirmOpsAccept(row.waybillNo);
      else {
        window.__toWeighPassNote = '';
        app.render();
        toast(passNote);
      }
      return;
    }
    row.weighAudit = '已审核';
    window.toCloseWeighAudit(true);
    app.render();
    toast('磅单初审已通过。');
  };
  function applyMatchStatusFromWaybill(item, wb) {
    if (!item || !wb) return;
    if (wb.point && wb.point !== '—') {
      item.unloadPoint = wb.point;
      item.unloadPointId = wb.pointId || item.unloadPointId;
    }
    item.pendingRuleId = wb.pendingRuleId || '';
    if (wb.taxRate) item.taxRate = wb.taxRate;
    if (wb.rounding) item.rounding = wb.rounding;
    if (wb.feeItem) item.feeItem = wb.feeItem;
    if (!item.areaUnitPrice) item.areaUnitPrice = AREA_ROUTE_UNIT_PRICE;
    if (wb.type === 'priced' || wb.kind === 'priced') {
      item.matchStatus = '已匹配';
      if (wb.unitPrice) {
        item.pointUnitPrice = wb.unitPrice;
        item.unitPrice = wb.unitPrice;
      }
      return;
    }
    item.matchStatus = '未匹配';
    item.pointUnitPrice = '';
    if (item.areaUnitPrice) item.unitPrice = item.areaUnitPrice;
  }
  window.taskOpsWaybillStub = function (code) {
    var key = String(code || '').trim();
    var row = records.filter(function (item) { return String(item.waybillNo || '') === key; })[0];
    if (!row) return null;
    var once = !!(row.oncePriced || row.matchStatus === '本单锁价');
    var pending = rulePending(row);
    var unmatched = row.matchStatus !== '已匹配';
    return {
      code: row.waybillNo,
      point: row.unloadPoint || '—',
      pointId: row.unloadPointId || '',
      kind: once ? 'priced' : (pending ? 'pending' : (unmatched ? 'miss' : 'priced')),
      type: once ? 'once' : ((unmatched || pending) ? 'decide' : 'priced'),
      state: pending ? '点规则待审核' : (row.matchStatus || ''),
      billingStatus: pending ? '点规则待审核' : '',
      recvArea: row.endArea,
      area: row.endArea,
      sendArea: row.startArea,
      cargo: row.cargoName || row.cargo,
      contract: row.contract || '景洪水泥运输合同',
      pendingRuleId: row.pendingRuleId || '',
      unitPrice: row.unitPrice,
      taxRate: row.taxRate,
      rounding: row.rounding,
      feeItem: row.feeItem || '预计运费',
      opsHandled: !!row.dispatchPointConfirmed,
      once: once
    };
  };
  window.taskOpsAfterWaybill = function (code, kind) {
    var wb = typeof window.peekOpsWaybill === 'function' ? window.peekOpsWaybill(code) : null;
    records.forEach(function (item) {
      if (String(item.waybillNo || '') !== String(code || '')) return;
      applyMatchStatusFromWaybill(item, wb);
      if (kind === 'confirm') {
        item.dispatchPointConfirmed = true;
        item.unloadConfirmStatus = POINT_CONFIRM_DONE;
      }
      if (kind === 'reselect') {
        item.dispatchPointConfirmed = false;
        item.unloadConfirmStatus = POINT_CONFIRM_PENDING;
      }
      if (kind === 'once') {
        item.oncePriced = true;
        item.matchStatus = '未匹配';
        item.dispatchPointConfirmed = true;
        item.unloadConfirmStatus = POINT_CONFIRM_DONE;
      }
      if (kind === 'rule') {
        if (wb && wb.pendingRuleId) item.pendingRuleId = wb.pendingRuleId;
        if (item.matchStatus !== '已匹配') item.matchStatus = '未匹配';
        item.dispatchPointConfirmed = false;
        item.unloadConfirmStatus = POINT_CONFIRM_PENDING;
      }
    });
  };
  function taskPointPriced(row) {
    if (!row) return false;
    if (row.matchStatus === '已匹配') return true;
    var stub = typeof window.taskOpsWaybillStub === 'function' ? window.taskOpsWaybillStub(row.waybillNo) : null;
    return !!(stub && (stub.once || stub.type === 'priced' || stub.type === 'once'));
  }
  function closeMatchMissModal() {
    if (typeof window.closeBillingMatchMiss === 'function') window.closeBillingMatchMiss();
  }
  window.toCloseMatchMiss = closeMatchMissModal;
  window.toOpenMatchMiss = function (code, opts) {
    var row = records.filter(function (item) { return String(item.waybillNo || '') === String(code || ''); })[0];
    if (!row) return;
    opts = opts || {};
    var promptOnly = opts.promptOnly !== false;
    var isMulti = opts.kind === 'multi';
    var isPending = opts.kind === 'pending';
    closeMatchMissModal();
    closeToPointModal();
    if (typeof window.openBillingMatchMiss !== 'function') return;
    window.openBillingMatchMiss({
      kind: opts.kind || 'miss',
      promptOnly: promptOnly,
      loadingArea: row.startArea,
      unloadPoint: row.unloadPoint,
      onCancel: function () {},
      onPrimary: function () {
        if (promptOnly) return;
        if (isMulti || isPending) window.toMissReselectPoint(row.id);
      }
    });
  };
  window.toMissReselectPoint = function (id) {
    window.toOpenReselectPoint(id);
  };
  window.toOpenReselectPoint = function (id) {
    var row = findTask(id);
    if (!row) return;
    if (document.getElementById('toWeighAuditModal')) readWeighInputs(row);
    if (!needsUnloadPointConfirm(row)) { toast(confirmPointDenyReason(row)); return; }
    if (row.type === '装货空驶单') { toast('装货空驶单没有卸货点。'); return; }
    if (!row.areaTask) { toast('精确地址任务请到运单管理换点。'); return; }
    if (!row.waybillNo || typeof window.openOpsReselectPoint !== 'function') { toast('未找到关联运单。'); return; }
    closeToPointModal();
    window.openOpsReselectPoint(row.waybillNo);
  };
  window.toOpenAddPointRule = function () {
    toast('磅单初审不提供新增计费规则。未命中请重新选择卸货点；建规则请到运单管理「修改」。');
  };
  window.toEditTask = function (id) {
    var row = findTask(id);
    if (!row) return;
    closeToPointModal();
    var overlay = document.createElement('div');
    overlay.id = 'toPointModal';
    overlay.className = 'billing-modal-overlay';
    overlay.innerHTML = '<section class="billing-modal dynamic-rule-modal" role="dialog" aria-modal="true" aria-label="编辑任务单">'
      + '<header><div><h2>编辑任务单</h2><p>' + (needsUnloadPointConfirm(row) ? '可改名称与调度备注。改点请在「磅单初审」中办理。认点随审核通过完成。' : '可改名称与调度备注。') + '磅单重量与照片在磅单初审中核对。</p></div>'
      + '<button class="billing-modal-close" type="button" onclick="toClosePointModal()" aria-label="关闭">×</button></header>'
      + '<div class="billing-form-grid">'
      + '<label><span>任务单号</span><input value="' + esc(row.code) + '" readonly></label>'
      + '<label><span>车辆 / 司机</span><input value="' + esc((row.plate || '—') + ' / ' + (row.driver || '—')) + '" readonly></label>'
      + '<label><span>任务单名称</span><input id="toEditName" value="' + esc(row.name || '') + '"></label>'
      + '<label><span>调度备注</span><input id="toEditRemark" value="' + esc(row.dispatchRemark || '') + '"></label>'
      + '</div><footer>'
      + '<button class="btn btn-default" type="button" onclick="toClosePointModal()">取消</button>'
      + '<button class="btn btn-primary" type="button" onclick="toSaveTaskEdit(\'' + row.id + '\')">保存</button>'
      + '</footer></section>';
    document.body.appendChild(overlay);
  };
  window.toSaveTaskEdit = function (id) {
    var row = findTask(id);
    if (!row) return;
    var nameEl = document.getElementById('toEditName');
    var remarkEl = document.getElementById('toEditRemark');
    row.name = nameEl ? String(nameEl.value || '').trim() : (row.name || '');
    row.dispatchRemark = remarkEl ? String(remarkEl.value || '').trim() : (row.dispatchRemark || '');
    closeToPointModal();
    app.render();
    toast('已保存任务单「' + row.code + '」。');
  };
  window.toPlaceholder = function (name) { toast(name + '为当前原型占位，不执行业务动作。'); };
  function taskDetailText(value) {
    return value === 0 || value ? String(value) : '—';
  }
  function taskDetailCell(label, value, html) {
    return '<div><dt>' + esc(label) + '</dt><dd>' + (html || esc(taskDetailText(value))) + '</dd></div>';
  }
  function taskDetailSection(title, cells) {
    return '<section class="detail-section"><div class="detail-section-head"><div class="detail-section-title">' + esc(title) + '</div></div><dl class="to-task-grid">' + cells + '</dl></section>';
  }
  function taskFromAlert(code) {
    var store = window.AlertCenterStore;
    if (!store || typeof store.getEvents !== 'function') return null;
    var event = store.getEvents().filter(function (item) { return item && item.taskId === code; })[0];
    if (!event) return null;
    var metrics = event.metrics || {};
    return {
      code: code,
      status: metrics.taskStatus || metrics.taskNode || '',
      auxStatus: '',
      unloadConfirmStatus: '',
      name: '',
      type: '',
      plate: event.plate || '',
      trailerNo: '',
      driver: event.driverName || '',
      driverPhone: '',
      route: event.route || '',
      startArea: '',
      endArea: '',
      cargoName: event.cargo || '',
      cargo: event.cargo || '',
      flow: '',
      dept: event.departmentName || event.projectName || '',
      carrier: '',
      taskCustomer: '',
      waybillNo: '',
      createTime: '',
      dispatchTime: '',
      requireDepartTime: '',
      loadArrive: '',
      loadLeave: '',
      unloadArrive: metrics.arrivedAt || '',
      unloadLeave: metrics.departedAt || '',
      actualFinishTime: '',
      unloadPoint: metrics.unloadLocation || '',
      loadNet: '',
      unloadNet: '',
      unloadWeighNo: '',
      weighAudit: '',
      dispatchRemark: ''
    };
  }
  function findTaskRecord(key) {
    var code = String(key || '');
    return records.filter(function (item) { return item.id === code || item.code === code; })[0] || null;
  }
  function openTaskDetail(row) {
    if (!row) return;
    var existing = document.getElementById('toTaskDetail');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'toTaskDetail';
    overlay.className = 'billing-modal-overlay';
    overlay.innerHTML = '<section class="billing-modal to-task-detail" role="dialog" aria-modal="true" aria-label="任务单详情">'
      + '<header><div><h2>任务单详情</h2></div>'
      + '<button class="billing-modal-close" type="button" onclick="toCloseTaskDetail()" aria-label="关闭">×</button></header>'
      + '<div class="to-task-detail-body">'
      + '<div class="to-task-summary"><b>' + esc(row.code || '—') + '</b>' + (row.status ? mainBadge(row.status) : '') + (row.auxStatus ? auxBadge(row.auxStatus) : '') + '</div>'
      + taskDetailSection('基础信息',
        taskDetailCell('任务单号', row.code)
        + taskDetailCell('任务单名称', row.name)
        + taskDetailCell('任务单类型', row.type)
        + taskDetailCell('状态', row.status, row.status ? mainBadge(row.status) : '')
        + taskDetailCell('辅助状态', row.auxStatus, row.auxStatus ? auxBadge(row.auxStatus) : '')
        + taskDetailCell('卸货点确认状态', row.unloadConfirmStatus, row.unloadConfirmStatus ? unloadConfirmBadge(row.unloadConfirmStatus) : '')
        + taskDetailCell('所属部门', row.dept)
        + taskDetailCell('承运公司', row.carrier)
        + taskDetailCell('客户', row.taskCustomer)
        + taskDetailCell('创建时间', row.createTime))
      + taskDetailSection('运输信息',
        taskDetailCell('车辆', row.plate)
        + taskDetailCell('挂车号', row.trailerNo)
        + taskDetailCell('主司机', row.driver)
        + taskDetailCell('主司机电话', row.driverPhone)
        + taskDetailCell('分段线路', row.route)
        + taskDetailCell('起点区域', row.startArea)
        + taskDetailCell('终点区域', row.endArea)
        + taskDetailCell('货物', row.cargoName || row.cargo)
        + taskDetailCell('流向', row.flow)
        + taskDetailCell('关联运单', row.waybillNo, row.waybillNo ? '<a class="link" href="javascript:void(0)" onclick="toOpenWaybill(\'' + esc(row.waybillNo) + '\')">' + esc(row.waybillNo) + '</a>' : ''))
      + taskDetailSection('节点时间',
        taskDetailCell('派车时间', row.dispatchTime)
        + taskDetailCell('要求发车时间', row.requireDepartTime)
        + taskDetailCell('装到达时间', row.loadArrive)
        + taskDetailCell('装离开时间', row.loadLeave)
        + taskDetailCell('卸到达时间', row.unloadArrive)
        + taskDetailCell('卸离开时间', row.unloadLeave)
        + taskDetailCell('实际完成时间', row.actualFinishTime))
      + taskDetailSection('磅单与卸货点',
        taskDetailCell('装货净重(t)', row.loadNet)
        + taskDetailCell('卸货净重(t)', row.unloadNet)
        + taskDetailCell('卸货磅单号', row.unloadWeighNo)
        + taskDetailCell('磅单审核状态', row.weighAudit)
        + taskDetailCell('具体卸货地', row.unloadPoint)
        + taskDetailCell('调度备注', row.dispatchRemark))
      + '</div></section>';
    document.body.appendChild(overlay);
  }
  window.toCloseTaskDetail = function () {
    var overlay = document.getElementById('toTaskDetail');
    if (overlay) overlay.remove();
  };
  window.toOpenTaskByCode = function (code) {
    var key = String(code || '').trim();
    if (!key) return;
    openTaskDetail(findTaskRecord(key) || taskFromAlert(key) || { code: key });
  };
  window.toOpenTask = function (id) {
    var row = findTaskRecord(id);
    if (!row) { toast('未找到任务单'); return; }
    openTaskDetail(row);
  };
  window.toOpenWaybill = function (waybillNo) {
    var row = records.filter(function (item) { return item.waybillNo === waybillNo; })[0];
    if (typeof window.openWaybillDetail === 'function' && row) window.openWaybillDetail(waybillNo, row.orderNo, 'waybill');
    else if (typeof window.wbFilterByOrder === 'function' && row && row.orderNo) window.wbFilterByOrder(row.orderNo);
    else toast('关联运单 ' + waybillNo);
  };
  window.toDispatch = function (id) {
    var row = records.filter(function (item) { return item.id === id; })[0];
    if (!row) return;
    if (row.status !== '待调度') { toast('该任务单当前不是待派车状态。'); return; }
    if (row.auxStatus === '已作废') { toast('该任务单已作废，不能派车。'); return; }
    row.status = '待运输';
    row.assignStatus = '已委派';
    row.plate = row.plate || '云F·D88621';
    row.driver = row.driver || '李师傅';
    row.driverPhone = row.driverPhone || '13800001111';
    row.trailerNo = row.trailerNo || '云F·G0021';
    row.carrier = DEPT;
    row.dispatchTime = '2026-09-02 15:12:08';
    row.assignTime = '2026-09-02 15:10:02';
    row.requireDepartTime = '2026-09-02 16:00:00';
    if (typeof window.wbMarkDispatched === 'function') window.wbMarkDispatched(row.waybillNo);
    app.render();
    toast('已派车，任务转为待运输。司机可执行；后台可用「模拟卸货打卡」回写运单具体点。');
  };
  window.toSimulateUnload = function (id) {
    var row = records.filter(function (item) { return item.id === id; })[0];
    if (!row) return;
    row.status = '运输中';
    row.unloadArrive = row.unloadArrive || '2026-09-02 20:10:00';
    if (typeof window.simulateWaybillCheckin === 'function') {
      if (row.orderNo) window.openDynamicOrder && (window.__areaOrderIdSilent = row.orderNo);
      var orderSetter = window.openWaybillDetail;
      if (typeof window.simulateWaybillCheckin === 'function') {
        if (row.orderNo && typeof window.openDynamicOrder === 'function') {
          /* selectedOrderId is inside pricing IIFE; simulate uses getOrder(selectedOrderId) */
        }
      }
    }
    if (row.orderNo) {
      window.openWaybillDetail(row.waybillNo, row.orderNo, 'waybill');
      setTimeout(function () {
        if (typeof window.simulateWaybillCheckin === 'function') window.simulateWaybillCheckin(row.waybillNo);
      }, 0);
      return;
    }
    app.render();
    toast('已记录卸货打卡。');
  };
  window.toFilterByWaybill = function (waybillNo) {
    filters = emptyFilters();
    filters.waybillNo = waybillNo || '';
    statusTab = 'all';
    page = 1;
    if (app.currentPage === 'task-order-management') app.render();
    else app.navigate('task-order-management');
  };
  window.toFilterByOrder = function (orderNo) {
    filters = emptyFilters();
    filters.orderNo = orderNo || '';
    statusTab = 'dispatch';
    page = 1;
    if (app.currentPage === 'task-order-management') app.render();
    else app.navigate('task-order-management');
  };
  window.toIngestFromWaybills = function (order, rows) {
    if (!order || !rows) return;
    rows.forEach(function (bill, index) {
      var id = 'TO-' + bill.code;
      var payload = {
        id: id,
        status: bill.type === 'carry' ? '待调度' : (bill.type === 'priced' || bill.type === 'once' || bill.type === 'decide' ? '运输中' : '待调度'),
        assignStatus: bill.type === 'carry' ? '未委派' : '已委派',
        code: bill.code.replace(/^YD/, 'RW'),
        auxStatus: '正常',
        unloadConfirmStatus: POINT_CONFIRM_SKIP,
        createTime: order.createTime,
        name: order.cargo || '',
        plate: bill.type === 'carry' ? '' : '云F·D88621',
        driver: bill.type === 'carry' ? '' : '李师傅',
        driverPhone: bill.type === 'carry' ? '' : '13800001111',
        route: (order.sendArea || '') + ' -> ' + (order.area || ''),
        waybillNo: bill.code,
        orderNo: order.id,
        requireDispatchTime: '',
        assignReq: '',
        dispatchTime: '',
        dispatchReq: '',
        requireDepartTime: '',
        carrier: bill.type === 'carry' ? '' : DEPT,
        dept: DEPT,
        extra: '',
        cargoType: '水泥',
        actualFinishTime: '',
        transport: '公路运输',
        equipment: '',
        bookModel: '',
        actualModel: '',
        courier: '',
        equipmentName: '',
        estMileage: '0',
        taskCustomer: order.customer,
        roadbook: '',
        waybillCustomer: order.customer,
        cargo: order.cargo,
        estHours: '',
        actualMileage: '',
        actualHours: '',
        actualDepartTime: '',
        copilot1: '',
        copilot1Phone: '',
        copilot2: '',
        copilot2Phone: '',
        dispatchRemark: '',
        requireShipTime: '',
        dispatchQty: '1',
        dispatchWeight: '34',
        dispatchVolume: '0',
        signQty: '0',
        signWeight: '0',
        signVolume: '0',
        assignTime: '',
        createMode: '拆运单生成',
        startArea: order.sendArea,
        endArea: order.area,
        remoteArea: '',
        handoverDetail: '',
        trailerNo: '',
        handoverType: '',
        cargoName: order.cargo,
        flow: '上行',
        pickupStatus: '',
        unloadWeighNo: '',
        unloadWeighStatus: '',
        weighAudit: '',
        loadPhotos: [],
        unloadPhotos: [],
        loadGross: '',
        loadTare: '',
        loadNet: '',
        unloadGross: '',
        unloadTare: '',
        unloadNet: '',
        overtime: '否',
        type: '直达任务单',
        loadArrive: '',
        loadLeave: '',
        unloadArrive: '',
        unloadLeave: '',
        areaTask: true
      };
      var hit = false;
      records = records.map(function (item) {
        if (item.waybillNo === bill.code && item.areaTask) { hit = true; return Object.assign({}, item, payload, { id: item.id, status: item.status, plate: item.plate, driver: item.driver, assignStatus: item.assignStatus }); }
        return item;
      });
      if (!hit) records.unshift(payload);
    });
  };
  window.toRename = function () { toast('任务单名称维护为当前原型占位。'); };
  window.toMore = function () { toast('更多操作为当前原型占位。'); };

  app.register('task-order-management', renderPage, ['task-order-management']);
  if (app.pages['task-order-management']) {
    app.pages['task-order-management'].onRender = function () {
      var auditId = window.__toWeighAuditId;
      if (auditId && !document.getElementById('toWeighAuditModal')) {
        window.setTimeout(function () { window.toOpenWeighAudit(auditId); }, 0);
      }
      var pendingTaskCode = window.__toPendingTaskCode;
      if (pendingTaskCode) {
        window.__toPendingTaskCode = '';
        window.setTimeout(function () { window.toOpenTaskByCode(pendingTaskCode); }, 0);
      }
      if (!window.__opsReselectCode) return;
      var code = window.__opsReselectCode;
      var prefer = window.__opsPendingFenceName || '';
      window.setTimeout(function () {
        window.__opsReselectCode = '';
        window.__opsPendingFenceName = '';
        if (typeof window.openOpsReselectPoint === 'function') window.openOpsReselectPoint(code, prefer);
      }, 40);
    };
  }
  app.register('task-order-cargo', function () {
    return renderPlaceholder('任务单货量明细', '本页先保留菜单入口，货量核对仍以任务单管理列表中的调度/签收数量为准。');
  }, ['task-order-cargo']);
  app.register('task-order-track', function () {
    return renderPlaceholder('任务单轨迹重跑', '轨迹重跑能力尚未接入本原型，请先从任务单管理定位单据。');
  }, ['task-order-track']);
  app.register('task-order-exception', function () {
    return renderPlaceholder('任务单异常管理', '异常上报入口已在任务单管理工具栏占位，独立异常台账下一期接入。');
  }, ['task-order-exception']);

  var hashPage = window.location.hash.replace('#', '');
  if (hashPage && app.pages[hashPage] && (hashPage.indexOf('task-order') === 0)) {
    app.navigate(hashPage);
  }
})();
