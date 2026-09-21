async function main() {
  const res = await fetch('https://mixkit.co/free-stock-music/', { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const mp3s = html.match(/https:\/\/[^"']+\.mp3/g) || [];
  console.log('MP3 matches on home page:', mp3s.slice(0, 10));
}
main().catch(console.error);
