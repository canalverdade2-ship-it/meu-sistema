import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo find /opt -name "Dockerfile*" 2>/dev/null
sudo find /opt/gsa-tv -name "*.yml" -o -name "*.yaml" 2>/dev/null
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
