import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo grep -rn "Access-Control-Allow-Methods" /etc/nginx/
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
