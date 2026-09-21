import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-control-plane ffmpeg -nostdin -hide_banner -loglevel error -y \
  -i /media/1/identity/vinhetas/vinheta-gsa-manha-news.mp4 \
  -vf "delogo=x=1680:y=840:w=120:h=120:show=0" \
  -c:v libx264 -preset fast -crf 16 -pix_fmt yuv420p -c:a copy \
  /media/1/identity/vinhetas/vinheta-gsa-manha-news-clean.mp4

# Extrair frame de verificacao aos 9 segundos
sudo docker exec gsa-tv-control-plane ffmpeg -nostdin -hide_banner -loglevel error -y \
  -ss 00:00:09 -i /media/1/identity/vinhetas/vinheta-gsa-manha-news-clean.mp4 \
  -frames:v 1 /media/1/identity/vinhetas/frame9_clean.jpg

# Atualizar o arquivo principal
sudo mv /opt/gsa-tv/cache/media/1/identity/vinhetas/vinheta-gsa-manha-news-clean.mp4 /opt/gsa-tv/cache/media/1/identity/vinhetas/vinheta-gsa-manha-news.mp4
sudo cp /opt/gsa-tv/cache/media/1/identity/vinhetas/frame9_clean.jpg /opt/gsa-tv/cache/media/1/thumbnails/media-vinheta-gsa-manha-news.jpg

echo "Video vinheta-gsa-manha-news limpo com sucesso!"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
}

main().catch(console.error);
