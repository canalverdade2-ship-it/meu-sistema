import { runSshScript } from './ssh2-run.mjs';

const script = `
ls -la /opt/gsa-tv/logs/
tail -n 25 /opt/gsa-tv/logs/ffplayout.log 2>/dev/null || true
`;

const res = await runSshScript(script);
console.log(res.stdout);
