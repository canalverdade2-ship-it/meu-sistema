import { runSshScript } from './ssh2-run.mjs';

const script = `
head -n 60 /opt/gsa-tv/watchdog/src/app.js
`;

const res = await runSshScript(script);
console.log(res.stdout);
