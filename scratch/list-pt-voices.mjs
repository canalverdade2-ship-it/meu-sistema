import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const cmd = `/tmp/gsa-news-edge-venv/bin/edge-tts --list-voices`;
  const res = await runSshScript(cmd);
  const ptVoices = res.stdout.split('\n').filter(l => l.includes('pt-BR'));
  console.log('Available pt-BR voices:\n' + ptVoices.join('\n'));
}

main().catch(console.error);
