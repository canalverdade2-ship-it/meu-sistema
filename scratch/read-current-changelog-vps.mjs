import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -u
echo '=== metadata ==='
stat -c '%a %U:%G %s %y %n' /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
echo '=== headings ==='
grep -n '^## ' /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md | tail -n 50
echo '=== canonical top ==='
sed -n '1,190p' /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
echo '=== latest content ==='
tail -n 260 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
`,60000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
