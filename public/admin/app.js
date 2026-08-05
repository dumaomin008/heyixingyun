/* ===================== SCRIPT BLOCK 1 (lines 656-737) ===================== */
// ========== Page Router ==========
var app = {
  currentPage: 'fence-list',
  pages: {},

  register: function(name, renderFn, navIds) {
    this.pages[name] = { render: renderFn, navIds: navIds || [name] };
  },

  navigate: function(page) {
    if (!this.pages[page]) return;
    if (page === this.currentPage) {
      if (window.location.hash !== '#' + page) window.location.hash = '#' + page;
      return;
    }
    this.currentPage = page;
    this.render();
    this.updateNav();
    window.location.hash = '#' + page;
    document.querySelector('.main').scrollTop = 0;
  },

  render: function() {
    var p = this.pages[this.currentPage];
    document.getElementById('mainContent').innerHTML = p ? p.render() : '';
    // Trigger post-render hooks
    if (p && p.onRender) p.onRender();
  },

  updateNav: function() {
    var self = this;
    var page = this.currentPage;
    // 子页高亮映射到母菜单下的入口
    var activePage = page;
    if (page === 'fence-edit') activePage = 'fence-list';
    if (page === 'trip-detail') activePage = 'circle-report';

    document.querySelectorAll('.nav-item').forEach(function(el) {
      var p = el.getAttribute('data-page');
      el.classList.toggle('active', p === activePage);
    });

    document.querySelectorAll('.nav-group').forEach(function(group) {
      var hasActive = !!group.querySelector('.nav-item.active');
      group.classList.toggle('has-active', hasActive);
      if (hasActive) group.classList.add('open');
    });
  },

  init: function() {
    var hashPage = window.location.hash.replace('#', '');
    if (hashPage && this.pages[hashPage]) {
      this.currentPage = hashPage;
    }
    this.render();
    this.updateNav();

    var self = this;
    document.querySelectorAll('.nav-item').forEach(function(el) {
      el.addEventListener('click', function() {
        var p = el.getAttribute('data-page');
        if (p && self.pages[p]) self.navigate(p);
      });
    });
    document.querySelectorAll('.nav-parent[data-toggle-group]').forEach(function(el) {
      el.addEventListener('click', function() {
        var group = el.closest('.nav-group');
        if (group) group.classList.toggle('open');
      });
    });
    window.addEventListener('hashchange', function() {
      var page = window.location.hash.replace('#', '');
      if (!page || !self.pages[page] || page === self.currentPage) return;
      self.currentPage = page;
      self.render();
      self.updateNav();
      document.querySelector('.main').scrollTop = 0;
    });
  }
};

// ========== Helper to open fence-edit with mode ==========
function openFenceEdit(action, code) {
  app.navigate('fence-edit');
  // Set mode via URL hash-like state
  window._fenceEditMode = action;
  window._fenceEditCode = code || '';
  // Re-render to pick up mode
  setTimeout(function() { app.render(); }, 10);
}

function goTripDetail(code, status) {
  window._tripDetailCode = code || 'QXC-20260720-0001';
  window._tripDetailStatus = status || 's';
  app.navigate('trip-detail');
}

/* ===================== SCRIPT BLOCK 2 (lines 744-917) ===================== */
app.register('fence-list', function() {
  return ''
  + '<div class="top-tabs">'
  + '<div class="tab-item active">电子围栏</div>'
  + '</div>'
  + '<div class="content-area">'
  + '<div class="breadcrumb"><a href="#">基础信息</a><span class="sep">/</span><span class="current">电子围栏</span></div>'
  + '<div class="page-header">'
  + '<div class="page-title">电子围栏 <span class="sub">管理装卸货点地址</span></div>'
  + '<div class="page-actions">'
  + '<button class="btn btn-primary" onclick="openFenceEdit(\'add\')">'
  + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
  + '新增围栏</button>'
  + '</div></div>'
  + buildFenceFilterHTML() + buildFenceTableHTML()
  + '</div>';
}, ['fence-list']);
app.pages['fence-list'].onRender = function() { filteredFenceData = (window.__fences || fenceData).slice(); fencePage = 1; buildFenceTable(); preloadFences(); };

// ===== Fence Data =====
var fenceData = [];

// 实际数据由启动时预加载的 window.__fences 填充（见文件底部 preload）
var filteredFenceData = [];
var fencePage = 1;
var fencePageSize = 20;

function applyFenceFilters() {
  var items = document.querySelectorAll('#fenceFilterPanel .filter-item');
  var fName = items[0].querySelector('input').value.trim();
  var fCode = items[1].querySelector('input').value.trim();
  var fType = items[2].querySelector('select').value;
  var fDept = items[3].querySelector('select').value;
  var fCat = items[4].querySelector('select').value;
  var fShare = items[5].querySelector('select').value;
  var fIo = items[6].querySelector('select').value;
  var fStatus = items[7].querySelector('select').value;

  filteredFenceData = (window.__fences || fenceData).filter(function(d) {
    if (fName && d.name.indexOf(fName) === -1) return false;
    if (fCode && d.code.indexOf(fCode) === -1) return false;
    if (fType !== '全部' && d.type !== fType) return false;
    if (fDept !== '全部' && d.dept !== fDept) return false;
    if (fCat !== '全部' && d.cat !== fCat) return false;
    if (fShare !== '全部' && d.share !== fShare) return false;
    if (fIo !== '全部' && d.ioType !== fIo) return false;
    if (fStatus !== '全部' && d.enableStatus !== fStatus) return false;
    return true;
  });
  fencePage = 1;
  buildFenceTable();
}

function resetFenceFilters() {
  var panel = document.getElementById('fenceFilterPanel');
  var inputs = panel.querySelectorAll('input.filter-control');
  var selects = panel.querySelectorAll('select.filter-control');
  for (var i = 0; i < inputs.length; i++) inputs[i].value = '';
  for (var j = 0; j < selects.length; j++) selects[j].value = '全部';
  filteredFenceData = (window.__fences || fenceData).slice();
  fencePage = 1;
  buildFenceTable();
}

function buildFenceFilterHTML() {
  return '<div class="filter-panel" id="fenceFilterPanel"><div class="filter-row">'
  + lt('区域名称','<input class="filter-control" type="text" placeholder="请输入区域名称">')
  + lt('区域编号','<input class="filter-control" type="text" placeholder="请输入区域编号">')
  + lt('区域类型','<select class="filter-control"><option>全部</option><option>点</option><option>面</option><option>线</option></select>')
  + lt('所属部门','<select class="filter-control"><option>全部</option><option>云南牧圣新能源科技有限公司</option></select>')
  + lt('类型','<select class="filter-control"><option>全部</option><option>仓库</option><option>工厂</option><option>门店</option><option>物流园</option></select>')
  + lt('共享模式','<select class="filter-control"><option>全部</option><option>部门</option><option>企业</option><option>公共</option></select>')
  + lt('收/发货类型','<select class="filter-control"><option>全部</option><option>收货区域</option><option>发货区域</option></select>')
  + lt('状态','<select class="filter-control"><option>全部</option><option>启用</option><option>停用</option></select>')
  + '</div><div class="filter-actions"><button class="btn btn-default" onclick="resetFenceFilters()">重置</button><button class="btn btn-primary" onclick="applyFenceFilters()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>查询</button></div></div>';
  function lt(l,c){ return '<div class="filter-item"><label class="filter-label">'+l+'</label>'+c+'</div>'; }
}

function buildFenceTableHTML() {
  var h = '<div class="table-section"><div class="table-toolbar"><div class="left">'
  + '<button class="toolbar-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>推送设置</button>'
  + '<button class="toolbar-btn" onclick="app.navigate(\'district-management\')">片区管理</button>'
  + '<span class="toolbar-sep"></span><button class="toolbar-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>导出</button>'
  + '<button class="toolbar-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>导入</button>'
  + '<span class="toolbar-sep"></span><button class="toolbar-btn" onclick="location.reload()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>刷新</button>'
  + '</div><div class="right"></div></div>'
  + '<div class="table-wrap"><table class="data-table"><thead><tr>'
  + '<th class="sticky-col col-seq">序号</th><th class="sticky-col">区域名称</th>'
  + '<th>区域编号</th><th>所属片区</th><th>区域类型</th><th>类型</th><th>收/发货类型</th><th>所属部门</th><th>共享模式</th>'
  + '<th>半径</th><th>经度</th><th>纬度</th><th>位置</th><th>所属省份</th>'
  + '<th>所属城市</th><th>所属区</th><th>备注</th><th>开通状态</th><th>账号</th>'
  + '<th>修改人</th><th>修改时间</th><th>启用状态</th><th>结算主体</th>'
  + '<th>装货时长（h）</th><th>卸货时长（h）</th><th>空驶单类型</th><th>司机津贴</th><th>高速线路</th>'
  + '<th class="sticky-col-r">操作</th>'
  + '</tr></thead><tbody id="fenceTableBody"></tbody></table></div>'
  + '<div class="pagination"><div class="pagination-info">共 <span id="fenceTotalCount">0</span> 条，第 <span id="fenceRangeFrom">1</span>-<span id="fenceRangeTo">20</span> 条，<span id="fencePageSize">20</span>条/页</div>'
  + '<div class="page-size"><span>每页</span><select id="fencePageSizeSelect" onchange="changeFencePageSize(this.value)"><option value="10">10</option><option value="20" selected>20</option><option value="50">50</option></select><span>条</span></div>'
  + '<div class="pagination-controls" id="fencePaginationControls"></div></div></div>';
  return h;
}

function buildFenceTable() {
  var total = filteredFenceData.length;
  var totalPages = Math.max(1, Math.ceil(total / fencePageSize) || 1);
  if (fencePage > totalPages) fencePage = totalPages;
  if (fencePage < 1) fencePage = 1;
  var start = (fencePage - 1) * fencePageSize;
  var end = Math.min(start + fencePageSize, total);
  var pageRows = filteredFenceData.slice(start, end);

  var tbody = document.getElementById('fenceTableBody');
  if (!tbody) return;
  var html = '';
  for (var i = 0; i < pageRows.length; i++) {
    var d = pageRows[i];
    var seq = start + i + 1;
    var owning = findOwningDistrict(d.code);
    var owningCell = owning ? '<td><span class="tooltip" title="' + owning.name + '（' + owning.type + '）">' + owning.name + '</span></td>' : '<td>—</td>';
    html += '<tr>'
    + '<td class="sticky-col col-seq">' + seq + '</td>'
    + '<td class="sticky-col" style="font-weight:500;">' + d.name + '</td>'
    + '<td class="col-mono">' + d.code + '</td>' + owningCell + '<td>' + d.type + '</td><td>' + d.cat + '</td><td>' + d.ioType + '</td>'
    + '<td>' + d.dept + '</td><td>' + d.share + '</td>'
    + '<td>' + d.radius + '</td>'
    + '<td class="col-mono">' + d.lng + '</td><td class="col-mono">' + d.lat + '</td>'
    + '<td><span class="tooltip" title="' + d.location + '">' + d.location + '</span></td>'
    + '<td>' + d.prov + '</td>'
    + '<td>' + d.city + '</td><td>' + d.dist + '</td>'
    + '<td>' + (d.remark || '—') + '</td>'
    + '<td>' + (d.openStatus === '未开通' ? '<span class="badge badge-warning">●未开通</span>' : d.openStatus) + '</td>'
    + '<td>' + d.account + '</td>'
    + '<td>' + d.modifier + '</td>'
    + '<td class="col-time">' + d.modifyTime + '</td>'
    + '<td>' + d.enableStatus + '</td>'
    + '<td>' + (d.settleBody || '—') + '</td>'
    + '<td>' + d.loadTime + '</td>'
    + '<td>' + d.unloadTime + '</td>'
    + '<td>' + (d.emptyType || '—') + '</td>'
    + '<td>' + d.allowance + '</td>'
    + '<td>' + (d.highway || '—') + '</td>'
    + '<td class="sticky-col-r"><a href="javascript:void(0)" class="link" onclick="openFenceEdit(\'edit\',\'' + d.code + '\')">修改</a><span style="color:var(--c-border-d);margin:0 4px;">|</span><a href="javascript:void(0)" class="btn-danger-text" onclick="deleteFence(\'' + d.code + '\',\'' + d.name + '\')">删除</a></td>'
    + '</tr>';
  }
  if (pageRows.length === 0) {
    html = '<tr><td class="empty-row" colspan="29" style="text-align:center;color:var(--c-text-3);padding:32px 0;">暂无匹配的电子围栏数据</td></tr>';
  }
  tbody.innerHTML = html;

  var totalEl = document.getElementById('fenceTotalCount');
  var pageEl = document.getElementById('fencePageSize');
  var fromEl = document.getElementById('fenceRangeFrom');
  var toEl = document.getElementById('fenceRangeTo');
  if (totalEl) totalEl.textContent = total;
  if (pageEl) pageEl.textContent = fencePageSize;
  if (fromEl) fromEl.textContent = total === 0 ? 0 : start + 1;
  if (toEl) toEl.textContent = end;
  renderFencePagination(totalPages);
}

