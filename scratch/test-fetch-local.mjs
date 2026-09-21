async function test() {
  const url = 'https://api.147-15-43-141.nip.io/gsa-tv/media/media-vinheta-ta-na-rede-opt1/thumbnail';
  const res = await fetch(url);
  console.log('Status:', res.status, 'Content-Type:', res.headers.get('content-type'), 'Content-Length:', res.headers.get('content-length'));
}

test().catch(console.error);
