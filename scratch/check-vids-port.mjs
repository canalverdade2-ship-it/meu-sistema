import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
head -n 45 /home/opc/gsa-ai/check_vids_flow_02sep.js
echo "--- check browser connection ---"
curl -s http://127.0.0.1:9228/json/version || echo "Port 9228 not responding"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
