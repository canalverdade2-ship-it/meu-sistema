import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-ffplayout ffmpeg -nostdin -hide_banner -loglevel error -y \
  -loop 1 -t 8.7 -i /media/1/identity/vinhetas/gsa_manha_clean_art.jpg \
  -stream_loop -1 -t 8.7 -i /media/1/identity/motion_bg/abstract_gold.mp4 \
  -i /media/1/identity/vinhetas/media-vinheta-gsa-manha-news.wav \
  -i /media/1/identity/vinhetas/vinheta_master_audio.wav \
  -filter_complex "\
[0:v]scale=1920:1080,zoompan=z='min(zoom+0.0008,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=261:s=1920x1080:fps=30,format=yuv420p[v0];\
[1:v]scale=1920:1080,fps=30,format=yuv420p,colorchannelmixer=aa=0.25[v1];\
[v0][v1]blend=all_mode='screen':all_opacity=0.35,eq=contrast=1.08:brightness=-0.01:saturation=1.12,format=yuv420p[vout];\
[2:a][3:a]amix=inputs=2:duration=first:weights='1.2 0.8',loudnorm=I=-16:TP=-1.5:LRA=11,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[aout]" \
  -map "[vout]" -map "[aout]" \
  -c:v libx264 -preset fast -crf 16 -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 320k \
  /media/1/identity/vinhetas/vinheta-gsa-manha-news-clean-demo.mp4

# Extrair thumbnails de amostra aos 2s e 5s
sudo docker exec gsa-tv-ffplayout ffmpeg -nostdin -hide_banner -loglevel error -y \
  -ss 00:00:02 -i /media/1/identity/vinhetas/vinheta-gsa-manha-news-clean-demo.mp4 \
  -frames:v 1 -q:v 2 /media/1/identity/vinhetas/demo_frame_02s.jpg

sudo docker exec gsa-tv-ffplayout ffmpeg -nostdin -hide_banner -loglevel error -y \
  -ss 00:00:05 -i /media/1/identity/vinhetas/vinheta-gsa-manha-news-clean-demo.mp4 \
  -frames:v 1 -q:v 2 /media/1/identity/vinhetas/demo_frame_05s.jpg

echo "Vinheta renderizada com sucesso!"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
}

main().catch(console.error);
