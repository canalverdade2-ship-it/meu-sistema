import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const res = await runSshScript('edge-tts --list-voices');
  const lines = res.stdout.split('\n').filter(l => l.includes('pt-BR'));
  console.log('pt-BR voices:');
  console.log(lines.join('\n'));
}

main().catch(console.error);
