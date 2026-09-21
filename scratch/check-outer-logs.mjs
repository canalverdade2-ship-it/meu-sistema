import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
echo "=== 1. PROCESSOS FFMPEG ATIVOS E ARGS ==="
ps -eo pid,args | grep -i ffmpeg | grep -v grep

echo "=== 2. LOGS DO OUTER PROCESS NO ENCODER ENGINE ==="
sudo docker logs --tail 30 gsa-tv-encoder-engine 2>&1

echo "=== 3. TESTE DE SAIDA LOCAL DO UDP ==="
sudo docker exec gsa-tv-encoder-engine ffprobe -v error -show_entries stream=codec_type,codec_name,r_frame_rate,time_base -of json -i "udp://127.0.0.1:12345?timeout=2000000"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
