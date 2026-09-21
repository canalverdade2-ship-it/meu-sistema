import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -u
echo '=== BACKUP SCRIPT ==='
sudo sed -n '1,280p' /opt/gsa-tv/backup/gsa-tv-backup-full.sh
echo '=== BACKUP RUNS ==='
sudo find /opt/gsa-tv/backup -maxdepth 2 -type f -printf '%TY-%Tm-%Td %TH:%TM %m %s %p\\n' | sort | tail -n 80
echo '=== COMPOSE FILES ==='
for f in /opt/gsa-tv/*/compose.yml; do echo "--- $f"; sudo sed -E 's#(RTMP[^:]*:).*#\\1 [REDACTED]#I; s#(PASSWORD[^:]*:).*#\\1 [REDACTED]#I; s#(TOKEN[^:]*:).*#\\1 [REDACTED]#I' "$f"; done
echo '=== LISTENERS ==='
sudo ss -lntup
echo '=== FIREWALL ==='
sudo firewall-cmd --list-all 2>/dev/null || sudo nft list ruleset 2>/dev/null | head -n 240 || true
echo '=== PERMISSIONS ==='
sudo stat -c '%a %U:%G %n' /opt/gsa-tv/control-plane/secrets/* /opt/gsa-tv/tls/* 2>/dev/null || true
echo 'world writable files:'; sudo find /opt/gsa-tv/media -xdev -type f -perm -0002 | wc -l
echo 'world writable dirs:'; sudo find /opt/gsa-tv/media -xdev -type d -perm -0002 | wc -l
echo '=== SYSTEMD TIMERS/SERVICES ==='
sudo systemctl list-timers --all --no-pager | grep -Ei 'gsa|backup|watch' || true
sudo systemctl list-unit-files --no-pager | grep -Ei 'gsa|docker' || true
echo '=== CURRENT STATUS ==='
curl -fsS http://127.0.0.1:9210/health; echo
sudo docker ps --format '{{.Names}} {{.Image}} {{.Status}} {{.Ports}}' | sort
`, 180000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
