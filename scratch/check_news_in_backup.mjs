import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sudo grep '/cache/media/1/news/' /opt/gsa-tv/backups/full/20260907T062245Z/media.sha256 | wc -l
sudo grep '/cache/media/1/news/' /opt/gsa-tv/backups/full/20260907T062245Z/media.sha256 | head -n 10
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
