import { runSshScript } from './ssh2-run.mjs';

const script = `
sed -n '20,30p' /opt/gsa-tv/bin/gsa-process-guardian.sh
`;

const res = await runSshScript(script);
console.log(res.stdout);
