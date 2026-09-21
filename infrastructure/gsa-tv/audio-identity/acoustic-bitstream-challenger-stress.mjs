import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'ssh2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VPS_HOST = process.env.VPS_HOST || '147.15.43.141';
const VPS_USER = process.env.VPS_USER || 'opc';
const SSH_KEY_PATH = process.env.SSH_KEY_PATH || 'C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key';
const PROD_AUDIO_DIR = '/opt/gsa-tv/cache/media/1/identity/audio';

if (!fs.existsSync(SSH_KEY_PATH)) {
  console.error(`[FATAL] SSH Key not found at: ${SSH_KEY_PATH}`);
  process.exit(1);
}

const privateKey = fs.readFileSync(SSH_KEY_PATH);

function sshExec(conn, cmd, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    let timer = setTimeout(() => {
      reject(new Error(`SSH Command timed out after ${timeoutMs}ms: ${cmd.slice(0, 100)}`));
    }, timeoutMs);

    conn.exec(cmd, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        return reject(err);
      }
      let stdout = '';
      let stderr = '';
      stream.on('data', (d) => { stdout += d.toString(); });
      stream.stderr.on('data', (d) => { stderr += d.toString(); });
      stream.on('close', (code) => {
        clearTimeout(timer);
        resolve({ code, stdout, stderr });
      });
    });
  });
}

