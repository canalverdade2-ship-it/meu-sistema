import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(String.raw`set -euo pipefail
file=/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
test -f "$file"
wc -l -c "$file"
sed -n '260,520p' "$file"
`, 120000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
