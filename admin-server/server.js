// ============================================================
// TMS 运输管理后台 - 后端服务 (纯 Node 实现，零外部依赖)
// 提供 REST API + 静态前端 (public/ 与 src/)
// 直接 `node server/server.js` 即可运行，无需 npm install。
// ============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const db = require('./db');
const stationRoutes = require('./station-routes');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public', 'admin');
const SRC_DIR = PUBLIC_DIR;

// ---------- 工具 ----------
function findFence(data, code) {
  return (data.fences || []).find(f => f.code === code);
}
function nextFenceCode(fences) {
  let max = 0;
  (fences || []).forEach(f => {
    const m = /^F-(\d+)$/.exec(f.code || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return 'F-' + String(max + 1).padStart(7, '0');
}
function nowStr() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

// ============================================================
// 片区（围栏归属）API —— 持久化围栏↔片区关联
// ============================================================
const INITIAL_DISTRICTS = [
  { id: 'D-YN-001', name: '云南趟次开始片区', type: '开始片区', fenceCodes: [], fenceNames: [], owner: '李调度', updated: nowStr(), note: '云南趟次起点装卸范围' },
  { id: 'D-YN-003', name: '云南趟次结束片区', type: '结束片区', fenceCodes: [], fenceNames: [], owner: '王磊', updated: nowStr(), note: '云南趟次终点装卸范围' }
];

// 片区只归集当前演示趟次实际使用的地址，并由围栏收/发货属性决定起止角色。
// 这样报表筛选、片区配置与趟次明细使用同一套业务语义。
function districtFencesByTripRole(data, type) {
  const isStart = type === '开始片区';
  const fieldNames = isStart ? ['startActual', 'startPool'] : ['endActual', 'endPool'];
  const expectedRole = isStart ? '发货区域' : '收货区域';
  const names = new Set();
  (data.trips || []).forEach(function(trip) {
    fieldNames.some(function(field) {
      if (trip[field] && trip[field] !== '—') {
        names.add(trip[field]);
        return true;
      }
      return false;
    });
  });
  const matched = (data.fences || []).filter(function(fence) {
    return names.has(fence.name) && String(fence.ioType || '').indexOf(expectedRole) >= 0;
  });
  return matched.length ? matched : (data.fences || []).filter(function(fence) {
    return String(fence.ioType || '').indexOf(expectedRole) >= 0;
  });
}

function seedDistricts(data) {
  const districts = INITIAL_DISTRICTS.map(function(d) {
    const list = districtFencesByTripRole(data, d.type);
    return Object.assign({}, d, {
      fenceCodes: list.map(function(f) { return f.code; }),
      fenceNames: list.map(function(f) { return f.name; })
    });
  });
  data.districts = districts;
  db.writeAll(data);
  return districts;
}

// 报表汇总由趟次明细派生，避免两份时间、时效数据分别维护后出现不一致。
function buildTripSummaries(data) {
  const originalByCode = {};
  (data.tripSummaries || []).forEach(function(row) { originalByCode[row[0]] = row; });
  function metric(value) { return typeof value === 'number' ? value : '—'; }
  function taskCount(value) {
    const count = parseInt(String(value || '').replace(/[^\d]/g, ''), 10);
    return isFinite(count) ? count : 0;
  }
  return (data.trips || []).map(function(trip) {
    const original = originalByCode[trip.code] || [];
    const analysis = trip.timeAnalysis || {};
    return [
      trip.code,
      original[1] || trip.vehicle || '—',
      trip.driver || original[2] || '—',
      trip.startActual || trip.startPool || '—',
      trip.endActual || trip.endPool || '—',
      trip.status || original[5] || 'p',
      trip.startTime || '—',
      trip.endTime || '—',
      trip.totalDuration || '—',
      metric((analysis.loading || {}).h),
      metric((analysis.unloading || {}).h),
      metric((analysis.driving || {}).h),
      metric((analysis.charging || {}).h),
      taskCount(trip.taskCount),
      trip.mileage || '—',
      trip.endType || '—'
    ];
  });
}

// ============================================================
// 响应辅助
// ============================================================
function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}
function readBody(req) {
  return new Promise(function(resolve) {
    let data = '';
    req.on('data', function(c) { data += c; });
    req.on('end', function() {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { resolve({}); }
    });
  });
}
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8'
};
function sendFile(res, filePath) {
  fs.readFile(filePath, function(err, buf) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(buf);
  });
}
function safeJoin(root, reqPath) {
  let decoded;
  try { decoded = decodeURIComponent(reqPath); } catch (e) { decoded = reqPath; }
  const p = path.normalize(path.join(root, decoded));
  if (p !== root && !p.startsWith(root + path.sep)) return null; // 防目录穿越
  return p;
}

