import { runSshScript } from './ssh2-run.mjs';
const script=`set -u
echo '=== acme tools ==='
for c in acme.sh lego dehydrated certbot; do command -v "$c" 2>/dev/null && echo "$c"; done
echo '=== files ==='
for name in acme.sh lego renewal.conf; do sudo find /root /home/opc /etc -maxdepth 4 -type f -name "$name" 2>/dev/null | head -30; done
sudo find /root /home/opc /etc -maxdepth 4 -type f -name '*nip.io*.conf' 2>/dev/null | head -30 || true
echo '=== timers/cron ==='
systemctl list-timers --all --no-pager 2>/dev/null | grep -Ei 'acme|cert|letsencrypt' || true
sudo crontab -l 2>/dev/null | grep -Ei 'acme|cert|letsencrypt' || true
crontab -l 2>/dev/null | grep -Ei 'acme|cert|letsencrypt' || true
`;
const r=await runSshScript(script,90000);process.stdout.write(r.stdout);process.stderr.write(r.stderr);
