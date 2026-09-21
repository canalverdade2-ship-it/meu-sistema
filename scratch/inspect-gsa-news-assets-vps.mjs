import { runSshScript } from './ssh2-run.mjs';
const remote = String.raw`set -euo pipefail
root=/opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01
echo FILES
sudo find "$root" -maxdepth 3 -type f -printf '%P|%s|%TY-%Tm-%Td %TH:%TM:%TS\n' | sort
echo IMAGE_INFO
sudo docker run --rm -v /opt/gsa-tv/cache/media:/media:ro gsa-tv/control-plane:1.6.12 sh -lc "for f in /media/1/news/gsa-news-2026-09-01/work/*.png /media/1/news/gsa-news-2026-09-01/images/*.png; do [ -f \"\$f\" ] || continue; printf '%s|' \"\$f\"; ffprobe -v error -select_streams v:0 -show_entries stream=width,height,pix_fmt -of csv=p=0 \"\$f\"; done"
`;
const result = await runSshScript(remote, 30000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
