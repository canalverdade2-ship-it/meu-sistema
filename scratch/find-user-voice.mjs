async function findUserVoice() {
  const apiKey = '__FISH_API_KEY_FROM_SECURE_VAULT__';
  const userId = '62f1841d20554acab55efbb4a3e5dcb7';

  const queries = [
    `https://api.fish.audio/model?creator_id=${userId}`,
    `https://api.fish.audio/model?self=true`,
    `https://api.fish.audio/model?user_id=${userId}`,
    `https://api.fish.audio/model?title=Adriano`,
    `https://api.fish.audio/model?title=GSA`,
  ];

  for (const q of queries) {
    try {
      const res = await fetch(q, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        }
      });
      const data = await res.json().catch(() => null);
      console.log(`Query: ${q} (status ${res.status})`);
      if (data && data.items) {
        console.log(`Found ${data.items.length} items:`);
        for (const it of data.items) {
          console.log(`- ID: ${it._id} | Title: ${it.title} | Creator: ${it.creator_id || it.user_id}`);
        }
      }
    } catch (e) {
      console.error(e.message);
    }
  }
}

findUserVoice().catch(console.error);
