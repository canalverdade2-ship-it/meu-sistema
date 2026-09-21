import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sudo ls -lah /opt/gsa-tv/backups/full/
sudo du -sh /opt/gsa-tv/backups/full/*
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
if (res.stderr) console.error("STDERR:", res.stderr);
