import { runSshScript } from './ssh2-run.mjs';
const remote=String.raw`printf '%s\n' '=== staging ==='
find /tmp/gsa-tv-n8n-automation -maxdepth 2 -type f -printf '%P|%s\n' 2>/dev/null | sort || true
printf '%s\n' '=== installed ==='
find /opt/gsa-tv/n8n -maxdepth 3 -type f -printf '%P|%s\n' 2>/dev/null | sort || true
printf '%s\n' '=== bridge-dir ==='
find /opt/gsa-tv/n8n-bridge -maxdepth 1 -type f -printf '%f|%s|%m\n' 2>/dev/null | sort || true
`;
const r=await runSshScript(remote,30000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
