import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(`set -u
echo '=== COMPILE FUNCTIONS ==='
sudo docker inspect gsa-tv-control-plane --format 'workdir={{.Config.WorkingDir}} cmd={{json .Config.Cmd}} entry={{json .Config.Entrypoint}}'
sudo docker exec gsa-tv-control-plane sh -lc "find /app /srv -maxdepth 3 -type f -name '*.js' 2>/dev/null | head -n 30" || true
sudo docker exec gsa-tv-control-plane sh -lc "grep -nE 'compilePlaylist|filler|duration.*playlist|playlist.*duration' /app/src/app.js /srv/src/app.js 2>/dev/null | head -n 180" || true
echo '=== PLAYLIST SAMPLE ==='
sudo sed -n '1,180p' /opt/gsa-tv/playlists/1/$(date +%F).json
echo '=== FILLER PROBE ==='
sudo docker exec gsa-tv-control-plane ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 /fallback/gsa-tv-filler-600.mp4 2>/dev/null || true
`,180000);
process.stdout.write(result.stdout); if(result.stderr) process.stderr.write(result.stderr);
