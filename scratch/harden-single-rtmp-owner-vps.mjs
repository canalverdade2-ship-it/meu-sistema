import { runSshScript } from './ssh2-run.mjs';

const guard=`#!/usr/bin/env bash
set -euo pipefail
LOCK=/run/gsa-rtmp-owner-guard.lock
exec 9>"$LOCK"
flock -n 9 || exit 0
ENGINE_ID=$(docker inspect -f '{{.Id}}' gsa-tv-encoder-engine 2>/dev/null || true)
if [ -z "$ENGINE_ID" ]; then logger -p daemon.err -t gsa-rtmp-guard 'encoder engine container missing'; exit 1; fi
mapfile -t PIDS < <(pgrep -f 'ffmpeg .*rtmps?://a\\.rtmp\\.youtube\\.com/live2/' || true)
AUTHORIZED=0
for PID in "\${PIDS[@]}"; do
  [ -r "/proc/$PID/cgroup" ] || continue
  if grep -q "$ENGINE_ID" "/proc/$PID/cgroup"; then
    AUTHORIZED=$((AUTHORIZED+1))
    if [ "$AUTHORIZED" -gt 1 ]; then
      logger -p daemon.crit -t gsa-rtmp-guard "duplicate publisher inside encoder engine killed pid=$PID"
      kill -TERM "$PID" 2>/dev/null || true
    fi
  else
    CMD=$(tr '\\0' ' ' < "/proc/$PID/cmdline" | sed -E 's#(live2/)[^ ]+#\\1REDACTED#g' | cut -c1-500)
    logger -p daemon.crit -t gsa-rtmp-guard "unauthorized RTMP publisher killed pid=$PID cmd=$CMD"
    kill -TERM "$PID" 2>/dev/null || true
    sleep 1
    kill -KILL "$PID" 2>/dev/null || true
  fi
done
COUNT=$(pgrep -f 'ffmpeg .*rtmps?://a\\.rtmp\\.youtube\\.com/live2/' | wc -l || true)
if [ "$COUNT" -gt 1 ]; then logger -p daemon.crit -t gsa-rtmp-guard "invariant failed publishers=$COUNT"; exit 2; fi
exit 0
`;
const service=`[Unit]
Description=GSA TV single RTMP owner invariant guard
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/gsa-rtmp-single-owner-guard
`;
const timer=`[Unit]
Description=Run GSA TV RTMP ownership guard every 5 seconds

[Timer]
OnBootSec=5s
OnUnitActiveSec=5s
AccuracySec=1s
Unit=gsa-rtmp-single-owner-guard.service

[Install]
WantedBy=timers.target
`;
const g64=Buffer.from(guard).toString('base64'), s64=Buffer.from(service).toString('base64'), t64=Buffer.from(timer).toString('base64');
const r=await runSshScript(`set -euo pipefail
sudo docker update --restart=no gsa-tv-control-plane-backup-1.7.2 >/dev/null
BUILD=/opt/gsa-tv/build/control-plane-1.7.4
sudo mkdir -p "$BUILD"
printf '%s\n' 'FROM gsa-tv/control-plane:1.7.3' 'USER root' 'RUN rm -f /app/bin/encoder-client.js' 'USER playout-api:playout-api' | sudo tee "$BUILD/Dockerfile" >/dev/null
sudo docker build -t gsa-tv/control-plane:1.7.4 "$BUILD"
test "$(sudo docker run --rm --entrypoint sh gsa-tv/control-plane:1.7.4 -lc 'test ! -e /app/bin/encoder-client.js; echo $?')" = 0

echo '${g64}' | base64 -d | sudo tee /usr/local/sbin/gsa-rtmp-single-owner-guard >/dev/null
sudo chmod 0755 /usr/local/sbin/gsa-rtmp-single-owner-guard
echo '${s64}' | base64 -d | sudo tee /etc/systemd/system/gsa-rtmp-single-owner-guard.service >/dev/null
echo '${t64}' | base64 -d | sudo tee /etc/systemd/system/gsa-rtmp-single-owner-guard.timer >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now gsa-rtmp-single-owner-guard.timer

OUTER_BEFORE=$(pgrep -f 'ffmpeg .*udp://127.0.0.1:12345.*rtmp' | head -n1)
sudo docker stop -t 15 gsa-tv-control-plane >/dev/null
sudo docker rename gsa-tv-control-plane gsa-tv-control-plane-backup-1.7.3
sudo docker update --restart=no gsa-tv-control-plane-backup-1.7.3 >/dev/null
sudo docker run -d --name gsa-tv-control-plane --restart unless-stopped --network host --user playout-api:playout-api --env-file /opt/gsa-tv/control-plane/runtime-1.7.3.env -v /opt/gsa-tv/runtime:/runtime:rw -v /opt/gsa-tv/control-plane/secrets/ffplayout-admin-password:/run/secrets/ffplayout-admin-password:ro -v /opt/gsa-tv/playlists:/playlists:rw -v /opt/gsa-tv/cache/media:/media:rw -v /opt/gsa-tv/fallback:/fallback:ro -v /opt/gsa-tv/preview:/preview:ro gsa-tv/control-plane:1.7.4 >/dev/null
sleep 8
sudo systemctl start gsa-rtmp-single-owner-guard.service
OUTER_AFTER=$(pgrep -f 'ffmpeg .*udp://127.0.0.1:12345.*rtmp' | head -n1)
COUNT=$( { pgrep -af 'rtmp://a.rtmp.youtube.com/live2/' || true; } | wc -l )
LEGACY=$( { pgrep -af 'encoder-client.js' || true; } | wc -l )
test "$OUTER_BEFORE" = "$OUTER_AFTER"
test "$COUNT" -eq 1
test "$LEGACY" -eq 0
echo "OUTER_BEFORE=$OUTER_BEFORE OUTER_AFTER=$OUTER_AFTER COUNT=$COUNT LEGACY=$LEGACY"
systemctl is-enabled gsa-rtmp-single-owner-guard.timer
systemctl is-active gsa-rtmp-single-owner-guard.timer
sudo docker ps -a --format '{{.Names}}|{{.Image}}|{{.Status}}' | grep -E 'control-plane|encoder-engine'
`,300000);
process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
