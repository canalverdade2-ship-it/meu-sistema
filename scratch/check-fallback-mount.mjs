import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
cat /opt/gsa-tv/encoder-engine/compose.yml
echo "=== CHECAGEM DO ARQUIVO DE FALLBACK ==="
sudo docker exec gsa-tv-encoder-engine ls -la /fallback/ 2>/dev/null || echo "Erro ao listar /fallback no container"
ls -la /opt/gsa-tv/cache/media/1/*fallback* 2>/dev/null || ls -la /opt/gsa-tv/*fallback* 2>/dev/null || echo "Fallback no host"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
