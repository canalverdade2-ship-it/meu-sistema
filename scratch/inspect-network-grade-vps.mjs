import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -u
echo '=== PUBLIC PORT GUARD ==='
sudo systemctl cat gsa-tv-public-port-guard.service
sudo systemctl status gsa-tv-public-port-guard.service --no-pager -l || true
echo '=== NGINX UPSTREAMS ==='
sudo grep -RHE 'proxy_pass|upstream|listen ' /etc/nginx --include='*.conf' 2>/dev/null | sed -E 's#(https?://)[^ ;]+:[^@ ;]+@#\\1[REDACTED]@#g'
echo '=== CONTAINER NETWORKS ==='
sudo docker ps --format '{{.Names}}' | while read n; do printf '%s ' "$n"; sudo docker inspect "$n" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}={{$v.IPAddress}} {{end}}'; done
echo '=== GRADE / MEDIA COUNTS ==='
DB_URL=$(sudo awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}' /opt/gsa-tv/control-plane/.env)
psql "$DB_URL" -X -P pager=off -c "select schemaname,tablename from pg_tables where tablename like 'gsa_tv_%' order by 1,2;" || true
echo '=== PLAYLIST WARNINGS ==='
sudo docker logs --since 90m gsa-tv-ffplayout 2>&1 | grep -Ei 'warn|error|invalid|duration' | tail -n 120 || true
echo '=== TLS KEYS ==='
sudo find /etc/nginx /opt/gsa-tv -xdev -type f \\( -iname '*.key' -o -iname '*password*' -o -iname '*.env' \\) -printf '%m %u:%g %p\\n' 2>/dev/null | sort
echo '=== PUBLIC PROCESS COMMANDS ==='
for pid in 2119530 492698 171446 3125237 170428 2720815; do sudo ps -p "$pid" -o pid,user,args --no-headers || true; done
`, 180000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
