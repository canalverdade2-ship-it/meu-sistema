import { runSshScript } from './ssh2-run.mjs';

const cmd = `
for d in incoming normalized live-recordings ai-generated editorial enhanced thumbnails production productions nature gsa-agora-nature gsa-em-fe-10min; do
  echo "=== /opt/gsa-tv/cache/media/1/$d ==="
  sudo du -sh /opt/gsa-tv/cache/media/1/$d
  sudo ls -la /opt/gsa-tv/cache/media/1/$d
done
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
