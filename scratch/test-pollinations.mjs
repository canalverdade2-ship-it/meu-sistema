import fs from 'fs/promises';

async function main() {
  const url = 'https://image.pollinations.ai/prompt/photorealistic%20television%20broadcast%20studio%203d%20gold%20logo?width=1280&height=720&model=flux&nologo=true';
  console.log('Fetching image from Pollinations (Flux)...');
  const res = await fetch(url);
  console.log('Status:', res.status, 'Content-Type:', res.headers.get('content-type'));
  if (res.ok) {
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile('public/cast/test_pollinations_flux.jpg', buf);
    console.log('Imagem gerada e salva com sucesso! Tamanho:', buf.length);
  }
}

main().catch(console.error);
