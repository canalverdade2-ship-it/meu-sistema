import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
curl -s http://127.0.0.1:9228/json/list
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
