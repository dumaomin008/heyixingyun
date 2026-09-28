/* 规则设置 → 预警规则：只维护五类预置规则的启用、阈值与等级。 */
(function () {
  var STORAGE_KEY = 'hyxy-warning-rules-v1';
  var PAGE = 'warning-rule-management';
  var OPERATOR = '李调度';
  var pageSize = 20;
  var page = 1;
  var filters = { type: '', level: '', enabled: '' };
  var editingId = '';
  var modalMode = '';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function toast(message) {
    if (typeof showAppToast === 'function') showAppToast(message);
    else window.alert(message);
  }
  function nowText() {
    var d = new Date();
    var p = function (n) { return n < 10 ? '0' + n : String(n); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function seedRecords() {
    var time = '2026-09-28 09:00:00';
    return [
      { id: 'stop', name: '停车预警', subject: '不在装卸货点、不在充电站，且车速为 0', compare: '持续', threshold: 10, unit: '分钟', min: 1, max: 1440, level: '中', enabled: true, modifier: '系统预置', modifyTime: time },
      { id: 'site', name: '停车区域预警', subject: '在装卸货点或充电站围栏内停留', compare: '持续', threshold: 15, unit: '分钟', min: 1, max: 1440, level: '中', enabled: true, modifier: '系统预置', modifyTime: time },
      { id: 'speed', name: '车速预警', subject: '当前车速', compare: '高于', threshold: 80, unit: 'km/h', min: 1, max: 200, level: '高', enabled: true, modifier: '系统预置', modifyTime: time },
      { id: 'weigh', name: '卸货后未上传磅单', subject: '离开卸货点后仍未上传卸货磅单', compare: '超过', threshold: 15, unit: '分钟', min: 1, max: 1440, level: '高', enabled: true, modifier: '系统预置', modifyTime: time },
      { id: 'soc', name: 'SOC预警', subject: '当前电量', compare: '低于', threshold: 20, unit: '%', min: 1, max: 100, level: '中', enabled: true, modifier: '系统预置', modifyTime: time }
    ];
  }
  function cloneRule(item) {
    return {
      id: item.id, name: item.name, subject: item.subject, compare: item.compare,
      threshold: item.threshold, unit: item.unit, min: item.min, max: item.max,
      level: item.level, enabled: item.enabled !== false,
      modifier: item.modifier || '系统预置', modifyTime: item.modifyTime || ''
    };
  }
  function loadRecords() {
    var seed = seedRecords();
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && Array.isArray(saved.rules)) {
        var byId = {};
        saved.rules.forEach(function (item) { if (item && item.id) byId[item.id] = item; });
        return seed.map(function (item) {
          var hit = byId[item.id];
          if (!hit) return cloneRule(item);
          var threshold = Number(hit.threshold);
          var level = hit.level === '高' || hit.level === '中' ? hit.level : item.level;
          if (!isFinite(threshold) || threshold < item.min || threshold > item.max || Math.round(threshold) !== threshold) threshold = item.threshold;
          return cloneRule({
            id: item.id, name: item.name, subject: item.subject, compare: item.compare,
            threshold: threshold, unit: item.unit, min: item.min, max: item.max,
            level: level, enabled: hit.enabled !== false,
            modifier: hit.modifier || item.modifier, modifyTime: hit.modifyTime || item.modifyTime
          });
        });
      }
    } catch (e) {}
    return seed.map(cloneRule);
  }
  function persist(list) {
    window.__warningRules = list;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ rules: list })); } catch (e) {}
  }
  function records() {
    if (!window.__warningRules) window.__warningRules = loadRecords();
    return window.__warningRules;
  }
  function getRecord(id) {
    return records().filter(function (item) { return item.id === id; })[0] || null;
  }
  function thresholdText(item) {
    var value = item.unit === '%' ? (item.threshold + '%') : (item.threshold + ' ' + item.unit);
    return item.compare + ' ' + value;
  }
  function levelBadge(level) {
    if (level === '高') return '<span class="badge badge-error">高</span>';
    return '<span class="badge badge-warning">中</span>';
  }
  function enabledBadge(enabled) {
    return enabled
      ? '<span class="badge badge-primary">启用</span>'
      : '<span class="badge badge-gray">停用</span>';
  }
  function filteredRecords() {
    return records().filter(function (item) {
      if (filters.type && item.id !== filters.type) return false;
      if (filters.level && item.level !== filters.level) return false;
      if (filters.enabled === 'on' && !item.enabled) return false;
      if (filters.enabled === 'off' && item.enabled) return false;
      return true;
    });
  }
  function optionHtml(list, selected) {
    return list.map(function (item) {
      return '<option value="' + esc(item.value) + '"' + (item.value === selected ? ' selected' : '') + '>' + esc(item.label) + '</option>';
    }).join('');
  }

  function renderList() {
    var rows = filteredRecords();
    var total = rows.length;
    var totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
    if (page > totalPages) page = totalPages;
    var start = (page - 1) * pageSize;
    var pageRows = rows.slice(start, start + pageSize);
    var end = total ? start + pageRows.length : 0;
    var typeOptions = [{ value: '', label: '全部' }].concat(records().map(function (item) {
      return { value: item.id, label: item.name };
    }));
    var body = pageRows.length ? pageRows.map(function (item, index) {
      return '<tr>'
        + '<td>' + (start + index + 1) + '</td>'
        + '<td>' + esc(item.name) + '</td>'
        + '<td>' + esc(item.subject) + '</td>'
        + '<td>' + esc(thresholdText(item)) + '</td>'
        + '<td>' + levelBadge(item.level) + '</td>'
        + '<td>' + enabledBadge(item.enabled) + '</td>'
        + '<td>' + esc(item.modifier || '—') + '</td>'
        + '<td class="col-time">' + esc(item.modifyTime || '—') + '</td>'
        + '<td><a href="javascript:void(0)" class="link" onclick="wrOpenEdit(\'' + esc(item.id) + '\')">编辑</a></td>'
        + '</tr>';
    }).join('') : '<tr><td colspan="9"><div class="empty-state"><b>没有符合条件的预警规则</b><p>调整筛选条件后再查询。</p><button class="btn btn-default" type="button" onclick="wrResetFilters()">清空筛选</button></div></td></tr>';

    return '<div class="content-area page-standard">'
      + '<div class="breadcrumb"><span>规则设置</span><span class="sep">/</span><span class="current">预警规则</span></div>'
      + '<div class="page-header district-page-header"><div><div class="page-title">预警规则</div>'
      + '<p class="detail-section-sub">预置停车、停车区域、车速、卸货后未上传磅单、SOC 五类。这里只改启用、阈值和等级。</p></div></div>'
      + '<div class="filter-panel"><div class="filter-row">'
      + '<div class="filter-item"><label class="filter-label" for="wrFilterType">预警类型</label><select class="filter-control" id="wrFilterType">' + optionHtml(typeOptions, filters.type) + '</select></div>'
      + '<div class="filter-item"><label class="filter-label" for="wrFilterLevel">等级</label><select class="filter-control" id="wrFilterLevel">' + optionHtml([{ value: '', label: '全部' }, { value: '高', label: '高' }, { value: '中', label: '中' }], filters.level) + '</select></div>'
      + '<div class="filter-item"><label class="filter-label" for="wrFilterEnabled">启用状态</label><select class="filter-control" id="wrFilterEnabled">' + optionHtml([{ value: '', label: '全部' }, { value: 'on', label: '启用' }, { value: 'off', label: '停用' }], filters.enabled) + '</select></div>'
      + '</div><div class="filter-actions"><button class="btn btn-default" type="button" onclick="wrResetFilters()">重置</button><button class="btn btn-primary" type="button" onclick="wrApplyFilters()">查询</button></div></div>'
      + '<section class="table-section"><div class="table-toolbar"><div class="left"><span class="detail-section-title">预警规则</span></div><div class="right"></div></div>'
      + '<div class="table-wrap"><table class="data-table"><thead><tr>'
      + '<th>序号</th><th>预警类型</th><th>判定对象</th><th>触发阈值</th><th>等级</th><th>启用状态</th><th>修改人</th><th>修改时间</th><th>操作</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>'
      + '<div class="pagination"><div class="pagination-info">共 ' + total + ' 条' + (total ? '，当前 ' + (start + 1) + '-' + end : '') + '</div>'
      + '<div class="page-size"><select id="wrPageSize" aria-label="每页条数" onchange="wrChangePageSize(this.value)"><option value="10"' + (pageSize === 10 ? ' selected' : '') + '>10条/页</option><option value="20"' + (pageSize === 20 ? ' selected' : '') + '>20条/页</option><option value="50"' + (pageSize === 50 ? ' selected' : '') + '>50条/页</option></select></div>'
      + '<div class="pagination-controls" id="wrPagination"></div></div></section></div>';
  }

  function renderPagination() {
    var box = document.getElementById('wrPagination');
    if (!box) return;
    var totalPages = Math.max(1, Math.ceil(filteredRecords().length / pageSize) || 1);
    var html = '<button class="page-btn" type="button" ' + (page <= 1 ? 'disabled' : '') + ' onclick="wrGoPage(' + (page - 1) + ')" aria-label="上一页">&lsaquo;</button>';
    for (var i = 1; i <= totalPages && i <= 7; i++) {
      html += '<button class="page-btn' + (i === page ? ' active' : '') + '" type="button" onclick="wrGoPage(' + i + ')">' + i + '</button>';
    }
    html += '<button class="page-btn" type="button" ' + (page >= totalPages ? 'disabled' : '') + ' onclick="wrGoPage(' + (page + 1) + ')" aria-label="下一页">&rsaquo;</button>';
    box.innerHTML = html;
  }

  function field(label, control, extra) {
    return '<div class="form-item' + (extra.full ? ' full' : '') + '"><label class="form-label" for="' + extra.id + '">' + label + (extra.required ? ' <span class="req">*</span>' : '') + '</label>' + control + (extra.hint ? '<div class="form-hint">' + extra.hint + '</div>' : '') + '<div class="form-error" id="' + extra.id + 'Error"></div></div>';
  }
  function readForm() {
    var threshold = document.getElementById('wrThreshold');
    var level = document.getElementById('wrLevel');
    var enabled = document.getElementById('wrEnabled');
    if (!threshold || !level || !enabled) return null;
    return { threshold: String(threshold.value || '').trim(), level: level.value, enabled: enabled.value === 'on' };
  }
  function showFieldError(id, message) {
    var box = document.getElementById(id + 'Error');
    var input = document.getElementById(id);
    if (box) {
      box.textContent = message || '';
      box.style.display = message ? 'block' : 'none';
    }
    if (input && message) input.focus();
  }
  function clearErrors() {
    ['wrThreshold', 'wrLevel', 'wrEnabled'].forEach(function (id) { showFieldError(id, ''); });
  }
  function validate(rule, form) {
    clearErrors();
    if (!/^\d+$/.test(form.threshold)) {
      showFieldError('wrThreshold', '请填写 ' + rule.min + ' 到 ' + rule.max + ' 的整数');
      return null;
    }
    var value = Number(form.threshold);
    if (value < rule.min || value > rule.max) {
      showFieldError('wrThreshold', '请填写 ' + rule.min + ' 到 ' + rule.max + ' 的整数');
      return null;
    }
    if (form.level !== '高' && form.level !== '中') {
      showFieldError('wrLevel', '请选择等级');
      return null;
    }
    return { threshold: value, level: form.level, enabled: form.enabled };
  }
  function closeModal() {
    var overlay = document.getElementById('wrModal');
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', onModalKey);
    editingId = '';
    modalMode = '';
    window.__wrDraft = null;
  }
  function onModalKey(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      requestClose();
    }
  }
  function mountModal(inner, width) {
    var overlay = document.getElementById('wrModal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'wrModal';
      overlay.className = 'modal-overlay show';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', function (event) {
        if (event.target === overlay) requestClose();
      });
      document.addEventListener('keydown', onModalKey);
    }
    overlay.innerHTML = '<section class="modal" role="dialog" aria-modal="true" aria-labelledby="wrModalTitle" style="width:' + (width || 600) + 'px">' + inner + '</section>';
  }
  function rememberDraft() {
    var form = readForm();
    if (!form) return;
    window.__wrDraft = { threshold: form.threshold, level: form.level, enabled: form.enabled };
  }
  function editHtml(rule) {
    var unitHint = rule.unit === '%' ? '单位：%，填写 ' + rule.min + '–' + rule.max : (rule.unit === 'km/h' ? '单位：km/h，填写 ' + rule.min + '–' + rule.max : '单位：分钟，填写 ' + rule.min + '–' + rule.max);
    return '<header class="modal-header"><div class="modal-title" id="wrModalTitle">编辑预警规则</div><button class="modal-close" type="button" onclick="wrRequestClose()" aria-label="关闭">×</button></header>'
      + '<div class="modal-body"><div class="form-grid col-2">'
      + field('预警类型', '<input class="form-control-text" id="wrName" value="' + esc(rule.name) + '" disabled>', { id: 'wrName', full: true })
      + field('判定对象', '<input class="form-control-text" id="wrSubject" value="' + esc(rule.subject) + '" disabled>', { id: 'wrSubject', full: true })
      + field('触发阈值', '<input class="form-control-text" id="wrThreshold" inputmode="numeric" value="' + esc(rule.threshold) + '">', { id: 'wrThreshold', required: true, hint: unitHint })
      + field('等级', '<select class="form-control-text" id="wrLevel"><option value="高"' + (rule.level === '高' ? ' selected' : '') + '>高</option><option value="中"' + (rule.level === '中' ? ' selected' : '') + '>中</option></select>', { id: 'wrLevel', required: true })
      + field('启用状态', '<select class="form-control-text" id="wrEnabled"><option value="on"' + (rule.enabled ? ' selected' : '') + '>启用</option><option value="off"' + (!rule.enabled ? ' selected' : '') + '>停用</option></select>', { id: 'wrEnabled', required: true })
      + '</div></div>'
      + '<footer class="modal-footer"><button class="btn btn-default" type="button" onclick="wrRequestClose()">取消</button><button class="btn btn-primary" type="button" onclick="wrSave()">保存</button></footer>';
  }
  function confirmHtml(title, message, confirmLabel, confirmFn) {
    return '<header class="modal-header"><div class="modal-title" id="wrModalTitle">' + esc(title) + '</div><button class="modal-close" type="button" onclick="wrBackToEdit()" aria-label="关闭">×</button></header>'
      + '<div class="modal-body"><div class="confirm-body">' + esc(message) + '</div></div>'
      + '<footer class="modal-footer"><button class="btn btn-default" type="button" onclick="wrBackToEdit()">取消</button><button class="btn btn-primary" type="button" onclick="' + confirmFn + '">' + esc(confirmLabel) + '</button></footer>';
  }
  function openEdit(id) {
    var rule = getRecord(id);
    if (!rule) return;
    editingId = id;
    modalMode = 'edit';
    window.__wrDraft = null;
    mountModal(editHtml(rule), 600);
    var input = document.getElementById('wrThreshold');
    if (input) input.focus();
  }
  function isDirty() {
    var rule = getRecord(editingId);
    var form = readForm();
    if (!rule || !form) return false;
    return form.threshold !== String(rule.threshold) || form.level !== rule.level || form.enabled !== !!rule.enabled;
  }
  function requestClose() {
    if (modalMode === 'discard' || modalMode === 'disable') {
      backToEdit();
      return;
    }
    if (modalMode === 'edit' && isDirty()) {
      rememberDraft();
      modalMode = 'discard';
      mountModal(confirmHtml('放弃修改', '当前修改尚未保存。', '放弃修改', 'wrCloseModal()'), 420);
      return;
    }
    closeModal();
  }
  function backToEdit() {
    var rule = getRecord(editingId);
    if (!rule) { closeModal(); return; }
    var draft = window.__wrDraft;
    mountModal(editHtml(rule), 600);
    if (draft) {
      var threshold = document.getElementById('wrThreshold');
      var level = document.getElementById('wrLevel');
      var enabled = document.getElementById('wrEnabled');
      if (threshold) threshold.value = draft.threshold;
      if (level) level.value = draft.level;
      if (enabled) enabled.value = draft.enabled ? 'on' : 'off';
    }
    modalMode = 'edit';
  }
  function applySave(next) {
    records().forEach(function (item) {
      if (item.id !== editingId) return;
      item.threshold = next.threshold;
      item.level = next.level;
      item.enabled = next.enabled;
      item.modifier = OPERATOR;
      item.modifyTime = nowText();
    });
    persist(records());
    closeModal();
    if (window.app) window.app.render();
    toast('已保存');
  }
  function save() {
    var rule = getRecord(editingId);
    var form = readForm();
    if (!rule || !form) return;
    var next = validate(rule, form);
    if (!next) return;
    if (next.threshold === rule.threshold && next.level === rule.level && next.enabled === !!rule.enabled) {
      closeModal();
      toast('没有需要保存的修改');
      return;
    }
    window.__wrDraft = { threshold: String(next.threshold), level: next.level, enabled: next.enabled };
    if (rule.enabled && !next.enabled) {
      modalMode = 'disable';
      mountModal(confirmHtml('停用预警规则', '停用后不再新触发「' + rule.name + '」。已经打开的预警仍按触发时的阈值自动恢复。', '确认停用', 'wrConfirmSave()'), 420);
      return;
    }
    applySave(next);
  }

  window.wrApplyFilters = function () {
    filters.type = (document.getElementById('wrFilterType') || {}).value || '';
    filters.level = (document.getElementById('wrFilterLevel') || {}).value || '';
    filters.enabled = (document.getElementById('wrFilterEnabled') || {}).value || '';
    page = 1;
    if (window.app) window.app.render();
  };
  window.wrResetFilters = function () {
    filters = { type: '', level: '', enabled: '' };
    page = 1;
    if (window.app) window.app.render();
  };
  window.wrGoPage = function (next) {
    page = Math.max(1, Number(next) || 1);
    if (window.app) window.app.render();
  };
  window.wrChangePageSize = function (size) {
    pageSize = Number(size) || 20;
    page = 1;
    if (window.app) window.app.render();
  };
  window.wrOpenEdit = function (id) { openEdit(id); };
  window.wrRequestClose = requestClose;
  window.wrCloseModal = closeModal;
  window.wrBackToEdit = backToEdit;
  window.wrSave = save;
  window.wrConfirmSave = function () {
    var draft = window.__wrDraft;
    if (!draft) return;
    applySave({ threshold: Number(draft.threshold), level: draft.level, enabled: draft.enabled });
  };

  if (!window.app) return;
  window.app.register(PAGE, renderList, [PAGE]);
  window.app.pages[PAGE].onRender = function () { renderPagination(); };
})();
