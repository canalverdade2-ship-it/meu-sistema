import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(
  "sudo sha256sum /opt/gsa-tv/cache/media/1/normalized/media-gsa-manha-news-2026-09-04-draft-qc-v1-720p30.mp4; sudo sha256sum /opt/gsa-tv/cache/media/1/production/editorial/2026-09-04/gsa-manha-news-2026-09-04-07-30-8595acfe/draft-master/gsa-manha-news-2026-09-04-draft-master.mp4; sudo docker inspect gsa-tv-control-plane --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E '^(DATABASE_URL|INTERNAL_API_TOKEN)=' | sed 's/=.*$/=configured/'",
  30000,
);
process.stdout.write(result.stdout);
