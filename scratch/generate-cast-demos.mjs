import fs from 'fs';
import path from 'path';

const apiKey = '__FISH_API_KEY_FROM_SECURE_VAULT__';
const castDir = 'public/cast';

if (!fs.existsSync(castDir)) {
  fs.mkdirSync(castDir, { recursive: true });
}

const demos = [
  {
    role: 'chamadas',
    filename: 'demo_chamadas.mp3',
    voiceId: '572760b7d9ec4a369ca387dad720a828',
    title: 'Locutor Master (Chamadas & Institucional)',
    text: 'Nesta sexta-feira, não perca os grandes destaques da economia e os debates mais importantes da semana. Tudo isso e muito mais, aqui na GSA TV.',
  },
  {
    role: 'vinhetas',
    filename: 'demo_vinhetas.mp3',
    voiceId: '865ad4a69f1e4dd89762f3851daf597b',
    title: 'Voz Dinâmica (Vinhetas & A Seguir)',
    text: 'Você está assistindo à GSA TV. A seguir, uma edição especial do GSA Notícias. Continue com a gente!',
  },
  {
    role: 'ancora_masc',
    filename: 'demo_ancora_masc.mp3',
    voiceId: 'd1ec43a41b0f439197461c4982ae9914',
    title: 'Âncora Masculino (Telejornal Bancada)',
    text: 'Boa noite. O mercado financeiro fechou o dia em alta e o Congresso aprovou novas medidas para o setor produtivo nacional. Acompanhe os detalhes.',
  },
  {
    role: 'ancora_fem',
    filename: 'demo_ancora_fem.mp3',
    voiceId: '80ee2008f2574be5a42766964a4e0235',
    title: 'Âncora Feminina (Telejornal Escalada & Temas)',
    text: 'E na edição de hoje, vamos conferir também a previsão do tempo para as capitais e as principais oportunidades de emprego e negócios para esta semana.',
  },
];

async function generateDemos() {
  console.log('Generating cast audio demos with Fish Audio S2.1 Pro Free...');

  for (const d of demos) {
    console.log(`\nGenerating for role: ${d.role} (${d.title})...`);
    try {
      const res = await fetch('https://api.fish.audio/v1/tts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'model': 's2.1-pro-free',
        },
        body: JSON.stringify({
          text: d.text,
          reference_id: d.voiceId,
          format: 'mp3',
        }),
      });

      console.log(`Status: ${res.status}`);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const filePath = path.join(castDir, d.filename);
        fs.writeFileSync(filePath, buffer);
        console.log(`-> Saved ${filePath} (${buffer.length} bytes)`);
      } else {
        console.error(`Error for ${d.role}:`, await res.text());
      }
    } catch (e) {
      console.error(`Exception for ${d.role}:`, e.message);
    }
  }

  console.log('\nALL DEMOS FINISHED!');
}

generateDemos().catch(console.error);
