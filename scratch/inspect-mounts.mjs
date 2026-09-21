import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker inspect gsa-tv-ffplayout --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
