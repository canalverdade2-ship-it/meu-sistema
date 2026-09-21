import fs from 'fs';
import path from 'path';

const FISH_API_KEY = '__FISH_API_KEY_FROM_SECURE_VAULT__';
const VOICE_ID = '5c8a9b5d0b2549c7ada853529199ebe5'; // Impacto Comercial

async function generateSample(text, filename) {
  console.log(`Testando texto fonético: "${text}"...`);
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
  // Escreve exatamente como se fala em português: Gê Esse Á
  const text = 'Gê Esse Á Tá na Rede! O que é assunto e o que viralizou na internet, agora na sua Gê Esse Á TV!';
  await generateSample(text, path.join(outDir, 'test_gsa_phonetic.mp3'));
}

main().catch(console.error);
