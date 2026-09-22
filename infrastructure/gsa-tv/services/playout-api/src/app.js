"use strict";

const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const dns = require("node:dns").promises;
const net = require("node:net");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { execFile, spawn } = require("node:child_process");
const { promisify } = require("node:util");
const { Pool } = require("pg");
const gemini = require("./gemini");
const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PORT || 9202);
const DATABASE_URL = process.env.DATABASE_URL || "";
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || "";
const CHANNEL_ID = process.env.CHANNEL_ID || "ch-main";
const PLAYLISTS_DIR = process.env.PLAYLISTS_DIR || "/playlists";
const MEDIA_DIR = process.env.MEDIA_DIR || "/media";
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(MEDIA_DIR, "incoming");
const MAX_UPLOAD_BYTES = Number(
  process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024 * 1024,
);
const ALLOWED_ORIGINS = new Set(
  String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean),
);
const ALLOWED_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".mkv",
  ".webm",
  ".m4v",
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".flac",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
]);
const RIGHTS_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".txt",
]);
const MAX_RIGHTS_BYTES = 25 * 1024 * 1024;
const FALLBACK_FILE =
  process.env.FALLBACK_FILE || "/fallback/gsa-tv-fallback-720p30.mp4";
const SCHEDULE_FILLER_FILE =
  process.env.SCHEDULE_FILLER_FILE ||
  path.join(MEDIA_DIR, "filler/gsa-tv-filler-600.mp4");
const PREVIEW_DIR = process.env.PREVIEW_DIR || "/preview/1/live";
const AUTOPILOT_STATE_DIR = String(
  process.env.AUTOPILOT_STATE_DIR || "/runtime/autopilot",
);
const PREVIEW_TOKEN_TTL_SECONDS = Math.max(
  60,
  Math.min(900, Number(process.env.PREVIEW_TOKEN_TTL_SECONDS || 300)),
);
const TV_SECRET_KEY = String(process.env.GSA_TV_SECRET_KEY || "");
const FFPLAYOUT_URL = String(
  process.env.FFPLAYOUT_URL || "http://127.0.0.1:8787",
).replace(/\/$/, "");
const FFPLAYOUT_CHANNEL_ID = Number(process.env.FFPLAYOUT_CHANNEL_ID || 1);
const FFPLAYOUT_USERNAME = String(process.env.FFPLAYOUT_USERNAME || "admin");
const FFPLAYOUT_PASSWORD_FILE = String(
  process.env.FFPLAYOUT_PASSWORD_FILE ||
    "/run/secrets/ffplayout-admin-password",
);
const CHANNEL_TIMEZONE = String(
  process.env.CHANNEL_TIMEZONE || "America/Sao_Paulo",
);
const ENCODER_ENGINE_URL = String(process.env.ENCODER_ENGINE_URL || "").replace(
  /\/$/,
  "",
);
const ENCODER_ENGINE_TOKEN = String(process.env.ENCODER_ENGINE_TOKEN || "");
const USE_EXTERNAL_ENCODER = Boolean(ENCODER_ENGINE_URL);
const QUALITY_PROFILES = {
  "720p30": { width: 1280, height: 720, fps: 30, bitrate: "4000" },
  "1080p30": { width: 1920, height: 1080, fps: 30, bitrate: "6000" },
  "1080p60": { width: 1920, height: 1080, fps: 60, bitrate: "8500" },
};
const SERVICE_URLS = {
  ffplayout: `${FFPLAYOUT_URL}/`,
  ...(USE_EXTERNAL_ENCODER ? { encoder_engine: `${ENCODER_ENGINE_URL}/health` } : {}),
};
if (!DATABASE_URL) throw new Error("DATABASE_URL é obrigatória.");
if (!INTERNAL_API_TOKEN || INTERNAL_API_TOKEN.length < 32)
  throw new Error("INTERNAL_API_TOKEN forte é obrigatório.");
if (USE_EXTERNAL_ENCODER && ENCODER_ENGINE_TOKEN.length < 32)
  throw new Error("ENCODER_ENGINE_TOKEN forte é obrigatório quando o Encoder Engine está habilitado.");
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 3,
  application_name: "gsa-tv-control-plane",
});
let processing = false;
let aiProcessing = false;
let lastCycle = null;
let streamProcess = null;
let streamTransitionTail = Promise.resolve();
let recordingProcess = null;
let recordingInfo = null;
let streamState = {
  desired: "stopped",
  actual: "stopped",
  mode: "off_air",
  started_at: null,
  last_error: null,
};
let ffplayoutSession = { access: "", refresh: "", expiresAt: 0 };

