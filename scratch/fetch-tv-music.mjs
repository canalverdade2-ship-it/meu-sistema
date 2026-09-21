import fs from 'fs';

async function main() {
  const urls = [
    'https://mixkit.co/free-stock-music/tag/logo/',
    'https://mixkit.co/free-stock-music/tag/intro/',
    'https://mixkit.co/free-stock-music/tag/broadcast/'
  ];

  for (const url of urls) {
    try {
      console.log('Fetching music from', url);
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const html = await res.text();
      const mp3s = Array.from(new Set(html.match(/https:\/\/assets\.mixkit\.co\/music\/preview\/mixkit-[a-z0-9-]+-[0-9]+\.mp3/g) || []));
      console.log(`Found ${mp3s.length} tracks in ${url}:`, mp3s.slice(0, 5));
    } catch (e) {
      console.error('Error fetching', url, e.message);
    }
  }
}

main().catch(console.error);