function renderFencePagination(totalPages) {
  var box = document.getElementById('fencePaginationControls');
  if (!box) return;
  var html = '';
  html += '<button class="page-btn" ' + (fencePage <= 1 ? 'disabled' : '') + ' onclick="goFencePage(1)">&laquo;</button>';
  html += '<button class="page-btn" ' + (fencePage <= 1 ? 'disabled' : '') + ' onclick="goFencePage(' + (fencePage - 1) + ')">&lsaquo;</button>';
  var pages = [];
  if (totalPages <= 7) {
    for (var i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    var ps = Math.max(2, fencePage - 1);
    var pe = Math.min(totalPages - 1, fencePage + 1);
    if (ps > 2) pages.push('...');
    for (var j = ps; j <= pe; j++) pages.push(j);
    if (pe < totalPages - 1) pages.push('...');
    pages.push(totalPages);
  }
  for (var k = 0; k < pages.length; k++) {
    var p = pages[k];
    if (p === '...') {
      html += '<span class="page-ellipsis">…</span>';
    } else {
      html += '<button class="page-btn' + (p === fencePage ? ' active' : '') + '" onclick="goFencePage(' + p + ')">' + p + '</button>';
    }
  }
  html += '<button class="page-btn" ' + (fencePage >= totalPages ? 'disabled' : '') + ' onclick="goFencePage(' + (fencePage + 1) + ')">&rsaquo;</button>';
  html += '<button class="page-btn" ' + (fencePage >= totalPages ? 'disabled' : '') + ' onclick="goFencePage(' + totalPages + ')">&raquo;</button>';
  box.innerHTML = html;
}

function goFencePage(p) {
  var totalPages = Math.max(1, Math.ceil(filteredFenceData.length / fencePageSize) || 1);
  if (p < 1) p = 1;
  if (p > totalPages) p = totalPages;
  fencePage = p;
  buildFenceTable();
}

function changeFencePageSize(v) {
  fencePageSize = parseInt(v, 10) || 20;
  fencePage = 1;
  buildFenceTable();
}

function deleteFence(code, name) {
  if (!confirm('确定要删除围栏 "' + name + '（' + code + '）" 吗？\n此操作将同步到后端并永久删除。')) return;
  fetch('/api/fences/' + encodeURIComponent(code), { method: 'DELETE' })
    .then(function(r){ return r.json(); })
    .then(function(){ preloadFences(); })
    .catch(function(e){ alert('删除失败：' + e.message); });
}

/* ===================== 片区管理（对齐现网 pieceManage 列表交互） ===================== */
var districtData = [
  { id: 'D-YN-001', name: '云南趟次开始片区', type: '开始片区', fenceCodes: [], fenceNames: [], owner: '李调度', updated: '2026-07-22 16:20:00', note: '云南趟次起点装卸范围' },
  { id: 'D-YN-003', name: '云南趟次结束片区', type: '结束片区', fenceCodes: [], fenceNames: [], owner: '王磊', updated: '2026-07-21 10:18:00', note: '云南趟次终点装卸范围' }
];
var filteredDistrictData = districtData.slice();
var districtEditingId = '';
var districtSeededFromFences = false;
var districtSelected = {};

function districtTypeTag(type) {
  if (type === '开始片区') {
    return '<span class="district-type-tag district-type-start">开始片区</span>';
  }
  if (type === '结束片区') {
    return '<span class="district-type-tag district-type-end">结束片区</span>';
  }
  return '<span class="district-type-tag district-type-normal">' + (type || '未分类') + '</span>';
}
function districtFenceCount(d) {
  if (d.fenceCodes && d.fenceCodes.length) return d.fenceCodes.length;
  if (d.fenceNames && d.fenceNames.length) return d.fenceNames.length;
  return 0;
}
function districtFenceCell(d) {
  var names = d.fenceNames || [];
  var count = districtFenceCount(d);
  if (!count) return '<span class="district-fence-empty">-</span>';
  var preview = names.slice(0, 2).join('、') + (names.length > 2 ? '…' : '');
  var title = names.join('、');
  return '<span class="district-fence-cell tooltip" title="' + title + '"><strong class="district-fence-num">' + count + '</strong> 个地址'
    + (preview ? '<span class="district-fence-preview">（' + preview + '）</span>' : '') + '</span>';
}

function seedDistrictFencesFromPool() {
  if (districtSeededFromFences) return;
  var fences = window.__fences || [];
  if (!fences.length) return;
  districtSeededFromFences = true;
  var trips = window.__tripDetails || [];
  function fencesForRole(type) {
    var isStart = type === '开始片区';
    var expectedRole = isStart ? '发货区域' : '收货区域';
    var names = [];
    trips.forEach(function(trip) {
      var name = isStart ? (trip.startActual || trip.startPool) : (trip.endActual || trip.endPool);
      if (name && name !== '—' && names.indexOf(name) < 0) names.push(name);
    });
    var matched = fences.filter(function(fence) {
      return names.indexOf(fence.name) >= 0 && String(fence.ioType || '').indexOf(expectedRole) >= 0;
    });
    return matched.length ? matched : fences.filter(function(fence) {
      return String(fence.ioType || '').indexOf(expectedRole) >= 0;
    });
  }
  districtData.forEach(function(d) {
    var list = (d.type === '开始片区' || d.type === '结束片区') ? fencesForRole(d.type) : [];
    d.fenceCodes = list.map(function(f) { return f.code; });
    d.fenceNames = list.map(function(f) { return f.name; });
  });
}

/* —— 关联围栏选择器 —— */
var districtFencePicker = { selected: {}, keyword: '' };

function districtFencePool() {
  return window.__fences || fenceData || [];
}
function districtFenceByCode(code) {
  return districtFencePool().find(function(f) { return f.code === code; }) || null;
}
function initDistrictFencePicker(selectedCodes) {
  districtFencePicker.selected = {};
  districtFencePicker.keyword = '';
  (selectedCodes || []).forEach(function(c) { districtFencePicker.selected[c] = true; });
}
function districtFenceSelectedList() {
  return Object.keys(districtFencePicker.selected).filter(function(c) { return districtFencePicker.selected[c]; });
}
function districtFencePickerHTML() {
  return ''
    + '<div class="df-picker" id="districtFencePicker">'
    + '<div class="df-picker-toolbar">'
    + '<input id="districtFenceSearch" class="df-picker-search" type="text" placeholder="搜索电子围栏名称" oninput="onDistrictFenceSearch(this.value)">'
    + '</div>'
    + '<div class="df-picker-meta">'
    + '<span><span id="districtFencePickCount">已选 0 个</span><span class="df-pool-count" id="districtFencePoolCount"></span></span>'
    + '</div>'
    + '<div class="df-picker-chips" id="districtFenceChips"></div>'
    + '<div class="df-picker-list" id="districtFenceList"></div>'
    + '</div>';
}
function districtFenceMatches(f, kw) {
  if (!kw) return true;
  return String(f.name || '').toLowerCase().indexOf(kw) >= 0;
}
function renderDistrictFencePicker() {
  var listEl = document.getElementById('districtFenceList');
  var chipsEl = document.getElementById('districtFenceChips');
  var countEl = document.getElementById('districtFencePickCount');
  var poolEl = document.getElementById('districtFencePoolCount');
  if (!listEl) return;
  var fences = districtFencePool();
  var kw = (districtFencePicker.keyword || '').trim().toLowerCase();
  var selectedCodes = districtFenceSelectedList();
  if (countEl) countEl.textContent = '已选 ' + selectedCodes.length + ' 个';
  if (poolEl) poolEl.textContent = fences.length ? ' · 可选 ' + fences.length + ' 个（来自电子围栏）' : '';

  if (chipsEl) {
    if (!selectedCodes.length) {
      chipsEl.innerHTML = '<div class="df-chips-empty">尚未关联，请在下方电子围栏列表中勾选</div>';
    } else {
      chipsEl.innerHTML = selectedCodes.map(function(code) {
        var f = districtFenceByCode(code);
        var name = f ? f.name : code;
        var tip = f ? (f.name + (f.ioType ? ' · ' + f.ioType : '') + (f.location ? ' · ' + f.location : '')) : code;
        return '<span class="df-chip" title="' + tip + '">'
          + '<span class="df-chip-text">' + name + '</span>'
          + '<button type="button" class="df-chip-x" onclick="districtFenceToggle(\'' + code + '\', false)" aria-label="移除">&times;</button>'
          + '</span>';
      }).join('');
    }
  }

  if (!fences.length) {
    listEl.innerHTML = '<div class="df-list-empty">暂无电子围栏数据，请先在「围栏列表」维护地址后再关联</div>';
    return;
  }

  var rows = fences.filter(function(f) {
    return districtFenceMatches(f, kw);
  });
  // 已选置顶，其余按编码排序，方便浏览
  rows.sort(function(a, b) {
    var as = districtFencePicker.selected[a.code] ? 0 : 1;
    var bs = districtFencePicker.selected[b.code] ? 0 : 1;
    if (as !== bs) return as - bs;
    return String(a.code).localeCompare(String(b.code));
  });

  if (!rows.length) {
    listEl.innerHTML = '<div class="df-list-empty">没有匹配的围栏名称，试试换个关键词</div>';
    return;
  }

  listEl.innerHTML = rows.map(function(f) {
    var checked = !!districtFencePicker.selected[f.code];
    var loc = f.location || [f.prov, f.city, f.dist].filter(Boolean).join('') || '暂无地址';
    var io = f.ioType || '—';
    return '<label class="df-row' + (checked ? ' is-checked' : '') + '">'
      + '<input type="checkbox" class="districtFenceCb" value="' + f.code + '" data-name="' + f.name + '"'
      + (checked ? ' checked' : '') + ' onchange="districtFenceToggle(\'' + f.code + '\', this.checked)">'
      + '<span class="df-row-main">'
      + '<span class="df-row-name">' + f.name + '<span class="df-row-tag">' + io + '</span></span>'
      + '<span class="df-row-sub">' + loc + '</span>'
      + '</span></label>';
  }).join('');
}
function onDistrictFenceSearch(v) {
  districtFencePicker.keyword = v || '';
  renderDistrictFencePicker();
}
function districtFenceToggle(code, checked) {
  if (checked) districtFencePicker.selected[code] = true;
  else delete districtFencePicker.selected[code];
  renderDistrictFencePicker();
}

function districtSelectedIds() {
  return Object.keys(districtSelected).filter(function(id) { return districtSelected[id]; });
}
function districtNow() {
  var d = new Date();
  var p = function(n) { return n < 10 ? '0' + n : '' + n; };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

app.register('district-management', function() {
  return ''
  + '<div class="top-tabs">'
  + '<div class="tab-item" onclick="app.navigate(\'fence-list\')">电子围栏</div><div class="tab-item active">片区管理</div></div>'
  + '<div class="content-area district-page">'
  + '<div class="breadcrumb"><a href="#" onclick="app.navigate(\'fence-list\');return false;">基础信息</a><span class="sep">/</span><a href="#" onclick="app.navigate(\'fence-list\');return false;">电子围栏</a><span class="sep">/</span><span class="current">片区管理</span></div>'
  + '<div class="page-header district-page-header"><div><div class="page-title">片区管理 <span class="sub">按装卸货业务区域归集电子围栏，统一维护趟次起终点口径</span></div><div class="district-overview" id="districtOverview">正在载入片区归集概况…</div></div><div class="page-actions"><button class="btn btn-primary" onclick="openDistrictModal()">新增片区</button></div></div>'
  + buildDistrictFilterHTML()
  + buildDistrictTableHTML()
  + '</div>';
}, ['district-management']);

app.pages['district-management'].onRender = function() {
  districtSelected = {};
  var render = function() {
    seedDistrictFencesFromPool();
    filteredDistrictData = districtData.slice();
    renderDistrictTable();
  };
  if (window.__fences && window.__fences.length) render();
  else preloadFences().then(render);
};

function buildDistrictFilterHTML() {
  return '<div class="filter-panel" id="districtFilterPanel"><div class="filter-row">'
  + '<div class="filter-item"><label class="filter-label">片区名称</label><input id="districtKeyword" class="filter-control" type="text" placeholder="请输入片区名称" onkeydown="if(event.key===\'Enter\') applyDistrictFilters()"></div>'
  + '<div class="filter-item"><label class="filter-label">片区类型</label><select id="districtTypeFilter" class="filter-control"><option value="全部">全部</option><option value="开始片区">开始片区</option><option value="结束片区">结束片区</option></select></div>'
  + '</div><div class="filter-actions"><button class="btn btn-default" onclick="resetDistrictFilters()">重置</button><button class="btn btn-primary" onclick="applyDistrictFilters()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>查询</button></div></div>';
}

function buildDistrictTableHTML() {
  return '<div class="table-section district-table-section">'
  + '<div class="table-toolbar district-toolbar"><div class="left district-toolbar-hint">勾选后可批量操作</div><div class="right district-icon-actions">'
  + '<button class="btn btn-default btn-compact" onclick="districtToolbarLog()">查看日志</button>'
  + '<button class="btn btn-default btn-compact" onclick="districtToolbarEdit()">批量编辑</button>'
  + '<button class="btn btn-default btn-compact" onclick="districtToolbarExport()">导出列表</button>'
  + '<button class="btn btn-default btn-compact btn-danger-text" onclick="districtToolbarDelete()">删除</button>'
  + '</div></div>'
  + '<div class="table-wrap"><table class="data-table district-table"><thead><tr>'
  + '<th class="col-check"><input type="checkbox" id="districtHeadCheck" onclick="toggleDistrictSelectAll(this.checked)" aria-label="选择全部片区"></th>'
  + '<th class="col-seq">序号</th><th>片区名称</th><th>片区类型</th><th>关联围栏地址</th><th>备注</th><th>修改人</th><th>修改时间</th><th class="sticky-col-r">操作</th>'
  + '</tr></thead><tbody id="districtTableBody"></tbody></table></div>'
  + '<div class="pagination"><div class="pagination-info">共 <span id="districtTotalCount">0</span> 条</div>'
  + '<div class="pagination-controls"><button class="page-btn" disabled>&laquo;</button><button class="page-btn active">1</button><button class="page-btn" disabled>&raquo;</button></div></div></div>';
}

function districtMatches(d) {
  var keyword = ((document.getElementById('districtKeyword') || {}).value || '').trim();
  var type = (document.getElementById('districtTypeFilter') || {}).value || '全部';
  if (keyword && d.name.indexOf(keyword) < 0) return false;
  if (type !== '全部' && (d.type || '') !== type) return false;
  return true;
}

function applyDistrictFilters() {
  filteredDistrictData = districtData.filter(districtMatches);
  renderDistrictTable();
}

function resetDistrictFilters() {
  var keyword = document.getElementById('districtKeyword');
  var type = document.getElementById('districtTypeFilter');
  if (keyword) keyword.value = '';
  if (type) type.value = '全部';
  filteredDistrictData = districtData.slice();
  renderDistrictTable();
}

function toggleDistrictSelectAll(checked) {
  filteredDistrictData.forEach(function(d) { districtSelected[d.id] = !!checked; });
  renderDistrictTable();
}

function toggleDistrictRow(id, checked) {
  districtSelected[id] = !!checked;
  var head = document.getElementById('districtHeadCheck');
  if (head) {
    var ids = filteredDistrictData.map(function(d) { return d.id; });
    var all = ids.length > 0 && ids.every(function(id) { return districtSelected[id]; });
    var some = ids.some(function(id) { return districtSelected[id]; });
    head.checked = all;
    head.indeterminate = some && !all;
  }
}

function renderDistrictTable() {
  var body = document.getElementById('districtTableBody');
  if (!body) return;
  body.innerHTML = filteredDistrictData.map(function(d, index) {
    var checked = districtSelected[d.id] ? ' checked' : '';
    return '<tr>'
      + '<td class="col-check"><input type="checkbox" onclick="toggleDistrictRow(\'' + d.id + '\', this.checked)"' + checked + '></td>'
      + '<td class="col-seq">' + (index + 1) + '</td>'
      + '<td class="district-name">' + d.name + '</td>'
      + '<td>' + districtTypeTag(d.type || '') + '</td>'
      + '<td>' + districtFenceCell(d) + '</td>'
      + '<td><span class="tooltip" title="' + (d.note || '') + '">' + (d.note || '—') + '</span></td>'
      + '<td>' + (d.owner || '—') + '</td>'
      + '<td class="col-time">' + (d.updated || '—') + '</td>'
      + '<td class="sticky-col-r"><a class="link" href="javascript:void(0)" onclick="openDistrictModal(\'' + d.id + '\')">编辑</a><span class="district-action-sep">|</span><a class="link btn-danger-text" href="javascript:void(0)" onclick="deleteDistrict(\'' + d.id + '\')">删除</a></td>'
      + '</tr>';
  }).join('') || '<tr><td colspan="9" class="district-empty">暂无片区数据，点击右上角「+」新增</td></tr>';
  var total = document.getElementById('districtTotalCount'); if (total) total.textContent = filteredDistrictData.length;
  var overview = document.getElementById('districtOverview');
  if (overview) {
    var fenceCount = districtData.reduce(function(total, d) { return total + ((d.fenceCodes || []).length); }, 0);
    overview.textContent = '共 ' + districtData.length + ' 个片区，已归集 ' + fenceCount + ' 个围栏；当前展示 ' + filteredDistrictData.length + ' 条结果';
  }
  var head = document.getElementById('districtHeadCheck');
  if (head) {
    var ids = filteredDistrictData.map(function(d) { return d.id; });
    var all = ids.length > 0 && ids.every(function(id) { return districtSelected[id]; });
    var some = ids.some(function(id) { return districtSelected[id]; });
    head.checked = all;
    head.indeterminate = some && !all;
  }
}

function districtToolbarLog() {
  var ids = districtSelectedIds();
  if (ids.length !== 1) { alert('请勾选一条片区查看日志'); return; }
  var item = districtData.find(function(d) { return d.id === ids[0]; });
  if (!item) return;
  var logs = item.logs || [
    { time: item.updated || districtNow(), user: item.owner || '李调度', action: '修改', detail: '更新片区信息' },
    { time: '2026-07-15 09:20:00', user: item.owner || '李调度', action: '新增', detail: '创建片区「' + item.name + '」' }
  ];
  var rows = logs.map(function(l, i) {
    return '<tr><td class="col-seq">' + (i + 1) + '</td><td class="col-time">' + l.time + '</td><td>' + l.user + '</td><td>' + l.action + '</td><td>' + l.detail + '</td></tr>';
  }).join('');
  var overlay = document.getElementById('districtLogModal');
  if (overlay) overlay.parentNode.removeChild(overlay);
  document.body.insertAdjacentHTML('beforeend',
    '<div class="modal-overlay show" id="districtLogModal">'
    + '<div class="modal district-modal" style="width:720px;">'
    + '<div class="modal-header"><div class="modal-title">操作日志 · ' + item.name + '（' + item.id + '）</div>'
    + '<button class="modal-close" onclick="closeDistrictLogModal()" aria-label="关闭">&times;</button></div>'
    + '<div class="modal-body"><div class="table-wrap"><table class="data-table"><thead><tr><th class="col-seq">序号</th><th>操作时间</th><th>操作人</th><th>操作类型</th><th>操作内容</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>'
    + '<div class="modal-footer"><button class="btn btn-primary" onclick="closeDistrictLogModal()">关闭</button></div>'
    + '</div></div>');
}
function closeDistrictLogModal() {
  var m = document.getElementById('districtLogModal');
  if (m) m.parentNode.removeChild(m);
}
function districtToolbarEdit() {
  var ids = districtSelectedIds();
  if (ids.length !== 1) { alert('请勾选一条片区进行编辑'); return; }
  openDistrictModal(ids[0]);
}
function districtToolbarDelete() {
  var ids = districtSelectedIds();
  if (!ids.length) { alert('请先勾选要删除的片区'); return; }
  if (!confirm('确定删除选中的 ' + ids.length + ' 个片区吗？')) return;
  districtData = districtData.filter(function(d) { return ids.indexOf(d.id) < 0; });
  ids.forEach(function(id) { delete districtSelected[id]; });
  saveDistricts();
  applyDistrictFilters();
  showDistrictToast('已删除 ' + ids.length + ' 个片区');
}
function districtToolbarExport() {
  exportTableAsCsv('.district-table', '片区管理列表');
}
function deleteDistrict(id) {
  var item = districtData.find(function(d) { return d.id === id; });
  if (!item) return;
  if (!confirm('确定删除片区「' + item.name + '」吗？')) return;
  districtData = districtData.filter(function(d) { return d.id !== id; });
  delete districtSelected[id];
  saveDistricts();
  applyDistrictFilters();
  showDistrictToast('已删除「' + item.name + '」');
}

function openDistrictModal(id) {
  districtEditingId = id || '';
  var item = id ? districtData.find(function(d) { return d.id === id; }) : null;

  function fillAndShow() {
    var modal = document.getElementById('districtModal');
    // 旧版弹窗强制重建
    if (modal && (!document.getElementById('districtFencePicker') || document.querySelector('.district-form-hint') || document.querySelector('.df-picker-actions'))) {
      modal.parentNode.removeChild(modal);
      modal = null;
    }
    if (!modal) {
      document.body.insertAdjacentHTML('beforeend',
        '<div class="modal-overlay" id="districtModal"><div class="modal district-modal district-modal-lg">'
        + '<div class="modal-header"><div class="modal-title" id="districtModalTitle">新增片区</div><button class="modal-close" onclick="closeDistrictModal()" aria-label="关闭">&times;</button></div>'
        + '<div class="modal-body"><div class="form-grid form-grid-modal">'
        + '<div class="form-item"><label class="form-label">片区名称 <span class="req">*</span></label><input id="districtFormName" class="form-control-text" maxlength="30" placeholder="请输入片区名称"></div>'
        + '<div class="form-item"><label class="form-label">片区类型 <span class="req">*</span></label><select id="districtFormType" class="form-control-text"><option value="开始片区">开始片区</option><option value="结束片区">结束片区</option></select></div>'
        + '<div class="form-item"><label class="form-label">备注</label><input id="districtFormNote" class="form-control-text" maxlength="80" placeholder="选填"></div>'
        + '<div class="form-item full"><label class="form-label">关联电子围栏地址</label>'
        + districtFencePickerHTML()
        + '</div></div></div>'
        + '<div class="modal-footer"><button class="btn btn-default" onclick="closeDistrictModal()">取消</button><button class="btn btn-primary" onclick="saveDistrictModal()">保存</button></div>'
        + '</div></div>');
      modal = document.getElementById('districtModal');
    }
    document.getElementById('districtModalTitle').textContent = item ? '编辑片区' : '新增片区';
    document.getElementById('districtFormName').value = item ? item.name : '';
    document.getElementById('districtFormType').value = item ? (item.type || '开始片区') : '开始片区';
    document.getElementById('districtFormNote').value = item ? (item.note || '') : '';
    initDistrictFencePicker(item ? (item.fenceCodes || []) : []);
    var search = document.getElementById('districtFenceSearch');
    if (search) search.value = '';
    renderDistrictFencePicker();
    modal.classList.add('show');
  }

  // 确保复用最新电子围栏数据
  if (window.__fences && window.__fences.length) {
    fillAndShow();
  } else {
    preloadFences().then(fillAndShow);
  }
}

function closeDistrictModal() { var modal = document.getElementById('districtModal'); if (modal) modal.classList.remove('show'); }

function saveDistrictModal() {
  var name = document.getElementById('districtFormName').value.trim();
  if (!name) { alert('请填写片区名称'); return; }
  var type = document.getElementById('districtFormType').value || '开始片区';
  var code = districtEditingId || ('D-' + Date.now());
  var fenceCodes = districtFenceSelectedList();
  var fenceNames = fenceCodes.map(function(c) {
    var f = districtFenceByCode(c);
    return f ? f.name : c;
  });
  var payload = {
    id: code,
    name: name,
    type: type,
    note: document.getElementById('districtFormNote').value.trim() || '—',
    owner: '李调度',
    updated: districtNow(),
    fenceCodes: fenceCodes,
    fenceNames: fenceNames
  };
  if (districtEditingId) {
    var index = districtData.findIndex(function(d) { return d.id === districtEditingId; });
    if (index >= 0) {
      var prev = districtData[index];
      payload.logs = (prev.logs || []).slice();
      payload.logs.unshift({ time: payload.updated, user: payload.owner, action: '修改', detail: '更新片区信息（关联 ' + fenceCodes.length + ' 个围栏）' });
      districtData[index] = Object.assign({}, prev, payload);
    }
  } else {
    payload.logs = [{ time: payload.updated, user: payload.owner, action: '新增', detail: '创建片区「' + name + '」' }];
    districtData.unshift(payload);
  }
  closeDistrictModal();
  saveDistricts(); // 持久化围栏↔片区关联（与围栏页双向同步）
  applyDistrictFilters();
  showDistrictToast(districtEditingId ? '片区信息已更新' : '片区已创建');
}

function showDistrictToast(message) {
  showAppToast(message);
}

function showAppToast(message) {
  var toast = document.getElementById('appToast');
  if (!toast) { document.body.insertAdjacentHTML('beforeend', '<div class="app-toast" id="appToast"><span id="appToastText"></span></div>'); toast = document.getElementById('appToast'); }
  document.getElementById('appToastText').textContent = message;
  toast.classList.add('show');
  window.clearTimeout(window._appToastTimer);
  window._appToastTimer = window.setTimeout(function() { toast.classList.remove('show'); }, 2600);
}

function exportTableAsCsv(selector, filename) {
  var table = document.querySelector(selector);
  if (!table) return;
  var escapeCsv = function(value) { return '"' + String(value || '').replace(/"/g, '""') + '"'; };
  var lines = [Array.prototype.map.call(table.querySelectorAll('thead th'), function(cell) { return escapeCsv(cell.textContent.trim()); }).join(',')];
  Array.prototype.forEach.call(table.querySelectorAll('tbody tr'), function(row) {
    if (row.style.display === 'none') return;
    lines.push(Array.prototype.map.call(row.querySelectorAll('td'), function(cell) { return escapeCsv(cell.textContent.trim()); }).join(','));
  });
  var blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = filename + '-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showAppToast('已导出当前列表');
}

/* ===================== SCRIPT BLOCK 3 (lines 924-1276) ===================== */
app.register('fence-edit', function() {
  var isEdit = window._fenceEditMode === 'edit';
  var code = window._fenceEditCode || '';
  var title = isEdit ? '编辑电子围栏' : '新增电子围栏';
  var modeTag = isEdit ? ' (修改模式 - 变更将生成新配置版本)' : '';

  var html = ''
  + '<div class="top-tabs">'
  + '<div class="tab-item active">电子围栏</div></div>'
  + '<div class="content-split">'

  // Map
  + '<div class="map-panel"><div class="map-search-bar"><input type="text" placeholder="输入地址后请核对坐标"></div>'
  + '<div class="map-header"><div class="map-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>围栏定位预览 <span class="map-title-hint">保存前请核验地址、经纬度与半径</span></div>'
  + '<div class="map-actions"><button class="map-btn" onclick="zoomIn()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg></button>'
  + '<button class="map-btn" onclick="zoomOut()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg></button></div></div>'
  + '<div class="map-container" id="fenceMapContainer" onclick="onFenceMapClick(event)"><div class="map-tile"></div>'
  + '<div class="fence-circle" id="fenceFormCircle" style="display:none;"><div class="center-dot"></div><div class="radius-label" id="fenceRadiusLabel">500m</div></div>'
  + '<div class="coord-popup" id="fenceCoordPopup">Lng: <span class="val" id="fencePopLng">—</span> &nbsp;Lat: <span class="val" id="fencePopLat">—</span></div></div>'
  + '<div class="map-footer"><span>围栏中心坐标</span><span class="coord-display">Lng: <strong id="fenceDisplayLng">—</strong> &nbsp;Lat: <strong id="fenceDisplayLat">—</strong></span><span>半径: <strong id="fenceDisplayRadius">—</strong>m</span></div></div>'

  // Form
  + '<div class="form-panel"><div class="form-header"><div class="form-title">' + title + '<span style="font-size:12px;font-weight:400;color:var(--c-text-3);margin-left:8px;">' + modeTag + '</span></div></div>'
  + '<div class="form-body">'

  // Section 1
  + '<div class="form-section"><div class="form-section-title"><span class="section-icon"></span>基础信息</div>'
  + '<div class="form-grid col-2">'
  + fi('围栏名称','<input class="form-control-text" id="fenceName" type="text" placeholder="请输入围栏名称" maxlength="50">',true)
  + fi('围栏编码','<input class="form-control-text" id="fenceCode" type="text" placeholder="自动生成或手动输入" maxlength="20">',true)
  + fi('区域类型','<select class="form-control-text" id="areaType" onchange="onAreaTypeChange()"><option value="point">点</option><option value="area">面</option></select>',true)
  + fi('类型','<select class="form-control-text" id="fCat"><option>物流点</option><option>仓库</option><option>中转站</option></select>')
  + fi('收/发货类型','<select class="form-control-text" id="fIoType"><option>发货</option><option>收货</option><option>收发货</option></select>')
  + fi('所属部门','<select class="form-control-text" id="orgSelect"><option>云南运输事业部</option><option>玉溪分公司</option><option>昆明分公司</option></select>',true)
  + fi('共享模式','<select class="form-control-text" id="fShare"><option>专属</option><option>共享</option></select>')
  + fi('结算主体','<select class="form-control-text" id="fSettle"><option>云南创维新能源汽车</option></select>')
  + '</div></div>'

  // Section 2
  + '<div class="form-section"><div class="form-section-title"><span class="section-icon"></span>位置信息</div>'
  + '<div class="form-grid col-2">'
  + fi('经度坐标','<input class="form-control-text" id="fenceLng" type="text" placeholder="如 102.478">')
  + fi('纬度坐标','<input class="form-control-text" id="fenceLat" type="text" placeholder="如 24.919">')
  + fi('半径（米）','<input class="form-control-text" id="fenceRadiusInput" type="number" value="500" min="50" max="5000" onchange="updateFenceMapCircle()">')
  + fi('位置','<input class="form-control-text" id="fLocation" type="text" placeholder="自动解析或手动输入详细地址">')
  + fi('所属省份','<select class="form-control-text" id="fProv" onchange="onProvinceChange(this.value)"><option value="">请选择</option><option value="云南省">云南省</option></select>')
  + fi('所属城市','<select class="form-control-text" id="citySelect" onchange="onCityChange(this.value)"><option value="">请选择省份</option></select>')
  + fi('所属区','<select class="form-control-text" id="districtSelect"><option value="">请选择城市</option></select>')
  + fi('备注','<input class="form-control-text" id="fRemark" type="text" placeholder="选填" maxlength="200">')
  + '</div></div>'

  // Section 3: 运营参数（趟次角色已迁移至片区管理，围栏仅维护地址）
  + '<div class="form-section"><div class="form-section-title"><span class="section-icon"></span>运营参数</div>'
  + '<div class="form-grid col-2">'
  + fi('装货时长（h）','<input class="form-control-text" id="fLoadTime" type="number" value="1" min="0" step="0.5">')
  + fi('卸货时长（h）','<input class="form-control-text" id="fUnloadTime" type="number" value="1" min="0" step="0.5">')
  + fi('空驶单类型','<select class="form-control-text" id="fEmptyType"><option>禁止空驶</option><option>允许空驶</option><option>限制空驶</option></select>')
  + fi('司机津贴','<select class="form-control-text" id="fAllowance"><option>无</option><option>30元/趟</option><option>50元/趟</option><option>80元/趟</option></select>')
  + fi('高速线路','<input class="form-control-text" id="fHighway" type="text" placeholder="如 昆安高速" maxlength="100">')
  + fi('开通状态','<select class="form-control-text" id="fOpenStatus"><option>已开通</option><option>未开通</option></select>')
  + fi('启用状态','<select class="form-control-text" id="enableStatus"><option>启用</option><option>停用</option></select>',true)
  + fi('账号','<input class="form-control-text" id="fAccount" type="text" placeholder="关联账号（选填）">')
  + '</div></div>'

  + '</div>'

  + '<div class="form-footer"><button class="btn btn-default" onclick="app.navigate(\'fence-list\')">取消</button>'
  + '<button class="btn btn-primary" onclick="submitFenceForm(' + isEdit + ')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>保存</button></div>'
  + '</div></div>';

  function fi(l, c, req) {
    return '<div class="form-item"><label class="form-label">' + l + (req ? ' <span class="req">*</span>' : '') + '</label>' + c + '</div>';
  }

  return html;
}, ['fence-edit']);

// Fence edit post-render hook
app.pages['fence-edit'].onRender = function() {
  var isEdit = window._fenceEditMode === 'edit';
  if (isEdit) {
    var code = window._fenceEditCode;
    if (code) {
      fetch('/api/fences/' + encodeURIComponent(code))
        .then(function(r){ return r.json(); })
        .then(function(f){ if (f && !f.error) populateFenceForm(f); })
        .catch(function(e){ console.error('加载围栏失败', e); });
    }
  } else {
    setTimeout(function() {
      var now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      var eti = document.getElementById('effectiveTime'); if (eti) eti.value = now.toISOString().slice(0, 16);
      setTimeout(updateFenceMapCircle, 200);
    }, 0);
  }
};

// Fence form JS
var fenceCenter = { lng: 102.478, lat: 24.919 }, fenceRadius = 500;

function onFenceMapClick(e) {
  var rect = document.getElementById('fenceMapContainer').getBoundingClientRect();
  var x = e.clientX - rect.left, y = e.clientY - rect.top;
  var lng = (102.0 + (x / rect.width) * 1.0).toFixed(3);
  var lat = (24.92 - (y / rect.height) * 1.0).toFixed(3);
  fenceCenter.lng = parseFloat(lng); fenceCenter.lat = parseFloat(lat);
  var lngEl = document.getElementById('fenceLng'); if (lngEl) lngEl.value = lng;
  var latEl = document.getElementById('fenceLat'); if (latEl) latEl.value = lat;
  updateFenceMapCircle();
  var popup = document.getElementById('fenceCoordPopup');
  var popLng = document.getElementById('fencePopLng'), popLat = document.getElementById('fencePopLat');
  if (popup && popLng && popLat) {
    popLng.textContent = lng; popLat.textContent = lat;
    popup.style.display = 'block';
    popup.style.left = Math.min(x + 10, rect.width - 180) + 'px';
    popup.style.top = Math.max(y - 40, 0) + 'px';
    setTimeout(function() { popup.style.display = 'none'; }, 2000);
  }
}

function updateFenceMapCircle() {
  var container = document.getElementById('fenceMapContainer');
  if (!container) return;
  var rad = parseInt((document.getElementById('fenceRadiusInput') || {}).value) || 500;
  fenceRadius = rad;
  var rect = container.getBoundingClientRect();
  if (rect.width === 0) return;
  var mapLngMin = 102.0, mapLngMax = 103.0, mapLatMin = 23.6, mapLatMax = 24.92;
  var cx = ((fenceCenter.lng - mapLngMin) / (mapLngMax - mapLngMin)) * rect.width;
  var cy = ((mapLatMax - fenceCenter.lat) / (mapLatMax - mapLatMin)) * rect.height;
  var lngPerPx = (mapLngMax - mapLngMin) / rect.width;
  var pxPerMeter = 0.00001 / lngPerPx * 110000;
  var r = Math.max(30, rad * pxPerMeter);
  var circle = document.getElementById('fenceFormCircle');
  if (circle) {
    circle.style.display = 'block';
    circle.style.width = (r * 2) + 'px'; circle.style.height = (r * 2) + 'px';
    circle.style.left = (cx - r) + 'px'; circle.style.top = (cy - r) + 'px';
  }
  var rl = document.getElementById('fenceRadiusLabel'); if (rl) rl.textContent = rad + 'm';
  var dl = document.getElementById('fenceDisplayLng'); if (dl) dl.textContent = fenceCenter.lng.toFixed(3);
  var dlt = document.getElementById('fenceDisplayLat'); if (dlt) dlt.textContent = fenceCenter.lat.toFixed(3);
  var dr = document.getElementById('fenceDisplayRadius'); if (dr) dr.textContent = rad;
}

function zoomIn() { fenceRadius = Math.max(50, fenceRadius - 100); var r = document.getElementById('fenceRadiusInput'); if (r) r.value = fenceRadius; updateFenceMapCircle(); }
function zoomOut() { fenceRadius = Math.min(5000, fenceRadius + 100); var r = document.getElementById('fenceRadiusInput'); if (r) r.value = fenceRadius; updateFenceMapCircle(); }

function onAreaTypeChange() { /* 区域类型切换：围栏不再配置趟次角色 */ }

var cityMap = { '云南省': ['昆明市', '玉溪市', '曲靖市', '红河州', '大理州'] };
var districtMap = { '昆明市': ['安宁市', '五华区', '盘龙区', '官渡区', '西山区'], '玉溪市': ['红塔区', '江川区', '通海县', '华宁县', '易门县', '峨山县', '新平县', '元江县'] };

function onProvinceChange(val) {
  var city = document.getElementById('citySelect'), dist = document.getElementById('districtSelect');
  if (!val) { city.innerHTML = '<option value="">请选择省份</option>'; dist.innerHTML = '<option value="">请选择城市</option>'; return; }
  var cities = cityMap[val] || [];
  city.innerHTML = '<option value="">请选择</option>' + cities.map(function(c){ return '<option>' + c + '</option>'; }).join('');
  dist.innerHTML = '<option value="">请选择城市</option>';
}

function onCityChange(val) {
  var dist = document.getElementById('districtSelect');
  if (!val) { dist.innerHTML = '<option value="">请选择城市</option>'; return; }
  var dists = districtMap[val] || [];
  dist.innerHTML = '<option value="">请选择</option>' + dists.map(function(d){ return '<option>' + d + '</option>'; }).join('');
}

function parseAllowance(v){ if(!v) return 0; var m = String(v).match(/\d+/); return m ? parseInt(m[0],10) : 0; }

// 设置下拉值（选项不存在时自动补一个，避免数据丢失）
function setSelectValue(sel, val) {
  if (!sel || val == null) return;
  val = String(val);
  var found = false;
  for (var i = 0; i < sel.options.length; i++) {
    if (sel.options[i].value === val || sel.options[i].text === val) { found = true; sel.selectedIndex = i; break; }
  }
  if (!found) {
    var opt = document.createElement('option');
    opt.value = val; opt.text = val; sel.appendChild(opt); sel.value = val;
  }
}

// 根据围栏编码反查其所属片区（district）；围栏本身不维护趟次角色，角色由片区承载
function findOwningDistrict(fenceCode) {
  if (!fenceCode) return null;
  if (typeof seedDistrictFencesFromPool === 'function') seedDistrictFencesFromPool();
  for (var i = 0; i < districtData.length; i++) {
    var codes = districtData[i].fenceCodes || [];
    if (codes.indexOf(fenceCode) >= 0) return districtData[i];
  }
  return null;
}

// 将耗时字符串统一换算为 h 展示（支持 "3d 12h15m" / "12h 15min" / "—" 等混合格式）
function toHours(str) {
  if (!str || str === '—') return '—';
  var s = String(str);
  var days = 0, hours = 0, mins = 0;
  var dM = s.match(/(\d+)\s*[d天]/); if (dM) days = parseInt(dM[1], 10);
  var hM = s.match(/(\d+(?:\.\d+)?)\s*[h时]/); if (hM) hours = parseFloat(hM[1]);
  var mM = s.match(/(\d+)\s*[m分]/); if (mM) mins = parseInt(mM[1], 10);
  var total = days * 24 + hours + mins / 60;
  if (!(total > 0)) return '—';
  return (Number.isInteger(total) ? String(total) : total.toFixed(1)) + 'h';
}

// 用后端返回的围栏数据回填表单（编辑模式）
function populateFenceForm(f) {
  var set = function(id, v){ var el = document.getElementById(id); if (el) el.value = (v == null ? '' : v); };
  set('fenceName', f.name);
  set('fenceCode', f.code);
  set('fenceLng', f.lng);
  set('fenceLat', f.lat);
  set('fLocation', f.location);
  set('fRemark', f.remark);
  set('fLoadTime', f.loadTime);
  set('fUnloadTime', f.unloadTime);
  set('fHighway', f.highway);
  set('fAccount', f.account);

  var at = document.getElementById('areaType');
  if (at) at.value = (f.type === '面') ? 'area' : 'point';

  setSelectValue(document.getElementById('fCat'), f.cat);
  setSelectValue(document.getElementById('fIoType'), f.ioType);
  setSelectValue(document.getElementById('fShare'), f.share);
  setSelectValue(document.getElementById('fSettle'), f.settleBody);
  setSelectValue(document.getElementById('fEmptyType'), f.emptyType);
  setSelectValue(document.getElementById('fOpenStatus'), f.openStatus);
  setSelectValue(document.getElementById('orgSelect'), f.dept);
  setSelectValue(document.getElementById('enableStatus'), f.enableStatus);

  var allowMap = {0:'无',30:'30元/趟',50:'50元/趟',80:'80元/趟',100:'100元/趟',150:'150元/趟',200:'200元/趟'};
  setSelectValue(document.getElementById('fAllowance'), allowMap[f.allowance] != null ? allowMap[f.allowance] : String(f.allowance));

  if (f.prov) { setSelectValue(document.getElementById('fProv'), f.prov); onProvinceChange(f.prov); }
  if (f.city) { var csel = document.getElementById('citySelect'); if (csel) csel.value = f.city; onCityChange(f.city); }
  if (f.dist) { var dsel = document.getElementById('districtSelect'); if (dsel) dsel.value = f.dist; }

  setTimeout(updateFenceMapCircle, 200);
}

function submitFenceForm(isEdit) {
  var get = function(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; };
  var name = get('fenceName');
  var code = get('fenceCode');
  if (!name) { alert('请输入围栏名称'); return; }
  if (!code) { alert('请输入围栏编码'); return; }
  var areaTypeEl = document.getElementById('areaType');
  var areaTypeVal = areaTypeEl ? areaTypeEl.value : 'point';
  var typeMap = { point: '点', area: '面' };

  var payload = {
    name: name,
    code: code,
    type: typeMap[areaTypeVal] || '点',
    cat: get('fCat'),
    ioType: get('fIoType'),
    dept: get('orgSelect'),
    share: get('fShare'),
    role: '不参与趟次',
    radius: parseInt(get('fenceRadiusInput'), 10) || 0,
    lng: get('fenceLng'),
    lat: get('fenceLat'),
    location: get('fLocation'),
    prov: get('fProv'),
    city: (document.getElementById('citySelect') || {}).value || '',
    dist: (document.getElementById('districtSelect') || {}).value || '',
    remark: get('fRemark'),
    openStatus: get('fOpenStatus'),
    account: get('fAccount') || '李调度',
    enableStatus: (document.getElementById('enableStatus') || {}).value || '启用',
    settleBody: get('fSettle'),
    loadTime: parseFloat(get('fLoadTime')) || 0,
    unloadTime: parseFloat(get('fUnloadTime')) || 0,
    emptyType: get('fEmptyType'),
    allowance: parseAllowance(get('fAllowance')),
    highway: get('fHighway')
  };

  var urlCode = isEdit ? window._fenceEditCode : code;
  var url = isEdit ? ('/api/fences/' + encodeURIComponent(urlCode)) : '/api/fences';
  var method = isEdit ? 'PUT' : 'POST';

  fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    .then(function(r){ return r.json(); })
    .then(function(){
      preloadFences();
      alert((isEdit ? '修改' : '新增') + '成功！围栏「' + name + '」已' + (isEdit ? '更新' : '保存') + '并同步到后端。');
      app.navigate('fence-list');
    })
    .catch(function(e){ alert('保存失败：' + e.message); });
}

/* ===================== SCRIPT BLOCK 4 (lines 1283-1649) ===================== */
app.register('circle-report', function() {
  return ''
  + '<div style="padding:20px 24px 40px;">'
  + '<div class="breadcrumb"><a href="#">报表中心</a><span class="sep">/</span><span class="current">趟次统计报表</span></div>'
  + '<div class="page-header"><div class="page-title">趟次统计报表 <span class="sub">同一辆车从趟次起点地址池到趟次终点地址池计为1个趟次</span></div></div>'

  + buildCircleFilterHTML()
  + buildCircleTableHTML()
  + '</div>';
}, ['circle-report']);

// Post-render hook: 绑定筛选联动事件
app.pages['circle-report'].onRender = function() {
  initCirclePointSelects();   // 依据当前片区配置刷新起点/终点下拉（消除两套真相源）
  var s = document.getElementById('circle-start');
  var e = document.getElementById('circle-end');

  // 初始联动：给终点下拉绑定 initial 状态
  if (s && e && s.value) {
    onStartPointChange();
  }

  // 用预加载的真实趟次数据刷新计数与分页
  if (window.__tripSummaries && window.__tripSummaries.length) doCircleSearch();
};

function buildCircleFilterHTML() {
  return '<div class="filter-panel" id="circleFilterPanel"><div class="filter-row">'
  + fl('统计时间','<div style="display:flex;gap:8px;"><input id="circle-date-from" class="filter-control date-pick" type="text" value="2026-07-01" placeholder="YYYY-MM-DD" style="flex:1;" readonly><span style="line-height:34px;color:var(--c-text-3);">至</span><input id="circle-date-to" class="filter-control date-pick" type="text" value="2026-07-20" placeholder="YYYY-MM-DD" style="flex:1;" readonly></div>', 'filter-item filter-item-date-range')
  + fl('车辆','<input id="circle-vehicle" class="filter-control" type="text" placeholder="输入车牌号查询" oninput="onCircleVehicleInput()">')
  + fl('司机','<input id="circle-driver" class="filter-control" type="text" placeholder="输入司机姓名查询" oninput="onCircleDriverInput()">')
  + fl('实际趟次起点','<select id="circle-start" class="filter-control" onchange="onStartPointChange()"><option value="">全部趟次起点</option></select>')
  + fl('实际趟次终点','<select id="circle-end" class="filter-control" onchange="onEndPointChange()"><option value="">全部趟次终点</option></select>')
  + fl('趟次状态','<select id="circle-status" class="filter-control"><option value="">全部状态</option><option value="s">已完成</option><option value="p">进行中</option></select>')
  + fl('趟次开始时间','<input id="circle-start-date" class="filter-control date-pick" type="text" value="2026-07-01" placeholder="YYYY-MM-DD" readonly>')
  + fl('趟次结束时间','<input id="circle-end-date" class="filter-control date-pick" type="text" value="2026-07-20" placeholder="YYYY-MM-DD" readonly>')
  + '</div><div class="filter-actions"><button class="btn btn-default" onclick="doCircleReset()">重置</button><button class="btn btn-primary" onclick="doCircleSearch()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>查询</button><button class="btn btn-default" onclick="doCircleExport()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>导出</button></div></div>';
  function fl(l,c,cls){ return '<div class="'+(cls || 'filter-item')+'"><label class="filter-label">'+l+'</label>'+c+'</div>'; }
}




function buildCircleTableHTML() {
  var h = '<div class="table-section">'
  + '<div class="table-wrap"><table class="data-table"><thead>'
  + '<tr><th class="sticky-col">日期</th><th>趟次编号</th><th>本车月内序号</th><th>车辆（主车-挂车）</th><th>司机</th><th>开始点</th><th>结束点</th><th>趟次状态</th><th>趟次开始时间</th><th>趟次结束时间</th><th>趟次耗时</th><th>装货时效</th><th>卸货时效</th><th>行驶时效</th><th>充电等待时效</th><th>充电时效</th><th>任务明细数</th><th>总里程</th><th class="col-money">趟次运费</th><th class="col-money">司机收入</th><th class="sticky-col-r">操作</th></tr></thead>'
  + '<tbody>';

  // 数据由启动时预加载的 window.__tripSummaries 提供（见文件底部 preload）
  var circleRows = (window.__tripSummaries || []);

  function b(type) {
    var m = {s:'<span class="badge badge-success">已完成</span>',p:'<span class="badge badge-primary">进行中</span>',w:'<span class="badge badge-success">已完成</span>',qp:'<span class="badge badge-success">已完成</span>'};
    return m[type]||'';
  }
  function mv(v) { return (v==='mx'||v==='—')?'<span class="text-muted">—</span>':(v==='e'?'<span class="text-error">—</span>':v); }
  function fh(v) { return typeof v==='number' ? v+'h' : mv(v); }
  function tripDuration(start, end) {
    if (!start || !end || start === '—' || end === '—') return '<span class="text-muted">—</span>';
    var begin = new Date(start.replace(/-/g, '/'));
    var finish = new Date(end.replace(/-/g, '/'));
    if (!isFinite(begin.getTime()) || !isFinite(finish.getTime()) || finish < begin) return '<span class="text-muted">—</span>';
    var hours = Math.round((finish - begin) / 360000) / 10;
    return hours + 'h';
  }

  var vehicleMonthOrder = buildCircleVehicleMonthOrder(circleRows);
  circleRows.forEach(function(r) {
    var vehicle = getCircleVehicleDisplay(r[0], r[1]);
    var monthlyOrder = vehicleMonthOrder[r[0]];
    var stMap = {s:'completed', p:'in-progress', w:'manual-end', qp:'recalculated', gy:'expired'};
    var catMap = {s:'s', p:'p', w:'s', qp:'s', gy:'p'};
    h += '<tr data-vehicle="' + vehicle + '" data-driver="' + r[2] + '" data-start-point="' + r[3] + '" data-end-point="' + (r[4]==='—'?'':r[4]) + '" data-status-code="' + r[5] + '" data-start-time="' + r[6] + '" data-end-time="' + r[7] + '" data-status="' + (stMap[r[5]] || '') + '" data-status-cat="' + (catMap[r[5]] || '') + '">'
    + '<td class="sticky-col"><span class="col-time">' + (r[7] && r[7] !== '—' ? r[7].split(' ')[0] : (r[6] && r[6] !== '—' ? r[6].split(' ')[0] : '—')) + '</span></td>'
    + '<td><span class="col-num">' + r[0] + '</span></td>'
    + '<td><span style="display:inline-block;padding:2px 10px;background:#eff6ff;color:#1e40af;border-radius:10px;font-size:12px;font-weight:600;">' + (monthlyOrder ? '本车第 ' + monthlyOrder + ' 趟' : '—') + '</span></td>'
    + '<td class="text-mono">' + vehicle + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td><td>' + (r[4]==='—'?'<span class="text-muted">—</span>':r[4]) + '</td><td>' + b(r[5]) + '</td>'
    + '<td class="col-time">' + r[6] + '</td><td class="col-time">' + (r[7]==='—'?'<span class="text-muted">—</span>':r[7]) + '</td>'
    + '<td class="col-duration">' + tripDuration(r[6], r[7]) + '</td>'
    + '<td>' + fh(r[9]) + '</td><td>' + fh(r[10]) + '</td><td>' + fh(r[11]) + '</td><td>' + fh(getTripChargeWaitingHours(r[0])) + '</td><td>' + fh(r[12]) + '</td>'
    + '<td>' + getCircleTaskCount(r[0], r[13]) + '</td><td>' + r[14] + '</td>'
    + fareCells(r[0])
    + '<td class="sticky-col-r"><a href="javascript:void(0)" class="link" onclick="goTripDetail(\'' + r[0] + '\',\'' + r[5] + '\')">查看明细</a></td>'
    + '</tr>';
  });

  var initialCount = circleRows.length;
  h += '</tbody></table></div>'
  + '<div class="pagination"><div class="pagination-info">共 ' + initialCount + ' 条记录，当前第 ' + (initialCount ? '1-' + initialCount : '0') + ' 条</div>'
  + '<div class="pagination-controls"><button class="page-btn" disabled>‹</button><button class="page-btn active">1</button><button class="page-btn" disabled>›</button></div></div></div>';
  return h;
}

// 趟次统计报表 - 趟次运费 / 司机收入（从趟次明细累计）
// 趟次运费 = 该趟次所有运输任务运费之和；司机收入 = 运费之和 × 司机分成系数
function getCircleTaskCount(code, fallback) {
  var detail = (window.__tripDetails || []).find(function(item) { return item.code === code; });
  if (!detail || !detail.tasks) return fallback;
  var hasEmptyTask = detail.tasks.some(function(task) { return task.taskType === '装货空驶单'; });
  return detail.tasks.length + (hasEmptyTask ? 0 : 1);
}

function fareCells(code) {
  var rate = (window.__fareSettings && typeof window.__fareSettings.driverRate === 'number') ? window.__fareSettings.driverRate : 0.2;
  var dt = (window.__tripDetails || []).find(function(x){ return x.code === code; });
  var fare = 0, income = 0;
  if (dt && dt.tasks) {
    dt.tasks.forEach(function(tk){ var f = getTaskFare(tk); fare += f; income += f * rate; });
  }
  income = Math.round(income * 100) / 100;
  return '<td class="col-money">' + (fare ? fare.toLocaleString('zh-CN') : '0') + '</td>'
    + '<td class="col-money income">' + (income ? income.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00') + '</td>';
}

// ===== 趟次统计报表 - 筛选联动逻辑 =====

// 车辆以趟次汇总为唯一映射来源，详情和任务明细均按趟次编号回填，避免旧数据中的车辆别名造成错配。
var circleVehicleProfiles = {
  '云A·K12345': { display: '云A12345-云F12345挂', driver: '张建国' },
  '云A·K67890': { display: '云A67890-云F67890挂', driver: '李伟' },
  '云A·K90123': { display: '云A90123-云F90123挂', driver: '王强' },
  '云A·K34567': { display: '云A34567-云F34567挂', driver: '赵明' }
};
var circleTripVehicleByCode = {};

function normalizeCircleVehicleDisplay(vehicle) {
  if (!vehicle || vehicle === '—') return '—';
  if (circleVehicleProfiles[vehicle]) return circleVehicleProfiles[vehicle].display;
  if (String(vehicle).indexOf('-') >= 0) return vehicle;
  var matched = String(vehicle).match(/^云A[·]?K?(\d+)$/);
  return matched ? '云A' + matched[1] + '-云F' + matched[1] + '挂' : vehicle;
}

function buildCircleTripVehicleMap() {
  circleTripVehicleByCode = {};
  (window.__tripSummaries || []).forEach(function(row) {
    if (row && row[0]) circleTripVehicleByCode[row[0]] = normalizeCircleVehicleDisplay(row[1]);
  });
}

function getCircleVehicleDisplay(code, fallback) {
  return circleTripVehicleByCode[code] || normalizeCircleVehicleDisplay(fallback);
}

function buildCircleVehicleMonthOrder(rows) {
  var groups = {}, orderByCode = {};
  (rows || []).forEach(function(row) {
    var vehicle = getCircleVehicleDisplay(row[0], row[1]);
    if (!groups[vehicle]) groups[vehicle] = [];
    groups[vehicle].push(row);
  });
  Object.keys(groups).forEach(function(vehicle) {
    groups[vehicle].sort(function(a, b) {
      var aTime = new Date(String(a[6] || '').replace(/-/g, '/')).getTime() || 0;
      var bTime = new Date(String(b[6] || '').replace(/-/g, '/')).getTime() || 0;
      return aTime - bTime || String(a[0]).localeCompare(String(b[0]));
    });
    groups[vehicle].forEach(function(row, index) { orderByCode[row[0]] = index + 1; });
  });
  return orderByCode;
}

var circleVehicleDriverMap = {};
Object.keys(circleVehicleProfiles).forEach(function(vehicle) {
  circleVehicleDriverMap[circleVehicleProfiles[vehicle].display] = circleVehicleProfiles[vehicle].driver;
});
var circleDriverVehicleMap = {};
(function(){ for(var k in circleVehicleDriverMap) circleDriverVehicleMap[circleVehicleDriverMap[k]]=k; })();

// 起点/终点数据动态取自「片区管理」，避免与片区类型维护形成两套真相源
function getCircleStartPointNames() {
  var list = [];
  (districtData || []).forEach(function(d) {
    if ((d.type || '') === '开始片区' && d.fenceCodes) {
      d.fenceCodes.forEach(function(c) {
        var f = (typeof districtFenceByCode === 'function') ? districtFenceByCode(c) : null;
        if (f && f.name) list.push(f.name);
      });
    }
  });
  list = list.filter(function(v, i) { return list.indexOf(v) === i; });
  if (!list.length) list = ['安宁昆钢','玉溪水电志达混凝土有限公司','玉溪仙福钢铁(集团)有限公司','玉溪研和化肥厂','玉溪大开门水渣装货地'];
  return list;
}
function getCircleEndPointNames() {
  var list = [];
  (districtData || []).forEach(function(d) {
    if ((d.type || '') === '结束片区' && d.fenceCodes) {
      d.fenceCodes.forEach(function(c) {
        var f = (typeof districtFenceByCode === 'function') ? districtFenceByCode(c) : null;
        if (f && f.name) list.push(f.name);
      });
    }
  });
  list = list.filter(function(v, i) { return list.indexOf(v) === i; });
  if (!list.length) list = ['峨山鑫钰公司货场','峨山贵州佳俊矿业','化念铁精粉卸货地','杨武铁精粉下货点','易门白土卸货地','玉昆卸货点','元江干坝片区(锰矿卸货点)'];
  return list;
}
// 宽松联动：趟次按车辆实际轨迹识别，不预设「起点×终点」配对，每个起点可配对所有终点
function buildCircleStartEndMap() {
  var map = {};
  var starts = getCircleStartPointNames();
  var ends = getCircleEndPointNames();
  starts.forEach(function(s) { map[s] = ends.slice(); });
  return map;
}
function fillSelectOptions(sel, names) {
  if (!sel) return;
  var cur = sel.value;
  sel.innerHTML = '<option value="">' + (sel.id === 'circle-start' ? '全部趟次起点' : '全部趟次终点') + '</option>';
  names.forEach(function(n) { sel.innerHTML += '<option value="'+n+'">'+n+'</option>'; });
  if (cur && names.indexOf(cur) >= 0) sel.value = cur;
}
// 进入报表页时，依据当前片区配置刷新起点/终点下拉
function initCirclePointSelects() {
  fillSelectOptions(document.getElementById('circle-start'), getCircleStartPointNames());
  fillSelectOptions(document.getElementById('circle-end'), getCircleEndPointNames());
}

// 车辆 ↔ 司机联动
function onCircleVehicleInput() {
  var v = document.getElementById('circle-vehicle');
  var d = document.getElementById('circle-driver');
  if (!v || !d) return;
  var driver = circleVehicleDriverMap[v.value.trim()];
  if (driver) d.value = driver;
}

function onCircleDriverInput() {
  var d = document.getElementById('circle-driver');
  var v = document.getElementById('circle-vehicle');
  if (!d || !v) return;
  var vehicle = circleDriverVehicleMap[d.value.trim()];
  if (vehicle) v.value = vehicle;
}

// 趟次起点 → 趟次终点联动
function onStartPointChange() {
  var start = document.getElementById('circle-start');
  var end = document.getElementById('circle-end');
  if (!start || !end) return;
  var val = start.value;
  var map = buildCircleStartEndMap();
  var targets = val ? (map[val] || getCircleEndPointNames()) : getCircleEndPointNames();
  var curEnd = end.value;
  end.innerHTML = '<option value="">全部趟次终点</option>';
  for (var i=0; i<targets.length; i++) {
    end.innerHTML += '<option value="'+targets[i]+'">'+targets[i]+'</option>';
  }
  // 如果当前终点仍在候选中则保留，否则重置
  if (curEnd && targets.indexOf(curEnd) >= 0) end.value = curEnd;
}

function onEndPointChange() {
  var end = document.getElementById('circle-end');
  var start = document.getElementById('circle-start');
  if (!end || !start) return;
  // 双向：选终点后，起点只显示有该终点的起点（宽松联动下即全部起点）
  var val = end.value;
  if (!val) {
    // 恢复全部起点
    var allStarts = getCircleStartPointNames();
    start.innerHTML = '<option value="">全部趟次起点</option>';
    for (var i=0; i<allStarts.length; i++) {
      start.innerHTML += '<option value="'+allStarts[i]+'">'+allStarts[i]+'</option>';
    }
    start.value = '';
    return;
  }
  var map = buildCircleStartEndMap();
  var filteredStarts = [];
  for (var sk in map) {
    if (map[sk].indexOf(val) >= 0) filteredStarts.push(sk);
  }
  start.innerHTML = '<option value="">全部趟次起点</option>';
  for (var i=0; i<filteredStarts.length; i++) {
    start.innerHTML += '<option value="'+filteredStarts[i]+'">'+filteredStarts[i]+'</option>';
  }
  if (start.value && filteredStarts.indexOf(start.value) < 0) start.value = '';
}

// 核心筛选函数
function doCircleSearch() {
  var rows = document.querySelectorAll('.data-table tbody tr');
  if (!rows.length) return;

  // 读取筛选条件
  var dateFrom = (document.getElementById('circle-date-from')||{}).value || '';
  var dateTo = (document.getElementById('circle-date-to')||{}).value || '';
  var vehicle = ((document.getElementById('circle-vehicle')||{}).value || '').trim();
  var driver = ((document.getElementById('circle-driver')||{}).value || '').trim();
  var startPt = (document.getElementById('circle-start')||{}).value || '';
  var endPt = (document.getElementById('circle-end')||{}).value || '';
  var status = (document.getElementById('circle-status')||{}).value || '';
  var startDate = (document.getElementById('circle-start-date')||{}).value || '';
  var endDate = (document.getElementById('circle-end-date')||{}).value || '';

  var visibleCnt = 0;

  rows.forEach(function(r) {
    var show = true;
    var dv = r.getAttribute('data-vehicle') || '';
    var dd = r.getAttribute('data-driver') || '';
    var dsp = r.getAttribute('data-start-point') || '';
    var dep = r.getAttribute('data-end-point') || '';
    var dsc = r.getAttribute('data-status-code') || '';
    var dcat = r.getAttribute('data-status-cat') || '';
    var dst = r.getAttribute('data-start-time') || '';
    var det = r.getAttribute('data-end-time') || '';

    // 车辆过滤（模糊匹配）
    if (vehicle && dv.indexOf(vehicle) < 0) show = false;
    // 司机过滤（模糊匹配）
    if (show && driver && dd.indexOf(driver) < 0) show = false;
    // 趟次起点过滤
    if (show && startPt && dsp !== startPt) show = false;
    // 趟次终点过滤
    if (show && endPt && dep !== endPt) show = false;
    // 趟次状态过滤
    if (show && status && dcat !== status) show = false;
    // 统计时间范围（基于结束时间日期；进行中趟次无结束时间则回退到开始时间）
    if (show && dateFrom) {
      var ed = det !== '—' ? det.split(' ')[0] : (dst !== '—' ? dst.split(' ')[0] : '');
      if (!ed || ed < dateFrom) show = false;
    }
    if (show && dateTo) {
      var ed = det !== '—' ? det.split(' ')[0] : (dst !== '—' ? dst.split(' ')[0] : '');
      if (!ed || ed > dateTo) show = false;
    }
    // 趟次开始时间过滤
    if (show && startDate) {
      var sd = dst !== '—' ? dst.split(' ')[0] : '';
      if (!sd || sd < startDate) show = false;
    }
    // 趟次结束时间过滤（进行中趟次无结束时间则回退到开始时间判断）
    if (show && endDate) {
      var ed = det !== '—' ? det.split(' ')[0] : (dst !== '—' ? dst.split(' ')[0] : '');
      if (!ed || ed > endDate) show = false;
    }

    r.style.display = show ? '' : 'none';
    if (show) visibleCnt++;
  });

  // 更新分页信息
  var pg = document.querySelector('.pagination-info');
  if (pg) pg.textContent = '共 ' + visibleCnt + ' 条记录，当前第 ' + (visibleCnt ? '1-' + visibleCnt : '0') + ' 条';
}

// 重置筛选
function doCircleReset() {
  var df = document.getElementById('circle-date-from'); if (df) df.value = '2026-07-01';
  var dt = document.getElementById('circle-date-to'); if (dt) dt.value = '2026-07-20';
  var v = document.getElementById('circle-vehicle'); if (v) v.value = '';
  var d = document.getElementById('circle-driver'); if (d) d.value = '';
  var s = document.getElementById('circle-start');
  if (s) fillSelectOptions(s, getCircleStartPointNames());
  var e = document.getElementById('circle-end');
  if (e) fillSelectOptions(e, getCircleEndPointNames());
  var st = document.getElementById('circle-status'); if (st) st.value = '';
  var sd = document.getElementById('circle-start-date'); if (sd) sd.value = '2026-07-01';
  var ed = document.getElementById('circle-end-date'); if (ed) ed.value = '2026-07-20';
  doCircleSearch();
}

function doCircleExport() {
  var filters = getCircleExportFilters();
  var rows = getFilteredCircleRows(filters);
  if (!rows.length) { showAppToast('当前筛选条件下没有可导出的趟次'); return; }

  var rate = (window.__fareSettings && typeof window.__fareSettings.driverRate === 'number') ? window.__fareSettings.driverRate : 0.2;
  var totalMileage = 0, totalFare = 0, totalIncome = 0;
  var statusCount = { completed: 0, progress: 0 };
  var summaryRows = [[
    '日期', '趟次编号', '本车月内序号', '车辆（主车-挂车）', '司机', '开始点', '结束点', '趟次状态',
    '趟次开始时间', '趟次结束时间', '趟次耗时（h）', '装货时效（h）', '卸货时效（h）', '行驶时效（h）', '充电等待时效（h）', '充电时效（h）',
    '任务明细数', '总里程（km）', '趟次运费（元）', '司机收入（元）'
  ]];
  var taskSheetRows = [[
    '趟次编号', '任务顺序', '任务单号', '任务单类型', '运输线路', '货物', '实际起点', '实际终点', '车辆（主车-挂车）', '主司机',
    '装货到达', '装货离开', '卸货到达', '卸货离开', '任务完成时间', '装货时效（h）', '卸货时效（h）', '充电时效（h）', '行驶时效（h）', '充电等待时效（h）',
    '卸货重量（t）', '单价（元/t）', '运费（元）', '司机收入（元）', '明细类型'
  ]];

  rows.forEach(function(row) {
    var code = row[0];
    var trip = (window.__tripDetails || []).find(function(item) { return item.code === code; }) || {};
    hydrateTripTaskDetails(trip);
    var finance = getCircleFareSummary(code);
    var taskCount = getCircleTaskCount(code, row[13]);
    var mileage = Number(row[14]) || 0;
    var statusText = getCircleStatusText(row[5]);
    var durationHours = getCircleDurationHours(row[6], row[7]);
    var monthlyOrder = buildCircleVehicleMonthOrder(rows)[code] || '—';

    totalMileage += mileage;
    totalFare += finance.fare;
    totalIncome += finance.income;
    if (row[5] === 'p' || row[5] === 'gy') statusCount.progress += 1;
    else statusCount.completed += 1;

    summaryRows.push([
      getCircleRowDate(row), code, '本车第 ' + monthlyOrder + ' 趟', getCircleVehicleDisplay(code, row[1]), row[2], row[3], row[4], statusText,
      row[6], row[7], durationHours === null ? '—' : durationHours, exportMetric(row[9]), exportMetric(row[10]), exportMetric(row[11]), getTripChargeWaitingHours(code), exportMetric(row[12]),
      taskCount, row[14] === '—' ? '—' : mileage, finance.fare, finance.income
    ]);

    (trip.tasks || []).forEach(function(task) {
      var taskFare = getTaskFare(task);
      var rowNumber = taskSheetRows.length + 1;
      var isEmptyTask = task.taskType === '装货空驶单';
      taskSheetRows.push([
        code, task.seq || '—', task.taskId || '—', getCircleTaskType(task), task.route || '—', task.goods || '—', task.from || '—', task.to || '—',
        getCircleVehicleDisplay(code, trip.vehicle), task.driver || row[2], task.loadArr || '—', task.loadLeave || '—', task.unloadArr || '—', task.unloadLeave || '—', task.complete || '—',
        task.loadEff || '—', task.unloadEff || '—', task.chargeEff || '—', task.driveEff || '—', task.chargeWaitEff || '—',
        isEmptyTask ? '—' : Number(task.unloadWeight) || '—', isEmptyTask ? '—' : Number(task.unitPrice) || '—',
        isEmptyTask ? 0 : { formula: 'U' + rowNumber + '*V' + rowNumber, value: taskFare }, Math.round(taskFare * rate * 100) / 100, task.typeTag || '—'
      ]);
    });
  });

  var overviewRows = [
    ['趟次统计报表导出说明'], [],
    ['导出时间', formatCircleExportTime(new Date())],
    ['统计时间', circleExportRange(filters.dateFrom, filters.dateTo)],
    ['车辆', filters.vehicle || '全部'], ['司机', filters.driver || '全部'], ['实际趟次起点', filters.startPt || '全部'], ['实际趟次终点', filters.endPt || '全部'],
    ['趟次状态', filters.status ? (filters.status === 's' ? '已完成' : '进行中') : '全部'], ['趟次开始时间', circleExportRange(filters.startDate, '')], ['趟次结束时间', circleExportRange('', filters.endDate)], [],
    ['导出趟次数', rows.length], ['任务明细数', taskSheetRows.length - 1], ['已完成趟次', statusCount.completed], ['进行中趟次', statusCount.progress],
    ['总里程（km）', Math.round(totalMileage * 10) / 10], ['总运费（元）', Math.round(totalFare * 100) / 100], ['司机收入（元）', Math.round(totalIncome * 100) / 100], [],
    ['说明', '“任务运输明细”按趟次编号关联；运费=卸货重量×单价，空驶单运费为0。']
  ];

  var workbook = buildCircleExportWorkbook([
    { name: '导出说明', rows: overviewRows, filter: false, widths: [20, 56] },
    { name: '趟次统计', rows: summaryRows, filter: true, widths: [14, 22, 14, 22, 12, 22, 22, 12, 18, 18, 15, 14, 14, 14, 16, 14, 14, 14, 15, 15] },
    { name: '任务运输明细', rows: taskSheetRows, filter: true, widths: [22, 10, 22, 14, 36, 14, 24, 24, 22, 12, 18, 18, 18, 18, 18, 14, 14, 14, 14, 16, 14, 16, 14, 15, 14] }
  ]);
  var filename = '趟次统计报表_' + (filters.dateFrom || '全部').replace(/-/g, '') + '-' + (filters.dateTo || '全部').replace(/-/g, '') + '.xlsx';
  downloadCircleExportWorkbook(workbook, filename);
  showAppToast('已导出 ' + rows.length + ' 个趟次及 ' + (taskSheetRows.length - 1) + ' 条任务明细');
}

function getCircleExportFilters() {
  return {
    dateFrom: (document.getElementById('circle-date-from') || {}).value || '', dateTo: (document.getElementById('circle-date-to') || {}).value || '',
    vehicle: ((document.getElementById('circle-vehicle') || {}).value || '').trim(), driver: ((document.getElementById('circle-driver') || {}).value || '').trim(),
    startPt: (document.getElementById('circle-start') || {}).value || '', endPt: (document.getElementById('circle-end') || {}).value || '',
    status: (document.getElementById('circle-status') || {}).value || '', startDate: (document.getElementById('circle-start-date') || {}).value || '',
    endDate: (document.getElementById('circle-end-date') || {}).value || ''
  };
}

function getFilteredCircleRows(filters) {
  return (window.__tripSummaries || []).filter(function(row) {
    var vehicle = getCircleVehicleDisplay(row[0], row[1]);
    var endOrStartDate = row[7] !== '—' ? String(row[7]).split(' ')[0] : (row[6] !== '—' ? String(row[6]).split(' ')[0] : '');
    var startDate = row[6] !== '—' ? String(row[6]).split(' ')[0] : '';
    var statusCategory = (row[5] === 'p' || row[5] === 'gy') ? 'p' : 's';
    return (!filters.vehicle || vehicle.indexOf(filters.vehicle) >= 0)
      && (!filters.driver || String(row[2]).indexOf(filters.driver) >= 0)
      && (!filters.startPt || row[3] === filters.startPt)
      && (!filters.endPt || row[4] === filters.endPt)
      && (!filters.status || statusCategory === filters.status)
      && (!filters.dateFrom || (endOrStartDate && endOrStartDate >= filters.dateFrom))
      && (!filters.dateTo || (endOrStartDate && endOrStartDate <= filters.dateTo))
      && (!filters.startDate || (startDate && startDate >= filters.startDate))
      && (!filters.endDate || (endOrStartDate && endOrStartDate <= filters.endDate));
  });
}

function getCircleFareSummary(code) {
  var rate = (window.__fareSettings && typeof window.__fareSettings.driverRate === 'number') ? window.__fareSettings.driverRate : 0.2;
  var trip = (window.__tripDetails || []).find(function(item) { return item.code === code; }) || {};
  hydrateTripTaskDetails(trip);
  var fare = (trip.tasks || []).reduce(function(sum, task) { return sum + getTaskFare(task); }, 0);
  return { fare: Math.round(fare * 100) / 100, income: Math.round(fare * rate * 100) / 100 };
}

function getCircleDurationHours(start, end) {
  if (!start || !end || start === '—' || end === '—') return null;
  var begin = new Date(String(start).replace(/-/g, '/')).getTime();
  var finish = new Date(String(end).replace(/-/g, '/')).getTime();
  return isFinite(begin) && isFinite(finish) && finish >= begin ? Math.round((finish - begin) / 360000) / 10 : null;
}

function getCircleStatusText(status) {
  return status === 'p' || status === 'gy' ? '进行中' : '已完成';
}
function getCircleTaskType(task) {
  return task.taskType || (task.typeTag === '开始任务' ? '装货空驶单' : '直达任务单');
}
function getCircleRowDate(row) {
  return row[7] && row[7] !== '—' ? String(row[7]).split(' ')[0] : (row[6] && row[6] !== '—' ? String(row[6]).split(' ')[0] : '—');
}
function exportMetric(value) { return typeof value === 'number' ? value : '—'; }
function getTripChargeWaitingHours(code) {
  var trip = (window.__tripDetails || []).find(function(item) { return item.code === code; }) || {};
  var sessions = trip.chargingSessions || [];
  if (!sessions.length) {
    sessions = (trip.tasks || []).reduce(function(all, task) {
      return all.concat(task.chargingSessions || []);
    }, []);
  }
  var total = 0;
  var hasValidSession = false;
  sessions.forEach(function(session) {
    var hours = getChargingWaitHours(session.enteredFenceAt, session.chargeStartedAt);
    if (hours !== null) {
      total += hours;
      hasValidSession = true;
    }
  });
  return hasValidSession ? Math.round(total * 10) / 10 : '—';
}

// 充电等待时长的唯一口径：开始充电时间 − 进入充电站电子围栏时间。
// 充电会话可挂在趟次（chargingSessions）或任务（chargingSessions）上；
// 每条会话需包含 enteredFenceAt 与 chargeStartedAt 两个时间点。
function getChargingWaitHours(enteredFenceAt, chargeStartedAt) {
  var enteredAt = parseTripDetailDate(enteredFenceAt);
  var startedAt = parseTripDetailDate(chargeStartedAt);
  if (!enteredAt || !startedAt || startedAt < enteredAt) return null;
  return Math.round(((startedAt - enteredAt) / 3600000) * 10) / 10;
}

function getTaskChargeWaitingHours(trip, task) {
  var sessions = (task && task.chargingSessions) || [];
  if (!sessions.length && trip && trip.chargingSessions && task) {
    sessions = trip.chargingSessions.filter(function(session) { return session.taskId === task.taskId; });
  }
  var total = 0;
  var hasValidSession = false;
  sessions.forEach(function(session) {
    var hours = getChargingWaitHours(session.enteredFenceAt, session.chargeStartedAt);
    if (hours !== null) {
      total += hours;
      hasValidSession = true;
    }
  });
  return hasValidSession ? Math.round(total * 10) / 10 : null;
}
function circleExportRange(start, end) { return start && end ? start + ' 至 ' + end : (start || end || '全部'); }
function formatCircleExportTime(date) {
  var pad = function(value) { return String(value).padStart(2, '0'); };
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}

// 轻量 XLSX 生成器：仅使用浏览器原生能力，确保原型可直接导出多工作表 Excel。
function buildCircleExportWorkbook(sheets) {
  var encoder = new TextEncoder();
  var files = [];
  var workbookSheets = [];
  var workbookRels = [];
  var contentOverrides = [];

  sheets.forEach(function(sheet, index) {
    var sheetId = index + 1;
    files.push({ name: 'xl/worksheets/sheet' + sheetId + '.xml', data: encoder.encode(buildCircleExportSheetXml(sheet)) });
    workbookSheets.push('<sheet name="' + escapeCircleXml(sheet.name) + '" sheetId="' + sheetId + '" r:id="rId' + sheetId + '"/>');
    workbookRels.push('<Relationship Id="rId' + sheetId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + sheetId + '.xml"/>');
    contentOverrides.push('<Override PartName="/xl/worksheets/sheet' + sheetId + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>');
  });
  workbookRels.push('<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>');

  files.push({ name: '[Content_Types].xml', data: encoder.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' + contentOverrides.join('') + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>') });
  files.push({ name: '_rels/.rels', data: encoder.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>') });
  files.push({ name: 'xl/workbook.xml', data: encoder.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + workbookSheets.join('') + '</sheets></workbook>') });
  files.push({ name: 'xl/_rels/workbook.xml.rels', data: encoder.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + workbookRels.join('') + '</Relationships>') });
  files.push({ name: 'xl/styles.xml', data: encoder.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1" xfId="0"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs></styleSheet>') });
  files.push({ name: 'docProps/core.xml', data: encoder.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>TMS运输管理后台</dc:creator><dc:title>趟次统计报表</dc:title><dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString() + '</dcterms:created></cp:coreProperties>') });
  files.push({ name: 'docProps/app.xml', data: encoder.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>TMS运输管理后台</Application></Properties>') });
  return new Blob([zipCircleExportFiles(files)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function buildCircleExportSheetXml(sheet) {
  var rows = sheet.rows || [];
  var columnCount = rows.reduce(function(max, row) { return Math.max(max, row.length); }, 1);
  var lastCell = circleExcelColumnName(columnCount) + Math.max(rows.length, 1);
  var cols = (sheet.widths || []).map(function(width, index) { return '<col min="' + (index + 1) + '" max="' + (index + 1) + '" width="' + width + '" customWidth="1"/>'; }).join('');
  var body = rows.map(function(row, rowIndex) {
    var cells = row.map(function(value, columnIndex) {
      return buildCircleExportCell(value, circleExcelColumnName(columnIndex + 1) + (rowIndex + 1), rowIndex === 0 ? 1 : 0);
    }).join('');
    return '<row r="' + (rowIndex + 1) + '"' + (rowIndex === 0 ? ' ht="30" customHeight="1"' : '') + '>' + cells + '</row>';
  }).join('');
  var views = sheet.filter ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>' : '';
  var filter = sheet.filter && rows.length > 1 ? '<autoFilter ref="A1:' + circleExcelColumnName(columnCount) + rows.length + '"/>' : '';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:' + lastCell + '"/>' + views + '<sheetFormatPr defaultRowHeight="18"/><cols>' + cols + '</cols><sheetData>' + body + '</sheetData>' + filter + '</worksheet>';
}

function buildCircleExportCell(value, ref, style) {
  if (value === null || value === undefined || value === '') return '';
  if (value && typeof value === 'object' && value.formula) {
    return '<c r="' + ref + '" s="' + style + '"><f>' + escapeCircleXml(String(value.formula).replace(/^=/, '')) + '</f><v>' + Number(value.value || 0) + '</v></c>';
  }
  if (typeof value === 'number' && isFinite(value)) return '<c r="' + ref + '" s="' + style + '" t="n"><v>' + value + '</v></c>';
  return '<c r="' + ref + '" s="' + style + '" t="inlineStr"><is><t>' + escapeCircleXml(String(value)) + '</t></is></c>';
}

function escapeCircleXml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function circleExcelColumnName(index) {
  var name = '';
  while (index > 0) { var mod = (index - 1) % 26; name = String.fromCharCode(65 + mod) + name; index = Math.floor((index - 1) / 26); }
  return name;
}
function zipCircleExportFiles(files) {
  var crcTable = window.__circleExportCrcTable || (window.__circleExportCrcTable = buildCircleExportCrcTable());
  var parts = [], central = [], offset = 0;
  files.forEach(function(file) {
    var name = new TextEncoder().encode(file.name), data = file.data, crc = circleExportCrc32(data, crcTable);
    var local = new Uint8Array(30 + name.length + data.length), view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x0800, true); view.setUint16(8, 0, true);
    view.setUint32(14, crc, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true); view.setUint16(26, name.length, true); view.setUint16(28, 0, true);
    local.set(name, 30); local.set(data, 30 + name.length); parts.push(local);
    var entry = new Uint8Array(46 + name.length), centralView = new DataView(entry.buffer);
    centralView.setUint32(0, 0x02014b50, true); centralView.setUint16(4, 20, true); centralView.setUint16(6, 20, true); centralView.setUint16(8, 0x0800, true); centralView.setUint16(10, 0, true);
    centralView.setUint32(16, crc, true); centralView.setUint32(20, data.length, true); centralView.setUint32(24, data.length, true); centralView.setUint16(28, name.length, true); centralView.setUint32(42, offset, true);
    entry.set(name, 46); central.push(entry); offset += local.length;
  });
  var centralSize = central.reduce(function(sum, entry) { return sum + entry.length; }, 0);
  var end = new Uint8Array(22), endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, files.length, true); endView.setUint16(10, files.length, true); endView.setUint32(12, centralSize, true); endView.setUint32(16, offset, true);
  return new Blob(parts.concat(central).concat([end]));
}
function buildCircleExportCrcTable() {
  var table = [];
  for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); table[n] = c >>> 0; }
  return table;
}
function circleExportCrc32(bytes, table) {
  var crc = 0 ^ (-1);
  for (var i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xff];
  return (crc ^ (-1)) >>> 0;
}
function downloadCircleExportWorkbook(blob, filename) {
  var url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}

/* 异常处理能力已按当前产品范围下线。 */
/* ===================== SCRIPT BLOCK 6 (lines 2227-2383) ===================== */
function parseTripDetailDate(value) {
  if (!value || value === '—') return null;
  var date = new Date(String(value).replace(/-/g, '/'));
  return isFinite(date.getTime()) ? date : null;
}

function formatTripDetailDate(date) {
  function pad(value) { return String(value).padStart(2, '0'); }
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}

function splitTripDetailHours(total, count) {
  var values = [], remaining = Number(total) || 0;
  for (var i = 0; i < count; i++) {
    var value = i === count - 1 ? remaining : Math.round((remaining / (count - i)) * 10) / 10;
    values.push(value);
    remaining = Math.round((remaining - value) * 100) / 100;
  }
  return values;
}

function taskHoursLabel(value) {
  return value ? String(Math.round(value * 10) / 10) + 'h' : '0h';
}

// 任务运费统一按「卸货重量 × 单价」计算；旧演示任务未提供价格字段时，
// 以既有运费回填为 100 元/t 的演示数据，保留现有趟次汇总金额。
function hydrateTripTaskPricing(trip) {
  if (!trip || !trip.tasks) return;
  trip.tasks.forEach(function(task) {
    if (task.taskType === '装货空驶单') {
      task.unloadWeight = '—';
      task.unitPrice = '—';
      task.fare = 0;
      return;
    }
    var weight = Number(task.unloadWeight);
    var price = Number(task.unitPrice);
    var existingFare = Number(task.fare) || 0;
    if (!(weight > 0) || !(price > 0)) {
      weight = Math.round(existingFare) / 100;
      price = 100;
      task.unloadWeight = weight;
      task.unitPrice = price;
    }
    task.fare = Math.round(weight * price * 100) / 100;
  });
}

function getTaskFare(task) {
  if (!task || task.taskType === '装货空驶单') return 0;
  var weight = Number(task.unloadWeight);
  var price = Number(task.unitPrice);
  if (weight > 0 && price > 0) return Math.round(weight * price * 100) / 100;
  return Number(task.fare) || 0;
}

function formatTaskNumber(value, digits) {
  var number = Number(value);
  return number > 0 ? number.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
}

function getPreviousTripEndAddress(trip) {
  var currentStart = parseTripDetailDate(trip.startTime);
  var vehicle = getCircleVehicleDisplay(trip.code, trip.vehicle);
  var previous = (window.__tripDetails || []).filter(function(item) {
    var itemStart = parseTripDetailDate(item.startTime);
    return item.code !== trip.code
      && getCircleVehicleDisplay(item.code, item.vehicle) === vehicle
      && itemStart && currentStart && itemStart < currentStart;
  }).sort(function(a, b) {
    return parseTripDetailDate(b.startTime) - parseTripDetailDate(a.startTime);
  })[0];
  if (previous) return previous.endActual || previous.endPool || '上一趟次结束点';

  var defaultEndByVehicle = {
    '云A12345-云F12345挂': '玉昆卸货点',
    '云A67890-云F67890挂': '化念铁精粉卸货地',
    '云A90123-云F90123挂': '杨武铁精粉下货点',
    '云A34567-云F34567挂': '峨山鑫钰公司货场'
  };
  return defaultEndByVehicle[vehicle] || '上一趟次结束点';
}

function addTripLoadingEmptyTask(trip) {
  if (!trip || trip._emptyTaskPrepared || !trip.tasks || !trip.tasks.length) return;
  var hasEmptyTask = trip.tasks.some(function(task) { return task.taskType === '装货空驶单'; });
  if (!hasEmptyTask) {
    var originalTasks = trip.tasks.slice();
    var firstTaskId = originalTasks[0].taskId || trip.code;
    var emptyTaskId = firstTaskId.replace(/(\d{4})$/, '0000');
    trip.tasks = [{
      seq: 1,
      taskId: emptyTaskId,
      taskType: '装货空驶单',
      typeTag: '开始任务',
      route: getPreviousTripEndAddress(trip) + ' → ' + (trip.startActual || trip.startPool || '—'),
      goods: '空驶',
      from: getPreviousTripEndAddress(trip),
      to: trip.startActual || trip.startPool || '—',
      vehicle: trip.vehicle,
      driver: trip.driver,
      unloadWeight: '—',
      unitPrice: '—',
      fare: 0,
      startTime: trip.startTime || '—',
      loadArr: '—', loadLeave: '—', unloadArr: '—', unloadLeave: '—', complete: '—',
      loadEff: '—', unloadEff: '—', chargeEff: '—', driveEff: '—', chargeWaitEff: '—'
    }].concat(originalTasks.map(function(task, index) {
      task.seq = index + 2;
      task.taskType = '直达任务单';
      task.typeTag = index === originalTasks.length - 1 ? '结束任务' : '中间任务';
      return task;
    }));
  }
  hydrateTripTaskPricing(trip);
  trip.taskCount = trip.tasks.length + ' 条任务单';
  trip._emptyTaskPrepared = true;
}

// 原型数据未提供逐任务节点时，依据趟次的已有起止时间和时效汇总补齐展示；不覆盖接口已返回的实际值。
function hydrateTripTaskDetails(trip) {
  if (!trip || trip._taskDetailsHydrated || !trip.tasks || !trip.tasks.length) return;
  addTripLoadingEmptyTask(trip);
  hydrateTripTaskPricing(trip);
  var start = parseTripDetailDate(trip.startTime);
  var end = parseTripDetailDate(trip.endTime);
  if (!start || !end || end <= start) return;

  var count = trip.tasks.length;
  var analysis = trip.timeAnalysis || {};
  var directCount = trip.tasks.filter(function(task) { return task.taskType !== '装货空驶单'; }).length || count;
  var directLoads = splitTripDetailHours((analysis.loading || {}).h, directCount);
  var drives = splitTripDetailHours((analysis.driving || {}).h, count);
  var directUnloads = splitTripDetailHours((analysis.unloading || {}).h, directCount);
  var directCharges = splitTripDetailHours((analysis.charging || {}).h, directCount);
  var directIndex = 0;
  var loads = [], unloads = [], charges = [], chargeWaits = [];
  trip.tasks.forEach(function(task) {
    var taskChargeWaitingHours = getTaskChargeWaitingHours(trip, task);
    if (task.taskType === '装货空驶单') {
      loads.push(0); unloads.push(0); charges.push(0); chargeWaits.push(0);
    } else {
      loads.push(directLoads[directIndex]);
      unloads.push(directUnloads[directIndex]);
      charges.push(directCharges[directIndex]);
      chargeWaits.push(taskChargeWaitingHours || 0);
      directIndex += 1;
    }
  });
  var totalHours = (end.getTime() - start.getTime()) / 3600000;
  var activeHours = loads.reduce(function(sum, value) { return sum + value; }, 0)
    + drives.reduce(function(sum, value) { return sum + value; }, 0)
    + unloads.reduce(function(sum, value) { return sum + value; }, 0)
    + charges.reduce(function(sum, value) { return sum + value; }, 0)
    + chargeWaits.reduce(function(sum, value) { return sum + value; }, 0);
  var gaps = splitTripDetailHours(Math.max(0, totalHours - activeHours), count);
  var cursor = new Date(start.getTime());

  trip.tasks.forEach(function(task, index) {
    task.taskType = task.taskType || (task.typeTag === '开始任务' ? '装货空驶单' : '直达任务单');
    var chargeWaitingHours = getTaskChargeWaitingHours(trip, task);
    task.chargeWaitEff = chargeWaitingHours === null ? '—' : taskHoursLabel(chargeWaitingHours);
    if (task.loadArr && task.loadArr !== '—') {
      if (!task.startTime || task.startTime === '—') task.startTime = task.loadArr;
      return;
    }
    if (task.taskType === '装货空驶单') {
      if (!task.startTime || task.startTime === '—') task.startTime = formatTripDetailDate(cursor);
      cursor = new Date(cursor.getTime() + drives[index] * 3600000);
      task.loadArr = '—';
      task.loadLeave = '—';
      task.unloadArr = '—';
      task.unloadLeave = '—';
      task.complete = formatTripDetailDate(cursor);
      task.loadEff = '—';
      task.unloadEff = '—';
      task.chargeEff = '—';
      task.driveEff = taskHoursLabel(drives[index]);
      cursor = new Date(cursor.getTime() + gaps[index] * 3600000);
      return;
    }
    task.loadArr = formatTripDetailDate(cursor);
    if (!task.startTime || task.startTime === '—') task.startTime = task.loadArr;
    cursor = new Date(cursor.getTime() + loads[index] * 3600000);
    task.loadLeave = formatTripDetailDate(cursor);
    cursor = new Date(cursor.getTime() + drives[index] * 3600000 + charges[index] * 3600000);
    task.unloadArr = formatTripDetailDate(cursor);
    cursor = new Date(cursor.getTime() + unloads[index] * 3600000);
    task.unloadLeave = formatTripDetailDate(cursor);
    task.complete = task.unloadLeave;
    task.loadEff = taskHoursLabel(loads[index]);
    task.unloadEff = taskHoursLabel(unloads[index]);
    task.chargeEff = taskHoursLabel(charges[index]);
    task.driveEff = taskHoursLabel(drives[index]);
    cursor = new Date(cursor.getTime() + gaps[index] * 3600000);
  });
  trip._taskDetailsHydrated = true;
}

app.register('trip-detail', function() {
  var status = window._tripDetailStatus || 's';
  var code = window._tripDetailCode || 'QXC-20260720-0001';
  var statusMap = {
    s: '<span class="badge badge-success">已完成</span>',
    p: '<span class="badge badge-primary">进行中</span>',
    w: '<span class="badge badge-warning">手动结束</span>',
    qp: '<span class="badge badge-purple">已重算</span>'
  };
  var badges = statusMap[status] || statusMap.s;

  // ===== 动态数据 (来自后端预加载 window.__tripDetails) =====
  var t = (window.__tripDetails || []).find(function(x){ return x.code === code; }) || {};
  hydrateTripTaskDetails(t);
  var ta = t.timeAnalysis || {};
  var loading = ta.loading || {}, driving = ta.driving || {}, unloading = ta.unloading || {}, charging = ta.charging || {};
  var tasks = t.tasks || [];
  var timeline = t.timeline || [];
  var displayVehicle = getCircleVehicleDisplay(code, t.vehicle);
  // 司机以趟次明细为准；详情数据暂缺时回退到汇总行，保持与报表列表一致。
  var summaryTrip = (window.__tripSummaries || []).find(function(row) { return row && row[0] === code; });
  var displayDriver = t.driver || (summaryTrip && summaryTrip[2]) || '—';
  var totalStart = parseTripDetailDate(t.startTime);
  var totalEnd = parseTripDetailDate(t.endTime);
  var displayTotalDurationH = '—';
  if (totalStart && totalEnd && totalEnd >= totalStart) {
    displayTotalDurationH = (Math.round(((totalEnd - totalStart) / 3600000) * 10) / 10) + 'h';
  } else {
    displayTotalDurationH = toHours(t.totalDurationH || t.totalDuration);
  }
  var tripStartAddress = t.startActual || t.startPool || '—';
  var tripEndAddress = t.endActual || t.endPool || '—';

  // 任务单类型与趟次归属类型分开呈现：首段为去装货点的空驶任务，其余为货物直达任务。
  function getTaskOrderType(task) {
    return task.taskType || (task.typeTag === '开始任务' ? '装货空驶单' : '直达任务单');
  }
  function getTaskOrderTypeClass(taskType) {
    return taskType === '装货空驶单' ? 'task-order-empty' : 'task-order-direct';
  }

  // 运费 / 司机收入（司机收入 = 运费 × 司机分成系数，系数可在页头调整）
  var fareRate = (window.__fareSettings && typeof window.__fareSettings.driverRate === 'number') ? window.__fareSettings.driverRate : 0.2;
  var taskCountNum = parseInt(((t.taskCount || '') + '').replace(/[^\d]/g, ''), 10) || tasks.length || 0;
  var directTaskCount = tasks.filter(function(task) { return task.taskType !== '装货空驶单'; }).length || taskCountNum;
  var mileageVal = (t.mileage != null && t.mileage !== '—') ? t.mileage : '—';
  var hasMileage = mileageVal !== '—';

  return ''
  + '<div style="padding:20px 24px 40px;">'
  + '<div class="breadcrumb"><a href="javascript:void(0)" onclick="app.navigate(\'circle-report\')" class="back-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>返回</a><a href="#">报表中心</a><span class="sep">/</span><a href="javascript:void(0)" onclick="app.navigate(\'circle-report\')">趟次统计报表</a><span class="sep">/</span><span class="current">趟次详情</span></div>'
  + '<div class="page-header"><div class="page-title-wrap"><h1 class="page-title"><span class="trip-id">' + code + '</span></h1><div class="page-badges">' + badges + '</div></div></div>'

  // Basic Info Card
  + '<div class="card"><div class="card-header"><div class="card-title"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>趟次基础信息 <span class="sub">趟次编号、车辆、起终点及时间等核心字段</span></div></div>'
  + '<div class="card-body" style="padding:0;"><div class="info-grid">'
  + tInfo('车辆（主车-挂车）', displayVehicle || '—','mono') + tInfo('司机', displayDriver,'primary') + tInfo('趟次起点地址', tripStartAddress,'primary') + tInfo('趟次终点地址', tripEndAddress,'accent')
  + tInfo('运输任务明细数', (taskCountNum ? taskCountNum + ' 条任务单' : (t.taskCount || '—')),'large',' sub')
  + tInfo('趟次开始时间', t.startTime || '—','mono') + tInfo('趟次结束时间', t.endTime || '—','mono') + tInfo('趟次总耗时', displayTotalDurationH,'large primary')
  + tInfo('趟次总行驶里程', mileageVal,'large accent', hasMileage ? ' km' : '')
  + '</div></div></div>'

  // Time Analysis Card
  + '<div class="card"><div class="card-header"><div class="card-title"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>时效分析 <span class="sub">装货、行驶、卸货、充电四类时效分解</span></div></div>'
  + '<div class="card-body"><div class="time-analysis"><div class="time-bar-container"><div class="time-bar-label">总耗时</div><div class="time-bar-track">'
  + '<div class="time-seg seg-loading" style="width:' + (loading.pct||0) + '%;" data-tip="装货时效 ' + (loading.h||0) + 'h (' + (loading.pct||0) + '%)">装货 ' + (loading.h||0) + 'h</div>'
  + '<div class="time-seg seg-driving" style="width:' + (driving.pct||0) + '%;" data-tip="行驶时效 ' + (driving.h||0) + 'h (' + (driving.pct||0) + '%)">行驶 ' + (driving.h||0) + 'h</div>'
  + '<div class="time-seg seg-unloading" style="width:' + (unloading.pct||0) + '%;" data-tip="卸货时效 ' + (unloading.h||0) + 'h (' + (unloading.pct||0) + '%)">卸货 ' + (unloading.h||0) + 'h</div>'
  + '<div class="time-seg seg-charging" style="width:' + (charging.pct||0) + '%;" data-tip="充电时效 ' + (charging.h||0) + 'h (' + (charging.pct||0) + '%)">充电 ' + (charging.h||0) + 'h</div>'
  + '</div><div class="time-bar-total">' + (ta.total != null ? ta.total + 'h' : '—') + '</div></div>'
  + '<div class="time-legend">'
  + '<div class="legend-item"><span class="legend-dot" style="background:var(--c-primary)"></span>装货时效 <span class="val">' + (loading.h||0) + 'h</span> <span class="pct">' + (loading.pct||0) + '%</span></div>'
  + '<div class="legend-item"><span class="legend-dot" style="background:var(--c-success)"></span>行驶时效 <span class="val">' + (driving.h||0) + 'h</span> <span class="pct">' + (driving.pct||0) + '%</span></div>'
  + '<div class="legend-item"><span class="legend-dot" style="background:var(--c-accent)"></span>卸货时效 <span class="val">' + (unloading.h||0) + 'h</span> <span class="pct">' + (unloading.pct||0) + '%</span></div>'
  + '<div class="legend-item"><span class="legend-dot" style="background:var(--c-warning)"></span>充电时效 <span class="val">' + (charging.h||0) + 'h</span> <span class="pct">' + (charging.pct||0) + '%</span></div>'
  + '</div></div>'
  + '<div class="time-summary">'
  + tCard('装货时效', (loading.h||0),' h', (directTaskCount ? directTaskCount + '条直达任务合计' : '—'),'tc-loading')
  + tCard('行驶时效', (driving.h||0),' h', (taskCountNum ? taskCountNum + '条任务合计' : '—'),'tc-driving')
  + tCard('卸货时效', (unloading.h||0),' h', (directTaskCount ? directTaskCount + '条直达任务合计' : '—'),'tc-unloading')
  + tCard('充电时效', (charging.h||0),' h', '1次充电记录','tc-charging')
  + '</div>'
  + '</div></div>'

  // 运输任务时间线按当前产品范围暂不展示；趟次与任务节点数据仍保留，后续迭代可恢复该卡片。

  // Task Detail Table
  + '<div class="card"><div class="card-header"><div class="card-title"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>运输任务明细 <span class="sub">同一辆车从开始任务至结束任务之间的全部已完成任务单，不单独计算趟次</span></div></div>'
  + '<div class="table-wrap" style="border-top:1px solid var(--c-border);"><table class="data-table"><thead><tr>'
  + '<th>运输顺序</th><th>任务单号</th><th>任务单类型</th><th>运输线路</th><th>货物</th><th>实际起点</th><th>实际终点</th><th>车辆（主车-挂车）</th><th>主司机</th><th>任务开始时间</th><th>任务结束时间</th><th>装货到达</th><th>装货离开</th><th>卸货到达</th><th>卸货离开</th><th>装货时效（h）</th><th>卸货时效（h）</th><th>充电时效（h）</th><th>行驶时效（h）</th><th>充电等待时效（h）</th><th>卸货重量（t）</th><th>单价（元/t）</th><th class="col-money">运费（元）</th><th class="col-money">司机收入</th><th>明细类型</th><th class="sticky-col-r">操作</th></tr></thead><tbody>'
  + tasks.map(function(r){
      var typeCls = r.typeTag === '开始任务' ? 'task-type-start' : (r.typeTag === '结束任务' ? 'task-type-end' : 'task-type-middle');
      var seqBadgeCls = r.seq === 1 ? 'badge-primary' : (r.seq === tasks.length ? 'badge-warning' : 'badge-gray');
      var taskOrderType = getTaskOrderType(r);
      var taskFare = getTaskFare(r);
      return '<tr>'
        + '<td><span class="badge ' + seqBadgeCls + '" style="padding:2px 6px;">' + r.seq + '</span></td>'
        + '<td><span class="col-num">' + r.taskId + '</span></td>'
        + '<td><span class="task-order-type ' + getTaskOrderTypeClass(taskOrderType) + '">' + taskOrderType + '</span></td>'
        + '<td><div class="route-cell">' + (r.route||'').replace(/ → /g, ' <span class="route-arrow">→</span> ') + '</div></td>'
        + '<td>' + (r.goods || '—') + '</td>'
        + '<td>' + r.from + '</td>'
        + '<td>' + r.to + '</td>'
        + '<td class="text-mono">' + displayVehicle + '</td>'
        + '<td>' + r.driver + '</td>'
        + '<td class="col-time">' + ((r.startTime && r.startTime !== '—') ? r.startTime : (r.taskType === '装货空驶单' ? (t.startTime || '—') : (r.loadArr || '—'))) + '</td>'
        + '<td class="col-time">' + (r.complete || '—') + '</td>'
        + '<td class="col-time">' + r.loadArr + '</td>'
        + '<td class="col-time">' + r.loadLeave + '</td>'
        + '<td class="col-time">' + r.unloadArr + '</td>'
        + '<td class="col-time">' + r.unloadLeave + '</td>'
        + '<td class="col-time">' + r.loadEff + '</td>'
        + '<td class="col-time">' + r.unloadEff + '</td>'
        + '<td class="col-time">' + r.chargeEff + '</td>'
        + '<td class="col-time">' + r.driveEff + '</td>'
        + '<td class="col-time">' + (r.chargeWaitEff || '—') + '</td>'
        + '<td class="col-money">' + formatTaskNumber(r.unloadWeight, 2) + '</td>'
        + '<td class="col-money">' + formatTaskNumber(r.unitPrice, 2) + '</td>'
        + '<td class="col-money">' + taskFare.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + '</td>'
        + '<td class="col-money income">' + ((Math.round(taskFare * fareRate * 100) / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + '</td>'
        + '<td><span class="task-type-tag ' + typeCls + '">' + r.typeTag + '</span></td>'
        + '<td class="sticky-col-r"><a href="#" class="link">查看详情</a></td>'
        + '</tr>';
    }).join('')
  + '</tbody></table></div>'
  + '</div>'

  + '</div>';

  // Helper functions for trip detail
  function tInfo(label, value, cls, suffix) {
    cls = cls || '';
    suffix = suffix || '';
    return '<div class="info-item"><div class="info-label">' + label + '</div><div class="info-value' + (cls ? ' ' + cls : '') + '">' + value + (suffix ? '<span class="sub">' + suffix + '</span>' : '') + '</div></div>';
  }
  function tCard(label, value, unit, note, tcls) {
    return '<div class="time-card ' + tcls + '"><div class="tc-label"><span class="tc-dot"></span>' + label + '</div><div class="tc-value">' + value + '<span class="tc-unit">' + unit + '</span></div><div class="tc-label" style="margin-top:4px;font-size:11px;color:var(--c-text-3);">' + note + '</div></div>';
  }
  function fmtMoney(v) {
    return (Number(v) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
}, ['trip-detail']);

// 司机分成比例：应用（保存到后端并即时重算当前页）
function applyFareRate() {
  var input = document.getElementById('fareRateInput');
  if (!input) return;
  var pct = Number(input.value);
  if (!isFinite(pct) || pct < 0 || pct > 100) {
    alert('司机分成比例需为 0 ~ 100 之间的数字');
    return;
  }
  var rate = Math.round(pct) / 100;
  window.__fareSettings = window.__fareSettings || {};
  window.__fareSettings.driverRate = rate;
  try { localStorage.setItem('tms_fare_rate', String(rate)); } catch (e) {}
  // 先乐观更新界面
  if (typeof app !== 'undefined' && app.render) app.render();
  // 持久化到后端
  fetch('/api/fare-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driverRate: rate })
  })
    .then(function(r){ return r.ok ? r.json() : Promise.reject(new Error('保存失败')); })
    .then(function(s){ window.__fareSettings.driverRate = s.driverRate; if (typeof app !== 'undefined' && app.render) app.render(); })
    .catch(function(e){ console.warn('保存司机分成比例失败：', e); });
}

/* ===================== SCRIPT BLOCK 7 (lines 2390-2587) ===================== */
// ========== Custom Date Picker ==========
(function() {
  var popup = null, activeInput = null, currentDate = null, currentMonth = null;

  function createPopup() {
    if (popup) return;
    popup = document.createElement('div');
    popup.className = 'dp-popup';
    popup.innerHTML = ''
    + '<div class="dp-header">'
    + '<button class="dp-nav dp-prev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>'
    + '<span class="dp-title"></span>'
    + '<button class="dp-nav dp-next"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>'
    + '</div>'
    + '<div class="dp-grid">'
    + '<div class="dp-dh">日</div><div class="dp-dh">一</div><div class="dp-dh">二</div><div class="dp-dh">三</div><div class="dp-dh">四</div><div class="dp-dh">五</div><div class="dp-dh">六</div>'
    + '</div>'
    + '<div class="dp-grid" id="dpDays"></div>'
    + '<div class="dp-foot">'
    + '<button class="dp-btn-clear">清空</button>'
    + '<button class="dp-btn-ok">确定</button>'
    + '</div>';
    document.body.appendChild(popup);

    popup.querySelector('.dp-prev').addEventListener('click', function(e) { e.stopPropagation(); navMonth(-1); });
    popup.querySelector('.dp-next').addEventListener('click', function(e) { e.stopPropagation(); navMonth(1); });
    popup.querySelector('.dp-btn-ok').addEventListener('click', function(e) { e.stopPropagation(); confirmDate(); });
    popup.querySelector('.dp-btn-clear').addEventListener('click', function(e) { e.stopPropagation(); clearDate(); });

    popup.addEventListener('click', function(e) {
      var btn = e.target.closest('.dp-day');
      if (btn && !btn.classList.contains('other')) {
        currentDate = btn.getAttribute('data-date');
        renderCalendar(currentMonth);
      }
    });
    popup.addEventListener('mousedown', function(e) { e.stopPropagation(); });

    document.addEventListener('click', function(e) {
      if (activeInput && popup && !popup.contains(e.target) && e.target !== activeInput) {
        hidePicker(false);
      }
    });
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtDate(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }

  function renderCalendar(ym) {
    if (!ym) return;
    var y = ym.getFullYear(), m = ym.getMonth();
    popup.querySelector('.dp-title').textContent = y + '年' + (m + 1) + '月';

    var days = popup.querySelector('#dpDays');
    var firstDay = new Date(y, m, 1).getDay();
    var lastDate = new Date(y, m + 1, 0).getDate();
    var prevLast = new Date(y, m, 0).getDate();
    var today = fmtDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

    var html = '';
    // previous month days
    for (var i = firstDay - 1; i >= 0; i--) {
      html += '<button class="dp-day other" data-date="">' + (prevLast - i) + '</button>';
    }
    // current month days
    for (var d = 1; d <= lastDate; d++) {
      var ds = fmtDate(y, m, d);
      var cls = 'dp-day';
      if (ds === today) cls += ' today';
      if (ds === currentDate) cls += ' sel';
      html += '<button class="' + cls + '" data-date="' + ds + '">' + d + '</button>';
    }
    // next month days
    var total = firstDay + lastDate;
    var remaining = total <= 35 ? 35 - total : 42 - total;
    for (var d = 1; d <= remaining; d++) {
      html += '<button class="dp-day other" data-date="">' + d + '</button>';
    }
    days.innerHTML = html;
  }

  function navMonth(dir) {
    currentMonth.setMonth(currentMonth.getMonth() + dir);
    renderCalendar(currentMonth);
  }

  function showPicker(input) {
    createPopup();
    activeInput = input;
    var v = input.value;
    currentDate = v || '';
    currentMonth = v ? new Date(v + 'T00:00:00') : new Date();
    if (isNaN(currentMonth.getTime())) currentMonth = new Date();
    currentMonth.setDate(1);
    renderCalendar(currentMonth);

    var rect = input.getBoundingClientRect();
    var top = rect.bottom + 4;
    var left = rect.left;
    if (left + 264 > window.innerWidth) left = window.innerWidth - 272;
    if (top + 340 > window.innerHeight) top = rect.top - 346;
    popup.style.top = top + 'px';
    popup.style.left = left + 'px';
    popup.classList.add('show');
  }

  function hidePicker(apply) {
    popup.classList.remove('show');
    if (apply && activeInput && currentDate) {
      activeInput.value = currentDate;
      // Trigger input event for compatibility with any listeners
      activeInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    activeInput = null;
  }

  function confirmDate() {
    if (activeInput && currentDate) {
      hidePicker(true);
    } else {
      hidePicker(false);
    }
  }

  function clearDate() {
    if (activeInput) {
      activeInput.value = '';
      currentDate = '';
      hidePicker(false);
      // 清空后自动重查，避免用户点了「清空」但列表不刷新（误以为清不掉）
      if (document.getElementById('circleFilterPanel') && typeof doCircleSearch === 'function') doCircleSearch();
    }
  }

  // Bind to all .date-pick inputs
  function bindAll() {
    var inputs = document.querySelectorAll('.date-pick');
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i]._dpBound) continue;
      inputs[i]._dpBound = true;
      inputs[i].addEventListener('click', function(e) {
        e.preventDefault();
        if (activeInput === this) { hidePicker(false); return; }
        showPicker(this);
      });
    }
  }

  // Re-bind after page render
  window._bindDatePickers = bindAll;
  // Auto-bind on DOM changes
  var observer = new MutationObserver(function() { bindAll(); });
  observer.observe(document.getElementById('mainContent') || document.body, { childList: true, subtree: true });
})();

// ============================================================
// 启动预加载 (连接后端 API，保持页面功能与布局不变)
// 改为「先预加载数据，再 app.init()」，确保首屏渲染即拿到后端数据
// ============================================================
function preloadFences() {
  return fetch('/api/fences')
    .then(function(r){ return r.json(); })
    .then(function(list){
      window.__fences = list || [];
      filteredFenceData = (window.__fences || []).slice();
      if (document.getElementById('fenceTableBody') && typeof buildFenceTable === 'function') buildFenceTable();
    })
    .catch(function(e){
      console.error('预加载围栏失败：', e);
      window.__fences = (typeof fenceData !== 'undefined') ? fenceData : [];
      filteredFenceData = (window.__fences || []).slice();
    });
}
function preloadTripSummaries() {
  return fetch('/api/trips')
    .then(function(r){ return r.json(); })
    .then(function(list){
      window.__tripSummaries = list || [];
      buildCircleTripVehicleMap();
    })
    .catch(function(e){
      console.error('预加载趟次汇总失败：', e);
      window.__tripSummaries = [];
      buildCircleTripVehicleMap();
    });
}
function preloadTripDetails() {
  return fetch('/api/trip-details')
    .then(function(r){ return r.json(); })
    .then(function(list){
      window.__tripDetails = list || [];
      window.__tripDetails.forEach(hydrateTripTaskPricing);
    })
    .catch(function(e){ console.error('预加载趟次详情失败：', e); window.__tripDetails = []; });
}
function preloadFareSettings() {
  return fetch('/api/fare-settings')
    .then(function(r){ return r.json(); })
    .then(function(s){ window.__fareSettings = s && typeof s.driverRate === 'number' ? s : { driverRate: 0.2 }; })
    .catch(function(e){ console.error('预加载系数失败：', e); window.__fareSettings = { driverRate: 0.2 }; });
}
// 预加载片区（围栏归属）；加载后覆盖 districtData 并置位，禁止前端静态分块种入覆盖用户/接口数据
function preloadDistricts() {
  return fetch('/api/districts')
    .then(function(r){ return r.json(); })
    .then(function(list){
      if (Array.isArray(list) && list.length) {
        districtData = list;
        districtSeededFromFences = true;
        filteredDistrictData = districtData.slice();
        if (typeof applyDistrictFilters === 'function') applyDistrictFilters();
      }
    })
    .catch(function(e){ console.error('预加载片区失败：', e); });
}
// 持久化片区（围栏归属）到后端
function saveDistricts() {
  return fetch('/api/districts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(districtData)
  })
    .then(function(r){ return r.json(); })
    .catch(function(e){ console.error('保存片区失败：', e); });
}

Promise.all([preloadFences(), preloadTripSummaries(), preloadTripDetails(), preloadFareSettings(), preloadDistricts()])
  .finally(function(){ app.init(); });