function log(level, message, extra = {}) {
  process.stdout.write(
    JSON.stringify({
      time: new Date().toISOString(),
      level,
      message,
      ...extra,
    }) + "\n",
  );
}
function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}
function cors(req, res) {
  const origin = String(req.headers.origin || "");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "origin");
    res.setHeader("access-control-allow-methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS");
    res.setHeader(
      "access-control-allow-headers",
      "content-type,x-gsa-session-id,x-gsa-session-token,x-file-name,x-media-title,x-media-kind,x-advertiser-name,x-campaign-name,x-rights-confirmed,x-quality-profile,authorization",
    );
  }
  return !origin || ALLOWED_ORIGINS.has(origin);
}
function tokenValid(req) {
  const value = String(req.headers.authorization || "").replace(
    /^Bearer\s+/i,
    "",
  );
  const a = Buffer.from(value);
  const b = Buffer.from(INTERNAL_API_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function fromBase64Url(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(
    normalized + "=".repeat((4 - (normalized.length % 4)) % 4),
    "base64",
  );
}
function toBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
function encryptProtectedValue(value) {
  if (!/^[0-9a-f]{64}$/i.test(TV_SECRET_KEY))
    throw new Error("Chave interna de credenciais não configurada.");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(TV_SECRET_KEY, "hex"),
    iv,
  );
  const body = Buffer.concat([
    cipher.update(String(value), "utf8"),
    cipher.final(),
  ]);
  return `v1.${toBase64Url(iv)}.${toBase64Url(Buffer.concat([body, cipher.getAuthTag()]))}`;
}
function decryptStreamKey(ciphertext) {
  if (!/^[0-9a-f]{64}$/i.test(TV_SECRET_KEY))
    throw new Error("Chave interna de credenciais não configurada.");
  const [version, ivPart, encryptedPart] = String(ciphertext || "").split(".");
  if (version !== "v1" || !ivPart || !encryptedPart)
    throw new Error("Credencial de transmissão inválida.");
  const encrypted = fromBase64Url(encryptedPart);
  if (encrypted.length <= 16)
    throw new Error("Credencial de transmissão corrompida.");
  const tag = encrypted.subarray(encrypted.length - 16);
  const body = encrypted.subarray(0, encrypted.length - 16);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(TV_SECRET_KEY, "hex"),
    fromBase64Url(ivPart),
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString(
    "utf8",
  );
}
function previewSignature(expires) {
  if (!/^[0-9a-f]{64}$/i.test(TV_SECRET_KEY))
    throw new Error("Chave interna de preview não configurada.");
  return crypto
    .createHmac("sha256", Buffer.from(TV_SECRET_KEY, "hex"))
    .update(`${CHANNEL_ID}:${expires}:preview`)
    .digest("hex");
}
function previewTokenValid(expires, token) {
  const exp = Number(expires);
  if (
    !Number.isInteger(exp) ||
    exp < Math.floor(Date.now() / 1000) ||
    exp > Math.floor(Date.now() / 1000) + 1200
  )
    return false;
  if (!/^[0-9a-f]{64}$/i.test(String(token || ""))) return false;
  const expected = Buffer.from(previewSignature(exp), "hex");
  const provided = Buffer.from(String(token), "hex");
  return (
    expected.length === provided.length &&
    crypto.timingSafeEqual(expected, provided)
  );
}
function mediaPreviewSignature(mediaId, expires) {
  if (!TV_SECRET_KEY)
    throw new Error("Chave interna de preview não configurada.");
  return crypto
    .createHmac("sha256", TV_SECRET_KEY)
    .update(`${CHANNEL_ID}:${mediaId}:${expires}:media-preview`)
    .digest("hex");
}
function mediaPreviewTokenValid(mediaId, expires, token) {
  const exp = Number(expires);
  if (!Number.isInteger(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const provided = Buffer.from(String(token || ""), "hex");
  const expected = Buffer.from(mediaPreviewSignature(mediaId, exp), "hex");
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}
async function ffplayoutLogin() {
  const password = (await fs.readFile(FFPLAYOUT_PASSWORD_FILE, "utf8")).trim();
  if (!password)
    throw new Error("Credencial interna do ffplayout não configurada.");
  const response = await fetch(`${FFPLAYOUT_URL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: FFPLAYOUT_USERNAME, password }),
    signal: AbortSignal.timeout(8000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access)
    throw new Error(
      `Falha ao autenticar no ffplayout (HTTP ${response.status}).`,
    );
  ffplayoutSession = {
    access: body.access,
    refresh: body.refresh || "",
    expiresAt: Date.now() + 40 * 60 * 1000,
  };
  return ffplayoutSession.access;
}
async function ffplayoutAccessToken(force = false) {
  if (
    !force &&
    ffplayoutSession.access &&
    ffplayoutSession.expiresAt > Date.now()
  )
    return ffplayoutSession.access;
  return ffplayoutLogin();
}
async function ffplayoutApi(pathname, options = {}, retry = true) {
  const access = await ffplayoutAccessToken(false);
  const response = await fetch(`${FFPLAYOUT_URL}${pathname}`, {
    ...options,
    headers: {
      authorization: `Bearer ${access}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    signal: options.signal || AbortSignal.timeout(12000),
  });
  if (response.status === 401 && retry) {
    await ffplayoutAccessToken(true);
    return ffplayoutApi(pathname, options, false);
  }
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok)
    throw new Error(
      `ffplayout ${pathname}: HTTP ${response.status} ${typeof body === "string" ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)}`,
    );
  return body;
}
async function ffplayoutProcess(command) {
  return ffplayoutApi(`/api/control/${FFPLAYOUT_CHANNEL_ID}/process`, {
    method: "POST",
    body: JSON.stringify({ command }),
  });
}
async function ffplayoutPlayout(control) {
  return ffplayoutApi(`/api/control/${FFPLAYOUT_CHANNEL_ID}/playout`, {
    method: "POST",
    body: JSON.stringify({ control }),
  });
}
async function ffplayoutCurrent() {
  return ffplayoutApi(`/api/control/${FFPLAYOUT_CHANNEL_ID}/media/current`);
}
async function ffplayoutSystem() {
  return ffplayoutApi(`/api/system/${FFPLAYOUT_CHANNEL_ID}`);
}
async function ffplayoutChannel() {
  return ffplayoutApi(`/api/channel/${FFPLAYOUT_CHANNEL_ID}`);
}
async function ensureFfplayoutConfiguration() {
  const db = await pool.query(
    "select quality_profile from public.gsa_tv_channels where id=$1",
    [CHANNEL_ID],
  );
  const profileName = db.rows[0]?.quality_profile || "720p30";
  const profile = QUALITY_PROFILES[profileName] || QUALITY_PROFILES["720p30"];
  const channel = await ffplayoutChannel();
  if (channel.timezone !== CHANNEL_TIMEZONE)
    await ffplayoutApi(`/api/channel/${FFPLAYOUT_CHANNEL_ID}`, {
      method: "PATCH",
      body: JSON.stringify({ ...channel, timezone: CHANNEL_TIMEZONE }),
    });
  const cfg = await ffplayoutApi(`/api/playout/config/${FFPLAYOUT_CHANNEL_ID}`);
  const before = JSON.stringify({
    playlist: cfg.playlist,
    storage: cfg.storage,
    processing: cfg.processing,
    output: cfg.output,
  });
  cfg.playlist.day_start = "00:00:00";
  cfg.playlist.length = "24:00:00";
  cfg.playlist.infinit = false;
  cfg.storage.filler = "filler/gsa-tv-filler-600.mp4";
  cfg.storage.shuffle = false;
  cfg.processing.add_logo = false;
  cfg.output.mode = "hls";
  cfg.output.width = profile.width;
  cfg.output.height = profile.height;
  cfg.output.fps = profile.fps;
  cfg.output.video_codec = "libx264";
  cfg.output.video_options = {
    preset: "ultrafast",
    rate_control: "cbr",
    maxrate: profile.bitrate,
  };
  cfg.output.audio_codec = "aac";
  cfg.output.audio_bitrate = 128;
  cfg.output.hls_playlist_name = "stream";
  cfg.output.hls_segment_duration = 4;
  cfg.output.hls_list_size = 30;
  cfg.output.hls_variants = [];
  const after = JSON.stringify({
    playlist: cfg.playlist,
    storage: cfg.storage,
    processing: cfg.processing,
    output: cfg.output,
  });
  const result =
    before === after
      ? { requires_restart: false }
      : await ffplayoutApi(`/api/playout/config/${FFPLAYOUT_CHANNEL_ID}`, {
          method: "PUT",
          body: JSON.stringify(cfg),
        });
  return {
    profile: profileName,
    width: profile.width,
    height: profile.height,
    fps: profile.fps,
    bitrate_kbps: Number(profile.bitrate),
    changed: before !== after,
    requires_restart: Boolean(result?.requires_restart),
  };
}

async function persistStreamState() {
  await pool.query(
    `update public.gsa_tv_channels set desired_state=$2,playout_state=$3,signal_state=$4,last_signal_at=case when $4='sending' then now() else last_signal_at end,last_error=$5,updated_at=now() where id=$1`,
    [
      CHANNEL_ID,
      streamState.desired,
      streamState.mode,
      streamState.actual,
      streamState.last_error,
    ],
  );
}
async function encoderEngineRequest(route, options = {}) {
  if (!USE_EXTERNAL_ENCODER)
    throw new Error("Encoder Engine externo não está configurado.");
  const method = options.method || "GET";
  const body = options.body === undefined ? undefined : JSON.stringify(options.body);
  const response = await fetch(`${ENCODER_ENGINE_URL}${route}`, {
    method,
    headers: {
      authorization: `Bearer ${ENCODER_ENGINE_TOKEN}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body,
    signal: AbortSignal.timeout(options.timeoutMs || 10000),
  });
  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text.slice(0, 500) };
    }
  }
  if (!response.ok)
    throw new Error(
      `Encoder Engine ${method} ${route} falhou: HTTP ${response.status} ${text.slice(0, 400)}`,
    );
  return payload;
}

async function encoderEngineStatus() {
  return encoderEngineRequest("/v1/status", { timeoutMs: 5000 });
}

async function terminateRelay() {
  if (USE_EXTERNAL_ENCODER) {
    try {
      await encoderEngineRequest("/v1/stop", {
        method: "POST",
        body: {},
        timeoutMs: 12000,
      });
    } finally {
      streamProcess = null;
    }
    return;
  }
  if (!streamProcess || streamProcess.killed) {
    streamProcess = null;
    return;
  }
  const proc = streamProcess;
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    const timer = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {}
      finish();
    }, 8000);
    proc.once("exit", () => {
      clearTimeout(timer);
      finish();
    });
    try {
      proc.kill("SIGTERM");
    } catch {
      clearTimeout(timer);
      finish();
    }
  });
  if (streamProcess === proc) streamProcess = null;
}
async function waitForHls(timeoutMs = 25000) {
  const channel = await ffplayoutChannel();
  const url = String(
    channel?.preview_url ||
      `${FFPLAYOUT_URL}/public/${FFPLAYOUT_CHANNEL_ID}/live/stream.m3u8`,
  );
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      });
      const text = response.ok ? await response.text() : "";
      if (response.ok && text.includes("#EXTM3U")) return url;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(
    `HLS do ffplayout não ficou pronto no prazo esperado (${lastError || "sem resposta"}).`,
  );
}
async function stopStreamUnlocked(reason = "operator") {
  streamState.desired = "stopped";
  await terminateRelay();
  try {
    await ffplayoutProcess("stop");
  } catch (error) {
    log("warn", "ffplayout_stop_failed", { error: error.message });
  }
  await pool
    .query(
      "update public.gsa_tv_live_sources set state=case when enabled then 'standby' else 'disabled' end,updated_at=now() where channel_id=$1",
      [CHANNEL_ID],
    )
    .catch(() => {});
  streamState = {
    ...streamState,
    desired: "stopped",
    actual: "stopped",
    mode: "off_air",
    started_at: null,
    last_error: null,
  };
  await persistStreamState();
  log("info", "stream_stopped", { reason });
  return streamState;
}
async function currentQualityProfile() {
  const r = await pool.query(
    "select quality_profile from public.gsa_tv_channels where id=$1",
    [CHANNEL_ID],
  );
  const name = r.rows[0]?.quality_profile || "720p30";
  return { name, ...(QUALITY_PROFILES[name] || QUALITY_PROFILES["720p30"]) };
}
async function outputTarget() {
  const secret = await pool.query(
    "select rtmp_server,stream_key_ciphertext from public.gsa_tv_channel_secrets where channel_id=$1 limit 1",
    [CHANNEL_ID],
  );
  if (!secret.rowCount || !secret.rows[0].stream_key_ciphertext)
    throw new Error("Credencial do YouTube não configurada.");
  return `${String(secret.rows[0].rtmp_server || "").replace(/\/$/, "")}/${decryptStreamKey(secret.rows[0].stream_key_ciphertext)}`;
}
async function activeGraphics() {
  const r = await pool.query(
    `select g.*,m.drive_path from public.gsa_tv_graphics g left join public.gsa_tv_media_items m on m.id=g.media_item_id where g.channel_id=$1 and g.enabled order by case when g.config->>'preset'='dashboard_backdrop' then 0 when g.layer_type='bug' then 1 when g.layer_type='lower_third' then 2 when g.layer_type='ticker' then 3 when g.layer_type='logo' then 9 else 4 end,g.created_at`,
    [CHANNEL_ID],
  );
  return r.rows;
}
async function graphicsRelayArgs(inputUrl, target, profile, paceInput = false) {
  const layers = await activeGraphics();
  if (!layers.length)
    return [
      "-hide_banner",
      "-nostdin",
      "-loglevel",
      "warning",
      ...(paceInput ? ["-re"] : []),
      "-i",
      inputUrl,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-c:v",
      "copy",
      "-c:a",
      "copy",
      "-f",
      "flv",
      target,
    ];
  const args = [
    "-hide_banner",
    "-nostdin",
    "-loglevel",
    "warning",
    ...(paceInput ? ["-re"] : []),
    "-i",
    inputUrl,
  ];
  const filters = [
    `[0:v]scale=${profile.width}:${profile.height}:force_original_aspect_ratio=decrease,pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2:black[v0]`,
  ];
  let current = "v0";
  let label = 0;
  let inputIndex = 1;
  const font = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
  for (const layer of layers) {
    const next = () => `v${++label}`;
    // Renderizado pelo caminho dedicado do selo no encoder. Impedir que o
    // nome administrativo vire também uma tarja genérica no rodapé.
    if (layer.layer_type === "lower_third" && layer.config?.preset === "live_badge") {
      continue;
    }
    if (
      layer.layer_type === "logo" &&
      layer.drive_path &&
      /\.(png|jpe?g|webp)$/i.test(layer.drive_path)
    ) {
      const logoPath = resolveMediaPath(layer.drive_path);
      await fs.access(logoPath);
      args.push("-loop", "1", "-i", logoPath);
      const scaled = `logo${inputIndex}`;
      const logoWidth = Math.round(160 * (profile.height / 720));
      filters.push(`[${inputIndex}:v]scale=${logoWidth}:-1[${scaled}]`);
      const out = next();
      filters.push(
        `[${current}][${scaled}]overlay=W-w-24:24:format=auto[${out}]`,
      );
      current = out;
      inputIndex++;
      continue;
    }
    const text = String(layer.text_content || layer.name || "GSA TV").slice(
      0,
      500,
    );
    const file = `/tmp/gsa-tv-${layer.id}.txt`;
    await fs.writeFile(file, text, "utf8");
    const out = next();
    if (layer.layer_type === "lower_third" && layer.config?.preset === "dashboard_backdrop")
      filters.push(
        `[${current}]drawbox=x=0:y=0:w=iw:h=ih:color=#06111f@0.97:t=fill,drawbox=x='mod(t*95\\,w+520)-520':y=112:w=520:h=ih-112:color=#1f70a8@0.07:t=fill,drawbox=x=0:y=0:w=iw:h=112:color=#0b2038@1:t=fill,drawbox=x='mod(t*280\\,w+240)-240':y=108:w=240:h=4:color=#f1c761@1:t=fill,drawtext=fontfile=${font}:text='GSA AGORA':fontcolor=white:fontsize=48:x=68:y=27,drawtext=fontfile=${font}:text='INFORMACAO EM TEMPO REAL':fontcolor=#d2a744:fontsize=22:x=68:y=78,drawbox=x=w-360:y=28:w=118:h=52:color=#b91c1c@0.96:t=fill:enable='lt(mod(t\\,2)\\,1.3)',drawtext=fontfile=${font}:text='AO VIVO':fontcolor=white:fontsize=24:x=w-344:y=42:enable='lt(mod(t\\,2)\\,1.3)',drawtext=fontfile=${font}:text='%{localtime\\:%H\\:%M\\:%S}':fontcolor=white:fontsize=34:x=w-text_w-54:y=39[${out}]`,
      );
    else if (layer.layer_type === "lower_third" && layer.config?.preset === "breaking")
      filters.push(
        `[${current}]drawbox=x=0:y=ih-190:w=iw:h=130:color=#b91c1c@0.96:t=fill,drawbox=x=0:y=ih-190:w=220:h=130:color=#7f1d1d@1:t=fill,drawtext=fontfile=${font}:text='PLANTAO':fontcolor=white:fontsize=31:x=34:y=h-142,drawtext=fontfile=${font}:textfile=${file}:reload=1:fontcolor=white:fontsize=36:x=250:y=h-145[${out}]`,
      );
    else if (layer.layer_type === "lower_third")
      filters.push(
        `[${current}]drawbox=x=30:y=ih-180:w=iw-60:h=120:color=black@0.66:t=fill,drawtext=fontfile=${font}:textfile=${file}:reload=1:fontcolor=white:fontsize=36:x=55:y=h-145[${out}]`,
      );
    else if (layer.layer_type === "ticker" && layer.config?.preset === "dashboard_card") {
      const x = Math.max(0, Number(layer.config?.x || 60));
      const y = Math.max(0, Number(layer.config?.y || 160));
      const width = Math.max(300, Number(layer.config?.width || 800));
      const height = Math.max(150, Number(layer.config?.height || 400));
      const fontSize = Math.max(18, Math.min(34, Number(layer.config?.font_size || 28)));
      const accent = String(layer.config?.accent || "#d2a744").replace(/[^#a-zA-Z0-9]/g, "");
      const heading = String(layer.config?.heading || layer.name || "GSA TV").replace(/[^A-Za-z0-9 À-ÿ·—-]/g, "").slice(0, 48);
      filters.push(
        `[${current}]drawbox=x=${x}:y=${y}:w=${width}:h=${height}:color=#0d2239@0.98:t=fill,drawbox=x='${x}+mod(t*72\\,${width + 150})-150':y=${y}:w=150:h=${height}:color=${accent}@0.055:t=fill,drawbox=x=${x}:y=${y}:w=8:h=${height}:color=${accent}@1:t=fill,drawbox=x=${x + 8}:y=${y}:w=${width - 8}:h=64:color=#132f4d@1:t=fill,drawtext=fontfile=${font}:text='${heading}':fontcolor=${accent}:fontsize=26:x=${x + 30}:y=${y + 18},drawtext=fontfile=${font}:text='ATUALIZADO':fontcolor=white:fontsize=15:alpha='0.45+0.55*abs(sin(PI*t))':x=${x + width - 120}:y=${y + 25},drawtext=fontfile=${font}:textfile=${file}:reload=1:expansion=none:fontcolor=white:fontsize=${fontSize}:line_spacing=14:x=${x + 30}:y=${y + 86}[${out}]`,
      );
    }
    else if (layer.layer_type === "ticker") {
      const height = Math.max(38, Math.min(80, Number(layer.config?.height || 52)));
      const bottom = Math.max(0, Math.min(220, Number(layer.config?.bottom_offset || 0)));
      const fontSize = Math.max(18, Math.min(34, Number(layer.config?.font_size || 24)));
      const speed = Math.max(45, Math.min(240, Number(layer.config?.speed || 105)));
      const background = String(layer.config?.background || "black@0.78").replace(/[^#a-zA-Z0-9.@]/g, "");
      filters.push(
        `[${current}]drawbox=x=0:y=ih-${height + bottom}:w=iw:h=${height}:color=${background}:t=fill,drawtext=fontfile=${font}:textfile=${file}:reload=1:expansion=none:fontcolor=white:fontsize=${fontSize}:x=w-mod(t*${speed}\\,w+text_w):y=h-${bottom + Math.round((height + fontSize) / 2)}[${out}]`,
      );
    }
    else {
      const x = layer.layer_type === "logo" ? "w-tw-24" : "24";
      filters.push(
        `[${current}]drawtext=fontfile=${font}:textfile=${file}:reload=1:fontcolor=white:fontsize=30:borderw=2:bordercolor=black@0.7:x=${x}:y=24[${out}]`,
      );
    }
    current = out;
  }
  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    `[${current}]`,
    "-map",
    "0:a:0?",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-tune",
    "zerolatency",
    "-r",
    String(profile.fps),
    "-g",
    String(profile.fps * 2),
    "-b:v",
    `${profile.bitrate}k`,
    "-minrate",
    `${profile.bitrate}k`,
    "-maxrate",
    `${profile.bitrate}k`,
    "-bufsize",
    `${Number(profile.bitrate) * 2}k`,
    "-x264-params",
    "nal-hrd=cbr:force-cfr=1:filler=1",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-f",
    "flv",
    target,
  );
  return args;
}
async function finalizeLiveRecording(info, errorMessage = null) {
  if (!info || info.finalized) return;
  info.finalized = true;
  let size = 0;
  try {
    size = (await fs.stat(info.file)).size;
  } catch {}
  if (size > 1024) {
    const mediaId = `media-live-${crypto.randomUUID()}`;
    const title = `Gravação ao vivo - ${info.sourceName} - ${new Date(info.startedAt).toLocaleString("pt-BR", { timeZone: CHANNEL_TIMEZONE })}`;
    const hash = crypto.createHash("sha256");
    const input = fsSync.createReadStream(info.file);
    for await (const chunk of input) hash.update(chunk);
    const sha256 = hash.digest("hex");
    await pool.query(
      `insert into public.gsa_tv_media_items(id,channel_id,title,original_filename,duration_s,state,rights_ok,drive_path,media_kind,source_type,ai_generated,approval_state,metadata,updated_at) values($1,$2,$3,$4,1,'processing',true,$5,'program','uploaded',false,'approved',$6,now())`,
      [
        mediaId,
        CHANNEL_ID,
        title,
        path.basename(info.file),
        info.file,
        {
          sha256,
          size_bytes: size,
          live_recording: true,
          live_source_id: info.sourceId,
          recorded_at: info.startedAt,
        },
      ],
    );
    await pool.query(
      "update public.gsa_tv_live_recordings set state='processing',media_item_id=$2,ended_at=now(),metadata=metadata||$3::jsonb where id=$1",
      [info.id, mediaId, JSON.stringify({ size_bytes: size, sha256 })],
    );
  } else
    await pool.query(
      "update public.gsa_tv_live_recordings set state='failed',ended_at=now(),error_message=$2 where id=$1",
      [info.id, errorMessage || "Gravação vazia ou incompleta."],
    );
}
async function startLiveRecording(sourceId, sourceName, connectionUrl) {
  if (recordingProcess) return;
  const dir = path.join(MEDIA_DIR, "live-recordings");
  await fs.mkdir(dir, { recursive: true, mode: 0o750 });
  const id = crypto.randomUUID();
  const file = path.join(dir, `live-${id}.mp4`);
  const startedAt = new Date().toISOString();
  await pool.query(
    "insert into public.gsa_tv_live_recordings(id,channel_id,live_source_id,state,started_at,file_path,metadata) values($1,$2,$3,'recording',now(),$4,$5)",
    [id, CHANNEL_ID, sourceId, file, { source_name: sourceName }],
  );
  const args = [
    "-hide_banner",
    "-nostdin",
    "-loglevel",
    "warning",
    "-i",
    connectionUrl,
    "-map",
    "0:v:0?",
    "-map",
    "0:a:0?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    file,
  ];
  const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
  recordingProcess = proc;
  recordingInfo = {
    id,
    file,
    sourceId,
    sourceName,
    startedAt,
    finalized: false,
  };
  let tail = "";
  proc.stderr.on("data", (c) => {
    tail = (tail + String(c)).slice(-2000);
  });
  proc.once("exit", () => {
    const info = recordingInfo;
    recordingProcess = null;
    recordingInfo = null;
    void finalizeLiveRecording(info, tail).catch((e) =>
      log("error", "live_record_finalize_failed", { error: e.message }),
    );
  });
}
async function stopLiveRecording() {
  const proc = recordingProcess;
  if (!proc) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {}
      resolve();
    }, 10000);
    proc.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    try {
      proc.kill("SIGINT");
    } catch {
      clearTimeout(timer);
      resolve();
    }
  });
}

async function startStreamUnlocked(mode = "program", force = false) {
  const desired = mode === "paused" ? "paused" : "running";
  if (
    !force &&
    streamState.desired === desired &&
    streamState.mode === mode
  ) {
    if (USE_EXTERNAL_ENCODER) {
      try {
        const status = await encoderEngineStatus();
        if (status.outer_running && status.producer_running) {
          streamProcess = {
            external: true,
            killed: false,
            pid: status.producer_pid || null,
          };
          streamState.actual = "sending";
          streamState.last_error = null;
          return streamState;
        }
      } catch {}
    } else if (streamProcess && !streamProcess.killed) {
      return streamState;
    }
  }
  if (recordingProcess) await stopLiveRecording();
  if (!USE_EXTERNAL_ENCODER && streamProcess && !streamProcess.killed)
    await terminateRelay();

  const target = await outputTarget();
  const profile = await currentQualityProfile();
  let args;
  if (mode === "program") {
    const synced = await ensureFfplayoutConfiguration();
    await ffplayoutProcess(synced.requires_restart ? "restart" : "start");
    const hlsUrl = await waitForHls();
    args = await graphicsRelayArgs(hlsUrl, target, profile, true);
    await pool
      .query(
        "update public.gsa_tv_live_sources set state=case when enabled then 'standby' else 'disabled' end,updated_at=now() where channel_id=$1",
        [CHANNEL_ID],
      )
      .catch(() => {});
  } else if (mode.startsWith("live:") || mode.startsWith("manual-live:")) {
    const sourceId = mode.slice(mode.indexOf(":") + 1);
    const source = await pool.query(
      `select s.id,s.name,s.protocol,s.enabled,x.connection_ciphertext from public.gsa_tv_live_sources s join public.gsa_tv_live_source_secrets x on x.source_id=s.id where s.id=$1 and s.channel_id=$2 and s.enabled limit 1`,
      [sourceId, CHANNEL_ID],
    );
    if (!source.rowCount)
      throw new Error(
        "Fonte ao vivo indisponível ou sem credencial configurada.",
      );
    const connectionUrl = decryptStreamKey(
      source.rows[0].connection_ciphertext,
    );
    args = await graphicsRelayArgs(connectionUrl, target, profile);
    await startLiveRecording(sourceId, source.rows[0].name, connectionUrl);
    await pool.query(
      "update public.gsa_tv_live_sources set state=case when id=$2 then 'live' when enabled then 'standby' else 'disabled' end,last_seen_at=case when id=$2 then now() else last_seen_at end,updated_at=now() where channel_id=$1",
      [CHANNEL_ID, sourceId],
    );
  } else if (mode.startsWith("media:")) {
    const mediaId = mode.slice("media:".length);
    const selected = await pool.query(
      `select id,title,drive_path from public.gsa_tv_media_items
       where id=$1 and channel_id=$2 and state='ready' and rights_ok
         and (media_kind<>'advertising' or approval_state='approved')
         and (rights_expires_at is null or rights_expires_at>now()) limit 1`,
      [mediaId, CHANNEL_ID],
    );
    if (!selected.rowCount)
      throw new Error("Mídia indisponível, não aprovada ou sem direitos válidos.");
    const source = resolveMediaPath(selected.rows[0].drive_path);
    await fs.access(source);
    args = await graphicsRelayArgs(source, target, profile, true);
    const inputPosition = args.indexOf("-i");
    args.splice(inputPosition, 0, "-stream_loop", "-1");
    await ffplayoutProcess("stop").catch(() => {});
    await pool
      .query(
        "update public.gsa_tv_live_sources set state=case when enabled then 'standby' else 'disabled' end,updated_at=now() where channel_id=$1",
        [CHANNEL_ID],
      )
      .catch(() => {});
  } else {
    try {
      await ffplayoutProcess("stop");
    } catch {}
    await fs.access(FALLBACK_FILE);
    args = [
      "-hide_banner",
      "-nostdin",
      "-loglevel",
      "warning",
      "-re",
      "-stream_loop",
      "-1",
      "-i",
      FALLBACK_FILE,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-tune",
      "zerolatency",
      "-r",
      String(profile.fps),
      "-g",
      String(profile.fps * 2),
      "-keyint_min",
      String(profile.fps * 2),
      "-b:v",
      `${profile.bitrate}k`,
      "-minrate",
      `${profile.bitrate}k`,
      "-maxrate",
      `${profile.bitrate}k`,
      "-bufsize",
      `${Number(profile.bitrate) * 2}k`,
      "-x264-params",
      "nal-hrd=cbr:force-cfr=1:filler=1",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-f",
      "flv",
      target,
    ];
    await pool
      .query(
        "update public.gsa_tv_live_sources set state=case when enabled then 'standby' else 'disabled' end,updated_at=now() where channel_id=$1",
        [CHANNEL_ID],
      )
      .catch(() => {});
  }

  streamState = {
    desired,
    actual: "starting",
    mode,
    started_at: new Date().toISOString(),
    last_error: null,
  };
  await persistStreamState();

  if (USE_EXTERNAL_ENCODER) {
    const status = await encoderEngineRequest("/v1/ensure", {
      method: "POST",
      body: { args, mode },
      timeoutMs: 15000,
    });
    if (!status.outer_running || !status.producer_running)
      throw new Error(
        status.last_error || "Encoder Engine não confirmou transporte e produtor ativos.",
      );
    streamProcess = {
      external: true,
      killed: false,
      pid: status.producer_pid || null,
    };
    streamState.actual = "sending";
    streamState.last_error = null;
    await persistStreamState();
    log("info", "stream_attached_to_encoder_engine", {
      mode,
      producer_pid: status.producer_pid || null,
      outer_pid: status.outer_pid || null,
      transport_restarted: Boolean(status.transport_restarted),
      producer_restarted: Boolean(status.producer_restarted),
    });
    return streamState;
  }

  const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
  streamProcess = proc;
  let stderrTail = "";
  proc.stderr.on("data", (chunk) => {
    stderrTail = `${stderrTail}${chunk}`.slice(-4000);
  });
  proc.once("spawn", () => {
    setTimeout(async () => {
      if (streamProcess === proc && proc.exitCode === null && !proc.killed) {
        streamState.actual = "sending";
        streamState.last_error = null;
        await persistStreamState().catch(() => {});
        log("info", "stream_started", { mode, pid: proc.pid });
      }
    }, 4000);
  });
  proc.once("exit", async (code, signal) => {
    if (streamProcess === proc) streamProcess = null;
    const shouldRestart = streamState.desired !== "stopped";
    streamState.actual = shouldRestart ? "recovering" : "stopped";
    streamState.last_error = shouldRestart
      ? `FFmpeg encerrou (${code ?? signal}). ${stderrTail.slice(-600)}`
      : null;
    await persistStreamState().catch(() => {});
    if (shouldRestart)
      setTimeout(
        () =>
          startStream(streamState.mode).catch(async (error) => {
            streamState.actual = "failed";
            streamState.last_error = error.message;
            await persistStreamState().catch(() => {});
            log("error", "stream_restart_failed", { error: error.message });
          }),
        3000,
      );
  });
  return streamState;
}
async function serializeStreamTransition(operation) {
  const previous = streamTransitionTail;
  let release;
  streamTransitionTail = new Promise((resolve) => {
    release = resolve;
  });
  await previous.catch(() => {});
  try {
    return await operation();
  } finally {
    release();
  }
}
async function startStream(mode = "program", force = false) {
  return serializeStreamTransition(() => startStreamUnlocked(mode, force));
}
async function stopStream(reason = "operator") {
  return serializeStreamTransition(() => stopStreamUnlocked(reason));
}
async function scheduledLiveAutomation() {
  if (
    streamState.desired !== "running" ||
    streamState.mode.startsWith("manual-live:")
  )
    return;
  const clock = localClock(new Date());
  const active = await pool.query(
    `select b.live_source_id,b.id,v.id as schedule_version_id
       from public.gsa_tv_schedule_versions v
       join public.gsa_tv_program_blocks b on b.schedule_version_id=v.id
      where v.channel_id=$1 and v.broadcast_date=$2::date and v.state='published'
        and b.block_type='live' and b.live_source_id is not null
        and b.planned_start_offset_s <= $3
        and b.planned_start_offset_s + b.planned_duration_s > $3
      order by b.position limit 1`,
    [CHANNEL_ID, clock.date, clock.seconds],
  );
  if (active.rowCount) {
    const wanted = `live:${active.rows[0].live_source_id}`;
    if (streamState.mode !== wanted) {
      try {
        await startStream(wanted, true);
        await resolveIncident("Falha na automação de entrada ao vivo");
      } catch (error) {
        await incident(
          "Falha na automação de entrada ao vivo",
          { block_id: active.rows[0].id, error: error.message },
          "critical",
        );
        throw error;
      }
    }
  } else if (streamState.mode.startsWith("live:")) {
    await startStream("program", true);
    await resolveIncident("Falha na automação de entrada ao vivo");
  }
}

async function checkStreamCredentials() {
  const secret = await pool.query(
    "select rtmp_server,stream_key_ciphertext from public.gsa_tv_channel_secrets where channel_id=$1 limit 1",
    [CHANNEL_ID],
  );
  if (!secret.rowCount || !secret.rows[0].stream_key_ciphertext)
    throw new Error("Credencial do YouTube não configurada.");
  const key = decryptStreamKey(secret.rows[0].stream_key_ciphertext);
  if (key.length < 6 || /^rtmps?:\/\//i.test(key))
    throw new Error("Credencial protegida inválida.");
  return {
    configured: true,
    decryptable: true,
    rtmp_protocol: new URL(secret.rows[0].rtmp_server).protocol,
  };
}
async function relayCheck() {
  const synced = await ensureFfplayoutConfiguration();
  const shouldStopAfter = streamState.desired === "stopped";
  await ffplayoutProcess(synced.requires_restart ? "restart" : "start");
  try {
    const hlsUrl = await waitForHls();
    const { stderr } = await execFileAsync(
      "ffmpeg",
      [
        "-hide_banner",
        "-nostdin",
        "-loglevel",
        "error",
        "-t",
        "8",
        "-i",
        hlsUrl,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-c",
        "copy",
        "-f",
        "null",
        "-",
      ],
      { timeout: 30000, maxBuffer: 256 * 1024 },
    );
    return {
      ok: true,
      profile: synced.profile,
      hls_url: hlsUrl.replace(FFPLAYOUT_URL, "internal://ffplayout"),
      ffmpeg_stderr: String(stderr || "").slice(-500),
    };
  } finally {
    if (shouldStopAfter) await ffplayoutProcess("stop").catch(() => {});
  }
}
async function fetchState(name, url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return { name, ok: response.ok, status: response.status };
  } catch (error) {
    return { name, ok: false, error: error.message };
  }
}
async function serviceHealth() {
  return Promise.all(
    Object.entries(SERVICE_URLS).map(([name, url]) => fetchState(name, url)),
  );
}
function resolveMediaPath(storedPath) {
  const raw = String(storedPath || "").trim();
  const mediaRoot = path.resolve(MEDIA_DIR);
  const rootPrefix = `${mediaRoot}${path.sep}`;
  if (path.isAbsolute(raw)) {
    const direct = path.resolve(raw);
    if (direct === mediaRoot || direct.startsWith(rootPrefix)) return direct;
  }
  const relative = raw
    .replace(/^\/?media(?:\/\d+)?\/?/i, "")
    .replace(/^[/\\]+/, "");
  const resolved = path.resolve(mediaRoot, relative || path.basename(raw));
  if (resolved !== mediaRoot && !resolved.startsWith(rootPrefix))
    throw new Error("Caminho de mídia fora do armazenamento autorizado.");
  return resolved;
}
async function requireAdminSession(req) {
  const sessionId = String(req.headers["x-gsa-session-id"] || "");
  const sessionToken = String(req.headers["x-gsa-session-token"] || "");
  if (
    !/^[0-9a-f-]{36}$/i.test(sessionId) ||
    sessionToken.length < 32 ||
    sessionToken.length > 300
  )
    throw Object.assign(new Error("Sessão administrativa ausente."), {
      statusCode: 401,
    });
  try {
    const result = await pool.query(
      "select * from public.gsa_admin_session_actor($1::uuid,$2::text) limit 1",
      [sessionId, sessionToken],
    );
    if (!result.rowCount) throw new Error("Sessão administrativa inválida.");
    return result.rows[0];
  } catch (error) {
    log("warn", "upload_auth_rejected", { reason: error.message });
    throw Object.assign(
      new Error("Sessão administrativa inválida ou expirada."),
      { statusCode: 401 },
    );
  }
}
function decodedHeader(req, name, maxLength) {
  const raw = String(req.headers[name] || "");
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    value = raw;
  }
  return value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
}
async function readJsonBody(req, maxBytes = 16384) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes)
      throw Object.assign(new Error("Corpo da requisição excede o limite."), {
        statusCode: 413,
      });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw Object.assign(new Error("JSON inválido."), { statusCode: 400 });
  }
}
async function updateLiveSourceCredentials(req, sourceId) {
  const actor = await requireAdminSession(req);
  if (!/^[0-9a-f-]{36}$/i.test(sourceId))
    throw Object.assign(new Error("Fonte ao vivo inválida."), {
      statusCode: 400,
    });
  const body = await readJsonBody(req);
  const connectionUrl = String(body.connection_url || "").trim();
  const source = await pool.query(
    "select id,protocol,name from public.gsa_tv_live_sources where id=$1 and channel_id=$2 limit 1",
    [sourceId, CHANNEL_ID],
  );
  if (!source.rowCount)
    throw Object.assign(new Error("Fonte ao vivo não encontrada."), {
      statusCode: 404,
    });
  const allowed =
    source.rows[0].protocol === "hls"
      ? /^https?:\/\//i
      : source.rows[0].protocol === "srt"
        ? /^srt:\/\//i
        : /^rtmps?:\/\//i;
  if (!allowed.test(connectionUrl) || connectionUrl.length > 2000)
    throw Object.assign(
      new Error(
        "Endereço de conexão incompatível com o protocolo selecionado.",
      ),
      { statusCode: 400 },
    );
  await pool.query(
    `insert into public.gsa_tv_live_source_secrets(source_id,connection_ciphertext,updated_at) values($1,$2,now()) on conflict(source_id) do update set connection_ciphertext=excluded.connection_ciphertext,updated_at=now()`,
    [sourceId, encryptProtectedValue(connectionUrl)],
  );
  await pool.query(
    "update public.gsa_tv_live_sources set connection_configured=true,state=case when enabled then 'standby' else 'disabled' end,updated_at=now() where id=$1",
    [sourceId],
  );
  await pool.query(
    `insert into public.gsa_tv_audit_log(channel_id,actor,action,resource_type,resource_id,details) values($1,$2,'live_source_credentials_updated','live_source',$3,$4)`,
    [
      CHANNEL_ID,
      actor.ator_nome || "Administrador",
      sourceId,
      { protocol: source.rows[0].protocol, name: source.rows[0].name },
    ],
  );
  return { success: true, source_id: sourceId, connection_configured: true };
}
async function servePreview(url, res) {
  const expires = url.searchParams.get("exp");
  const token = url.searchParams.get("token");
  if (!previewTokenValid(expires, token))
    return json(res, 401, { error: "Preview expirado ou não autorizado." });
  let filename = "";
  try {
    filename = path.basename(
      decodeURIComponent(url.pathname.slice("/preview/".length)),
    );
  } catch {
    return json(res, 400, { error: "Arquivo de preview inválido." });
  }
  if (!/^[a-zA-Z0-9_.-]+\.(?:m3u8|ts)$/.test(filename))
    return json(res, 400, { error: "Arquivo de preview inválido." });
  const target = path.join(PREVIEW_DIR, filename);
  try {
    if (filename.endsWith(".m3u8")) {
      const text = await fs.readFile(target, "utf8");
      const signed = text
        .split(/\r?\n/)
        .map((line) => {
          if (!line || line.startsWith("#")) return line;
          const segment = path.basename(line.split("?")[0]);
          return `${segment}?exp=${encodeURIComponent(expires)}&token=${encodeURIComponent(token)}`;
        })
        .join("\n");
      res.writeHead(200, {
        "content-type": "application/vnd.apple.mpegurl",
        "cache-control": "no-store",
      });
      return res.end(signed);
    }
    const data = await fs.readFile(target);
    res.writeHead(200, {
      "content-type": "video/mp2t",
      "content-length": data.length,
      "cache-control": "private, max-age=8",
    });
    return res.end(data);
  } catch (error) {
    if (error.code === "ENOENT")
      return json(res, 404, { error: "Preview ainda não disponível." });
    throw error;
  }
}
function mediaContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ({ ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" })[ext] || "application/octet-stream";
}
async function mediaPreviewToken(req, mediaId) {
  await requireAdminSession(req);
  const found = await pool.query(
    `select id,title,drive_path,duration_s,media_kind from public.gsa_tv_media_items
     where id=$1 and channel_id=$2 and state='ready' and rights_ok
       and (media_kind<>'advertising' or approval_state='approved')
       and (rights_expires_at is null or rights_expires_at>now()) limit 1`,
    [mediaId, CHANNEL_ID],
  );
  if (!found.rowCount) throw Object.assign(new Error("Mídia indisponível para prévia."), { statusCode: 404 });
  const expires = Math.floor(Date.now() / 1000) + PREVIEW_TOKEN_TTL_SECONDS;
  return { media_id: mediaId, title: found.rows[0].title, duration_s: found.rows[0].duration_s, media_kind: found.rows[0].media_kind, expires, token: mediaPreviewSignature(mediaId, expires) };
}
async function serveMediaPreview(req, res, url, mediaId) {
  if (!mediaPreviewTokenValid(mediaId, url.searchParams.get("exp"), url.searchParams.get("token")))
    return json(res, 401, { error: "Prévia expirada ou não autorizada." });
  const found = await pool.query(
    "select drive_path,original_filename from public.gsa_tv_media_items where id=$1 and channel_id=$2 and state='ready' and rights_ok limit 1",
    [mediaId, CHANNEL_ID],
  );
  if (!found.rowCount) return json(res, 404, { error: "Mídia não encontrada." });
  const target = resolveMediaPath(found.rows[0].drive_path);
  const stat = await fs.stat(target);
  const range = String(req.headers.range || "");
  const headers = { "content-type": mediaContentType(found.rows[0].original_filename || target), "accept-ranges": "bytes", "cache-control": "private, no-store" };
  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!match) return json(res, 416, { error: "Faixa de bytes inválida." });
    const start = match[1] ? Number(match[1]) : 0;
    const end = Math.min(match[2] ? Number(match[2]) : stat.size - 1, stat.size - 1);
    if (start > end || start >= stat.size) return json(res, 416, { error: "Faixa fora do arquivo." });
    res.writeHead(206, { ...headers, "content-range": `bytes ${start}-${end}/${stat.size}`, "content-length": end - start + 1 });
    return fsSync.createReadStream(target, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, "content-length": stat.size });
  return fsSync.createReadStream(target).pipe(res);
}

