import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sourceRoot = resolve(process.argv[2] || "/Users/dmm/Desktop/环线");
const files = [
  ["public/index.html", "public/admin/index.html"],
  ["src/app.js", "public/admin/app.js"],
  ["src/styles/global.css", "public/admin/global.css"],
  ["server/server.js", "admin-server/server.js"],
  ["server/db.js", "admin-server/db.js"],
  ["server/seed-data.js", "admin-server/seed-data.js"],
];

for (const [, destination] of files) {
  await mkdir(resolve(destination, ".."), { recursive: true });
}

for (const [source, destination] of files) {
  await cp(resolve(sourceRoot, source), resolve(destination));
}

const adminIndex = resolve("public/admin/index.html");
const html = await readFile(adminIndex, "utf8");
await writeFile(
  adminIndex,
  html
    .replace('href="/src/styles/global.css"', 'href="./global.css"')
    .replace('src="/src/app.js"', 'src="./app.js"')
    .replace('</head>', '  <link rel="stylesheet" href="./station-extension.css">\n</head>')
    .replace('  <script src="./app.js"></script>', '  <script src="./app.js"></script>\n  <script src="./station-extension.js"></script>'),
);

const adminApp = resolve("public/admin/app.js");
const appSource = await readFile(adminApp, "utf8");
await writeFile(
  adminApp,
  appSource
    .replace("  + '<div class=\"tab-item\" onclick=\"app.navigate(\\'district-management\\')\">片区管理</div>'\n", "")
    .replace("</svg>推送设置</button>'\n  + '<span class=\"toolbar-sep\"></span>", "</svg>推送设置</button>'\n  + '<button class=\"toolbar-btn\" onclick=\"app.navigate(\\'district-management\\')\">片区管理</button>'\n  + '<span class=\"toolbar-sep\"></span>"),
);

const apiServer = resolve("admin-server/server.js");
const server = await readFile(apiServer, "utf8");
await writeFile(
  apiServer,
  server
    .replace("const PUBLIC_DIR = path.join(__dirname, '..', 'public');", "const PUBLIC_DIR = path.join(__dirname, '..', 'public', 'admin');")
    .replace("const SRC_DIR = path.join(__dirname, '..', 'src');", "const SRC_DIR = PUBLIC_DIR;")
    .replace("const db = require('./db');", "const db = require('./db');\nconst stationRoutes = require('./station-routes');")
    .replace("  return sendJson(res, 404, { error: 'Not Found: ' + pathname });", `  if (pathname.startsWith('/api/stations')) {
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

  return sendJson(res, 404, { error: 'Not Found: ' + pathname });`),
);

console.log(`后台源已从 ${sourceRoot} 同步到当前项目；源目录未被修改。`);
