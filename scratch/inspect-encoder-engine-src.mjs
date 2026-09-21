import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
ls -la /opt/gsa-tv/encoder-engine/
ls -la /opt/gsa-tv/encoder-engine/src/
cat /opt/gsa-tv/encoder-engine/src/index.js 2>/dev/null || cat /opt/gsa-tv/encoder-engine/src/server.js 2>/dev/null || head -n 60 /opt/gsa-tv/encoder-engine/src/*
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
