import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
echo '=== webhook-columns ==='
docker exec evo-postgres psql -U evo -d n8n -X -At -F '|' -c "select column_name from information_schema.columns where table_name='webhook_entity' order by ordinal_position;" || true
echo '=== webhook-count ==='
docker exec evo-postgres psql -U evo -d n8n -X -At -c "select count(*) from webhook_entity;" || true
echo '=== recent-errors ==='
docker logs --since 15m n8n 2>&1 | grep -Ei 'error|fatal|failed' | tail -20 || true
echo '=== firewall-before ==='
sudo firewall-cmd --query-port=5679/tcp || true
if sudo firewall-cmd --query-port=5679/tcp >/dev/null 2>&1; then sudo firewall-cmd --permanent --remove-port=5679/tcp >/dev/null; sudo firewall-cmd --reload >/dev/null; fi
echo -n 'firewall_5679='; sudo firewall-cmd --query-port=5679/tcp || true
echo '=== old-container ==='
old=$(docker ps -a --format '{{.Names}}' | grep '^n8n-pre-hardening-' | head -1 || true)
if [ -n "$old" ]; then docker rm "$old" >/dev/null; echo "removed=$old"; else echo 'removed=none'; fi
echo '=== final-listeners ==='
sudo ss -ltnp | grep -E ':(443|5678|5679|5680)[[:space:]]' || true
`);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);