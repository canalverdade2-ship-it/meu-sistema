import {runSshScript} from './ssh2-run.mjs';
const sh=String.raw`set -euo pipefail
echo '=== SECRET FILE NAMES/MODES/SIZES ==='
find /home/opc/gsa-ai/secrets -maxdepth 1 -type f -printf '%m|%s|%f\n' 2>/dev/null | sort
echo '=== GOOGLE LOGIN HELPER CRYPTO LINES ==='
grep -nE 'createDecipher|scrypt|secret|enc\.json|readFileSync' /home/opc/gsa-ai/bin/google-session-login.js | sed -E 's/(password|api.?key).*/\1=[REDACTED]/Ig' || true
echo '=== FISH REFERENCES FILES ONLY ==='
grep -RIl 'sk-fish-' /home/opc/gsa-ai /opt/gsa-tv 2>/dev/null | head -100 || true
`;
const r=await runSshScript(sh,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
