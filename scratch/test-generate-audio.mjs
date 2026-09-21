import fs from 'fs';

async function testTts() {
  const apiKey = '__FISH_API_KEY_FROM_SECURE_VAULT__';
  const voiceId = '57081e1999014f0d84d7585ef15ef31d';
  const text = 'Boa noite! Você está assistindo à GSA TV, o seu canal de notícias, entretenimento e informação 24 horas no ar.';

  console.log('Sending TTS request to Fish Audio...');

  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: text,
      reference_id: voiceId,
      format: 'mp3',
      latency: 'normal',
    }),
  });

  console.log('TTS Status:', res.status);
  console.log('Content-Type:', res.headers.get('content-type'));

  if (!res.ok) {
    const errText = await res.text();
    console.error('Error response:', errText);
    return;
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync('scratch/teste_voz_adriano.mp3', buffer);
  console.log('SUCCESS! Audio written to scratch/teste_voz_adriano.mp3 with size:', buffer.length, 'bytes');
}

testTts().catch(console.error);
