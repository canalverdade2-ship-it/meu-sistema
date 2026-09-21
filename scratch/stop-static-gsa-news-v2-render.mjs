import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(String.raw`
if sudo docker ps --format '{{.Names}}' | grep -Fxq gsa-news-v2-render; then
  sudo docker stop -t 10 gsa-news-v2-render
else
  echo render-not-running
fi
`, 30000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
