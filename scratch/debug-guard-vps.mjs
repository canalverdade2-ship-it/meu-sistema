import { runSshScript } from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
systemctl status gsa-rtmp-single-owner-guard.timer --no-pager || true
systemctl status gsa-rtmp-single-owner-guard.service --no-pager || true
journalctl -u gsa-rtmp-single-owner-guard.service --since '-10 minutes' --no-pager | tail -n 100
sudo /usr/local/sbin/gsa-rtmp-single-owner-guard || true
sudo python3 -m py_compile /usr/local/sbin/gsa-rtmp-single-owner-guard
`,120000); process.stdout.write(r.stdout); if(r.stderr)process.stderr.write(r.stderr);
