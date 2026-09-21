import { runSshScript } from './ssh2-run.mjs';
const r = await runSshScript(`set -e
f=/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
stat -c '%y %s %n' "$f"
tail -n 120 "$f"
`, 30000);
process.stdout.write(r.stdout || '');
