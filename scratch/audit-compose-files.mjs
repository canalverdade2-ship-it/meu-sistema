import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const files = [
    '/opt/gsa-tv/encoder-engine/compose.yml',
    '/opt/gsa-tv/compose/compose.yml',
    '/opt/gsa-tv/control-plane/compose.yml',
    '/opt/gsa-tv/watchdog/compose.yml',
    '/home/opc/gsa-ai/compose.yml'
  ];
  for (const f of files) {
    const res = await runSshScript(`echo "=== ${f} ===" && cat ${f}`);
    console.log(res.stdout);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
