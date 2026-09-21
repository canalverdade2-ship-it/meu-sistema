import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
ls -la /opt/gsa-tv/cache/media/1/normalized/media-gsa-manha-news-2026-09-04-draft-qc-v1-720p30.mp4
ls -la /opt/gsa-tv/cache/media/1/production/editorial/2026-09-04/
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
}

main().catch(console.error);
