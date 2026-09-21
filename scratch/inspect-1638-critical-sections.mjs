import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`set -euo pipefail
sudo docker run --rm --entrypoint sh gsa-tv/control-plane:1.6.38 -c '
f=/app/src/app.js; [ -f "$f" ] || f=/app/app.js
sed -n "620,735p" "$f"
echo GRAPHICS
sed -n "4265,4310p" "$f"
echo RESTORE
sed -n "4660,4715p" "$f"
echo STARTUP
tail -n 55 "$f"
'`;

const result = await runSshScript(script, 120000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
