import { runSshScript } from './ssh2-run.mjs';
const script=`set -u
echo '=== 5680 process ==='
pid=$(sudo ss -ltnp 2>/dev/null | awk '/:5680 /{match($0,/pid=([0-9]+)/,m); if(m[1]) print m[1]; exit}')
if [ -n "$pid" ]; then sudo tr '\0' ' ' < /proc/$pid/cmdline; echo; sudo readlink -f /proc/$pid/cwd; fi
echo '=== nginx servers ==='
sudo nginx -T 2>/dev/null | grep -E 'server_name|listen |proxy_pass|ssl_certificate' | head -160 || true
echo '=== nginx config excerpt ==='
sudo sed -n '1,260p' /etc/nginx/nginx.conf 2>/dev/null || true
`;
const r=await runSshScript(script,90000);process.stdout.write(r.stdout);process.stderr.write(r.stderr);
