import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

async function main() {
  const input = 'C:\\Users\\Adriano Farias\\Downloads\\Vinheta Oficial GSA TV.mp4';
  const outDir = 'C:\\Users\\Adriano Farias\\Downloads';
  const out1080p = path.join(outDir, 'Vinheta Oficial GSA TV - MASTER 1080p PRO.mp4');
  const out4K = path.join(outDir, 'Vinheta Oficial GSA TV - ULTRA 4K PRO.mp4');

  console.log('Iniciando remasterizacao broadcast...');

  // 1. Versao Master 1080p Pro:
  // - unsharp mask para recuperar contornos e nitidez cirurgica
  // - ajuste de contraste e saturacao para ouro vivo e pretos profundos
  // - audio loudnorm EBU R128 a 48kHz
  // - CRF 14 (qualidade visual praticamente sem perdas)
  const cmd1080p = `ffmpeg -y -i "${input}" -vf "eq=contrast=1.07:brightness=-0.012:saturation=1.12,unsharp=5:5:0.85:5:5:0.0" -af "loudnorm=I=-16:TP=-1.5:LRA=11,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo" -c:v libx264 -preset slow -crf 14 -profile:v high -level 4.2 -pix_fmt yuv420p -c:a aac -b:a 320k -sn "${out1080p}"`;
  
  console.log('Processando 1080p Master Pro...');
  execSync(cmd1080p);
  console.log('Master 1080p concluido!');

  // Extrai frames de comparacao antes e depois
  execSync(`ffmpeg -y -ss 00:00:33.2 -i "${input}" -vframes 1 "public/cast/compare_logo_original.jpg"`);
  execSync(`ffmpeg -y -ss 00:00:33.2 -i "${out1080p}" -vframes 1 "public/cast/compare_logo_remastered.jpg"`);

  execSync(`ffmpeg -y -ss 00:00:15.0 -i "${input}" -vframes 1 "public/cast/compare_carro_original.jpg"`);
  execSync(`ffmpeg -y -ss 00:00:15.0 -i "${out1080p}" -vframes 1 "public/cast/compare_carro_remastered.jpg"`);

  console.log('Frames de comparacao extraidos com sucesso!');
}

main().catch(console.error);
