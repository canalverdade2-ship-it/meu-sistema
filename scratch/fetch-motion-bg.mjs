import fs from 'fs';

async function main() {
  const urls = [
    'https://mixkit.co/free-stock-video/neon/',
    'https://mixkit.co/free-stock-video/technology/',
    'https://mixkit.co/free-stock-video/abstract/'
  ];

  for (const url of urls) {
    try {
      console.log('Fetching', url);
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const html = await res.text();
      const mp4s = Array.from(new Set(html.match(/https:\/\/assets\.mixkit\.co\/videos\/[0-9]+\/[0-9]+-720\.mp4/g) || []));
      console.log(`Found ${mp4s.length} MP4s in ${url}:`, mp4s.slice(0, 5));
    } catch (e) {
      console.error('Error fetching', url, e.message);
    }
  }
}

main().catch(console.error);
