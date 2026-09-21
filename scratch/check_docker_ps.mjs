import { runSshScript } from './ssh2-run.mjs';

const cmd = `
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
docker exec gsa-tv-ffplayout sqlite3 /state/ffplayout.db "select count(*) from media;" 2>&1 || true
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
