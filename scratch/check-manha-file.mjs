import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
ls -lh /opt/gsa-tv/cache/media/1/normalized/media-gsa-manha-news*
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
