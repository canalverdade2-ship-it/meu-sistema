import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript("docker exec n8n n8n import:workflow --help | sed -n '1,120p'",60000);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);
