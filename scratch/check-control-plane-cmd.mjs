import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker inspect gsa-tv-control-plane --format 'Cmd: {{json .Config.Cmd}} | Entrypoint: {{json .Config.Entrypoint}} | WorkingDir: {{.Config.WorkingDir}}'
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
