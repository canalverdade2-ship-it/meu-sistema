import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
edge-tts --voice pt-BR-AntonioNeural --text "GSA Tá na Rede! O que viralizou na internet, agora na sua GSA TV!" --write-media /tmp/edge_gsa.mp3
edge-tts --voice pt-BR-AntonioNeural --text "G.S.A. Tá na Rede! O que viralizou na internet, agora na sua G.S.A. TV!" --write-media /tmp/edge_gsa_dot.mp3
ls -lh /tmp/edge_gsa*.mp3
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
