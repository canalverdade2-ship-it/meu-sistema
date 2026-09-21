import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
# Check if media-preview endpoint serves the file
curl -I -s "http://127.0.0.1:8080/media-preview/media-gsa-ta-na-rede-2026-09-02-final" 2>/dev/null || true
`;
  const res = await runSshScript(script);
  console.log('Result:\n', res.stdout);
}

main().catch(console.error);
