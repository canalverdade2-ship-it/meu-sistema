"use strict";

const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const { spawn } = require("node:child_process");
const { Pool } = require("pg");

const PORT = Number(process.env.ENCODER_ENGINE_PORT || 9210);
const TOKEN = String(process.env.ENCODER_ENGINE_TOKEN || "");
const DATABASE_URL = String(process.env.DATABASE_URL || "");
const CHANNEL_ID = String(process.env.CHANNEL_ID || "ch-main");
const UDP_PORT = Number(process.env.ENCODER_UDP_PORT || 12345);
const LOCK_DISABLED = process.env.ENCODER_LOCK_DISABLED === "true";
const STATE_FILE = String(process.env.ENCODER_STATE_FILE || "/runtime/encoder-state.json");
const FALLBACK_FILE = String(process.env.FALLBACK_FILE || "/fallback/gsa-tv-fallback-720p30.mp4");
if (TOKEN.length < 32) throw new Error("ENCODER_ENGINE_TOKEN forte é obrigatório.");
if (!DATABASE_URL) throw new Error("DATABASE_URL é obrigatória.");

const pool = new Pool({ connectionString: DATABASE_URL, max: 1, application_name: "gsa-tv-encoder-engine" });
const STATE_KEY = crypto.createHash("sha256").update(`gsa-tv-encoder-state:${TOKEN}`).digest();
let lockClient = null;
let outer = null;
let producer = null;
let outerFingerprint = "";
let producerFingerprint = "";
let desired = "stopped";
let mode = "off_air";
let lastError = null;
let lastProducerArgs = null;
let lastOuterArgs = null;
let shuttingDown = false;
const intentionalStops = new WeakSet();
let usingFallback = false;
let desiredRetryTimer = null;

