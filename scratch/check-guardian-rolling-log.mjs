import { runSshScript } from './ssh2-run.mjs';

const script = `
echo "Waiting 35 seconds for the timer to run the updated guardian..."
sleep 35
tail -n 10 /var/log/gsa-process-guardian.log
`;

const res = await runSshScript(script);
console.log(res.stdout);
