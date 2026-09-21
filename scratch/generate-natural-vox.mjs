import fs from 'fs';
import path from 'path';

const FISH_API_KEY = '__FISH_API_KEY_FROM_SECURE_VAULT__';
const VOICE_ID = '5c8a9b5d0b2549c7ada853529199ebe5'; // Impacto Comercial

async function main() {
  const text = 'Está no ar: Tá na Rede!';
  console.log(`Gerando locução direta de TV: "${text}"...`);
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
  fs.writeFileSync('public/cast/vox_esta_no_ar.mp3', buffer);
  console.log(`Salvo: public/cast/vox_esta_no_ar.mp3 (${buffer.length} bytes)`);
}

main().catch(console.error);
