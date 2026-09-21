async function main() {
  const pages = [
    'https://mixkit.co/free-sound-effects/logo/',
    'https://mixkit.co/free-sound-effects/transition/',
    'https://mixkit.co/free-sound-effects/whoosh/'
  ];
  for (const p of pages) {
    const res = await fetch(p, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const mp3s = html.match(/https:\/\/[^"']+\.mp3/g) || [];
    console.log(`SFX in ${p}:`, mp3s.slice(0, 5));
  }
}
main().catch(console.error);
