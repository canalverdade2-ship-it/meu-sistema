async function searchCastCandidates() {
  const apiKey = '__FISH_API_KEY_FROM_SECURE_VAULT__';

  const queries = [
    'jornal',
    'noticias',
    'locutor',
    'apresentador',
    'apresentadora',
    'renata',
    'comercial',
    'radialista',
    'tv',
    'dublador',
  ];

  console.log('Searching Fish Audio models for broadcast casting...');

  const found = new Map();

  for (const q of queries) {
    try {
      const res = await fetch(`https://api.fish.audio/model?title=${encodeURIComponent(q)}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      const data = await res.json();
      if (data && data.items) {
        for (const it of data.items) {
          // Check if language includes pt or description has portuguese keywords
          const isPt = it.languages?.includes('pt') ||
            /portug|brasil|brasileir/i.test(it.description || '') ||
            /locutor|jornal|radialista/i.test(it.title || '');
          if (isPt && !found.has(it._id)) {
            found.set(it._id, {
              id: it._id,
              title: it.title,
              description: it.description,
              languages: it.languages,
            });
          }
        }
      }
    } catch (e) {
      console.error(e.message);
    }
  }

  console.log(`\nFound ${found.size} Portuguese candidate models:`);
  for (const [id, m] of found) {
    console.log(`- ID: ${id}`);
    console.log(`  Title: ${m.title}`);
    console.log(`  Desc: ${m.description?.slice(0, 100)}`);
  }
}

searchCastCandidates().catch(console.error);
