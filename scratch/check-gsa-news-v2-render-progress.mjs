import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(String.raw`
root=/opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2
echo FILES
sudo find "$root/rendered" -maxdepth 1 -type f -printf '%f %s bytes\n' | sort
echo PROCESS
sudo docker stats --no-stream --format '{{.Name}} CPU={{.CPUPerc}} MEM={{.MemUsage}}' gsa-news-v2-render 2>/dev/null || true
`, 30000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
