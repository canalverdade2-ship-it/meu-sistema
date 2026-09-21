import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -e
targets="3985077 3985120"
echo '=== BEFORE ==='
for pid in $targets; do
  if sudo test -r /proc/$pid/cmdline; then
    printf '%s ' "$pid"
    sudo tr '\\0' ' ' < /proc/$pid/cmdline | head -c 300
    echo
  fi
done
for pid in $targets; do
  if sudo test -r /proc/$pid/cmdline && sudo tr '\\0' ' ' < /proc/$pid/cmdline | grep -qE 'f32le|gsa-news-2026-09-01-broadcast-v4-final'; then
    sudo kill -TERM "$pid" 2>/dev/null || true
  fi
done
sleep 2
for pid in $targets; do
  if sudo kill -0 "$pid" 2>/dev/null; then
    sudo kill -KILL "$pid" 2>/dev/null || true
  fi
done
echo '=== AFTER ==='
sudo ps -eo pid,ppid,etimes,%cpu,args | grep -E '[f]fmpeg|[f]fplayout' | sed -E 's#rtmps?://[^ ]+#rtmp://[PROTECTED]#g' | head -n 20
echo '=== LOAD ==='
uptime
`, 30000);

process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