// ============================================================
// API 路由
// ============================================================
async function handleApi(req, res, pathname, query) {
  const method = req.method;

  // 健康检查
  if (pathname === '/api/health' && method === 'GET') {
    return sendJson(res, 200, { ok: true, time: nowStr() });
  }

  // ---- 电子围栏 ----
  if (pathname === '/api/fences' && method === 'GET') {
    const data = db.readAll();
    let list = (data.fences || []).slice();
    const q = query || {};
    if (q.name) list = list.filter(f => (f.name || '').indexOf(q.name) >= 0);
    if (q.code) list = list.filter(f => (f.code || '').indexOf(q.code) >= 0);
    if (q.type && q.type !== '全部') list = list.filter(f => f.type === q.type);
    if (q.dept && q.dept !== '全部') list = list.filter(f => f.dept === q.dept);
    if (q.cat && q.cat !== '全部') list = list.filter(f => f.cat === q.cat);
    if (q.share && q.share !== '全部') list = list.filter(f => f.share === q.share);
    if (q.ioType && q.ioType !== '全部') list = list.filter(f => f.ioType === q.ioType);
    if (q.status && q.status !== '全部') list = list.filter(f => f.enableStatus === q.status);
    if (q.role && q.role !== '全部') list = list.filter(f => f.role === q.role);
    return sendJson(res, 200, list);
  }
  if (pathname === '/api/fences' && method === 'POST') {
    const data = db.readAll();
    const body = await readBody(req);
    const code = (body.code && String(body.code).trim()) || nextFenceCode(data.fences);
    if (findFence(data, code)) return sendJson(res, 409, { error: '围栏编码已存在: ' + code });
    const ts = nowStr();
    const fence = Object.assign({
      name: '', code: code, type: '点', cat: '', ioType: '', dept: '云南钦圣新能源科技有限公司',
      share: '部门', role: '不参与趟次', radius: 500, lng: '', lat: '', location: '',
      prov: '', city: '', dist: '', remark: '', openStatus: '已开通', account: '李调度',
      modifier: '李调度', modifyTime: ts, enableStatus: '启用', settleBody: '',
      loadTime: 0, unloadTime: 0, emptyType: '', allowance: 0, highway: ''
    }, body, { code: code, modifier: '李调度', modifyTime: ts });
    data.fences.unshift(fence);
    db.writeAll(data);
    return sendJson(res, 201, fence);
  }
  let m = /^\/api\/fences\/(.+)$/.exec(pathname);
  if (m && (method === 'GET' || method === 'PUT' || method === 'DELETE')) {
    const code = decodeURIComponent(m[1]);
    const data = db.readAll();
    const fence = findFence(data, code);
    if (!fence) return sendJson(res, 404, { error: '围栏不存在' });
    if (method === 'GET') return sendJson(res, 200, fence);
    if (method === 'PUT') {
      const body = await readBody(req);
      const updated = Object.assign({}, fence, body, { code: fence.code, modifier: '李调度', modifyTime: nowStr() });
      const idx = data.fences.indexOf(fence);
      data.fences[idx] = updated;
      db.writeAll(data);
      return sendJson(res, 200, updated);
    }
    if (method === 'DELETE') {
      const before = data.fences.length;
      data.fences = data.fences.filter(f => f.code !== code);
      if (data.fences.length === before) return sendJson(res, 404, { error: '围栏不存在' });
      db.writeAll(data);
      return sendJson(res, 200, { ok: true, deleted: code });
    }
  }

  // ---- 环线趟次 ----
  if (pathname === '/api/trips' && method === 'GET') {
    const data = db.readAll();
    return sendJson(res, 200, buildTripSummaries(data));
  }
  m = /^\/api\/trips\/(.+)$/.exec(pathname);
  if (m && method === 'GET') {
    const code = decodeURIComponent(m[1]);
    const data = db.readAll();
    const detail = (data.trips || []).find(t => t.code === code);
    if (!detail) return sendJson(res, 404, { error: '趟次不存在' });
    return sendJson(res, 200, detail);
  }
  if (pathname === '/api/trip-details' && method === 'GET') {
    const data = db.readAll();
    return sendJson(res, 200, data.trips || []);
  }

  // ---- 运费 / 司机分成系数 ----
  if (pathname === '/api/fare-settings' && method === 'GET') {
    const data = db.readAll();
    const settings = data.fareSettings || { driverRate: 0.2 };
    if (typeof settings.driverRate !== 'number') settings.driverRate = 0.2;
    return sendJson(res, 200, settings);
  }
  if (pathname === '/api/fare-settings' && method === 'PUT') {
    const body = await readBody(req);
    let rate = Number(body.driverRate);
    if (!isFinite(rate) || rate < 0 || rate > 1) {
      return sendJson(res, 400, { error: 'driverRate 必须为 0~1 之间的小数' });
    }
    const data = db.readAll();
    data.fareSettings = { driverRate: rate };
    db.writeAll(data);
    return sendJson(res, 200, data.fareSettings);
  }

  // ---- 片区（围栏归属）----
  if (pathname === '/api/districts' && method === 'GET') {
    const data = db.readAll();
    if (Array.isArray(data.districts) && data.districts.length) return sendJson(res, 200, data.districts);
    const seeded = seedDistricts(data);
    return sendJson(res, 200, seeded);
  }
  if (pathname === '/api/districts' && method === 'PUT') {
    const body = await readBody(req);
    if (!Array.isArray(body)) return sendJson(res, 400, { error: 'districts 必须为数组' });
    const data = db.readAll();
    data.districts = body;
    db.writeAll(data);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname.startsWith('/api/stations')) {
    return stationRoutes.handle({
      pathname,
      method,
      res,
      db,
      sendJson,
      readBody: () => readBody(req),
      nowStr,
    });
  }

  return sendJson(res, 404, { error: 'Not Found: ' + pathname });
}

