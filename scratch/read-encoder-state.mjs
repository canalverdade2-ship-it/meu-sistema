import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
cat /opt/gsa-tv/runtime/encoder-state.json 2>/dev/null || echo "Sem encoder-state.json"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
