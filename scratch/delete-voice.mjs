async function tryDeleteVoice() {
  const apiKey = '__FISH_API_KEY_FROM_SECURE_VAULT__';
  const voiceId = '57081e1999014f0d84d7585ef15ef31d';

  console.log(`Tentando excluir o modelo ${voiceId} via API do Fish Audio...`);

  const endpoints = [
    `https://api.fish.audio/model/${voiceId}`,
    `https://api.fish.audio/v1/model/${voiceId}`,
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      console.log(`DELETE ${ep} - Status:`, res.status);
      const text = await res.text();
      console.log('Resposta:', text);
      if (res.ok) {
        console.log('SUCESSO! Voz excluída com sucesso via API!');
        return true;
      }
    } catch (e) {
      console.error(e.message);
    }
  }
  return false;
}

tryDeleteVoice().catch(console.error);
