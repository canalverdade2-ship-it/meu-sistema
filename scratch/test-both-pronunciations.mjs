import fs from 'fs';
import path from 'path';

const FISH_API_KEY = '__FISH_API_KEY_FROM_SECURE_VAULT__';
const VOICE_ID = '5c8a9b5d0b2549c7ada853529199ebe5'; // Impacto Comercial

async function generateSample(text, filename) {
  console.log(`Testando: "${text}" -> ${filename}`);
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

  if (!res.ok) throw new Error(`Erro TTS: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filename, buffer);
  console.log(`Salvo: ${filename} (${buffer.length} bytes)`);
}

async function main() {
  const outDir = path.resolve('public/cast');
  // Variante 1: Exatamente como o usuário pediu "GE.S.A"
  await generateSample('GE.S.A. Tá na Rede! O que é assunto e o que viralizou na internet, agora na sua GE.S.A. TV!', path.join(outDir, 'test_gesa.mp3'));
  // Variante 2: Fonética natural brasileira "Gê Esse Á"
  await generateSample('Gê Esse Á Tá na Rede! O que é assunto e o que viralizou na internet, agora na sua Gê Esse Á TV!', path.join(outDir, 'test_ge_esse_a.mp3'));
}

main().catch(console.error);
