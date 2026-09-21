import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    sed -n '110,160p' /opt/gsa-tv/watchdog/src/* || true
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
