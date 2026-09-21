import { runSshScript } from './ssh2-run.mjs';
const script=String.raw`set -euo pipefail
echo '=== v2 segments ==='
sudo find /tmp/gsa-tv-editorial/rendered-v2 -maxdepth 1 -type f -name 'segment-*.mp4' -printf '%f|%s|%y\n' 2>/dev/null | sort || true
echo '=== render processes ==='
ps -eo pid,etimes,cmd | grep -E '[f]fmpeg.*rendered-v2|[d]ocker run.*rendered-v2' | sed -E 's#(/work/[^ ]+)#<media>#g' || true
`;
const r=await runSshScript(script,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
