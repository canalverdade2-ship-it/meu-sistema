import { runSshScript } from './ssh2-run.mjs';

const cmd = `
uptime
curl -s http://127.0.0.1:8770/health
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
