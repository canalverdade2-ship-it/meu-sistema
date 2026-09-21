import fs from 'node:fs';
import { Client } from 'ssh2';
import { readInfraKey, runSshScript } from './ssh2-run.mjs';

const clientFile = 'infrastructure/gsa-tv/services/encoder-engine/encoder-client.js';
await new Promise((resolve, reject) => {
  const conn = new Client();
  conn.on('ready', () => conn.sftp((error, sftp) => {
    if (error) return reject(error);
    sftp.fastPut(clientFile, '/tmp/gsa-encoder-client.js', (err) => { conn.end(); err ? reject(err) : resolve(); });
  }));
  conn.on('error', reject);
  conn.connect({ host: '147.15.43.141', port: 22, username: 'opc', privateKey: readInfraKey(), readyTimeout: 15000 });
});

const script = String.raw`set -euo pipefail
work=/opt/gsa-tv/control-plane
src="$work/src/app.js"
stamp=$(date +%Y%m%d-%H%M%S)
sudo cp "$src" "$src.before-external-encoder-$stamp"
sudo install -d -o root -g root -m 0755 "$work/bin" /opt/gsa-tv/runtime
sudo install -o root -g root -m 0755 /tmp/gsa-encoder-client.js "$work/bin/encoder-client.js"
sudo python3 - <<'PY'
from pathlib import Path
import re
p=Path('/opt/gsa-tv/control-plane/src/app.js')
s=p.read_text()
marker='const QUALITY_PROFILES = {'
if marker not in s: raise SystemExit('quality profiles anchor not found')
s=s.replace(marker,'const ENCODER_ENGINE_URL = String(process.env.ENCODER_ENGINE_URL || "http://127.0.0.1:9210").replace(/\\/$/, "");\nconst ENCODER_ENGINE_TOKEN = String(process.env.ENCODER_ENGINE_TOKEN || "");\n'+marker,1)
s=s.replace('/tmp/gsa-tv-','/runtime/gsa-tv-')
if s.count('/runtime/gsa-tv-') < 2:
    raise SystemExit('shared runtime text paths not fully patched')
new='''async function acquireEncoderLock() { return true; }
async function releaseEncoderLock() { return true; }'''
start=s.find('async function acquireEncoderLock()')
end=s.find('async function graphicsRelayArgs',start)
if start<0 or end<0: raise SystemExit('encoder lock functions not found')
s=s[:start]+new+'\n\n'+s[end:]
marker='async function terminateRelay() {'
helper='''async function encoderEngineRequest(pathname, method = "GET") {
  if (!ENCODER_ENGINE_TOKEN || ENCODER_ENGINE_TOKEN.length < 32)
    throw new Error("Token do encoder externo não configurado.");
  const response = await fetch(ENCODER_ENGINE_URL + pathname, {
    method,
    headers: { authorization: "Bearer " + ENCODER_ENGINE_TOKEN },
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || ("Encoder engine HTTP " + response.status));
  return body;
}
'''
if marker not in s: raise SystemExit('terminate marker not found')
s=s.replace(marker,helper+marker,1)
needle='''  await terminateRelay();
  await releaseEncoderLock();
  try {
    await ffplayoutProcess("stop");'''
replacement='''  await terminateRelay();
  await encoderEngineRequest("/v1/stop", "POST");
  await releaseEncoderLock();
  try {
    await ffplayoutProcess("stop");'''
if needle not in s: raise SystemExit('stop stream block not found')
s=s.replace(needle,replacement,1)
spawn_old='const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });'
positions=[m.start() for m in re.finditer(re.escape(spawn_old),s)]
if len(positions)<2: raise SystemExit(f'expected recording and relay spawns, found {len(positions)}')
i=positions[-1]
spawn_new='const proc = spawn("/app/bin/encoder-client.js", args, { stdio: ["ignore", "ignore", "pipe"], env: { ...process.env, GSA_ENCODER_MODE: mode } });'
s=s[:i]+spawn_new+s[i+len(spawn_old):]
p.write_text(s)
PY
sudo python3 - <<'PY'
from pathlib import Path
p=Path('/opt/gsa-tv/control-plane/Dockerfile')
s=p.read_text()
needle='COPY src/ ./src/'
if 'COPY bin/ ./bin/' not in s:
    if needle not in s: raise SystemExit('Dockerfile copy anchor not found')
    s=s.replace(needle,needle+'\nCOPY bin/ ./bin/',1)
p.write_text(s)
PY
sudo docker build -t gsa-tv/control-plane:1.7.0 "$work"
sudo docker run --rm --entrypoint node gsa-tv/control-plane:1.7.0 --check /app/src/app.js
sudo docker run --rm --entrypoint node gsa-tv/control-plane:1.7.0 --check /app/bin/encoder-client.js
sudo docker image inspect gsa-tv/control-plane:1.7.0 --format 'image|{{.Id}}'
`;
const result = await runSshScript(script, 180000);
process.stdout.write(result.stdout); if (result.stderr) process.stderr.write(result.stderr);