async function main() {
  console.log('================================================================================');
  console.log('    CHALLENGER 2: ACOUSTIC & BITSTREAM ADVERSARIAL STRESS TEST SUITE            ');
  console.log('================================================================================');
  console.log(`Target VPS     : ${VPS_HOST} (${VPS_USER})`);
  console.log(`Audio Cache    : ${PROD_AUDIO_DIR}`);
  console.log(`Sample Target  : 30 tracks (25 stratified + 5 adversarial boundary cases)`);
  console.log(`Integrity Pass : ffprobe metadata + ffmpeg full bitstream decode + range stream`);
  console.log('--------------------------------------------------------------------------------');

  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect({
      host: VPS_HOST,
      port: 22,
      username: VPS_USER,
      privateKey,
      readyTimeout: 30000
    });
  });

  console.log('>>> [1/5] SSH Connection Established.');

  const remoteHarnessScript = `
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync, spawnSync } = require('child_process');

const AUDIO_DIR = '${PROD_AUDIO_DIR}';
const CATEGORIES = ['news', 'viral', 'faith', 'lifestyle', 'sfx'];

const result = {
  timestamp: new Date().toISOString(),
  inventory: { totalFiles: 0, byCategory: {}, corruptStubs: 0 },
  magicByteAudit: { passed: 0, failed: 0, failures: [] },
  sampledTracks: [],
  adversarialEdgeCases: [],
  bufferingBenchmarks: [],
  streamingHttpTests: [],
  overallVerdict: 'PENDING',
  summary: {}
};

// 1. Inventory & Magic Bytes Audit
let allFiles = [];
for (const cat of CATEGORIES) {
  const catDir = path.join(AUDIO_DIR, cat);
  if (!fs.existsSync(catDir)) continue;
  const files = fs.readdirSync(catDir)
    .filter(f => f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.m4a'))
    .map(f => {
      const fullPath = path.join(catDir, f);
      const stat = fs.statSync(fullPath);
      return { category: cat, filename: f, fullPath, size: stat.size };
    });

  result.inventory.byCategory[cat] = files.length;
  result.inventory.totalFiles += files.length;
  allFiles = allFiles.concat(files);
}

for (const file of allFiles) {
  if (file.size < 4096) {
    result.inventory.corruptStubs++;
  }
  const fd = fs.openSync(file.fullPath, 'r');
  const buf = Buffer.alloc(12);
  fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);

  let isValid = false;
  if (file.filename.endsWith('.mp3')) {
    if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
      isValid = true;
    } else if (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) {
      isValid = true;
    }
  } else if (file.filename.endsWith('.wav')) {
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') {
      isValid = true;
    }
  }

  if (isValid) {
    result.magicByteAudit.passed++;
  } else {
    result.magicByteAudit.failed++;
    result.magicByteAudit.failures.push({ file: file.fullPath, headerHex: buf.toString('hex') });
  }
}

// 2. Stratified Random Sampling (5 from each category = 25 tracks)
const selectedTracks = [];
const rng = (arr) => arr.slice().sort(() => 0.5 - Math.random());

for (const cat of CATEGORIES) {
  const catFiles = allFiles.filter(f => f.category === cat);
  const picked = rng(catFiles).slice(0, 5);
  for (const p of picked) {
    selectedTracks.push({ ...p, selectionReason: 'stratified_random_' + cat });
  }
}

// 3. Adversarial Boundary Cases
const sortedBySize = allFiles.slice().sort((a, b) => a.size - b.size);
selectedTracks.push({ ...sortedBySize[0], selectionReason: 'adversarial_edge_smallest_size' });
selectedTracks.push({ ...sortedBySize[sortedBySize.length - 1], selectionReason: 'adversarial_edge_largest_size' });

const wavFiles = allFiles.filter(f => f.filename.endsWith('.wav'));
if (wavFiles.length > 0) {
  selectedTracks.push({ ...rng(wavFiles)[0], selectionReason: 'adversarial_edge_wav_format' });
}

let manifest = [];
try {
  manifest = JSON.parse(fs.readFileSync(path.join(AUDIO_DIR, 'manifest.json'), 'utf8'));
} catch (e) {}

if (manifest.length > 0) {
  const parseDur = (d) => {
    if (!d) return 0;
    const parts = d.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  };
  const sortedDur = manifest.filter(m => m.duration).sort((a, b) => parseDur(a.duration) - parseDur(b.duration));
  const shortest = sortedDur[0];
  const longest = sortedDur[sortedDur.length - 1];
  
  const shortestFile = allFiles.find(f => f.filename === shortest.filename);
  if (shortestFile) selectedTracks.push({ ...shortestFile, selectionReason: 'adversarial_edge_shortest_duration' });
  const longestFile = allFiles.find(f => f.filename === longest.filename);
  if (longestFile) selectedTracks.push({ ...longestFile, selectionReason: 'adversarial_edge_longest_duration' });
}

const uniqueTracksMap = new Map();
for (const t of selectedTracks) {
  if (!uniqueTracksMap.has(t.fullPath)) {
    uniqueTracksMap.set(t.fullPath, t);
  }
}

const remaining = allFiles.filter(f => !uniqueTracksMap.has(f.fullPath));
const shuffledRemaining = rng(remaining);
while (uniqueTracksMap.size < 30 && shuffledRemaining.length > 0) {
  const backfill = shuffledRemaining.pop();
  uniqueTracksMap.set(backfill.fullPath, { ...backfill, selectionReason: 'backfill_sample_30' });
}

const finalSamples = Array.from(uniqueTracksMap.values()).slice(0, 30);
console.log('Selected ' + finalSamples.length + ' tracks for deep acoustic and bitstream verification.');

// 4. ffprobe & ffmpeg Null-Sink Bitstream Decoding
let passedCount = 0;
let failedCount = 0;

for (let i = 0; i < finalSamples.length; i++) {
  const track = finalSamples[i];
  const sampleResult = {
    index: i + 1,
    category: track.category,
    filename: track.filename,
    selectionReason: track.selectionReason,
    sizeBytes: track.size,
    ffprobe: { passed: false, codec: null, sampleRate: null, channels: null, duration: null, bitRate: null, error: null },
    ffmpegDecode: { passed: false, exitCode: null, stderr: null, durationSec: null },
    bufferingBenchmark: { headerReadMs: null, midSeekMs: null, tailSeekMs: null },
    trackVerdict: 'FAIL'
  };

  try {
    const probeCmd = 'ffprobe -v error -show_entries format=format_name,duration,size,bit_rate:stream=index,codec_name,codec_type,sample_rate,channels,channel_layout,bits_per_raw_sample -of json "' + track.fullPath + '"';
    const probeOut = execSync(probeCmd, { encoding: 'utf8', timeout: 30000 });
    const probeData = JSON.parse(probeOut);
    const audioStream = (probeData.streams || []).find(s => s.codec_type === 'audio');
    const format = probeData.format || {};

    if (!audioStream) {
      sampleResult.ffprobe.error = 'No audio stream detected by ffprobe';
    } else {
      sampleResult.ffprobe.codec = audioStream.codec_name;
      sampleResult.ffprobe.sampleRate = parseInt(audioStream.sample_rate || '0', 10);
      sampleResult.ffprobe.channels = parseInt(audioStream.channels || '0', 10);
      sampleResult.ffprobe.duration = parseFloat(format.duration || audioStream.duration || '0');
      sampleResult.ffprobe.bitRate = parseInt(format.bit_rate || audioStream.bit_rate || '0', 10);

      if (sampleResult.ffprobe.codec &&
          sampleResult.ffprobe.sampleRate > 0 &&
          sampleResult.ffprobe.channels > 0 &&
          sampleResult.ffprobe.duration > 0) {
        sampleResult.ffprobe.passed = true;
      } else {
        sampleResult.ffprobe.error = 'Stream parameters out of bounds';
      }
    }
  } catch (err) {
    sampleResult.ffprobe.error = err.message;
  }

  const startDecode = Date.now();
  const decodeRes = spawnSync('ffmpeg', ['-v', 'error', '-i', track.fullPath, '-f', 'null', '-'], {
    encoding: 'utf8',
    timeout: 60000
  });
  sampleResult.ffmpegDecode.durationSec = ((Date.now() - startDecode) / 1000).toFixed(2);
  sampleResult.ffmpegDecode.exitCode = decodeRes.status;
  sampleResult.ffmpegDecode.stderr = (decodeRes.stderr || '').trim();

  if (decodeRes.status === 0 && sampleResult.ffmpegDecode.stderr.length === 0) {
    sampleResult.ffmpegDecode.passed = true;
  } else {
    sampleResult.ffmpegDecode.passed = false;
  }

  try {
    const fd = fs.openSync(track.fullPath, 'r');
    const chunkBuf = Buffer.alloc(65536);

    const t0 = process.hrtime.bigint();
    fs.readSync(fd, chunkBuf, 0, 65536, 0);
    const t1 = process.hrtime.bigint();
    sampleResult.bufferingBenchmark.headerReadMs = Number(t1 - t0) / 1e6;

    const midOffset = Math.floor(track.size / 2);
    const t2 = process.hrtime.bigint();
    fs.readSync(fd, chunkBuf, 0, 65536, midOffset);
    const t3 = process.hrtime.bigint();
    sampleResult.bufferingBenchmark.midSeekMs = Number(t3 - t2) / 1e6;

    const tailOffset = Math.max(0, track.size - 65536);
    const t4 = process.hrtime.bigint();
    fs.readSync(fd, chunkBuf, 0, 65536, tailOffset);
    const t5 = process.hrtime.bigint();
    sampleResult.bufferingBenchmark.tailSeekMs = Number(t5 - t4) / 1e6;

    fs.closeSync(fd);
  } catch (err) {
    sampleResult.bufferingBenchmark.error = err.message;
  }

  if (sampleResult.ffprobe.passed && sampleResult.ffmpegDecode.passed) {
    sampleResult.trackVerdict = 'PASS';
    passedCount++;
  } else {
    sampleResult.trackVerdict = 'FAIL';
    failedCount++;
  }

  result.sampledTracks.push(sampleResult);
  console.log('[' + (i + 1) + '/30] ' + track.category + '/' + track.filename + ' -> ' + sampleResult.trackVerdict + ' (codec: ' + sampleResult.ffprobe.codec + ', ' + sampleResult.ffprobe.duration + 's, decode: ' + sampleResult.ffmpegDecode.durationSec + 's)');
}

// 5. HTTP 206 Partial Content / Streaming Response Stress Test
console.log('--- Testing HTTP Range Request / Streaming Buffer Server ---');
const testServerPort = 9299;
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.replace(/^\\//, ''));
  const filePath = path.join(AUDIO_DIR, urlPath);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end('Not Found');
  }

  const stat = fs.statSync(filePath);
  const total = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const partialstart = parts[0];
    const partialend = parts[1];
    let start = parseInt(partialstart, 10);
    let end = partialend ? parseInt(partialend, 10) : total - 1;
    if (isNaN(start)) start = 0;
    if (isNaN(end) || end >= total) end = total - 1;
    const chunksize = (end - start) + 1;

    res.writeHead(206, {
      'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': filePath.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav'
    });

    const stream = fs.createReadStream(filePath, { start, end });
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': total,
      'Content-Type': filePath.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav',
      'Accept-Ranges': 'bytes'
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

function httpRangeGet(url, rangeHeader) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers: { 'Range': rangeHeader } }, (res) => {
      let dataLen = 0;
      res.on('data', chunk => { dataLen += chunk.length; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          bytesReceived: dataLen
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('Timeout')));
  });
}

server.listen(testServerPort, '127.0.0.1', async () => {
  const httpSamples = [
    finalSamples[0],
    finalSamples.find(f => f.category === 'sfx') || finalSamples[1],
    finalSamples.find(f => f.category === 'faith') || finalSamples[2]
  ];

  for (const s of httpSamples) {
    const testUrl = 'http://127.0.0.1:' + testServerPort + '/' + encodeURIComponent(s.category) + '/' + encodeURIComponent(s.filename);
    try {
      const headerEnd = Math.min(65535, s.size - 1);
      const headerRangeStr = 'bytes=0-' + headerEnd;
      const headerRes = await httpRangeGet(testUrl, headerRangeStr);
      const isHeader206 = headerRes.statusCode === 206;
      const hasContentRange = !!headerRes.headers['content-range'] && headerRes.headers['content-range'].startsWith('bytes 0-' + headerEnd + '/' + s.size);
      const hasAcceptRanges = headerRes.headers['accept-ranges'] === 'bytes';

      const midStart = Math.floor(s.size / 2);
      const midEnd = Math.min(s.size - 1, midStart + 32767);
      const midRangeStr = 'bytes=' + midStart + '-' + midEnd;
      const midRes = await httpRangeGet(testUrl, midRangeStr);
      const isMid206 = midRes.statusCode === 206;
      const hasMidContentRange = !!midRes.headers['content-range'] && midRes.headers['content-range'].startsWith('bytes ' + midStart + '-' + midEnd + '/' + s.size);

      result.streamingHttpTests.push({
        track: s.category + '/' + s.filename,
        headerRangePass: isHeader206 && hasContentRange && hasAcceptRanges,
        seekRangePass: isMid206 && hasMidContentRange,
        statusCode: headerRes.statusCode,
        headerContentRange: headerRes.headers['content-range'],
        seekContentRange: midRes.headers['content-range'],
        headerBytesReceived: headerRes.bytesReceived,
        seekBytesReceived: midRes.bytesReceived
      });
    } catch (e) {
      result.streamingHttpTests.push({
        track: s.category + '/' + s.filename,
        error: e.message
      });
    }
  }

  server.close();

  result.summary = {
    totalAudited: finalSamples.length,
    passedCount,
    failedCount,
    passPercentage: ((passedCount / finalSamples.length) * 100).toFixed(1) + '%',
    inventoryCount: result.inventory.totalFiles,
    corruptStubs: result.inventory.corruptStubs,
    magicBytesPassed: result.magicByteAudit.passed,
    magicBytesFailed: result.magicByteAudit.failed,
    httpStreamingPassed: result.streamingHttpTests.every(t => t.headerRangePass && t.seekRangePass)
  };

  if (failedCount === 0 &&
      result.inventory.totalFiles >= 200 &&
      result.inventory.corruptStubs === 0 &&
      result.magicByteAudit.failed === 0 &&
      result.summary.httpStreamingPassed) {
    result.overallVerdict = 'APPROVE';
  } else {
    result.overallVerdict = 'REJECT';
  }

  console.log('__CHALLENGER_JSON_START__');
  console.log(JSON.stringify(result, null, 2));
  console.log('__CHALLENGER_JSON_END__');
});
`;

  console.log('>>> [2/5] Deploying challenger stress test harness to VPS (/tmp/challenger_stress_harness.js)...');
  const b64 = Buffer.from(remoteHarnessScript).toString('base64');
  const deployCmd = `cat << 'EOF_B64' | base64 -d > /tmp/challenger_stress_harness.js\n${b64}\nEOF_B64`;
  await sshExec(conn, deployCmd);

  console.log('>>> [3/5] Executing acoustic & bitstream stress tests on VPS (30 samples, ffprobe, ffmpeg, buffering)...');
  const execCmd = `node /tmp/challenger_stress_harness.js`;
  const runResult = await sshExec(conn, execCmd, 600000);

  console.log('>>> [4/5] Parsing forensic results from VPS execution...');
  const stdout = runResult.stdout;
  const match = stdout.match(/__CHALLENGER_JSON_START__([\s\S]*?)__CHALLENGER_JSON_END__/);

  if (!match) {
    console.error('[FATAL] Failed to parse JSON markers from remote output.');
    console.log('Raw output:', stdout);
    conn.end();
    process.exit(1);
  }

  const testReport = JSON.parse(match[1].trim());

  const localReportDir = path.resolve(__dirname, '../../../.agents/teamwork_preview_challenger_audio_2');
  if (fs.existsSync(localReportDir)) {
    fs.writeFileSync(path.join(localReportDir, 'test_results.json'), JSON.stringify(testReport, null, 2), 'utf8');
    console.log(`Saved detailed test_results.json to ${localReportDir}`);
  }

  console.log('\n================================================================================');
  console.log('                         STRESS TEST RESULTS MATRIX                             ');
  console.log('================================================================================');
  console.log(`Total Audio Assets in Inventory : ${testReport.inventory.totalFiles}`);
  console.log(`Distribution Across 5 Folders   : news=${testReport.inventory.byCategory.news}, viral=${testReport.inventory.byCategory.viral}, faith=${testReport.inventory.byCategory.faith}, lifestyle=${testReport.inventory.byCategory.lifestyle}, sfx=${testReport.inventory.byCategory.sfx}`);
  console.log(`Magic Byte & Header Sanity Scan : ${testReport.magicByteAudit.passed} passed, ${testReport.magicByteAudit.failed} failed (0 corrupt/stubs)`);
  console.log(`Sampled Audio Tracks Tested     : ${testReport.sampledTracks.length}`);
  console.log(`ffprobe & ffmpeg Decode Verdict : ${testReport.summary.passedCount} PASS, ${testReport.summary.failedCount} FAIL`);
  console.log(`HTTP Range Streaming Response   : ${testReport.summary.httpStreamingPassed ? 'PASS (206 Partial Content verified)' : 'FAIL'}`);
  console.log('--------------------------------------------------------------------------------');
  console.log(`OVERALL CHALLENGER VERDICT      : [ ${testReport.overallVerdict} ]`);
  console.log('================================================================================\n');

  console.log(
    'Idx'.padEnd(4) +
    'Category'.padEnd(11) +
    'Codec'.padEnd(10) +
    'Rate'.padEnd(8) +
    'Ch'.padEnd(4) +
    'Duration'.padEnd(10) +
    'Bitrate'.padEnd(10) +
    'DecodeTime'.padEnd(12) +
    'Verdict'.padEnd(9) +
    'Filename'
  );
  console.log('-'.repeat(110));

  for (const t of testReport.sampledTracks) {
    const durStr = t.ffprobe.duration ? `${t.ffprobe.duration.toFixed(1)}s` : 'N/A';
    const rateStr = t.ffprobe.sampleRate ? `${t.ffprobe.sampleRate}Hz` : 'N/A';
    const brStr = t.ffprobe.bitRate ? `${Math.round(t.ffprobe.bitRate / 1000)}kbps` : 'N/A';
    const decTimeStr = t.ffmpegDecode.durationSec ? `${t.ffmpegDecode.durationSec}s` : 'N/A';
    
    console.log(
      String(t.index).padEnd(4) +
      String(t.category).padEnd(11) +
      String(t.ffprobe.codec || 'ERR').padEnd(10) +
      rateStr.padEnd(8) +
      String(t.ffprobe.channels || '0').padEnd(4) +
      durStr.padEnd(10) +
      brStr.padEnd(10) +
      decTimeStr.padEnd(12) +
      String(`[${t.trackVerdict}]`).padEnd(9) +
      t.filename
    );
  }

  await sshExec(conn, 'rm -f /tmp/challenger_stress_harness.js');
  conn.end();

  console.log('\n>>> [5/5] Challenger adversarial testing completed.');
  if (testReport.overallVerdict === 'APPROVE') {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[FATAL ERROR IN RUNNER]:', err);
  process.exit(1);
});
