import { runSshScript } from './ssh2-run.mjs';

const cmd = `
ls -la /opt/gsa-tv/cache/media/1/production/ 2>/dev/null || true
ls -la /opt/gsa-tv/cache/media/1/production/editorial/ 2>/dev/null || true
ls -la /opt/gsa-tv/cache/media/1/production/editorial/2026-09-10/ 2>/dev/null || true
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
