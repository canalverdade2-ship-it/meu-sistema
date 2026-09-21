import fs from 'fs';

async function updateChamadasVoice() {
  const apiKey = '__FISH_API_KEY_FROM_SECURE_VAULT__';
  const newVoiceId = 'fe4308a2886342b1ab4c7a1e61e80bb5';
  const text = 'Nesta sexta-feira, não perca os grandes destaques da economia e os debates mais importantes da semana. Tudo isso e muito mais, aqui na GSA TV.';

  console.log(`Checking new voice for Chamadas (${newVoiceId})...`);

  const infoRes = await fetch(`https://api.fish.audio/model/${newVoiceId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  console.log(`Model Info Status: ${infoRes.status}`);
  let modelTitle = 'Locutor Comercial';
  let modelDesc = '';
  if (infoRes.ok) {
    const info = await infoRes.json();
    modelTitle = info.title || 'Locutor Comercial';
    modelDesc = info.description || '';
    console.log(`-> Title: ${modelTitle}`);
    console.log(`-> Desc: ${modelDesc.slice(0, 100)}`);
  }

  console.log('Generating demo audio with new voice...');
  const ttsRes = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'model': 's2.1-pro-free',
    },
    body: JSON.stringify({
      text: text,
      reference_id: newVoiceId,
      format: 'mp3',
    }),
  });

  console.log(`TTS Status: ${ttsRes.status}`);
  if (ttsRes.ok) {
    const buffer = Buffer.from(await ttsRes.arrayBuffer());
    fs.writeFileSync('public/cast/demo_chamadas.mp3', buffer);
    console.log(`SUCCESS! Saved public/cast/demo_chamadas.mp3 (${buffer.length} bytes)!`);
  } else {
    console.error('TTS Error:', await ttsRes.text());
  }
}

updateChamadasVoice().catch(console.error);
