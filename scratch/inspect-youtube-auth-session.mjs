import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`set -eu
sudo docker exec gsa-ai-browser sh -lc 'command -v node; find / -type d -name puppeteer 2>/dev/null | head -10'
printf '\n--- CDP TABS ---\n'
curl -s http://127.0.0.1:9228/json/list | head -c 20000
`,90000);
process.stdout.write(result.stdout||''); process.stderr.write(result.stderr||'');
