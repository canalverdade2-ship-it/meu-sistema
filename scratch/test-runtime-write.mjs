import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-encoder-engine touch /runtime/test_write.txt 2>&1 || echo "Falha ao escrever em /runtime"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
