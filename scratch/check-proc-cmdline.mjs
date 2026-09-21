import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-encoder-engine ps aux
sudo cat /proc/1480208/cmdline | tr '\\0' ' '
echo ""
sudo cat /proc/1480217/cmdline | tr '\\0' ' '
echo ""
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
