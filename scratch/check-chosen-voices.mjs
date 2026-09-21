async function testUserSelectedVoices() {
  const apiKey = '__FISH_API_KEY_FROM_SECURE_VAULT__';

  const inputs = [
    { role: 'Chamadas & Institucional', id: '92e97e4fb1c54d43b9bf9b672fa2eecb' },
    { role: 'Vinhetas & A Seguir', id: 'bbfda3cfd1fb4a6ba3c05921532701f1' },
    { role: 'Telejornal - Ancora Masc (com i)', id: 'fafc0100f94747259ecd6081ae5226aai' },
    { role: 'Telejornal - Ancora Masc (sem i)', id: 'fafc0100f94747259ecd6081ae5226aa' },
    { role: 'Telejornal - Ancora Fem', id: '74b5a4384563467b80dd0ca12ca5fd04' },
  ];

  for (const item of inputs) {
    try {
      const res = await fetch(`https://api.fish.audio/model/${item.id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      console.log(`Checking ${item.role} (${item.id}) - Status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`-> TITLE: ${data.title}`);
        console.log(`-> DESC: ${data.description?.slice(0, 100)}`);
        console.log(`-> LANG: ${data.languages?.join(', ')}`);
      } else {
        console.log(`-> Error: ${await res.text()}`);
      }
    } catch (e) {
      console.error(e.message);
    }
  }
}

testUserSelectedVoices().catch(console.error);
