import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
echo "=== 1. CONEXAO RTMP ESTABLISHED ==="
ss -tupn | grep 1935 || echo "Sem conexao RTMP na porta 1935"

echo "=== 2. STATUS DO EVENTO YOUTUBE g-Kbyx_zG-Y ==="
curl -sL "https://www.youtube.com/watch?v=g-Kbyx_zG-Y" | grep -o '"isLive":true\\|"isLiveNow":true\\|"status":"LIVE"' || echo "Consulta Youtube direta"

echo "=== 3. MONITOR DO CONTROL PLANE ==="
sudo docker logs --tail 20 gsa-tv-control-plane 2>&1 | grep -i "youtube\\|stream\\|health" || echo "Sem logs recentes"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
