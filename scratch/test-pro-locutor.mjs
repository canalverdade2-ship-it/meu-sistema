import fs from 'fs';

async function testProLocutor() {
  const apiKey = '__FISH_API_KEY_FROM_SECURE_VAULT__';
  const locutorId = '572760b7d9ec4a369ca387dad720a828'; // Locutor Profissional
  const text = 'Você está assistindo à GSA TV. Fique agora com a nossa programação de notícias e entretenimento, 24 horas no ar para todo o Brasil.';

  console.log('Generating sample with professional Brazilian TV announcer...');

  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'model': 's2.1-pro-free',
    },
    body: JSON.stringify({
      text: text,
      reference_id: locutorId,
      format: 'mp3',
    }),
  });

  console.log('Status:', res.status);
  if (res.ok) {
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync('public/locutor_padrao_gsa.mp3', buffer);
    console.log('SUCESSO! Áudio gravado em public/locutor_padrao_gsa.mp3 com', buffer.length, 'bytes!');
  } else {
    console.log('Error:', await res.text());
  }
}

testProLocutor().catch(console.error);
