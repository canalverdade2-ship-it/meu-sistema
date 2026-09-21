import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`set -euo pipefail
for image in gsa-tv/control-plane:1.6.37 gsa-tv/control-plane:1.6.38; do
  echo "=== $image ==="
  for pattern in 'async function startStream' 'case "graphics_reload"' 'async function restoreRuntime' 'pg_advisory' 'zmq'; do
    echo "--- $pattern ---"
    sudo docker run --rm --entrypoint sh "$image" -c "grep -n -F '$pattern' /app/src/app.js 2>/dev/null || grep -n -F '$pattern' /app/app.js 2>/dev/null || true"
  done
done
echo '=== 1638 TARGETED SECTIONS ==='
sudo docker run --rm --entrypoint sh gsa-tv/control-plane:1.6.38 -c '
f=/app/src/app.js; [ -f "$f" ] || f=/app/app.js
sed -n "680,1080p" "$f"
sed -n "4080,4170p" "$f"
sed -n "4500,4565p" "$f"
' 
`;

const result = await runSshScript(script, 180000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
