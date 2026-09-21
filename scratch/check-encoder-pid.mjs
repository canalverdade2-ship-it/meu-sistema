import { runSshScript } from './ssh2-run.mjs';

const cmd = `
ps aux | grep 1495730 | grep -v grep
curl -i http://127.0.0.1:9210/v1/status || true
curl -i http://127.0.0.1:9210/status || true
curl -i http://127.0.0.1:9210/health || true
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
