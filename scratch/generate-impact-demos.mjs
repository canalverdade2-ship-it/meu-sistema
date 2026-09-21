import fs from 'fs';
import path from 'path';

const FISH_API_KEY = '__FISH_API_KEY_FROM_SECURE_VAULT__';
const OUTPUT_DIR = path.resolve('public/cast');

const CANDIDATES = [
  {
    key: 'opcao1_josman_impacto',
    name: 'Opção 1 — Josman Brito (Impacto & Anúncio Forte)',
    id: '968319b2951f443f9b357f9be6f5064a',
    desc: 'Voz grave, forte e autoritária, estilo locutor de rádio e chamadas comerciais de alta energia.'
  },
  {
    key: 'opcao2_voz_impacto',
    name: 'Opção 2 — Locutor Voz Impacto (Resonante & Dramático)',
    id: '6d4f267a87a946ec965707005d904a5c',
    desc: 'Voz potente e encorpada com ressonância profunda, ideal para vinhetas com peso e gravidade.'
  },
  {
    key: 'opcao3_lobao_impacto',
    name: 'Opção 3 — Lobão Impacto (Grave & Aveludado)',
    id: '5f8abf888ac548fd9f7af4a4688c2d31',
    desc: 'Tom grave, firme, aveludado e muito elegante, estilo institucional de alta credibilidade.'
  },
  {
    key: 'opcao4_impacto_comercial',
    name: 'Opção 4 — Voz de Impacto Comercial (Clara & Energética)',
    id: '5c8a9b5d0b2549c7ada853529199ebe5',
    desc: 'Voz vibrante, com ritmo rápido, excelente dicção e presença de palco para transições ágeis.'
  },
  {
    key: 'opcao5_sandro_impacto',
    name: 'Opção 5 — Sandro Luis Impacto (Vibrante & Dinâmico)',
    id: '3aa6baab70bf47dca04844e292a308f3',
    desc: 'Voz carismática, dinâmica e chamativa, estilo grandes transmissões de TV e eventos.'
  }
];

const PHRASE = 'Você está assistindo à GSA TV. A seguir, continue acompanhando a nossa programação especial com as principais notícias, análises e entretenimento em alta definição. GSA TV, a sua rede 24 horas no ar.';

async function generateSample(candidate) {
  console.log(`Gerando demo para: ${candidate.name} (${candidate.id})...`);
  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FISH_API_KEY}`,
      'Content-Type': 'application/json',
      'model': 's2.1-pro-free',
    },
    body: JSON.stringify({
      text: PHRASE,
      reference_id: candidate.id,
      format: 'mp3',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Erro ao gerar ${candidate.key}:`, res.status, err);
    return null;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const filePath = path.join(OUTPUT_DIR, `${candidate.key}.mp3`);
  fs.writeFileSync(filePath, buffer);
  console.log(`✅ Salvo: ${filePath} (${(buffer.length / 1024).toFixed(1)} KB)`);
  return filePath;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const c of CANDIDATES) {
    await generateSample(c);
  }
  console.log('Todos os áudios de demonstração foram gerados!');
}

main().catch(console.error);
