import {runSshScript} from './ssh2-run.mjs';
const sh=String.raw`set -euo pipefail
echo '=== HOLT/NYLA REFERENCES ==='
grep -RInE 'Holt|Nyla|holt|nyla' /home/opc/gsa-ai /opt/gsa-tv/ai-worker /opt/gsa-tv/control-plane 2>/dev/null | head -120 | sed -E 's/sk-fish-[A-Za-z0-9_-]+/[REDACTED]/g' || true
echo '=== VOICE CONFIG FILES ==='
find /home/opc/gsa-ai /opt/gsa-tv -maxdepth 4 -type f \( -iname '*voice*' -o -iname '*cast*' -o -iname '*anchor*' \) -printf '%p\n' 2>/dev/null | head -100
`;
const r=await runSshScript(sh,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
