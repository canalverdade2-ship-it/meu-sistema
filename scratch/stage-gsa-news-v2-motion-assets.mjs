import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const female = fs.readFileSync(new URL('./gsa-news-v2-female-opening-animated.mp4', import.meta.url)).toString('base64');
const result = await runSshScript(String.raw`set -euo pipefail
root=/opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2
sudo install -d -m 0775 -o 989 -g 986 "$root/motion"
printf '%s' '${female}' | base64 -d | sudo tee "$root/motion/female-opening.mp4" >/dev/null
src=/home/opc/gsa-ai/editions/gsa-news-2026-09-01-30min/broll
avatar_src=/home/opc/gsa-ai/editions/gsa-news-2026-09-01-30min/avatar_clips/female_opening.mp4
if sudo test -f "$avatar_src"; then sudo cp "$avatar_src" "$root/motion/female-opening.mp4"; fi
for item in clima.webm comercio.webm saude.webm tecnologia.webm; do
  if sudo test -f "$src/$item"; then sudo cp "$src/$item" "$root/motion/$item"; fi
done
sudo chown -R 989:986 "$root/motion"
sudo find "$root/motion" -maxdepth 1 -type f -exec chmod 0644 {} +
sudo docker run --rm -v /opt/gsa-tv/cache/media:/media:ro gsa-tv/control-plane:1.6.13 sh -lc '
  for f in /media/1/news/gsa-news-2026-09-01-v2/motion/*; do
    echo "--- $(basename "$f")"; ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$f"; done
'
`, 120000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
