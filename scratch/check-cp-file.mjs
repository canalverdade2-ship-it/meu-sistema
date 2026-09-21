import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
sudo docker exec gsa-tv-control-plane ls -lh /media/1/news/gsa-ta-na-rede-2026-09-02/video/gsa-ta-na-rede-final.mp4
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
