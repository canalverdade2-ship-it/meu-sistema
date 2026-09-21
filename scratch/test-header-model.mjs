import fs from 'fs';

async function testHeaderModel() {
  const apiKey = '__FISH_API_KEY_FROM_SECURE_VAULT__';
  const voiceId = '57081e1999014f0d84d7585ef15ef31d';
  const text = 'Boa noite! Você está assistindo à GSA TV, o canal de notícias e informação 24 horas no ar com a melhor qualidade de transmissão.';

  console.log('Sending TTS request with header model: s2.1-pro-free...');

  const body = {
    text: text,
    reference_id: voiceId,
    format: 'mp3',
  };

  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'model': 's2.1-pro-free',
    },
    body: JSON.stringify(body),
  });

  console.log('Status:', res.status);
  console.log('Content-Type:', res.headers.get('content-type'));

  if (!res.ok) {
    console.error('Error:', await res.text());
    return;
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync('scratch/voz_adriano_oficial.mp3', buffer);
  console.log('SUCESSO TOTAL! Áudio gerado com a voz do Adriano! Tamanho:', buffer.length, 'bytes');
}

testHeaderModel().catch(console.error);