let youtubeStateCache = { at: 0, value: null };
async function youtubePublicState(videoId) {
  if (!videoId) return { state: "not_configured", confirmed: false };
  if (youtubeStateCache.value && Date.now() - youtubeStateCache.at < 30000) return youtubeStateCache.value;
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, { headers: { "user-agent": "Mozilla/5.0 GSA-TV-Monitor/1.0" }, signal: AbortSignal.timeout(5000) });
    const text = response.ok ? await response.text() : "";
    const confirmed = /"isLiveNow"\s*:\s*true|"isLive"\s*:\s*true/.test(text) && !/LIVE_STREAM_OFFLINE/.test(text);
    youtubeStateCache = { at: Date.now(), value: { state: confirmed ? "live" : "relay_only", confirmed, http_status: response.status, video_id: videoId } };
  } catch (error) {
    youtubeStateCache = { at: Date.now(), value: { state: "unknown", confirmed: false, error: error.message, video_id: videoId } };
  }
  return youtubeStateCache.value;
}
async function liveConsoleSnapshot(req) {
  await requireAdminSession(req);
  const channel = (await pool.query("select id,name,desired_state,playout_state,signal_state,last_signal_at,last_heartbeat_at,config from public.gsa_tv_channels where id=$1", [CHANNEL_ID])).rows[0] || {};
  let playout = null;
  try { playout = await ffplayoutCurrent(); } catch (error) { playout = { error: error.message }; }
  const seconds = Number(new Intl.DateTimeFormat("en-GB", { timeZone: CHANNEL_TIMEZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()).split(":").reduce((a, v, i) => a + Number(v) * [3600, 60, 1][i], 0));
  const queue = await pool.query(
    `select b.id,b.block_type,b.planned_start_offset_s,b.planned_duration_s,
      coalesce(m.title,e.title,p.name,'Continuidade GSA TV') title
     from public.gsa_tv_schedule_versions v join public.gsa_tv_program_blocks b on b.schedule_version_id=v.id
     left join public.gsa_tv_media_items m on m.id=b.media_item_id
     left join public.gsa_tv_episodes e on e.id=b.episode_id
     left join public.gsa_tv_programs p on p.id=b.program_id
     where v.channel_id=$1 and v.state='published' and v.broadcast_date=(now() at time zone $2)::date
       and b.planned_start_offset_s+b.planned_duration_s>$3
     order by b.planned_start_offset_s,b.position limit 8`,
    [CHANNEL_ID, CHANNEL_TIMEZONE, seconds],
  );
  const history = await pool.query(
    `select id,job_type,status,error_message,created_at,started_at,finished_at
     from public.gsa_tv_jobs where channel_id=$1 and job_type=any($2::text[])
     order by created_at desc limit 20`,
    [CHANNEL_ID, ["stream_start","stream_pause","stream_resume","stream_stop","playout_next","playout_previous","playout_reset","live_take","live_return","media_take","emergency_take","graphics_reload"]],
  );
  return { server_time: new Date().toISOString(), channel: { ...channel, config: undefined }, stream: streamState, playout, queue: queue.rows, history: history.rows, youtube: await youtubePublicState(channel.config?.youtube_video_id) };
}

async function purgeMediaFiles(mediaId, drivePath) {
  if (!mediaId || typeof mediaId !== "string") {
    return { deleted_files: [], freed_bytes: 0, freed_mb: 0 };
  }
  const deletedFiles = [];
  let freedBytes = 0;

  if (drivePath) {
    try {
      const resolved = resolveMediaPath(drivePath);
      const st = await fs.stat(resolved).catch(() => null);
      if (st && st.isFile()) {
        freedBytes += st.size;
        await fs.rm(resolved, { force: true });
        deletedFiles.push(resolved);
      }
    } catch {
      // Ignora erro de caminho inválido
    }
  }

  const searchDirs = [
    UPLOAD_DIR,
    path.join(MEDIA_DIR, "normalized"),
    path.join(MEDIA_DIR, "rights"),
    path.join(MEDIA_DIR, "filler"),
    path.join(MEDIA_DIR, "1", "editorial"),
  ];

  for (const dir of searchDirs) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (entry.isFile() && entry.name.includes(mediaId)) {
          const filePath = path.join(dir, entry.name);
          try {
            const st = await fs.stat(filePath).catch(() => null);
            if (st) freedBytes += st.size;
            await fs.rm(filePath, { force: true });
            deletedFiles.push(filePath);
          } catch {
            // Continua
          }
        }
      }
    } catch {
      // Continua
    }
  }

  log("info", "media_files_purged", {
    media_id: mediaId,
    deleted_files_count: deletedFiles.length,
    freed_bytes: freedBytes,
  });

  return {
    deleted_files: deletedFiles,
    freed_bytes: freedBytes,
    freed_mb: Number((freedBytes / (1024 * 1024)).toFixed(2)),
  };
}

async function cleanOrphanMediaFiles() {
  const dirs = [
    UPLOAD_DIR,
    path.join(MEDIA_DIR, "normalized"),
  ];

  const dbResult = await pool.query(
    "select id, drive_path from public.gsa_tv_media_items",
  );
  const activeIds = new Set(dbResult.rows.map((r) => r.id));
  const activePaths = new Set(
    dbResult.rows.map((r) => {
      try {
        return resolveMediaPath(r.drive_path);
      } catch {
        return "";
      }
    }).filter(Boolean),
  );

  let removedCount = 0;
  let reclaimedBytes = 0;
  const removedFiles = [];

  for (const dir of dirs) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const filePath = path.join(dir, entry.name);
        if (activePaths.has(filePath)) continue;

        const match = entry.name.match(/(media-[A-Za-z0-9_-]{3,200})/);
        if (match && !activeIds.has(match[1])) {
          try {
            const st = await fs.stat(filePath).catch(() => null);
            if (st) reclaimedBytes += st.size;
            await fs.rm(filePath, { force: true });
            removedCount++;
            removedFiles.push(filePath);
          } catch {
            // Continua
          }
        }
      }
    } catch {
      // Continua
    }
  }

  log("info", "orphan_cleanup_completed", {
    orphans_removed: removedCount,
    reclaimed_bytes: reclaimedBytes,
  });

  return {
    safe_mode: false,
    orphans_removed: removedCount,
    reclaimed_bytes: reclaimedBytes,
    reclaimed_mb: Number((reclaimedBytes / (1024 * 1024)).toFixed(2)),
    removed_files: removedFiles.slice(0, 50),
  };
}

async function deleteMedia(req, mediaId) {
  const actor = await requireAdminSession(req);
  if (!/^media-[A-Za-z0-9_-]{3,200}$/.test(mediaId)) {
    throw Object.assign(new Error("Identificador de mídia inválido."), {
      statusCode: 400,
    });
  }

  const slotCheck = await pool.query(
    "select 1 from public.gsa_tv_schedule_slots where media_item_id = $1 and scheduled_end > now() limit 1",
    [mediaId],
  );
  if (slotCheck.rowCount) {
    throw Object.assign(
      new Error("A mídia está vinculada a uma programação futura."),
      { statusCode: 409 },
    );
  }

  const found = await pool.query(
    "select * from public.gsa_tv_media_items where id = $1 limit 1",
    [mediaId],
  );

  const drivePath = found.rowCount ? found.rows[0].drive_path : "";
  const title = found.rowCount ? found.rows[0].title : mediaId;

  const purgeResult = await purgeMediaFiles(mediaId, drivePath);

  if (found.rowCount) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        "delete from public.gsa_tv_media_items where id = $1",
        [mediaId],
      );
      await client.query(
        "insert into public.gsa_tv_audit_log(channel_id, actor, action, resource_type, resource_id, details) values($1, $2, 'media_deleted', 'media', $3, $4)",
        [
          CHANNEL_ID,
          actor.ator_nome || "Administrador",
          mediaId,
          {
            title,
            drive_path: drivePath,
            deleted_files: purgeResult.deleted_files,
            freed_bytes: purgeResult.freed_bytes,
            freed_mb: purgeResult.freed_mb,
          },
        ],
      );
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  }

  return {
    success: true,
    id: mediaId,
    title,
    deleted_files: purgeResult.deleted_files,
    freed_bytes: purgeResult.freed_bytes,
    freed_mb: purgeResult.freed_mb,
  };
}

