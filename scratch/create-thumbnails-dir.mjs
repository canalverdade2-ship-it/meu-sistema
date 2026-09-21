import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo mkdir -p /opt/gsa-tv/cache/media/1/thumbnails
sudo chown -R 989:989 /opt/gsa-tv/cache/media/1/thumbnails
sudo chmod -R 775 /opt/gsa-tv/cache/media/1/thumbnails
ls -la /opt/gsa-tv/cache/media/1/thumbnails
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
