import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(`set -u
echo '=== BACKUP PROCESSES ==='
ps -eo pid,etimes,pcpu,pmem,args | grep -E 'gsa-tv-backup-full|pg_dump|pg_restore|gsa_tv_restore' | grep -v grep || true
echo '=== BACKUP DB RUNS ==='
DB_URL=$(sudo awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}' /opt/gsa-tv/control-plane/.env)
psql "$DB_URL" -X -P pager=off -c "select id,state,started_at,finished_at,archive_path,details from public.gsa_tv_backup_runs order by started_at desc limit 8"
echo '=== BACKUP DIR ==='
sudo du -sh /opt/gsa-tv/backups/full/* /opt/gsa-tv/backups/full/.[!.]* 2>/dev/null | tail -n 20 || true
echo '=== SERVICE HEALTH ==='
curl -fsS http://127.0.0.1:9210/health; echo
curl -fsS http://127.0.0.1:9202/health; echo
curl -fsS http://127.0.0.1:9204/health; echo
echo '=== PUBLISHER PROCESSES ==='
sudo ps -eo pid,ppid,etimes,args | grep -E '[f]fmpeg.*(rtmp|RTMP)' | sed -E 's#(rtmps?://)[^ ]+#\\1[REDACTED]#g'
echo '=== FIREWALL/PERMS ==='
sudo firewall-cmd --list-ports
sudo stat -c '%a %n' /etc/nginx/ssl/*.key /opt/gsa-tv/control-plane/secrets/ffplayout-admin-password /opt/gsa-tv/watchdog/secrets/ffplayout-admin-password
echo '=== CONTAINERS ==='
sudo docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}' | grep gsa-tv
`, 180000);
process.stdout.write(result.stdout); if(result.stderr) process.stderr.write(result.stderr);
