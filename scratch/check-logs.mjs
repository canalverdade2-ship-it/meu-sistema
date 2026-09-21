import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `sudo journalctl -u gsa-ai-producer.service -n 30 --no-pager`;
  const res = await runSshScript(script);
  console.log('JOURNAL:\n', res.stdout);
}

main().catch(console.error);
