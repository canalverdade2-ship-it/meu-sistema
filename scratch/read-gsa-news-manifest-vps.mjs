import { runSshScript } from './ssh2-run.mjs';
const remote = String.raw`sudo cat /opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01/work/manifest.json`;
const result = await runSshScript(remote, 30000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