// ============================================================
// 静态文件
// ============================================================
function handleStatic(req, res, pathname) {
  let filePath;
  if (pathname === '/' || pathname === '') {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  } else if (pathname.startsWith('/src/')) {
    const sub = pathname.slice('/src/'.length);
    const p = safeJoin(SRC_DIR, '/' + sub);
    if (!p) { res.writeHead(403); res.end('Forbidden'); return; }
    filePath = p;
  } else {
    const p = safeJoin(PUBLIC_DIR, pathname);
    if (!p) { res.writeHead(403); res.end('Forbidden'); return; }
    filePath = p;
    try {
      const st = fs.statSync(filePath);
      if (st.isDirectory()) filePath = path.join(filePath, 'index.html');
    } catch (e) { /* 交给 sendFile 报 404 */ }
  }
  sendFile(res, filePath);
}

// ============================================================
// 服务器
// ============================================================
const server = http.createServer(async function(req, res) {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const query = parsed.query || {};

  if (pathname.startsWith('/api/')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      return res.end();
    }
    try {
      await handleApi(req, res, pathname, query);
    } catch (e) {
      sendJson(res, 500, { error: String((e && e.message) || e) });
    }
    return;
  }

  handleStatic(req, res, pathname);
});

server.listen(PORT, function() {
  console.log('TMS 后台已启动(零依赖): http://localhost:' + PORT);
});
