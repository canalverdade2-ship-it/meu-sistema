import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(String.raw`
set -eu
find /home/opc/gsa-ai -type f \( -iname '*hora*palavra*' -o -iname '*salomao*' -o -iname '*avatar*' \) -printf '%TY-%Tm-%Td %TH:%TM %s %p\n' 2>/dev/null | sort -r | sed -n '1,240p'
`);
process.stdout.write(r.stdout); process.stderr.write(r.stderr);
