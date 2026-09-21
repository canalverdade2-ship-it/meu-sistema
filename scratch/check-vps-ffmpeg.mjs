import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
ps aux | grep -E "ffmpeg|test-enhance" | grep -v grep
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
