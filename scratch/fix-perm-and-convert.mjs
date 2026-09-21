import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo chmod -R 777 /opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02

# Now convert all mp3 to wav
for f in /opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/audio/*.mp3; do
  base=$(basename "$f" .mp3)
  echo "Converting $base..."
  sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
    -i "/media/1/news/gsa-ta-na-rede-2026-09-02/audio/$base.mp3" \
    -ar 48000 -ac 2 "/media/1/news/gsa-ta-na-rede-2026-09-02/audio/$base.wav"
done

ls -lh /opt/gsa-tv/cache/media/1/news/gsa-ta-na-rede-2026-09-02/audio/
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
