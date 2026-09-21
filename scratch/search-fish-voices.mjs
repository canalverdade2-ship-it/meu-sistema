const FISH_API_KEY = '__FISH_API_KEY_FROM_SECURE_VAULT__';

async function searchFishModels(query) {
  try {
    const url = `https://api.fish.audio/model?title=${encodeURIComponent(query)}&page_size=20`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${FISH_API_KEY}`,
      }
    });
    if (!res.ok) {
      console.log(`Failed to fetch query "${query}": ${res.status} ${res.statusText}`);
      return [];
    }
    const data = await res.json();
    return data.items || [];
  } catch (err) {
    console.error('Error searching fish models:', err.message);
    return [];
  }
}

async function main() {
  const queries = ['locutor', 'chamada', 'trailer', 'impacto', 'comercial', 'grave', 'forte'];
  const allResults = [];
  const seenIds = new Set();

  for (const q of queries) {
    const items = await searchFishModels(q);
    for (const item of items) {
      if (item._id && !seenIds.has(item._id)) {
        seenIds.add(item._id);
        allResults.push({
          id: item._id,
          title: item.title,
          description: item.description,
          languages: item.languages,
          tags: item.tags,
        });
      }
    }
  }

  console.log(`Found ${allResults.length} models:`);
  console.log(JSON.stringify(allResults.slice(0, 30), null, 2));
}

main().catch(console.error);
