import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -u
APP=/opt/gsa-tv/control-plane/src/app.js
grep -nE '^async function (restoreRuntime|heartbeat|serviceHealth|processJobs|processAutomation|executeAutomation)|streamState\.actual|process_pid|outer_running|producer_running' "$APP" | head -n 300
LINE=$(grep -n '^async function restoreRuntime' "$APP" | cut -d: -f1 | head -n1); [ -n "$LINE" ] && sed -n "$((LINE-10)),$((LINE+130))p" "$APP"
LINE=$(grep -n '^async function heartbeat' "$APP" | cut -d: -f1 | head -n1); [ -n "$LINE" ] && sed -n "$((LINE-10)),$((LINE+130))p" "$APP"
`,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
