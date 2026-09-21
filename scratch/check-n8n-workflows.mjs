import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec n8n n8n list:workflow || echo "n8n cli"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
