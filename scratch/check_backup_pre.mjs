import { runSshScript } from './ssh2-run.mjs';

const cmd = String.raw`
sudo bash -c '
BASE=/opt/gsa-tv
KEY_FILE="/home/opc/.gsa_tv_secret_key"
ENV_FILE="$BASE/control-plane/.env"

echo "=== KEY FILE ==="
ls -la "$KEY_FILE"

echo "=== DOCKER FFPLAYOUT SQLITE ==="
docker exec gsa-tv-ffplayout sqlite3 /state/ffplayout.db "select count(*) from media;" || echo "Failed docker sqlite"

echo "=== DOCKER ALPINE TEST ==="
docker run --rm alpine:3.22 echo "alpine works" || echo "Failed alpine"

echo "=== DB CONNECTION & PERMISSIONS ==="
DB_URL=$(awk -F= '\''$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}'\'' "$ENV_FILE")
psql "$DB_URL" -c "create database gsa_tv_test_probe;"
psql "$DB_URL" -c "drop database gsa_tv_test_probe;"
echo "Database create/drop probe succeeded"
'
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
