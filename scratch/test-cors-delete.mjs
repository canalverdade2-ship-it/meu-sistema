import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
curl -i -X OPTIONS https://api.147-15-43-141.nip.io/gsa-tv/media/test \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: DELETE"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
