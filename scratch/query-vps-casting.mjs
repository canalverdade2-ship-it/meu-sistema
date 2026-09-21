import { runSshScript } from './ssh2-run.mjs';
const r = await runSshScript(`set -e
f=/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
sed -n '1000,1035p' "$f"
printf '\n--- CURRENT SNAPSHOT ---\n'
sed -n '1,90p' "$f"
`, 30000);
process.stdout.write(r.stdout || '');
