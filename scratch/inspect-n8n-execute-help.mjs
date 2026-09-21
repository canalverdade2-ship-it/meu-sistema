import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript("sudo docker exec n8n n8n execute --help",30000);
process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
