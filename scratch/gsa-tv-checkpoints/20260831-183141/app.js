'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { Pool } = require('pg');
const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PORT || 9202);
const DATABASE_URL = process.env.DATABASE_URL || '';
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN || '';
const CHANNEL_ID = process.env.CHANNEL_ID || 'ch-main';
const PLAYLISTS_DIR = process.env.PLAYLISTS_DIR || '/playlists';
const MEDIA_DIR = process.env.MEDIA_DIR || '/media';
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(MEDIA_DIR, 'incoming');
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024 * 1024);
const ALLOWED_ORIGINS = new Set(String(process.env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean));
const ALLOWED_EXTENSIONS = new Set(['.mp4','.mov','.mkv','.webm','.m4v','.mp3','.wav','.m4a','.aac','.flac','.png','.jpg','.jpeg','.webp']);
const FALLBACK_FILE = process.env.FALLBACK_FILE || '/fallback/gsa-tv-fallback-720p30.mp4';
const TV_SECRET_KEY = String(process.env.GSA_TV_SECRET_KEY || '');
const SERVICE_URLS = {
  ffplayout: process.env.FFPLAYOUT_URL || 'http://127.0.0.1:8787/',
};
if (!DATABASE_URL) throw new Error('DATABASE_URL é obrigatória.');
if (!INTERNAL_API_TOKEN || INTERNAL_API_TOKEN.length < 32) throw new Error('INTERNAL_API_TOKEN forte é obrigatório.');
const pool = new Pool({ connectionString: DATABASE_URL, max: 3, application_name: 'gsa-tv-control-plane' });
let processing = false;
let lastCycle = null;
let streamProcess = null;
let streamState = { desired: 'stopped', actual: 'stopped', mode: 'off_air', started_at: null, last_error: null };

