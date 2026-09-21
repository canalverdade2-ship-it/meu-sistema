import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`docker ps --format '{{.Names}}' | sort
echo '--- media ---'
docker exec gsa-ai-browser sh -lc "command -v ffprobe || true"
`,60000);process.stdout.write(r.stdout);
