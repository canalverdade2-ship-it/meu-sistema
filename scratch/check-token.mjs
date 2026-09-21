import { runSshScript } from './ssh2-run.mjs';

const script = `
sudo cat /opt/gsa-tv/control-plane/.env
`;

const res = await runSshScript(script);
console.log(res.stdout);
