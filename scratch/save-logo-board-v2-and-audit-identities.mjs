import fs from 'node:fs'; import {runSshScript} from './ssh2-run.mjs';
const p='C:/Users/Adriano Farias/.codex/generated_images/01a01128-ed98-7c82-b207-1afeb589b650/exec-681d5c4b-edea-4542-b862-f17035c1a5ed.png';const b64=fs.readFileSync(p).toString('base64');
const remote=String.raw`set -euo pipefail
OUT=/home/opc/gsa-ai/assets/brand/gsa-program-logos-board-32-candidate-2026-09-04.png
printf '%s' '${b64}'|base64 -d > "$OUT"
chmod 644 "$OUT"
echo '=== BOARD ==='; file "$OUT"; sha256sum "$OUT"
echo '=== IDENTITY VIDEO FILES ==='
find /opt/gsa-tv/cache/media/1/identity -maxdepth 3 -type f \( -iname '*.mp4' -o -iname '*.mov' \) -printf '%s|%p\n' | sort -t'|' -k2
echo '=== OPEN/CLOSE NAMED ==='
find /home/opc/gsa-ai /opt/gsa-tv -type f \( -iname '*abertura*.mp4' -o -iname '*fechamento*.mp4' -o -iname '*opening*.mp4' -o -iname '*closing*.mp4' \) -printf '%s|%p\n' 2>/dev/null | sort -t'|' -k2
`;
const r=await runSshScript(remote,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
