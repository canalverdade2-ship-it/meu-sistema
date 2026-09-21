import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sudo du -sh /opt/gsa-tv/*
sudo du -sh /opt/gsa-tv/backups/* 2>/dev/null || true
sudo du -sh /opt/gsa-tv/backups/full/* 2>/dev/null || true
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
