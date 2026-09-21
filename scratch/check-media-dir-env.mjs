import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | grep MEDIA_DIR
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
