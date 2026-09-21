import { runSshScript } from './ssh2-run.mjs';

const script = `
curl -s -H "Authorization: Bearer 222d718911511702a4c813c427fdbab3e70c908d39f5c550c9594f8d3938cd9e" http://127.0.0.1:9210/v1/status | jq .
`;

const res = await runSshScript(script);
console.log(res.stdout);