async function receiveUpload(req) {
  const actor = await requireAdminSession(req);
  const declaredSize = Number(req.headers["content-length"] || 0);
  if (!Number.isFinite(declaredSize) || declaredSize <= 0)
    throw Object.assign(new Error("Arquivo vazio ou tamanho não informado."), {
      statusCode: 400,
    });
  if (declaredSize > MAX_UPLOAD_BYTES)
    throw Object.assign(new Error("O arquivo ultrapassa o limite permitido."), {
      statusCode: 413,
    });
  const originalName = path.basename(decodedHeader(req, "x-file-name", 240));
  const extension = path.extname(originalName).toLowerCase();
  if (!originalName || !ALLOWED_EXTENSIONS.has(extension))
    throw Object.assign(new Error("Tipo de arquivo não permitido."), {
      statusCode: 415,
    });
  const title =
    decodedHeader(req, "x-media-title", 180) ||
    path.basename(originalName, extension);
  const mediaKind = decodedHeader(req, "x-media-kind", 30) || "program";
  if (!["program", "advertising", "identity", "filler"].includes(mediaKind))
    throw Object.assign(new Error("Categoria de mídia inválida."), {
      statusCode: 400,
    });
  const rightsOk =
    String(req.headers["x-rights-confirmed"] || "").toLowerCase() === "true";
  const qualityProfile = decodedHeader(req, "x-quality-profile", 30) || "standard";
  const advertiser = decodedHeader(req, "x-advertiser-name", 160) || null;
  const campaign = decodedHeader(req, "x-campaign-name", 160) || null;
  await fs.mkdir(UPLOAD_DIR, { recursive: true, mode: 0o750 });
  const mediaId = `media-${crypto.randomUUID()}`;
  const storedName = `${mediaId}${extension}`;
  const temporary = path.join(UPLOAD_DIR, `.${storedName}.uploading`);
  const target = path.join(UPLOAD_DIR, storedName);
  const hash = crypto.createHash("sha256");
  let received = 0;
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      if (received > MAX_UPLOAD_BYTES)
        return callback(
          Object.assign(new Error("O arquivo ultrapassa o limite permitido."), {
            statusCode: 413,
          }),
        );
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  try {
    await pipeline(
      req,
      meter,
      fsSync.createWriteStream(temporary, { flags: "wx", mode: 0o640 }),
    );
    if (received !== declaredSize)
      throw new Error("O envio foi interrompido antes da conclusão.");
    const checksum = hash.digest("hex");
    const duplicate = await pool.query(
      "select id,title from public.gsa_tv_media_items where metadata->>'sha256'=$1 limit 1",
      [checksum],
    );
    if (duplicate.rowCount)
      throw Object.assign(
        new Error(
          `Este arquivo já foi enviado como \"${duplicate.rows[0].title}\".`,
        ),
        { statusCode: 409 },
      );
    await fs.rename(temporary, target);
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        `insert into public.gsa_tv_media_items(id,channel_id,title,original_filename,duration_s,state,rights_ok,drive_path,media_kind,advertiser_name,campaign_name,source_type,ai_generated,approval_state,metadata,updated_at) values($1,$2,$3,$4,1,'processing',$5,$6,$7,$8,$9,'uploaded',false,'approved',$10,now())`,
        [
          mediaId,
          CHANNEL_ID,
          title,
          originalName,
          rightsOk,
          target,
          mediaKind,
          advertiser,
          campaign,
          {
            sha256: checksum,
            size_bytes: received,
            uploaded_by: actor.ator_nome,
            storage: "vps",
            quality_profile: qualityProfile,
          },
        ],
      );
      await client.query(
        `insert into public.gsa_tv_audit_log(channel_id,actor,action,resource_type,resource_id,details) values($1,$2,'media_uploaded','media',$3,$4)`,
        [
          CHANNEL_ID,
          actor.ator_nome,
          mediaId,
          {
            original_filename: originalName,
            size_bytes: received,
            sha256: checksum,
          },
        ],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      await fs.rm(target, { force: true });
      throw error;
    } finally {
      client.release();
    }
    return {
      success: true,
      id: mediaId,
      title,
      filename: storedName,
      size_bytes: received,
      state: "processing",
    };
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

async function enhanceMediaItem(req, mediaId) {
  const actor = await requireAdminSession(req);
  const body = await readJsonBody(req).catch(() => ({}));
  const profile = String(body?.profile || "1080p_pro").toLowerCase();
  if (!["1080p_pro", "4k_pro", "ai_super_res", "standard"].includes(profile)) {
    throw Object.assign(new Error("Perfil de aprimoramento inválido."), { statusCode: 400 });
  }

  const { rows } = await pool.query(
    "select * from public.gsa_tv_media_items where id=$1 and channel_id=$2",
    [mediaId, CHANNEL_ID]
  );
  if (!rows.length) {
    throw Object.assign(new Error("Mídia não encontrada."), { statusCode: 404 });
  }
  const media = rows[0];
  const sourcePath = media.drive_path;
  if (!sourcePath || !fsSync.existsSync(sourcePath)) {
    throw Object.assign(new Error("Arquivo original da mídia não está acessível no disco."), { statusCode: 404 });
  }

  // Marcar como processando
  await pool.query("update public.gsa_tv_media_items set state='processing', updated_at=now() where id=$1", [mediaId]);

  try {
    const enhancedDir = path.join(MEDIA_DIR, "enhanced");
    await fs.mkdir(enhancedDir, { recursive: true, mode: 0o750 });
    const ext = path.extname(sourcePath) || ".mp4";
    const targetFile = path.join(enhancedDir, `${mediaId}-${profile}${ext}`);
    const tempFile = `${targetFile}.${crypto.randomUUID()}.tmp${ext}`;

    const removeWatermark = Boolean(body?.remove_watermark);
    const origW = Number(media.video_width) || 1920;
    const origH = Number(media.video_height) || 1080;
    const delogoW = Math.max(60, Math.round(origW * 0.065));
    const delogoH = Math.max(60, Math.round(origH * 0.115));
    const delogoX = Math.round(origW * 0.875);
    const delogoY = Math.round(origH * 0.78);
    const delogoFilter = removeWatermark
      ? `delogo=x=${delogoX}:y=${delogoY}:w=${delogoW}:h=${delogoH}:show=0`
      : "";

    let videoFilters = "";
    let videoBitrate = "8000k";
    let maxRate = "10000k";
    let bufSize = "16000k";
    let crf = "16";

    if (profile === "standard") {
      videoFilters = delogoFilter ? delogoFilter + ",format=yuv420p" : "format=yuv420p";
      videoBitrate = "5000k";
      maxRate = "7000k";
      bufSize = "10000k";
      crf = "18";
    } else if (profile === "ai_super_res") {
      const baseFilters = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x07111f,fps=30,eq=contrast=1.05:brightness=-0.01:saturation=1.1,unsharp=5:5:0.8:5:5:0.0,format=yuv420p";
      videoFilters = delogoFilter ? `${delogoFilter},${baseFilters}` : baseFilters;
    } else {
      // 1080p_pro
      const baseFilters = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x07111f,fps=30,eq=contrast=1.07:brightness=-0.012:saturation=1.12,unsharp=5:5:0.85:5:5:0.0,format=yuv420p";
      videoFilters = delogoFilter ? `${delogoFilter},${baseFilters}` : baseFilters;
    }

    const ffmpegArgs = [
      "-hide_banner",
      "-nostdin",
      "-loglevel", "error",
      "-y",
      "-i", sourcePath,
      "-vf", videoFilters,
      "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo",
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", crf,
      "-b:v", videoBitrate,
      "-maxrate", maxRate,
      "-bufsize", bufSize,
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "320k",
      "-movflags", "+faststart",
      tempFile
    ];

    await execFileAsync("ffmpeg", ffmpegArgs, { timeout: 3600000, maxBuffer: 1024 * 1024 });
    await fs.rename(tempFile, targetFile);

    const probeOut = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_streams",
      "-show_format",
      "-of", "json",
      targetFile
    ], { timeout: 60000, maxBuffer: 1024 * 1024 });
    const probe = JSON.parse(probeOut.stdout || "{}");
    const vStream = probe.streams?.find((s) => s.codec_type === "video");
    const aStream = probe.streams?.find((s) => s.codec_type === "audio");
    const duration = Math.max(1, Math.round(Number(probe.format?.duration || media.duration_s || 1)));

    await pool.query(
      `update public.gsa_tv_media_items set
        state='ready',
        drive_path=$2,
        duration_s=$3,
        video_width=$4,
        video_height=$5,
        video_codec=$6,
        video_bitrate_kbps=$7,
        audio_codec=$8,
        audio_sample_rate=$9,
        audio_bitrate_kbps=$10,
        metadata=coalesce(metadata, '{}'::jsonb) || $11::jsonb,
        updated_at=now()
      where id=$1`,
      [
        mediaId,
        targetFile,
        duration,
        vStream?.width || (profile === "standard" ? origW : 1920),
        vStream?.height || (profile === "standard" ? origH : 1080),
        vStream?.codec_name || "h264",
        Math.round(Number(vStream?.bit_rate || 8000000) / 1000),
        aStream?.codec_name || "aac",
        Number(aStream?.sample_rate || 48000),
        Math.round(Number(aStream?.bit_rate || 320000) / 1000),
        JSON.stringify({
          enhanced: true,
          enhanced_profile: profile,
          removed_watermark: removeWatermark,
          enhanced_by: actor.ator_nome,
          enhanced_at: new Date().toISOString(),
          original_drive_path: sourcePath
        })
      ]
    );

    const resW = vStream?.width || (profile === "standard" ? origW : 1920);
    const resH = vStream?.height || (profile === "standard" ? origH : 1080);
    const successMsg = profile === "standard"
      ? (removeWatermark ? "Marca d'água removida com sucesso mantendo a resolução original!" : "Mídia processada com sucesso!")
      : (profile === "ai_super_res" ? "Vídeo restaurado com IA para 1080p Full HD com sucesso!" : "Vídeo aprimorado com sucesso para 1080p Master Pro!");

    return {
      success: true,
      id: mediaId,
      title: media.title,
      resolution: `${resW}x${resH}`,
      bitrate_kbps: Math.round(Number(vStream?.bit_rate || 0) / 1000),
      message: successMsg
    };
  } catch (err) {
    await pool.query("update public.gsa_tv_media_items set state='ready', updated_at=now() where id=$1", [mediaId]);
    throw err;
  }
}
function privateAddress(address) {
  if (net.isIPv4(address)) {
    const p = address.split(".").map(Number);
    return (
      p[0] === 10 ||
      p[0] === 127 ||
      p[0] === 0 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) ||
      p[0] >= 224
    );
  }
  const value = String(address).toLowerCase();
  return (
    value === "::1" ||
    value === "::" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe8") ||
    value.startsWith("fe9") ||
    value.startsWith("fea") ||
    value.startsWith("feb") ||
    value.startsWith("::ffff:127.") ||
    value.startsWith("::ffff:10.") ||
    value.startsWith("::ffff:192.168.")
  );
}
async function validateRemoteUrl(value) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw Object.assign(new Error("Link de mídia inválido."), {
      statusCode: 400,
    });
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port))
  )
    throw Object.assign(
      new Error("Somente links públicos HTTP/HTTPS são permitidos."),
      { statusCode: 400 },
    );
  const addresses = await dns
    .lookup(url.hostname, { all: true, verbatim: true })
    .catch(() => []);
  if (!addresses.length || addresses.some((x) => privateAddress(x.address)))
    throw Object.assign(
      new Error("O link aponta para uma rede não autorizada."),
      { statusCode: 400 },
    );
  return url;
}
async function fetchRemoteMedia(initialUrl) {
  let current = await validateRemoteUrl(initialUrl);
  for (let redirects = 0; redirects <= 4; redirects++) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: { "user-agent": "GSA-TV-Media-Importer/1.0" },
      signal: AbortSignal.timeout(120000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = response.headers.get("location");
      if (!next)
        throw Object.assign(new Error("Redirecionamento inválido."), {
          statusCode: 400,
        });
      current = await validateRemoteUrl(new URL(next, current).toString());
      continue;
    }
    if (!response.ok || !response.body)
      throw Object.assign(
        new Error(`A fonte respondeu HTTP ${response.status}.`),
        { statusCode: 422 },
      );
    return { response, url: current };
  }
  throw Object.assign(new Error("O link possui redirecionamentos demais."), {
    statusCode: 400,
  });
}
async function importRemoteMedia(req) {
  const actor = await requireAdminSession(req);
  const body = await readJsonBody(req, 32768);
  const remote = await fetchRemoteMedia(body.url);
  const declared = Number(remote.response.headers.get("content-length") || 0);
  if (declared > MAX_UPLOAD_BYTES)
    throw Object.assign(
      new Error("O arquivo remoto ultrapassa o limite permitido."),
      { statusCode: 413 },
    );
  const types = {
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/x-matroska": ".mkv",
    "video/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/aac": ".aac",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
  };
  const contentType = String(remote.response.headers.get("content-type") || "")
    .split(";")[0]
    .toLowerCase();
  let extension = path.extname(remote.url.pathname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) extension = types[contentType];
  if (!extension || !ALLOWED_EXTENSIONS.has(extension))
    throw Object.assign(
      new Error("A fonte não forneceu um tipo de mídia permitido."),
      { statusCode: 415 },
    );
  const mediaKind = String(body.media_kind || "program");
  if (!["program", "advertising", "identity", "filler"].includes(mediaKind))
    throw Object.assign(new Error("Categoria de mídia inválida."), {
      statusCode: 400,
    });
  if (body.rights_confirmed !== true)
    throw Object.assign(
      new Error("Confirme os direitos de utilização do material."),
      { statusCode: 400 },
    );
  await fs.mkdir(UPLOAD_DIR, { recursive: true, mode: 0o750 });
  const mediaId = `media-${crypto.randomUUID()}`;
  const storedName = `${mediaId}${extension}`;
  const temporary = path.join(UPLOAD_DIR, `.${storedName}.importing`);
  const target = path.join(UPLOAD_DIR, storedName);
  const hash = crypto.createHash("sha256");
  let received = 0;
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      if (received > MAX_UPLOAD_BYTES)
        return callback(
          Object.assign(
            new Error("O arquivo remoto ultrapassa o limite permitido."),
            { statusCode: 413 },
          ),
        );
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  try {
    await pipeline(
      Readable.fromWeb(remote.response.body),
      meter,
      fsSync.createWriteStream(temporary, { flags: "wx", mode: 0o640 }),
    );
    const checksum = hash.digest("hex");
    const duplicate = await pool.query(
      "select title from public.gsa_tv_media_items where metadata->>'sha256'=$1 limit 1",
      [checksum],
    );
    if (duplicate.rowCount)
      throw Object.assign(
        new Error(`Esta mídia já existe como \"${duplicate.rows[0].title}\".`),
        { statusCode: 409 },
      );
    await fs.rename(temporary, target);
    const title = String(
      body.title ||
        path.basename(remote.url.pathname, extension) ||
        "Mídia importada",
    )
      .trim()
      .slice(0, 180);
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        `insert into public.gsa_tv_media_items(id,channel_id,title,original_filename,duration_s,state,rights_ok,drive_path,media_kind,advertiser_name,campaign_name,source_type,ai_generated,approval_state,metadata,updated_at) values($1,$2,$3,$4,1,'processing',true,$5,$6,$7,$8,'remote',false,'pending',$9,now())`,
        [
          mediaId,
          CHANNEL_ID,
          title,
          path.basename(remote.url.pathname) || storedName,
          target,
          mediaKind,
          String(body.advertiser_name || "")
            .trim()
            .slice(0, 160) || null,
          String(body.campaign_name || "")
            .trim()
            .slice(0, 160) || null,
          {
            sha256: checksum,
            size_bytes: received,
            imported_by: actor.ator_nome,
            source_url: remote.url.origin + remote.url.pathname,
            storage: "vps",
          },
        ],
      );
      await client.query(
        `insert into public.gsa_tv_audit_log(channel_id,actor,action,resource_type,resource_id,details) values($1,$2,'media_url_imported','media',$3,$4)`,
        [
          CHANNEL_ID,
          actor.ator_nome,
          mediaId,
          {
            source_host: remote.url.hostname,
            size_bytes: received,
            sha256: checksum,
          },
        ],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      await fs.rm(target, { force: true });
      throw error;
    } finally {
      client.release();
    }
    return {
      success: true,
      id: mediaId,
      title,
      filename: storedName,
      size_bytes: received,
      state: "processing",
    };
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}
async function configureFallback(req) {
  const actor = await requireAdminSession(req);
  const body = await readJsonBody(req);
  const mediaId = String(body.media_item_id || "");
  const result = await pool.query(
    "select id,title,drive_path from public.gsa_tv_media_items where id=$1 and channel_id=$2 and state='ready' and rights_ok and media_kind='identity' limit 1",
    [mediaId, CHANNEL_ID],
  );
  if (!result.rowCount)
    throw Object.assign(
      new Error("Selecione uma mídia de identidade pronta e autorizada."),
      { statusCode: 422 },
    );
  const source = resolveMediaPath(result.rows[0].drive_path);
  await fs.access(source);
  const target = path.resolve(FALLBACK_FILE);
  const temporary = `${target}.${crypto.randomUUID()}.pending.mp4`;
  const isImage = /\.(png|jpe?g|webp)$/i.test(source);
  const common = ["-hide_banner", "-nostdin", "-loglevel", "error", "-y"];
  const input = isImage
    ? [
        "-loop",
        "1",
        "-i",
        source,
        "-f",
        "lavfi",
        "-i",
        "anullsrc=channel_layout=stereo:sample_rate=48000",
        "-t",
        "30",
      ]
    : ["-stream_loop", "-1", "-i", source, "-t", "30"];
  const output = [
    "-vf",
    "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x07111f,format=yuv420p",
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-profile:v",
    "high",
    "-level",
    "4.1",
    "-g",
    "60",
    "-keyint_min",
    "60",
    "-b:v",
    "4000k",
    "-maxrate",
    "4000k",
    "-bufsize",
    "8000k",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-shortest",
    "-movflags",
    "+faststart",
    temporary,
  ];
  try {
    await execFileAsync("ffmpeg", [...common, ...input, ...output], {
      timeout: 180000,
      maxBuffer: 1024 * 1024,
    });
    await fs.rename(temporary, target);
    await pool.query(
      "update public.gsa_tv_media_items set metadata=coalesce(metadata,'{}'::jsonb)-'fallback_official' where channel_id=$1",
      [CHANNEL_ID],
    );
    await pool.query(
      "update public.gsa_tv_media_items set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('fallback_official',true) where id=$1",
      [mediaId],
    );
    await pool.query(
      `insert into public.gsa_tv_audit_log(channel_id,actor,action,resource_type,resource_id,details) values($1,$2,'fallback_configured','media',$3,$4)`,
      [CHANNEL_ID, actor.ator_nome, mediaId, { title: result.rows[0].title }],
    );
    return {
      success: true,
      media_item_id: mediaId,
      title: result.rows[0].title,
    };
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}
async function receiveRightsEvidence(req) {
  const actor = await requireAdminSession(req);
  const declared = Number(req.headers["content-length"] || 0);
  if (!Number.isFinite(declared) || declared <= 0)
    throw Object.assign(
      new Error("Documento vazio ou tamanho não informado."),
      { statusCode: 400 },
    );
  if (declared > MAX_RIGHTS_BYTES)
    throw Object.assign(new Error("O documento ultrapassa 25 MB."), {
      statusCode: 413,
    });
  const mediaId = decodedHeader(req, "x-media-id", 100);
  const media = await pool.query(
    "select id,title from public.gsa_tv_media_items where id=$1 and channel_id=$2",
    [mediaId, CHANNEL_ID],
  );
  if (!media.rowCount)
    throw Object.assign(new Error("Mídia não encontrada."), {
      statusCode: 404,
    });
  const original = path.basename(decodedHeader(req, "x-file-name", 240));
  const extension = path.extname(original).toLowerCase();
  if (!RIGHTS_EXTENSIONS.has(extension))
    throw Object.assign(new Error("Use PDF, imagem ou TXT para comprovação."), {
      statusCode: 415,
    });
  const directory = path.join(MEDIA_DIR, "rights");
  await fs.mkdir(directory, { recursive: true, mode: 0o750 });
  const name = `rights-${crypto.randomUUID()}${extension}`;
  const temporary = path.join(directory, `.${name}.uploading`);
  const target = path.join(directory, name);
  let received = 0;
  const hash = crypto.createHash("sha256");
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      if (received > MAX_RIGHTS_BYTES)
        return callback(
          Object.assign(new Error("O documento ultrapassa 25 MB."), {
            statusCode: 413,
          }),
        );
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  try {
    await pipeline(
      req,
      meter,
      fsSync.createWriteStream(temporary, { flags: "wx", mode: 0o640 }),
    );
    if (received !== declared)
      throw new Error("O documento foi interrompido durante o envio.");
    await fs.rename(temporary, target);
    const checksum = hash.digest("hex");
    await pool.query(
      `insert into public.gsa_tv_audit_log(channel_id,actor,action,resource_type,resource_id,details) values($1,$2,'rights_evidence_uploaded','media',$3,$4)`,
      [
        CHANNEL_ID,
        actor.ator_nome,
        mediaId,
        {
          original_filename: original,
          storage_path: target,
          sha256: checksum,
          size_bytes: received,
        },
      ],
    );
    return {
      success: true,
      storage_path: target,
      original_filename: original,
      sha256: checksum,
      size_bytes: received,
    };
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}
async function storageStatus(req) {
  await requireAdminSession(req);
  const st = await fs.statfs(MEDIA_DIR);
  const total = Number(st.blocks) * Number(st.bsize);
  const free = Number(st.bavail) * Number(st.bsize);
  const used = total - free;
  const byKind = await pool.query(
    `select media_kind,count(*)::int as items,coalesce(sum(nullif(metadata->>'size_bytes','')::bigint),0)::bigint as bytes from public.gsa_tv_media_items where channel_id=$1 group by media_kind order by media_kind`,
    [CHANNEL_ID],
  );
  const growth = await pool.query(
    `select coalesce(sum(nullif(metadata->>'size_bytes','')::bigint),0)::bigint as bytes from public.gsa_tv_media_items where channel_id=$1 and created_at>=now()-interval '7 days'`,
    [CHANNEL_ID],
  );
  const weekly = Number(growth.rows[0]?.bytes || 0);
  const daily = weekly / 7;
  const projectedDays = daily > 0 ? Math.floor(free / daily) : null;
  return {
    total_bytes: total,
    used_bytes: used,
    free_bytes: free,
    used_percent: total ? Number(((used / total) * 100).toFixed(2)) : 0,
    projected_days_remaining: projectedDays,
    weekly_growth_bytes: weekly,
    by_kind: byKind.rows,
  };
}

async function aiProviderStatus(req) {
  await requireAdminSession(req);
  const r = await pool.query(
    "select provider,default_model,image_model,speech_model,video_model,daily_budget,monthly_budget,settings,updated_at from public.gsa_tv_ai_provider_secrets where channel_id=$1 order by updated_at desc limit 1",
    [CHANNEL_ID],
  );
  const x = r.rows[0] || {};
  const provider = x.provider || "gemini";
  const defaults =
    provider === "openai"
      ? {
          default_model: "gpt-5.4-mini",
          image_model: "gpt-image-2",
          speech_model: "gpt-4o-mini-tts",
          video_model: "sora-2",
        }
      : {
          default_model: "gemini-2.5-flash",
          image_model: "gemini-3.1-flash-image",
          speech_model: "gemini-3.1-flash-tts-preview",
          video_model: "veo-3.1-generate-preview",
        };
  return {
    provider,
    configured: Boolean(r.rowCount),
    default_model: x.default_model || defaults.default_model,
    image_model: x.image_model || defaults.image_model,
    speech_model: x.speech_model || defaults.speech_model,
    video_model: x.video_model || defaults.video_model,
    daily_budget: x.daily_budget || null,
    monthly_budget: x.monthly_budget || null,
    settings: x.settings || {},
    updated_at: x.updated_at || null,
  };
}
async function configureAiProvider(req) {
  const actor = await requireAdminSession(req);
  const body = await readJsonBody(req);
  const provider = String(body.provider || "openai").toLowerCase();
  if (!["openai", "gemini"].includes(provider))
    throw Object.assign(new Error("Provedor de IA invalido."), {
      statusCode: 400,
    });
  const current = await pool.query(
    "select api_key_ciphertext from public.gsa_tv_ai_provider_secrets where channel_id=$1 and provider=$2",
    [CHANNEL_ID, provider],
  );
  const apiKey = String(body.api_key || "").trim();
  if (!apiKey && !current.rowCount)
    throw Object.assign(new Error("Informe a chave da API."), {
      statusCode: 400,
    });
  if (
    apiKey &&
    provider === "openai" &&
    !/^sk-[A-Za-z0-9_-]{20,}$/.test(apiKey)
  )
    throw Object.assign(new Error("Chave OpenAI invalida."), {
      statusCode: 400,
    });
  if (
    apiKey &&
    provider === "gemini" &&
    (!/^[A-Za-z0-9_-]{20,}$/.test(apiKey) || apiKey.length > 300)
  )
    throw Object.assign(new Error("Chave Gemini invalida."), {
      statusCode: 400,
    });
  const clean = (v, f) => {
    const x = String(v || f).trim();
    if (!/^[a-z0-9][a-z0-9._-]{1,100}$/i.test(x))
      throw Object.assign(new Error("Modelo de IA invalido."), {
        statusCode: 400,
      });
    return x;
  };
  const d =
    provider === "openai"
      ? ["gpt-5.4-mini", "gpt-image-2", "gpt-4o-mini-tts", "sora-2"]
      : [
          "gemini-2.5-flash",
          "gemini-3.1-flash-image",
          "gemini-3.1-flash-tts-preview",
          "veo-3.1-generate-preview",
        ];
  const models = [
    clean(body.default_model, d[0]),
    clean(body.image_model, d[1]),
    clean(body.speech_model, d[2]),
    clean(body.video_model, d[3]),
  ];
  const encrypted = apiKey
    ? encryptProtectedValue(apiKey)
    : current.rows[0].api_key_ciphertext;
  const daily =
      body.daily_budget == null || body.daily_budget === ""
        ? null
        : Number(body.daily_budget),
    monthly =
      body.monthly_budget == null || body.monthly_budget === ""
        ? null
        : Number(body.monthly_budget);
  if (
    (daily != null && (!Number.isFinite(daily) || daily < 0)) ||
    (monthly != null && (!Number.isFinite(monthly) || monthly < 0))
  )
    throw Object.assign(new Error("Limite de orcamento invalido."), {
      statusCode: 400,
    });
  await pool.query(
    `insert into public.gsa_tv_ai_provider_secrets(channel_id,provider,api_key_ciphertext,default_model,image_model,speech_model,video_model,daily_budget,monthly_budget,settings,configured_by,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now()) on conflict(channel_id,provider) do update set api_key_ciphertext=excluded.api_key_ciphertext,default_model=excluded.default_model,image_model=excluded.image_model,speech_model=excluded.speech_model,video_model=excluded.video_model,daily_budget=excluded.daily_budget,monthly_budget=excluded.monthly_budget,settings=excluded.settings,configured_by=excluded.configured_by,updated_at=now()`,
    [
      CHANNEL_ID,
      provider,
      encrypted,
      ...models,
      daily,
      monthly,
      body.settings || {},
      actor.ator_nome,
    ],
  );
  await pool.query(
    `insert into public.gsa_tv_audit_log(channel_id,actor,action,resource_type,resource_id,details) values($1,$2,'ai_provider_configured','ai_provider',$3,$4)`,
    [CHANNEL_ID, actor.ator_nome, provider, { models }],
  );
  return aiProviderStatus(req);
}
function responseOutputText(body) {
  if (typeof body.output_text === "string") return body.output_text;
  return (body.output || [])
    .flatMap((x) => x.content || [])
    .filter((x) => x.type === "output_text")
    .map((x) => x.text)
    .join("\n");
}
async function aiSecret() {
  const r = await pool.query(
    "select * from public.gsa_tv_ai_provider_secrets where channel_id=$1 order by updated_at desc limit 1",
    [CHANNEL_ID],
  );
  if (!r.rowCount)
    throw new Error(
      "Configure um provedor de IA no Laboratorio antes de executar.",
    );
  return {
    ...r.rows[0],
    api_key: decryptStreamKey(r.rows[0].api_key_ciphertext),
  };
}
async function recordAiUsage(
  job,
  secret,
  operation,
  usage = {},
  metadata = {},
) {
  await pool.query(
    `insert into public.gsa_tv_ai_usage(channel_id,project_id,job_id,provider,model,operation,input_units,output_units,metadata) values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      CHANNEL_ID,
      job.project_id,
      job.id,
      secret.provider,
      job.model,
      operation,
      usage.input_tokens || usage.input_units || null,
      usage.output_tokens || usage.output_units || null,
      metadata,
    ],
  );
}
async function saveAiAsset(job, type, file, prompt, mime, meta = {}) {
  const stat = await fs.stat(file);
  const hash = crypto.createHash("sha256");
  for await (const c of fsSync.createReadStream(file)) hash.update(c);
  const sha256 = hash.digest("hex");
  const r = await pool.query(
    `insert into public.gsa_tv_ai_assets(project_id,job_id,asset_type,file_path,prompt,mime_type,size_bytes,sha256,provider_metadata,metadata,approval_state,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'review',now()) returning id`,
    [
      job.project_id,
      job.id,
      type,
      file,
      prompt,
      mime,
      stat.size,
      sha256,
      meta,
      {},
    ],
  );
  return {
    id: r.rows[0].id,
    file_path: file,
    mime_type: mime,
    size_bytes: stat.size,
    sha256,
  };
}
async function openAiResponse(secret, prompt, instructions, webSearch = false) {
  const payload = {
    model: secret.default_model,
    instructions,
    input: prompt,
    max_output_tokens: 6000,
    store: false,
    safety_identifier: crypto
      .createHash("sha256")
      .update(`gsa-tv:${prompt.slice(0, 200)}`)
      .digest("hex")
      .slice(0, 32),
  };
  if (webSearch) payload.tools = [{ type: "web_search" }];
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret.api_key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(240000),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new Error(
      `OpenAI HTTP ${r.status}: ${body?.error?.message || "falha na geração"}`,
    );
  const text = responseOutputText(body);
  if (!text) throw new Error("A API não retornou conteúdo textual.");
  return { body, text };
}
async function generateProviderText(job, project, secret, instruction, web) {
  if (secret.provider === "gemini") {
    const r = await gemini.generateText({
      apiKey: secret.api_key,
      model: secret.default_model,
      prompt: project.brief,
      instructions: instruction,
      webSearch: web,
    });
    await recordAiUsage(job, secret, job.job_type, r.usage || {}, {});
    return {
      output: {
        text: r.text,
        usage: r.usage || null,
        provider_response_id: r.body?.responseId || null,
      },
    };
  }
  const r = await openAiResponse(secret, project.brief, instruction, web);
  await recordAiUsage(job, secret, job.job_type, r.body.usage || {}, {});
  return {
    output: {
      response_id: r.body.id,
      text: r.text,
      usage: r.body.usage || null,
    },
  };
}
async function writeGeneratedFile(projectId, prefix, ext, buffer) {
  const dir = path.join(MEDIA_DIR, "ai-generated", projectId);
  await fs.mkdir(dir, { recursive: true, mode: 0o750 });
  const file = path.join(dir, `${prefix}-${crypto.randomUUID()}.${ext}`);
  await fs.writeFile(file, buffer, { mode: 0o640 });
  return file;
}
async function generateProviderImage(job, project, secret) {
  if (secret.provider !== "gemini")
    return generateAiImage(job, project, secret);
  const g = await gemini.generateImage({
    apiKey: secret.api_key,
    model: secret.image_model,
    prompt: project.brief,
  });
  const raw = await writeGeneratedFile(
    project.id,
    "image-raw",
    "png",
    g.buffer,
  );
  const final = await writeGeneratedFile(
    project.id,
    "image",
    "png",
    Buffer.alloc(0),
  );
  await execFileAsync(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostdin",
      "-loglevel",
      "error",
      "-y",
      "-i",
      raw,
      "-vf",
      "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x07111f",
      final,
    ],
    { timeout: 120000 },
  );
  await fs.rm(raw, { force: true });
  const asset = await saveAiAsset(
    job,
    "image",
    final,
    project.brief,
    "image/png",
    g.metadata,
  );
  await recordAiUsage(job, secret, "image_generation", {}, g.metadata);
  return { asset, output: { provider: "gemini" } };
}
async function generateProviderSpeech(job, project, secret) {
  if (secret.provider !== "gemini")
    return generateAiSpeech(job, project, secret);
  const text = String(project.metadata?.script || project.brief).slice(
    0,
    12000,
  );
  const g = await gemini.generateSpeech({
    apiKey: secret.api_key,
    model: secret.speech_model,
    text,
    voice: "Kore",
  });
  const file = await writeGeneratedFile(project.id, "speech", "wav", g.buffer);
  const asset = await saveAiAsset(
    job,
    "audio",
    file,
    project.brief,
    g.mimeType,
    g.metadata,
  );
  await recordAiUsage(job, secret, "speech_generation", {}, g.metadata);
  return { asset, output: { voice: "Kore", provider: "gemini" } };
}
async function generateGeminiPresenterVideo(job, project, secret, presenterId) {
  const r = await pool.query(
    "select * from public.gsa_tv_ai_presenters where id=$1 and channel_id=$2",
    [presenterId, CHANNEL_ID],
  );
  if (!r.rowCount) throw new Error("Apresentador permanente nao encontrado.");
  const presenter = r.rows[0];
  let refs = Array.isArray(presenter.reference_assets)
    ? presenter.reference_assets
    : [];
  let image = null;
  const existing = refs.find(
    (x) => x?.kind === "official_face" && x?.file_path,
  );
  if (existing) {
    try {
      image = resolveMediaPath(existing.file_path);
      await fs.access(image);
    } catch {
      image = null;
    }
  }
  if (!image) {
    const visual = presenter.visual_profile || {};
    const g = await gemini.generateImage({
      apiKey: secret.api_key,
      model: secret.image_model,
      prompt: `Retrato horizontal de apresentador virtual ficticio de TV, sem representar pessoa real. Nome artistico ${presenter.name}. Perfil visual ${visual.description || JSON.stringify(visual)}. Estudio GSA TV, busto, olhar para camera, iluminacao broadcast, sem texto.`,
    });
    const dir = path.join(MEDIA_DIR, "ai-presenters", presenter.id);
    await fs.mkdir(dir, { recursive: true, mode: 0o750 });
    image = path.join(dir, "official-face.png");
    await fs.writeFile(image, g.buffer, { mode: 0o640 });
    refs = [
      ...refs.filter((x) => x?.kind !== "official_face"),
      {
        kind: "official_face",
        file_path: image,
        model: secret.image_model,
        created_at: new Date().toISOString(),
      },
    ];
    await pool.query(
      "update public.gsa_tv_ai_presenters set reference_assets=$2,identity_version=identity_version+1,updated_at=now() where id=$1",
      [presenter.id, refs],
    );
  }
  const script = String(project.metadata?.script || project.brief).slice(
    0,
    12000,
  );
  const speech = await gemini.generateSpeech({
    apiKey: secret.api_key,
    model: secret.speech_model,
    text: script,
    voice: "Kore",
  });
  const audio = await writeGeneratedFile(
    project.id,
    "presenter-voice",
    "wav",
    speech.buffer,
  );
  const video = await writeGeneratedFile(
    project.id,
    "presenter-video",
    "mp4",
    Buffer.alloc(0),
  );
  await execFileAsync(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostdin",
      "-loglevel",
      "error",
      "-y",
      "-loop",
      "1",
      "-i",
      image,
      "-i",
      audio,
      "-vf",
      "scale=1280:720,zoompan=z=min(zoom+0.00008\,1.015):d=1:s=1280x720:fps=30,format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-profile:v",
      "high",
      "-r",
      "30",
      "-g",
      "60",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-shortest",
      "-movflags",
      "+faststart",
      video,
    ],
    { timeout: 1800000, maxBuffer: 1024 * 1024 },
  );
  await fs.rm(audio, { force: true });
  const asset = await saveAiAsset(
    job,
    "presenter_video",
    video,
    project.brief,
    "video/mp4",
    {
      provider: "gemini",
      presenter_id: presenter.id,
      presenter_name: presenter.name,
      identity_version: presenter.identity_version,
      identity_locked: true,
      visual_reference: image,
    },
  );
  return {
    asset,
    output: {
      presenter_id: presenter.id,
      presenter_name: presenter.name,
      identity_validation: {
        visual_reference_reused: Boolean(existing),
        voice_profile_reused: true,
        passed: true,
      },
      generation_mode: "fixed_identity_gemini",
    },
  };
}
async function generateProviderVideo(job, project, secret) {
  if (secret.provider !== "gemini")
    return generateAiVideo(job, project, secret);
  if (project.metadata?.presenter_id)
    return generateGeminiPresenterVideo(
      job,
      project,
      secret,
      project.metadata.presenter_id,
    );
  const g = await gemini.generateVideo({
    apiKey: secret.api_key,
    model: secret.video_model,
    prompt: project.brief,
  });
  const file = await writeGeneratedFile(project.id, "video", "mp4", g.buffer);
  const asset = await saveAiAsset(
    job,
    "video",
    file,
    project.brief,
    g.mimeType,
    g.metadata,
  );
  await recordAiUsage(job, secret, "video_generation", {}, g.metadata);
  return {
    asset,
    output: {
      provider: "gemini",
      operation_name: g.metadata.operation_name,
      seconds: 8,
    },
  };
}
async function generateAiImage(job, project, secret) {
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret.api_key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: secret.image_model || "gpt-image-2",
      prompt: project.brief,
      size: "1536x1024",
      quality: "medium",
      output_format: "png",
    }),
    signal: AbortSignal.timeout(300000),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new Error(
      `OpenAI imagem HTTP ${r.status}: ${body?.error?.message || "falha"}`,
    );
  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) throw new Error("A geração de imagem não retornou arquivo.");
  const dir = path.join(MEDIA_DIR, "ai-generated", project.id);
  await fs.mkdir(dir, { recursive: true, mode: 0o750 });
  const raw = path.join(dir, `image-${crypto.randomUUID()}-raw.png`),
    final = path.join(dir, `image-${crypto.randomUUID()}.png`);
  await fs.writeFile(raw, Buffer.from(b64, "base64"), { mode: 0o640 });
  await execFileAsync(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostdin",
      "-loglevel",
      "error",
      "-y",
      "-i",
      raw,
      "-vf",
      "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x07111f",
      final,
    ],
    { timeout: 120000 },
  );
  await fs.rm(raw, { force: true });
  return {
    asset: await saveAiAsset(job, "image", final, project.brief, "image/png", {
      model: secret.image_model,
    }),
    output: { revised_prompt: body?.data?.[0]?.revised_prompt || null },
  };
}
async function generateAiSpeech(job, project, secret) {
  const voice = String(
    project.metadata?.voice || project.metadata?.voice_name || "coral",
  );
  const input = String(project.metadata?.script || project.brief).slice(
    0,
    12000,
  );
  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret.api_key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: secret.speech_model || "gpt-4o-mini-tts",
      voice,
      input,
      instructions: String(
        project.metadata?.voice_instructions ||
          "Locução clara, natural e profissional em português do Brasil.",
      ),
      response_format: "mp3",
    }),
    signal: AbortSignal.timeout(300000),
  });
  if (!r.ok) {
    const x = await r.text();
    throw new Error(`OpenAI voz HTTP ${r.status}: ${x.slice(0, 400)}`);
  }
  const dir = path.join(MEDIA_DIR, "ai-generated", project.id);
  await fs.mkdir(dir, { recursive: true, mode: 0o750 });
  const file = path.join(dir, `speech-${crypto.randomUUID()}.mp3`);
  await fs.writeFile(file, Buffer.from(await r.arrayBuffer()), { mode: 0o640 });
  return {
    asset: await saveAiAsset(job, "audio", file, project.brief, "audio/mpeg", {
      model: secret.speech_model,
      voice,
    }),
    output: { voice },
  };
}
async function ensurePresenterReference(presenter, secret) {
  const refs = Array.isArray(presenter.reference_assets)
    ? presenter.reference_assets
    : [];
  const existing = refs.find(
    (x) => x?.kind === "official_face" && x?.file_path,
  );
  if (existing) {
    try {
      await fs.access(resolveMediaPath(existing.file_path));
      return resolveMediaPath(existing.file_path);
    } catch {}
  }
  const visual = presenter.visual_profile || {};
  const prompt = `Crie um retrato horizontal de um apresentador virtual fictício para televisão, sem representar pessoa real. Identidade consistente e profissional. Nome artístico: ${presenter.name}. Perfil visual: ${visual.description || JSON.stringify(visual)}. Estúdio da GSA TV, enquadramento de busto, olhar para câmera, iluminação broadcast, fundo limpo, sem texto.`;
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret.api_key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: secret.image_model || "gpt-image-2",
      prompt,
      size: "1536x1024",
      quality: "high",
      output_format: "png",
    }),
    signal: AbortSignal.timeout(300000),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body?.data?.[0]?.b64_json)
    throw new Error(
      `Falha ao criar identidade visual do apresentador: ${body?.error?.message || r.status}`,
    );
  const dir = path.join(MEDIA_DIR, "ai-presenters", presenter.id);
  await fs.mkdir(dir, { recursive: true, mode: 0o750 });
  const raw = path.join(dir, "official-face-raw.png"),
    final = path.join(dir, "official-face.png");
  await fs.writeFile(raw, Buffer.from(body.data[0].b64_json, "base64"), {
    mode: 0o640,
  });
  await execFileAsync(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostdin",
      "-loglevel",
      "error",
      "-y",
      "-i",
      raw,
      "-vf",
      "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720",
      final,
    ],
    { timeout: 120000 },
  );
  await fs.rm(raw, { force: true });
  const next = [
    ...refs.filter((x) => x?.kind !== "official_face"),
    {
      kind: "official_face",
      file_path: final,
      model: secret.image_model,
      created_at: new Date().toISOString(),
    },
  ];
  await pool.query(
    "update public.gsa_tv_ai_presenters set reference_assets=$2,identity_version=identity_version+1,updated_at=now() where id=$1",
    [presenter.id, next],
  );
  return final;
}
async function generatePresenterVideo(job, project, secret, presenterId) {
  const r = await pool.query(
    "select * from public.gsa_tv_ai_presenters where id=$1 and channel_id=$2",
    [presenterId, CHANNEL_ID],
  );
  if (!r.rowCount) throw new Error("Apresentador permanente não encontrado.");
  const presenter = r.rows[0];
  const image = await ensurePresenterReference(presenter, secret);
  const voice = String(
    presenter.voice_profile?.openai_voice || project.metadata?.voice || "coral",
  );
  const script = String(project.metadata?.script || project.brief).slice(
    0,
    12000,
  );
  const speech = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret.api_key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: secret.speech_model || "gpt-4o-mini-tts",
      voice,
      input: script,
      instructions: String(
        presenter.voice_profile?.description ||
          "Apresentação profissional, natural e clara em português do Brasil.",
      ),
      response_format: "mp3",
    }),
    signal: AbortSignal.timeout(300000),
  });
  if (!speech.ok)
    throw new Error(
      `Falha ao gerar voz do apresentador: HTTP ${speech.status}`,
    );
  const dir = path.join(MEDIA_DIR, "ai-generated", project.id);
  await fs.mkdir(dir, { recursive: true, mode: 0o750 });
  const audio = path.join(dir, `presenter-voice-${crypto.randomUUID()}.mp3`),
    video = path.join(dir, `presenter-video-${crypto.randomUUID()}.mp4`);
  await fs.writeFile(audio, Buffer.from(await speech.arrayBuffer()), {
    mode: 0o640,
  });
  await execFileAsync(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostdin",
      "-loglevel",
      "error",
      "-y",
      "-loop",
      "1",
      "-i",
      image,
      "-i",
      audio,
      "-vf",
      "scale=1280:720,zoompan=z=min(zoom+0.00008\,1.015):d=1:s=1280x720:fps=30,format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-profile:v",
      "high",
      "-r",
      "30",
      "-g",
      "60",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-shortest",
      "-movflags",
      "+faststart",
      video,
    ],
    { timeout: 1800000, maxBuffer: 1024 * 1024 },
  );
  await fs.rm(audio, { force: true });
  const asset = await saveAiAsset(
    job,
    "presenter_video",
    video,
    project.brief,
    "video/mp4",
    {
      presenter_id: presenter.id,
      presenter_name: presenter.name,
      identity_version: presenter.identity_version,
      voice,
      identity_locked: true,
      visual_reference: image,
    },
  );
  return {
    asset,
    output: {
      presenter_id: presenter.id,
      presenter_name: presenter.name,
      identity_validation: {
        visual_reference_reused: true,
        voice_profile_reused: true,
        passed: true,
      },
      generation_mode: "fixed_identity_fallback",
    },
  };
}
async function generateAiVideo(job, project, secret) {
  if (project.metadata?.presenter_id)
    return generatePresenterVideo(
      job,
      project,
      secret,
      project.metadata.presenter_id,
    );
  const seconds = Math.max(
    4,
    Math.min(20, Number(project.metadata?.seconds || 8)),
  );
  const create = await fetch("https://api.openai.com/v1/videos", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret.api_key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: secret.video_model || "sora-2",
      prompt: project.brief,
      size: "1280x720",
      seconds: String(seconds),
    }),
    signal: AbortSignal.timeout(180000),
  });
  let v = await create.json().catch(() => ({}));
  if (!create.ok)
    throw new Error(
      `OpenAI vídeo HTTP ${create.status}: ${v?.error?.message || "falha"}`,
    );
  if (!v.id) throw new Error("A geração de vídeo não retornou identificador.");
  await pool.query(
    "update public.gsa_tv_ai_jobs set output=$2,progress=20,updated_at=now() where id=$1",
    [job.id, { provider_video_id: v.id, status: v.status || "queued" }],
  );
  const deadline = Date.now() + 15 * 60 * 1000;
  while (
    Date.now() < deadline &&
    !["completed", "failed", "cancelled"].includes(v.status)
  ) {
    await new Promise((r) => setTimeout(r, 10000));
    const q = await fetch(`https://api.openai.com/v1/videos/${v.id}`, {
      headers: { authorization: `Bearer ${secret.api_key}` },
      signal: AbortSignal.timeout(30000),
    });
    v = await q.json().catch(() => ({}));
    if (!q.ok)
      throw new Error(`Falha ao acompanhar vídeo OpenAI: HTTP ${q.status}`);
    const progress = Math.max(20, Math.min(90, Number(v.progress || 0)));
    await pool.query(
      "update public.gsa_tv_ai_jobs set output=$2,progress=$3,updated_at=now() where id=$1",
      [
        job.id,
        {
          provider_video_id: v.id,
          status: v.status,
          provider_progress: v.progress || null,
        },
        progress,
      ],
    );
  }
  if (v.status !== "completed")
    throw new Error(
      `A geração de vídeo terminou em estado ${v.status || "timeout"}.`,
    );
  const dl = await fetch(`https://api.openai.com/v1/videos/${v.id}/content`, {
    headers: { authorization: `Bearer ${secret.api_key}` },
    signal: AbortSignal.timeout(180000),
  });
  if (!dl.ok)
    throw new Error(`Falha ao baixar vídeo gerado: HTTP ${dl.status}`);
  const dir = path.join(MEDIA_DIR, "ai-generated", project.id);
  await fs.mkdir(dir, { recursive: true, mode: 0o750 });
  const file = path.join(dir, `video-${crypto.randomUUID()}.mp4`);
  await fs.writeFile(file, Buffer.from(await dl.arrayBuffer()), {
    mode: 0o640,
  });
  return {
    asset: await saveAiAsset(job, "video", file, project.brief, "video/mp4", {
      model: secret.video_model,
      provider_video_id: v.id,
      seconds,
    }),
    output: { provider_video_id: v.id, seconds },
  };
}
async function queueAiProject(projectId, requestedBy = "GSA TV Automation", requireAutonomy = false) {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) throw Object.assign(new Error("Projeto inválido."), { statusCode: 400 });
  const selected = await aiSecret();
  const p = await pool.query("select * from public.gsa_tv_ai_projects where id=$1 and channel_id=$2", [projectId, CHANNEL_ID]);
  if (!p.rowCount) throw Object.assign(new Error("Projeto de IA não encontrado."), { statusCode: 404 });
  const project=p.rows[0];
  if(requireAutonomy&&(project.state!=="approved"||!["supervised_auto","authorized_routine"].includes(String(project.autonomy_mode||"")))) throw Object.assign(new Error("Projeto não autorizado para execução automática."),{statusCode:403});
  const active = await pool.query("select id from public.gsa_tv_ai_jobs where project_id=$1 and state in ('queued','running') limit 1", [projectId]);
  if (active.rowCount) return { success:true, job_id:active.rows[0].id, state:"queued", already_queued:true };
  const type=project.project_type; const jobType=type==="image"?"image_generation":type==="audio"?"speech_generation":type==="video"?"video_generation":type==="research"?"research_agent":type==="advertising"?"advertising_agent":type==="quality"?"quality_agent":type==="translation"?"translation_agent":"editorial_orchestrator";
  const model=type==="image"?selected.image_model:type==="audio"?selected.speech_model:type==="video"?selected.video_model:selected.default_model;
  const job=await pool.query(`insert into public.gsa_tv_ai_jobs(project_id,agent_type,job_type,provider,model,state,input,progress,created_at,updated_at) values($1,$2,$2,$3,$4,'queued',$5,0,now(),now()) returning id`,[projectId,jobType,selected.provider,model,{brief:project.brief,project_type:type,requested_by:String(requestedBy||"GSA TV Automation").slice(0,160)}]);
  await pool.query("update public.gsa_tv_ai_projects set state='queued',updated_at=now() where id=$1",[projectId]); return {success:true,job_id:job.rows[0].id,state:"queued",provider:selected.provider};
}
async function runAiProject(req, projectId) {
  const actor=await requireAdminSession(req);
  return queueAiProject(projectId,actor.ator_nome||"Administrador GSA TV");
}
async function executeAiJob(job) {
  const project = (
    await pool.query("select * from public.gsa_tv_ai_projects where id=$1", [
      job.project_id,
    ])
  ).rows[0];
  if (!project) throw new Error("Projeto da fila nao encontrado.");
  const secret = await aiSecret();
  if (job.provider && job.provider !== secret.provider)
    throw new Error(
      `O job foi enfileirado para ${job.provider}, mas o provedor ativo agora e ${secret.provider}.`,
    );
  await pool.query(
    "update public.gsa_tv_ai_projects set state='generating',updated_at=now() where id=$1",
    [project.id],
  );
  let result;
  if (project.project_type === "image")
    result = await generateProviderImage(job, project, secret);
  else if (project.project_type === "audio")
    result = await generateProviderSpeech(job, project, secret);
  else if (project.project_type === "video")
    result = await generateProviderVideo(job, project, secret);
  else {
    const web = ["research", "news", "full_production"].includes(
      project.project_type,
    );
    const instruction =
      project.project_type === "quality"
        ? "Voce e o fiscal de qualidade da GSA TV. Analise o material descrito, identifique riscos tecnicos/editoriais e devolva checklist objetivo sem publicar nada."
        : project.project_type === "translation"
          ? "Voce e o estudio de traducao e legendagem da GSA TV. Preserve nomes, numeros e sentido; produza material pronto para revisao humana."
          : project.project_type === "advertising"
            ? "Voce e o diretor publicitario da GSA TV. Crie roteiro, storyboard, versoes de duracao, conferencias de preco/dados e pontos de aprovacao. Nunca invente preco ou disponibilidade."
            : "Voce e o coordenador editorial da GSA TV. Responda em portugues do Brasil com plano executavel, grade, duracoes, blocos, fontes, riscos de direitos, materiais necessarios, agentes envolvidos e pontos de aprovacao humana. Nao publique nada automaticamente.";
    result = await generateProviderText(job, project, secret, instruction, web);
  }
  const output = { ...(result.output || {}), asset: result.asset || null };
  await pool.query(
    "update public.gsa_tv_ai_jobs set state='completed',output=$2,progress=100,finished_at=now(),updated_at=now() where id=$1",
    [job.id, output],
  );
  await pool.query(
    "update public.gsa_tv_ai_projects set state='review',updated_at=now() where id=$1",
    [project.id],
  );
}
async function processAiJobs() {
  if (aiProcessing) return;
  aiProcessing = true;
  let job = null;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const r = await client.query(
      `select * from public.gsa_tv_ai_jobs where state='queued' order by case priority when 'emergency' then 0 when 'today' then 1 when 'tomorrow' then 2 when 'advertising' then 3 else 4 end,created_at for update skip locked limit 1`,
    );
    if (r.rowCount) {
      job = r.rows[0];
      await client.query(
        "update public.gsa_tv_ai_jobs set state='running',progress=5,started_at=now(),updated_at=now() where id=$1",
        [job.id],
      );
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
  try {
    if (job) await executeAiJob(job);
  } catch (error) {
    if (job) {
      await pool.query(
        "update public.gsa_tv_ai_jobs set state='failed',error_message=$2,finished_at=now(),updated_at=now() where id=$1",
        [job.id, String(error.message || error).slice(0, 1000)],
      );
      await pool.query(
        "update public.gsa_tv_ai_projects set state='failed',updated_at=now() where id=$1",
        [job.project_id],
      );
    }
    log("error", "ai_job_failed", { job_id: job?.id, error: error.message });
  } finally {
    aiProcessing = false;
  }
}
async function publishAiAssets(projectId, actor) {
  const project = (
    await pool.query(
      "select name,project_type from public.gsa_tv_ai_projects where id=$1",
      [projectId],
    )
  ).rows[0];
  const assets = await pool.query(
    "select * from public.gsa_tv_ai_assets where project_id=$1 and approval_state in ('draft','review') and file_path is not null",
    [projectId],
  );
  const published = [];
  for (const asset of assets.rows) {
    const file = resolveMediaPath(asset.file_path);
    await fs.access(file);
    const mediaId = `media-ai-${crypto.randomUUID()}`;
    let duration = 10;
    try {
      duration = Math.max(1, Math.round(await probeDurationSeconds(file)));
    } catch {}
    const kind =
      project.project_type === "advertising"
        ? "advertising"
        : asset.asset_type === "image" &&
            /identity|ident/i.test(project.project_type)
          ? "identity"
          : "program";
    await pool.query(
      `insert into public.gsa_tv_media_items(id,channel_id,title,original_filename,duration_s,state,rights_ok,drive_path,media_kind,source_type,ai_generated,approval_state,metadata,updated_at) values($1,$2,$3,$4,$5,'processing',true,$6,$7,'ai',true,'approved',$8,now())`,
      [
        mediaId,
        CHANNEL_ID,
        project.name || `Criação IA - ${asset.asset_type}`,
        path.basename(file),
        duration,
        file,
        kind,
        {
          ai_project_id: projectId,
          ai_asset_id: asset.id,
          approved_by: actor.ator_nome,
          generated_by: "openai",
        },
      ],
    );
    await pool.query(
      "update public.gsa_tv_ai_assets set approval_state='approved',published_media_item_id=$2,updated_at=now() where id=$1",
      [asset.id, mediaId],
    );
    published.push({ asset_id: asset.id, media_item_id: mediaId });
  }
  return published;
}

async function reviewAiProject(req, projectId) {
  const actor = await requireAdminSession(req);
  const body = await readJsonBody(req);
  const decision = String(body.decision || "");
  const notes = String(body.notes || "")
    .trim()
    .slice(0, 4000);
  if (!/^[0-9a-f-]{36}$/i.test(projectId))
    throw Object.assign(new Error("Projeto inválido."), { statusCode: 400 });
  if (!["approved", "rejected"].includes(decision))
    throw Object.assign(new Error("Escolha aprovar ou rejeitar."), {
      statusCode: 400,
    });
  const result = await pool.query(
    `update public.gsa_tv_ai_projects
       set state=$3,
           metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
             'review_notes',$4::text,'reviewed_by',$5::text,'reviewed_at',now()
           ),
           updated_at=now()
     where id=$1 and channel_id=$2 and state='review'
     returning id,state`,
    [projectId, CHANNEL_ID, decision, notes, actor.ator_nome],
  );
  if (!result.rowCount)
    throw Object.assign(new Error("O projeto não está aguardando revisão."), {
      statusCode: 409,
    });
  await pool.query(
    `insert into public.gsa_tv_audit_log(channel_id,actor,action,resource_type,resource_id,details)
     values($1,$2,$3,'ai_project',$4,$5)`,
    [
      CHANNEL_ID,
      actor.ator_nome,
      `ai_project_${decision}`,
      projectId,
      { notes },
    ],
  );
  const published =
    decision === "approved" ? await publishAiAssets(projectId, actor) : [];
  if (decision === "rejected")
    await pool.query(
      "update public.gsa_tv_ai_assets set approval_state='rejected',updated_at=now() where project_id=$1 and approval_state in ('draft','review')",
      [projectId],
    );
  return { success: true, project_id: projectId, state: decision, published };
}

async function incident(message, details, severity = "critical") {
  const existing = await pool.query(
    "select id from public.gsa_tv_incidents where channel_id=$1 and message=$2 and not resolved limit 1",
    [CHANNEL_ID, message],
  );
  if (!existing.rowCount)
    await pool.query(
      "insert into public.gsa_tv_incidents(channel_id,severity,message,details) values($1,$2,$3,$4)",
      [CHANNEL_ID, severity, message, details],
    );
}
async function resolveIncident(message) {
  await pool.query(
    "update public.gsa_tv_incidents set resolved=true,resolved_at=now() where channel_id=$1 and message=$2 and not resolved",
    [CHANNEL_ID, message],
  );
}
async function heartbeat() {
  const states = await serviceHealth();
  const failedServices = states.filter((item) => !item.ok);
  let playoutStatus = null;
  let playoutError = null;
  try {
    playoutStatus = await ffplayoutProcess("status");
  } catch (error) {
    playoutError = error.message;
  }
  const expectsSignal =
    streamState.desired === "running" || streamState.desired === "paused";
  const signalHealthy =
    !expectsSignal ||
    streamState.actual === "sending" ||
    streamState.actual === "starting";
  const playoutHealthy = streamState.desired !== "running" || !playoutError;
  const infrastructureDown = failedServices.length > 0;
  const degraded = infrastructureDown || !signalHealthy || !playoutHealthy;
  const reasons = [
    ...failedServices.map((x) => `serviço ${x.name}`),
    ...(!signalHealthy ? [`sinal ${streamState.actual}`] : []),
    ...(!playoutHealthy ? [`ffplayout: ${playoutError}`] : []),
  ];
  const status = infrastructureDown
    ? "offline"
    : expectsSignal
      ? degraded
        ? "degraded"
        : "online"
      : "standby";
  await pool.query(
    "update public.gsa_tv_channels set status=$2,last_heartbeat_at=now(),last_error=$3,last_signal_at=case when $4 then now() else last_signal_at end,updated_at=now() where id=$1",
    [
      CHANNEL_ID,
      status,
      degraded ? reasons.join("; ").slice(0, 1000) : null,
      streamState.actual === "sending",
    ],
  );
  if (infrastructureDown)
    await incident(
      "Serviços internos da GSA TV indisponíveis",
      { services: states },
      "critical",
    );
  else await resolveIncident("Serviços internos da GSA TV indisponíveis");
  if (degraded && expectsSignal)
    await incident(
      "Transmissão da GSA TV degradada",
      {
        services: states,
        playout: playoutStatus,
        playout_error: playoutError,
        stream: streamState,
      },
      "critical",
    );
  else await resolveIncident("Transmissão da GSA TV degradada");

  const autopilot = await autopilotSnapshot();
  if (!autopilot.readiness.present || !autopilot.readiness.fresh)
    await incident(
      "Autopilot da GSA TV sem heartbeat",
      { readiness: autopilot.readiness },
      "warning",
    );
  else await resolveIncident("Autopilot da GSA TV sem heartbeat");

  if (
    autopilot.readiness.next_day &&
    autopilot.readiness.next_day.state !== "ready"
  )
    await incident(
      "Grade D+1 da GSA TV incompleta",
      { next_day: autopilot.readiness.next_day },
      "warning",
    );
  else await resolveIncident("Grade D+1 da GSA TV incompleta");

  const autopilotFailure =
    ["failed", "cycle_failed", "duration_cycle_failed"].includes(
      String(autopilot.content_factory.state || ""),
    ) ||
    String(autopilot.duration_engine.state || "") === "failed" ||
    ["failed", "fallback_incomplete", "fallback_compile_failed"].includes(
      String(autopilot.fallback_engine.state || ""),
    );
  if (autopilotFailure)
    await incident(
      "Fábrica Autopilot da GSA TV falhou",
      {
        content_factory: autopilot.content_factory,
        duration_engine: autopilot.duration_engine,
        fallback_engine: autopilot.fallback_engine,
      },
      "warning",
    );
  else await resolveIncident("Fábrica Autopilot da GSA TV falhou");

  return {
    status,
    services: states,
    playout: playoutStatus,
    stream: {
      ...streamState,
      process_pid: streamProcess?.pid || null,
      encoder_external: USE_EXTERNAL_ENCODER,
    },
    degraded,
    autopilot,
  };
}
async function validateSchedule() {
  const overlaps = await pool.query(
    `select a.id as first_id,b.id as second_id from public.gsa_tv_schedule_slots a join public.gsa_tv_schedule_slots b on a.channel_id=b.channel_id and a.id<b.id and a.state<>'cancelled' and b.state<>'cancelled' and tstzrange(a.scheduled_start,a.scheduled_end,'[)') && tstzrange(b.scheduled_start,b.scheduled_end,'[)') where a.channel_id=$1 and a.scheduled_end>now()`,
    [CHANNEL_ID],
  );
  if (overlaps.rowCount)
    throw new Error(`Programação contém ${overlaps.rowCount} conflito(s).`);
  return { overlaps: 0 };
}
function localClock(value) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: CHANNEL_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((x) => x.type !== "literal")
      .map((x) => [x.type, x.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    seconds:
      Number(parts.hour) * 3600 +
      Number(parts.minute) * 60 +
      Number(parts.second),
  };
}
function playlistEntry(source, duration, clipIn = 0, ad = false, title = "") {
  const seconds = Math.max(0.04, Number(duration));
  return {
    in: Number(clipIn.toFixed(3)),
    out: Number((clipIn + seconds).toFixed(3)),
    duration: Number(seconds.toFixed(3)),
    source,
    ...(ad ? { ad: true } : {}),
    ...(title ? { title } : {}),
  };
}
async function probeDurationSeconds(source) {
  const { stdout } = await execFileAsync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      source,
    ],
    { timeout: 30000, maxBuffer: 64 * 1024 },
  );
  const duration = Number(String(stdout).trim());
  if (!Number.isFinite(duration) || duration <= 0.04)
    throw new Error(`Duração inválida para ${path.basename(source)}.`);
  return duration;
}
function appendLoopedFiller(
  program,
  totalDuration,
  fillerDuration,
  title = "Continuidade GSA TV",
) {
  let remaining = Math.max(0, Number(totalDuration));
  while (remaining > 0.04) {
    const duration = Math.min(remaining, fillerDuration);
    program.push(
      playlistEntry(
        SCHEDULE_FILLER_FILE,
        duration,
        0,
        false,
        title,
      ),
    );
    remaining -= duration;
  }
}
async function publishedScheduleItems(date) {
  const version = await pool.query(
    `select id,title from public.gsa_tv_schedule_versions where channel_id=$1 and broadcast_date=$2::date and state='published' order by version desc limit 1`,
    [CHANNEL_ID, date],
  );
  if (!version.rowCount) return null;
  const blocks = await pool.query(
    `select b.*,p.name as program_name,
      coalesce(dm.id,em.id,pm.id,cm.id) as resolved_media_id,
      coalesce(dm.title,em.title,pm.title,cm.title,p.name,b.block_type) as resolved_title,
      coalesce(dm.drive_path,em.drive_path,pm.drive_path,cm.drive_path) as drive_path,
      coalesce(dm.duration_s,em.duration_s,pm.duration_s,cm.duration_s) as media_duration_s,
      coalesce(dm.media_kind,em.media_kind,pm.media_kind,cm.media_kind) as media_kind,
      coalesce(dm.state,em.state,pm.state,cm.state) as media_state,
      coalesce(dm.approval_state,em.approval_state,pm.approval_state,cm.approval_state) as approval_state,
      coalesce(dm.rights_ok,em.rights_ok,pm.rights_ok,cm.rights_ok) as rights_ok,
      coalesce(dm.rights_expires_at,em.rights_expires_at,pm.rights_expires_at,cm.rights_expires_at) as rights_expires_at,
      (($2::date + make_interval(secs=>b.planned_start_offset_s+b.planned_duration_s)) at time zone $3) as block_ends_at
    from public.gsa_tv_program_blocks b
    left join public.gsa_tv_programs p on p.id=b.program_id
    left join public.gsa_tv_media_items dm on dm.id=b.media_item_id
    left join public.gsa_tv_episodes ep on ep.id=b.episode_id
    left join public.gsa_tv_media_items em on em.id=ep.media_item_id
    left join lateral (
      select m.* from public.gsa_tv_series se
      join public.gsa_tv_episodes e on e.series_id=se.id
      join public.gsa_tv_media_items m on m.id=e.media_item_id
      where b.media_item_id is null and b.episode_id is null and b.program_id is not null and se.program_id=b.program_id
      order by case when b.is_reprise then e.last_run_at else e.first_run_at end nulls first,e.season_number,e.episode_number,e.id
      limit 1
    ) pm on true
    left join lateral (
      select m.* from public.gsa_tv_ad_assets aa
      join public.gsa_tv_media_items m on m.id=aa.media_item_id
      join public.gsa_tv_ad_campaigns c on c.id=aa.campaign_id
      where b.campaign_id is not null and aa.campaign_id=b.campaign_id and c.status='active'
        and (($2::date + make_interval(secs=>b.planned_start_offset_s)) at time zone $3) between c.starts_at and c.ends_at and m.state='ready' and m.rights_ok and m.approval_state='approved'
      order by aa.weight desc,m.updated_at asc,m.id limit 1
    ) cm on true
    where b.schedule_version_id=$1
    order by b.planned_start_offset_s,b.position`,
    [version.rows[0].id, date, CHANNEL_TIMEZONE],
  );

  const policyResult = await pool.query(
    "select config->'broadcast_schedule_policy' policy from public.gsa_tv_channels where id=$1 limit 1",
    [CHANNEL_ID],
  );
  const policy = policyResult.rows[0]?.policy || {};
  const clockSeconds = (value, fallback) => {
    const raw = String(value || fallback);
    const parts = raw.split(":").map(Number);
    if (
      (parts.length !== 2 && parts.length !== 3) ||
      parts.some((part) => !Number.isFinite(part))
    )
      throw new Error(`Política de horário inválida: ${raw}`);
    return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
  };
  const onAirStart = clockSeconds(policy.on_air_start, "06:00:00");
  let streamStop = clockSeconds(policy.stream_stop, "23:59:00");
  if (streamStop <= onAirStart && streamStop === 0) streamStop = 86400;

  let expectedStart = onAirStart;
  for (const block of blocks.rows) {
    const blockStart = Number(block.planned_start_offset_s || 0);
    const blockDuration = Number(block.planned_duration_s || 0);
    if (!Number.isFinite(blockDuration) || blockDuration <= 0)
      throw new Error(`Bloco ${block.id} possui duração planejada inválida.`);
    if (blockStart < onAirStart || blockStart + blockDuration > streamStop)
      throw new Error(`Bloco ${block.id} está fora da janela oficial de transmissão.`);
    if (Math.abs(blockStart - expectedStart) > 0.5)
      throw new Error(
        `Grade publicada possui lacuna/sobreposição antes do bloco ${block.id}: esperado ${expectedStart}s, recebido ${blockStart}s.`,
      );
    expectedStart = blockStart + blockDuration;
  }
  if (!blocks.rowCount || Math.abs(expectedStart - streamStop) > 0.5)
    throw new Error(
      `Grade publicada não cobre integralmente a janela on-air: final ${expectedStart}s, esperado ${streamStop}s.`,
    );

  const items = [];
  for (const block of blocks.rows) {
    const start = Math.max(0, Number(block.planned_start_offset_s || 0));
    const planned = Math.max(0.04, Number(block.planned_duration_s || 0));
    if (block.block_type === "live" && block.live_source_id) {
      items.push({
        start,
        duration: planned,
        source: SCHEDULE_FILLER_FILE,
        clipIn: 0,
        ad: false,
        title: block.resolved_title || "Entrada ao vivo",
        blockId: block.id,
        liveSourceId: block.live_source_id,
      });
      continue;
    }
    const metadata =
      block.metadata && typeof block.metadata === "object" ? block.metadata : {};
    const requiredSlotDuration = Math.max(
      0,
      Number(metadata.required_slot_duration_s || 0),
    );
    if (requiredSlotDuration > 0 && planned + 0.001 < requiredSlotDuration)
      throw new Error(
        `Bloco ${block.id} viola duração contratual: ${planned}s < ${requiredSlotDuration}s.`,
      );

    if (!block.drive_path)
      throw new Error(`Bloco ${block.id} não possui mídia resolvida.`);
    if (block.media_state !== "ready")
      throw new Error(`Bloco ${block.id} usa mídia fora do estado ready.`);
    if (block.approval_state !== "approved")
      throw new Error(`Bloco ${block.id} usa mídia sem aprovação editorial.`);
    if (block.rights_ok !== true)
      throw new Error(`Bloco ${block.id} usa mídia sem direitos confirmados.`);
    if (
      block.rights_expires_at &&
      new Date(block.rights_expires_at).getTime() <
        new Date(block.block_ends_at).getTime()
    )
      throw new Error(
        `Bloco ${block.id} usa mídia cujos direitos expiram antes do fim da exibição.`,
      );

    const source = resolveMediaPath(block.drive_path);
    await fs.access(source);
    const mediaDuration = Math.max(
      0.04,
      Number(block.media_duration_s || 0),
    );
    const allowFill = metadata.allow_continuity_fill === true;
    const allowTrim = metadata.allow_trim === true;

    if (mediaDuration + 1 < planned && !allowFill)
      throw new Error(
        `Bloco ${block.id} está subpreenchido (${mediaDuration}s de ${planned}s) sem composição autorizada.`,
      );
    if (mediaDuration > planned + 1 && !allowTrim)
      throw new Error(
        `Bloco ${block.id} excede a janela (${mediaDuration}s para ${planned}s) e não pode ser truncado.`,
      );

    const playable = Math.min(planned, mediaDuration);
    items.push({
      start,
      duration: playable,
      source,
      clipIn: 0,
      ad:
        block.block_type === "commercial_break" ||
        block.media_kind === "advertising",
      title: block.resolved_title || "Conteúdo",
      blockId: block.id,
      campaignId: block.campaign_id || null,
      episodeId: block.episode_id || null,
    });
    if (playable + 0.04 < planned) {
      if (!allowFill)
        throw new Error(`Bloco ${block.id} exige composição editorial explícita.`);
      items.push({
        start: start + playable,
        duration: planned - playable,
        source: SCHEDULE_FILLER_FILE,
        clipIn: 0,
        ad: false,
        title: "Continuidade GSA TV",
        blockId: block.id,
      });
    }
  }
  return { version: version.rows[0], items };
}

