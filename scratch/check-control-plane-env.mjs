import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
grep -i "encoder" /opt/gsa-tv/control-plane/.env || echo "Sem ENCODER no .env"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
