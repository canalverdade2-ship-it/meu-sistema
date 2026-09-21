import fs from 'fs';
import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const scriptContent = fs.readFileSync('scratch/render_script.sh', 'utf8');
  const base64 = Buffer.from(scriptContent).toString('base64');

  const remoteCommand = `
echo "${base64}" | base64 -d > /tmp/run_render.sh
chmod +x /tmp/run_render.sh
bash /tmp/run_render.sh
rm -f /tmp/run_render.sh
`;

  console.log('Enviando e executando render_script.sh na VPS...');
  const res = await runSshScript(remoteCommand);
  console.log('STDOUT:\n', res.stdout);
  if (res.stderr) console.error('STDERR:\n', res.stderr);
}

main().catch(console.error);
