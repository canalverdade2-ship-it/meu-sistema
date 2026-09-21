'use strict';

const http = require('node:http');
const { execFile } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const PORT = parseInt(process.env.PORT || '9200', 10);
const SCRIPTS_DIR = process.env.SCRIPTS_DIR || '/scripts';
const CACHE_DIR = process.env.CACHE_DIR || '/media';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// Logger simples (JSON estruturado para Docker)
function log(level, msg, extra = {}) {
  process.stdout.write(JSON.stringify({ time: new Date().toISOString(), level, msg, ...extra }) + '\n');
}

// Fila in-memory simples (será substituída por jobs da tabela gsa_tv.jobs na Fase 8)
const queue = [];
let processing = false;

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;
  const job = queue.shift();
  try {
    await runJob(job);
  } catch (err) {
    log('error', 'job_failed', { job_id: job.id, error: err.message });
  } finally {
    processing = false;
    setImmediate(processQueue);
  }
}

async function runJob(job) {
  log('info', 'job_start', { job_id: job.id, type: job.type, file: job.file });

  // Etapa 1: Validação com ffprobe
  const validateScript = path.join(SCRIPTS_DIR, 'preset-validate.sh');
  const { stdout: validateOut } = await execFileAsync('bash', [validateScript, job.file, '--json'], { timeout: 120_000 });
  const validation = JSON.parse(validateOut);

  if (!validation.pass) {
    log('warn', 'validation_failed', { job_id: job.id, reasons: validation.reasons });
    await updateMediaState(job.media_item_id, 'quarantine', validation.reasons);
    return;
  }

  log('info', 'validation_passed', { job_id: job.id, codec: validation.video.codec, resolution: `${validation.video.width}x${validation.video.height}` });
  await updateMediaState(job.media_item_id, 'normalizing');

  // Etapa 2: Normalização com ffmpeg
  const outputPath = path.join(CACHE_DIR, 'normalized', path.basename(job.file, path.extname(job.file)) + '_norm.mp4');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const normalizeScript = path.join(SCRIPTS_DIR, 'preset-normalize.sh');
  await execFileAsync('bash', [normalizeScript, job.file, outputPath], { timeout: 3600_000 });

  log('info', 'normalization_done', { job_id: job.id, output: outputPath });
  await updateMediaState(job.media_item_id, 'ready', null, outputPath);
}

async function updateMediaState(mediaItemId, state, errorMessage = null, cachePath = null) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !mediaItemId) {
    log('warn', 'supabase_not_configured', { media_item_id: mediaItemId, state });
    return;
  }
  // Atualiza via Supabase REST (será ativado na Fase 8)
  log('info', 'state_update', { media_item_id: mediaItemId, state, cachePath });
}

// HTTP Server
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'gsa-tv-media-worker', queue_depth: queue.length }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end([
      `# HELP gsa_tv_media_worker_queue_depth Jobs na fila`,
      `# TYPE gsa_tv_media_worker_queue_depth gauge`,
      `gsa_tv_media_worker_queue_depth ${queue.length}`,
      `# HELP gsa_tv_media_worker_processing Se está processando`,
      `# TYPE gsa_tv_media_worker_processing gauge`,
      `gsa_tv_media_worker_processing ${processing ? 1 : 0}`,
    ].join('\n') + '\n');
    return;
  }

  if (req.method === 'POST' && url.pathname === '/jobs') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const job = JSON.parse(body);
        if (!job.file || !job.type) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'file e type são obrigatórios' }));
          return;
        }
        job.id = job.id || `job-${Date.now()}`;
        queue.push(job);
        log('info', 'job_queued', { job_id: job.id, queue_depth: queue.length });
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ job_id: job.id, queued: true }));
        setImmediate(processQueue);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'JSON inválido' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  log('info', 'started', { port: PORT, scripts_dir: SCRIPTS_DIR, cache_dir: CACHE_DIR });
});

process.on('SIGTERM', () => {
  log('info', 'shutting_down');
  server.close(() => process.exit(0));
});
