import { runSshScript } from './ssh2-run.mjs';

const cmd = `
echo '=== DIFF EDITORIAL-PRODUCTION.JS ==='
diff -u /home/opc/gsa-ai/work/night-factory-20260910/editorial-production.js /opt/gsa-tv/control-plane/src/editorial-production.js || echo "Has differences"
echo '=== DIFF APP.JS ==='
diff -u /home/opc/gsa-ai/work/night-factory-20260910/app.js /opt/gsa-tv/control-plane/src/app.js || echo "Has differences"
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
