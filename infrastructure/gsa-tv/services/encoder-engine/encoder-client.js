#!/usr/bin/env node
"use strict";
const http = require("node:http");
const url = new URL(process.env.ENCODER_ENGINE_URL || "http://127.0.0.1:9210");
const token = String(process.env.ENCODER_ENGINE_TOKEN || "");
const args = process.argv.slice(2);
const mode = String(process.env.GSA_ENCODER_MODE || "program");
function request(path, method = "GET", body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = http.request({ hostname: url.hostname, port: url.port, path, method, headers: { authorization: `Bearer ${token}`, ...(payload ? { "content-type": "application/json", "content-length": payload.length } : {}) } }, (res) => {
      let data = ""; res.on("data", c => data += c); res.on("end", () => res.statusCode >= 200 && res.statusCode < 300 ? resolve(data ? JSON.parse(data) : {}) : reject(new Error(`engine HTTP ${res.statusCode}: ${data}`)));
    });
    req.on("error", reject); if (payload) req.write(payload); req.end();
  });
}
(async () => {
  const started = await request("/v1/ensure", "POST", { args, mode });
  process.stdout.write(JSON.stringify({ event: "encoder_attached", ...started }) + "\n");
  const timer = setInterval(async () => {
    try {
      const status = await request("/v1/status");
      if (!status.outer_running || !status.producer_running) throw new Error(status.last_error || "encoder engine stopped");
    } catch (error) { process.stderr.write(error.message + "\n"); clearInterval(timer); process.exit(1); }
  }, 3000);
  const detach = () => { clearInterval(timer); process.exit(0); };
  process.on("SIGTERM", detach); process.on("SIGINT", detach);
})().catch((error) => { process.stderr.write(error.stack + "\n"); process.exit(1); });
