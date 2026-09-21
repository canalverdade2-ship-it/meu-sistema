import { runSshScript } from './ssh2-run.mjs';

const cmd = String.raw`
sudo bash -c '
ENV_FILE="/opt/gsa-tv/control-plane/.env"
DB_URL=$(awk -F= '\''$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}'\'' "$ENV_FILE")
psql "$DB_URL" -c "SELECT id, state, started_at, finished_at, details FROM gsa_tv_backup_runs ORDER BY started_at DESC LIMIT 3;"
'
echo "=== JOURNALCTL FOR GSA-TV-BACKUP ==="
sudo journalctl -u gsa-tv-backup.service -n 50 --no-pager
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
