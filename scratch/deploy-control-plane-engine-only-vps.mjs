import { runSshScript } from './ssh2-run.mjs';

const patchJs=String.raw`
const fs=require('fs');
const file=process.argv[2];
let s=fs.readFileSync(file,'utf8');
const oldHelper='async function encoderEngineRequest(pathname, method = "GET") {\n  if (!ENCODER_ENGINE_TOKEN || ENCODER_ENGINE_TOKEN.length < 32)\n    throw new Error("Token do encoder externo não configurado.");\n  const response = await fetch(ENCODER_ENGINE_URL + pathname, {\n    method,\n    headers: { authorization: "Bearer " + ENCODER_ENGINE_TOKEN },\n    signal: AbortSignal.timeout(10000),\n  });\n  const body = await response.json().catch(() => ({}));\n  if (!response.ok) throw new Error(body.error || ("Encoder engine HTTP " + response.status));\n  return body;\n}';
const newHelper='async function encoderEngineRequest(pathname, method = "GET", payload = null) {\n  if (!ENCODER_ENGINE_TOKEN || ENCODER_ENGINE_TOKEN.length < 32)\n    throw new Error("Token do encoder externo não configurado.");\n  const response = await fetch(ENCODER_ENGINE_URL + pathname, {\n    method,\n    headers: { authorization: "Bearer " + ENCODER_ENGINE_TOKEN, ...(payload ? { "content-type": "application/json" } : {}) },\n    body: payload ? JSON.stringify(payload) : undefined,\n    signal: AbortSignal.timeout(15000),\n  });\n  const body = await response.json().catch(() => ({}));\n  if (!response.ok) throw new Error(body.error || ("Encoder engine HTTP " + response.status));\n  return body;\n}';
if(!s.includes(oldHelper)) throw new Error('helper signature not found');
s=s.replace(oldHelper,newHelper);
const start='  const proc = spawn("/app/bin/encoder-client.js", args, { stdio: ["ignore", "ignore", "pipe"], env: { ...process.env, GSA_ENCODER_MODE: mode } });';
const i=s.indexOf(start); if(i<0) throw new Error('legacy spawn not found');
const end='  return streamState;\n}\nasync function serializeStreamTransition';
const j=s.indexOf(end,i); if(j<0) throw new Error('startStream end not found');
const replacement=[
'  const engineState = await encoderEngineRequest("/v1/ensure", "POST", { args, mode });',
'  streamProcess = null;',
'  streamState.actual = engineState.outer_running && engineState.producer_running ? "sending" : "recovering";',
'  streamState.last_error = engineState.last_error || null;',
'  await persistStreamState();',
'  log("info", "stream_ensured_by_encoder_engine", {',
'    mode,',
'    outer_pid: engineState.outer_pid || null,',
'    producer_pid: engineState.producer_pid || null,',
'    transport_restarted: Boolean(engineState.transport_restarted),',
'    producer_restarted: Boolean(engineState.producer_restarted),',
'  });',
].join('\n')+'\n';
s=s.slice(0,i)+replacement+s.slice(j);
if(s.includes('spawn("/app/bin/encoder-client.js"')) throw new Error('legacy spawn remains');
fs.writeFileSync(file,s);
console.log(JSON.stringify({patched:true,bytes:s.length}));
`;
const p64=Buffer.from(patchJs).toString('base64');
const remote=`set -euo pipefail
BUILD=/opt/gsa-tv/build/control-plane-1.7.3
sudo mkdir -p "$BUILD"
sudo docker cp gsa-tv-control-plane:/app/src/app.js "$BUILD/app.js"
echo '${p64}' | base64 -d | sudo tee "$BUILD/patch.js" >/dev/null
sudo node "$BUILD/patch.js" "$BUILD/app.js"
printf '%s\n' 'FROM gsa-tv/control-plane:1.7.2' 'COPY --chown=playout-api:playout-api app.js /app/src/app.js' | sudo tee "$BUILD/Dockerfile" >/dev/null
sudo docker build -t gsa-tv/control-plane:1.7.3 "$BUILD"
sudo docker run --rm gsa-tv/control-plane:1.7.3 node --check /app/src/app.js

OUTER_BEFORE=$(pgrep -f 'ffmpeg .*udp://127.0.0.1:12345.*rtmp' | head -n1)
sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | sudo tee /opt/gsa-tv/control-plane/runtime-1.7.3.env >/dev/null
sudo chmod 600 /opt/gsa-tv/control-plane/runtime-1.7.3.env
sudo docker stop -t 15 gsa-tv-control-plane
sudo docker rename gsa-tv-control-plane gsa-tv-control-plane-backup-1.7.2
sudo docker run -d --name gsa-tv-control-plane --restart unless-stopped --network host --user playout-api:playout-api --env-file /opt/gsa-tv/control-plane/runtime-1.7.3.env -v /opt/gsa-tv/runtime:/runtime:rw -v /opt/gsa-tv/control-plane/secrets/ffplayout-admin-password:/run/secrets/ffplayout-admin-password:ro -v /opt/gsa-tv/playlists:/playlists:rw -v /opt/gsa-tv/cache/media:/media:rw -v /opt/gsa-tv/fallback:/fallback:ro -v /opt/gsa-tv/preview:/preview:ro gsa-tv/control-plane:1.7.3

sleep 8
curl -fsS http://127.0.0.1:9202/status
echo
curl -fsS http://127.0.0.1:9210/health
echo
echo OUTER_BEFORE=$OUTER_BEFORE
echo '=== RTMP PUBLISHERS ==='
pgrep -af 'rtmp://a.rtmp.youtube.com/live2/' | sed -E 's#(live2/)[^ ]+#\\1REDACTED#g'
COUNT=$(pgrep -af 'rtmp://a.rtmp.youtube.com/live2/' | wc -l)
test "$COUNT" -eq 1
OUTER_AFTER=$(pgrep -f 'ffmpeg .*udp://127.0.0.1:12345.*rtmp' | head -n1)
test "$OUTER_BEFORE" = "$OUTER_AFTER"
echo OUTER_AFTER=$OUTER_AFTER
sudo docker logs --tail 30 gsa-tv-control-plane 2>&1
`;
const r=await runSshScript(remote,300000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
