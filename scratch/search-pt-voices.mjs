async function searchPtVoices() {
  const apiKey = '__FISH_API_KEY_FROM_SECURE_VAULT__';

  const queries = [
    'https://api.fish.audio/model?title=Locutor',
    'https://api.fish.audio/model?title=Brasil',
    'https://api.fish.audio/model?title=Noticias',
    'https://api.fish.audio/model?title=Jornal',
    'https://api.fish.audio/model?title=Narrador',
  ];

  for (const q of queries) {
    try {
      const res = await fetch(q, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const data = await res.json();
      console.log(`\nResults for ${q}:`);
      if (data && data.items) {
        for (const it of data.items.slice(0, 5)) {
          console.log(`- ID: ${it._id} | Title: ${it.title} | Languages: ${it.languages?.join(',')} | Description: ${it.description?.slice(0, 80)}`);
        }
      }
    } catch (e) {
      console.error(e.message);
    }
  }
}

searchPtVoices().catch(console.error);
