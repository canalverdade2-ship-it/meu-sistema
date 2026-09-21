import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
