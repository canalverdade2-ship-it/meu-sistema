import fs from 'fs';
import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
VDIR="/opt/gsa-tv/cache/media/1/identity/vinhetas"
LOGO="/media/1/identity/gsa-tv-logo-transparent.png"
FLOW_ART="/media/1/identity/vinhetas/ta_na_rede_flow_master.png"
TUNNEL="/media/1/identity/motion_bg/neon_tunnel.mp4"
WAVE="/media/1/identity/motion_bg/digital_wave.mp4"
AUDIO="/media/1/identity/vinhetas/vinheta_dynamic_audio.wav"

echo "Executando render ultra-dinâmico..."

sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner \
  -stream_loop -1 -i "$TUNNEL" \
  -stream_loop -1 -i "$WAVE" \
  -loop 1 -i "$FLOW_ART" \
  -i "$LOGO" \
  -i "$AUDIO" \
  -filter_complex \
  "[0:v]setpts=0.4*PTS,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30[tunnel]; \
   [1:v]setpts=0.5*PTS,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,eq=contrast=1.3:saturation=1.5[wave]; \
   [tunnel][wave]blend=all_mode='screen':all_opacity=0.5[bg_dynamic]; \
   [2:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30, \
    zoompan=z='if(lte(on,24), 0.25+0.75*(on/24), 1.02+0.03*sin(on*0.15))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=225:s=1920x1080:fps=30, \
    eq=contrast=1.1:saturation=1.2[art_anim]; \
   [bg_dynamic][art_anim]blend=all_mode='addition':all_opacity=0.85[comp1]; \
   [comp1]drawbox=x=0:y=0:w=1920:h=1080:color=white@0.9:t=fill:enable='between(t,0.75,0.88)'[comp2]; \
   [3:v]scale=210:-1[logo]; \
   [comp2][logo]overlay=W-w-40:40:enable='gte(t,0.88)'[comp3]; \
   [comp3]fade=t=out:st=6.8:d=0.7:color=white[outv]" \
  -map "[outv]" -map 4:a:0 \
  -c:v libx264 -preset fast -crf 17 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -ar 48000 -ac 2 \
  -t 7.5 \
  /media/1/identity/vinhetas/vinheta-gsa-ta-na-rede-tv.mp4

echo "Render concluído com sucesso!"
ls -lh /opt/gsa-tv/cache/media/1/identity/vinhetas/vinheta-gsa-ta-na-rede-tv.mp4

# Extrai os 4 frames de verificação
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error -ss 0.4 -i /media/1/identity/vinhetas/vinheta-gsa-ta-na-rede-tv.mp4 -vframes 1 /media/1/identity/vinhetas/frame_04s.jpg
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error -ss 0.82 -i /media/1/identity/vinhetas/vinheta-gsa-ta-na-rede-tv.mp4 -vframes 1 /media/1/identity/vinhetas/frame_flash.jpg
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error -ss 2.5 -i /media/1/identity/vinhetas/vinheta-gsa-ta-na-rede-tv.mp4 -vframes 1 /media/1/identity/vinhetas/frame_25s.jpg
sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error -ss 5.0 -i /media/1/identity/vinhetas/vinheta-gsa-ta-na-rede-tv.mp4 -vframes 1 /media/1/identity/vinhetas/frame_50s.jpg
`;

  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
