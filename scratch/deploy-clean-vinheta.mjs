import fs from 'fs/promises';
import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const localVideo = 'public/cast/vinheta_gsa_manha_news_clean.mp4';
  const vidBuf = await fs.readFile(localVideo);
  console.log('Tamanho do video:', vidBuf.length);

  // Transferir em chunks ou via base64
  const b64 = vidBuf.toString('base64');
  console.log('Enviando para a VPS...');
  
  // Vamos salvar no VPS
  const script = `
echo "${b64}" | base64 -d | sudo tee /opt/gsa-tv/cache/media/1/identity/vinhetas/vinheta-gsa-manha-news-clean-master.mp4 > /dev/null
sudo chmod 775 /opt/gsa-tv/cache/media/1/identity/vinhetas/vinheta-gsa-manha-news-clean-master.mp4
sudo chown 989:989 /opt/gsa-tv/cache/media/1/identity/vinhetas/vinheta-gsa-manha-news-clean-master.mp4

# Gerar thumbnail
sudo docker exec gsa-tv-control-plane ffmpeg -nostdin -hide_banner -loglevel error -y \
  -ss 00:00:03 -i /media/1/identity/vinhetas/vinheta-gsa-manha-news-clean-master.mp4 \
  -frames:v 1 -vf "scale=640:360:force_original_aspect_ratio=increase,crop=640:360" -q:v 3 \
  /media/1/thumbnails/media-demo-manha-news-clean.jpg

# Inserir no banco de dados
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" << 'EOF'
insert into public.gsa_tv_media_items (
  id, channel_id, title, original_filename, duration_s,
  video_codec, video_width, video_height, video_fps,
  audio_codec, audio_sample_rate, audio_channels,
  state, rights_ok, drive_path, media_kind, source_type,
  ai_generated, approval_state, metadata
) values (
  'media-demo-manha-news-clean',
  'ch-main',
  'Demonstração — GSA Manhã News (100% Limpa na Origem)',
  'vinheta-gsa-manha-news-clean-master.mp4',
  9,
  'h264', 1920, 1080, 30,
  'aac', 48000, 2,
  'ready', true,
  '/media/1/identity/vinhetas/vinheta-gsa-manha-news-clean-master.mp4',
  'identity', 'system',
  true, 'approved',
  '{"note": "Vinheta produzida na origem sem marcas de agua de IA"}'::jsonb
) on conflict (id) do update set
  title = excluded.title,
  drive_path = excluded.drive_path,
  video_width = excluded.video_width,
  video_height = excluded.video_height,
  state = 'ready',
  updated_at = now();
EOF

echo "Vinheta registrada com sucesso!"
`;

  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
