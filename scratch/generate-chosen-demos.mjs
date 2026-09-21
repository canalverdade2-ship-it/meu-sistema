import fs from 'fs';
import path from 'path';

const apiKey = '__FISH_API_KEY_FROM_SECURE_VAULT__';
const castDir = 'public/cast';

const chosenDemos = [
  {
    role: 'chamadas',
    filename: 'demo_chamadas.mp3',
    voiceId: '92e97e4fb1c54d43b9bf9b672fa2eecb',
    name: 'VINHETA 02 (Locutor Comercial)',
    text: 'Nesta sexta-feira, não perca os grandes destaques da economia e os debates mais importantes da semana. Tudo isso e muito mais, aqui na GSA TV.',
  },
  {
    role: 'vinhetas',
    filename: 'demo_vinhetas.mp3',
    voiceId: 'bbfda3cfd1fb4a6ba3c05921532701f1',
    name: 'Globo TV (Vinhetas & A Seguir)',
    text: 'Você está assistindo à GSA TV. A seguir, uma edição especial do GSA Notícias. Continue com a gente!',
  },
  {
    role: 'ancora_masc',
    filename: 'demo_ancora_masc.mp3',
    voiceId: 'fafc0100f94747259ecd6081ae5226aa',
    name: 'Jornalista Titular (Âncora Masculino)',
    text: 'Boa noite. O mercado financeiro fechou o dia em alta e o Congresso aprovou novas medidas para o setor produtivo nacional. Acompanhe os detalhes.',
  },
  {
    role: 'ancora_fem',
    filename: 'demo_ancora_fem.mp3',
    voiceId: '74b5a4384563467b80dd0ca12ca5fd04',
    name: 'Jornalista Titular (Âncora Feminina)',
    text: 'E na edição de hoje, vamos conferir também a previsão do tempo para as capitais e as principais oportunidades de emprego e negócios para esta semana.',
  },
];

async function generateUserChosenDemos() {
  console.log('Generating audio demos with USER-CHOSEN voices via Fish Audio S2.1 Pro Free...');

  for (const d of chosenDemos) {
    console.log(`\nGenerating: ${d.role} -> ${d.name} (${d.voiceId})...`);
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

  console.log('\nALL USER-CHOSEN DEMOS SUCCESSFULLY GENERATED!');
}

generateUserChosenDemos().catch(console.error);
