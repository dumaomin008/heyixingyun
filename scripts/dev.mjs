import { spawn } from "node:child_process";
import { resolve } from "node:path";

const apiPort = process.env.ADMIN_API_PORT || "3100";
const api = spawn(process.execPath, ["admin-server/server.js"], {
  stdio: "inherit",
  env: { ...process.env, PORT: apiPort },
});
const vite = spawn(process.execPath, [resolve("node_modules/vite/bin/vite.js"), "--host", "127.0.0.1"], {
  stdio: "inherit",
});

function shutdown(signal) {
  api.kill(signal);
  vite.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

api.on("exit", (code) => {
  if (code && vite.exitCode === null) vite.kill("SIGTERM");
});

vite.on("exit", (code) => {
  if (api.exitCode === null) api.kill("SIGTERM");
  process.exitCode = code || 0;
});
