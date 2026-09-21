import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    cat /opt/gsa-tv/bin/gsa-process-guardian.sh
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
