import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sudo docker inspect $(sudo docker ps -q --filter name=control-plane) --format 'StartedAt: {{.State.StartedAt}}, FinishedAt: {{.State.FinishedAt}}, Status: {{.State.Status}}'
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
