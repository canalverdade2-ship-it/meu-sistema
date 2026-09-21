const FISH_API_KEY = '__FISH_API_KEY_FROM_SECURE_VAULT__';

async function searchFish(query) {
  try {
    const url = `https://api.fish.audio/model?title=${encodeURIComponent(query)}&page_size=30`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${FISH_API_KEY}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).filter(item => 
      (item.languages && item.languages.includes('pt')) || 
      (item.description && /portugu|brasil|brazil|locutor|voz|radialista|rádio/i.test(item.description)) ||
      (item.title && /locutor|rádio|vinheta|chamada|trailer/i.test(item.title))
    );
  } catch (err) {
    return [];
  }
}

async function main() {
  const terms = ['radialista', 'rádio', 'propaganda', 'locução', 'vinheta', 'trailer', 'cinema', 'esporte', 'publicidade', 'impacto'];
  const map = new Map();

  for (const t of terms) {
    const list = await searchFish(t);
    for (const item of list) {
      if (!map.has(item._id)) {
        map.set(item._id, item);
      }
    }
  }

  const results = Array.from(map.values()).map(m => ({
    id: m._id,
    title: m.title,
    description: m.description,
    tags: m.tags,
  }));

  console.log(`Found ${results.length} Portuguese models:`);
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