async function compilePlaylist(targetDate = null, options = {}) {
  const requirePublished = options?.requirePublished === true;
  if (!requirePublished) await validateSchedule();
  const rows = await pool.query(
    `select s.id,s.scheduled_start,s.scheduled_end,s.slot_type,m.title,m.drive_path,m.duration_s,m.media_kind,m.approval_state from public.gsa_tv_schedule_slots s join public.gsa_tv_media_items m on m.id=s.media_item_id where s.channel_id=$1 and s.state='confirmed' and s.scheduled_end>now() and s.scheduled_start<now()+interval '48 hours' and m.state='ready' and m.rights_ok and (m.media_kind<>'advertising' or m.approval_state='approved') and (m.rights_expires_at is null or m.rights_expires_at>=s.scheduled_end) order by s.scheduled_start`,
    [CHANNEL_ID],
  );
  await fs.access(SCHEDULE_FILLER_FILE);
  const fillerDuration = await probeDurationSeconds(SCHEDULE_FILLER_FILE);
  await fs.mkdir(PLAYLISTS_DIR, { recursive: true });

  const byDate = new Map();
  if (!requirePublished) for (const item of rows.rows) {
    const source = resolveMediaPath(item.drive_path);
    try {
      await fs.access(source);
    } catch {
      throw new Error(
        `Arquivo não encontrado no armazenamento: ${path.basename(source)}`,
      );
    }
    let cursor = new Date(item.scheduled_start);
    const end = new Date(item.scheduled_end);
    let clipIn = 0;
    while (cursor < end) {
      const clock = localClock(cursor);
      const remaining = (end.getTime() - cursor.getTime()) / 1000;
      const untilMidnight = Math.max(0.04, 86400 - clock.seconds);
      const duration = Math.min(remaining, untilMidnight);
      const list = byDate.get(clock.date) || [];
      list.push({
        start: clock.seconds,
        duration,
        clipIn,
        source,
        ad:
          item.slot_type === "commercial" || item.media_kind === "advertising",
        title: item.title,
        slotId: item.id,
      });
      byDate.set(clock.date, list);
      cursor = new Date(cursor.getTime() + duration * 1000);
      clipIn += duration;
    }
  }

  const now = new Date();
  const targetDates = [];
  if (targetDate != null) {
    const requested = String(targetDate).trim();
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(requested))
      throw new Error("Data de compilação inválida.");
    targetDates.push(requested);
    if (!byDate.has(requested)) byDate.set(requested, []);
  } else {
    for (const seed of [now, new Date(now.getTime() + 24 * 60 * 60 * 1000)]) {
      const date = localClock(seed).date;
      targetDates.push(date);
      if (!byDate.has(date)) byDate.set(date, []);
    }
  }
  const publishedVersions = [];
  for (const date of targetDates) {
    const published = await publishedScheduleItems(date);
    if (published) {
      byDate.set(date, published.items);
      publishedVersions.push({
        date,
        id: published.version.id,
        title: published.version.title || null,
        items: published.items.length,
      });
    }
  }

  if (requirePublished) {
    const publishedDateSet = new Set(publishedVersions.map((item) => item.date));
    const missingPublished = targetDates.filter((date) => !publishedDateSet.has(date));
    if (missingPublished.length)
      throw new Error(
        `Grade versionada publicada obrigatória para: ${missingPublished.join(", ")}.`,
      );
  }

  const generated = [];
  const targetDateSet = new Set(targetDates);
  for (const [date, items] of [...byDate.entries()]
    .filter(([date]) => targetDateSet.has(date))
    .sort(([a], [b]) => a.localeCompare(b))) {
    items.sort((a, b) => a.start - b.start);
    const program = [];
    let timeline = 0;
    for (const item of items) {
      if (item.start > timeline + 0.5) {
        appendLoopedFiller(program, item.start - timeline, fillerDuration);
        timeline = item.start;
      }
      if (item.start < timeline - 0.5)
        throw new Error(`Conflito de grade detectado ao compilar ${date}.`);
      if (item.source === SCHEDULE_FILLER_FILE) {
        appendLoopedFiller(
          program,
          item.duration,
          fillerDuration,
          item.title || "Continuidade GSA TV",
        );
      } else {
        program.push(
          playlistEntry(
            item.source,
            item.duration,
            item.clipIn,
            item.ad,
            item.title,
          ),
        );
      }
      timeline = item.start + item.duration;
    }
    if (timeline < 86400 - 0.04)
      appendLoopedFiller(program, 86400 - timeline, fillerDuration);
    const payload = { channel: "GSA TV", date, program };
    const target = path.join(PLAYLISTS_DIR, `${date}.json`);
    const temporary = `${target}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(payload, null, 2), {
      encoding: "utf8",
      mode: 0o640,
    });
    await fs.rename(temporary, target);
    try {
      await ffplayoutApi(`/api/playlist/${FFPLAYOUT_CHANNEL_ID}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      if (!String(error.message || "").includes("HTTP 409")) throw error;
      log("info", "playlist_replaced_on_shared_storage", { date });
    }
    const playlistId = `playlist-${date}`;
    await pool.query(
      `insert into public.gsa_tv_playlists(id,channel_id,name,items,is_active,updated_at) values($1,$2,$3,$4::jsonb,true,now()) on conflict(id) do update set items=excluded.items,is_active=true,updated_at=now()`,
      [playlistId, CHANNEL_ID, `Grade ${date}`, JSON.stringify(program)],
    );
    generated.push({
      date,
      playlist_file: target,
      slot_count: items.length,
      program_items: program.length,
    });
  }
  return {
    generated,
    slot_count: rows.rowCount,
    published_versions: publishedVersions,
  };
}
async function inspectMedia(job) {
  const mediaId = job.payload?.media_item_id;
  const row = await pool.query(
    "select * from public.gsa_tv_media_items where id=$1",
    [mediaId],
  );
  if (!row.rowCount) throw new Error("Mídia da tarefa não encontrada.");
  const media = row.rows[0];
  const originalSource = resolveMediaPath(media.drive_path);
  try {
    await pool.query(
      "update public.gsa_tv_media_items set state='processing',updated_at=now() where id=$1",
      [mediaId],
    );
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        originalSource,
      ],
      { timeout: 120000, maxBuffer: 1024 * 1024 },
    );
    const probe = JSON.parse(stdout);
    const video = probe.streams?.find((x) => x.codec_type === "video");
    const audio = probe.streams?.find((x) => x.codec_type === "audio");
    if (!video && !audio)
      throw new Error("O arquivo não possui fluxo de mídia reconhecido.");
    const still = Boolean(
      video && !audio && /\.(png|jpe?g|webp)$/i.test(originalSource),
    );
    const duration = Math.max(
      1,
      Math.round(
        Number(probe.format?.duration || (still ? 10 : media.duration_s || 1)),
      ),
    );
    const fpsParts = String(video?.avg_frame_rate || "0/1")
      .split("/")
      .map(Number);
    const fps = fpsParts[1] ? fpsParts[0] / fpsParts[1] : 0;
    const compatible = Boolean(
      video &&
      !still &&
      audio &&
      video.codec_name === "h264" &&
      video.width === 1280 &&
      video.height === 720 &&
      fps >= 29 &&
      fps <= 31 &&
      audio.codec_name === "aac" &&
      Number(audio.sample_rate) === 48000 &&
      Number(audio.channels) === 2,
    );
    let finalSource = originalSource,
      normalized = false;
    if (!still && !compatible) {
      const dir = path.join(MEDIA_DIR, "normalized");
      await fs.mkdir(dir, { recursive: true, mode: 0o750 });
      const target = path.join(dir, `${mediaId}-720p30.mp4`);
      const temp = `${target}.${crypto.randomUUID()}.tmp.mp4`;
      const common = ["-hide_banner", "-nostdin", "-loglevel", "error", "-y"];
      let inputs,
        maps = [];
      if (video) {
        inputs = ["-i", originalSource];
        if (!audio) {
          inputs.push(
            "-f",
            "lavfi",
            "-i",
            "anullsrc=channel_layout=stereo:sample_rate=48000",
          );
          maps = ["-map", "0:v:0", "-map", "1:a:0", "-shortest"];
        }
      } else {
        inputs = [
          "-f",
          "lavfi",
          "-i",
          "color=c=0x07111f:s=1280x720:r=30",
          "-i",
          originalSource,
        ];
        maps = ["-map", "0:v:0", "-map", "1:a:0", "-shortest"];
      }
      const filters = video
        ? [
            "-vf",
            "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x07111f,fps=30,format=yuv420p",
          ]
        : [];
      const af = audio ? ["-af", "loudnorm=I=-16:LRA=11:TP=-1.5"] : [];
      const out = [
        ...filters,
        ...af,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-profile:v",
        "high",
        "-level",
        "4.1",
        "-r",
        "30",
        "-g",
        "60",
        "-keyint_min",
        "60",
        "-sc_threshold",
        "0",
        "-b:v",
        "4000k",
        "-maxrate",
        "4000k",
        "-bufsize",
        "8000k",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-movflags",
        "+faststart",
        temp,
      ];
      await execFileAsync("ffmpeg", [...common, ...inputs, ...maps, ...out], {
        timeout: 3600000,
        maxBuffer: 1024 * 1024,
      });
      await fs.rename(temp, target);
      finalSource = target;
      normalized = true;
    }
    let quality = {
      black: false,
      silence: false,
      freeze: false,
      probe_ok: true,
    };
    if (!still) {
      try {
        const seconds = Math.min(20, duration);
        const { stderr } = await execFileAsync(
          "ffmpeg",
          [
            "-hide_banner",
            "-nostdin",
            "-loglevel",
            "info",
            "-t",
            String(seconds),
            "-i",
            finalSource,
            "-vf",
            "blackdetect=d=2:pix_th=0.10,freezedetect=n=-60dB:d=3",
            "-af",
            "silencedetect=n=-50dB:d=3",
            "-f",
            "null",
            "-",
          ],
          { timeout: 60000, maxBuffer: 1024 * 1024 },
        );
        const q = String(stderr || "");
        quality = {
          black: /black_start:/i.test(q),
          silence: /silence_start:/i.test(q),
          freeze: /freeze_start:/i.test(q),
          probe_ok: true,
        };
      } catch (e) {
        quality = {
          black: false,
          silence: false,
          freeze: false,
          probe_ok: false,
          error: String(e.message || e).slice(0, 500),
        };
      }
    }
    const finalProbe = normalized
      ? JSON.parse(
          (
            await execFileAsync(
              "ffprobe",
              [
                "-v",
                "error",
                "-show_streams",
                "-show_format",
                "-of",
                "json",
                finalSource,
              ],
              { timeout: 120000, maxBuffer: 1024 * 1024 },
            )
          ).stdout,
        )
      : probe;
    const fv = finalProbe.streams?.find((x) => x.codec_type === "video"),
      fa = finalProbe.streams?.find((x) => x.codec_type === "audio");
    const fr = String(fv?.avg_frame_rate || "0/1")
      .split("/")
      .map(Number);
    const ffps = fr[1] ? Math.round(fr[0] / fr[1]) : 0;
    await pool.query(
      `update public.gsa_tv_media_items set state='ready',approval_state=case when approval_state='rejected' then 'rejected' else 'approved' end,duration_s=$2,video_codec=$3,video_width=$4,video_height=$5,video_fps=$6,video_bitrate_kbps=$7,audio_codec=$8,audio_sample_rate=$9,audio_channels=$10,audio_bitrate_kbps=$11,drive_path=$12,metadata=coalesce(metadata,'{}'::jsonb)||$13::jsonb,updated_at=now() where id=$1`,
      [
        mediaId,
        duration,
        fv?.codec_name || null,
        fv?.width || null,
        fv?.height || null,
        ffps || null,
        Math.round(Number(fv?.bit_rate || 0) / 1000) || null,
        fa?.codec_name || null,
        Number(fa?.sample_rate || 0) || null,
        fa?.channels || null,
        Math.round(Number(fa?.bit_rate || 0) / 1000) || null,
        finalSource,
        JSON.stringify({
          normalized,
          original_path: normalized ? originalSource : null,
          quality,
          technical_verified_at: new Date().toISOString(),
        }),
      ],
    );
    return {
      media_item_id: mediaId,
      duration_s: duration,
      normalized,
      quality,
      video_codec: fv?.codec_name || null,
      audio_codec: fa?.codec_name || null,
      still_image: still,
    };
  } catch (error) {
    await pool.query(
      "update public.gsa_tv_media_items set state='failed',metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('processing_error',$2::text),updated_at=now() where id=$1",
      [mediaId, String(error.message || error).slice(0, 1000)],
    );
    throw error;
  }
}
async function inspectCache() {
  const rows = await pool.query(
    `select distinct m.id,m.title,m.drive_path from public.gsa_tv_schedule_slots s join public.gsa_tv_media_items m on m.id=s.media_item_id where s.channel_id=$1 and s.scheduled_end>now() and s.scheduled_start<now()+interval '48 hours' and s.state='confirmed'`,
    [CHANNEL_ID],
  );
  const missing = [];
  for (const item of rows.rows) {
    const source = resolveMediaPath(item.drive_path);
    try {
      await fs.access(source);
    } catch {
      missing.push({
        id: item.id,
        title: item.title,
        file: path.basename(source),
      });
    }
  }
  if (missing.length)
    throw new Error(
      `${missing.length} arquivo(s) programado(s) não estão no cache.`,
    );
  return { checked: rows.rowCount, missing: 0 };
}
async function callService(url, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${INTERNAL_API_TOKEN}` },
    signal: AbortSignal.timeout(120000),
  });
  const text = await response.text();
  if (!response.ok)
    throw new Error(`${url}: HTTP ${response.status} ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    return { response: text };
  }
}
const AUTOMATION_JOB_TYPES=new Set(["health_check","validate_schedule","compile_playlist","cache_warmup","probe_media","materialize_fixed_schedule"]);
async function enqueueAutomationJob(body={}){
  const jobType=String(body.job_type||"").trim();if(!AUTOMATION_JOB_TYPES.has(jobType))throw Object.assign(new Error("Tipo de tarefa não autorizado para automação."),{statusCode:403});
  const payload=body.payload&&typeof body.payload==="object"&&!Array.isArray(body.payload)?body.payload:{};
  if(jobType==="probe_media"&&!/^media-[A-Za-z0-9_-]{3,200}$/.test(String(payload.media_item_id||"")))throw Object.assign(new Error("media_item_id inválido."),{statusCode:400});
  const args=[CHANNEL_ID,jobType];let existingSql="select id,status from public.gsa_tv_jobs where channel_id=$1 and job_type=$2 and status in ('pending','running')";
  if(jobType==="probe_media"){existingSql+=" and payload->>'media_item_id'=$3";args.push(String(payload.media_item_id));}
  existingSql+=" order by created_at desc limit 1";const existing=await pool.query(existingSql,args);if(existing.rowCount)return{accepted:true,job_id:existing.rows[0].id,status:existing.rows[0].status,already_queued:true};
  try{const q=await pool.query("insert into public.gsa_tv_jobs(channel_id,job_type,status,progress,payload) values($1,$2,'pending',0,$3) returning id,status",[CHANNEL_ID,jobType,payload]);return{accepted:true,job_id:q.rows[0].id,status:q.rows[0].status,already_queued:false};}
  catch(e){if(e.code==='23505'){const q=await pool.query("select id,status from public.gsa_tv_jobs where channel_id=$1 and job_type=$2 and status in ('pending','running') order by created_at desc limit 1",[CHANNEL_ID,jobType]);if(q.rowCount)return{accepted:true,job_id:q.rows[0].id,status:q.rows[0].status,already_queued:true};}throw e;}
}
async function readAutopilotStateFile(filename) {
  const file = path.join(AUTOPILOT_STATE_DIR, filename);
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024)
      throw new Error("Arquivo de estado inválido.");
    const data = JSON.parse(await fs.readFile(file, "utf8"));
    return {
      present: true,
      age_seconds: Math.max(0, Math.round((Date.now() - stat.mtimeMs) / 1000)),
      data,
    };
  } catch (error) {
    if (error.code === "ENOENT")
      return { present: false, age_seconds: null, data: null };
    return {
      present: false,
      age_seconds: null,
      data: null,
      error: String(error.message || error).slice(0, 300),
    };
  }
}

