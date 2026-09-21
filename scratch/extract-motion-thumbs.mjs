import fs from 'fs';
import { runSshScript } from './ssh2-run.mjs';

async function main() {
  await runSshScript('sudo chmod -R 777 /opt/gsa-tv/cache/media/1/identity/motion_bg');
  const clips = ['neon_tunnel', 'digital_wave', 'abstract_gold', 'cyber_network'];
  for (const c of clips) {
    const script = `
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
  -ss 1 -i /media/1/identity/motion_bg/${c}.mp4 \
  -vframes 1 /media/1/identity/motion_bg/${c}_thumb.jpg

base64 -w 0 /opt/gsa-tv/cache/media/1/identity/motion_bg/${c}_thumb.jpg
`;
    const res = await runSshScript(script);
    const buf = Buffer.from(res.stdout.trim().split('\n').pop(), 'base64');
    fs.writeFileSync(`public/cast/${c}_thumb.jpg`, buf);
    console.log(`Saved public/cast/${c}_thumb.jpg (${buf.length} bytes)`);
  }
}

main().catch(console.error);
