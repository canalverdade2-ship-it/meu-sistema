import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`set -euo pipefail
echo '=== PREFLIGHT ==='
if [ -x /home/opc/gsa-ai/bin/gsa-news-preflight.sh ]; then
  /home/opc/gsa-ai/bin/gsa-news-preflight.sh || true
else
  echo 'preflight ausente'
fi
echo '=== AUTOMACOES ==='
rg -l -i 'google vids|flow|fish.audio|fish audio|holt|nyla|gsa-news-finalize' /home/opc/gsa-ai /opt/gsa-tv 2>/dev/null | head -n 160 || true
echo '=== ASSETS IDENTIDADE ==='
find /home/opc/gsa-ai /opt/gsa-tv/cache/media/1 -type f \( -iname '*holt*' -o -iname '*nyla*' -o -iname '*gsa*news*' -o -iname '*vinheta*' \) -printf '%s\t%p\n' 2>/dev/null | sort -nr | head -n 160
echo '=== MANIFESTO V2 ==='
python3 - <<'PY'
import json
p='/opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-01-v2/work/manifest.json'
d=json.load(open(p,encoding='utf-8'))
print(json.dumps(d,ensure_ascii=False,indent=2))
PY
echo '=== SCRIPTS BIN ==='
find /home/opc/gsa-ai/bin -maxdepth 1 -type f -printf '%f\n' | sort
echo '=== BROWSER ==='
curl -fsS http://127.0.0.1:9228/json/version || true
curl -fsS http://127.0.0.1:9228/json/list | python3 -c "import sys,json; print('\\n'.join((x.get('title','')+' | '+x.get('url','')) for x in json.load(sys.stdin)))" 2>/dev/null || true
`;

const result = await runSshScript(remote, 180000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
