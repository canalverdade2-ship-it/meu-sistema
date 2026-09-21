import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
VDIR="/opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/viral_raw"
mkdir -p "$VDIR"

# Download 3 samples
curl -sL -A "Mozilla/5.0" "https://assets.mixkit.co/videos/1489/1489-720.mp4" -o "$VDIR/viral01_cat.mp4"
curl -sL -A "Mozilla/5.0" "https://assets.mixkit.co/videos/22732/22732-720.mp4" -o "$VDIR/viral02_dog.mp4"
curl -sL -A "Mozilla/5.0" "https://assets.mixkit.co/videos/4285/4285-720.mp4" -o "$VDIR/viral03_pet.mp4"

ls -lh "$VDIR"
sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration:stream=width,height,codec_name -of json /media/1/news/gsa-ta-na-rede-2026-09-02/viral_raw/viral01_cat.mp4
sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration:stream=width,height,codec_name -of json /media/1/news/gsa-ta-na-rede-2026-09-02/viral_raw/viral02_dog.mp4
sudo docker exec gsa-tv-ffplayout ffprobe -v error -show_entries format=duration:stream=width,height,codec_name -of json /media/1/news/gsa-ta-na-rede-2026-09-02/viral_raw/viral03_pet.mp4
`;

  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
