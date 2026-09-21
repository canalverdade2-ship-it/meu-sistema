import { runSshScript } from './ssh2-run.mjs';
const script=`set -u
echo '=== listeners/processes ==='
sudo ss -ltnp 2>/dev/null | grep -E ':(80|443|5678|5679|5680)\\b' || true
echo '=== proxy processes ==='
ps -eo pid,comm,args | grep -Ei 'nginx|caddy|apache|httpd|traefik' | grep -v grep || true
echo '=== nginx files ==='
sudo find /etc/nginx -maxdepth 3 -type f -print 2>/dev/null | sort | head -80 || true
echo '=== local n8n ==='
curl -sS -o /dev/null -w 'local5678=%{http_code}\n' http://127.0.0.1:5678/ || true
echo '=== host header via 443 ==='
curl -k -sS --resolve n8n.gsahub.com.br:443:127.0.0.1 -o /dev/null -w 'host443=%{http_code}\n' https://n8n.gsahub.com.br/ || true
`;
const r=await runSshScript(script,90000);process.stdout.write(r.stdout);process.stderr.write(r.stderr);
