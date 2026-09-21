import path from 'node:path';
import { Client } from 'ssh2';
import { readInfraKey, runSshScript } from './ssh2-run.mjs';

const uploads = [
  ['infrastructure/gsa-tv/services/encoder-engine/compose.production.yml','/tmp/gsa-encoder-compose.yml'],
  ['infrastructure/gsa-tv/services/playout-api/compose.production.yml','/tmp/gsa-control-plane-170-compose.yml'],
];
await new Promise((resolve, reject) => {
  const conn = new Client();
  conn.on('ready', () => conn.sftp((error, sftp) => {
    if (error) return reject(error);
    let pending=uploads.length;
    for (const [local,remote] of uploads) sftp.fastPut(path.resolve(local),remote,(err)=>{
      if (err) { conn.end(); reject(err); return; }
      if (--pending===0) { conn.end(); resolve(); }
    });
  }));
  conn.on('error',reject);
  conn.connect({ host:'147.15.43.141',port:22,username:'opc',privateKey:readInfraKey(),readyTimeout:15000 });
});

const script=String.raw`set -euo pipefail
cpdir=/opt/gsa-tv/control-plane
engdir=/opt/gsa-tv/encoder-engine
stamp=$(date +%Y%m%d-%H%M%S)
sudo install -d -o root -g root -m 0755 "$engdir" /opt/gsa-tv/runtime
sudo chown 989:989 /opt/gsa-tv/runtime
sudo cp "$cpdir/compose.yml" "$cpdir/compose.yml.before-1.7.0-$stamp"
sudo cp "$cpdir/.env" "$cpdir/.env.before-1.7.0-$stamp"
sudo install -o root -g root -m 0644 /tmp/gsa-encoder-compose.yml "$engdir/compose.yml"
sudo install -o root -g root -m 0644 /tmp/gsa-control-plane-170-compose.yml "$cpdir/compose.yml"
token=$(sudo awk -F= '$1=="ENCODER_ENGINE_TOKEN"{print substr($0,index($0,"=")+1);exit}' "$cpdir/.env")
if [ -z "$token" ]; then
  token=$(openssl rand -hex 32)
  printf '\nENCODER_ENGINE_TOKEN=%s\nENCODER_ENGINE_URL=http://127.0.0.1:9210\n' "$token" | sudo tee -a "$cpdir/.env" >/dev/null
fi
test "$(printf '%s' "$token" | wc -c)" -ge 32
dburl=$(sudo awk -F= '$1=="DATABASE_URL"{print substr($0,index($0,"=")+1);exit}' "$cpdir/.env")
before=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -F '|' -c "select desired_state,playout_state,signal_state from public.gsa_tv_channels where id='ch-main'")
echo "before|$before"

rollback(){
  echo 'ROLLBACK|starting' >&2
  sudo docker compose -p control-plane --project-directory "$cpdir" -f "$cpdir/compose.yml" down --remove-orphans >&2 || true
  curl -fsS -H "Authorization: Bearer $token" -X POST http://127.0.0.1:9210/v1/stop >/dev/null 2>&1 || true
  sudo docker compose -p encoder-engine --project-directory "$engdir" -f "$engdir/compose.yml" down --remove-orphans >&2 || true
  sudo cp "$cpdir/compose.yml.before-1.7.0-$stamp" "$cpdir/compose.yml"
  sudo docker compose -p control-plane --project-directory "$cpdir" -f "$cpdir/compose.yml" up -d >&2 || true
}
trap 'rc=$?; if [ "$rc" -ne 0 ]; then rollback; fi; exit "$rc"' EXIT

sudo docker compose -p encoder-engine --project-directory "$engdir" -f "$engdir/compose.yml" up -d
for i in $(seq 1 30); do curl -fsS http://127.0.0.1:9210/health >/dev/null 2>&1 && break; sleep 1; done
curl -fsS http://127.0.0.1:9210/health >/dev/null

sudo docker compose -p control-plane --project-directory "$cpdir" -f "$cpdir/compose.yml" down --remove-orphans
sudo docker compose -p control-plane --project-directory "$cpdir" -f "$cpdir/compose.yml" up -d
for i in $(seq 1 75); do
  health=$(sudo docker inspect gsa-tv-control-plane --format '{{.State.Health.Status}}' 2>/dev/null || true)
  engine=$(curl -fsS -H "Authorization: Bearer $token" http://127.0.0.1:9210/v1/status 2>/dev/null || true)
  if [ "$health" = healthy ] && printf '%s' "$engine" | grep -q '"outer_running":true' && printf '%s' "$engine" | grep -q '"producer_running":true'; then break; fi
  sleep 1
done
test "$(sudo docker inspect gsa-tv-control-plane --format '{{.State.Health.Status}}')" = healthy
status=$(curl -fsS -H "Authorization: Bearer $token" http://127.0.0.1:9210/v1/status)
printf '%s' "$status" | grep -q '"outer_running":true'
printf '%s' "$status" | grep -q '"producer_running":true'
outer_pid=$(printf '%s' "$status" | python3 -c 'import json,sys;print(json.load(sys.stdin)["outer_pid"])')
producer_pid=$(printf '%s' "$status" | python3 -c 'import json,sys;print(json.load(sys.stdin)["producer_pid"])')
echo "engine_pids|outer=$outer_pid|producer=$producer_pid"
row=$(sudo docker run --rm --network host postgres:15-alpine psql "$dburl" -X -qAt -F '|' -c "select desired_state,playout_state,signal_state,coalesce(last_error,'') from public.gsa_tv_channels where id='ch-main'")
echo "channel|$row"
case "$row" in running'|'*'|'sending'|') ;; *) exit 1;; esac
echo "migration|activated"
trap - EXIT
`;

const result=await runSshScript(script,300000);
process.stdout.write(result.stdout); if(result.stderr) process.stderr.write(result.stderr);
