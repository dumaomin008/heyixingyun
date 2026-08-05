// ============================================================
// 数据层 (JSON 文件存储)
// 首次运行用种子数据初始化 data/app.json；之后所有读写都持久化到该文件。
// ============================================================
const fs = require('fs');
const path = require('path');
const seed = require('./seed-data');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'app.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const initial = {
      fences: seed.fences,
      trips: seed.trips,
      tripSummaries: seed.circleRows
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
    console.log('[db] 已用种子数据初始化 ' + DATA_FILE);
  }
}
ensureStore();

function readAll() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writeAll(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = { readAll, writeAll, DATA_FILE };
