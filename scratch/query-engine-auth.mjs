import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
curl -s http://127.0.0.1:9210/health
token=$(grep -E "^ENCODER_ENGINE_TOKEN=" /opt/gsa-tv/control-plane/.env | cut -d= -f2-)
echo ""
curl -s -H "authorization: Bearer $token" http://127.0.0.1:9210/status
echo ""
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
