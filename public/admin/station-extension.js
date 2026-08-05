(function () {
  var allStations = [];
  var filteredStations = [];

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"]/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char];
    });
  }

  function stationStatus(station) {
    return station.enabledStatus === "启用" ? '<span class="badge badge-success badge-dot">启用</span>' : '<span class="badge badge-gray badge-dot">停用</span>';
  }

  function addNavigation() {
    var group = document.querySelector('.nav-group[data-group="base-info"] .nav-children');
    if (!group || document.querySelector('[data-page="station-management"]')) return;
    var item = document.createElement("div");
    item.className = "nav-item sub";
    item.setAttribute("data-page", "station-management");
    item.innerHTML = "<span>站点管理</span>";
    item.onclick = function () { app.navigate("station-management"); };
    group.appendChild(item);
  }

  function pageHtml() {
    return ''
      + '<div class="top-tabs"><div class="tab-item active">站点管理</div></div>'
      + '<div class="content-area">'
      + '<div class="breadcrumb"><a href="#">基础信息</a><span class="sep">/</span><span class="current">站点管理</span></div>'
      + '<div class="page-header"><div class="page-title">站点管理 <span class="sub">维护司机端场站地图、列表与充电信息</span></div><div class="page-actions"><button class="btn btn-primary" onclick="stationOpenForm()">新增站点</button></div></div>'
      + '<div class="filter-panel" id="stationFilterPanel"><div class="filter-row">'
      + field('站点名称', '<input class="filter-control" id="stationNameFilter" placeholder="请输入站点名称">')
      + field('站点编号', '<input class="filter-control" id="stationCodeFilter" placeholder="请输入站点编号">')
      + field('启用状态', '<select class="filter-control" id="stationStatusFilter"><option value="">全部</option><option>启用</option><option>停用</option></select>')
      + field('所属部门', '<input class="filter-control" id="stationDeptFilter" placeholder="请输入所属部门">')
      + '</div><div class="filter-actions"><button class="btn btn-default" onclick="stationResetFilters()">重置</button><button class="btn btn-primary" onclick="stationApplyFilters()">查询</button></div></div>'
      + '<div class="station-control-note">启用且坐标有效的站点将展示在司机端地图与场站列表；停用后将立即隐藏。</div>'
      + '<div class="table-section"><div class="table-toolbar"><div class="left"><span class="station-toolbar-title">场站基础数据</span></div><div class="right"><span id="stationTotal" class="station-total"></span><button class="toolbar-btn" onclick="stationLoad()">刷新</button></div></div>'
      + '<div class="table-wrap"><table class="data-table station-table"><thead><tr><th class="sticky-col col-seq">序号</th><th class="sticky-col station-name-col">区域名称</th><th>区域编号</th><th>区域类型</th><th>类型</th><th>收/发货类型</th><th>所属部门</th><th>共享模式</th><th>半径</th><th>经度</th><th>纬度</th><th>位置</th><th>所属省份</th><th>所属城市</th><th>所属区</th><th>备注</th><th>开通状态</th><th>账号</th><th>修改人</th><th>修改时间</th><th>启用状态</th><th>结算主体</th><th>充电桩数量</th><th>电价</th><th>标准停留时长</th><th class="sticky-col-r">操作</th></tr></thead><tbody id="stationTableBody"></tbody></table></div></div>'
      + '</div>';

    function field(label, control) { return '<div class="filter-item"><label class="filter-label">' + label + '</label>' + control + '</div>'; }
  }

  function renderTable() {
    var body = document.getElementById("stationTableBody");
    var total = document.getElementById("stationTotal");
    if (!body) return;
    if (total) total.textContent = "共 " + filteredStations.length + " 条";
    if (!filteredStations.length) {
      body.innerHTML = '<tr><td colspan="26" class="empty-row">暂无匹配的站点数据</td></tr>';
      return;
    }
    body.innerHTML = filteredStations.map(function (station, index) {
      var price = station.priceText || "暂无价格";
      var stay = station.stayDurationText || "—";
      return '<tr>'
        + '<td class="sticky-col col-seq">' + (index + 1) + '</td>'
        + '<td class="sticky-col station-name-col"><strong>' + escapeHtml(station.name) + '</strong><small>' + escapeHtml(station.shortName || "") + '</small></td>'
        + '<td class="col-mono">' + escapeHtml(station.code) + '</td><td>' + escapeHtml(station.areaType) + '</td><td>' + escapeHtml(station.stationType) + '</td><td>' + escapeHtml(station.shipReceiveType) + '</td><td>' + escapeHtml(station.department) + '</td><td>' + escapeHtml(station.shareMode) + '</td><td>' + escapeHtml(station.radius) + 'm</td><td class="col-mono">' + escapeHtml(station.lng) + '</td><td class="col-mono">' + escapeHtml(station.lat) + '</td><td><span class="tooltip" title="' + escapeHtml(station.address) + '">' + escapeHtml(station.address) + '</span></td><td>' + escapeHtml(station.province) + '</td><td>' + escapeHtml(station.city) + '</td><td>' + escapeHtml(station.district) + '</td><td><span class="tooltip" title="' + escapeHtml(station.remark) + '">' + escapeHtml(station.remark || "—") + '</span></td><td>' + escapeHtml(station.openStatus) + '</td><td>' + escapeHtml(station.account) + '</td><td>' + escapeHtml(station.editor) + '</td><td class="col-time">' + escapeHtml(station.updatedAt) + '</td><td>' + stationStatus(station) + '</td><td>' + escapeHtml(station.settlementEntity) + '</td><td>' + escapeHtml(station.totalPiles) + '</td><td>' + escapeHtml(price) + '</td><td>' + escapeHtml(stay) + '</td>'
        + '<td class="sticky-col-r"><a class="link" href="javascript:void(0)" onclick="stationOpenForm(\'' + station.id + '\')">修改</a><span class="station-action-sep">|</span><a class="link" href="javascript:void(0)" onclick="stationToggle(\'' + station.id + '\')">' + (station.enabledStatus === "启用" ? "停用" : "启用") + '</a><span class="station-action-sep">|</span><a class="btn-danger-text" href="javascript:void(0)" onclick="stationDelete(\'' + station.id + '\',\'' + escapeHtml(station.name).replace(/'/g, "\\'") + '\')">删除</a></td>'
        + '</tr>';
    }).join("");
  }

  function getFormValue(id) {
    var element = document.getElementById(id);
    return element ? element.value.trim() : "";
  }

  function formField(label, key, value, options, required) {
    var control;
    if (options) {
      control = '<select data-station-field="' + key + '">' + options.map(function (option) { return '<option' + (String(value) === option ? ' selected' : '') + '>' + option + '</option>'; }).join("") + '</select>';
    } else if (key === "remark") {
      control = '<textarea data-station-field="remark" rows="3">' + escapeHtml(value || "") + '</textarea>';
    } else {
      control = '<input data-station-field="' + key + '" value="' + escapeHtml(value == null ? "" : value) + '">';
    }
    return '<label><span>' + label + (required ? '<b>*</b>' : '') + '</span>' + control + '</label>';
  }

  window.stationOpenForm = function (stationId) {
    var station = allStations.filter(function (item) { return item.id === stationId; })[0] || {
      enabledStatus: "启用", areaType: "点", stationType: "充电站", shipReceiveType: "收/发货", department: "玉溪运营部", shareMode: "全局", radius: 500, province: "云南省", city: "玉溪市", totalPiles: 1, availablePiles: 1, account: "tms_yx_ops", settlementEntity: "玉溪物流能源有限公司", pricePeriods: [{ price: "" }], stayDurations: [{ durationMin: 60 }],
    };
    var price = (station.pricePeriods || [{}])[0].price || "";
    var stay = (station.stayDurations || [{}])[1] || (station.stayDurations || [{}])[0] || {};
    var overlay = document.createElement("div");
    overlay.className = "station-modal-overlay";
    overlay.id = "stationModal";
    overlay.innerHTML = '<section class="station-modal" role="dialog" aria-modal="true" aria-label="' + (stationId ? "修改站点" : "新增站点") + '"><header><div><h2>' + (stationId ? "修改站点" : "新增站点") + '</h2><p>维护后将同步控制司机端场站地图与列表展示。</p></div><button class="station-modal-close" onclick="stationCloseForm()" aria-label="关闭">×</button></header><div class="station-form-grid">'
      + formField("名称", "name", station.name, null, true) + formField("简称", "shortName", station.shortName) + formField("区域编号", "code", station.code) + formField("自编号", "autoCode", station.autoCode)
      + formField("区域类型", "areaType", station.areaType, ["点", "区域", "行政区域"]) + formField("类型", "stationType", station.stationType, ["充电站", "换电站", "物流园"]) + formField("收/发货类型", "shipReceiveType", station.shipReceiveType, ["收/发货"]) + formField("启用状态", "enabledStatus", station.enabledStatus, ["启用", "停用"], true)
      + formField("所属部门", "department", station.department) + formField("共享模式", "shareMode", station.shareMode, ["全局", "部门", "个人"]) + formField("半径（m）", "radius", station.radius) + formField("充电桩数量", "totalPiles", station.totalPiles, null, true)
      + formField("可用充电桩", "availablePiles", station.availablePiles) + formField("当前电价（元/度）", "price", price, null, true) + formField("标准停留时长（分钟）", "stayDuration", stay.durationMin || 60, null, true) + formField("经度", "lng", station.lng, null, true)
      + formField("纬度", "lat", station.lat, null, true) + formField("所属省份", "province", station.province) + formField("所属城市", "city", station.city) + formField("所属区", "district", station.district)
      + formField("结算主体", "settlementEntity", station.settlementEntity) + formField("账号", "account", station.account) + formField("位置", "address", station.address, null, true) + formField("备注", "remark", station.remark)
      + '</div><footer><button class="btn btn-default" onclick="stationCloseForm()">取消</button><button class="btn btn-primary" onclick="stationSave(\'' + (station.id || "") + '\')">保存</button></footer></section>';
    document.body.appendChild(overlay);
  };

  window.stationCloseForm = function () {
    var modal = document.getElementById("stationModal");
    if (modal) modal.remove();
  };

  window.stationSave = function (id) {
    var payload = {};
    document.querySelectorAll("#stationModal [data-station-field]").forEach(function (field) { payload[field.getAttribute("data-station-field")] = field.value.trim(); });
    if (!payload.name || !payload.lng || !payload.lat || !payload.address) return window.alert("请填写名称、经纬度和位置");
    payload.pricePeriods = [{ priceType: "平", start: "00:00", end: "23:00", price: payload.price }];
    payload.stayDurations = [{ start: "00:00", end: "23:59", durationMin: Number(payload.stayDuration || 60) }];
    delete payload.price;
    delete payload.stayDuration;
    fetch(id ? "/api/stations/" + encodeURIComponent(id) : "/api/stations", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then(function (response) { if (!response.ok) throw new Error("保存失败"); return response.json(); })
      .then(function () { stationCloseForm(); stationLoad(); })
      .catch(function () { window.alert("站点保存失败，请稍后重试"); });
  };

  window.stationDelete = function (id, name) {
    if (!window.confirm("确认删除站点“" + name + "”吗？删除后司机端不再展示该站点。")) return;
    fetch("/api/stations/" + encodeURIComponent(id), { method: "DELETE" }).then(function () { stationLoad(); });
  };

  window.stationToggle = function (id) {
    var station = allStations.filter(function (item) { return item.id === id; })[0];
    if (!station) return;
    fetch("/api/stations/" + encodeURIComponent(id), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabledStatus: station.enabledStatus === "启用" ? "停用" : "启用" }) }).then(function () { stationLoad(); });
  };

  window.stationApplyFilters = function () {
    var name = getFormValue("stationNameFilter");
    var code = getFormValue("stationCodeFilter");
    var department = getFormValue("stationDeptFilter");
    var status = getFormValue("stationStatusFilter");
    filteredStations = allStations.filter(function (station) {
      return (!name || station.name.indexOf(name) >= 0) && (!code || station.code.indexOf(code) >= 0) && (!department || station.department.indexOf(department) >= 0) && (!status || station.enabledStatus === status);
    });
    renderTable();
  };

  window.stationResetFilters = function () {
    ["stationNameFilter", "stationCodeFilter", "stationDeptFilter", "stationStatusFilter"].forEach(function (id) { var field = document.getElementById(id); if (field) field.value = ""; });
    filteredStations = allStations.slice();
    renderTable();
  };

  window.stationLoad = function () {
    fetch("/api/stations")
      .then(function (response) { if (!response.ok) throw new Error("加载失败"); return response.json(); })
      .then(function (items) { allStations = items || []; filteredStations = allStations.slice(); renderTable(); })
      .catch(function () { allStations = []; filteredStations = []; renderTable(); });
  };

  addNavigation();
  app.register("station-management", pageHtml, ["station-management"]);
  app.pages["station-management"].onRender = stationLoad;
})();