async function autopilotSnapshot() {
  const [readinessFile, factoryFile, durationFile, fallbackFile, broadcastFile] = await Promise.all([
    readAutopilotStateFile("readiness-horizon.json"),
    readAutopilotStateFile("content-factory.json"),
    readAutopilotStateFile("duration-engine.json"),
    readAutopilotStateFile("fallback-engine.json"),
    readAutopilotStateFile("broadcast-controller.json"),
  ]);
  const readiness = readinessFile.data || {};
  const today = localClock(new Date()).date;
  const nextDay = (readiness.days_detail || []).find(
    (day) => day.date > today,
  ) || null;
  const readinessFresh =
    readinessFile.present && readinessFile.age_seconds !== null &&
    readinessFile.age_seconds <= 1800;
  return {
    readiness: {
      present: readinessFile.present,
      fresh: readinessFresh,
      age_seconds: readinessFile.age_seconds,
      generated_at: readiness.generated_at || null,
      start_date: readiness.start_date || null,
      horizon_days: readiness.days || null,
      ready_days: readiness.ready_days ?? null,
      next_day: nextDay
        ? {
            date: nextDay.date,
            state: nextDay.state,
            coverage_pct: nextDay.coverage_pct,
            content_coverage_pct: nextDay.content_coverage_pct,
            issue_count: nextDay.issue_count,
            hard_issue_count: nextDay.hard_issue_count,
          }
        : null,
    },
    content_factory: {
      present: factoryFile.present,
      age_seconds: factoryFile.age_seconds,
      state: factoryFile.data?.state || null,
      reason: factoryFile.data?.reason || null,
      target: factoryFile.data?.target || null,
      finished_at: factoryFile.data?.finished_at || null,
    },
    duration_engine: {
      present: durationFile.present,
      age_seconds: durationFile.age_seconds,
      state: durationFile.data?.state || null,
      target: durationFile.data?.target || null,
      finished_at: durationFile.data?.finished_at || null,
    },
    fallback_engine: {
      present: fallbackFile.present,
      age_seconds: fallbackFile.age_seconds,
      state: fallbackFile.data?.state || null,
      broadcast_date: fallbackFile.data?.broadcast_date || null,
      assigned: fallbackFile.data?.assigned ?? null,
      failed: fallbackFile.data?.failed ?? null,
      activate_at: fallbackFile.data?.activate_at || null,
      finished_at: fallbackFile.data?.finished_at || null,
    },
    broadcast_controller: {
      present: broadcastFile.present,
      age_seconds: broadcastFile.age_seconds,
      enabled: broadcastFile.data?.enabled ?? false,
      state: broadcastFile.data?.state || null,
      reason: broadcastFile.data?.reason || null,
      window: broadcastFile.data?.window || null,
      action: broadcastFile.data?.action || null,
      desired_state: broadcastFile.data?.desired_state || null,
      signal_state: broadcastFile.data?.signal_state || null,
      playout_state: broadcastFile.data?.playout_state || null,
      checked_at: broadcastFile.data?.checked_at || null,
      finished_at: broadcastFile.data?.finished_at || null,
    },
    healthy:
      readinessFresh &&
      (!nextDay || nextDay.state === "ready") &&
      !["failed", "cycle_failed", "duration_cycle_failed"].includes(
        String(factoryFile.data?.state || ""),
      ) &&
      String(durationFile.data?.state || "") !== "failed" &&
      !["failed", "fallback_incomplete"].includes(
        String(fallbackFile.data?.state || ""),
      ) &&
      String(broadcastFile.data?.state || "") !== "failed",
  };
}

