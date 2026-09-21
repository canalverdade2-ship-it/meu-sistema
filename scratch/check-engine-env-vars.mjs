import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -i "encoder"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
