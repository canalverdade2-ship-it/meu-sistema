import { runSshScript } from './ssh2-run.mjs';

const script = String.raw`set -euo pipefail
work=/opt/gsa-tv/cache/media/1/nature/licensed-sources-2026-09-03
sudo install -d -o opc -g opc "$work"
cd "$work"
download() {
  name="$1"
  url="$2"
  if [ ! -s "$name" ]; then
    curl -fL --retry 3 --connect-timeout 15 --max-time 900 -o "$name.part" "$url"
    mv "$name.part" "$name"
  fi
}
download forest.webm 'https://upload.wikimedia.org/wikipedia/commons/2/23/Flathead_National_Forest-_Your_Forests_Your_Future_%2848765341522%29.webm'
download plateau.webm 'https://upload.wikimedia.org/wikipedia/commons/3/32/South_Plateau_Project_Overview_Video_%2852408796424%29.webm'
download ocean02.ogv 'https://upload.wikimedia.org/wikipedia/commons/9/9b/Ocean_surface_waves_02.ogv'
download waterfall.ogv 'https://upload.wikimedia.org/wikipedia/commons/9/9e/Video_of_the_waterfall_of_Seythenex.ogv'
probe_image=$(sudo docker inspect gsa-tv-control-plane --format '{{.Config.Image}}')
for file in forest.webm plateau.webm ocean02.ogv waterfall.ogv; do
  printf 'FILE|%s|' "$file"
  stat -c '%s' "$file" | tr '\n' '|'
  sudo docker run --rm -v "$work:/media:ro" "$probe_image" ffprobe -v error -show_entries format=duration:stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels -of compact=p=0:nk=1 "/media/$file" | tr '\n' ';'
  printf '|SHA256|'
  sha256sum "$file" | cut -d' ' -f1
done
`;

const result = await runSshScript(script, 1200000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
