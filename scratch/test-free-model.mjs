import fs from 'fs';

async function testFreeModel() {
  const apiKey = '__FISH_API_KEY_FROM_SECURE_VAULT__';
  const voiceId = '57081e1999014f0d84d7585ef15ef31d';
  const text = 'Boa noite! Você está assistindo à GSA TV, o seu canal de notícias, entretenimento e informação 24 horas no ar.';

  console.log('Testing Fish Audio API with s2.1-pro-free model...');

  const payloads = [
    {
      text: text,
      reference_id: voiceId,
      model: 's2.1-pro-free',
      format: 'mp3',
    },
    {
      text: text,
      reference_id: voiceId,
      model_id: 's2.1-pro-free',
      format: 'mp3',
    },
    {
      text: text,
      reference_id: voiceId,
      format: 'mp3',
      streaming: false,
      model: 's2.1-pro-free',
    }
  ];

  for (let i = 0; i < payloads.length; i++) {
    console.log(`\n--- Tentativa ${i + 1} ---`);
    try {
      const res = await fetch('https://api.fish.audio/v1/tts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloads[i]),
      });

      console.log('Status:', res.status);
      console.log('Content-Type:', res.headers.get('content-type'));

      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(`scratch/teste_voz_adriano_${i}.mp3`, buffer);
        console.log(`SUCESSO! Áudio gravado com ${buffer.length} bytes!`);
        return;
      } else {
        console.log('Erro:', await res.text());
      }
    } catch (e) {
      console.error('Exception:', e.message);
    }
  }
}

testFreeModel().catch(console.error);
