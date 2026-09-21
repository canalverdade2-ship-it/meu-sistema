import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const cmd = `lscpu | head -n 15; free -h; which python3 pip3 docker; python3 --version 2>/dev/null || true`;
  const res = await runSshScript(cmd);
  console.log('STDOUT:\n', res.stdout);
}

main().catch(console.error);
