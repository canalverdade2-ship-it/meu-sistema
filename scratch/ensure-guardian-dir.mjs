import { runSshScript } from './ssh2-run.mjs';

const script = `
sudo mkdir -p /opt/gsa-tv/bin
sudo touch /var/log/gsa-process-guardian.log
sudo chmod 644 /var/log/gsa-process-guardian.log
ls -la /opt/gsa-tv/bin
ls -la /var/log/gsa-process-guardian.log
`;

const res = await runSshScript(script);
console.log(res.stdout);
