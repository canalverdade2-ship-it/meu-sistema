import fs from 'fs';
import path from 'path';

const FISH_API_KEY = '__FISH_API_KEY_FROM_SECURE_VAULT__';
const VOICE_ID = '5c8a9b5d0b2549c7ada853529199ebe5'; // Impacto Comercial

async function generateSample(text, filename) {
  console.log(`Gerando: "${text}" -> ${filename}`);
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
  
  // Teste 1: Palavras completas em português com vírgula para ritmo de TV
  // "Gê, Esse, Á"
  await generateSample('Gê, Esse, Á, Tá na Rede! O que é assunto e o que viralizou na internet, agora na sua Gê, Esse, Á, TV!', path.join(outDir, 'teste_1_ge_esse_a.mp3'));

  // Teste 2: "Gê Esse Á" direto
  await generateSample('Gê Esse Á Tá na Rede! Os virais que quebram a internet, agora na sua Gê Esse Á TV!', path.join(outDir, 'teste_2_ge_esse_a_direto.mp3'));

  // Teste 3: Sem sigla no início (Direto ao ponto, estilo TV moderna)
  // "Tá na Rede! Os virais que quebram a internet, agora na sua Gê Esse Á TV!"
  await generateSample('Tá na Rede! O que é assunto e o que viralizou na internet, agora na Gê Esse Á TV!', path.join(outDir, 'teste_3_ta_na_rede_gsa_tv.mp3'));
}

main().catch(console.error);
