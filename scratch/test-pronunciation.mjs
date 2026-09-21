import fs from 'fs';
import path from 'path';

const FISH_API_KEY = '__FISH_API_KEY_FROM_SECURE_VAULT__';
const VOICE_ID = '5c8a9b5d0b2549c7ada853529199ebe5';

async function generateSample(text, filename) {
  console.log(`Testando texto: "${text}"...`);
  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FISH_API_KEY}`,
      'Content-Type': 'application/json',
      'model': 's2.1-pro-free',
    },
    body: JSON.stringify({
      text,
      reference_id: VOICE_ID,
      format: 'mp3',
    }),
  });

  if (!res.ok) throw new Error(`Erro TTS: ${res.status} ${await res.text()}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filename, buffer);
  console.log(`Salvo: ${filename} (${buffer.length} bytes)`);
}

async function main() {
  const outDir = path.resolve('public/cast');
  // Teste com G.S.A.
  await generateSample('G.S.A. Tá na Rede! O que é assunto e o que viralizou na internet, agora na sua G.S.A. TV!', path.join(outDir, 'test_gsa_dot.mp3'));
}

main().catch(console.error);
