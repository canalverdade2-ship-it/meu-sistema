import { runSshScript } from './ssh2-run.mjs';

const cmd = String.raw`
sudo bash -c '
ENV_FILE="/opt/gsa-tv/control-plane/.env"
DB_URL=$(awk -F= '\''$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}'\'' "$ENV_FILE")
echo "Host info from DB_URL:"
echo "$DB_URL" | sed -E "s/:[^@]+@/:***@/"
psql "$DB_URL" -c "SELECT id, backup_type, state, started_at, finished_at, size_bytes, sha256 FROM gsa_tv_backup_runs ORDER BY started_at DESC LIMIT 5;"
'
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
