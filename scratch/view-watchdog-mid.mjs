import { runSshScript } from './ssh2-run.mjs';

const script = `
sed -n '61,150p' /opt/gsa-tv/watchdog/src/app.js
`;

const res = await runSshScript(script);
console.log(res.stdout);
