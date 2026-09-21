import {runSshScript} from './ssh2-run.mjs';
const remote=String.raw`find /home/opc/gsa-ai /opt/gsa-tv -type f \( -iname '*logo*' -o -iname '*brand*' -o -iname '*prancha*' -o -iname '*program*identity*' \) -printf '%T@|%s|%p\n' 2>/dev/null | sort -nr | head -n 250`;
const r=await runSshScript(remote,60000);process.stdout.write(r.stdout);
