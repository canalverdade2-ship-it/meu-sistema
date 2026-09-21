import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-control-plane ffmpeg -nostdin -hide_banner -loglevel error -y \
  -ss 00:00:05 -i /media/1/incoming/media-58eba934-bf86-45bb-a6ab-16f83aa4ab63.mp4 \
  -frames:v 1 -q:v 2 /media/1/thumbnails/test_orig_5s.jpg
ls -lh /opt/gsa-tv/cache/media/1/thumbnails/test_orig_5s.jpg
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
