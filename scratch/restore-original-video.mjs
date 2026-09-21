import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "update public.gsa_tv_media_items set drive_path = '/media/1/normalized/media-58eba934-bf86-45bb-a6ab-16f83aa4ab63-720p30.mp4', updated_at = now() where id = 'media-58eba934-bf86-45bb-a6ab-16f83aa4ab63';"

sudo docker exec gsa-tv-control-plane ffmpeg -nostdin -hide_banner -loglevel error -y -ss 00:00:03 -i /media/1/normalized/media-58eba934-bf86-45bb-a6ab-16f83aa4ab63-720p30.mp4 -frames:v 1 -vf "scale=640:360:force_original_aspect_ratio=increase,crop=640:360" -q:v 3 /media/1/thumbnails/media-58eba934-bf86-45bb-a6ab-16f83aa4ab63.jpg
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
