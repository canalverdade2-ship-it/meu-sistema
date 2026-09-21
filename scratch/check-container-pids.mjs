import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker ps -q | xargs -I {} sudo docker inspect {} --format '{{.Name}} {{.State.Pid}}'
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
