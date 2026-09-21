import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}'
curl -s http://127.0.0.1:9228/json/version || echo "CDP 9228 offline"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
