import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -u
APP=/opt/gsa-tv/control-plane/src/app.js
echo '=== legacy process ownership assumptions ==='
grep -nE 'streamProcess|streamPid|process\.kill|pgrep|pkill|encoder-client|acquireEncoderLock|releaseEncoderLock|ENCODER_ENGINE' "$APP" | head -n 400
echo '=== state transitions and forced restarts ==='
grep -nE 'startStream\(|stopStream\(|startStreamUnlocked|stopStreamUnlocked|restoreRuntime|stream_start|stream_stop|stream_pause|stream_resume|graphics_reload|live_take|live_return|media_take|emergency_take' "$APP" | head -n 500
echo '=== engine calls ==='
grep -n 'encoderEngineRequest' "$APP"
echo '=== graphics/zmq assumptions ==='
grep -nE 'GRAPHICS_ZMQ|sendGraphicsCommands|applyGraphicsRuntime|graphics_sync|5577' "$APP"
echo '=== UDP leftovers in active configs and executable source ==='
sudo find /opt/gsa-tv -type f -not -path '*/audit-archive/*' -not -path '*/cache/*' -not -path '*/node_modules/*' -print0 2>/dev/null | sudo xargs -0 grep -nE 'udp://127\.0\.0\.1:12345|ENCODER_UDP_PORT|control-plane:1\.[0-6]' 2>/dev/null | head -n 300 || true
echo '=== watchdog behavior ==='
sudo docker exec gsa-tv-watchdog sh -lc "grep -nEi 'control|encoder|restart|stream|health|hls|ffplayout' /app/src/app.js | head -n 300"
echo '=== compose active ==='
for f in /opt/gsa-tv/control-plane/compose.yml /opt/gsa-tv/encoder-engine/compose.yml /opt/gsa-tv/watchdog/compose.yml; do echo ---$f; sudo sed -n '1,220p' "$f"; done
echo '=== jobs currently failing/retrying ==='
DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo "select action,state,count(*) from public.gsa_tv_automation_jobs where created_at>now()-interval '48 hours' group by action,state order by action,state;" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL" 2>/dev/null || true
echo '=== recent CP migration errors ==='
sudo docker logs --since 12h gsa-tv-control-plane 2>&1 | grep -Ei 'error|failed|unavailable|encoder_not_running|zmq|restore|restart' | tail -n 300 || true
echo '=== recent engine errors ==='
sudo docker logs --since 12h gsa-tv-encoder-engine 2>&1 | grep -Ei 'error|failed|exit|restart|fallback|lock' | tail -n 300 || true
`,240000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
