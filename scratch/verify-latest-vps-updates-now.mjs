import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -u
file=/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
echo '=== FILE ==='
sudo stat -c 'path=%n\nupdated=%y\nbytes=%s' "$file"
echo '=== LAST HEADINGS ==='
sudo grep -n '^## ' "$file" | tail -n 15
echo '=== LAST 100 LINES ==='
sudo tail -n 100 "$file"
echo '=== ACTIVE SERVICES ==='
for c in gsa-tv-encoder-engine gsa-tv-control-plane gsa-tv-ffplayout gsa-tv-watchdog; do
  sudo docker inspect "$c" --format '{{.Name}}|{{.Config.Image}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' 2>/dev/null || true
done
echo '=== ACTIVE MEDIA PROCESSES ==='
sudo docker top gsa-tv-encoder-engine -eo pid,ppid,etimes,args 2>/dev/null | grep -E '[f]fmpeg' | sed -E 's#rtmps?://[^ ]+#rtmp://[PROTECTED]#g' || true
`, 30000);
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
