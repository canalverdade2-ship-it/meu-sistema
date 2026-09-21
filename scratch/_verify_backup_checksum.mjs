import { runSshScript } from './ssh2-run.mjs';
const script = `sudo bash -lc 'cd /opt/gsa-tv/backups/full/20260901T024221Z && sha256sum -c manifest.sha256'
sudo du -sh /opt/gsa-tv/backups/full/20260901T024221Z
`;
const r = await runSshScript(script, 30000);
process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