function redact(value) {
  return String(value || "")
    .replace(/(rtmps?:\/\/[^\s]+\/)[^/?\s]+/gi, "$1[PROTECTED]")
    .replace(/(stream[_-]?key=)[^&\s]+/gi, "$1[PROTECTED]");
}
function log(level, message, extra = {}) {
  const safe = JSON.parse(JSON.stringify(extra, (_key, value) =>
    typeof value === "string" ? redact(value) : value
  ));
  process.stdout.write(JSON.stringify({ time: new Date().toISOString(), level, message, ...safe }) + "\n");
}
function hash(value) { return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function safeEqual(a, b) {
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function alive(proc) { return Boolean(proc && proc.exitCode === null && !proc.killed); }
function state() {
  return { desired, mode, outer_running: alive(outer), outer_pid: outer?.pid || null, producer_running: alive(producer), producer_pid: producer?.pid || null, using_fallback: usingFallback, outer_fingerprint: outerFingerprint || null, producer_fingerprint: producerFingerprint || null, last_error: lastError };
}
async function acquireLock() {
  if (LOCK_DISABLED) return;
  if (lockClient) return;
  const client = await pool.connect();
  const result = await client.query("select pg_try_advisory_lock(hashtext($1)) locked", [`gsa-tv-encoder:${CHANNEL_ID}`]);
  if (!result.rows[0]?.locked) { client.release(); throw new Error("Já existe outro encoder autorizado para este canal."); }
  lockClient = client;
}
async function releaseLock() {
  if (LOCK_DISABLED) return;
  const client = lockClient; lockClient = null;
  if (!client) return;
  try { await client.query("select pg_advisory_unlock(hashtext($1))", [`gsa-tv-encoder:${CHANNEL_ID}`]); } catch {}
  client.release();
}
async function terminate(proc, signal = "SIGTERM", timeout = 8000) {
  if (!alive(proc)) return;
  intentionalStops.add(proc);
  await new Promise((resolve) => {
    const timer = setTimeout(() => { try { proc.kill("SIGKILL"); } catch {} resolve(); }, timeout);
    proc.once("exit", () => { clearTimeout(timer); resolve(); });
    try { proc.kill(signal); } catch { clearTimeout(timer); resolve(); }
  });
}
function spawnTracked(kind, args) {
  const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
  let tail = "";
  proc.stderr.on("data", (chunk) => { tail = (tail + String(chunk)).slice(-5000); });
  proc.once("exit", (code, signal) => {
    const intentional = intentionalStops.has(proc);
    log(code === 0 || shuttingDown || intentional ? "info" : "error", `${kind}_exited`, { pid: proc.pid, code, signal, intentional, tail: redact(tail.slice(-1200)) });
    if (kind === "outer" && outer === proc) {
      outer = null;
      if (!shuttingDown && desired === "running" && lastOuterArgs) {
        lastError = redact(`transport exited (${code ?? signal}); restarting`);
        setTimeout(() => {
          if (!shuttingDown && desired === "running" && !alive(outer) && lastOuterArgs) {
            outer = spawnTracked("outer", lastOuterArgs);
            log("warn", "transport_restarted", { pid: outer.pid });
          }
        }, 1000).unref();
      }
    }
    if (kind === "producer" && producer === proc) {
      producer = null;
      if (!intentional && !shuttingDown && desired === "running" && lastProducerArgs) {
        lastError = redact(`producer exited (${code ?? signal}); switching to fallback`);
        setTimeout(() => void startFallback().catch((error) => { lastError = error.message; }), 500).unref();
      }
    }
  });
  return proc;
}
function argValue(args, name, fallback) {
  const i = args.lastIndexOf(name); return i >= 0 && i + 1 < args.length ? String(args[i + 1]) : fallback;
}
function fallbackProducerArgs() {
  if (!lastProducerArgs) throw new Error("Nenhuma configuração de produtor disponível para o fallback.");
  const destination = lastProducerArgs[lastProducerArgs.length - 1];
  const fps = argValue(lastProducerArgs, "-r", "30");
  const bitrate = argValue(lastProducerArgs, "-b:v", "6000k");
  const bufsize = argValue(lastProducerArgs, "-bufsize", "12000k");
  return [
    "-hide_banner", "-nostdin", "-loglevel", "warning", "-re", "-stream_loop", "-1", "-i", FALLBACK_FILE,
    "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black",
    "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency", "-r", fps, "-g", String(Number(fps) * 2),
    "-b:v", bitrate, "-minrate", bitrate, "-maxrate", bitrate, "-bufsize", bufsize,
    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
    "-mpegts_flags", "+resend_headers+initial_discontinuity", "-muxdelay", "0", "-muxpreload", "0", "-f", "mpegts", destination,
  ];
}
async function startFallback() {
  if (shuttingDown || desired !== "running" || alive(producer)) return;
  await fs.access(FALLBACK_FILE);
  usingFallback = true;
  producer = spawnTracked("producer", fallbackProducerArgs());
  log("warn", "fallback_started", { pid: producer.pid });
  clearTimeout(desiredRetryTimer);
  desiredRetryTimer = setTimeout(() => void retryDesiredProducer(), 30000);
  desiredRetryTimer.unref();
}
async function retryDesiredProducer() {
  if (shuttingDown || desired !== "running" || !lastProducerArgs) return;
  if (alive(producer)) await terminate(producer);
  usingFallback = false;
  producer = spawnTracked("producer", lastProducerArgs);
  log("info", "desired_producer_retry", { pid: producer.pid });
}
function encryptState(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", STATE_KEY, iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v2.${iv.toString("base64url")}.${Buffer.concat([body, tag]).toString("base64url")}`;
}
function decryptState(raw) {
  const text = String(raw || "").trim();
  if (text.startsWith("{")) {
    // One-time compatibility path for a pre-hardening local state file.
    return JSON.parse(text);
  }
  const [version, ivPart, dataPart] = text.split(".");
  if (version !== "v2" || !ivPart || !dataPart)
    throw new Error("Estado persistido do encoder possui formato inválido.");
  const packed = Buffer.from(dataPart, "base64url");
  if (packed.length <= 16) throw new Error("Estado persistido do encoder está corrompido.");
  const body = packed.subarray(0, packed.length - 16);
  const tag = packed.subarray(packed.length - 16);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    STATE_KEY,
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8"));
}
async function persistDesired(args, nextMode) {
  const temporary = STATE_FILE + ".tmp";
  const protectedState = encryptState({
    version: 2,
    desired: "running",
    mode: nextMode,
    args,
  });
  await fs.writeFile(temporary, protectedState, { mode: 0o600 });
  await fs.rename(temporary, STATE_FILE);
}
async function restoreDesired() {
  try {
    const saved = decryptState(await fs.readFile(STATE_FILE, "utf8"));
    if (saved?.desired === "running" && Array.isArray(saved.args)) {
      await ensure({ args: saved.args, mode: saved.mode || "program" });
      log("info", "desired_state_restored", { mode: saved.mode || "program" });
      if (saved.version !== 2) await persistDesired(saved.args, saved.mode || "program");
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      lastError = redact(error.message);
      log("error", "desired_state_restore_failed", { error: redact(error.message) });
    }
  }
}
function splitRelayArgs(args) {
  if (!Array.isArray(args) || args.length < 4) throw new Error("Argumentos do encoder inválidos.");
  const formatIndex = args.lastIndexOf("-f");
  if (formatIndex < 0 || args[formatIndex + 1] !== "flv" || formatIndex + 2 !== args.length - 1) throw new Error("Saída FFmpeg não reconhecida.");
  const target = String(args[args.length - 1]);
  if (!/^rtmps?:\/\//i.test(target)) throw new Error("Destino RTMP inválido.");
  const producerArgs = args.slice(0, formatIndex).concat([
    "-mpegts_flags", "+resend_headers+initial_discontinuity",
    "-muxdelay", "0", "-muxpreload", "0", "-f", "mpegts",
    `udp://127.0.0.1:${UDP_PORT}?pkt_size=1316&buffer_size=1048576`,
  ]);
  const outerArgs = [
    "-hide_banner", "-nostdin", "-loglevel", "warning",
    "-fflags", "+genpts+discardcorrupt", "-use_wallclock_as_timestamps", "1",
    "-thread_queue_size", "4096", "-i", `udp://127.0.0.1:${UDP_PORT}?fifo_size=1000000&overrun_nonfatal=1&buffer_size=1048576`,
    "-map", "0:v:0", "-map", "0:a:0?", "-c", "copy",
    "-flvflags", "no_duration_filesize", "-f", "flv", target,
  ];
  return { producerArgs, outerArgs, target };
}
async function ensure(body) {
  const { producerArgs, outerArgs } = splitRelayArgs(body.args);
  await acquireLock();
  desired = "running"; mode = String(body.mode || "program"); lastError = null;
  const nextOuter = hash(outerArgs);
  const nextProducer = hash(producerArgs);
  lastProducerArgs = producerArgs;
  await persistDesired(body.args, mode);
  let transportRestarted = false;
  let producerRestarted = false;
  if (!alive(outer) || outerFingerprint !== nextOuter) {
    const oldOuter = outer;
    lastOuterArgs = null;
    if (alive(oldOuter)) await terminate(oldOuter);
    lastOuterArgs = outerArgs;
    outer = spawnTracked("outer", outerArgs); outerFingerprint = nextOuter; transportRestarted = true;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  if (!alive(producer) || producerFingerprint !== nextProducer) {
    const old = producer;
    clearTimeout(desiredRetryTimer);
    if (alive(old)) await terminate(old);
    usingFallback = false;
    producer = spawnTracked("producer", producerArgs); producerFingerprint = nextProducer; producerRestarted = true;
  }
  return { ...state(), transport_restarted: transportRestarted, producer_restarted: producerRestarted };
}
async function stopAll() {
  desired = "stopped"; mode = "off_air"; lastProducerArgs = null; usingFallback = false;
  clearTimeout(desiredRetryTimer);
  await terminate(producer); producer = null; producerFingerprint = "";
  lastOuterArgs = null; await terminate(outer); outer = null; outerFingerprint = "";
  await releaseLock(); lastError = null;
  await fs.unlink(STATE_FILE).catch((error) => { if (error.code !== "ENOENT") throw error; });
  return state();
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; if (data.length > 1024 * 1024) req.destroy(); });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/health") { res.writeHead(alive(outer) || desired === "stopped" ? 200 : 503, { "content-type": "application/json" }); return res.end(JSON.stringify(state())); }
    if (!safeEqual(String(req.headers.authorization || "").replace(/^Bearer\s+/i, ""), TOKEN)) { res.writeHead(401); return res.end(); }
    if (req.method === "GET" && req.url === "/v1/status") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(state())); }
    if (req.method === "POST" && req.url === "/v1/ensure") { const result = await ensure(await readBody(req)); res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(result)); }
    if (req.method === "POST" && req.url === "/v1/stop") { const result = await stopAll(); res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(result)); }
    res.writeHead(404); res.end();
  } catch (error) {
    lastError = redact(error.message); log("error", "request_failed", { path: req.url, error: redact(error.message) });
    res.writeHead(500, { "content-type": "application/json" }); res.end(JSON.stringify({ error: error.message }));
  }
});
server.listen(PORT, "127.0.0.1", () => {
  log("info", "encoder_engine_started", { port: PORT, udp_port: UDP_PORT });
  void restoreDesired();
});
async function shutdown() {
  shuttingDown = true; clearTimeout(desiredRetryTimer);
  await terminate(producer).catch(() => {}); producer = null;
  await terminate(outer).catch(() => {}); outer = null;
  await releaseLock().catch(() => {});
  server.close(); await pool.end().catch(() => {});
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