function log(level, message, extra = {}) { process.stdout.write(JSON.stringify({ time: new Date().toISOString(), level, message, ...extra }) + '\n'); }
function json(res, status, body) { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); }
function cors(req, res) {
  const origin = String(req.headers.origin || '');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'origin');
    res.setHeader('access-control-allow-methods', 'GET,PUT,OPTIONS');
    res.setHeader('access-control-allow-headers', 'content-type,x-gsa-session-id,x-gsa-session-token,x-file-name,x-media-title,x-media-kind,x-advertiser-name,x-campaign-name,x-rights-confirmed');
  }
  return !origin || ALLOWED_ORIGINS.has(origin);
}
function tokenValid(req) {
  const value = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(value); const b = Buffer.from(INTERNAL_API_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function fromBase64Url(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized + '='.repeat((4 - normalized.length % 4) % 4), 'base64');
}
function decryptStreamKey(ciphertext) {
  if (!/^[0-9a-f]{64}$/i.test(TV_SECRET_KEY)) throw new Error('Chave interna de credenciais não configurada.');
  const [version, ivPart, encryptedPart] = String(ciphertext || '').split('.');
  if (version !== 'v1' || !ivPart || !encryptedPart) throw new Error('Credencial de transmissão inválida.');
  const encrypted = fromBase64Url(encryptedPart);
  if (encrypted.length <= 16) throw new Error('Credencial de transmissão corrompida.');
  const tag = encrypted.subarray(encrypted.length - 16);
  const body = encrypted.subarray(0, encrypted.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(TV_SECRET_KEY, 'hex'), fromBase64Url(ivPart));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}
async function persistStreamState() {
  await pool.query(`update public.gsa_tv_channels set desired_state=$2,playout_state=$3,signal_state=$4,last_signal_at=case when $4='sending' then now() else last_signal_at end,last_error=$5,updated_at=now() where id=$1`, [CHANNEL_ID,streamState.desired,streamState.mode,streamState.actual,streamState.last_error]);
}
async function stopStream(reason = 'operator') {
  streamState.desired = 'stopped';
  if (streamProcess && !streamProcess.killed) {
    streamProcess.kill('SIGTERM');
    await new Promise((resolve) => { const timer = setTimeout(() => { if (streamProcess && !streamProcess.killed) streamProcess.kill('SIGKILL'); resolve(); }, 8000); streamProcess.once('exit', () => { clearTimeout(timer); resolve(); }); });
  }
  streamProcess = null;
  streamState = { ...streamState, actual: 'stopped', mode: 'off_air', started_at: null, last_error: null };
  await persistStreamState();
  log('info', 'stream_stopped', { reason });
  return streamState;
}
async function startStream(mode = 'fallback') {
  if (streamProcess && !streamProcess.killed) return streamState;
  const secret = await pool.query('select rtmp_server,stream_key_ciphertext from public.gsa_tv_channel_secrets where channel_id=$1 limit 1', [CHANNEL_ID]);
  if (!secret.rowCount || !secret.rows[0].stream_key_ciphertext) throw new Error('Credencial do YouTube não configurada.');
  await fs.access(FALLBACK_FILE);
  const streamKey = decryptStreamKey(secret.rows[0].stream_key_ciphertext);
  const target = `${String(secret.rows[0].rtmp_server || '').replace(/\/$/, '')}/${streamKey}`;
  streamState = { desired: mode === 'paused' ? 'paused' : 'running', actual: 'starting', mode, started_at: new Date().toISOString(), last_error: null };
  await persistStreamState();
  const args = ['-hide_banner','-nostdin','-loglevel','warning','-re','-stream_loop','-1','-i',FALLBACK_FILE,'-c:v','libx264','-preset','veryfast','-tune','zerolatency','-r','30','-g','60','-keyint_min','60','-b:v','4000k','-maxrate','4000k','-bufsize','8000k','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-ar','48000','-ac','2','-f','flv',target];
  streamProcess = spawn('ffmpeg', args, { stdio: ['ignore','ignore','pipe'] });
  let stderrTail = '';
  streamProcess.stderr.on('data', (chunk) => { stderrTail = `${stderrTail}${chunk}`.slice(-4000); });
  streamProcess.once('spawn', async () => { streamState.actual = 'sending'; await persistStreamState().catch(() => {}); log('info', 'stream_started', { mode, pid: streamProcess?.pid }); });
  streamProcess.once('exit', async (code, signal) => {
    streamProcess = null;
    const shouldRestart = streamState.desired !== 'stopped';
    streamState.actual = shouldRestart ? 'recovering' : 'stopped';
    streamState.last_error = shouldRestart ? `FFmpeg encerrou (${code ?? signal}). ${stderrTail.slice(-600)}` : null;
    await persistStreamState().catch(() => {});
    if (shouldRestart) setTimeout(() => startStream(streamState.mode).catch((error) => log('error', 'stream_restart_failed', { error: error.message })), 3000);
  });
  return streamState;
}
async function checkStreamCredentials() {
  const secret = await pool.query('select rtmp_server,stream_key_ciphertext from public.gsa_tv_channel_secrets where channel_id=$1 limit 1', [CHANNEL_ID]);
  if (!secret.rowCount || !secret.rows[0].stream_key_ciphertext) throw new Error('Credencial do YouTube não configurada.');
  const key = decryptStreamKey(secret.rows[0].stream_key_ciphertext);
  if (key.length < 6 || /^rtmps?:\/\//i.test(key)) throw new Error('Credencial protegida inválida.');
  return { configured: true, decryptable: true, rtmp_protocol: new URL(secret.rows[0].rtmp_server).protocol };
}
async function fetchState(name, url) {
  try { const response = await fetch(url, { signal: AbortSignal.timeout(5000) }); return { name, ok: response.ok, status: response.status }; }
  catch (error) { return { name, ok: false, error: error.message }; }
}
async function serviceHealth() { return Promise.all(Object.entries(SERVICE_URLS).map(([name, url]) => fetchState(name, url))); }
function resolveMediaPath(storedPath) {
  const relative = String(storedPath || '').replace(/^\/?media\/?/i, '').replace(/^[/\\]+/, '');
  const resolved = path.resolve(MEDIA_DIR, relative || path.basename(String(storedPath || '')));
  const root = `${path.resolve(MEDIA_DIR)}${path.sep}`;
  if (!resolved.startsWith(root)) throw new Error('Caminho de mídia fora do armazenamento autorizado.');
  return resolved;
}
async function requireAdminSession(req) {
  const sessionId = String(req.headers['x-gsa-session-id'] || '');
  const sessionToken = String(req.headers['x-gsa-session-token'] || '');
  if (!/^[0-9a-f-]{36}$/i.test(sessionId) || sessionToken.length < 32 || sessionToken.length > 300) throw Object.assign(new Error('Sessão administrativa ausente.'), { statusCode: 401 });
  try {
    const result = await pool.query('select * from public.gsa_admin_session_actor($1::uuid,$2::text) limit 1', [sessionId, sessionToken]);
    if (!result.rowCount) throw new Error('Sessão administrativa inválida.');
    return result.rows[0];
  } catch (error) {
    log('warn', 'upload_auth_rejected', { reason: error.message });
    throw Object.assign(new Error('Sessão administrativa inválida ou expirada.'), { statusCode: 401 });
  }
}
function decodedHeader(req, name, maxLength) {
  const raw = String(req.headers[name] || '');
  let value = raw;
  try { value = decodeURIComponent(raw); } catch { value = raw; }
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}
async function receiveUpload(req) {
  const actor = await requireAdminSession(req);
  const declaredSize = Number(req.headers['content-length'] || 0);
  if (!Number.isFinite(declaredSize) || declaredSize <= 0) throw Object.assign(new Error('Arquivo vazio ou tamanho não informado.'), { statusCode: 400 });
  if (declaredSize > MAX_UPLOAD_BYTES) throw Object.assign(new Error('O arquivo ultrapassa o limite permitido.'), { statusCode: 413 });
  const originalName = path.basename(decodedHeader(req, 'x-file-name', 240));
  const extension = path.extname(originalName).toLowerCase();
  if (!originalName || !ALLOWED_EXTENSIONS.has(extension)) throw Object.assign(new Error('Tipo de arquivo não permitido.'), { statusCode: 415 });
  const title = decodedHeader(req, 'x-media-title', 180) || path.basename(originalName, extension);
  const mediaKind = decodedHeader(req, 'x-media-kind', 30) || 'program';
  if (!['program','advertising','identity','filler'].includes(mediaKind)) throw Object.assign(new Error('Categoria de mídia inválida.'), { statusCode: 400 });
  const rightsOk = String(req.headers['x-rights-confirmed'] || '').toLowerCase() === 'true';
  const advertiser = decodedHeader(req, 'x-advertiser-name', 160) || null;
  const campaign = decodedHeader(req, 'x-campaign-name', 160) || null;
  await fs.mkdir(UPLOAD_DIR, { recursive: true, mode: 0o750 });
  const mediaId = `media-${crypto.randomUUID()}`;
  const storedName = `${mediaId}${extension}`;
  const temporary = path.join(UPLOAD_DIR, `.${storedName}.uploading`);
  const target = path.join(UPLOAD_DIR, storedName);
  const hash = crypto.createHash('sha256');
  let received = 0;
  const meter = new Transform({ transform(chunk, _encoding, callback) {
    received += chunk.length;
    if (received > MAX_UPLOAD_BYTES) return callback(Object.assign(new Error('O arquivo ultrapassa o limite permitido.'), { statusCode: 413 }));
    hash.update(chunk); callback(null, chunk);
  }});
  try {
    await pipeline(req, meter, fsSync.createWriteStream(temporary, { flags: 'wx', mode: 0o640 }));
    if (received !== declaredSize) throw new Error('O envio foi interrompido antes da conclusão.');
    const checksum = hash.digest('hex');
    const duplicate = await pool.query("select id,title from public.gsa_tv_media_items where metadata->>'sha256'=$1 limit 1", [checksum]);
    if (duplicate.rowCount) throw Object.assign(new Error(`Este arquivo já foi enviado como \"${duplicate.rows[0].title}\".`), { statusCode: 409 });
    await fs.rename(temporary, target);
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`insert into public.gsa_tv_media_items(id,channel_id,title,original_filename,duration_s,state,rights_ok,drive_path,media_kind,advertiser_name,campaign_name,source_type,ai_generated,approval_state,metadata,updated_at) values($1,$2,$3,$4,1,'processing',$5,$6,$7,$8,$9,'uploaded',false,'pending',$10,now())`, [mediaId,CHANNEL_ID,title,originalName,rightsOk,target,mediaKind,advertiser,campaign,{ sha256: checksum, size_bytes: received, uploaded_by: actor.ator_nome, storage: 'vps' }]);
      await client.query(`insert into public.gsa_tv_jobs(id,channel_id,job_type,status,progress,payload,created_at,updated_at) values($1,$2,'probe_media','pending',0,$3,now(),now())`, [`job-${crypto.randomUUID()}`,CHANNEL_ID,{ media_item_id: mediaId }]);
      await client.query(`insert into public.gsa_tv_audit_log(channel_id,actor,action,resource_type,resource_id,details) values($1,$2,'media_uploaded','media',$3,$4)`, [CHANNEL_ID,actor.ator_nome,mediaId,{ original_filename: originalName, size_bytes: received, sha256: checksum }]);
      await client.query('commit');
    } catch (error) { await client.query('rollback'); await fs.rm(target, { force: true }); throw error; }
    finally { client.release(); }
    return { success: true, id: mediaId, title, filename: storedName, size_bytes: received, state: 'processing' };
  } catch (error) { await fs.rm(temporary, { force: true }).catch(() => {}); throw error; }
}
async function incident(message, details) {
  const existing = await pool.query("select 1 from public.gsa_tv_incidents where channel_id=$1 and message=$2 and not resolved limit 1", [CHANNEL_ID, message]);
  if (!existing.rowCount) await pool.query("insert into public.gsa_tv_incidents(channel_id,severity,message,details) values($1,'critical',$2,$3)", [CHANNEL_ID, message, details]);
}
async function heartbeat() {
  const states = await serviceHealth();
  const failed = states.filter((item) => !item.ok);
  await pool.query("update public.gsa_tv_channels set status=$2,last_heartbeat_at=now(),last_error=$3,updated_at=now() where id=$1", [CHANNEL_ID, failed.length ? 'degraded' : 'online', failed.length ? failed.map((x) => x.name).join(', ') : null]);
  if (failed.length) await incident('Serviços internos da GSA TV indisponíveis', { services: states });
  else await pool.query("update public.gsa_tv_incidents set resolved=true,resolved_at=now() where channel_id=$1 and message='Serviços internos da GSA TV indisponíveis' and not resolved", [CHANNEL_ID]);
  return states;
}
async function validateSchedule() {
  const overlaps = await pool.query(`select a.id as first_id,b.id as second_id from public.gsa_tv_schedule_slots a join public.gsa_tv_schedule_slots b on a.channel_id=b.channel_id and a.id<b.id and a.state<>'cancelled' and b.state<>'cancelled' and tstzrange(a.scheduled_start,a.scheduled_end,'[)') && tstzrange(b.scheduled_start,b.scheduled_end,'[)') where a.channel_id=$1 and a.scheduled_end>now()`, [CHANNEL_ID]);
  if (overlaps.rowCount) throw new Error(`Programação contém ${overlaps.rowCount} conflito(s).`);
  return { overlaps: 0 };
}
async function compilePlaylist() {
  await validateSchedule();
  const rows = await pool.query(`select s.id,s.scheduled_start,s.scheduled_end,s.slot_type,m.title,m.drive_path,m.duration_s from public.gsa_tv_schedule_slots s join public.gsa_tv_media_items m on m.id=s.media_item_id where s.channel_id=$1 and s.state='confirmed' and s.scheduled_end>now() and s.scheduled_start<now()+interval '48 hours' and m.state='ready' and m.rights_ok and (m.rights_expires_at is null or m.rights_expires_at>=s.scheduled_end) order by s.scheduled_start`, [CHANNEL_ID]);
  const program = [];
  for (const item of rows.rows) {
    const source = resolveMediaPath(item.drive_path);
    try { await fs.access(source); } catch { throw new Error(`Arquivo não encontrado no cache: ${path.basename(source)}`); }
    program.push({ id: item.id, in: item.scheduled_start, out: item.scheduled_end, source, category: item.slot_type, title: item.title });
  }
  if (!program.length) throw new Error('Não há programação pronta nas próximas 48 horas.');
  await fs.mkdir(PLAYLISTS_DIR, { recursive: true });
  const payload = { channel: CHANNEL_ID, generated_at: new Date().toISOString(), program };
  const target = path.join(PLAYLISTS_DIR, `${new Date().toISOString().slice(0, 10)}.json`);
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(payload, null, 2), { encoding: 'utf8', mode: 0o640 });
  await fs.rename(temporary, target);
  const playlistId = `playlist-${new Date().toISOString().slice(0, 10)}`;
  await pool.query(`insert into public.gsa_tv_playlists(id,channel_id,name,items,is_active,updated_at) values($1,$2,$3,$4,true,now()) on conflict(id) do update set items=excluded.items,is_active=true,updated_at=now()`, [playlistId, CHANNEL_ID, `Grade ${new Date().toISOString().slice(0, 10)}`, program]);
  return { playlist_file: target, slot_count: program.length };
}
async function inspectMedia(job) {
  const mediaId = job.payload?.media_item_id;
  const row = await pool.query('select * from public.gsa_tv_media_items where id=$1', [mediaId]);
  if (!row.rowCount) throw new Error('Mídia da tarefa não encontrada.');
  const media = row.rows[0];
  const source = resolveMediaPath(media.drive_path);
  try {
    const { stdout } = await execFileAsync('ffprobe', ['-v','error','-show_streams','-show_format','-of','json',source], { timeout: 120000, maxBuffer: 1024 * 1024 });
    const probe = JSON.parse(stdout); const video = probe.streams?.find((x) => x.codec_type === 'video'); const audio = probe.streams?.find((x) => x.codec_type === 'audio');
    if (!video || !audio) throw new Error('O arquivo deve possuir vídeo e áudio.');
    const duration = Math.round(Number(probe.format?.duration || media.duration_s));
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Duração de mídia inválida.');
    const fpsParts = String(video.avg_frame_rate || '0/1').split('/').map(Number); const fps = fpsParts[1] ? Math.round(fpsParts[0] / fpsParts[1]) : 0;
    await pool.query(`update public.gsa_tv_media_items set state='ready',duration_s=$2,video_codec=$3,video_width=$4,video_height=$5,video_fps=$6,video_bitrate_kbps=$7,audio_codec=$8,audio_sample_rate=$9,audio_channels=$10,audio_bitrate_kbps=$11,updated_at=now() where id=$1`, [mediaId,duration,video.codec_name,video.width,video.height,fps,Math.round(Number(video.bit_rate || 0)/1000),audio.codec_name,Number(audio.sample_rate || 0),audio.channels,Math.round(Number(audio.bit_rate || 0)/1000)]);
    return { media_item_id: mediaId, duration_s: duration, video_codec: video.codec_name, audio_codec: audio.codec_name };
  } catch (error) {
    await pool.query("update public.gsa_tv_media_items set state='failed',updated_at=now() where id=$1", [mediaId]);
    throw error;
  }
}
async function inspectCache() {
  const rows = await pool.query(`select distinct m.id,m.title,m.drive_path from public.gsa_tv_schedule_slots s join public.gsa_tv_media_items m on m.id=s.media_item_id where s.channel_id=$1 and s.scheduled_end>now() and s.scheduled_start<now()+interval '48 hours' and s.state='confirmed'`, [CHANNEL_ID]);
  const missing = [];
  for (const item of rows.rows) { const source = resolveMediaPath(item.drive_path); try { await fs.access(source); } catch { missing.push({ id: item.id, title: item.title, file: path.basename(source) }); } }
  if (missing.length) throw new Error(`${missing.length} arquivo(s) programado(s) não estão no cache.`);
  return { checked: rows.rowCount, missing: 0 };
}
async function callService(url, method = 'POST') {
  const response = await fetch(url, { method, headers: { authorization: `Bearer ${INTERNAL_API_TOKEN}` }, signal: AbortSignal.timeout(120000) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status} ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return { response: text }; }
}
async function executeJob(job) {
  switch (job.job_type) {
    case 'health_check': return { services: await heartbeat() };
    case 'validate_schedule': return validateSchedule();
    case 'compile_playlist': return compilePlaylist();
    case 'cache_warmup': return inspectCache();
    case 'cache_cleanup': return { safe_mode: true, message: 'Limpeza destrutiva exige política de retenção configurada.' };
    case 'playout_reload': {
      await validateSchedule();
      return compilePlaylist();
    }
    case 'stream_start': return startStream('fallback');
    case 'stream_pause': {
      if (streamProcess) await stopStream('pause_switch');
      return startStream('paused');
    }
    case 'stream_resume': {
      if (streamProcess) await stopStream('resume_switch');
      return startStream('fallback');
    }
    case 'stream_stop': return stopStream('operator');
    case 'credentials_check': return checkStreamCredentials();
    case 'probe_media': return inspectMedia(job);
    default: throw new Error(`Tipo de tarefa não suportado: ${job.job_type}`);
  }
}
async function takeJob() {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const found = await client.query("select * from public.gsa_tv_jobs where status='pending' order by created_at for update skip locked limit 1");
    if (!found.rowCount) { await client.query('commit'); return null; }
    const job = found.rows[0];
    await client.query("update public.gsa_tv_jobs set status='running',progress=5,started_at=now(),updated_at=now() where id=$1", [job.id]);
    await client.query('commit'); return job;
  } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
}
async function processJobs() {
  if (processing) return; processing = true;
  try {
    const job = await takeJob(); if (!job) return;
    try {
      const result = await executeJob(job);
      await pool.query("update public.gsa_tv_jobs set status='completed',progress=100,result=$2,error_message=null,finished_at=now(),updated_at=now() where id=$1", [job.id, result]);
      await pool.query("insert into public.gsa_tv_audit_log(channel_id,actor,action,resource_type,resource_id,ip_address,details) values($1,'GSA TV Control Plane','job_completed','job',$2,null,$3)", [CHANNEL_ID, job.id, { job_type: job.job_type }]);
    } catch (error) {
      await pool.query("update public.gsa_tv_jobs set status='failed',error_message=$2,finished_at=now(),updated_at=now() where id=$1", [job.id, error.message.slice(0, 1000)]);
      await incident(`Falha na tarefa ${job.job_type}`, { job_id: job.id, error: error.message });
    }
  } finally { processing = false; lastCycle = new Date().toISOString(); }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (!cors(req, res)) return json(res, 403, { error: 'Origem não autorizada.' });
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'cache-control': 'no-store' }); return res.end(); }
  if (req.method === 'GET' && url.pathname === '/health') {
    try { await pool.query('select 1'); return json(res, 200, { status: 'ok', service: 'gsa-tv-control-plane', processing, last_cycle: lastCycle }); }
    catch (error) { return json(res, 503, { status: 'error', error: error.message }); }
  }
  if (req.method === 'PUT' && url.pathname === '/media/upload') {
    try { return json(res, 201, await receiveUpload(req)); }
    catch (error) { log('error', 'media_upload_failed', { error: error.message }); return json(res, error.statusCode || 500, { error: error.statusCode ? error.message : 'Não foi possível armazenar a mídia.' }); }
  }
  if (!tokenValid(req)) return json(res, 401, { error: 'Não autorizado.' });
  if (req.method === 'GET' && url.pathname === '/status') return json(res, 200, { services: await serviceHealth(), processing, last_cycle: lastCycle, stream: streamState });
  if (req.method === 'POST' && url.pathname === '/process') { await processJobs(); return json(res, 202, { accepted: true }); }
  return json(res, 404, { error: 'Rota inexistente.' });
});

server.listen(PORT, '127.0.0.1', () => log('info', 'control_plane_started', { port: PORT }));
const jobsTimer = setInterval(() => processJobs().catch((e) => log('error', 'job_cycle_failed', { error: e.message })), 5000);
const heartbeatTimer = setInterval(() => heartbeat().catch((e) => log('error', 'heartbeat_failed', { error: e.message })), 30000);
void heartbeat();
process.on('SIGTERM', async () => { clearInterval(jobsTimer); clearInterval(heartbeatTimer); await stopStream('service_shutdown').catch(() => {}); server.close(); await pool.end(); });