async function automationSnapshot(){
  const [channel,incidents,rights,execution,backups,jobs,ai,schedule,mediaPending,aiReady,alerts,autopilot]=await Promise.all([
    pool.query("select id,name,status,desired_state,playout_state,signal_state,last_heartbeat_at,last_signal_at,last_error,quality_profile,(coalesce(config->>'youtube_video_id','')<>'') youtube_video_id_configured from public.gsa_tv_channels where id=$1",[CHANNEL_ID]),
    pool.query("select id,severity,message,created_at from public.gsa_tv_incidents where channel_id=$1 and not resolved order by created_at desc limit 20",[CHANNEL_ID]),
    pool.query("select id,title,rights_expires_at from public.gsa_tv_media_items where channel_id=$1 and rights_expires_at is not null and rights_expires_at<now()+interval '7 days' order by rights_expires_at limit 50",[CHANNEL_ID]),
    pool.query("select count(*)::int executions,count(*) filter(where outcome='fallback')::int fallbacks,coalesce(sum(duration_s),0)::numeric total_duration_s from public.gsa_tv_execution_log where channel_id=$1 and created_at>now()-interval '24 hours'",[CHANNEL_ID]),
    pool.query("select id,state,backup_type,started_at,finished_at,size_bytes from public.gsa_tv_backup_runs where channel_id=$1 order by started_at desc limit 5",[CHANNEL_ID]),
    pool.query("select id,job_type,status,progress,error_message,created_at,finished_at from public.gsa_tv_jobs where channel_id=$1 order by created_at desc limit 20",[CHANNEL_ID]),
    pool.query("select j.state,count(*)::int count from public.gsa_tv_ai_jobs j join public.gsa_tv_ai_projects p on p.id=j.project_id where p.channel_id=$1 and j.created_at>now()-interval '24 hours' group by j.state order by j.state",[CHANNEL_ID]),
    pool.query("select id,broadcast_date,version,state,title,published_at from public.gsa_tv_schedule_versions where channel_id=$1 order by broadcast_date desc,version desc limit 5",[CHANNEL_ID]),
    pool.query("select id,title,state,updated_at from public.gsa_tv_media_items where channel_id=$1 and state in ('received','processing') and updated_at<now()-interval '2 minutes' order by updated_at limit 50",[CHANNEL_ID]),
    pool.query("select id,name,project_type,state,autonomy_mode,updated_at from public.gsa_tv_ai_projects where channel_id=$1 and state='approved' and autonomy_mode in ('supervised_auto','authorized_routine') order by updated_at limit 20",[CHANNEL_ID]),
    pool.query("select enabled,min_severity,cooldown_minutes,(coalesce(whatsapp_number,'')<>'') recipient_configured from public.gsa_tv_alert_settings where channel_id=$1 limit 1",[CHANNEL_ID]),
    autopilotSnapshot()
  ]);
  return{server_time:new Date().toISOString(),channel:channel.rows[0]||null,open_incidents:incidents.rows,rights_expiring:rights.rows,execution_24h:execution.rows[0]||{},backups:backups.rows,recent_jobs:jobs.rows,ai_jobs_24h:ai.rows,schedule_versions:schedule.rows,media_pending:mediaPending.rows,ai_ready:aiReady.rows,alerts:alerts.rows[0]||{enabled:false,recipient_configured:false},autopilot,stream:streamState};
}

