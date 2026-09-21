import { runSshScript } from './ssh2-run.mjs';

const cmd = String.raw`
sudo bash -c '
ENV_FILE="/opt/gsa-tv/control-plane/.env"
DB_URL=$(awk -F= '\''$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}'\'' "$ENV_FILE")
psql "$DB_URL" -c "SELECT id, title, drive_path, state FROM gsa_tv_media_items ORDER BY created_at ASC;"
'
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
