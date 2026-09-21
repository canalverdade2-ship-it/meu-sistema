import { runSshScript } from './ssh2-run.mjs';
const script=`set -u
echo '=== opc history ==='
grep -h 'acme\.sh.*api\.147-15-43-141\.nip\.io' /home/opc/.bash_history 2>/dev/null | tail -10 || true
echo '=== root history ==='
sudo grep -h 'acme\.sh.*api\.147-15-43-141\.nip\.io' /root/.bash_history 2>/dev/null | tail -10 || true
`;
const r=await runSshScript(script,60000);process.stdout.write(r.stdout);process.stderr.write(r.stderr);
