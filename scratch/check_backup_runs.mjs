import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sudo -u postgres psql -d gsahub -c "SELECT id, backup_type, state, started_at, finished_at, size_bytes, sha256, details FROM gsa_tv_backup_runs ORDER BY started_at DESC LIMIT 5;"
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
