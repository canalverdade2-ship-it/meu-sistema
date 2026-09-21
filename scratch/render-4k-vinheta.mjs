import { execSync } from 'child_process';
import path from 'path';

async function main() {
  const input = 'C:\\Users\\Adriano Farias\\Downloads\\Vinheta Oficial GSA TV.mp4';
  const out4K = 'C:\\Users\\Adriano Farias\\Downloads\\Vinheta Oficial GSA TV - ULTRA 4K PRO.mp4';

  console.log('Iniciando renderizacao 4K Ultra HD (3840x2160)...');
  const cmd = `ffmpeg -y -i "${input}" -vf "scale=3840:2160:flags=lanczos,eq=contrast=1.07:brightness=-0.012:saturation=1.12,unsharp=5:5:0.75:5:5:0.0" -af "loudnorm=I=-16:TP=-1.5:LRA=11,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo" -c:v libx264 -preset fast -crf 15 -pix_fmt yuv420p -c:a aac -b:a 320k "${out4K}"`;
  execSync(cmd);
  console.log('Versao 4K Ultra HD concluida!');
}

main().catch(console.error);
