import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
VDIR="/opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/viral_raw"
curl -sL -A "Mozilla/5.0" "https://assets.mixkit.co/videos/51500/51500-720.mp4" -o "$VDIR/viral_vertical_01.mp4" || true
curl -sL -A "Mozilla/5.0" "https://assets.mixkit.co/videos/1197/1197-720.mp4" -o "$VDIR/viral_vertical_02.mp4" || true
curl -sL -A "Mozilla/5.0" "https://assets.mixkit.co/videos/1191/1191-720.mp4" -o "$VDIR/viral_vertical_03.mp4" || true

sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration:stream=width,height,codec_name -of json /media/1/news/gsa-ta-na-rede-2026-09-02/viral_raw/viral_vertical_01.mp4
sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration:stream=width,height,codec_name -of json /media/1/news/gsa-ta-na-rede-2026-09-02/viral_raw/viral_vertical_02.mp4
sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration:stream=width,height,codec_name -of json /media/1/news/gsa-ta-na-rede-2026-09-02/viral_raw/viral_vertical_03.mp4
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
