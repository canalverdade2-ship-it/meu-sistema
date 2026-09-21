import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -e
ls -ld /data /data/downloads /data/downloads/identity-logos-20260907 2>&1 || true
find /data/downloads/identity-logos-20260907 -maxdepth 1 -type f -printf '%f %s\n' 2>&1 | sort || true
find /home/opc/gsa-ai/data/downloads/identity-logos-20260907 -maxdepth 1 -type f -printf '%f %s\n' 2>&1 | sort || true
find /home/opc/gsa-ai -type d -name '*identity*logo*' -o -type f -name 'gsa-tech.png' 2>/dev/null | head -n 50
`,30000);process.stdout.write(r.stdout||'');
