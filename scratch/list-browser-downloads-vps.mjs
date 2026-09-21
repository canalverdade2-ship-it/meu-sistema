import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`docker exec gsa-ai-browser sh -lc "find / -path /proc -prune -o -path /sys -prune -o -type f -mmin -15 -print 2>/dev/null | tail -n 80"`,60000);process.stdout.write(r.stdout);
