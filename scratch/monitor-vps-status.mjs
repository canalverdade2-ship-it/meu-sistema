import { runSshScript } from './ssh2-run.mjs';

async function monitorVpsStatus() {
  const script = `
echo "=== DOCKER RUNNING STATUS ==="
sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo -e "\n=== ACTIVE VIDEO/RENDER PROCESSES ==="
ps aux | grep -E "ffmpeg|python|edge-tts|gsa-news" | grep -v grep || echo "No render process running right now"

echo -e "\n=== RECENT NEWS DIRECTORIES & FILES (/opt/gsa-tv/cache/media/1/news/) ==="
ls -lt /opt/gsa-tv/cache/media/1/news/ | head -n 10

echo -e "\n=== RECENT JOBS IN DATABASE ==="
psql "postgresql://supabase_admin:GSA_SENHA_FORTE_2026@127.0.0.1:5433/gsahub" -c "
SELECT id, job_type, status, progress, created_at, finished_at
FROM public.gsa_tv_jobs
ORDER BY created_at DESC
LIMIT 5;
"
`;

  const res = await runSshScript(script);
  console.log('OUTPUT:\n', res.stdout);
}

monitorVpsStatus().catch(console.error);
