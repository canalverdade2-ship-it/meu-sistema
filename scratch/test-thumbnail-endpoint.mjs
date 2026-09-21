import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
curl -i https://api.147-15-43-141.nip.io/gsa-tv/media/media-vinheta-gsa-news/thumbnail
`;
  const res = await runSshScript(script);
  console.log(res.stdout.slice(0, 300));
}

main().catch(console.error);
