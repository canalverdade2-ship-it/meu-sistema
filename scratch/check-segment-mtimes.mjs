import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    stat --printf="%n %Y %.9y\n" $(ls -t /opt/gsa-tv/runtime/hls/program_*.ts | head -n 6)
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