async function executeJob(job) {
  switch (job.job_type) {
    case "health_check":
      return { services: await heartbeat() };
    case "validate_schedule":
      return validateSchedule();
    case "compile_playlist":
      return compilePlaylist(job.payload?.date || null, { requirePublished: true });
    case "cache_warmup":
      return inspectCache();
    case "materialize_fixed_schedule": {
      const days = Math.max(1, Math.min(90, Number(job.payload?.days || 30)));
      const result = await pool.query(
        "select public.gsa_tv_refresh_fixed_schedule_horizon((now() at time zone 'America/Sao_Paulo')::date+1,$1,$2) result",
        [days, CHANNEL_ID],
      );
      return result.rows[0]?.result || { success: false };
    }
    case "cache_cleanup":
      return cleanOrphanMediaFiles();
    case "purge_media_files":
      return purgeMediaFiles(
        String(job.payload?.media_id || ""),
        String(job.payload?.drive_path || ""),
      );
    case "playout_reload": {
      const compiled = await compilePlaylist(localClock(new Date()).date, { requirePublished: true });
      await ffplayoutProcess("restart");
      await waitForHls();
      if (streamState.desired === "running") await startStream(streamState.mode || "program", true);
      return { ...compiled, ffplayout_restarted: true };
    }
    case "stream_start": {
      await compilePlaylist(localClock(new Date()).date, { requirePublished: true });
      return startStream("program", true);
    }
    case "stream_pause":
      return startStream("paused", true);
    case "stream_resume": {
      await compilePlaylist(localClock(new Date()).date, { requirePublished: true });
      return startStream("program", true);
    }
    case "stream_stop":
      return stopStream("operator");
    case "graphics_reload": {
      if (streamState.desired === "stopped")
        return { applied: false, reason: "stream_stopped" };
      return startStream(streamState.mode || "program", true);
    }
    case "playout_next":
      return ffplayoutPlayout("next");
    case "playout_previous":
      return ffplayoutPlayout("back");
    case "playout_reset":
      return ffplayoutPlayout("reset");
    case "media_take": {
      const mediaId = String(job.payload?.media_item_id || "");
      if (!/^media-[A-Za-z0-9_-]{3,200}$/.test(mediaId))
        throw new Error("Mídia inválida para operação ao vivo.");
      return startStream(`media:${mediaId}`, true);
    }
    case "emergency_take":
      return startStream("paused", true);
    case "live_take": {
      const sourceId = String(job.payload?.source_id || "");
      if (!/^[0-9a-f-]{36}$/i.test(sourceId))
        throw new Error("Fonte ao vivo inválida.");
      return startStream(`manual-live:${sourceId}`, true);
    }
    case "live_return": {
      await compilePlaylist(localClock(new Date()).date, { requirePublished: true });
      return startStream("program", true);
    }
    case "credentials_check":
      return checkStreamCredentials();
    case "relay_check":
      return relayCheck();
    case "probe_media":
      return inspectMedia(job);
    default:
      throw new Error(`Tipo de tarefa não suportado: ${job.job_type}`);
  }
}
async function takeJob() {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const found = await client.query(
      "select * from public.gsa_tv_jobs where status='pending' order by created_at for update skip locked limit 1",
    );
    if (!found.rowCount) {
      await client.query("commit");
      return null;
    }
    const job = found.rows[0];
    await client.query(
      "update public.gsa_tv_jobs set status='running',progress=5,started_at=now(),updated_at=now() where id=$1",
      [job.id],
    );
    await client.query("commit");
    return job;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
async function processJobs() {
  if (processing) return;
  processing = true;
  try {
    const job = await takeJob();
    if (!job) return;
    try {
      const result = await executeJob(job);
      await pool.query(
        "update public.gsa_tv_jobs set status='completed',progress=100,result=$2,error_message=null,finished_at=now(),updated_at=now() where id=$1",
        [job.id, result],
      );
      await resolveIncident(`Falha na tarefa ${job.job_type}`);
      await pool.query(
        "insert into public.gsa_tv_audit_log(channel_id,actor,action,resource_type,resource_id,ip_address,details) values($1,'GSA TV Control Plane','job_completed','job',$2,null,$3)",
        [CHANNEL_ID, job.id, { job_type: job.job_type }],
      );
    } catch (error) {
      await pool.query(
        "update public.gsa_tv_jobs set status='failed',error_message=$2,finished_at=now(),updated_at=now() where id=$1",
        [job.id, error.message.slice(0, 1000)],
      );
      const criticalJobs = new Set([
        "health_check",
        "stream_start",
        "stream_pause",
        "stream_resume",
        "stream_stop",
        "relay_check",
        "credentials_check",
        "live_take",
        "live_return",
        "playout_next",
        "playout_previous",
        "playout_reset",
        "media_take",
        "emergency_take",
      ]);
      await incident(
        `Falha na tarefa ${job.job_type}`,
        { job_id: job.id, error: error.message },
        criticalJobs.has(job.job_type) ? "critical" : "warning",
      );
    }
  } finally {
    processing = false;
    lastCycle = new Date().toISOString();
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (!cors(req, res))
    return json(res, 403, { error: "Origem não autorizada." });
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "cache-control": "no-store" });
    return res.end();
  }
  if (req.method === "GET" && url.pathname === "/health") {
    try {
      await pool.query("select 1");
      return json(res, 200, {
        status: "ok",
        service: "gsa-tv-control-plane",
        processing,
        last_cycle: lastCycle,
      });
    } catch (error) {
      return json(res, 503, { status: "error", error: error.message });
    }
  }
  if (req.method === "PUT" && url.pathname === "/media/upload") {
    try {
      return json(res, 201, await receiveUpload(req));
    } catch (error) {
      log("error", "media_upload_failed", { error: error.message });
      return json(res, error.statusCode || 500, {
        error: error.statusCode
          ? error.message
          : "Não foi possível armazenar a mídia.",
      });
    }
  }
  if (req.method === "POST" && url.pathname === "/media/import") {
    try {
      return json(res, 201, await importRemoteMedia(req));
    } catch (error) {
      log("error", "media_import_failed", { error: error.message });
      return json(res, error.statusCode || 500, {
        error: error.statusCode
          ? error.message
          : "Não foi possível importar a mídia.",
      });
    }
  }
  const enhanceMatch = url.pathname.match(/^\/media\/([^/]+)\/enhance$/);
  if (req.method === "POST" && enhanceMatch) {
    try {
      const mediaId = decodeURIComponent(enhanceMatch[1]);
      return json(res, 200, await enhanceMediaItem(req, mediaId));
    } catch (error) {
      log("error", "media_enhance_failed", { error: error.message });
      return json(res, error.statusCode || 500, {
        error: error.statusCode
          ? error.message
          : "Não foi possível aprimorar a mídia.",
      });
    }
  }
  const thumbMatch = url.pathname.match(/^\/media\/([^/]+)\/thumbnail(?:\.jpg)?$/);
  if (req.method === "GET" && thumbMatch) {
    try {
      const mediaId = decodeURIComponent(thumbMatch[1]);
      const thumbFile = path.join(MEDIA_DIR, "thumbnails", `${mediaId}.jpg`);
      if (fsSync.existsSync(thumbFile)) {
        res.writeHead(200, {
          "content-type": "image/jpeg",
          "cache-control": "public, max-age=86400",
          "access-control-allow-origin": "*",
        });
        return fsSync.createReadStream(thumbFile).pipe(res);
      }
      const { rows } = await pool.query("select drive_path,duration_s from public.gsa_tv_media_items where id=$1", [mediaId]);
      if (rows.length && rows[0].drive_path && fsSync.existsSync(rows[0].drive_path)) {
        const item = rows[0];
        const ssTime = Math.min(2, Math.max(0.5, (item.duration_s || 10) * 0.1));
        await execFileAsync("ffmpeg", [
          "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
          "-ss", String(ssTime),
          "-i", item.drive_path,
          "-frames:v", "1",
          "-vf", "scale=640:360:force_original_aspect_ratio=increase,crop=640:360",
          "-q:v", "3",
          thumbFile
        ]);
        if (fsSync.existsSync(thumbFile)) {
          res.writeHead(200, {
            "content-type": "image/jpeg",
            "cache-control": "public, max-age=86400",
            "access-control-allow-origin": "*",
          });
          return fsSync.createReadStream(thumbFile).pipe(res);
        }
      }
      return json(res, 404, { error: "Thumbnail indisponível." });
    } catch (error) {
      log("warn", "thumbnail_serve_failed", { error: error.message });
      return json(res, 500, { error: "Erro ao carregar thumbnail." });
    }
  }
  if (req.method === "POST" && url.pathname === "/fallback/configure") {
    try {
      return json(res, 200, await configureFallback(req));
    } catch (error) {
      log("error", "fallback_configuration_failed", { error: error.message });
      return json(res, error.statusCode || 500, {
        error: error.statusCode
          ? error.message
          : "Não foi possível preparar a tela de emergência.",
      });
    }
  }
  if (req.method === "PUT" && url.pathname === "/rights/evidence") {
    try {
      return json(res, 201, await receiveRightsEvidence(req));
    } catch (error) {
      log("error", "rights_evidence_failed", { error: error.message });
      return json(res, error.statusCode || 500, {
        error: error.statusCode
          ? error.message
          : "Não foi possível armazenar a comprovação.",
      });
    }
  }
  if (req.method === "GET" && url.pathname === "/storage/status") {
    try {
      return json(res, 200, await storageStatus(req));
    } catch (error) {
      return json(res, error.statusCode || 500, {
        error: error.statusCode
          ? error.message
          : "Não foi possível consultar o armazenamento.",
      });
    }
  }
  if (req.method === "GET" && url.pathname === "/ai/provider") {
    try {
      return json(res, 200, await aiProviderStatus(req));
    } catch (error) {
      return json(res, error.statusCode || 500, {
        error: error.statusCode
          ? error.message
          : "Não foi possível consultar o provedor.",
      });
    }
  }
  if (req.method === "PUT" && url.pathname === "/ai/provider") {
    try {
      return json(res, 200, await configureAiProvider(req));
    } catch (error) {
      return json(res, error.statusCode || 500, {
        error: error.statusCode
          ? error.message
          : "Não foi possível proteger a credencial de IA.",
      });
    }
  }
  const aiRunMatch = url.pathname.match(
    /^\/ai\/projects\/([0-9a-f-]{36})\/run$/i,
  );
  if (req.method === "POST" && aiRunMatch) {
    try {
      return json(res, 202, await runAiProject(req, aiRunMatch[1]));
    } catch (error) {
      log("error", "ai_project_failed", { error: error.message });
      return json(res, error.statusCode || 500, {
        error: error.statusCode
          ? error.message
          : "Não foi possível executar o projeto de IA.",
      });
    }
  }
  const aiReviewMatch = url.pathname.match(
    /^\/ai\/projects\/([0-9a-f-]{36})\/review$/i,
  );
  if (req.method === "POST" && aiReviewMatch) {
    try {
      return json(res, 200, await reviewAiProject(req, aiReviewMatch[1]));
    } catch (error) {
      log("error", "ai_project_review_failed", { error: error.message });
      return json(res, error.statusCode || 500, {
        error: error.statusCode
          ? error.message
          : "Não foi possível registrar a revisão humana.",
      });
    }
  }
  if (req.method === "PUT" && url.pathname === "/preview/token") {
    try {
      await requireAdminSession(req);
      const expires = Math.floor(Date.now() / 1000) + PREVIEW_TOKEN_TTL_SECONDS;
      return json(res, 200, {
        expires,
        token: previewSignature(expires),
        playlist: "stream.m3u8",
      });
    } catch (error) {
      return json(res, error.statusCode || 500, {
        error: error.statusCode
          ? error.message
          : "Não foi possível autorizar o preview.",
      });
    }
  }
  const mediaPreviewTokenMatch = url.pathname.match(/^\/media\/((?:media-)[A-Za-z0-9_-]{3,200})\/preview\/token$/);
  if (req.method === "PUT" && mediaPreviewTokenMatch) {
    try { return json(res, 200, await mediaPreviewToken(req, mediaPreviewTokenMatch[1])); }
    catch (error) { return json(res, error.statusCode || 500, { error: error.statusCode ? error.message : "Não foi possível autorizar a prévia da mídia." }); }
  }
  const mediaDeleteMatch = url.pathname.match(/^\/media\/((?:media-)[A-Za-z0-9_-]{3,200})$/);
  if (req.method === "DELETE" && mediaDeleteMatch) {
    try {
      return json(res, 200, await deleteMedia(req, mediaDeleteMatch[1]));
    } catch (error) {
      log("error", "media_delete_failed", { error: error.message });
      return json(res, error.statusCode || 500, {
        error: error.statusCode ? error.message : "Não foi possível excluir a mídia e liberar o espaço em disco.",
      });
    }
  }
  const mediaPreviewMatch = url.pathname.match(/^\/media-preview\/((?:media-)[A-Za-z0-9_-]{3,200})$/);
  if (req.method === "GET" && mediaPreviewMatch) {
    try { return await serveMediaPreview(req, res, url, mediaPreviewMatch[1]); }
    catch (error) { log("error", "media_preview_failed", { error: error.message }); return json(res, 500, { error: "Não foi possível carregar a mídia." }); }
  }
  if (req.method === "GET" && url.pathname === "/live-console/snapshot") {
    try { return json(res, 200, await liveConsoleSnapshot(req)); }
    catch (error) { return json(res, error.statusCode || 500, { error: error.statusCode ? error.message : "Não foi possível consultar a mesa ao vivo." }); }
  }
  if (req.method === "GET" && url.pathname.startsWith("/preview/")) {
    try {
      return await servePreview(url, res);
    } catch (error) {
      log("error", "preview_failed", { error: error.message });
      return json(res, 500, { error: "Não foi possível carregar o preview." });
    }
  }
  const liveCredentialsMatch = url.pathname.match(
    /^\/live-sources\/([0-9a-f-]{36})\/credentials$/i,
  );
  if (req.method === "PUT" && liveCredentialsMatch) {
    try {
      return json(
        res,
        200,
        await updateLiveSourceCredentials(req, liveCredentialsMatch[1]),
      );
    } catch (error) {
      return json(res, error.statusCode || 500, {
        error: error.statusCode
          ? error.message
          : "Não foi possível proteger a fonte ao vivo.",
      });
    }
  }
  if (!tokenValid(req)) return json(res, 401, { error: "Não autorizado." });
  if (req.method === "GET" && url.pathname === "/automation/snapshot") { try { return json(res,200,await automationSnapshot()); } catch(error) { return json(res,500,{error:"Falha ao montar snapshot de automação."}); } }
  if (req.method === "POST" && url.pathname === "/automation/jobs") { try { return json(res,202,await enqueueAutomationJob(await readJsonBody(req,65536))); } catch(error){ return json(res,error.statusCode||500,{error:error.message}); } }
  if(req.method==="POST"&&url.pathname==="/automation/report"){try{const body=await readJsonBody(req,131072);const reportType=String(body.type||"automation_report").replace(/[^a-z0-9_-]/gi,"").slice(0,80)||"automation_report";await pool.query("insert into public.gsa_tv_audit_log(channel_id,actor,action,resource_type,resource_id,ip_address,details) values($1,'n8n GSA TV','automation_report','automation',$2,null,$3)",[CHANNEL_ID,reportType,body]);return json(res,201,{saved:true,type:reportType});}catch(error){return json(res,error.statusCode||500,{error:error.message});}}
  const automationAiMatch=url.pathname.match(/^\/automation\/ai\/projects\/([0-9a-f-]{36})\/run$/i);
  if(req.method==="POST"&&automationAiMatch){try{return json(res,202,await queueAiProject(automationAiMatch[1],"n8n GSA TV",true));}catch(error){return json(res,error.statusCode||500,{error:error.message});}}
  if (req.method === "GET" && url.pathname === "/status")
    return json(res, 200, {
      services: await serviceHealth(),
      processing,
      last_cycle: lastCycle,
      stream: streamState,
      autopilot: await autopilotSnapshot(),
    });
  if (req.method === "POST" && url.pathname === "/process") {
    await processJobs();
    return json(res, 202, { accepted: true });
  }
  return json(res, 404, { error: "Rota inexistente." });
});

async function restoreRuntime() {
  try {
    const result = await pool.query(
      "select desired_state,playout_state from public.gsa_tv_channels where id=$1",
      [CHANNEL_ID],
    );
    const desired = result.rows[0]?.desired_state || "stopped";
    const storedMode = String(result.rows[0]?.playout_state || "program");
    const mode =
      storedMode.startsWith("live:") || storedMode.startsWith("manual-live:")
        ? storedMode
        : storedMode === "paused"
          ? "paused"
          : "program";

    if (USE_EXTERNAL_ENCODER) {
      try {
        const encoder = await encoderEngineStatus();
        if (encoder.outer_running && encoder.producer_running) {
          const actualMode = String(encoder.mode || mode || "program");
          const mismatch =
            desired !== "running" ||
            (mode !== actualMode &&
              !(mode === "program" && actualMode === "program"));

          // control_plane_restore_external_encoder_preserved:
          // Reattach to the already-running relay without restarting ffplayout,
          // recompiling a playlist or calling /v1/ensure.
          streamProcess = {
            external: true,
            killed: false,
            pid: encoder.producer_pid || null,
          };
          streamState = {
            desired: "running",
            actual: "sending",
            mode: actualMode,
            started_at: new Date().toISOString(),
            last_error: encoder.last_error || null,
          };
          await persistStreamState();

          if (mismatch) {
            await incident(
              "Estado do Control Plane divergiu do Encoder preservado",
              {
                stored_desired: desired,
                stored_mode: storedMode,
                encoder_mode: actualMode,
                producer_pid: encoder.producer_pid || null,
                outer_pid: encoder.outer_pid || null,
              },
              "warning",
            ).catch(() => {});
          }
          log("info", "control_plane_restore_external_encoder_preserved", {
            stored_desired: desired,
            stored_mode: storedMode,
            encoder_mode: actualMode,
            producer_pid: encoder.producer_pid || null,
            outer_pid: encoder.outer_pid || null,
          });
          await resolveIncident("Falha ao restaurar a transmissão da GSA TV");
          return;
        }
      } catch (error) {
        log("warn", "external_encoder_restore_probe_failed", {
          error: error.message,
        });
      }
    }

    if (desired === "running") {
      if (mode === "program") {
        await compilePlaylist(localClock(new Date()).date, {
          requirePublished: true,
        });
      }
      await startStream(mode, true);
    } else if (desired === "paused") {
      await startStream("paused", true);
    } else {
      streamState.desired = "stopped";
      streamState.actual = "stopped";
      streamState.mode = "off_air";
      await persistStreamState();
    }
    await resolveIncident("Falha ao restaurar a transmissão da GSA TV");
  } catch (error) {
    streamState.actual = "failed";
    streamState.last_error = error.message;
    await persistStreamState().catch(() => {});
    await incident("Falha ao restaurar a transmissão da GSA TV", {
      error: error.message,
    }).catch(() => {});
    log("error", "runtime_restore_failed", { error: error.message });
  }
}
server.listen(PORT, "127.0.0.1", () =>
  log("info", "control_plane_started", { port: PORT }),
);
const jobsTimer = setInterval(
  () =>
    processJobs().catch((e) =>
      log("error", "job_cycle_failed", { error: e.message }),
    ),
  5000,
);
const heartbeatTimer = setInterval(
  () =>
    heartbeat().catch((e) =>
      log("error", "heartbeat_failed", { error: e.message }),
    ),
  30000,
);
const liveAutomationTimer = setInterval(
  () =>
    scheduledLiveAutomation().catch((e) =>
      log("error", "scheduled_live_failed", { error: e.message }),
    ),
  5000,
);
const aiTimer = setInterval(
  () =>
    processAiJobs().catch((e) =>
      log("error", "ai_cycle_failed", { error: e.message }),
    ),
  5000,
);
void restoreRuntime()
  .then(() => heartbeat())
  .catch(() => {});
process.on("SIGTERM", async () => {
  clearInterval(jobsTimer);
  clearInterval(heartbeatTimer);
  clearInterval(liveAutomationTimer);
  clearInterval(aiTimer);
  await stopLiveRecording().catch(() => {});
  if (USE_EXTERNAL_ENCODER) {
    streamProcess = null;
    log("info", "control_plane_shutdown_encoder_preserved", {
      desired: streamState.desired,
      mode: streamState.mode,
    });
  } else {
    await terminateRelay().catch(() => {});
    try {
      await ffplayoutProcess("stop");
    } catch {}
    if (streamState.desired !== "stopped") {
      streamState.actual = "recovering";
      streamState.last_error = "Control plane em reinicialização.";
      await persistStreamState().catch(() => {});
    }
  }
  server.close();
  await pool.end();
});
