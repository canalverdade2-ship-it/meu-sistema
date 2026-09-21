import { runSshScript } from './ssh2-run.mjs';
const remote=String.raw`echo STATUS
sudo systemctl status gsa-tv-n8n-network.service --no-pager -l 2>&1 || true
echo JOURNAL
sudo journalctl -u gsa-tv-n8n-network.service -n 40 --no-pager 2>&1 || true
echo UNIT
sudo systemctl cat gsa-tv-n8n-network.service 2>&1 || true
`;
const r=await runSshScript(remote,30000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
