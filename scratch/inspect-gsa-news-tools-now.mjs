import { runSshScript } from './ssh2-run.mjs';
const remote = String.raw`set -u
echo '=== BIN CONTENT ==='
for f in /home/opc/gsa-ai/bin/gsa-news-{generate-audio.js,finalize.sh,live-loop.sh}; do echo "---$f"; sed -n '1,260p' "$f"; done
echo '=== CONFIG KEYS (NAMES ONLY) ==='
sed -E 's/=.*$/=<redacted>/' /home/opc/gsa-ai/config/gsa-news-daily.env
echo '=== EDITIONS TODAY ==='
find /home/opc/gsa-ai/editions -maxdepth 2 -type f -printf '%p\n' | sort | tail -n 200
echo '=== BROWSER TABS ==='
curl -fsS http://127.0.0.1:9228/json/list | python3 -c "import sys,json; print('\\n'.join((x.get('id','')+' | '+x.get('title','')+' | '+x.get('url','')) for x in json.load(sys.stdin)))" || true
echo '=== AUTOMATION FILES ==='
find /home/opc/gsa-ai -maxdepth 3 -type f \( -iname '*vids*' -o -iname '*flow*' -o -iname '*fish*' \) -printf '%p\n' | sort
echo '=== V2 MANIFESTS ==='
for p in /opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-0{1,2}*/work/manifest.json; do [ -f "$p" ] && { echo "---$p"; python3 -m json.tool "$p"; }; done
`;
const result = await runSshScript(remote, 120000);
process.stdout.write(result.stdout); if (result.stderr) process.stderr.write(result.stderr);
